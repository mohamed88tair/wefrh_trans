# file_handler.py - معالج ملفات PHP المحدث
"""
معالج ملفات PHP لاستخراج وحفظ الترجمات مع تحسينات
"""
import re
import shutil
import json
from pathlib import Path
from utils import create_backup_filename, sanitize_filename, has_arabic_content, determine_translation_status

class PHPFileHandler:
    """معالج ملفات PHP المحدث"""
    
    def __init__(self):
        self.file_path = None
        self.original_content = ""
        self.translations = []
        self.modified = False
        self.encoding = 'utf-8'
        
    def load_file(self, file_path):
        """تحميل ملف PHP مع دعم ترميزات متعددة"""
        try:
            self.file_path = Path(file_path)
            
            # التحقق من وجود الملف
            if not self.file_path.exists():
                raise FileNotFoundError(f"الملف غير موجود: {file_path}")
                
            # التحقق من امتداد الملف
            if self.file_path.suffix.lower() != '.php':
                raise ValueError("يجب أن يكون الملف من نوع PHP (.php)")
                
            # محاولة قراءة الملف بترميزات مختلفة
            encodings = ['utf-8', 'utf-8-sig', 'windows-1256', 'iso-8859-1', 'cp1252']
            
            for encoding in encodings:
                try:
                    with open(self.file_path, 'r', encoding=encoding) as f:
                        self.original_content = f.read()
                    self.encoding = encoding
                    break
                except UnicodeDecodeError:
                    continue
            else:
                raise ValueError("لا يمكن قراءة الملف. تأكد من الترميز.")
                
            # استخراج الترجمات
            self.translations = self._extract_translations()
            self.modified = False
            
            print(f"✅ تم تحميل الملف بنجاح بترميز {self.encoding}")
            print(f"📊 تم استخراج {len(self.translations)} عنصر")
            
            return True
            
        except Exception as e:
            raise Exception(f"خطأ في تحميل الملف: {str(e)}")
            
    def _extract_translations(self):
        """استخراج النصوص القابلة للترجمة مع تحسين الأداء للملفات الكبيرة"""
        translations = []
        
        # للملفات الكبيرة، نستخدم معالجة مُحسنة
        content_size = len(self.original_content)
        is_large_file = content_size > 100000  # أكبر من 100KB
        
        if is_large_file:
            print(f"📦 ملف كبير ({content_size:,} حرف) - استخدام المعالجة المُحسنة")
            return self._extract_translations_optimized()
        
        # للملفات العادية، المعالجة التقليدية
        return self._extract_translations_standard()
    
    def _extract_translations_optimized(self):
        """استخراج محسن للملفات الكبيرة"""
        translations = []
        
        # أنماط محسنة للملفات الكبيرة
        patterns = [
            r"'([^']{2,100})'\s*=>\s*'([^']{0,200})'",  # تحديد طول أقصى
            r'"([^"]{2,100})"\s*=>\s*"([^"]{0,200})"',
            r"'([^']{2,100})'\s*=>\s*\"([^\"]{0,200})\"",
            r'"([^"]{2,100})"\s*=>\s*\'([^\']{0,200})\''
        ]
        
        # معالجة بالتدفق للملفات الكبيرة
        chunk_size = 10000  # معالجة 10000 سطر في المرة
        lines = self.original_content.split('\n')
        total_lines = len(lines)
        
        print(f"📄 معالجة {total_lines:,} سطر في مجموعات من {chunk_size}")
        
        for chunk_start in range(0, total_lines, chunk_size):
            chunk_end = min(chunk_start + chunk_size, total_lines)
            chunk_lines = lines[chunk_start:chunk_end]
            
            # معالجة المجموعة الحالية
            chunk_translations = self._process_lines_chunk(chunk_lines, chunk_start, patterns)
            translations.extend(chunk_translations)
            
            # تنظيف الذاكرة
            del chunk_lines
            
            # إظهار التقدم
            if chunk_end % 50000 == 0:
                print(f"   📊 تم معالجة {chunk_end:,}/{total_lines:,} سطر ({(chunk_end/total_lines)*100:.1f}%)")
        
        print(f"✅ تم استخراج {len(translations)} عنصر من الملف الكبير")
        return self._deduplicate_translations(translations)
    
    def _extract_translations_standard(self):
        """استخراج تقليدي للملفات العادية"""
        translations = []
        
        patterns = [
            r"'([^']+)'\s*=>\s*'([^']*)'",
            r'"([^"]+)"\s*=>\s*"([^"]*)"',
            r"'([^']+)'\s*=>\s*\"([^\"]*)\"",
            r'"([^"]+)"\s*=>\s*\'([^\']*)\''
        ]
        
        lines = self.original_content.split('\n')
        
        for line_number, line in enumerate(lines, 1):
            line_stripped = line.strip()
            
            if (not line_stripped or 
                line_stripped.startswith(('//','/*','*','#'))):
                continue
            
            for pattern_index, pattern in enumerate(patterns):
                matches = re.finditer(pattern, line)
                
                for match in matches:
                    key = self._clean_extracted_text(match.group(1))
                    value = self._clean_extracted_text(match.group(2))
                    
                    if self._is_valid_translation_pair(key, value):
                        translation_item = {
                            'line_number': line_number,
                            'key': key,
                            'original_value': value,
                            'translated_value': value,
                            'is_translated': has_arabic_content(value),
                            'original_line': line.strip(),
                            'needs_translation': self._needs_translation(value),
                            'pattern_used': pattern_index,
                            'translation_type': 'none'
                        }
                        
                        translations.append(translation_item)
        
        return translations
    
    def _process_lines_chunk(self, lines, start_line_number, patterns):
        """معالجة مجموعة من الأسطر"""
        chunk_translations = []
        
        for line_index, line in enumerate(lines):
            line_number = start_line_number + line_index + 1
            line_stripped = line.strip()
            
            if (not line_stripped or 
                line_stripped.startswith(('//','/*','*','#'))):
                continue
            
            # تجنب الأسطر الطويلة جداً لتوفير الذاكرة
            if len(line) > 1000:
                continue
            
            for pattern_index, pattern in enumerate(patterns):
                try:
                    matches = re.finditer(pattern, line)
                    
                    for match in matches:
                        key = self._clean_extracted_text(match.group(1))
                        value = self._clean_extracted_text(match.group(2))
                        
                        if self._is_valid_translation_pair(key, value):
                            translation_item = {
                                'line_number': line_number,
                                'key': key,
                                'original_value': value,
                                'translated_value': value,
                                'is_translated': has_arabic_content(value),
                                'original_line': line.strip()[:500],  # تقصير للذاكرة
                                'needs_translation': self._needs_translation(value),
                                'pattern_used': pattern_index,
                                'translation_type': 'none'
                            }
                            
                            chunk_translations.append(translation_item)
                            
                except re.error:
                    # تجاهل أخطاء regex للأسطر المعقدة
                    continue
        
        return chunk_translations
    
    def _is_valid_translation_pair(self, key, value):
        """التحقق من صحة زوج الترجمة"""
        # تجنب المفاتيح أو القيم الفارغة
        if not key or not value:
            return False
            
        # تجنب المفاتيح الطويلة جداً (غالباً خطأ في التحليل)
        if len(key) > 100 or len(value) > 500:
            return False
            
        # تجنب النصوص التي تحتوي على رموز برمجية فقط
        if re.match(r'^[\{\}\[\]<>/\\$#@%^&*()+=|~`]+
    
    def _clean_extracted_text(self, text):
        """تنظيف النص المستخرج"""
        if not text:
            return ""
            
        # إزالة المسافات الزائدة
        text = text.strip()
        
        # إزالة escape characters
        text = text.replace('\\n', '\n').replace('\\t', '\t').replace('\\"', '"').replace("\\'", "'")
        
        # إزالة الأكواد الخاصة
        text = re.sub(r'\\[a-zA-Z]', '', text)
        
        return text
    
    def _needs_translation(self, text):
        """تحديد ما إذا كان النص يحتاج لترجمة مع منطق محسن"""
        if not text or not isinstance(text, str):
            return False
            
        text = text.strip()
        
        # تخطي النصوص الفارغة أو القصيرة جداً
        if len(text) < 2:
            return False
            
        # تخطي الأرقام فقط
        if text.isdigit():
            return False
            
        # تخطي المتغيرات البرمجية والرموز
        programming_patterns = [
            r'^\$\w+$',  # $variable
            r'^\{\{.*\}\}$',  # {{variable}}
            r'^\w+\(\)$',  # function()
            r'^[^\w\s]+$',  # رموز فقط
            r'^\w+\.\w+$',  # file.extension
            r'^https?://',  # URLs
            r'^mailto:',  # emails
            r'^\d+[\.\-\s]*\d*$',  # أرقام مع فواصل
            r'^[A-Z_]+$',  # CONSTANTS
            r'^\w+\[\d+\]$'  # array[index]
        ]
        
        for pattern in programming_patterns:
            if re.match(pattern, text):
                return False
        
        # تخطي HTML tags
        if re.match(r'^<[^>]+>$', text):
            return False
            
        # تخطي النصوص التي تحتوي على عربي بالفعل
        if has_arabic_content(text):
            return False
            
        # تخطي النصوص التي تحتوي على رموز برمجية أكثر من كلمات
        word_count = len(re.findall(r'\b[a-zA-Z]+\b', text))
        symbol_count = len(re.findall(r'[^\w\s]', text))
        
        if symbol_count > word_count and word_count < 3:
            return False
        
        # يحتاج للترجمة إذا كان يحتوي على حروف إنجليزية
        return bool(re.search(r'[a-zA-Z]', text)) and word_count > 0
    
    def update_translation(self, index, translated_text, translation_type='manual'):
        """تحديث ترجمة معينة مع نوع الترجمة"""
        if 0 <= index < len(self.translations):
            self.translations[index]['translated_value'] = translated_text
            self.translations[index]['is_translated'] = has_arabic_content(translated_text)
            self.translations[index]['translation_type'] = translation_type
            self.modified = True
            return True
        return False
    
    def get_untranslated_items(self):
        """الحصول على العناصر غير المترجمة"""
        return [item for item in self.translations 
                if item['needs_translation'] and not has_arabic_content(item['translated_value'])]
    
    def get_translation_progress(self):
        """الحصول على تقدم الترجمة بناءً على المحتوى العربي"""
        total_items = len([item for item in self.translations if item['needs_translation']])
        translated_items = len([item for item in self.translations 
                              if item['needs_translation'] and has_arabic_content(item['translated_value'])])
        
        if total_items == 0:
            return 100
            
        return int((translated_items / total_items) * 100)
    
    def create_backup(self):
        """إنشاء نسخة احتياطية من الملف الأصلي"""
        if not self.file_path:
            return None
            
        try:
            backup_path = create_backup_filename(self.file_path)
            shutil.copy2(self.file_path, backup_path)
            print(f"📄 تم إنشاء نسخة احتياطية: {backup_path.name}")
            return backup_path
        except Exception as e:
            print(f"خطأ في إنشاء النسخة الاحتياطية: {e}")
            return None
    
    def save_file(self, output_path=None, create_backup=True):
        """حفظ الملف مع الترجمات مع تحسينات"""
        try:
            # إنشاء نسخة احتياطية إذا طُلب ذلك
            if create_backup and self.file_path:
                self.create_backup()
            
            # تحديد مسار الحفظ
            save_path = Path(output_path) if output_path else self.file_path
            
            # إنشاء المحتوى الجديد
            new_content = self._build_new_content()
            
            # حفظ الملف بنفس الترميز الأصلي
            with open(save_path, 'w', encoding=self.encoding) as f:
                f.write(new_content)
                
            self.modified = False
            
            # إحصائيات الحفظ
            translated_count = len([t for t in self.translations if has_arabic_content(t['translated_value'])])
            print(f"💾 تم حفظ الملف: {save_path.name}")
            print(f"📊 تم حفظ {translated_count} ترجمة")
            
            return True
            
        except Exception as e:
            raise Exception(f"خطأ في حفظ الملف: {str(e)}")
    
    def _build_new_content(self):
        """بناء المحتوى الجديد مع الترجمات مع خوارزمية محسنة"""
        new_content = self.original_content
        
        # ترتيب الترجمات حسب رقم السطر (من الأسفل للأعلى)
        sorted_translations = sorted(self.translations, key=lambda x: x['line_number'], reverse=True)
        
        lines = new_content.split('\n')
        
        for translation in sorted_translations:
            # تحديث فقط الترجمات المعدلة والتي تحتوي على عربي
            if (translation['is_translated'] and 
                has_arabic_content(translation['translated_value']) and
                translation['translated_value'] != translation['original_value']):
                
                line_index = translation['line_number'] - 1
                
                if 0 <= line_index < len(lines):
                    original_line = lines[line_index]
                    updated_line = self._update_line_translation(
                        original_line, 
                        translation['original_value'], 
                        translation['translated_value'],
                        translation['pattern_used']
                    )
                    
                    if updated_line != original_line:
                        lines[line_index] = updated_line
        
        return '\n'.join(lines)
    
    def _update_line_translation(self, line, original_value, new_value, pattern_used):
        """تحديث ترجمة في سطر معين"""
        # تنظيف القيم
        original_escaped = re.escape(original_value)
        new_value_safe = new_value.replace("'", "\\'").replace('"', '\\"')
        
        # أنماط الاستبدال المختلفة حسب النمط المستخدم
        replacement_patterns = [
            # نمط 0: اقتباسات فردية
            (rf"('{original_escaped}'\s*=>\s*')([^']*)'", rf"\1{new_value_safe}'"),
            # نمط 1: اقتباسات مزدوجة  
            (rf'("{original_escaped}"\s*=>\s*")([^"]*)"', rf'\1{new_value_safe}"'),
            # نمط 2: مختلط فردي-مزدوج
            (rf"('{original_escaped}'\s*=>\s*\")([^\"]*)\"", rf'\1{new_value_safe}"'),
            # نمط 3: مختلط مزدوج-فردي
            (rf'("{original_escaped}"\s*=>\s*\')([^\']*)\'', rf"\1{new_value_safe}'"),
            # نمط للنصوص المباشرة
            (rf'\b{original_escaped}\b', new_value_safe)
        ]
        
        # محاولة الاستبدال
        for pattern, replacement in replacement_patterns:
            if re.search(pattern, line):
                updated_line = re.sub(pattern, replacement, line)
                if updated_line != line:
                    return updated_line
        
        # استبدال مباشر كحل أخير
        if original_value in line:
            return line.replace(original_value, new_value_safe)
        
        return line
    
    def export_translations_csv(self, output_path):
        """تصدير الترجمات إلى ملف CSV مع معلومات إضافية"""
        try:
            import csv
            
            with open(output_path, 'w', newline='', encoding='utf-8-sig') as csvfile:
                writer = csv.writer(csvfile)
                
                # كتابة العناوين المحسنة
                writer.writerow([
                    'رقم السطر', 'المفتاح', 'النص الأصلي', 'الترجمة', 
                    'الحالة', 'يحتاج ترجمة', 'نوع الترجمة', 'النمط المستخدم'
                ])
                
                # كتابة البيانات
                for item in self.translations:
                    status = determine_translation_status(item['original_value'], item['translated_value'])
                    
                    writer.writerow([
                        item['line_number'],
                        item['key'],
                        item['original_value'],
                        item['translated_value'],
                        status,
                        'نعم' if item['needs_translation'] else 'لا',
                        item.get('translation_type', 'none'),
                        item.get('pattern_used', 0)
                    ])
                    
            print(f"📊 تم تصدير {len(self.translations)} عنصر إلى CSV")
            return True
            
        except Exception as e:
            raise Exception(f"خطأ في تصدير CSV: {str(e)}")
    
    def get_statistics(self):
        """الحصول على إحصائيات مفصلة"""
        total = len(self.translations)
        needs_translation = len([item for item in self.translations if item['needs_translation']])
        
        # حساب المترجم بناءً على المحتوى العربي
        translated = len([item for item in self.translations 
                         if item['needs_translation'] and has_arabic_content(item['translated_value'])])
        
        auto_translated = len([item for item in self.translations 
                              if item.get('translation_type') == 'auto' and has_arabic_content(item['translated_value'])])
        
        manual_translated = len([item for item in self.translations 
                                if item.get('translation_type') == 'manual' and has_arabic_content(item['translated_value'])])
        
        return {
            'total_items': total,
            'needs_translation': needs_translation,
            'translated': translated,
            'remaining': needs_translation - translated,
            'progress_percentage': self.get_translation_progress(),
            'auto_translated': auto_translated,
            'manual_translated': manual_translated,
            'has_arabic_originally': len([item for item in self.translations 
                                        if has_arabic_content(item['original_value'])])
        }
    
    def get_translation_by_status(self, status_filter):
        """الحصول على ترجمات حسب الحالة"""
        filtered_items = []
        
        for item in self.translations:
            status = determine_translation_status(item['original_value'], item['translated_value'])
            
            if status_filter == "all" or status == status_filter:
                filtered_items.append(item)
                
        return filtered_items
    
    def find_duplicates(self):
        """البحث عن النصوص المكررة"""
        seen = {}
        duplicates = []
        
        for item in self.translations:
            original = item['original_value'].lower().strip()
            if original in seen:
                duplicates.append({
                    'text': original,
                    'lines': [seen[original]['line_number'], item['line_number']],
                    'keys': [seen[original]['key'], item['key']]
                })
            else:
                seen[original] = item
                
        return duplicates
    
    def validate_translations(self):
        """التحقق من صحة الترجمات"""
        issues = []
        
        for i, item in enumerate(self.translations):
            original = item['original_value']
            translated = item['translated_value']
            
            # فحص الترجمات الفارغة
            if item['needs_translation'] and not translated.strip():
                issues.append({
                    'type': 'empty_translation',
                    'line': item['line_number'],
                    'message': 'ترجمة فارغة'
                })
            
            # فحص الترجمات المتطابقة مع الأصل
            if (item['needs_translation'] and 
                original.strip().lower() == translated.strip().lower() and
                not has_arabic_content(translated)):
                issues.append({
                    'type': 'unchanged_translation',
                    'line': item['line_number'],
                    'message': 'لم تتغير عن النص الأصلي'
                })
                
            # فحص الترجمات التي تحتوي على HTML غير متطابق
            original_html = re.findall(r'<[^>]+>', original)
            translated_html = re.findall(r'<[^>]+>', translated)
            
            if original_html != translated_html:
                issues.append({
                    'type': 'html_mismatch',
                    'line': item['line_number'],
                    'message': 'عدم تطابق في HTML tags'
                })
        
        return issues
    
    def export_project_data(self):
        """تصدير بيانات المشروع للحفظ"""
        return {
            'file_path': str(self.file_path) if self.file_path else None,
            'encoding': self.encoding,
            'translations': self.translations,
            'statistics': self.get_statistics(),
            'validation_issues': self.validate_translations(),
            'duplicates': self.find_duplicates()
        }
    
    def import_project_data(self, project_data):
        """استيراد بيانات المشروع"""
        try:
            self.file_path = Path(project_data['file_path']) if project_data.get('file_path') else None
            self.encoding = project_data.get('encoding', 'utf-8')
            self.translations = project_data.get('translations', [])
            self.modified = True
            
            print(f"📂 تم استيراد مشروع يحتوي على {len(self.translations)} عنصر")
            return True
            
        except Exception as e:
            raise Exception(f"خطأ في استيراد بيانات المشروع: {str(e)}")
, value):
            return False
            
        return True
    
    def _deduplicate_translations(self, translations):
        """إزالة الترجمات المكررة"""
        seen = set()
        unique_translations = []
        
        for item in translations:
            # إنشاء مفتاح فريد للمقارنة
            unique_key = (item['key'].lower(), item['original_value'].lower())
            
            if unique_key not in seen:
                seen.add(unique_key)
                unique_translations.append(item)
        
        removed_count = len(translations) - len(unique_translations)
        if removed_count > 0:
            print(f"🔄 تم إزالة {removed_count} عنصر مكرر")
        
        return unique_translations
    
    def _clean_extracted_text(self, text):
        """تنظيف النص المستخرج"""
        if not text:
            return ""
            
        # إزالة المسافات الزائدة
        text = text.strip()
        
        # إزالة escape characters
        text = text.replace('\\n', '\n').replace('\\t', '\t').replace('\\"', '"').replace("\\'", "'")
        
        # إزالة الأكواد الخاصة
        text = re.sub(r'\\[a-zA-Z]', '', text)
        
        return text
    
    def _needs_translation(self, text):
        """تحديد ما إذا كان النص يحتاج لترجمة مع منطق محسن"""
        if not text or not isinstance(text, str):
            return False
            
        text = text.strip()
        
        # تخطي النصوص الفارغة أو القصيرة جداً
        if len(text) < 2:
            return False
            
        # تخطي الأرقام فقط
        if text.isdigit():
            return False
            
        # تخطي المتغيرات البرمجية والرموز
        programming_patterns = [
            r'^\$\w+$',  # $variable
            r'^\{\{.*\}\}$',  # {{variable}}
            r'^\w+\(\)$',  # function()
            r'^[^\w\s]+$',  # رموز فقط
            r'^\w+\.\w+$',  # file.extension
            r'^https?://',  # URLs
            r'^mailto:',  # emails
            r'^\d+[\.\-\s]*\d*$',  # أرقام مع فواصل
            r'^[A-Z_]+$',  # CONSTANTS
            r'^\w+\[\d+\]$'  # array[index]
        ]
        
        for pattern in programming_patterns:
            if re.match(pattern, text):
                return False
        
        # تخطي HTML tags
        if re.match(r'^<[^>]+>$', text):
            return False
            
        # تخطي النصوص التي تحتوي على عربي بالفعل
        if has_arabic_content(text):
            return False
            
        # تخطي النصوص التي تحتوي على رموز برمجية أكثر من كلمات
        word_count = len(re.findall(r'\b[a-zA-Z]+\b', text))
        symbol_count = len(re.findall(r'[^\w\s]', text))
        
        if symbol_count > word_count and word_count < 3:
            return False
        
        # يحتاج للترجمة إذا كان يحتوي على حروف إنجليزية
        return bool(re.search(r'[a-zA-Z]', text)) and word_count > 0
    
    def update_translation(self, index, translated_text, translation_type='manual'):
        """تحديث ترجمة معينة مع نوع الترجمة"""
        if 0 <= index < len(self.translations):
            self.translations[index]['translated_value'] = translated_text
            self.translations[index]['is_translated'] = has_arabic_content(translated_text)
            self.translations[index]['translation_type'] = translation_type
            self.modified = True
            return True
        return False
    
    def get_untranslated_items(self):
        """الحصول على العناصر غير المترجمة"""
        return [item for item in self.translations 
                if item['needs_translation'] and not has_arabic_content(item['translated_value'])]
    
    def get_translation_progress(self):
        """الحصول على تقدم الترجمة بناءً على المحتوى العربي"""
        total_items = len([item for item in self.translations if item['needs_translation']])
        translated_items = len([item for item in self.translations 
                              if item['needs_translation'] and has_arabic_content(item['translated_value'])])
        
        if total_items == 0:
            return 100
            
        return int((translated_items / total_items) * 100)
    
    def create_backup(self):
        """إنشاء نسخة احتياطية من الملف الأصلي"""
        if not self.file_path:
            return None
            
        try:
            backup_path = create_backup_filename(self.file_path)
            shutil.copy2(self.file_path, backup_path)
            print(f"📄 تم إنشاء نسخة احتياطية: {backup_path.name}")
            return backup_path
        except Exception as e:
            print(f"خطأ في إنشاء النسخة الاحتياطية: {e}")
            return None
    
    def save_file(self, output_path=None, create_backup=True):
        """حفظ الملف مع الترجمات مع تحسينات"""
        try:
            # إنشاء نسخة احتياطية إذا طُلب ذلك
            if create_backup and self.file_path:
                self.create_backup()
            
            # تحديد مسار الحفظ
            save_path = Path(output_path) if output_path else self.file_path
            
            # إنشاء المحتوى الجديد
            new_content = self._build_new_content()
            
            # حفظ الملف بنفس الترميز الأصلي
            with open(save_path, 'w', encoding=self.encoding) as f:
                f.write(new_content)
                
            self.modified = False
            
            # إحصائيات الحفظ
            translated_count = len([t for t in self.translations if has_arabic_content(t['translated_value'])])
            print(f"💾 تم حفظ الملف: {save_path.name}")
            print(f"📊 تم حفظ {translated_count} ترجمة")
            
            return True
            
        except Exception as e:
            raise Exception(f"خطأ في حفظ الملف: {str(e)}")
    
    def _build_new_content(self):
        """بناء المحتوى الجديد مع الترجمات مع خوارزمية محسنة"""
        new_content = self.original_content
        
        # ترتيب الترجمات حسب رقم السطر (من الأسفل للأعلى)
        sorted_translations = sorted(self.translations, key=lambda x: x['line_number'], reverse=True)
        
        lines = new_content.split('\n')
        
        for translation in sorted_translations:
            # تحديث فقط الترجمات المعدلة والتي تحتوي على عربي
            if (translation['is_translated'] and 
                has_arabic_content(translation['translated_value']) and
                translation['translated_value'] != translation['original_value']):
                
                line_index = translation['line_number'] - 1
                
                if 0 <= line_index < len(lines):
                    original_line = lines[line_index]
                    updated_line = self._update_line_translation(
                        original_line, 
                        translation['original_value'], 
                        translation['translated_value'],
                        translation['pattern_used']
                    )
                    
                    if updated_line != original_line:
                        lines[line_index] = updated_line
        
        return '\n'.join(lines)
    
    def _update_line_translation(self, line, original_value, new_value, pattern_used):
        """تحديث ترجمة في سطر معين"""
        # تنظيف القيم
        original_escaped = re.escape(original_value)
        new_value_safe = new_value.replace("'", "\\'").replace('"', '\\"')
        
        # أنماط الاستبدال المختلفة حسب النمط المستخدم
        replacement_patterns = [
            # نمط 0: اقتباسات فردية
            (rf"('{original_escaped}'\s*=>\s*')([^']*)'", rf"\1{new_value_safe}'"),
            # نمط 1: اقتباسات مزدوجة  
            (rf'("{original_escaped}"\s*=>\s*")([^"]*)"', rf'\1{new_value_safe}"'),
            # نمط 2: مختلط فردي-مزدوج
            (rf"('{original_escaped}'\s*=>\s*\")([^\"]*)\"", rf'\1{new_value_safe}"'),
            # نمط 3: مختلط مزدوج-فردي
            (rf'("{original_escaped}"\s*=>\s*\')([^\']*)\'', rf"\1{new_value_safe}'"),
            # نمط للنصوص المباشرة
            (rf'\b{original_escaped}\b', new_value_safe)
        ]
        
        # محاولة الاستبدال
        for pattern, replacement in replacement_patterns:
            if re.search(pattern, line):
                updated_line = re.sub(pattern, replacement, line)
                if updated_line != line:
                    return updated_line
        
        # استبدال مباشر كحل أخير
        if original_value in line:
            return line.replace(original_value, new_value_safe)
        
        return line
    
    def export_translations_csv(self, output_path):
        """تصدير الترجمات إلى ملف CSV مع معلومات إضافية"""
        try:
            import csv
            
            with open(output_path, 'w', newline='', encoding='utf-8-sig') as csvfile:
                writer = csv.writer(csvfile)
                
                # كتابة العناوين المحسنة
                writer.writerow([
                    'رقم السطر', 'المفتاح', 'النص الأصلي', 'الترجمة', 
                    'الحالة', 'يحتاج ترجمة', 'نوع الترجمة', 'النمط المستخدم'
                ])
                
                # كتابة البيانات
                for item in self.translations:
                    status = determine_translation_status(item['original_value'], item['translated_value'])
                    
                    writer.writerow([
                        item['line_number'],
                        item['key'],
                        item['original_value'],
                        item['translated_value'],
                        status,
                        'نعم' if item['needs_translation'] else 'لا',
                        item.get('translation_type', 'none'),
                        item.get('pattern_used', 0)
                    ])
                    
            print(f"📊 تم تصدير {len(self.translations)} عنصر إلى CSV")
            return True
            
        except Exception as e:
            raise Exception(f"خطأ في تصدير CSV: {str(e)}")
    
    def get_statistics(self):
        """الحصول على إحصائيات مفصلة"""
        total = len(self.translations)
        needs_translation = len([item for item in self.translations if item['needs_translation']])
        
        # حساب المترجم بناءً على المحتوى العربي
        translated = len([item for item in self.translations 
                         if item['needs_translation'] and has_arabic_content(item['translated_value'])])
        
        auto_translated = len([item for item in self.translations 
                              if item.get('translation_type') == 'auto' and has_arabic_content(item['translated_value'])])
        
        manual_translated = len([item for item in self.translations 
                                if item.get('translation_type') == 'manual' and has_arabic_content(item['translated_value'])])
        
        return {
            'total_items': total,
            'needs_translation': needs_translation,
            'translated': translated,
            'remaining': needs_translation - translated,
            'progress_percentage': self.get_translation_progress(),
            'auto_translated': auto_translated,
            'manual_translated': manual_translated,
            'has_arabic_originally': len([item for item in self.translations 
                                        if has_arabic_content(item['original_value'])])
        }
    
    def get_translation_by_status(self, status_filter):
        """الحصول على ترجمات حسب الحالة"""
        filtered_items = []
        
        for item in self.translations:
            status = determine_translation_status(item['original_value'], item['translated_value'])
            
            if status_filter == "all" or status == status_filter:
                filtered_items.append(item)
                
        return filtered_items
    
    def find_duplicates(self):
        """البحث عن النصوص المكررة"""
        seen = {}
        duplicates = []
        
        for item in self.translations:
            original = item['original_value'].lower().strip()
            if original in seen:
                duplicates.append({
                    'text': original,
                    'lines': [seen[original]['line_number'], item['line_number']],
                    'keys': [seen[original]['key'], item['key']]
                })
            else:
                seen[original] = item
                
        return duplicates
    
    def validate_translations(self):
        """التحقق من صحة الترجمات"""
        issues = []
        
        for i, item in enumerate(self.translations):
            original = item['original_value']
            translated = item['translated_value']
            
            # فحص الترجمات الفارغة
            if item['needs_translation'] and not translated.strip():
                issues.append({
                    'type': 'empty_translation',
                    'line': item['line_number'],
                    'message': 'ترجمة فارغة'
                })
            
            # فحص الترجمات المتطابقة مع الأصل
            if (item['needs_translation'] and 
                original.strip().lower() == translated.strip().lower() and
                not has_arabic_content(translated)):
                issues.append({
                    'type': 'unchanged_translation',
                    'line': item['line_number'],
                    'message': 'لم تتغير عن النص الأصلي'
                })
                
            # فحص الترجمات التي تحتوي على HTML غير متطابق
            original_html = re.findall(r'<[^>]+>', original)
            translated_html = re.findall(r'<[^>]+>', translated)
            
            if original_html != translated_html:
                issues.append({
                    'type': 'html_mismatch',
                    'line': item['line_number'],
                    'message': 'عدم تطابق في HTML tags'
                })
        
        return issues
    
    def export_project_data(self):
        """تصدير بيانات المشروع للحفظ"""
        return {
            'file_path': str(self.file_path) if self.file_path else None,
            'encoding': self.encoding,
            'translations': self.translations,
            'statistics': self.get_statistics(),
            'validation_issues': self.validate_translations(),
            'duplicates': self.find_duplicates()
        }
    
    def import_project_data(self, project_data):
        """استيراد بيانات المشروع"""
        try:
            self.file_path = Path(project_data['file_path']) if project_data.get('file_path') else None
            self.encoding = project_data.get('encoding', 'utf-8')
            self.translations = project_data.get('translations', [])
            self.modified = True
            
            print(f"📂 تم استيراد مشروع يحتوي على {len(self.translations)} عنصر")
            return True
            
        except Exception as e:
            raise Exception(f"خطأ في استيراد بيانات المشروع: {str(e)}")