// قاموس مصطلحات أنظمة التوصيل والطعام
export const deliveryTerms: Record<string, string> = {
  // مصطلحات التوصيل
  'deliveryman': 'مندوب التوصيل',
  'delivery man': 'مندوب التوصيل',
  'delivery_man': 'مندوب التوصيل',
  'delivery boy': 'مندوب التوصيل',
  'delivery person': 'مندوب التوصيل',
  'courier': 'مندوب التوصيل',
  'driver': 'السائق',
  'delivery driver': 'سائق التوصيل',
  
  // مصطلحات الطلبات
  'order': 'الطلب',
  'orders': 'الطلبات',
  'order status': 'حالة الطلب',
  'order tracking': 'تتبع الطلب',
  'order history': 'سجل الطلبات',
  'pending': 'في الانتظار',
  'confirmed': 'مؤكد',
  'preparing': 'قيد التحضير',
  'ready': 'جاهز',
  'out for delivery': 'في الطريق',
  'delivered': 'تم التوصيل',
  'cancelled': 'ملغي',
  
  // مصطلحات المطاعم والطعام
  'restaurant': 'المطعم',
  'restaurants': 'المطاعم',
  'menu': 'القائمة',
  'food_category': 'فئة الطعام',
  'categories': 'الفئات',
  'menu_item': 'عنصر القائمة',
  'items': 'العناصر',
  'food': 'الطعام',
  'meal': 'الوجبة',
  'meals': 'الوجبات',
  'dish': 'الطبق',
  'dishes': 'الأطباق',
  'recipe': 'الوصفة',
  'ingredient': 'المكون',
  'ingredients': 'المكونات',
  
  // مصطلحات الدفع
  'payment': 'الدفع',
  'payment method': 'طريقة الدفع',
  'cash': 'نقداً',
  'card': 'البطاقة',
  'credit card': 'بطاقة ائتمان',
  'wallet': 'المحفظة',
  'refund': 'استرداد',
  'discount': 'خصم',
  'coupon': 'كوبون',
  'promo code': 'رمز الخصم',
  'total': 'الإجمالي',
  'subtotal': 'المجموع الفرعي',
  'tax': 'الضريبة',
  'delivery fee': 'رسوم التوصيل',
  'service charge': 'رسوم الخدمة',
  
  // مصطلحات العملاء
  'customer': 'العميل',
  'customers': 'العملاء',
  'user': 'المستخدم',
  'users': 'المستخدمون',
  'profile': 'الملف الشخصي',
  'account': 'الحساب',
  'address_book': 'دفتر العناوين',
  'addresses': 'العناوين',
  'location': 'الموقع',
  'phone_number': 'رقم الهاتف',
  'email_address': 'البريد الإلكتروني',
  
  // مصطلحات إدارية
  'admin': 'المدير',
  'dashboard': 'لوحة التحكم',
  'settings': 'الإعدادات',
  'configuration': 'التكوين',
  'report': 'التقرير',
  'reports': 'التقارير',
  'analytics': 'التحليلات',
  'statistics': 'الإحصائيات',
  'revenue': 'الإيرادات',
  'commission': 'العمولة',
  
  // مصطلحات تقنية
  'app': 'التطبيق',
  'application': 'التطبيق',
  'website': 'الموقع',
  'platform': 'المنصة',
  'system': 'النظام',
  'database': 'قاعدة البيانات',
  'api': 'واجهة برمجة التطبيقات',
  'notification': 'الإشعار',
  'notifications': 'الإشعارات',
  'alert': 'تنبيه',
  'alerts': 'التنبيهات',
  
  // مصطلحات الوقت والمواعيد
  'delivery time': 'وقت التوصيل',
  'estimated time': 'الوقت المقدر',
  'preparation time': 'وقت التحضير',
  'schedule': 'الجدولة',
  'timezone': 'المنطقة الزمنية',
  'date': 'التاريخ',
  'time': 'الوقت',
  
  // مصطلحات الجودة والتقييم
  'rating': 'التقييم',
  'ratings': 'التقييمات',
  'review': 'المراجعة',
  'reviews': 'المراجعات',
  'feedback': 'التعليقات',
  'quality': 'الجودة',
  'satisfaction': 'الرضا',
  
  // مصطلحات الحالة
  'active': 'نشط',
  'inactive': 'غير نشط',
  'available': 'متاح',
  'unavailable': 'غير متاح',
  'online': 'متصل',
  'offline': 'غير متصل',
  'busy': 'مشغول',
  'free': 'متاح',
  'status': 'الحالة',
  
  // مصطلحات الأخطاء
  'error': 'خطأ',
  'success': 'نجح',
  'failed': 'فشل',
  'invalid': 'غير صحيح',
  'required': 'مطلوب',
  'optional': 'اختياري',
  'warning': 'تحذير',
  'info': 'معلومات',
  
  // كلمات شائعة
  'submit': 'إرسال',
  'save': 'حفظ',
  'cancel': 'إلغاء',
  'delete': 'حذف',
  'edit': 'تعديل',
  'add': 'إضافة',
  'remove': 'إزالة',
  'update': 'تحديث',
  'create': 'إنشاء',
  'search': 'البحث',
  'filter': 'تصفية',
  'sort': 'ترتيب',
  'export': 'تصدير',
  'import': 'استيراد',
  'download': 'تحميل',
  'upload': 'رفع',
  'view': 'عرض',
  'details': 'التفاصيل',
  'description': 'الوصف',
  'name': 'الاسم',
  'title': 'العنوان',
  'type': 'النوع',
  'category': 'الفئة',
  'price': 'السعر',
  'quantity': 'الكمية',
  'amount': 'المبلغ',
  'number': 'الرقم',
  'code': 'الرمز',
  'id': 'المعرف',
  'default': 'افتراضي',
  'custom': 'مخصص',
  'options': 'الخيارات',
  'preferences': 'التفضيلات',
  'language': 'اللغة',
  'country': 'البلد',
  'city': 'المدينة',
  'area': 'المنطقة',
  'street': 'الشارع',
  'building': 'المبنى',
  'floor': 'الطابق',
  'apartment': 'الشقة',
  'note': 'ملاحظة',
  'notes': 'الملاحظات',
  'comment': 'تعليق',
  'comments': 'التعليقات',
  'message': 'الرسالة',
  'messages': 'الرسائل',
  'help': 'المساعدة',
  'support': 'الدعم',
  'contact': 'الاتصال',
  'about': 'حول',
  'terms': 'الشروط',
  'privacy': 'الخصوصية',
  'policy': 'السياسة',
  'agreement': 'الاتفاقية',
  'accept': 'قبول',
  'decline': 'رفض',
  'agree': 'موافق',
  'disagree': 'غير موافق',
  'yes': 'نعم',
  'no': 'لا',
  'ok': 'موافق',
  'close': 'إغلاق',
  'open': 'فتح',
  'next': 'التالي',
  'previous': 'السابق',
  'back': 'رجوع',
  'forward': 'إلى الأمام',
  'home': 'الرئيسية',
  'menu': 'القائمة',
  'logout': 'تسجيل الخروج',
  'login': 'تسجيل الدخول',
  'register': 'التسجيل',
  'signup': 'إنشاء حساب',
  'password': 'كلمة المرور',
  'username': 'اسم المستخدم',
  'email': 'البريد الإلكتروني',
  'phone': 'الهاتف',
  'reset': 'إعادة تعيين',
  'forgot': 'نسيت',
  'remember': 'تذكر',
  'confirm': 'تأكيد',
  'verification': 'التحقق',
  'verify': 'تحقق',
  'sent': 'تم الإرسال',
  'received': 'تم الاستلام',
  'processing': 'قيد المعالجة',
  'completed': 'مكتمل',
  'expired': 'منتهي الصلاحية',
  'valid': 'صحيح',
  'invalid': 'غير صحيح',
  'loading': 'جارٍ التحميل',
  'please wait': 'يرجى الانتظار',
  'try again': 'حاول مرة أخرى',
  'refresh': 'تحديث',
  'reload': 'إعادة تحميل'
};

// دالة معالجة النصوص المعقدة
export function processComplexText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  
  // إزالة علامات الاقتباس
  let processed = text.replace(/^['"]|['"]$/g, '');
  
  // معالجة النصوص التي تحتوي على شرطات سفلية ونقطتين
  // مثل: 'ex_:_new_attribute' -> 'Ex : new attribute'
  processed = processed.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  
  // تنظيف النص
  processed = processed.replace(/^\s*:\s*/, ''); // إزالة النقطتين في البداية
  processed = processed.replace(/\s*:\s*$/, ''); // إزالة النقطتين في النهاية
  
  return processed;
}

// دالة الترجمة الذكية باستخدام القاموس
export function smartTranslate(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  
  const processedText = processComplexText(text).toLowerCase();
  
  // البحث المباشر في القاموس
  if (deliveryTerms[processedText]) {
    return deliveryTerms[processedText];
  }
  
  // البحث في الكلمات المفردة
  const words = processedText.split(/\s+/);
  let translation = '';
  let hasTranslation = false;
  
  for (const word of words) {
    if (deliveryTerms[word]) {
      translation += (translation ? ' ' : '') + deliveryTerms[word];
      hasTranslation = true;
    } else {
      // إذا لم نجد ترجمة للكلمة، نتركها كما هي
      translation += (translation ? ' ' : '') + word;
    }
  }
  
  return hasTranslation ? translation : null;
}

// دالة لتحديد ما إذا كان النص يحتوي على كلمات إنجليزية قابلة للترجمة
export function needsTranslation(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  
  const processedText = processComplexText(text);
  
  // إذا كان النص يحتوي على أحرف عربية، فهو مترجم بالفعل
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(processedText)) {
    return false;
  }
  
  // إذا كان النص يحتوي على أحرف إنجليزية
  if (/[a-zA-Z]/.test(processedText)) {
    return true;
  }
  
  return false;
}

// دالة لإنشاء prompt محسن للترجمة
export function createTranslationPrompt(texts: string[]): string {
  const context = `أنت مترجم خبير متخصص في ترجمة واجهات أنظمة التوصيل والطعام من الإنجليزية إلى العربية.

السياق: نظام توصيل طعام مشابه لطلبات وهنجرستيشن

قواعد الترجمة المهمة:
- deliveryman = مندوب التوصيل
- delivery man = مندوب التوصيل  
- courier = مندوب التوصيل
- driver = السائق
- order = الطلب
- restaurant = المطعم
- customer = العميل
- payment = الدفع

تعليمات:
1. ترجم للعربية بشكل طبيعي ومناسب للمستخدم العربي
2. احتفظ بالمعنى التقني للمصطلحات
3. استخدم المصطلحات الشائعة في التطبيقات العربية
4. لا تترجم الأرقام أو الرموز التقنية
5. إذا كان النص يحتوي على "Ex :" أو "Example:" فترجمها إلى "مثال:"

النصوص المراد ترجمتها:`;

  return context + '\n\n' + texts.map((text, index) => `${index + 1}. "${text}"`).join('\n');
}