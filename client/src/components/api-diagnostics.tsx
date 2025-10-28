import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface DiagnosticsProps {
  selectedProvider: string;
}

export default function ApiDiagnostics({ selectedProvider }: DiagnosticsProps) {
  const [isTestingAPI, setIsTestingAPI] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const testAPIKey = async () => {
    setIsTestingAPI(true);
    try {
      const response = await fetch('/api/test-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selectedProvider }),
      });

      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: 'خطأ في الشبكة',
        errorCode: 'NETWORK_ERROR'
      });
    } finally {
      setIsTestingAPI(false);
    }
  };

  const getStatusIcon = () => {
    if (!testResult) return null;
    
    if (testResult.success) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusBadge = () => {
    if (!testResult) return null;
    
    if (testResult.success) {
      return <Badge variant="default" className="bg-green-500">نشط</Badge>;
    } else {
      return <Badge variant="destructive">خطأ</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <i className="fas fa-stethoscope"></i>
            تشخيص مفتاح API
          </CardTitle>
          <CardDescription>
            اختبر مفتاح API للتأكد من أنه يعمل بشكل صحيح
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">مزود الخدمة: {selectedProvider}</p>
              <p className="text-sm text-muted-foreground">
                {selectedProvider === 'gemini' ? 'Google Gemini' : selectedProvider}
              </p>
            </div>
            {getStatusBadge()}
          </div>
          
          <Button 
            onClick={testAPIKey} 
            disabled={isTestingAPI}
            className="w-full"
          >
            {isTestingAPI ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                جاري الاختبار...
              </>
            ) : (
              <>
                <i className="fas fa-play w-4 h-4 ml-2"></i>
                اختبار مفتاح API
              </>
            )}
          </Button>

          {testResult && (
            <Alert className={testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <AlertDescription className="flex-1">
                  <div className="space-y-2">
                    <p className="font-medium">{testResult.message}</p>
                    
                    {testResult.details && (
                      <div className="text-sm">
                        {testResult.success ? (
                          <div>
                            <p>النموذج: {testResult.details.model}</p>
                            <p>الحالة: {testResult.details.status}</p>
                            {testResult.details.response && (
                              <p>استجابة الاختبار: {testResult.details.response}</p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <p className="font-medium text-red-700 mb-2">رمز الخطأ: {testResult.errorCode}</p>
                            {testResult.details.possibleCauses && (
                              <div>
                                <p className="font-medium">الأسباب المحتملة:</p>
                                <ul className="list-disc list-inside mt-1 space-y-1">
                                  {testResult.details.possibleCauses.map((cause: string, index: number) => (
                                    <li key={index}>{cause}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {testResult.details.error && (
                              <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                                <p className="font-medium">تفاصيل الخطأ:</p>
                                <pre>{JSON.stringify(testResult.details.error, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            نصائح لحل المشاكل
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-2">
            <h4 className="font-medium">إذا فشل اختبار مفتاح API:</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>تأكد من صحة مفتاح API المُدخل</li>
              <li>تحقق من تفعيل خدمة Gemini API في Google Cloud Console</li>
              <li>تأكد من عدم انتهاء الحصة المجانية</li>
              <li>احصل على مفتاح جديد من: 
                <a 
                  href="https://makersuite.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 underline mr-1"
                >
                  Google AI Studio
                </a>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <i className="fas fa-info-circle"></i>
            معلومات النظام
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium">مزود الخدمة المختار</p>
              <p className="text-muted-foreground">{selectedProvider}</p>
            </div>
            <div>
              <p className="font-medium">النموذج</p>
              <p className="text-muted-foreground">
                {selectedProvider === 'gemini' ? 'gemini-1.5-flash' : 'غير محدد'}
              </p>
            </div>
            <div>
              <p className="font-medium">حالة الاتصال</p>
              <p className="text-muted-foreground">متصل</p>
            </div>
            <div>
              <p className="font-medium">الإصدار</p>
              <p className="text-muted-foreground">1.0.0</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}