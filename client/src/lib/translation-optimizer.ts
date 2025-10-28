// Translation optimization utilities to save API costs

interface TranslationItem {
  id: number;
  text: string;
  context?: string;
}

interface GroupedTranslation {
  representative: string;
  items: TranslationItem[];
  similarity: number;
}

export class TranslationOptimizer {
  private static instance: TranslationOptimizer;
  private cache = new Map<string, string>();
  private debounceTimers = new Map<number, NodeJS.Timeout>();

  static getInstance(): TranslationOptimizer {
    if (!TranslationOptimizer.instance) {
      TranslationOptimizer.instance = new TranslationOptimizer();
    }
    return TranslationOptimizer.instance;
  }

  // Group similar texts to reduce API calls
  groupSimilarTexts(items: TranslationItem[]): GroupedTranslation[] {
    const groups: GroupedTranslation[] = [];
    
    for (const item of items) {
      const text = item.text.trim().toLowerCase();
      
      // Find existing group with high similarity
      let foundGroup = groups.find(group => {
        const similarity = this.calculateSimilarity(text, group.representative.toLowerCase());
        return similarity > 0.8; // 80% similarity threshold
      });
      
      if (foundGroup) {
        foundGroup.items.push(item);
      } else {
        groups.push({
          representative: item.text,
          items: [item],
          similarity: 1.0
        });
      }
    }
    
    return groups;
  }

  // Calculate text similarity
  private calculateSimilarity(text1: string, text2: string): number {
    if (text1 === text2) return 1;
    
    // Simple word-based similarity
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word)).length;
    const totalWords = Math.max(words1.length, words2.length);
    
    return totalWords > 0 ? commonWords / totalWords : 0;
  }

  // Create optimized translation prompt
  createOptimizedPrompt(text: string, variation: number = 0): string {
    const prompts = [
      `Translate to Arabic: ${text}`,
      `${text} → Arabic:`,
      `Arabic translation of "${text}":`,
      `Convert to Arabic: ${text}`,
      `"${text}" = `
    ];
    
    return prompts[variation % prompts.length];
  }

  // Clean translation response
  cleanTranslationResponse(response: string): string {
    let cleaned = response.trim();
    
    // Remove common translation prefixes in Arabic and English
    cleaned = cleaned.replace(/^(ترجمة هذا إلى العربية|ترجمة إلى العربية|ترجم إلى العربية|Arabic translation|Translation|Translate to Arabic).*?[:：]/i, '');
    cleaned = cleaned.replace(/^(Give|Provide|Convert|Arabic|English|Translate).*?[:：]/i, '');
    
    // Remove parentheses and their content
    cleaned = cleaned.replace(/\(.*?\)/g, '');
    
    // Remove quotes and extra spaces
    cleaned = cleaned.replace(/^["'\s]*|["'\s]*$/g, '');
    
    // Remove leading dashes and arrows
    cleaned = cleaned.replace(/^\s*[-→]\s*/, '');
    
    // Look for Arabic text after colons
    const colonSplit = cleaned.split(/[:：]/);
    if (colonSplit.length > 1) {
      for (let i = colonSplit.length - 1; i >= 0; i--) {
        const part = colonSplit[i].trim();
        if (/[\u0600-\u06FF]/.test(part) && !/(translate|arabic|english)/i.test(part)) {
          cleaned = part;
          break;
        }
      }
    }
    
    // Extract Arabic text from quotes
    const quotedArabic = cleaned.match(/"([^"]*[\u0600-\u06FF][^"]*)"/);
    if (quotedArabic) {
      cleaned = quotedArabic[1];
    }
    
    // Remove any remaining English instruction text
    cleaned = cleaned.replace(/(translate|arabic|english|convert|give|provide).*/gi, '');
    
    // Extract only Arabic characters, spaces, and Arabic numbers
    const arabicOnly = cleaned.match(/[\u0600-\u06FF\s\u0660-\u0669]+/);
    if (arabicOnly) {
      cleaned = arabicOnly[0];
    }
    
    // Final cleanup
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  // Debounced save to reduce server requests
  debouncedSave(itemId: number, updateFn: () => void, delay: number = 2000): void {
    // Clear existing timer
    if (this.debounceTimers.has(itemId)) {
      clearTimeout(this.debounceTimers.get(itemId)!);
    }
    
    // Set new timer
    const timer = setTimeout(() => {
      updateFn();
      this.debounceTimers.delete(itemId);
    }, delay);
    
    this.debounceTimers.set(itemId, timer);
  }

  // Cache management
  getCachedTranslation(text: string): string | null {
    return this.cache.get(text.trim().toLowerCase()) || null;
  }

  setCachedTranslation(text: string, translation: string): void {
    this.cache.set(text.trim().toLowerCase(), translation);
  }

  // Estimate cost savings
  estimateCostSavings(originalCount: number, optimizedCount: number): {
    savedRequests: number;
    savedTokens: number;
    savedCost: number;
  } {
    const savedRequests = originalCount - optimizedCount;
    const avgTokensPerRequest = 30; // Estimated
    const costPerToken = 0.00001; // Estimated Gemini cost
    
    return {
      savedRequests,
      savedTokens: savedRequests * avgTokensPerRequest,
      savedCost: savedRequests * avgTokensPerRequest * costPerToken
    };
  }
}

export const translationOptimizer = TranslationOptimizer.getInstance();