# performance_manager.py - مدير الأداء والذاكرة للملفات الكبيرة
"""
مدير شامل للأداء والذاكرة عند التعامل مع ملفات PHP الكبيرة
"""

import gc
import time
import psutil
import threading
from queue import Queue
from PyQt5.QtCore import QObject, pyqtSignal, QTimer
from PyQt5.QtWidgets import QMessageBox, QProgressDialog, QApplication

class PerformanceManager(QObject):
    """مدير الأداء والذاكرة"""
    
    memory_warning = pyqtSignal(float)  # إشارة تحذير الذاكرة
    performance_update = pyqtSignal(dict)  # إشارة تحديث الأداء
    
    def __init__(self):
        super().__init__()
        self.process = psutil.Process()
        self.monitoring_active = False
        self.memory_threshold = 800  # MB
        self.cpu_threshold = 80  # %
        
        # مؤقت المراقبة
        self.monitor_timer = QTimer()
        self.monitor_timer.timeout.connect(self.check_performance)
        
    def start_monitoring(self, interval=5000):
        """بدء مراقبة الأداء (interval بالميللي ثانية)"""
        self.monitoring_active = True
        self.monitor_timer.start(interval)
        print(f"🔍 بدء مراقبة الأداء كل {interval/1000} ثانية")
        
    def stop_monitoring(self):
        """إيقاف مراقبة الأداء"""
        self.monitoring_active = False
        self.monitor_timer.stop()
        print("⏹️ تم إيقاف مراقبة الأداء")
        
    def check_performance(self):
        """فحص الأداء الحالي"""
        try:
            # فحص الذاكرة
            memory_info = self.process.memory_info()
            memory_mb = memory_info.rss / 1024 / 1024
            memory_percent = self.process.memory_percent()
            
            # فحص المعالج
            cpu_percent = self.process.cpu_percent()
            
            # معلومات الأداء
            performance_data = {
                'memory_mb': memory_mb,
                'memory_percent': memory_percent,
                'cpu_percent': cpu_percent,
                'timestamp': time.time()
            }
            
            # إرسال إشارة التحديث
            self.performance_update.emit(performance_data)
            
            # تحذيرات الأداء
            if memory_mb > self.memory_threshold:
                self.memory_warning.emit(memory_mb)
                self.optimize_memory()
                
        except Exception as e:
            print(f"خطأ في مراقبة الأداء: {e}")
            
    def optimize_memory(self):
        """تحسين استخدام الذاكرة"""
        print("🧹 جارٍ تحسين الذاكرة...")
        
        # تشغيل garbage collector
        collected = gc.collect()
        print(f"   🗑️ تم تحرير {collected} كائن")
        
        # محاولة تحرير الذاكرة على مستوى النظام
        try:
            import ctypes
            if hasattr(ctypes, 'CDLL'):
                try:
                    ctypes.CDLL("libc.so.6").malloc_trim(0)
                    print("   💾 تم تحرير ذاكرة النظام")
                except:
                    pass
        except:
            pass
            
    def get_memory_usage(self):
        """الحصول على معلومات استخدام الذاكرة"""
        memory_info = self.process.memory_info()
        return {
            'rss_mb': memory_info.rss / 1024 / 1024,
            'vms_mb': memory_info.vms / 1024 / 1024,
            'percent': self.process.memory_percent(),
            'available_mb': psutil.virtual_memory().available / 1024 / 1024
        }
        
    def suggest_optimization(self, data_size):
        """اقتراح تحسينات بناءً على حجم البيانات"""
        memory_usage = self.get_memory_usage()
        available_memory = memory_usage['available_mb']
        
        suggestions = []
        
        if data_size > 5000:  # أكثر من 5000 عنصر
            suggestions.append({
                'type': 'large_dataset',
                'message': 'ملف كبير - يُنصح بمعالجة تدريجية',
                'recommendation': 'استخدم المعالجة على دفعات'
            })
            
        if available_memory < 200:  # أقل من 200 MB متاح
            suggestions.append({
                'type': 'low_memory',
                'message': 'ذاكرة منخفضة',
                'recommendation': 'قم بإغلاق التطبيقات الأخرى'
            })
            
        if memory_usage['percent'] > 80:
            suggestions.append({
                'type': 'high_usage',
                'message': 'استخدام عالي للذاكرة',
                'recommendation': 'تم تفعيل التحسين التلقائي'
            })
            
        return suggestions

class LoadingManager(QObject):
    """مدير التحميل للملفات الكبيرة"""
    
    progress_updated = pyqtSignal(int, int, str)  # current, total, message
    loading_completed = pyqtSignal()
    loading_cancelled = pyqtSignal()
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.parent_widget = parent
        self.is_cancelled = False
        self.progress_dialog = None
        
    def start_loading(self, total_items, title="جارٍ التحميل..."):
        """بدء عملية التحميل مع progress dialog"""
        self.is_cancelled = False
        
        # إنشاء progress dialog
        self.progress_dialog = QProgressDialog(title, "إلغاء", 0, total_items, self.parent_widget)
        self.progress_dialog.setWindowTitle("تحميل البيانات")
        self.progress_dialog.setMinimumDuration(500)  # إظهار بعد 500ms
        self.progress_dialog.setModal(True)
        
        # ربط الإلغاء
        self.progress_dialog.canceled.connect(self.cancel_loading)
        
        # ربط الإشارات
        self.progress_updated.connect(self.update_progress)
        
        self.progress_dialog.show()
        
    def update_progress(self, current, total, message=""):
        """تحديث تقدم التحميل"""
        if self.progress_dialog:
            self.progress_dialog.setValue(current)
            self.progress_dialog.setLabelText(f"{message}\n{current:,} / {total:,}")
            
            # تحديث الواجهة
            QApplication.processEvents()
            
    def cancel_loading(self):
        """إلغاء التحميل"""
        self.is_cancelled = True
        self.loading_cancelled.emit()
        
    def finish_loading(self):
        """إنهاء التحميل"""
        if self.progress_dialog:
            self.progress_dialog.close()
            self.progress_dialog = None
        self.loading_completed.emit()
        
    def is_loading_cancelled(self):
        """التحقق من إلغاء التحميل"""
        return self.is_cancelled

class BatchProcessor:
    """معالج دفعي للعمليات الكبيرة"""
    
    def __init__(self, batch_size=100):
        self.batch_size = batch_size
        self.processed_count = 0
        
    def process_in_batches(self, items, process_func, progress_callback=None):
        """معالجة العناصر في دفعات"""
        total_items = len(items)
        results = []
        
        for i in range(0, total_items, self.batch_size):
            batch = items[i:i + self.batch_size]
            
            try:
                # معالجة الدفعة
                batch_results = process_func(batch)
                
                if isinstance(batch_results, list):
                    results.extend(batch_results)
                else:
                    results.append(batch_results)
                    
                self.processed_count += len(batch)
                
                # تحديث التقدم
                if progress_callback:
                    progress_callback(self.processed_count, total_items, f"تمت معالجة {self.processed_count} عنصر")
                
                # فترة راحة لتجنب التجمد
                time.sleep(0.01)
                
                # تحسين الذاكرة كل 10 دفعات
                if (i // self.batch_size) % 10 == 0:
                    gc.collect()
                    
            except Exception as e:
                print(f"خطأ في معالجة الدفعة {i}-{i+len(batch)}: {e}")
                # إضافة البيانات الأصلية في حالة الخطأ
                results.extend(batch)
                
        return results

class ResourceMonitor:
    """مراقب الموارد المتقدم"""
    
    def __init__(self):
        self.start_time = time.time()
        self.peak_memory = 0
        self.total_operations = 0
        
    def log_operation(self, operation_name, duration=None):
        """تسجيل عملية"""
        self.total_operations += 1
        
        # مراقبة الذاكرة
        current_memory = psutil.Process().memory_info().rss / 1024 / 1024
        if current_memory > self.peak_memory:
            self.peak_memory = current_memory
            
        if duration:
            print(f"⚡ {operation_name}: {duration:.2f}s | ذاكرة: {current_memory:.1f}MB")
            
    def get_performance_summary(self):
        """الحصول على ملخص الأداء"""
        total_time = time.time() - self.start_time
        current_memory = psutil.Process().memory_info().rss / 1024 / 1024
        
        return {
            'total_time': total_time,
            'total_operations': self.total_operations,
            'current_memory_mb': current_memory,
            'peak_memory_mb': self.peak_memory,
            'avg_time_per_operation': total_time / max(self.total_operations, 1)
        }
        
    def print_summary(self):
        """طباعة ملخص الأداء"""
        summary = self.get_performance_summary()
        
        print("\n📊 ملخص الأداء:")
        print(f"   ⏱️ الوقت الإجمالي: {summary['total_time']:.1f} ثانية")
        print(f"   🔢 العمليات: {summary['total_operations']}")
        print(f"   💾 الذاكرة الحالية: {summary['current_memory_mb']:.1f} MB")
        print(f"   📈 ذروة الذاكرة: {summary['peak_memory_mb']:.1f} MB")
        print(f"   ⚡ متوسط وقت العملية: {summary['avg_time_per_operation']:.3f}s")

# مثيل عالي لمدير الأداء
performance_manager = PerformanceManager()
resource_monitor = ResourceMonitor()