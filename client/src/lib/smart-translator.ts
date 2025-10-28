// نظام الترجمة الذكي للنصوص
export function cleanText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  
  // إزالة علامات الاقتباس
  let cleaned = text.replace(/^['"]|['"]$/g, '');
  
  // معالجة الشرطات السفلية والنقطتين
  // ex_:_new_attribute -> Ex : new attribute
  cleaned = cleaned.replace(/_/g, ' ');
  cleaned = cleaned.replace(/\s*:\s*/g, ' : ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

// قاموس مصطلحات التوصيل
const deliveryTerms: Record<string, string> = {
  'deliveryman': 'مندوب التوصيل',
  'delivery man': 'مندوب التوصيل',
  'courier': 'مندوب التوصيل',
  'driver': 'السائق',
  'order': 'الطلب',
  'restaurant': 'المطعم',
  'customer': 'العميل',
  'payment': 'الدفع',
  'menu': 'القائمة',
  'food': 'الطعام',
  'delivery': 'التوصيل',
  'address': 'العنوان',
  'phone': 'الهاتف',
  'email': 'البريد الإلكتروني',
  'submit': 'إرسال',
  'save': 'حفظ',
  'cancel': 'إلغاء',
  'delete': 'حذف',
  'edit': 'تعديل',
  'add': 'إضافة',
  'search': 'البحث',
  'filter': 'تصفية',
  'export': 'تصدير',
  'download': 'تحميل',
  'view': 'عرض',
  'name': 'الاسم',
  'price': 'السعر',
  'total': 'الإجمالي',
  'status': 'الحالة',
  'active': 'نشط',
  'inactive': 'غير نشط',
  'available': 'متاح',
  'unavailable': 'غير متاح',
  'pending': 'في الانتظار',
  'confirmed': 'مؤكد',
  'delivered': 'تم التوصيل',
  'cancelled': 'ملغي',
  'attributes': 'الخصائص',
  'attribute': 'خاصية',
  'default': 'افتراضي',
  'options': 'الخيارات',
  'reset': 'إعادة تعيين',
  'new': 'جديد',
  'example': 'مثال',
  'ex': 'مثال',
  'grocery': 'بقالة',
  'refund': 'استرداد',
  'mode': 'وضع',
  'customers': 'العملاء',
  'requests': 'الطلبات',
  'invalid': 'غير صحيح',
  'data': 'البيانات',
  'category': 'الفئة',
  'sub': 'فرعي',
  'list': 'قائمة'
};

export function translateWithDictionary(text: string): string | null {
  const cleaned = cleanText(text).toLowerCase();
  
  // البحث المباشر
  if (deliveryTerms[cleaned]) {
    return deliveryTerms[cleaned];
  }
  
  // البحث في الكلمات
  const words = cleaned.split(/\s+/);
  let translation = '';
  let hasTranslation = false;
  
  for (const word of words) {
    if (deliveryTerms[word]) {
      translation += (translation ? ' ' : '') + deliveryTerms[word];
      hasTranslation = true;
    } else if (word === ':') {
      translation += ' : ';
    } else {
      translation += (translation ? ' ' : '') + word;
    }
  }
  
  return hasTranslation ? translation : null;
}

export function needsTranslation(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  
  const cleaned = cleanText(text);
  
  // تخطي النصوص الفارغة أو القصيرة جداً
  if (cleaned.length < 2) return false;
  
  // تخطي الأرقام فقط
  if (/^\d+$/.test(cleaned.trim())) return false;
  
  // تخطي الرموز البرمجية
  if (/^[\{\}\[\]<>\/\\$#@%^&*()+=|~`\-_.;:,!?]+$/.test(cleaned.trim())) return false;
  
  // إذا كان يحتوي على أحرف عربية، فهو مترجم بالفعل
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(cleaned)) {
    return false;
  }
  
  // إذا كان يحتوي على أحرف إنجليزية أو لاتينية
  if (/[a-zA-Z]/.test(cleaned)) {
    return true;
  }
  
  return false;
}

export function createDeliveryPrompt(texts: string[]): string {
  return `أنت مترجم خبير لأنظمة التوصيل والطعام. اتبع هذه القواعد:

1. deliveryman = مندوب التوصيل
2. ex/example = مثال
3. attribute = خاصية
4. category = فئة
5. استخدم مصطلحات طبيعية ومفهومة للمستخدم العربي

ترجم النصوص التالية للعربية:

${texts.map((text, i) => `${i + 1}. "${text}"`).join('\n')}

أعط الترجمات فقط، كل ترجمة في سطر منفصل.`;
}