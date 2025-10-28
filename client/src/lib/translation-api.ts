import { apiRequest } from "./queryClient";

export interface TranslationRequest {
  text: string;
  provider: 'openai' | 'gemini';
  apiKey: string;
  model?: string;
}

export interface TranslationResponse {
  translatedText: string;
}

export interface ConnectionTestRequest {
  provider: 'openai' | 'gemini';
  apiKey: string;
  model?: string;
}

export interface ConnectionTestResponse {
  success: boolean;
  errorMessage?: string;
}

export async function translateText(request: TranslationRequest): Promise<string> {
  const response = await apiRequest('POST', '/api/translate', request);
  const data: TranslationResponse = await response.json();
  return data.translatedText;
}

export async function testApiConnection(request: ConnectionTestRequest): Promise<ConnectionTestResponse> {
  const response = await apiRequest('POST', '/api/test-connection', request);
  return await response.json();
}

export function estimateCost(wordCount: number, provider: string, model?: string): number {
  const costs: Record<string, number> = {
    'gpt-4o': 0.005,
    'gpt-4-turbo': 0.01,
    'gpt-3.5-turbo': 0.0015,
    'gemini-2.5-flash': 0.0,
    'gemini-2.5-pro': 0.0035,
  };

  const key = model || provider;
  const costPer1k = costs[key] || 0.01;
  return (wordCount / 1000) * costPer1k;
}

export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).length;
}

export function hasArabicContent(text: string): boolean {
  if (!text) return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
}
