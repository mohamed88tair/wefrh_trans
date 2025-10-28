"""
إعدادات البرنامج ومفاتيح API
"""
import os
import json
from pathlib import Path

# مجلد الإعدادات
CONFIG_DIR = Path.home() / ".php_translator"
CONFIG_FILE = CONFIG_DIR / "config.json"
CACHE_FILE = CONFIG_DIR / "translations_cache.json"

# إنشاء مجلد الإعدادات إذا لم يكن موجوداً
CONFIG_DIR.mkdir(exist_ok=True)

# النماذج المدعومة
SUPPORTED_MODELS = {
    'gpt-4': {
        'name': 'GPT-4',
        'provider': 'openai',
        'cost': 'عالي',
        'speed': 'متوسط',
        'quality': 'ممتاز'
    },
    'gpt-3.5-turbo': {
        'name': 'GPT-3.5 Turbo',
        'provider': 'openai', 
        'cost': 'منخفض',
        'speed': 'سريع',
        'quality': 'جيد جداً'
    },
    'gemini-pro': {
        'name': 'Gemini Pro',
        'provider': 'google',
        'cost': 'مجاني*',
        'speed': 'سريع',
        'quality': 'جيد جداً'
    },
    'claude-3-sonnet': {
        'name': 'Claude 3 Sonnet',
        'provider': 'anthropic',
        'cost': 'متوسط',
        'speed': 'متوسط',
        'quality': 'ممتاز'
    }
}

# قاموس المصطلحات المخصص لأنظمة التوصيل
DELIVERY_TERMINOLOGY = {
    'deliveryman': 'مندوب التوصيل',
    'delivery man': 'مندوب التوصيل',
    'delivery men': 'مندوبي التوصيل',
    'deliverymen': 'مندوبي التوصيل',
    'delivery boy': 'مندوب التوصيل',
    'delivery boys': 'مندوبي التوصيل',
    'driver': 'سائق التوصيل',
    'drivers': 'سائقي التوصيل',
    'courier': 'مندوب التوصيل',
    'couriers': 'مندوبي التوصيل',
    'order': 'طلب',
    'orders': 'طلبات',
    'customer': 'عميل',
    'customers': 'عملاء',
    'restaurant': 'مطعم',
    'restaurants': 'مطاعم',
    'vendor': 'متجر',
    'vendors': 'متاجر',
    'delivery': 'توصيل',
    'pickup': 'استلام',
    'dashboard': 'لوحة التحكم',
    'admin': 'مدير',
    'manager': 'مدير',
    'payment': 'دفع',
    'payments': 'مدفوعات',
    'cash on delivery': 'الدفع عند الاستلام',
    'cod': 'الدفع عند الاستلام',
    'refund': 'استرداد',
    'refunds': 'استردادات',
    'commission': 'عمولة',
    'earnings': 'أرباح',
    'rating': 'تقييم',
    'ratings': 'تقييمات',
    'review': 'مراجعة', 
    'reviews': 'مراجعات',
    'track': 'تتبع',
    'tracking': 'تتبع',
    'status': 'حالة',
    'pending': 'في الانتظار',
    'confirmed': 'مؤكد',
    'preparing': 'قيد التحضير',
    'ready': 'جاهز',
    'picked up': 'تم الاستلام',
    'delivered': 'تم التوصيل',
    'cancelled': 'ملغي',
    'location': 'موقع',
    'address': 'عنوان',
    'phone': 'هاتف',
    'mobile': 'جوال',
    'email': 'بريد إلكتروني',
    'zone': 'منطقة',
    'area': 'منطقة',
    'city': 'مدينة',
    'category': 'فئة',
    'categories': 'فئات',
    'item': 'منتج',
    'items': 'منتجات',
    'product': 'منتج',
    'products': 'منتجات',
    'price': 'سعر',
    'total': 'المجموع',
    'subtotal': 'المجموع الفرعي',
    'discount': 'خصم',
    'tax': 'ضريبة',
    'tip': 'إكرامية',
    'delivery fee': 'رسوم التوصيل',
    'service fee': 'رسوم الخدمة'
}

# بروميت الترجمة المخصص
TRANSLATION_PROMPT = """أنت مترجم خبير متخصص في ترجمة واجهات أنظمة التوصيل والطعام (مثل طلبات، هنجرستيشن، أوبر إيتس) من الإنجليزية إلى العربية.

قواعد الترجمة المهمة:
1. استخدم هذه المصطلحات بالضبط:
   - deliveryman/delivery man = "مندوب التوصيل"
   - order = "طلب" 
   - customer = "عميل"
   - restaurant = "مطعم"
   - dashboard = "لوحة التحكم"
   - cash on delivery = "الدفع عند الاستلام"

2. حافظ على:
   - المتغيرات البرمجية مثل $name, {{variable}}
   - الأرقام والرموز الخاصة
   - تنسيق HTML إذا وجد

3. فهم النص رغم الفواصل والشرطات:
   - "ex_:_new_attribute" = "مثال: خاصية جديدة"
   - "search_sub_category" = "البحث في الفئة الفرعية"

4. ترجم بطريقة طبيعية مناسبة للمستخدم العربي
5. اجعل الترجمة مختصرة ومفهومة

ترجم النص التالي فقط دون إضافات:"""

class Config:
    """كلاس إدارة الإعدادات"""
    
    def __init__(self):
        self.api_keys = {}
        self.settings = {
            'default_model': 'gpt-3.5-turbo',
            'auto_save': True,
            'backup_files': True,
            'batch_size': 10,
            'max_retries': 3,
            'timeout': 30
        }
        self.load_config()
        
    def load_config(self):
        """تحميل الإعدادات من الملف"""
        try:
            if CONFIG_FILE.exists():
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.api_keys = data.get('api_keys', {})
                    self.settings.update(data.get('settings', {}))
        except Exception as e:
            print(f"خطأ في تحميل الإعدادات: {e}")
            
    def save_config(self):
        """حفظ الإعدادات إلى الملف"""
        try:
            config_data = {
                'api_keys': self.api_keys,
                'settings': self.settings
            }
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(config_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"خطأ في حفظ الإعدادات: {e}")
            
    def set_api_key(self, provider, key):
        """تعيين مفتاح API"""
        self.api_keys[provider] = key
        self.save_config()
        
    def get_api_key(self, provider):
        """الحصول على مفتاح API"""
        return self.api_keys.get(provider, '')
        
    def set_setting(self, key, value):
        """تعيين إعداد"""
        self.settings[key] = value
        self.save_config()
        
    def get_setting(self, key, default=None):
        """الحصول على إعداد"""
        return self.settings.get(key, default)

# إنشاء مثيل عالي للإعدادات
config = Config()