# translators.py - محركات الترجمة للنماذج المختلفة
"""
كلاسات الترجمة للنماذج المختلفة: GPT, Gemini
"""
import time
import requests
import json
from abc import ABC, abstractmethod
from config import TRANSLATION_PROMPT
from utils import clean_text_for_translation, format_translation_result, translation_cache

class BaseTranslator(ABC):
    """الكلاس الأساسي لجميع المترجمات"""
    
    def __init__(self, api_key, model_name):
        self.api_key = api_key
        self.model_name = model_name
        self.last_request_time = 0
        self.rate_limit_delay = 1  # ثانية واحدة بين الطلبات
        
    @abstractmethod
    def _make_request(self, text):
        """تنفيذ طلب الترجمة (يجب تطبيقه في كل كلاس فرعي)"""
        pass
    
    def translate(self, text, use_cache=True):
        """ترجمة النص مع إدارة الذاكرة المؤقتة ومعالجة أفضل للأخطاء"""
        # تنظيف النص
        clean_text = clean_text_for_translation(text)
        
        if not clean_text:
            return text
        
        # البحث في الذاكرة المؤقتة أولاً
        if use_cache:
            cached_result = translation_cache.get(clean_text)
            if cached_result:
                return cached_result
        
        # تطبيق Rate Limiting
        self._apply_rate_limit()
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # تنفيذ الترجمة
                translated = self._make_request(clean_text)
                
                # تنسيق النتيجة
                formatted_result = format_translation_result(text, translated)
                
                # حفظ في الذاكرة المؤقتة
                if use_cache:
                    translation_cache.set(clean_text, formatted_result)
                
                return formatted_result
                
            except Exception as e:
                error_msg = str(e).lower()
                
                # أخطاء يجب عدم إعادة المحاولة معها
                if any(term in error_msg for term in ['invalid', 'expired', 'unauthorized', '401', '403']):
                    print(f"خطأ في المفتاح - لا يمكن إعادة المحاولة: {e}")
                    return text
                
                # أخطاء مؤقتة - يمكن إعادة المحاولة
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 2  # زيادة وقت الانتظار تدريجياً
                    print(f"محاولة {attempt + 1} فشلت، إعادة المحاولة خلال {wait_time} ثانية...")
                    time.sleep(wait_time)
                    continue
                else:
                    print(f"فشلت جميع المحاولات للنص '{clean_text}': {e}")
                    return text
                    
    def translate_batch_optimized(self, texts, max_batch_size=10):
        """ترجمة دفعية محسنة لتقليل التكاليف"""
        if not texts:
            return []
            
        results = []
        
        # تجميع النصوص المتشابهة
        grouped_texts = self._group_similar_texts(texts)
        
        for group in grouped_texts:
            if len(group) == 1:
                # نص واحد - ترجمة عادية
                translated = self.translate(group[0])
                results.append(translated)
            else:
                # نصوص متشابهة - ترجمة مجمعة
                batch_result = self._translate_similar_batch(group)
                results.extend(batch_result)
                
        return results
    
    def _group_similar_texts(self, texts):
        """تجميع النصوص المتشابهة لتوفير التكلفة"""
        groups = []
        processed = set()
        
        for i, text in enumerate(texts):
            if i in processed:
                continue
                
            # بدء مجموعة جديدة
            current_group = [text]
            processed.add(i)
            
            # البحث عن نصوص متشابهة
            for j, other_text in enumerate(texts[i+1:], i+1):
                if j in processed:
                    continue
                    
                # حساب التشابه
                similarity = self._calculate_similarity(text, other_text)
                
                if similarity > 0.8:  # تشابه عالي
                    current_group.append(other_text)
                    processed.add(j)
                    
                # تحديد حجم المجموعة
                if len(current_group) >= 5:
                    break
            
            groups.append(current_group)
            
        return groups
    
    def _calculate_similarity(self, text1, text2):
        """حساب التشابه بين نصين"""
        # تنظيف النصوص
        clean1 = re.sub(r'[^\w\s]', '', text1.lower())
        clean2 = re.sub(r'[^\w\s]', '', text2.lower())
        
        # حساب الكلمات المشتركة
        words1 = set(clean1.split())
        words2 = set(clean2.split())
        
        if not words1 or not words2:
            return 0
            
        intersection = len(words1.intersection(words2))
        union = len(words1.union(words2))
        
        return intersection / union if union > 0 else 0
    
    def _translate_similar_batch(self, texts):
        """ترجمة مجموعة من النصوص المتشابهة"""
        if len(texts) == 1:
            return [self.translate(texts[0])]
            
        # إنشاء prompt مجمع
        batch_prompt = "ترجم النصوص التالية إلى العربية، كل نص في سطر منفصل:\n\n"
        
        for i, text in enumerate(texts, 1):
            batch_prompt += f"{i}. {text}\n"
            
        batch_prompt += "\nاكتب الترجمات بنفس الترتيب، كل ترجمة في سطر منفصل:"
        
        try:
            # تنفيذ الترجمة المجمعة
            response = self._make_request(batch_prompt)
            
            # تحليل النتيجة
            translations = self._parse_batch_response(response, len(texts))
            
            # التأكد من عدد النتائج
            while len(translations) < len(texts):
                translations.append(texts[len(translations)])  # إضافة النص الأصلي
                
            return translations[:len(texts)]
            
        except Exception as e:
            print(f"فشل في الترجمة المجمعة: {e}")
            # العودة للترجمة الفردية
            return [self.translate(text) for text in texts]
    
    def _parse_batch_response(self, response, expected_count):
        """تحليل استجابة الترجمة المجمعة"""
        lines = response.strip().split('\n')
        translations = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # إزالة الأرقام في البداية
            clean_line = re.sub(r'^\d+\.\s*', '', line)
            if clean_line:
                translations.append(clean_line)
                
        return translations
    
    def get_cost_estimate(self, text):
        """تقدير تكلفة ترجمة النص"""
        word_count = len(text.split())
        
        # تكاليف تقديرية للنماذج (لكل 1000 كلمة)
        model_costs = {
            'gpt-4o': 0.005,
            'gpt-4-turbo': 0.01,
            'gpt-3.5-turbo': 0.0015,
            'gemini-2.5-flash': 0.0,
            'gemini-2.5-pro': 0.0035
        }
        
        cost_per_1k = model_costs.get(self.model_name, 0.01)
        return (word_count / 1000) * cost_per_1k
        """الحصول على ترجمات متعددة للنص"""
        translations = []
        
        # الترجمة الأساسية
        base_translation = self.translate(text)
        translations.append(base_translation)
        
        # ترجمات إضافية بطرق مختلفة
        variations = [
            f"ترجم بطريقة رسمية: {text}",
            f"ترجم بطريقة مبسطة: {text}",
            f"اعط ترجمة مختصرة: {text}"
        ]
        
        for variation in variations[:count-1]:
            try:
                translated = self._make_request(variation)
                if translated and translated != base_translation:
                    translations.append(format_translation_result(text, translated))
            except:
                continue
                
        return list(set(translations))  # إزالة التكرارات
    
    def _apply_rate_limit(self):
        """تطبيق حد معدل الطلبات"""
        current_time = time.time()
        time_since_last_request = current_time - self.last_request_time
        
        if time_since_last_request < self.rate_limit_delay:
            time.sleep(self.rate_limit_delay - time_since_last_request)
        
        self.last_request_time = time.time()

class GPTTranslator(BaseTranslator):
    """مترجم OpenAI GPT"""
    
    def __init__(self, api_key, model_name='gpt-3.5-turbo'):
        super().__init__(api_key, model_name)
        self.base_url = "https://api.openai.com/v1/chat/completions"
        self.rate_limit_delay = 0.5  # GPT أسرع قليلاً
        
    def _make_request(self, text):
        """تنفيذ طلب الترجمة لـ GPT"""
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
        
        data = {
            'model': self.model_name,
            'messages': [
                {
                    'role': 'system',
                    'content': TRANSLATION_PROMPT
                },
                {
                    'role': 'user',
                    'content': text
                }
            ],
            'max_tokens': 150,
            'temperature': 0.3
        }
        
        response = requests.post(self.base_url, headers=headers, json=data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            return result['choices'][0]['message']['content'].strip()
        else:
            raise Exception(f"GPT API Error: {response.status_code} - {response.text}")

class GeminiTranslator(BaseTranslator):
    """مترجم Google Gemini - محدث للإصدارات الجديدة"""
    
    def __init__(self, api_key, model_name='gemini-2.5-flash'):
        super().__init__(api_key, model_name)
        # تحديد اسم النموذج الصحيح للـ API
        if model_name == 'gemini-2.5-flash':
            self.api_model_name = 'gemini-2.0-flash-exp'
        elif model_name == 'gemini-2.5-pro':
            self.api_model_name = 'gemini-2.0-flash-exp'  # استخدام نفس النموذج مؤقتاً
        else:
            self.api_model_name = 'gemini-2.0-flash-exp'
            
        self.base_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.api_model_name}:generateContent"
        self.rate_limit_delay = 0.3  # Gemini سريع
        
    def _make_request(self, text):
        """تنفيذ طلب الترجمة لـ Gemini"""
        url = f"{self.base_url}?key={self.api_key}"
        
        headers = {
            'Content-Type': 'application/json'
        }
        
        data = {
            'contents': [
                {
                    'parts': [
                        {
                            'text': f"{TRANSLATION_PROMPT}\n\n{text}"
                        }
                    ]
                }
            ],
            'generationConfig': {
                'temperature': 0.3,
                'maxOutputTokens': 150,
                'topP': 0.8,
                'topK': 40
            },
            'safetySettings': [
                {
                    'category': 'HARM_CATEGORY_HARASSMENT',
                    'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
                },
                {
                    'category': 'HARM_CATEGORY_HATE_SPEECH',
                    'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
                },
                {
                    'category': 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                    'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
                },
                {
                    'category': 'HARM_CATEGORY_DANGEROUS_CONTENT',
                    'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
                }
            ]
        }
        
        response = requests.post(url, headers=headers, json=data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            if 'candidates' in result and len(result['candidates']) > 0:
                candidate = result['candidates'][0]
                if 'content' in candidate and 'parts' in candidate['content']:
                    content = candidate['content']['parts'][0]['text']
                    return content.strip()
                else:
                    raise Exception("Gemini: بنية الاستجابة غير متوقعة")
            else:
                raise Exception("Gemini: لا توجد نتائج في الاستجابة")
        else:
            error_info = ""
            try:
                error_data = response.json()
                if 'error' in error_data:
                    error_info = error_data['error'].get('message', '')
            except:
                error_info = response.text
            raise Exception(f"Gemini API Error: {response.status_code} - {error_info}")

class TranslatorManager:
    """مدير النماذج وإدارة الترجمة"""
    
    def __init__(self):
        self.translators = {}
        self.current_translator = None
        
    def add_translator(self, name, translator):
        """إضافة مترجم جديد"""
        self.translators[name] = translator
        
    def set_current_translator(self, name):
        """تعيين المترجم الحالي"""
        if name in self.translators:
            self.current_translator = self.translators[name]
            return True
        return False
        
    def get_available_translators(self):
        """الحصول على قائمة المترجمات المتاحة"""
        return list(self.translators.keys())
        
    def translate(self, text, translator_name=None):
        """ترجمة النص باستخدام المترجم المحدد أو الحالي"""
        if translator_name and translator_name in self.translators:
            return self.translators[translator_name].translate(text)
        elif self.current_translator:
            return self.current_translator.translate(text)
        else:
            raise Exception("لم يتم تعيين مترجم")
            
    def get_multiple_translations(self, text, translator_name=None):
        """الحصول على ترجمات متعددة"""
        if translator_name and translator_name in self.translators:
            return self.translators[translator_name].get_multiple_translations(text)
        elif self.current_translator:
            return self.current_translator.get_multiple_translations(text)
        else:
            return [text]
            
    def translate_batch(self, texts, translator_name=None, progress_callback=None):
        """ترجمة مجموعة من النصوص"""
        results = []
        total = len(texts)
        
        for i, text in enumerate(texts):
            try:
                translated = self.translate(text, translator_name)
                results.append(translated)
                
                # تحديث شريط التقدم
                if progress_callback:
                    progress_callback(i + 1, total)
                    
            except Exception as e:
                print(f"خطأ في ترجمة النص '{text}': {e}")
                results.append(text)  # إرجاع النص الأصلي في حالة الخطأ
                
        return results
        
    def test_translator(self, translator_name):
        """اختبار مترجم معين"""
        if translator_name not in self.translators:
            return False, "المترجم غير موجود"
            
        try:
            test_text = "Hello"
            result = self.translators[translator_name].translate(test_text)
            
            if result and result != test_text:
                return True, f"نجح الاختبار: {result}"
            else:
                return False, "فشل في الترجمة"
                
        except Exception as e:
            return False, f"خطأ في الاختبار: {str(e)}"

# دالة مساعدة لإنشاء المترجمات
def create_translator(provider, api_key, model_name=None):
    """إنشاء مترجم حسب النوع"""
    if provider == 'openai':
        model = model_name or 'gpt-3.5-turbo'
        return GPTTranslator(api_key, model)
    elif provider == 'google':
        model = model_name or 'gemini-2.5-flash'
        return GeminiTranslator(api_key, model)
    else:
        raise ValueError(f"مزود غير مدعوم: {provider}")