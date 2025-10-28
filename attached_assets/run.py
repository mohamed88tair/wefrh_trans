#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
مشغل محسن لبرنامج مترجم ملفات PHP
يتحقق من المتطلبات ويشغل البرنامج مع التحسينات
"""

import sys
import os
import subprocess
import time
from pathlib import Path

def check_python_version():
    """التحقق من إصدار Python"""
    if sys.version_info < (3, 7):
        print("❌ خطأ: يتطلب Python 3.7 أو أحدث")
        print(f"   الإصدار الحالي: {sys.version}")
        return False
    
    print(f"✅ Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")
    return True

def check_system_resources():
    """فحص موارد النظام"""
    try:
        import psutil
        
        # فحص الذاكرة
        memory = psutil.virtual_memory()
        memory_gb = memory.total / (1024**3)
        available_gb = memory.available / (1024**3)
        
        print(f"💾 الذاكرة: {memory_gb:.1f} GB (متاح: {available_gb:.1f} GB)")
        
        # تحذير إذا كانت الذاكرة المتاحة قليلة
        if available_gb < 0.5:
            print("⚠️ تحذير: الذاكرة المتاحة قليلة - قد يؤثر على الأداء")
            
        # فحص المعالج
        cpu_count = psutil.cpu_count()
        print(f"🖥️ المعالج: {cpu_count} نواة")
        
        return {
            'memory_gb': memory_gb,
            'available_gb': available_gb,
            'cpu_count': cpu_count,
            'sufficient': available_gb >= 0.5
        }
        
    except ImportError:
        print("ℹ️ psutil غير متثبت - تخطي فحص الموارد")
        return {'sufficient': True}

def check_requirements():
    """التحقق من وجود المتطلبات مع تفاصيل الإصدارات"""
    requirements = {
        'PyQt5': {
            'module': 'PyQt5',
            'min_version': '5.15.0',
            'check_func': lambda: __import__('PyQt5.QtCore').QtCore.QT_VERSION_STR
        },
        'requests': {
            'module': 'requests',
            'min_version': '2.28.0',
            'check_func': lambda: __import__('requests').__version__
        },
        'psutil': {
            'module': 'psutil',
            'min_version': '5.8.0',
            'check_func': lambda: __import__('psutil').__version__,
            'optional': True
        }
    }
    
    missing = []
    optional_missing = []
    
    for name, info in requirements.items():
        try:
            module = __import__(info['module'])
            
            # فحص الإصدار إن أمكن
            try:
                version = info['check_func']()
                print(f"✅ {name} {version}")
            except:
                print(f"✅ {name}")
                
        except ImportError:
            if info.get('optional', False):
                print(f"⚠️ {name} - غير مثبت (اختياري)")
                optional_missing.append(name)
            else:
                print(f"❌ {name} - غير مثبت")
                missing.append(name)
    
    return missing, optional_missing

def install_requirements():
    """تثبيت المتطلبات المفقودة مع تحسينات"""
    requirements_file = Path(__file__).parent / "requirements.txt"
    
    if requirements_file.exists():
        print("\n🔄 جارٍ تثبيت المتطلبات...")
        
        # إضافة المستودعات السريعة
        pip_args = [
            sys.executable, "-m", "pip", "install", 
            "-r", str(requirements_file),
            "--upgrade",
            "--no-cache-dir"
        ]
        
        try:
            result = subprocess.run(pip_args, capture_output=True, text=True)
            
            if result.returncode == 0:
                print("✅ تم تثبيت المتطلبات بنجاح")
                return True
            else:
                print(f"❌ فشل في التثبيت: {result.stderr}")
                return False
                
        except subprocess.CalledProcessError as e:
            print(f"❌ خطأ في تثبيت المتطلبات: {e}")
            return False
    else:
        print("❌ ملف requirements.txt غير موجود")
        return False

def check_api_keys():
    """فحص وجود مفاتيح API"""
    config_dir = Path.home() / ".php_translator"
    config_file = config_dir / "config.json"
    
    if config_file.exists():
        try:
            import json
            with open(config_file, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
                
            api_keys = config_data.get('api_keys', {})
            
            if api_keys:
                print(f"🔑 تم العثور على {len(api_keys)} مفتاح API")
                for provider in api_keys.keys():
                    print(f"   ✅ {provider}")
                return True
            else:
                print("🔑 لم يتم العثور على مفاتيح API")
                print("   💡 يمكنك إضافتها من الإعدادات داخل البرنامج")
                return False
                
        except Exception as e:
            print(f"⚠️ خطأ في قراءة إعدادات API: {e}")
            return False
    else:
        print("🔑 لم يتم إعداد مفاتيح API بعد")
        print("   💡 يمكنك إضافتها من الإعدادات داخل البرنامج")
        return False

def run_performance_test():
    """تشغيل اختبار الأداء"""
    test_file = Path(__file__).parent / "test_performance.py"
    
    if test_file.exists():
        print("\n🧪 هل تريد تشغيل اختبار الأداء أولاً؟")
        response = input("   (y/n, افتراضي: n): ").lower()
        
        if response in ['y', 'yes', 'نعم', 'ن']:
            try:
                print("\n🚀 تشغيل اختبار الأداء...")
                subprocess.run([sys.executable, str(test_file)], check=True)
                return True
            except subprocess.CalledProcessError:
                print("❌ فشل اختبار الأداء")
                return False
            except KeyboardInterrupt:
                print("\n⏹️ تم إلغاء اختبار الأداء")
                return False
    
    return False

def run_main_application():
    """تشغيل البرنامج الرئيسي مع معالجة محسنة للأخطاء"""
    main_file = Path(__file__).parent / "main.py"
    
    if main_file.exists():
        print("\n🚀 جارٍ تشغيل البرنامج...")
        print("   💡 نصيحة: للملفات الكبيرة، استخدم فلتر 'يحتاج ترجمة فقط'")
        print("   💰 نصيحة: راجع نافذة تحليل التكلفة قبل الترجمة الجماعية")
        print()
        
        try:
            # تشغيل مع متغيرات بيئة محسنة
            env = os.environ.copy()
            env['QT_AUTO_SCREEN_SCALE_FACTOR'] = '1'  # تحسين عرض PyQt5
            env['PYTHONIOENCODING'] = 'utf-8'  # ضمان الترميز الصحيح
            
            subprocess.run([sys.executable, str(main_file)], env=env, check=True)
            
        except subprocess.CalledProcessError as e:
            print(f"❌ خطأ في تشغيل البرنامج: {e}")
            print("\n🔧 نصائح لحل المشاكل:")
            print("   1. تأكد من تثبيت جميع المتطلبات")
            print("   2. جرب إعادة تشغيل الجهاز")
            print("   3. تحقق من سجل الأخطاء")
            
        except KeyboardInterrupt:
            print("\n👋 تم إغلاق البرنامج بواسطة المستخدم")
            
        except Exception as e:
            print(f"❌ خطأ غير متوقع: {e}")
            
    else:
        print("❌ ملف main.py غير موجود")

def show_welcome_message():
    """عرض رسالة الترحيب مع معلومات الإصدار"""
    print("🌐 مترجم ملفات PHP المتقدم - الإصدار 2.1")
    print("=" * 50)
    print("🚀 التحسينات الجديدة:")
    print("   ⚡ أداء محسن للملفات الكبيرة (7000+ عنصر)")
    print("   💰 تحليل التكلفة واستراتيجيات التوفير")
    print("   🎨 واجهة محسنة مع ارتفاع صفوف مناسب")
    print("   🧠 ترجمة ذكية مع تجميع النصوص المتشابهة")
    print("   💾 إدارة ذاكرة محسنة ومراقبة الأداء")
    print("=" * 50)

def main():
    """الدالة الرئيسية المحسنة"""
    show_welcome_message()
    
    # مؤقت لقياس وقت البدء
    start_time = time.time()
    
    # التحقق من Python
    print("\n🔍 فحص النظام:")
    if not check_python_version():
        input("\nاضغط Enter للخروج...")
        return
    
    # فحص موارد النظام
    system_info = check_system_resources()
    
    if not system_info['sufficient']:
        print("\n⚠️ تحذير: موارد النظام قد لا تكون كافية للملفات الكبيرة")
        response = input("هل تريد المتابعة؟ (y/n): ")
        if response.lower() not in ['y', 'yes', 'نعم', 'ن']:
            return
    
    # فحص المتطلبات
    print("\n📦 فحص المتطلبات:")
    missing, optional_missing = check_requirements()
    
    if missing:
        print(f"\n⚠️ المتطلبات المفقودة: {', '.join(missing)}")
        
        response = input("\nهل تريد تثبيت المتطلبات المفقودة؟ (y/n): ")
        if response.lower() in ['y', 'yes', 'نعم', 'ن']:
            if install_requirements():
                print("\n✅ تم تثبيت جميع المتطلبات")
                # إعادة فحص
                missing, _ = check_requirements()
                if missing:
                    print(f"❌ لا تزال هناك متطلبات مفقودة: {', '.join(missing)}")
                    print("يرجى التثبيت يدوياً:")
                    for req in missing:
                        print(f"   pip install {req}")
                    input("\nاضغط Enter للخروج...")
                    return
            else:
                print("\n❌ فشل في التثبيت - يرجى التثبيت يدوياً")
                input("\nاضغط Enter للخروج...")
                return
        else:
            print("\n❌ لا يمكن تشغيل البرنامج بدون المتطلبات")
            input("\nاضغط Enter للخروج...")
            return
    
    # فحص مفاتيح API
    print("\n🔑 فحص مفاتيح API:")
    check_api_keys()
    
    # اختبار الأداء (اختياري)
    if optional_missing:
        print(f"\n⚠️ مكتبات اختيارية مفقودة: {', '.join(optional_missing)}")
        print("   هذا لن يؤثر على وظائف البرنامج الأساسية")
    else:
        run_performance_test()
    
    # حساب وقت التحضير
    prep_time = time.time() - start_time
    print(f"\n⏱️ وقت التحضير: {prep_time:.1f} ثانية")
    
    # تشغيل البرنامج
    run_main_application()
    
    # رسالة الوداع
    print("\n👋 شكراً لاستخدام مترجم ملفات PHP المتقدم!")
    print("💡 للدعم: support@example.com")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n👋 تم إلغاء التشغيل")
    except Exception as e:
        print(f"\n❌ خطأ غير متوقع: {e}")
        print("يرجى الإبلاغ عن هذا الخطأ")
        input("\nاضغط Enter للخروج...")