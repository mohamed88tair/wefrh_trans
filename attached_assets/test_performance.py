#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
اختبار الأداء والوظائف الجديدة
"""

import sys
import time
import random
import string
from pathlib import Path

# إضافة مسار المشروع
sys.path.append(str(Path(__file__).parent))

from file_handler import PHPFileHandler
from performance_manager import PerformanceManager, BatchProcessor, ResourceMonitor
from utils import (
    monitor_memory_usage, optimize_memory, 
    smart_text_grouping, calculate_optimal_batch_size,
    performance_timer
)

class PerformanceTest:
    """اختبار شامل للأداء"""
    
    def __init__(self):
        self.performance_manager = PerformanceManager()
        self.resource_monitor = ResourceMonitor()
        self.results = {}
        
    def generate_test_php_file(self, num_items=7000, output_path="test_large.php"):
        """إنشاء ملف PHP للاختبار"""
        print(f"🔧 إنشاء ملف اختبار مع {num_items:,} عنصر...")
        
        content = "<?php\n\nreturn [\n"
        
        for i in range(num_items):
            # نصوص متنوعة للاختبار
            if i % 3 == 0:
                # نصوص قصيرة
                text = self.generate_random_text(2, 5)
            elif i % 3 == 1:
                # نصوص متوسطة
                text = self.generate_random_text(6, 15)
            else:
                # نصوص طويلة
                text = self.generate_random_text(16, 30)
            
            key = f"key_{i:06d}"
            content += f"    '{key}' => '{text}',\n"
            
            # إضافة نصوص عربية أحياناً
            if i % 10 == 0:
                arabic_text = f"نص عربي {i}"
                content += f"    'arabic_{i}' => '{arabic_text}',\n"
        
        content += "];\n"
        
        # كتابة الملف
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
            
        print(f"✅ تم إنشاء {output_path} ({len(content):,} حرف)")
        return output_path
    
    def generate_random_text(self, min_words, max_words):
        """إنشاء نص عشوائي"""
        words = []
        word_count = random.randint(min_words, max_words)
        
        for _ in range(word_count):
            word_length = random.randint(3, 8)
            word = ''.join(random.choices(string.ascii_lowercase, k=word_length))
            words.append(word)
            
        return ' '.join(words)
    
    @performance_timer("تحميل الملف")
    def test_file_loading(self, file_path, expected_items=7000):
        """اختبار تحميل الملف"""
        print(f"\n📂 اختبار تحميل الملف...")
        
        # مراقبة الذاكرة قبل التحميل
        memory_before = monitor_memory_usage()
        
        # تحميل الملف
        handler = PHPFileHandler()
        start_time = time.time()
        
        success = handler.load_file(file_path)
        
        load_time = time.time() - start_time
        memory_after = monitor_memory_usage()
        
        # النتائج
        actual_items = len(handler.translations)
        memory_used = memory_after['memory_mb'] - memory_before['memory_mb']
        
        result = {
            'success': success,
            'load_time': load_time,
            'expected_items': expected_items,
            'actual_items': actual_items,
            'memory_used_mb': memory_used,
            'items_per_second': actual_items / load_time if load_time > 0 else 0
        }
        
        print(f"   ✅ نجح: {success}")
        print(f"   ⏱️ الوقت: {load_time:.2f} ثانية")
        print(f"   📊 العناصر: {actual_items:,} (متوقع: {expected_items:,})")
        print(f"   💾 الذاكرة: {memory_used:.1f} MB")
        print(f"   ⚡ السرعة: {result['items_per_second']:.0f} عنصر/ثانية")
        
        self.results['file_loading'] = result
        return handler
    
    @performance_timer("معالجة دفعية")
    def test_batch_processing(self, items, batch_size=100):
        """اختبار المعالجة الدفعية"""
        print(f"\n⚙️ اختبار المعالجة الدفعية...")
        
        processor = BatchProcessor(batch_size)
        
        def mock_process_function(batch):
            # محاكاة معالجة
            time.sleep(0.01)  # 10ms لكل دفعة
            return [f"processed_{item['key']}" for item in batch]
        
        # تقدم callback
        processed_items = []
        def progress_callback(current, total, message):
            processed_items.append(current)
            if current % 500 == 0:
                print(f"   📈 {message}")
        
        # تنفيذ المعالجة
        results = processor.process_in_batches(
            items[:1000],  # أول 1000 عنصر للاختبار
            mock_process_function,
            progress_callback
        )
        
        result = {
            'processed_count': len(results),
            'batch_size': batch_size,
            'batches_count': len(processed_items),
            'success': len(results) == 1000
        }
        
        print(f"   ✅ معالج: {len(results):,} عنصر")
        print(f"   📦 الدفعات: {len(processed_items)}")
        
        self.results['batch_processing'] = result
        return results
    
    @performance_timer("تجميع ذكي")
    def test_smart_grouping(self, texts):
        """اختبار التجميع الذكي للنصوص"""
        print(f"\n🧠 اختبار التجميع الذكي...")
        
        # أخذ عينة للاختبار
        sample_texts = texts[:500]
        
        # إضافة نصوص متشابهة للاختبار
        test_texts = sample_texts.copy()
        test_texts.extend([
            "hello world",
            "hello world test", 
            "hello world example",
            "user management",
            "user management system",
            "order processing",
            "order processing module"
        ])
        
        # تنفيذ التجميع
        groups = smart_text_grouping(test_texts, similarity_threshold=0.7)
        
        # تحليل النتائج
        total_groups = len(groups)
        grouped_items = sum(len(group) for group in groups if len(group) > 1)
        single_items = sum(1 for group in groups if len(group) == 1)
        
        result = {
            'total_texts': len(test_texts),
            'total_groups': total_groups,
            'grouped_items': grouped_items,
            'single_items': single_items,
            'grouping_efficiency': grouped_items / len(test_texts)
        }
        
        print(f"   📊 النصوص: {len(test_texts)}")
        print(f"   📦 المجموعات: {total_groups}")
        print(f"   🔗 عناصر مجمعة: {grouped_items}")
        print(f"   📈 كفاءة التجميع: {result['grouping_efficiency']:.1%}")
        
        self.results['smart_grouping'] = result
        return groups
    
    def test_memory_optimization(self):
        """اختبار تحسين الذاكرة"""
        print(f"\n💾 اختبار تحسين الذاكرة...")
        
        # مراقبة الذاكرة قبل التحسين
        memory_before = monitor_memory_usage()
        
        # إنشاء بيانات كبيرة
        large_data = []
        for i in range(10000):
            large_data.append({
                'id': i,
                'data': 'x' * 1000,  # 1KB لكل عنصر
                'timestamp': time.time()
            })
        
        memory_peak = monitor_memory_usage()
        
        # تحسين الذاكرة
        optimize_memory()
        
        # مسح البيانات
        del large_data
        optimize_memory()
        
        memory_after = monitor_memory_usage()
        
        result = {
            'memory_before_mb': memory_before['memory_mb'],
            'memory_peak_mb': memory_peak['memory_mb'],
            'memory_after_mb': memory_after['memory_mb'],
            'memory_saved_mb': memory_peak['memory_mb'] - memory_after['memory_mb'],
            'optimization_effective': memory_after['memory_mb'] < memory_peak['memory_mb']
        }
        
        print(f"   📊 قبل: {memory_before['memory_mb']:.1f} MB")
        print(f"   📈 الذروة: {memory_peak['memory_mb']:.1f} MB")
        print(f"   📉 بعد: {memory_after['memory_mb']:.1f} MB")
        print(f"   💾 موفر: {result['memory_saved_mb']:.1f} MB")
        
        self.results['memory_optimization'] = result
        
    def test_optimal_batch_size(self):
        """اختبار حساب الحجم الأمثل للدفعة"""
        print(f"\n🎯 اختبار حساب الحجم الأمثل...")
        
        # اختبار أحجام مختلفة
        test_cases = [1000, 5000, 10000, 20000]
        
        results = {}
        for total_items in test_cases:
            optimal_size = calculate_optimal_batch_size(total_items)
            results[total_items] = optimal_size
            print(f"   📊 {total_items:,} عنصر → دفعة مثلى: {optimal_size}")
        
        self.results['optimal_batch_size'] = results
        
    def run_full_test(self, num_items=7000):
        """تشغيل الاختبار الكامل"""
        print("🚀 بدء اختبار الأداء الشامل")
        print("=" * 50)
        
        # بدء مراقبة الأداء
        self.performance_manager.start_monitoring(interval=2000)
        
        try:
            # 1. إنشاء ملف الاختبار
            test_file = self.generate_test_php_file(num_items)
            
            # 2. اختبار تحميل الملف
            handler = self.test_file_loading(test_file, num_items)
            
            # 3. اختبار المعالجة الدفعية
            self.test_batch_processing(handler.translations)
            
            # 4. اختبار التجميع الذكي
            texts = [item['original_value'] for item in handler.translations[:500]]
            self.test_smart_grouping(texts)
            
            # 5. اختبار تحسين الذاكرة
            self.test_memory_optimization()
            
            # 6. اختبار حساب الحجم الأمثل
            self.test_optimal_batch_size()
            
            # طباعة الملخص
            self.print_test_summary()
            
        finally:
            # إيقاف المراقبة
            self.performance_manager.stop_monitoring()
            
            # تنظيف
            if 'test_file' in locals():
                try:
                    Path(test_file).unlink()
                    print(f"🗑️ تم حذف ملف الاختبار")
                except:
                    pass
    
    def print_test_summary(self):
        """طباعة ملخص نتائج الاختبار"""
        print("\n" + "=" * 50)
        print("📊 ملخص نتائج اختبار الأداء")
        print("=" * 50)
        
        # تحليل النتائج
        success_count = 0
        total_tests = len(self.results)
        
        for test_name, result in self.results.items():
            print(f"\n🔸 {test_name}:")
            
            if isinstance(result, dict):
                for key, value in result.items():
                    if isinstance(value, float):
                        print(f"   {key}: {value:.2f}")
                    else:
                        print(f"   {key}: {value}")
                        
                # تحديد نجاح الاختبار
                if result.get('success', True):
                    success_count += 1
            else:
                print(f"   النتيجة: {result}")
                success_count += 1
        
        # النتيجة الإجمالية
        success_rate = (success_count / total_tests) * 100
        print(f"\n🎯 معدل النجاح: {success_rate:.1f}% ({success_count}/{total_tests})")
        
        # توصيات الأداء
        self.print_performance_recommendations()
        
        # ملخص الموارد
        self.resource_monitor.print_summary()
    
    def print_performance_recommendations(self):
        """طباعة توصيات الأداء"""
        print(f"\n💡 توصيات الأداء:")
        
        # تحليل تحميل الملف
        if 'file_loading' in self.results:
            load_result = self.results['file_loading']
            items_per_sec = load_result.get('items_per_second', 0)
            
            if items_per_sec > 1000:
                print("   ✅ سرعة التحميل ممتازة")
            elif items_per_sec > 500:
                print("   ⚠️ سرعة التحميل جيدة - يمكن تحسينها")
            else:
                print("   🔴 سرعة التحميل بطيئة - يحتاج تحسين")
        
        # تحليل الذاكرة
        if 'memory_optimization' in self.results:
            mem_result = self.results['memory_optimization']
            if mem_result.get('optimization_effective', False):
                print("   ✅ تحسين الذاكرة يعمل بفعالية")
            else:
                print("   ⚠️ تحسين الذاكرة يحتاج مراجعة")
        
        # تحليل التجميع
        if 'smart_grouping' in self.results:
            group_result = self.results['smart_grouping']
            efficiency = group_result.get('grouping_efficiency', 0)
            
            if efficiency > 0.3:
                print("   ✅ التجميع الذكي فعال")
            elif efficiency > 0.1:
                print("   ⚠️ التجميع الذكي متوسط الفعالية")
            else:
                print("   🔴 التجميع الذكي غير فعال")

def main():
    """الدالة الرئيسية"""
    print("🧪 اختبار أداء مترجم ملفات PHP")
    print("🎯 الهدف: التأكد من الأداء مع 7000+ عنصر")
    print()
    
    # إنشاء مدير الاختبار
    tester = PerformanceTest()
    
    # اختيار حجم الاختبار
    test_sizes = {
        '1': ('اختبار سريع', 1000),
        '2': ('اختبار متوسط', 5000), 
        '3': ('اختبار كامل', 7000),
        '4': ('اختبار ثقيل', 15000)
    }
    
    print("اختر نوع الاختبار:")
    for key, (name, size) in test_sizes.items():
        print(f"   {key}. {name} ({size:,} عنصر)")
    
    choice = input("\nالاختيار (افتراضي: 3): ").strip() or '3'
    
    if choice in test_sizes:
        test_name, test_size = test_sizes[choice]
        print(f"\n🚀 بدء {test_name} مع {test_size:,} عنصر...")
        
        # تشغيل الاختبار
        start_time = time.time()
        tester.run_full_test(test_size)
        total_time = time.time() - start_time
        
        print(f"\n⏱️ إجمالي وقت الاختبار: {total_time:.1f} ثانية")
        print("🎉 انتهى الاختبار بنجاح!")
        
    else:
        print("❌ اختيار غير صالح")

if __name__ == "__main__":
    main()