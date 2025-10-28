# utils.py - دوال مساعدة للبرنامج
"""
دوال مساعدة بسيطة للبرنامج
"""
import re
import json
import time
import gc
import psutil
import threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from config import CACHE_FILE, DELIVERY_TERMINOLOGY, PROJECTS_DIR

class TranslationCache:
    """ذاكرة تخزين مؤقت للترجمات"""
    
    def __init__(self):
        self.cache = {}
        self.load_cache()
        
    def load_cache(self):
        """تحميل الذاكرة المؤقتة"""
        try:
            if CACHE_FILE.exists():
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    self.cache = json.load(f)
        except Exception as e:
            print(f"خطأ في تحميل الذاكرة المؤقتة: {e}")
            self.cache = {}
            
    def save_cache(self):
        """حفظ الذاكرة المؤقتة"""
        try:
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.cache, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"خطأ في حفظ الذاكرة المؤقتة: {e}")
            
    def get(self, text):
        """البحث عن ترجمة في الذاكرة"""
        clean_text = clean_text_for_cache(text)
        return self.cache.get(clean_text)
        
    def set(self, text, translation):
        """إضافة ترجمة للذاكرة"""
        clean_text = clean_text_for_cache(text)
        self.cache[clean_text] = translation
        # حفظ كل 10 إضافات
        if len(self.cache) % 10 == 0:
            self.save_cache()

def clean_text_for_translation(text):
    """تنظيف النص للترجمة - فهم النص رغم الشرطات والرموز"""
    if not text or not isinstance(text, str):
        return ""
    
    # إزالة الاقتباسات في البداية والنهاية
    text = text.strip().strip('"\'')
    
    # استبدال الشرطات السفلية بمسافات
    text = text.replace('_', ' ')
    
    # استبدال الشرطات العادية بمسافات (إلا إذا كانت في منتصف كلمة)
    text = re.sub(r'\s*-\s*', ' ', text)
    
    # معالجة النصوص التي تبدأ بـ Ex: أو ex:
    text = re.sub(r'^ex\s*:?\s*', 'مثال: ', text, flags=re.IGNORECASE)
    
    # تنظيف المسافات الإضافية
    text = re.sub(r'\s+', ' ', text).strip()
    
    # معالجة النصوص المتكررة أو الفارغة
    if not text or text.lower() in ['', ' ', 'null', 'undefined']:
        return ""
        
    return text

def clean_text_for_cache(text):
    """تنظيف النص لاستخدامه كمفتاح في الذاكرة المؤقتة"""
    if not text:
        return ""
    return text.lower().strip()

def is_arabic_text(text):
    """التحقق من وجود نص عربي"""
    if not text:
        return False
    arabic_pattern = re.compile(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+')
    return bool(arabic_pattern.search(text))

def has_arabic_content(text):
    """التحقق من وجود محتوى عربي كافي لاعتبار النص مترجماً"""
    if not text:
        return False
    
    # إزالة الرموز والأرقام
    clean_text = re.sub(r'[^\w\s]', '', text)
    clean_text = re.sub(r'\d+', '', clean_text)
    
    # حساب عدد الأحرف العربية
    arabic_chars = len(re.findall(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]', clean_text))
    total_chars = len(re.findall(r'[a-zA-Z\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]', clean_text))
    
    if total_chars == 0:
        return False
        
    # إذا كان أكثر من 50% من الأحرف عربية
    return (arabic_chars / total_chars) > 0.5

def should_skip_translation(text):
    """التحقق مما إذا كان يجب تخطي ترجمة النص"""
    if not text or not isinstance(text, str):
        return True
        
    text = text.strip()
    
    # تخطي النصوص الفارغة أو القصيرة جداً
    if len(text) < 2:
        return True
        
    # تخطي المتغيرات البرمجية
    if re.match(r'^\$\w+$', text):  # $variable
        return True
        
    if re.match(r'^\{\{.*\}\}$', text):  # {{variable}}
        return True
        
    if re.match(r'^\w+\(\)$', text):  # function()
        return True
        
    # تخطي الأرقام فقط
    if text.isdigit():
        return True
        
    # تخطي الرموز فقط
    if re.match(r'^[^\w\s]+$', text):
        return True
        
    # تخطي النصوص المترجمة بالفعل (العربية)
    if has_arabic_content(text):
        return True
        
    return False

def determine_translation_status(original_text, translated_text):
    """تحديد حالة الترجمة بناءً على المحتوى"""
    if not translated_text or translated_text.strip() == "":
        return "غير مترجم"
        
    # إذا كان النص الأصلي والترجمة متطابقين
    if original_text.strip() == translated_text.strip():
        if has_arabic_content(original_text):
            return "لا يحتاج ترجمة"
        else:
            return "غير مترجم"
    
    # إذا كانت الترجمة تحتوي على عربي
    if has_arabic_content(translated_text):
        return "مترجم"
    else:
        return "غير مترجم"

def apply_terminology(text):
    """تطبيق قاموس المصطلحات المخصص"""
    if not text:
        return text
        
    result = text
    for english_term, arabic_term in DELIVERY_TERMINOLOGY.items():
        # استبدال دقيق للكلمات الكاملة
        pattern = r'\b' + re.escape(english_term) + r'\b'
        result = re.sub(pattern, arabic_term, result, flags=re.IGNORECASE)
        
    return result

def format_translation_result(original, translated):
    """تنسيق نتيجة الترجمة"""
    if not translated:
        return original
        
    # تنظيف الترجمة
    translated = translated.strip()
    
    # تطبيق قاموس المصطلحات
    translated = apply_terminology(translated)
    
    # إزالة الاقتباسات الإضافية إذا وجدت
    if translated.startswith('"') and translated.endswith('"'):
        translated = translated[1:-1]
    if translated.startswith("'") and translated.endswith("'"):
        translated = translated[1:-1]
        
    return translated

def validate_api_key(key, provider):
    """التحقق من صحة مفتاح API"""
    if not key or not isinstance(key, str):
        return False
        
    key = key.strip()
    
    if provider == 'openai':
        return key.startswith('sk-') and len(key) > 20
    elif provider == 'google':
        return len(key) > 30
        
    return False

def estimate_cost(word_count, model):
    """تقدير تكلفة الترجمة (تقريبي)"""
    costs = {
        'gpt-4o': 0.005,
        'gpt-4-turbo': 0.01,
        'gpt-3.5-turbo': 0.0015,
        'gemini-2.5-flash': 0.0,  # مجاني (مع حدود)
        'gemini-2.5-pro': 0.0035
    }
    
    cost_per_1k_words = costs.get(model, 0.01)
    return (word_count / 1000) * cost_per_1k_words

def create_backup_filename(original_path):
    """إنشاء اسم ملف النسخة الاحتياطية"""
    path = Path(original_path)
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    return path.parent / f"{path.stem}_backup_{timestamp}{path.suffix}"

def count_words(text):
    """عد الكلمات في النص"""
    if not text:
        return 0
    return len(re.findall(r'\b\w+\b', text))

def sanitize_filename(filename):
    """تنظيف اسم الملف من الرموز غير المسموحة"""
    # إزالة الرموز غير المسموحة في أسماء الملفات
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    return filename

def save_project(file_handler, project_name=None):
    """حفظ المشروع الحالي"""
    if not project_name:
        project_name = f"project_{int(time.time())}"
    
    project_data = {
        'name': project_name,
        'created_at': time.time(),
        'original_file_path': str(file_handler.file_path) if file_handler.file_path else None,
        'translations': file_handler.translations,
        'version': '1.0'
    }
    
    project_file = PROJECTS_DIR / f"{sanitize_filename(project_name)}.json"
    
    try:
        with open(project_file, 'w', encoding='utf-8') as f:
            json.dump(project_data, f, ensure_ascii=False, indent=2)
        return str(project_file)
    except Exception as e:
        raise Exception(f"خطأ في حفظ المشروع: {str(e)}")

def load_project(project_file):
    """تحميل مشروع محفوظ"""
    try:
        with open(project_file, 'r', encoding='utf-8') as f:
            project_data = json.load(f)
        return project_data
    except Exception as e:
        raise Exception(f"خطأ في تحميل المشروع: {str(e)}")

def get_saved_projects():
    """الحصول على قائمة المشاريع المحفوظة"""
    projects = []
    for project_file in PROJECTS_DIR.glob("*.json"):
        try:
            with open(project_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                projects.append({
                    'name': data.get('name', project_file.stem),
                    'file': str(project_file),
                    'created_at': data.get('created_at', 0)
                })
        except:
            continue
    
    # ترتيب حسب تاريخ الإنشاء
    projects.sort(key=lambda x: x['created_at'], reverse=True)
    return projects

def check_internet_connection():
    """فحص الاتصال بالإنترنت"""
    try:
        import urllib.request
        urllib.request.urlopen('http://www.google.com', timeout=5)
        return True
    except:
        return False

def check_internet_connection():
    """فحص الاتصال بالإنترنت"""
    try:
        import urllib.request
        urllib.request.urlopen('http://www.google.com', timeout=5)
        return True
    except:
        return False

def monitor_memory_usage():
    """مراقبة استخدام الذاكرة"""
    process = psutil.Process()
    memory_info = process.memory_info()
    memory_mb = memory_info.rss / 1024 / 1024
    
    return {
        'memory_mb': memory_mb,
        'memory_percent': process.memory_percent(),
        'is_high_usage': memory_mb > 500  # أكثر من 500 MB
    }

def optimize_memory():
    """تحسين استخدام الذاكرة"""
    # تشغيل garbage collector
    gc.collect()
    
    # تحرير الذاكرة غير المستخدمة
    try:
        import ctypes
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except:
        pass  # Windows أو نظام غير مدعوم

def process_large_data_in_chunks(data, chunk_size=1000, process_func=None):
    """معالجة البيانات الكبيرة في مجموعات صغيرة"""
    if not process_func:
        return data
        
    results = []
    total_chunks = len(data) // chunk_size + (1 if len(data) % chunk_size else 0)
    
    for i in range(0, len(data), chunk_size):
        chunk = data[i:i + chunk_size]
        chunk_result = process_func(chunk)
        results.extend(chunk_result if isinstance(chunk_result, list) else [chunk_result])
        
        # تحسين الذاكرة كل 10 مجموعات
        if (i // chunk_size) % 10 == 0:
            optimize_memory()
    
    return results

def estimate_processing_time(items_count, avg_time_per_item=2):
    """تقدير الوقت المطلوب للمعالجة"""
    total_seconds = items_count * avg_time_per_item
    
    if total_seconds < 60:
        return f"{total_seconds:.0f} ثانية"
    elif total_seconds < 3600:
        minutes = total_seconds / 60
        return f"{minutes:.1f} دقيقة"
    else:
        hours = total_seconds / 3600
        return f"{hours:.1f} ساعة"

def create_progress_callback(progress_widget=None, status_widget=None):
    """إنشاء callback للتقدم"""
    def update_progress(current, total, message=""):
        if progress_widget:
            progress_widget.setValue(current)
            progress_widget.setMaximum(total)
            
        if status_widget:
            percentage = int((current / total) * 100) if total > 0 else 0
            status_text = f"{message} {current}/{total} ({percentage}%)"
            status_widget.showMessage(status_text)
    
    return update_progress

def batch_process_with_threading(items, process_func, max_workers=4, chunk_size=100):
    """معالجة دفعية مع خيوط متعددة"""
    results = []
    
    # تقسيم العناصر إلى مجموعات
    chunks = [items[i:i + chunk_size] for i in range(0, len(items), chunk_size)]
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # إرسال المهام للمعالجة
        future_to_chunk = {executor.submit(process_func, chunk): chunk for chunk in chunks}
        
        # جمع النتائج
        for future in future_to_chunk:
            try:
                chunk_result = future.result()
                if isinstance(chunk_result, list):
                    results.extend(chunk_result)
                else:
                    results.append(chunk_result)
            except Exception as e:
                print(f"خطأ في معالجة مجموعة: {e}")
                
    return results

def smart_text_grouping(texts, similarity_threshold=0.7):
    """تجميع ذكي للنصوص المتشابهة"""
    groups = []
    processed = set()
    
    def calculate_similarity(text1, text2):
        # تشابه بسيط بناءً على الكلمات المشتركة
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        if not words1 or not words2:
            return 0
            
        intersection = len(words1.intersection(words2))
        union = len(words1.union(words2))
        return intersection / union if union > 0 else 0
    
    for i, text in enumerate(texts):
        if i in processed:
            continue
            
        current_group = [text]
        processed.add(i)
        
        # البحث عن نصوص متشابهة
        for j, other_text in enumerate(texts[i+1:], i+1):
            if j in processed:
                continue
                
            similarity = calculate_similarity(text, other_text)
            if similarity >= similarity_threshold:
                current_group.append(other_text)
                processed.add(j)
                
                # تحديد حجم المجموعة
                if len(current_group) >= 10:
                    break
        
        groups.append(current_group)
    
    return groups

def calculate_optimal_batch_size(total_items, available_memory_mb=None):
    """حساب الحجم الأمثل للدفعة بناءً على الذاكرة"""
    if not available_memory_mb:
        memory_info = monitor_memory_usage()
        available_memory_mb = 1000 - memory_info['memory_mb']  # افتراض حد أقصى 1GB
    
    # تقدير: كل عنصر يحتاج ~1KB في الذاكرة
    estimated_items_per_mb = 1000
    max_items_by_memory = int(available_memory_mb * estimated_items_per_mb * 0.1)  # 10% من المتاح
    
    # حدود منطقية
    min_batch = 50
    max_batch = 500
    optimal_batch = min(max(min_batch, max_items_by_memory), max_batch)
    
    return min(optimal_batch, total_items)

def performance_timer(func_name="Function"):
    """مؤقت لقياس الأداء"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            start_time = time.time()
            result = func(*args, **kwargs)
            end_time = time.time()
            
            duration = end_time - start_time
            print(f"⏱️ {func_name}: {duration:.2f} ثانية")
            
            return result
        return wrapper
    return decorator

def adaptive_delay_calculator(api_provider, error_count=0):
    """حساب التأخير التكيفي حسب مزود API"""
    base_delays = {
        'openai': 0.5,
        'google': 0.3,
        'anthropic': 1.0
    }
    
    base_delay = base_delays.get(api_provider, 0.5)
    
    # زيادة التأخير مع الأخطاء
    error_multiplier = 1 + (error_count * 0.5)
    
    return min(base_delay * error_multiplier, 10.0)  # حد أقصى 10 ثوان

# إنشاء مثيل عالي للذاكرة المؤقتة
translation_cache = TranslationCache()