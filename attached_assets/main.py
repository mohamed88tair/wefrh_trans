# main.py - الواجهة الرئيسية للبرنامج
"""
برنامج ترجمة ملفات PHP - الواجهة الرئيسية المحدثة
يدعم GPT-4o, GPT-4-Turbo, GPT-3.5, Gemini 2.5 Flash/Pro
"""
import sys
import time
import os
from pathlib import Path
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QTableWidget, QTableWidgetItem, QPushButton, QComboBox, QLabel,
    QProgressBar, QFileDialog, QMessageBox, QLineEdit, QTextEdit,
    QDialog, QFormLayout, QTabWidget, QSplitter, QHeaderView,
    QMenuBar, QStatusBar, QGroupBox, QCheckBox, QSpinBox, QMenu,
    QAction, QInputDialog
)
from PyQt5.QtCore import Qt, QThread, pyqtSignal, QTimer
from PyQt5.QtGui import QFont, QIcon, QPixmap, QColor

# استيراد الملفات المحلية
from config import config, SUPPORTED_MODELS
from file_handler import PHPFileHandler
from translators import TranslatorManager, create_translator
from utils import (validate_api_key, estimate_cost, count_words, translation_cache, 
                   check_internet_connection, save_project, load_project, 
                   get_saved_projects, determine_translation_status, has_arabic_content)

class TranslationThread(QThread):
    """خيط منفصل لتنفيذ الترجمة مع تحسينات الأداء"""
    
    progress_updated = pyqtSignal(int, int)  # current, total
    translation_completed = pyqtSignal(int, str, str)  # index, translation, type
    error_occurred = pyqtSignal(str)
    finished_all = pyqtSignal()
    
    def __init__(self, translator_manager, items_to_translate, translator_name):
        super().__init__()
        self.translator_manager = translator_manager
        self.items_to_translate = items_to_translate
        self.translator_name = translator_name
        self.is_cancelled = False
        self.batch_size = 10
        
    def run(self):
        """تنفيذ عملية الترجمة مع تحسينات"""
        total = len(self.items_to_translate)
        completed = 0
        
        try:
            for batch_start in range(0, total, self.batch_size):
                if self.is_cancelled:
                    break
                    
                batch_end = min(batch_start + self.batch_size, total)
                batch = self.items_to_translate[batch_start:batch_end]
                
                for index, text in batch:
                    if self.is_cancelled:
                        break
                        
                    try:
                        # فحص الاتصال قبل الترجمة
                        if not check_internet_connection():
                            self.error_occurred.emit("انقطع الاتصال بالإنترنت")
                            self.msleep(5000)  # انتظار 5 ثوان
                            continue
                            
                        # تنفيذ الترجمة
                        translated = self.translator_manager.translate(text, self.translator_name)
                        
                        if translated and translated != text:
                            self.translation_completed.emit(index, translated, "auto")
                        else:
                            self.translation_completed.emit(index, text, "auto")
                            
                        completed += 1
                        self.progress_updated.emit(completed, total)
                        self.msleep(200)
                        
                    except Exception as e:
                        error_msg = f"خطأ في ترجمة '{text[:50]}...': {str(e)}"
                        self.error_occurred.emit(error_msg)
                        self.translation_completed.emit(index, text, "auto")
                        completed += 1
                        self.progress_updated.emit(completed, total)
                        
                if not self.is_cancelled and batch_end < total:
                    self.msleep(1000)
                    
        except Exception as e:
            self.error_occurred.emit(f"خطأ عام في الترجمة: {str(e)}")
            
        finally:
            self.finished_all.emit()
        
    def cancel(self):
        """إلغاء عملية الترجمة"""
        self.is_cancelled = True

class CostAnalysisDialog(QDialog):
    """نافذة تحليل التكلفة واختيار الاستراتيجية"""
    
    def __init__(self, untranslated_items, current_model, strategies, parent=None):
        super().__init__(parent)
        self.untranslated_items = untranslated_items
        self.current_model = current_model
        self.strategies = strategies
        self.selected_strategy = None
        
        self.setWindowTitle("تحليل التكلفة واختيار الاستراتيجية")
        self.setFixedSize(700, 500)
        self.setLayoutDirection(Qt.RightToLeft)
        self.setup_ui()
        
    def setup_ui(self):
        layout = QVBoxLayout()
        
        # معلومات عامة
        info_group = QGroupBox("معلومات الترجمة")
        info_layout = QFormLayout()
        
        total_items = len(self.untranslated_items)
        total_words = sum(words for _, _, words in self.untranslated_items)
        
        info_layout.addRow("عدد النصوص:", QLabel(f"{total_items:,}"))
        info_layout.addRow("إجمالي الكلمات:", QLabel(f"{total_words:,}"))
        info_layout.addRow("النموذج الحالي:", QLabel(self.current_model))
        
        info_group.setLayout(info_layout)
        layout.addWidget(info_group)
        
        # استراتيجيات التكلفة
        strategy_group = QGroupBox("اختر استراتيجية الترجمة")
        strategy_layout = QVBoxLayout()
        
        self.strategy_buttons = QGroupBox()
        buttons_layout = QVBoxLayout()
        
        from PyQt5.QtWidgets import QRadioButton, QButtonGroup
        self.button_group = QButtonGroup()
        
        for key, strategy in self.strategies.items():
            radio = QRadioButton()
            radio.setText(f"{strategy['name']} - ${strategy['cost']:.4f}")
            radio.setToolTip(strategy['description'])
            
            # إضافة وصف مفصل
            desc_label = QLabel(f"   📝 {strategy['description']}")
            desc_label.setStyleSheet("color: #666; font-size: 11px; margin-left: 20px;")
            
            # تلوين حسب التكلفة
            if strategy['cost'] == min(s['cost'] for s in self.strategies.values()):
                radio.setStyleSheet("color: #28a745; font-weight: bold;")  # الأرخص
                desc_label.setText(f"   💚 {strategy['description']} - الأرخص!")
            elif strategy['cost'] == max(s['cost'] for s in self.strategies.values()):
                radio.setStyleSheet("color: #dc3545;")  # الأغلى
            else:
                radio.setStyleSheet("color: #ffc107;")  # متوسط
            
            buttons_layout.addWidget(radio)
            buttons_layout.addWidget(desc_label)
            
            self.button_group.addButton(radio)
            radio.setProperty('strategy_key', key)
            
            # تحديد الاستراتيجية الاقتصادية افتراضياً
            if strategy['cost'] == min(s['cost'] for s in self.strategies.values()):
                radio.setChecked(True)
                self.selected_strategy = strategy
        
        self.strategy_buttons.setLayout(buttons_layout)
        strategy_layout.addWidget(self.strategy_buttons)
        
        # إحصائيات التوفير
        savings_label = QLabel()
        max_cost = max(s['cost'] for s in self.strategies.values())
        min_cost = min(s['cost'] for s in self.strategies.values())
        potential_savings = max_cost - min_cost
        
        if potential_savings > 0:
            savings_text = f"💰 التوفير المحتمل: ${potential_savings:.4f} ({((potential_savings/max_cost)*100):.1f}%)"
            savings_label.setText(savings_text)
            savings_label.setStyleSheet("color: #28a745; font-weight: bold; font-size: 12px;")
            strategy_layout.addWidget(savings_label)
        
        strategy_group.setLayout(strategy_layout)
        layout.addWidget(strategy_group)
        
        # أزرار التحكم
        buttons_layout = QHBoxLayout()
        
        ok_btn = QPushButton("بدء الترجمة")
        ok_btn.setStyleSheet("background-color: #28a745; color: white; font-weight: bold; padding: 8px 20px;")
        ok_btn.clicked.connect(self.accept)
        
        cancel_btn = QPushButton("إلغاء")
        cancel_btn.clicked.connect(self.reject)
        
        details_btn = QPushButton("تفاصيل التكلفة")
        details_btn.clicked.connect(self.show_cost_details)
        
        buttons_layout.addWidget(details_btn)
        buttons_layout.addStretch()
        buttons_layout.addWidget(ok_btn)
        buttons_layout.addWidget(cancel_btn)
        
        layout.addLayout(buttons_layout)
        self.setLayout(layout)
        
        # ربط تغيير الاختيار
        self.button_group.buttonClicked.connect(self.on_strategy_changed)
        
    def on_strategy_changed(self, button):
        """عند تغيير الاستراتيجية المختارة"""
        strategy_key = button.property('strategy_key')
        self.selected_strategy = self.strategies[strategy_key]
        
    def get_selected_strategy(self):
        """الحصول على الاستراتيجية المختارة"""
        return self.selected_strategy
        
    def show_cost_details(self):
        """عرض تفاصيل التكلفة"""
        details_text = "📊 تفاصيل التكلفة لكل استراتيجية:\n\n"
        
        for strategy in self.strategies.values():
            details_text += f"🔹 {strategy['name']}\n"
            details_text += f"   التكلفة: ${strategy['cost']:.4f}\n"
            details_text += f"   الوصف: {strategy['description']}\n\n"
        
        QMessageBox.information(self, "تفاصيل التكلفة", details_text)


class SmartTranslationThread(QThread):
    """خيط ترجمة ذكي مع تحسين التكلفة"""
    
    progress_updated = pyqtSignal(int, int)
    translation_completed = pyqtSignal(int, str, str)
    error_occurred = pyqtSignal(str)
    finished_all = pyqtSignal()
    cost_saved = pyqtSignal(float, str)
    
    def __init__(self, translator_manager, translation_queue):
        super().__init__()
        self.translator_manager = translator_manager
        self.translation_queue = translation_queue  # [(index, text, model), ...]
        self.is_cancelled = False
        self.total_cost_saved = 0.0
        
    def run(self):
        total = len(self.translation_queue)
        completed = 0
        
        # تجميع النصوص حسب النموذج للمعالجة الدفعية
        model_groups = {}
        for index, text, model in self.translation_queue:
            if model not in model_groups:
                model_groups[model] = []
            model_groups[model].append((index, text))
        
        try:
            for model, items in model_groups.items():
                if self.is_cancelled:
                    break
                    
                print(f"🤖 معالجة {len(items)} نص باستخدام {model}")
                
                for index, text in items:
                    if self.is_cancelled:
                        break
                        
                    try:
                        # فحص الاتصال
                        if not check_internet_connection():
                            self.error_occurred.emit("انقطع الاتصال بالإنترنت")
                            self.msleep(5000)
                            continue
                        
                        # الترجمة الذكية مع Cache
                        translated = self.smart_translate(text, model)
                        
                        if translated and translated != text:
                            self.translation_completed.emit(index, translated, "smart")
                        else:
                            self.translation_completed.emit(index, text, "smart")
                            
                        completed += 1
                        self.progress_updated.emit(completed, total)
                        
                        # توقف متكيف حسب النموذج
                        delay = self.get_model_delay(model)
                        self.msleep(delay)
                        
                    except Exception as e:
                        error_msg = f"خطأ في ترجمة '{text[:30]}...': {str(e)}"
                        self.error_occurred.emit(error_msg)
                        self.translation_completed.emit(index, text, "smart")
                        completed += 1
                        self.progress_updated.emit(completed, total)
                
                # توقف بين النماذج
                if not self.is_cancelled and len(model_groups) > 1:
                    self.msleep(2000)
                    
        except Exception as e:
            self.error_occurred.emit(f"خطأ عام في الترجمة الذكية: {str(e)}")
            
        finally:
            if self.total_cost_saved > 0:
                self.cost_saved.emit(self.total_cost_saved, "تم توفير التكلفة!")
            self.finished_all.emit()
    
    def smart_translate(self, text, model):
        """ترجمة ذكية مع تحسين"""
        # البحث في Cache أولاً
        from utils import translation_cache
        cached = translation_cache.get(text)
        if cached:
            return cached
            
        # تحسين النص قبل الإرسال
        optimized_text = self.optimize_text_for_translation(text)
        
        # الترجمة
        translated = self.translator_manager.translate(optimized_text, model)
        
        # حساب التوفير
        original_cost = estimate_cost(count_words(text), 'gpt-4o')  # أغلى نموذج
        actual_cost = estimate_cost(count_words(text), model)
        self.total_cost_saved += (original_cost - actual_cost)
        
        return translated
    
    def optimize_text_for_translation(self, text):
        """تحسين النص لتقليل التكلفة"""
        # إزالة المسافات الزائدة
        optimized = re.sub(r'\s+', ' ', text.strip())
        
        # تجنب ترجمة النصوص التي تحتوي على رموز برمجية كثيرة
        symbol_ratio = len(re.findall(r'[^\w\s]', optimized)) / len(optimized) if optimized else 0
        if symbol_ratio > 0.5:
            return optimized[:50]  # تقصير النصوص المليئة بالرموز
            
        return optimized
    
    def get_model_delay(self, model):
        """الحصول على التأخير المناسب للنموذج"""
        delays = {
            'gpt-3.5-turbo': 300,      # 300ms
            'gemini-2.5-flash': 200,   # 200ms  
            'gemini-2.5-pro': 500,     # 500ms
            'gpt-4-turbo': 800,        # 800ms
            'gpt-4o': 1000             # 1s
        }
        return delays.get(model, 500)
    
    def cancel(self):
        self.is_cancelled = True


class MultiTranslationDialog(QDialog):
    """نافذة عرض ترجمات متعددة"""
    
    def __init__(self, text, translations, parent=None):
        super().__init__(parent)
        self.setWindowTitle("اختر الترجمة المناسبة")
        self.setFixedSize(500, 400)
        self.setLayoutDirection(Qt.RightToLeft)
        self.selected_translation = translations[0] if translations else text
        self.setup_ui(text, translations)
        
    def setup_ui(self, text, translations):
        layout = QVBoxLayout()
        
        # النص الأصلي
        layout.addWidget(QLabel(f"النص الأصلي: {text}"))
        
        # قائمة الترجمات
        for i, translation in enumerate(translations):
            btn = QPushButton(f"{i+1}. {translation}")
            btn.clicked.connect(lambda checked, t=translation: self.select_translation(t))
            layout.addWidget(btn)
        
        # أزرار الإغلاق
        buttons_layout = QHBoxLayout()
        ok_btn = QPushButton("موافق")
        cancel_btn = QPushButton("إلغاء")
        
        ok_btn.clicked.connect(self.accept)
        cancel_btn.clicked.connect(self.reject)
        
        buttons_layout.addWidget(ok_btn)
        buttons_layout.addWidget(cancel_btn)
        layout.addLayout(buttons_layout)
        
        self.setLayout(layout)
        
    def select_translation(self, translation):
        self.selected_translation = translation

class SettingsDialog(QDialog):
    """نافذة الإعدادات المحدثة"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("إعدادات البرنامج")
        self.setFixedSize(600, 500)
        self.setLayoutDirection(Qt.RightToLeft)
        self.setup_ui()
        self.load_settings()
        
    def setup_ui(self):
        layout = QVBoxLayout()
        tabs = QTabWidget()
        
        # تبويب مفاتيح API
        api_tab = QWidget()
        api_layout = QFormLayout()
        
        self.openai_key_input = QLineEdit()
        self.openai_key_input.setPlaceholderText("sk-...")
        self.openai_key_input.setEchoMode(QLineEdit.Password)
        api_layout.addRow("OpenAI API Key:", self.openai_key_input)
        
        self.google_key_input = QLineEdit()
        self.google_key_input.setPlaceholderText("Google API Key")
        self.google_key_input.setEchoMode(QLineEdit.Password)
        api_layout.addRow("Google API Key:", self.google_key_input)
        
        # أزرار اختبار
        test_layout = QHBoxLayout()
        self.test_openai_btn = QPushButton("اختبار OpenAI")
        self.test_google_btn = QPushButton("اختبار Google")
        
        test_layout.addWidget(self.test_openai_btn)
        test_layout.addWidget(self.test_google_btn)
        
        api_layout.addRow(test_layout)
        api_tab.setLayout(api_layout)
        tabs.addTab(api_tab, "مفاتيح API")
        
        # تبويب الإعدادات العامة
        general_tab = QWidget()
        general_layout = QFormLayout()
        
        self.auto_save_checkbox = QCheckBox()
        self.auto_save_checkbox.setChecked(True)
        general_layout.addRow("الحفظ التلقائي:", self.auto_save_checkbox)
        
        self.auto_save_interval_input = QSpinBox()
        self.auto_save_interval_input.setRange(1, 60)
        self.auto_save_interval_input.setValue(5)
        self.auto_save_interval_input.setSuffix(" دقيقة")
        general_layout.addRow("فترة الحفظ التلقائي:", self.auto_save_interval_input)
        
        self.backup_checkbox = QCheckBox()
        self.backup_checkbox.setChecked(True)
        general_layout.addRow("إنشاء نسخة احتياطية:", self.backup_checkbox)
        
        self.batch_size_input = QSpinBox()
        self.batch_size_input.setRange(1, 50)
        self.batch_size_input.setValue(10)
        general_layout.addRow("حجم الدفعة:", self.batch_size_input)
        
        self.connection_timeout_input = QSpinBox()
        self.connection_timeout_input.setRange(60, 600)
        self.connection_timeout_input.setValue(180)
        self.connection_timeout_input.setSuffix(" ثانية")
        general_layout.addRow("مهلة انقطاع الاتصال:", self.connection_timeout_input)
        
        general_tab.setLayout(general_layout)
        tabs.addTab(general_tab, "إعدادات عامة")
        
        layout.addWidget(tabs)
        
        # أزرار الحفظ والإلغاء
        buttons_layout = QHBoxLayout()
        self.save_btn = QPushButton("حفظ")
        self.cancel_btn = QPushButton("إلغاء")
        
        buttons_layout.addWidget(self.save_btn)
        buttons_layout.addWidget(self.cancel_btn)
        
        layout.addLayout(buttons_layout)
        self.setLayout(layout)
        
        # ربط الإشارات
        self.save_btn.clicked.connect(self.save_settings)
        self.cancel_btn.clicked.connect(self.close)
        self.test_openai_btn.clicked.connect(lambda: self.test_api('openai'))
        self.test_google_btn.clicked.connect(lambda: self.test_api('google'))
        
    def load_settings(self):
        """تحميل الإعدادات الحالية"""
        self.openai_key_input.setText(config.get_api_key('openai'))
        self.google_key_input.setText(config.get_api_key('google'))
        
        self.auto_save_checkbox.setChecked(config.get_setting('auto_save', True))
        self.auto_save_interval_input.setValue(config.get_setting('auto_save_interval', 5))
        self.backup_checkbox.setChecked(config.get_setting('backup_files', True))
        self.batch_size_input.setValue(config.get_setting('batch_size', 10))
        self.connection_timeout_input.setValue(config.get_setting('connection_timeout', 180))
        
    def save_settings(self):
        """حفظ الإعدادات"""
        config.set_api_key('openai', self.openai_key_input.text())
        config.set_api_key('google', self.google_key_input.text())
        
        config.set_setting('auto_save', self.auto_save_checkbox.isChecked())
        config.set_setting('auto_save_interval', self.auto_save_interval_input.value())
        config.set_setting('backup_files', self.backup_checkbox.isChecked())
        config.set_setting('batch_size', self.batch_size_input.value())
        config.set_setting('connection_timeout', self.connection_timeout_input.value())
        
        QMessageBox.information(self, "نجح", "تم حفظ الإعدادات بنجاح!")
        self.close()
        
    def test_api(self, provider):
        """اختبار مفتاح API"""
        if provider == 'openai':
            api_key = self.openai_key_input.text()
            button = self.test_openai_btn
        elif provider == 'google':
            api_key = self.google_key_input.text()
            button = self.test_google_btn
        else:
            return
            
        if not api_key.strip():
            QMessageBox.warning(self, "خطأ", f"يرجى إدخال مفتاح {provider} أولاً!")
            return
            
        button.setEnabled(False)
        button.setText("جارٍ الاختبار...")
        QApplication.processEvents()
        
        try:
            if provider == 'openai':
                translator = create_translator('openai', api_key, 'gpt-3.5-turbo')
            elif provider == 'google':
                translator = create_translator('google', api_key, 'gemini-2.5-flash')
            
            test_text = "test"
            result = translator.translate(test_text)
            
            if result and result.strip() and result.lower() != test_text.lower():
                QMessageBox.information(self, f"✅ نجح {provider}", 
                                      f"تم اختبار {provider} بنجاح!\nالترجمة: {result}")
                button.setText(f"✅ نجح")
                button.setStyleSheet("background-color: #28a745;")
            else:
                QMessageBox.warning(self, f"❌ فشل {provider}", 
                                  f"فشل في اختبار {provider}!")
                button.setText(f"❌ فشل")
                button.setStyleSheet("background-color: #dc3545;")
                
        except Exception as e:
            QMessageBox.critical(self, f"❌ خطأ {provider}", f"فشل اختبار {provider}:\n{str(e)}")
            button.setText(f"❌ فشل")
            button.setStyleSheet("background-color: #dc3545;")
            
        finally:
            button.setEnabled(True)
            QTimer.singleShot(3000, lambda: self.reset_test_button(button, provider))
            
    def reset_test_button(self, button, provider):
        """إعادة تعيين زر الاختبار"""
        button.setText(f"اختبار {provider}")
        button.setStyleSheet("")

class MainWindow(QMainWindow):
    """النافذة الرئيسية للبرنامج المحدثة"""
    
    def __init__(self):
        super().__init__()
        self.file_handler = PHPFileHandler()
        self.translator_manager = TranslatorManager()
        self.translation_thread = None
        self.auto_save_timer = QTimer()
        self.connection_check_timer = QTimer()
        self.last_connection_time = time.time()
        self.project_name = None
        
        self.setup_ui()
        self.setup_translators()
        self.setup_auto_save()
        self.setup_connection_monitor()
        
    def setup_ui(self):
        """إعداد واجهة المستخدم المحدثة"""
        self.setWindowTitle("مترجم ملفات PHP المتقدم - GPT-4o | Gemini 2.5")
        self.setGeometry(100, 100, 1200, 800)
        self.setLayoutDirection(Qt.RightToLeft)
        
        self.setup_menu_bar()
        
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout()
        
        # شريط الأدوات العلوي
        toolbar_layout = QHBoxLayout()
        
        # أزرار الملفات والمشاريع
        self.open_file_btn = QPushButton("📁 فتح ملف PHP")
        self.save_file_btn = QPushButton("💾 حفظ")
        self.save_project_btn = QPushButton("📦 حفظ مشروع")
        self.load_project_btn = QPushButton("📂 تحميل مشروع")
        
        # اختيار النموذج
        self.model_label = QLabel("النموذج:")
        self.model_combo = QComboBox()
        self.model_combo.addItem("اختر النموذج...")
        
        # أزرار الترجمة
        self.translate_all_btn = QPushButton("🌐 ترجمة الكل")
        self.translate_selected_btn = QPushButton("🔄 ترجمة المحدد")
        self.stop_btn = QPushButton("⏹ إيقاف")
        self.stop_btn.setEnabled(False)
        
        toolbar_layout.addWidget(self.open_file_btn)
        toolbar_layout.addWidget(self.save_file_btn)
        toolbar_layout.addWidget(self.save_project_btn)
        toolbar_layout.addWidget(self.load_project_btn)
        toolbar_layout.addStretch()
        toolbar_layout.addWidget(self.model_label)
        toolbar_layout.addWidget(self.model_combo)
        toolbar_layout.addStretch()
        toolbar_layout.addWidget(self.translate_all_btn)
        toolbar_layout.addWidget(self.translate_selected_btn)
        toolbar_layout.addWidget(self.stop_btn)
        
        main_layout.addLayout(toolbar_layout)
        
        # شريط البحث والفلاتر
        search_layout = QHBoxLayout()
        
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("🔍 البحث في النصوص...")
        
        self.filter_combo = QComboBox()
        self.filter_combo.addItems([
            "عرض الكل",
            "يحتاج ترجمة فقط", 
            "مترجم فقط",
            "لا يحتاج ترجمة"
        ])
        
        self.results_label = QLabel("0 عنصر")
        
        search_layout.addWidget(QLabel("بحث:"))
        search_layout.addWidget(self.search_input)
        search_layout.addWidget(QLabel("فلتر:"))
        search_layout.addWidget(self.filter_combo)
        search_layout.addStretch()
        search_layout.addWidget(self.results_label)
        
        main_layout.addLayout(search_layout)
        
        # الجدول الرئيسي - بدون عمود المفتاح
        self.table = QTableWidget()
        self.table.setColumnCount(4)  # إزالة عمود المفتاح
        self.table.setHorizontalHeaderLabels([
            "النص الأصلي", "الترجمة", "الحالة", "إجراءات"
        ])
        
        # تنسيق الجدول مع تحكم في الأعمدة
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.Fixed)
        header.setSectionResizeMode(1, QHeaderView.Fixed)
        header.setSectionResizeMode(2, QHeaderView.Fixed)
        header.setSectionResizeMode(3, QHeaderView.Fixed)
        
        # تطبيق قياسات الأعمدة من الإعدادات
        column_widths = config.get_setting('column_widths', {
            'original': 300,
            'translation': 300,
            'status': 120,
            'actions': 150
        })
        
        self.table.setColumnWidth(0, column_widths['original'])
        self.table.setColumnWidth(1, column_widths['translation'])
        self.table.setColumnWidth(2, column_widths['status'])
        self.table.setColumnWidth(3, column_widths['actions'])
        
        self.table.setAlternatingRowColors(True)
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        # تحسين ارتفاع الصفوف
        self.table.verticalHeader().setDefaultSectionSize(40)
        
        main_layout.addWidget(self.table)
        
        # شريط المعلومات والتقدم
        info_layout = QHBoxLayout()
        
        self.file_label = QLabel("لم يتم فتح أي ملف")
        self.stats_label = QLabel("الإحصائيات: 0/0")
        self.progress_bar = QProgressBar()
        self.cost_label = QLabel("التكلفة التقديرية: $0.00")
        self.connection_label = QLabel("🟢 متصل")
        
        info_layout.addWidget(self.file_label)
        info_layout.addWidget(self.connection_label)
        info_layout.addStretch()
        info_layout.addWidget(self.stats_label)
        info_layout.addWidget(self.progress_bar)
        info_layout.addWidget(self.cost_label)
        
        main_layout.addLayout(info_layout)
        
        central_widget.setLayout(main_layout)
        
        # شريط الحالة
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("جاهز")
        
        # ربط الإشارات
        self.open_file_btn.clicked.connect(self.open_file)
        self.save_file_btn.clicked.connect(self.save_file)
        self.save_project_btn.clicked.connect(self.save_project)
        self.load_project_btn.clicked.connect(self.load_project)
        self.translate_all_btn.clicked.connect(self.translate_all)
        self.translate_selected_btn.clicked.connect(self.translate_selected)
        self.stop_btn.clicked.connect(self.stop_translation)
        self.search_input.textChanged.connect(self.filter_table)
        self.filter_combo.currentTextChanged.connect(self.filter_table)
        self.table.cellChanged.connect(self.on_cell_changed)
        
        self.apply_styles()
        
    def setup_menu_bar(self):
        """إعداد شريط القوائم"""
        menubar = self.menuBar()
        
        # قائمة الملف
        file_menu = menubar.addMenu("ملف")
        file_menu.addAction("فتح ملف", self.open_file)
        file_menu.addAction("حفظ", self.save_file)
        file_menu.addSeparator()
        file_menu.addAction("حفظ مشروع", self.save_project)
        file_menu.addAction("تحميل مشروع", self.load_project)
        file_menu.addSeparator()
        file_menu.addAction("تصدير CSV", self.export_csv)
        file_menu.addSeparator()
        file_menu.addAction("خروج", self.close)
        
        # قائمة الترجمة
        translate_menu = menubar.addMenu("ترجمة")
        translate_menu.addAction("ترجمة الكل", self.translate_all)
        translate_menu.addAction("ترجمة المحدد", self.translate_selected)
        
        # قائمة الأدوات
        tools_menu = menubar.addMenu("أدوات")
        tools_menu.addAction("الإعدادات", self.show_settings)
        tools_menu.addAction("مسح الذاكرة المؤقتة", self.clear_cache)
        
        # قائمة المساعدة
        help_menu = menubar.addMenu("مساعدة")
        help_menu.addAction("حول البرنامج", self.show_about)
        
    def setup_translators(self):
        """إعداد المترجمات المتاحة"""
        for model_key, model_info in SUPPORTED_MODELS.items():
            self.model_combo.addItem(f"{model_info['name']} ({model_info['cost']})", model_key)
            
        self.refresh_translators()
        
    def refresh_translators(self):
        """تحديث المترجمات المتاحة"""
        self.translator_manager = TranslatorManager()
        
        # OpenAI
        openai_key = config.get_api_key('openai')
        if openai_key and validate_api_key(openai_key, 'openai'):
            try:
                for model in ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo']:
                    translator = create_translator('openai', openai_key, model)
                    self.translator_manager.add_translator(model, translator)
            except Exception as e:
                print(f"خطأ في إعداد OpenAI: {e}")
                
        # Google Gemini
        google_key = config.get_api_key('google')
        if google_key and validate_api_key(google_key, 'google'):
            try:
                for model in ['gemini-2.5-flash', 'gemini-2.5-pro']:
                    translator = create_translator('google', google_key, model)
                    self.translator_manager.add_translator(model, translator)
            except Exception as e:
                print(f"خطأ في إعداد Gemini: {e}")
                
    def setup_auto_save(self):
        """إعداد الحفظ التلقائي"""
        self.auto_save_timer.timeout.connect(self.auto_save)
        if config.get_setting('auto_save', True):
            interval = config.get_setting('auto_save_interval', 5) * 60000  # تحويل لميللي ثانية
            self.auto_save_timer.start(interval)
            
    def setup_connection_monitor(self):
        """إعداد مراقب الاتصال"""
        self.connection_check_timer.timeout.connect(self.check_connection)
        self.connection_check_timer.start(10000)  # فحص كل 10 ثوان
        
    def check_connection(self):
        """فحص حالة الاتصال"""
        if check_internet_connection():
            self.connection_label.setText("🟢 متصل")
            self.connection_label.setStyleSheet("color: green;")
            self.last_connection_time = time.time()
        else:
            self.connection_label.setText("🔴 منقطع")
            self.connection_label.setStyleSheet("color: red;")
            
            # حفظ تلقائي عند انقطاع الاتصال لفترة طويلة
            disconnect_time = time.time() - self.last_connection_time
            timeout = config.get_setting('connection_timeout', 180)
            
            if disconnect_time > timeout:
                self.emergency_save()
                
    def emergency_save(self):
        """حفظ طارئ عند انقطاع الاتصال"""
        try:
            if self.file_handler.file_path and self.file_handler.modified:
                self.file_handler.save_file(create_backup=True)
                self.status_bar.showMessage("تم الحفظ الطارئ بسبب انقطاع الاتصال", 5000)
        except Exception as e:
            print(f"خطأ في الحفظ الطارئ: {e}")
            
    def apply_styles(self):
        """تطبيق التنسيقات المحدثة"""
        self.setStyleSheet("""
            QMainWindow {
                background-color: #f5f5f5;
            }
            QPushButton {
                background-color: #007bff;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
                min-height: 24px;
            }
            QPushButton:hover {
                background-color: #0056b3;
            }
            QPushButton:pressed {
                background-color: #003d82;
            }
            QPushButton:disabled {
                background-color: #6c757d;
            }
            QTableWidget {
                background-color: white;
                border: 1px solid #dee2e6;
                border-radius: 4px;
                gridline-color: #e9ecef;
            }
            QTableWidget::item {
                padding: 8px;
                border-bottom: 1px solid #e9ecef;
            }
            QTableWidget::item:selected {
                background-color: #cfe2ff;
            }
            QHeaderView::section {
                background-color: #f8f9fa;
                padding: 10px;
                border: none;
                border-bottom: 2px solid #dee2e6;
                font-weight: bold;
            }
        """)
        
    def open_file(self):
        """فتح ملف PHP"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "فتح ملف PHP", "", "ملفات PHP (*.php);;جميع الملفات (*)"
        )
        
        if file_path:
            try:
                self.file_handler.load_file(file_path)
                self.populate_table()
                self.file_label.setText(f"الملف: {Path(file_path).name}")
                self.update_stats()
                
                total_items = len(self.file_handler.translations)
                needs_translation = len([item for item in self.file_handler.translations if item['needs_translation']])
                
                self.status_bar.showMessage(
                    f"تم فتح الملف: {Path(file_path).name} - "
                    f"{total_items} عنصر، {needs_translation} يحتاج ترجمة"
                )
                
            except Exception as e:
                QMessageBox.critical(self, "خطأ", f"فشل في فتح الملف:\n{str(e)}")
                
    def populate_table(self):
        """ملء الجدول بالبيانات مع تحسين الأداء للملفات الكبيرة"""
        translations = self.file_handler.translations
        total_items = len(translations)
        
        print(f"📊 جارٍ تحميل {total_items} عنصر...")
        
        # إعداد الجدول
        self.table.setRowCount(total_items)
        
        # تحسينات الأداء للملفات الكبيرة
        if total_items > 500:
            # إيقاف التحديثات المؤقت
            self.table.setUpdatesEnabled(False)
            self.table.blockSignals(True)
            
            # إظهار progress dialog
            from PyQt5.QtWidgets import QProgressDialog
            progress = QProgressDialog("جارٍ تحميل البيانات...", "إلغاء", 0, total_items, self)
            progress.setWindowModality(Qt.WindowModal)
            progress.setMinimumDuration(0)
            progress.show()
        
        try:
            # تحسين ارتفاع الصفوف
            self.table.verticalHeader().setDefaultSectionSize(50)  # ارتفاع أكبر
            
            # معالجة البيانات في دفعات لتجنب التجمد
            batch_size = 100
            for batch_start in range(0, total_items, batch_size):
                batch_end = min(batch_start + batch_size, total_items)
                
                # معالجة الدفعة
                for i in range(batch_start, batch_end):
                    item = translations[i]
                    
                    # النص الأصلي (العمود 0)
                    original_text = item['original_value']
                    # تقصير النص المعروض للأداء
                    display_text = original_text if len(original_text) <= 200 else original_text[:200] + "..."
                    
                    original_item = QTableWidgetItem(display_text)
                    original_item.setFlags(original_item.flags() & ~Qt.ItemIsEditable)
                    original_item.setToolTip(original_text)  # النص كامل في tooltip
                    self.table.setItem(i, 0, original_item)
                    
                    # الترجمة (العمود 1)
                    translation_text = item['translated_value']
                    display_trans = translation_text if len(translation_text) <= 200 else translation_text[:200] + "..."
                    
                    translation_item = QTableWidgetItem(display_trans)
                    translation_item.setToolTip(translation_text)
                    self.table.setItem(i, 1, translation_item)
                    
                    # الحالة (العمود 2)
                    status = determine_translation_status(item['original_value'], item['translated_value'])
                    status_item = QTableWidgetItem(status)
                    status_item.setFlags(status_item.flags() & ~Qt.ItemIsEditable)
                    self.table.setItem(i, 2, status_item)
                    
                    # تلوين الصف
                    self.apply_row_color(i, status, item.get('translation_type', 'none'))
                    
                    # أزرار الإجراءات - فقط للعناصر التي تحتاج ترجمة
                    if item['needs_translation'] or not has_arabic_content(item['translated_value']):
                        self.create_action_buttons(i)
                    else:
                        # عنصر فارغ للعناصر التي لا تحتاج ترجمة
                        empty_item = QTableWidgetItem("-")
                        empty_item.setFlags(empty_item.flags() & ~Qt.ItemIsEditable)
                        self.table.setItem(i, 3, empty_item)
                
                # تحديث progress dialog
                if total_items > 500:
                    progress.setValue(batch_end)
                    QApplication.processEvents()
                    
                    if progress.wasCanceled():
                        break
                
                # فترة راحة قصيرة لتجنب تجمد الواجهة
                if batch_end < total_items:
                    QApplication.processEvents()
                    
        finally:
            # إعادة تفعيل التحديثات
            if total_items > 500:
                self.table.setUpdatesEnabled(True)
                self.table.blockSignals(False)
                progress.close()
            
            # ضبط ارتفاع الصفوف تلقائياً
            self.table.resizeRowsToContents()
            
            # التأكد من أن ارتفاع الصف لا يقل عن 50 بكسل
            for row in range(min(100, total_items)):  # فقط أول 100 صف للأداء
                if self.table.rowHeight(row) < 50:
                    self.table.setRowHeight(row, 50)
        
        self.update_stats()
        print(f"✅ تم تحميل {total_items} عنصر بنجاح")
        
    def create_action_buttons(self, row):
        """إنشاء أزرار الإجراءات مع ارتفاع مناسب"""
        actions_widget = QWidget()
        actions_layout = QHBoxLayout()
        actions_layout.setContentsMargins(4, 4, 4, 4)
        actions_layout.setSpacing(2)
        
        # زر الترجمة مع قائمة منسدلة
        translate_btn = QPushButton("ترجمة")
        translate_btn.setFixedSize(90, 40)  # ارتفاع أكبر
        translate_btn.setStyleSheet("""
            QPushButton {
                background-color: #28a745;
                color: white;
                border: none;
                border-radius: 4px;
                font-size: 10px;
                font-weight: bold;
                padding: 2px;
            }
            QPushButton:hover {
                background-color: #218838;
            }
            QPushButton::menu-indicator {
                width: 12px;
                height: 8px;
            }
        """)
        
        # إنشاء قائمة منسدلة للترجمة
        translate_menu = QMenu()
        translate_menu.setStyleSheet("""
            QMenu {
                background-color: white;
                border: 1px solid #ccc;
                border-radius: 4px;
                padding: 2px;
            }
            QMenu::item {
                padding: 5px 10px;
                border-radius: 2px;
            }
            QMenu::item:selected {
                background-color: #e3f2fd;
            }
        """)
        
        # ترجمة واحدة
        single_action = QAction("🔄 ترجمة عادية", self)
        single_action.triggered.connect(lambda: self.translate_single_row(row))
        translate_menu.addAction(single_action)
        
        # ترجمات متعددة
        multiple_action = QAction("🎯 ترجمات متعددة", self)
        multiple_action.triggered.connect(lambda: self.get_multiple_translations(row))
        translate_menu.addAction(multiple_action)
        
        # ترجمة اقتصادية
        economy_action = QAction("💰 ترجمة اقتصادية", self)
        economy_action.triggered.connect(lambda: self.translate_economy_mode(row))
        translate_menu.addAction(economy_action)
        
        translate_btn.setMenu(translate_menu)
        
        actions_layout.addWidget(translate_btn)
        actions_widget.setLayout(actions_layout)
        
        # تعيين ارتفاع مناسب للويدجت
        actions_widget.setFixedHeight(48)
        
        self.table.setCellWidget(row, 3, actions_widget)
        
        # التأكد من ارتفاع الصف
        if self.table.rowHeight(row) < 50:
            self.table.setRowHeight(row, 50)
        
    def apply_row_color(self, row, status, translation_type):
        """تطبيق لون الصف حسب الحالة"""
        colors = {
            "مترجم": {
                "auto": QColor(200, 255, 200),  # أخضر فاتح للترجمة التلقائية
                "manual": QColor(255, 255, 200),  # أصفر فاتح للترجمة اليدوية
                "none": QColor(255, 255, 255)   # أبيض
            },
            "غير مترجم": QColor(255, 200, 200),  # أحمر فاتح
            "لا يحتاج ترجمة": QColor(220, 220, 220)  # رمادي فاتح
        }
        
        if status == "مترجم":
            color = colors["مترجم"][translation_type]
        else:
            color = colors.get(status, QColor(255, 255, 255))
        
        for col in range(self.table.columnCount()):
            item = self.table.item(row, col)
            if item:
                item.setBackground(color)
                
    def translate_single_row(self, row):
        """ترجمة صف واحد"""
        if not self.get_current_translator():
            QMessageBox.warning(self, "تحذير", "يرجى اختيار نموذج الترجمة أولاً!")
            return
            
        original_text = self.table.item(row, 0).text()
        
        try:
            translated = self.translator_manager.translate(original_text)
            self.table.item(row, 1).setText(translated)
            
            # تحديث الحالة
            status = determine_translation_status(original_text, translated)
            self.table.item(row, 2).setText(status)
            
            # تطبيق اللون
            self.apply_row_color(row, status, "auto")
            
            # تحديث البيانات
            self.file_handler.update_translation(row, translated)
            self.update_stats()
            
        except Exception as e:
            QMessageBox.critical(self, "خطأ", f"فشل في الترجمة:\n{str(e)}")
            
    def get_multiple_translations(self, row):
        """الحصول على ترجمات متعددة"""
        if not self.get_current_translator():
            QMessageBox.warning(self, "تحذير", "يرجى اختيار نموذج الترجمة أولاً!")
            return
            
        original_text = self.table.item(row, 0).text()
        
        try:
            translations = self.translator_manager.get_multiple_translations(original_text)
            
            if len(translations) > 1:
                dialog = MultiTranslationDialog(original_text, translations, self)
                if dialog.exec_() == QDialog.Accepted:
                    selected = dialog.selected_translation
                    self.table.item(row, 1).setText(selected)
                    
                    # تحديث الحالة واللون
                    status = determine_translation_status(original_text, selected)
                    self.table.item(row, 2).setText(status)
                    self.apply_row_color(row, status, "manual")
                    
                    # تحديث البيانات
                    self.file_handler.update_translation(row, selected)
                    self.update_stats()
            else:
                QMessageBox.information(self, "معلومات", "لم يتم العثور على ترجمات متعددة")
                
        except Exception as e:
    def translate_economy_mode(self, row):
        """ترجمة اقتصادية باستخدام أرخص نموذج متاح"""
        # ترتيب النماذج حسب التكلفة (من الأرخص للأغلى)
        economy_models = ['gpt-3.5-turbo', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gpt-4-turbo', 'gpt-4o']
        
        # البحث عن أرخص نموذج متاح
        selected_model = None
        for model in economy_models:
            if model in self.translator_manager.get_available_translators():
                selected_model = model
                break
        
        if not selected_model:
            QMessageBox.warning(self, "تحذير", "لا يوجد نماذج متاحة!")
            return
            
        original_text = self.table.item(row, 0).text()
        
        # إظهار رسالة التوفير
        cost_info = self.get_model_cost_info(selected_model, original_text)
        
        try:
            # إظهار progress للترجمة الاقتصادية
            progress = QProgressDialog(f"جارٍ الترجمة الاقتصادية...\nالنموذج: {selected_model}\n{cost_info}", None, 0, 0, self)
            progress.setWindowModality(Qt.WindowModal)
            progress.show()
            QApplication.processEvents()
            
            translated = self.translator_manager.translate(original_text, selected_model)
            
            progress.close()
            
            self.table.item(row, 1).setText(translated)
            
            # تحديث الحالة
            status = determine_translation_status(original_text, translated)
            self.table.item(row, 2).setText(status)
            
            # تطبيق اللون للترجمة الاقتصادية
            self.apply_row_color(row, status, "auto")
            
            # تحديث البيانات
            self.file_handler.update_translation(row, translated, "economy")
            self.update_stats()
            
            # إظهار معلومات التوفير
            QMessageBox.information(self, "ترجمة اقتصادية ✅", 
                                  f"تم استخدام {selected_model}\n{cost_info}\nتم توفير التكلفة!")
            
        except Exception as e:
            QMessageBox.critical(self, "خطأ", f"فشل في الترجمة:\n{str(e)}")
            
    def get_model_cost_info(self, model, text):
        """الحصول على معلومات تكلفة النموذج"""
        word_count = count_words(text)
        estimated_cost = estimate_cost(word_count, model)
        
        cost_levels = {
            'gpt-3.5-turbo': '💚 توفير ممتاز',
            'gemini-2.5-flash': '💚 توفير ممتاز', 
            'gemini-2.5-pro': '💛 توفير جيد',
            'gpt-4-turbo': '🟠 تكلفة متوسطة',
            'gpt-4o': '🔴 تكلفة عالية'
        }
        
        level = cost_levels.get(model, '❓ غير معروف')
        return f"{level}\nالتكلفة المقدرة: ${estimated_cost:.4f}"
            
    def translate_all(self):
        """ترجمة جميع النصوص مع تحسين التكلفة والأداء"""
        if not self.get_current_translator():
            QMessageBox.warning(self, "تحذير", "يرجى اختيار نموذج الترجمة أولاً!")
            return
            
        # تحليل النصوص وتحسين التكلفة
        untranslated = []
        total_words = 0
        
        for i, translation_item in enumerate(self.file_handler.translations):
            if translation_item['needs_translation'] and not has_arabic_content(translation_item['translated_value']):
                text = translation_item['original_value']
                words = count_words(text)
                total_words += words
                untranslated.append((i, text, words))
        
        if not untranslated:
            QMessageBox.information(self, "معلومات", "جميع النصوص مترجمة بالفعل!")
            return
        
        # تحليل التكلفة واقتراح أفضل استراتيجية
        current_model = self.get_current_translator()
        estimated_cost = estimate_cost(total_words, current_model)
        
        # اقتراح الاستراتيجية الاقتصادية
        economy_strategy = self.suggest_economy_strategy(untranslated, current_model)
        
        # عرض نافذة تحليل التكلفة
        cost_dialog = CostAnalysisDialog(untranslated, current_model, economy_strategy, self)
        if cost_dialog.exec_() != QDialog.Accepted:
            return
            
        # الحصول على الاستراتيجية المختارة
        selected_strategy = cost_dialog.get_selected_strategy()
        
        # بدء الترجمة الذكية
        self.start_smart_translation(untranslated, selected_strategy)
        
    def suggest_economy_strategy(self, untranslated_items, current_model):
        """اقتراح استراتيجية اقتصادية للترجمة"""
        # تحليل النصوص
        short_texts = [(i, text, words) for i, text, words in untranslated_items if words <= 5]
        medium_texts = [(i, text, words) for i, text, words in untranslated_items if 5 < words <= 15]
        long_texts = [(i, text, words) for i, text, words in untranslated_items if words > 15]
        
        # حساب التكاليف للاستراتيجيات المختلفة
        strategies = {
            'current_model': {
                'name': f'الحالي ({current_model})',
                'description': f'استخدام {current_model} لجميع النصوص',
                'cost': estimate_cost(sum(words for _, _, words in untranslated_items), current_model),
                'items': untranslated_items
            },
            'mixed_economy': {
                'name': 'مختلط اقتصادي',
                'description': 'نصوص قصيرة: GPT-3.5، متوسطة: Gemini Flash، طويلة: النموذج الحالي',
                'cost': (estimate_cost(sum(words for _, _, words in short_texts), 'gpt-3.5-turbo') +
                        estimate_cost(sum(words for _, _, words in medium_texts), 'gemini-2.5-flash') +
                        estimate_cost(sum(words for _, _, words in long_texts), current_model)),
                'items': {
                    'short': short_texts,
                    'medium': medium_texts, 
                    'long': long_texts
                }
            },
            'full_economy': {
                'name': 'اقتصادي كامل',
                'description': 'استخدام GPT-3.5 Turbo لجميع النصوص',
                'cost': estimate_cost(sum(words for _, _, words in untranslated_items), 'gpt-3.5-turbo'),
                'items': untranslated_items
            }
        }
        
        return strategies
        
    def start_smart_translation(self, items, strategy):
        """بدء الترجمة الذكية حسب الاستراتيجية"""
        current_translator = self.get_current_translator()
        if not current_translator:
            return
            
        # إعداد واجهة المستخدم
        self.translate_all_btn.setEnabled(False)
        self.translate_selected_btn.setEnabled(False)
        self.stop_btn.setEnabled(True)
        
        # إعداد العناصر للترجمة حسب الاستراتيجية
        if strategy['name'].startswith('مختلط'):
            # ترجمة مختلطة - نماذج مختلفة حسب طول النص
            translation_queue = []
            
            # النصوص القصيرة بـ GPT-3.5
            for i, text, words in strategy['items']['short']:
                translation_queue.append((i, text, 'gpt-3.5-turbo'))
                
            # النصوص المتوسطة بـ Gemini Flash
            for i, text, words in strategy['items']['medium']:
                translation_queue.append((i, text, 'gemini-2.5-flash'))
                
            # النصوص الطويلة بالنموذج الحالي
            for i, text, words in strategy['items']['long']:
                translation_queue.append((i, text, current_translator))
                
        elif strategy['name'].startswith('اقتصادي كامل'):
            # استخدام GPT-3.5 للجميع
            translation_queue = [(i, text, 'gpt-3.5-turbo') for i, text, words in items]
        else:
            # استخدام النموذج الحالي
            translation_queue = [(i, text, current_translator) for i, text, words in items]
        
        # بدء الترجمة
        self.progress_bar.setMaximum(len(translation_queue))
        self.progress_bar.setValue(0)
        
        self.translation_thread = SmartTranslationThread(
            self.translator_manager, translation_queue
        )
        
        self.translation_thread.progress_updated.connect(self.update_translation_progress)
        self.translation_thread.translation_completed.connect(self.on_translation_completed)
        self.translation_thread.error_occurred.connect(self.on_translation_error)
        self.translation_thread.finished_all.connect(self.on_translation_finished)
        self.translation_thread.cost_saved.connect(self.show_cost_savings)
        
        self.translation_thread.start()
        self.status_bar.showMessage(f"جارٍ تطبيق الاستراتيجية: {strategy['name']}")
        
    def translate_selected(self):
        """ترجمة الصفوف المحددة"""
        if not self.get_current_translator():
            QMessageBox.warning(self, "تحذير", "يرجى اختيار نموذج الترجمة أولاً!")
            return
            
        selected_rows = []
        for item in self.table.selectedItems():
            if item.column() == 0:
                selected_rows.append(item.row())
                
        if not selected_rows:
            QMessageBox.warning(self, "تحذير", "يرجى تحديد صفوف للترجمة!")
            return
            
        items_to_translate = []
        for row in selected_rows:
            original_text = self.table.item(row, 0).text()
            items_to_translate.append((row, original_text))
            
        self.start_batch_translation(items_to_translate)
        
    def start_batch_translation(self, items):
        """بدء الترجمة الدفعية"""
        current_translator = self.get_current_translator()
        if not current_translator:
            return
            
        # إعداد واجهة المستخدم
        self.translate_all_btn.setEnabled(False)
        self.translate_selected_btn.setEnabled(False)
        self.stop_btn.setEnabled(True)
        
        self.progress_bar.setMaximum(len(items))
        self.progress_bar.setValue(0)
        
        # بدء خيط الترجمة
        self.translation_thread = TranslationThread(
            self.translator_manager, items, current_translator
        )
        
        self.translation_thread.progress_updated.connect(self.update_translation_progress)
        self.translation_thread.translation_completed.connect(self.on_translation_completed)
        self.translation_thread.error_occurred.connect(self.on_translation_error)
        self.translation_thread.finished_all.connect(self.on_translation_finished)
        
        self.translation_thread.start()
        
    def update_translation_progress(self, current, total):
        """تحديث تقدم الترجمة"""
        self.progress_bar.setValue(current)
        percentage = int((current / total) * 100) if total > 0 else 0
        self.progress_bar.setFormat(f"{current}/{total} - {percentage}%")
        
    def on_translation_completed(self, row_index, translated_text, translation_type):
        """عند اكتمال ترجمة نص واحد"""
        translation_item = self.table.item(row_index, 1)
        status_item = self.table.item(row_index, 2)
        
        if translation_item:
            translation_item.setText(translated_text)
            
        if status_item:
            original_text = self.table.item(row_index, 0).text()
            status = determine_translation_status(original_text, translated_text)
            status_item.setText(status)
            
            # تطبيق اللون
            self.apply_row_color(row_index, status, translation_type)
        
        # تحديث البيانات
        self.file_handler.update_translation(row_index, translated_text)
        
    def on_translation_error(self, error_message):
        """معالجة أخطاء الترجمة"""
        print(f"خطأ في الترجمة: {error_message}")
        
    def on_translation_finished(self):
        """عند انتهاء الترجمة"""
        self.translate_all_btn.setEnabled(True)
        self.translate_selected_btn.setEnabled(True)
        self.stop_btn.setEnabled(False)
        
        self.progress_bar.setFormat("اكتمل!")
        self.update_stats()
        self.status_bar.showMessage("انتهت الترجمة")
        
    def show_cost_savings(self, saved_amount, message):
        """عرض معلومات التوفير في التكلفة"""
        if saved_amount > 0.001:  # إذا كان التوفير أكثر من $0.001
            savings_msg = f"💰 {message}\n\nالمبلغ الموفر: ${saved_amount:.4f}\n\nتم استخدام الاستراتيجية الذكية لتقليل التكاليف!"
            
            # إظهار إشعار في شريط الحالة
            self.status_bar.showMessage(f"💰 تم توفير ${saved_amount:.4f}", 10000)
            
            # إظهار نافذة منبثقة للتوفير الكبير
            if saved_amount > 0.01:  # أكثر من سنت واحد
                QMessageBox.information(self, "توفير في التكلفة! 🎉", savings_msg)
        
    def stop_translation(self):
        """إيقاف الترجمة"""
        if self.translation_thread and self.translation_thread.isRunning():
            self.translation_thread.cancel()
            self.translation_thread.wait(5000)
            
        self.translate_all_btn.setEnabled(True)
        self.translate_selected_btn.setEnabled(True)
        self.stop_btn.setEnabled(False)
        
        self.progress_bar.setFormat("تم الإيقاف")
        self.update_stats()
        self.status_bar.showMessage("تم إيقاف الترجمة")
        
    def get_current_translator(self):
        """الحصول على المترجم الحالي"""
        current_model = self.model_combo.currentData()
        if current_model and current_model in self.translator_manager.get_available_translators():
            self.translator_manager.set_current_translator(current_model)
            return current_model
        return None
        
    def update_stats(self):
        """تحديث الإحصائيات"""
        if hasattr(self.file_handler, 'translations'):
            stats = self.file_handler.get_statistics()
            
            total = stats['total_items']
            needs_translation = stats['needs_translation'] 
            translated = stats['translated']
            remaining = stats['remaining']
            progress = stats['progress_percentage']
            
            stats_text = (
                f"المجموع: {total} | "
                f"يحتاج ترجمة: {needs_translation} | "
                f"مترجم: {translated} | "
                f"متبقي: {remaining} | "
                f"التقدم: {progress}%"
            )
            
            self.stats_label.setText(stats_text)
            
            if not (self.translation_thread and self.translation_thread.isRunning()):
                if needs_translation > 0:
                    self.progress_bar.setMaximum(needs_translation)
                    self.progress_bar.setValue(translated)
                    self.progress_bar.setFormat(f"{translated}/{needs_translation} - {progress}%")
                else:
                    self.progress_bar.setMaximum(1)
                    self.progress_bar.setValue(1)
                    self.progress_bar.setFormat("مكتمل 100%")
                    
            self.filter_table()
            
    def filter_table(self):
        """تصفية الجدول"""
        search_text = self.search_input.text().lower()
        filter_type = self.filter_combo.currentText()
        
        visible_count = 0
        
        for row in range(self.table.rowCount()):
            show_row = True
            
            # فلتر النص
            if search_text:
                text_found = False
                for col in range(2):  # البحث في النص الأصلي والترجمة
                    item = self.table.item(row, col)
                    if item and search_text in item.text().lower():
                        text_found = True
                        break
                if not text_found:
                    show_row = False
            
            # فلتر الحالة
            if show_row and filter_type != "عرض الكل":
                status_item = self.table.item(row, 2)
                if status_item:
                    status = status_item.text()
                    if filter_type == "يحتاج ترجمة فقط" and status not in ["غير مترجم"]:
                        show_row = False
                    elif filter_type == "مترجم فقط" and status != "مترجم":
                        show_row = False
                    elif filter_type == "لا يحتاج ترجمة" and status != "لا يحتاج ترجمة":
                        show_row = False
            
            self.table.setRowHidden(row, not show_row)
            if show_row:
                visible_count += 1
                
        self.results_label.setText(f"{visible_count} عنصر")
        
    def on_cell_changed(self, row, column):
        """عند تغيير خلية في الجدول"""
        if column == 1:  # عمود الترجمة
            translation_item = self.table.item(row, column)
            status_item = self.table.item(row, 2)
            
            if translation_item and status_item:
                new_translation = translation_item.text()
                original_text = self.table.item(row, 0).text()
                
                # تحديث الحالة
                status = determine_translation_status(original_text, new_translation)
                status_item.setText(status)
                
                # تطبيق اللون للتحرير اليدوي
                self.apply_row_color(row, status, "manual")
                
                # تحديث البيانات
                self.file_handler.update_translation(row, new_translation)
                self.update_stats()
                
    def save_file(self):
        """حفظ الملف الحالي"""
        if not self.file_handler.file_path:
            self.save_file_as()
            return
            
        try:
            backup = config.get_setting('backup_files', True)
            self.file_handler.save_file(create_backup=backup)
            self.status_bar.showMessage("تم الحفظ بنجاح")
            
        except Exception as e:
            QMessageBox.critical(self, "خطأ", f"فشل في حفظ الملف:\n{str(e)}")
            
    def save_file_as(self):
        """حفظ الملف باسم جديد"""
        if not hasattr(self.file_handler, 'translations'):
            QMessageBox.warning(self, "تحذير", "لا يوجد ملف للحفظ!")
            return
            
        file_path, _ = QFileDialog.getSaveFileName(
            self, "حفظ الملف", "", "ملفات PHP (*.php);;جميع الملفات (*)"
        )
        
        if file_path:
            try:
                self.file_handler.save_file(file_path, create_backup=False)
                self.file_label.setText(f"الملف: {Path(file_path).name}")
                self.status_bar.showMessage("تم الحفظ بنجاح")
                
            except Exception as e:
                QMessageBox.critical(self, "خطأ", f"فشل في حفظ الملف:\n{str(e)}")
                
    def save_project(self):
        """حفظ المشروع"""
        if not hasattr(self.file_handler, 'translations'):
            QMessageBox.warning(self, "تحذير", "لا يوجد بيانات لحفظها!")
            return
            
        project_name, ok = QInputDialog.getText(
            self, "حفظ المشروع", "اسم المشروع:",
            text=self.project_name or f"مشروع_{int(time.time())}"
        )
        
        if ok and project_name:
            try:
                project_file = save_project(self.file_handler, project_name)
                self.project_name = project_name
                QMessageBox.information(self, "نجح", f"تم حفظ المشروع: {project_name}")
                
            except Exception as e:
                QMessageBox.critical(self, "خطأ", f"فشل في حفظ المشروع:\n{str(e)}")
                
    def load_project(self):
        """تحميل مشروع"""
        projects = get_saved_projects()
        
        if not projects:
            QMessageBox.information(self, "معلومات", "لا توجد مشاريع محفوظة!")
            return
            
        # عرض قائمة المشاريع
        project_names = [f"{p['name']} ({time.strftime('%Y-%m-%d %H:%M', time.localtime(p['created_at']))})" 
                        for p in projects]
        
        project_name, ok = QInputDialog.getItem(
            self, "تحميل مشروع", "اختر المشروع:", project_names, 0, False
        )
        
        if ok and project_name:
            try:
                selected_project = projects[project_names.index(project_name)]
                project_data = load_project(selected_project['file'])
                
                # تحميل بيانات المشروع
                self.file_handler.translations = project_data['translations']
                self.file_handler.file_path = Path(project_data['original_file_path']) if project_data['original_file_path'] else None
                self.project_name = project_data['name']
                
                # تحديث الواجهة
                self.populate_table()
                self.file_label.setText(f"المشروع: {self.project_name}")
                self.update_stats()
                
                QMessageBox.information(self, "نجح", f"تم تحميل المشروع: {self.project_name}")
                
            except Exception as e:
                QMessageBox.critical(self, "خطأ", f"فشل في تحميل المشروع:\n{str(e)}")
                
    def auto_save(self):
        """الحفظ التلقائي"""
        if self.file_handler.file_path and self.file_handler.modified:
            try:
                self.file_handler.save_file(create_backup=False)
                self.status_bar.showMessage("تم الحفظ التلقائي", 2000)
            except Exception as e:
                print(f"خطأ في الحفظ التلقائي: {e}")
                
    def export_csv(self):
        """تصدير الترجمات إلى CSV"""
        if not hasattr(self.file_handler, 'translations'):
            QMessageBox.warning(self, "تحذير", "لا يوجد بيانات للتصدير!")
            return
            
        file_path, _ = QFileDialog.getSaveFileName(
            self, "تصدير CSV", "", "ملفات CSV (*.csv);;جميع الملفات (*)"
        )
        
        if file_path:
            try:
                self.file_handler.export_translations_csv(file_path)
                QMessageBox.information(self, "نجح", "تم التصدير بنجاح!")
                
            except Exception as e:
                QMessageBox.critical(self, "خطأ", f"فشل في التصدير:\n{str(e)}")
                
    def show_settings(self):
        """عرض نافذة الإعدادات"""
        dialog = SettingsDialog(self)
        if dialog.exec_() == QDialog.Accepted:
            self.refresh_translators()
            self.setup_auto_save()  # إعادة إعداد الحفظ التلقائي
            
    def clear_cache(self):
        """مسح الذاكرة المؤقتة"""
        reply = QMessageBox.question(
            self, "تأكيد", "هل تريد مسح جميع الترجمات المحفوظة؟",
            QMessageBox.Yes | QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            translation_cache.cache.clear()
            translation_cache.save_cache()
            QMessageBox.information(self, "تم", "تم مسح الذاكرة المؤقتة!")
            
    def show_about(self):
        """عرض معلومات حول البرنامج"""
        about_text = """
🌐 مترجم ملفات PHP المتقدم

إصدار 2.0

برنامج متخصص لترجمة ملفات PHP لأنظمة التوصيل والطعام
يدعم أحدث نماذج الذكاء الاصطناعي:

• OpenAI GPT-4o & GPT-4-Turbo & GPT-3.5
• Google Gemini 2.5 Flash & Pro

الميزات الجديدة:
• ترجمات متعددة للنص الواحد
• حفظ وتحميل المشاريع
• مراقبة الاتصال والحفظ الطارئ
• تلوين الصفوف حسب نوع الترجمة
• واجهة محسنة بدون عمود المفتاح

© 2024 جميع الحقوق محفوظة
        """
        
        QMessageBox.about(self, "حول البرنامج", about_text)
        
    def closeEvent(self, event):
        """عند إغلاق البرنامج"""
        if self.translation_thread and self.translation_thread.isRunning():
            self.translation_thread.cancel()
            self.translation_thread.wait()
            
        translation_cache.save_cache()
        
        if self.file_handler.file_path and self.file_handler.modified:
            reply = QMessageBox.question(
                self, "حفظ التغييرات", "هل تريد حفظ التغييرات؟",
                QMessageBox.Yes | QMessageBox.No | QMessageBox.Cancel
            )
            
            if reply == QMessageBox.Yes:
                self.save_file()
            elif reply == QMessageBox.Cancel:
                event.ignore()
                return
                
        event.accept()

def main():
    """الدالة الرئيسية"""
    app = QApplication(sys.argv)
    
    font = QFont("Arial", 10)
    app.setFont(font)
    app.setLayoutDirection(Qt.RightToLeft)
    
    window = MainWindow()
    window.show()
    
    sys.exit(app.exec_())

if __name__ == "__main__":
    main()