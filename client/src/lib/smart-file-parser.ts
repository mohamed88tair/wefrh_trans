export interface SmartTranslationItem {
  key: string;
  originalText: string;
  translatedText?: string;
  status: 'untranslated' | 'translated' | 'needs_review';
  fileType: 'php' | 'json' | 'po' | 'csv';
  lineNumber?: number;
  context?: string;
  preserveFormat?: boolean;
}

export interface FileStructure {
  type: 'php' | 'json' | 'po' | 'csv';
  content: string;
  items: SmartTranslationItem[];
  metadata: {
    encoding?: string;
    indentation?: string;
    quotes?: 'single' | 'double';
    arrayStyle?: 'short' | 'long';
  };
}

export class SmartFileParser {
  
  static detectFileFormat(fileName: string, content: string): FileStructure {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (extension === 'json' || this.isJSONFormat(content)) {
      return this.parseJSON(content);
    } else if (extension === 'php' || this.isPHPFormat(content)) {
      return this.parsePHP(content);
    } else if (extension === 'po' || this.isPOFormat(content)) {
      return this.parsePO(content);
    } else if (extension === 'csv' || this.isCSVFormat(content)) {
      return this.parseCSV(content);
    }
    
    throw new Error(`نوع الملف غير مدعوم: ${fileName}`);
  }

  private static isJSONFormat(content: string): boolean {
    const trimmed = content.trim();
    return trimmed.startsWith('{') && trimmed.endsWith('}');
  }

  private static isPHPFormat(content: string): boolean {
    return content.includes('<?php') || (content.includes('array(') || content.includes('['));
  }

  private static isPOFormat(content: string): boolean {
    return content.includes('msgid') && content.includes('msgstr');
  }

  private static isCSVFormat(content: string): boolean {
    const lines = content.split('\n');
    return lines.length > 1 && lines[0].includes(',');
  }

  private static parseJSON(content: string): FileStructure {
    const items: SmartTranslationItem[] = [];
    const lines = content.split('\n');
    
    // Detect indentation
    let indentation = '  '; // default
    for (const line of lines) {
      const match = line.match(/^(\s+)/);
      if (match && match[1].length > 0) {
        indentation = match[1];
        break;
      }
    }

    // Detect quote style
    const doubleQuoteCount = (content.match(/"/g) || []).length;
    const singleQuoteCount = (content.match(/'/g) || []).length;
    const quotes = doubleQuoteCount > singleQuoteCount ? 'double' : 'single';

    try {
      const data = JSON.parse(content);
      this.extractJSONItems(data, items, '');
    } catch (error) {
      throw new Error('تنسيق JSON غير صحيح');
    }

    return {
      type: 'json',
      content,
      items,
      metadata: {
        indentation,
        quotes
      }
    };
  }

  private static extractJSONItems(obj: any, items: SmartTranslationItem[], prefix: string = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string') {
        const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(value);
        
        items.push({
          key: fullKey,
          originalText: value,
          status: hasArabic ? 'translated' : 'untranslated',
          fileType: 'json',
          preserveFormat: true
        });
      } else if (typeof value === 'object' && value !== null) {
        this.extractJSONItems(value, items, fullKey);
      }
    }
  }

  private static parsePHP(content: string): FileStructure {
    const items: SmartTranslationItem[] = [];
    const lines = content.split('\n');
    
    // Detect indentation and array style
    let indentation = '  ';
    let arrayStyle: 'short' | 'long' = 'long';
    let quotes: 'single' | 'double' = 'single';
    
    for (const line of lines) {
      const indentMatch = line.match(/^(\s+)/);
      if (indentMatch && indentMatch[1].length > 0) {
        indentation = indentMatch[1];
      }
      
      if (line.includes('[') && line.includes(']')) {
        arrayStyle = 'short';
      }
      
      if (line.includes('"') && !line.includes("'")) {
        quotes = 'double';
      }
    }

    // Parse PHP array content
    let lineNumber = 0;
    for (const line of lines) {
      lineNumber++;
      
      // Match PHP array patterns
      const patterns = [
        /'([^']+)'\s*=>\s*'([^']*)',?/g, // 'key' => 'value',
        /"([^"]+)"\s*=>\s*"([^"]*)",?/g, // "key" => "value",
        /'([^']+)'\s*=>\s*"([^"]*)",?/g, // 'key' => "value",
        /"([^"]+)"\s*=>\s*'([^']*)',?/g  // "key" => 'value',
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const [, key, value] = match;
          const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(value);
          
          items.push({
            key: key.replace(/\\'/g, "'").replace(/\\"/g, '"'),
            originalText: value.replace(/\\'/g, "'").replace(/\\"/g, '"'),
            status: hasArabic ? 'translated' : 'untranslated',
            fileType: 'php',
            lineNumber,
            preserveFormat: true
          });
        }
      }
    }

    return {
      type: 'php',
      content,
      items,
      metadata: {
        indentation,
        quotes,
        arrayStyle
      }
    };
  }

  private static parsePO(content: string): FileStructure {
    const items: SmartTranslationItem[] = [];
    const lines = content.split('\n');
    
    let currentItem: Partial<SmartTranslationItem> = {};
    let lineNumber = 0;
    
    for (const line of lines) {
      lineNumber++;
      const trimmed = line.trim();
      
      if (trimmed.startsWith('#.')) {
        currentItem.context = trimmed.substring(2).trim();
      } else if (trimmed.startsWith('msgid')) {
        const match = trimmed.match(/msgid\s+"(.*)"/);
        if (match) {
          currentItem.key = match[1] || `msgid_${lineNumber}`;
          currentItem.originalText = match[1];
          currentItem.lineNumber = lineNumber;
        }
      } else if (trimmed.startsWith('msgstr')) {
        const match = trimmed.match(/msgstr\s+"(.*)"/);
        if (match) {
          const translatedText = match[1];
          const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(translatedText);
          
          if (currentItem.key && currentItem.originalText) {
            items.push({
              key: currentItem.key,
              originalText: currentItem.originalText,
              translatedText: translatedText || undefined,
              status: translatedText ? (hasArabic ? 'translated' : 'needs_review') : 'untranslated',
              fileType: 'po',
              lineNumber: currentItem.lineNumber,
              context: currentItem.context,
              preserveFormat: true
            });
          }
          
          currentItem = {};
        }
      }
    }

    return {
      type: 'po',
      content,
      items,
      metadata: {
        encoding: 'UTF-8'
      }
    };
  }

  private static parseCSV(content: string): FileStructure {
    const items: SmartTranslationItem[] = [];
    const lines = content.split('\n');
    
    const hasHeader = lines[0] && lines[0].toLowerCase().includes('key');
    const startIndex = hasHeader ? 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = this.parseCSVLine(line);
      if (columns.length >= 2) {
        const key = columns[0] || `item_${i}`;
        const originalText = columns[1] || '';
        const translatedText = columns[2] || '';
        
        const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(translatedText || originalText);
        
        items.push({
          key,
          originalText,
          translatedText: translatedText || undefined,
          status: translatedText ? (hasArabic ? 'translated' : 'needs_review') : 'untranslated',
          fileType: 'csv',
          lineNumber: i + 1,
          preserveFormat: true
        });
      }
    }

    return {
      type: 'csv',
      content,
      items,
      metadata: {}
    };
  }

  private static parseCSVLine(line: string): string[] {
    const columns: string[] = [];
    let currentColumn = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        columns.push(currentColumn.trim().replace(/^"|"$/g, ''));
        currentColumn = '';
      } else {
        currentColumn += char;
      }
    }
    
    columns.push(currentColumn.trim().replace(/^"|"$/g, ''));
    return columns;
  }

  static exportWithOriginalFormat(structure: FileStructure, updatedItems: SmartTranslationItem[]): string {
    switch (structure.type) {
      case 'json':
        return this.exportJSON(structure, updatedItems);
      case 'php':
        return this.exportPHP(structure, updatedItems);
      case 'po':
        return this.exportPO(structure, updatedItems);
      case 'csv':
        return this.exportCSV(structure, updatedItems);
      default:
        throw new Error(`نوع ملف غير مدعوم: ${structure.type}`);
    }
  }

  private static exportJSON(structure: FileStructure, updatedItems: SmartTranslationItem[]): string {
    const itemsMap = new Map(updatedItems.map(item => [item.key, item.translatedText || item.originalText]));
    
    // Rebuild JSON object
    const result: any = {};
    for (const item of updatedItems) {
      const keys = item.key.split('.');
      let current = result;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = item.translatedText || item.originalText;
    }

    const indentation = structure.metadata.indentation || '  ';
    return JSON.stringify(result, null, indentation);
  }

  private static exportPHP(structure: FileStructure, updatedItems: SmartTranslationItem[]): string {
    const lines = structure.content.split('\n');
    const updatedLines = [...lines];
    const indentation = structure.metadata.indentation || '  ';
    const quote = structure.metadata.quotes === 'double' ? '"' : "'";
    
    // Update lines with new translations
    for (const item of updatedItems) {
      if (item.lineNumber && item.translatedText !== item.originalText) {
        const lineIndex = item.lineNumber - 1;
        if (lineIndex < updatedLines.length) {
          const line = updatedLines[lineIndex];
          
          // Escape quotes in the translation
          const escapedTranslation = item.translatedText?.replace(/'/g, "\\'").replace(/"/g, '\\"') || item.originalText;
          
          // Replace the value part while preserving the format
          const newLine = line.replace(
            /(=>\s*['"][^'"]*['"])/,
            `=> ${quote}${escapedTranslation}${quote}`
          );
          
          updatedLines[lineIndex] = newLine;
        }
      }
    }

    return updatedLines.join('\n');
  }

  private static exportPO(structure: FileStructure, updatedItems: SmartTranslationItem[]): string {
    const lines = structure.content.split('\n');
    const updatedLines = [...lines];
    
    for (const item of updatedItems) {
      if (item.lineNumber && item.translatedText) {
        // Find the msgstr line for this item
        for (let i = item.lineNumber; i < lines.length; i++) {
          if (lines[i].trim().startsWith('msgstr')) {
            updatedLines[i] = `msgstr "${item.translatedText}"`;
            break;
          }
        }
      }
    }

    return updatedLines.join('\n');
  }

  private static exportCSV(structure: FileStructure, updatedItems: SmartTranslationItem[]): string {
    let content = "Key,Original Text,Translation,Status\n";
    
    for (const item of updatedItems) {
      const escapedKey = `"${item.key.replace(/"/g, '""')}"`;
      const escapedOriginal = `"${item.originalText.replace(/"/g, '""')}"`;
      const escapedTranslation = `"${(item.translatedText || item.originalText).replace(/"/g, '""')}"`;
      const status = item.status || 'untranslated';
      
      content += `${escapedKey},${escapedOriginal},${escapedTranslation},${status}\n`;
    }
    
    return content;
  }
}

// Enhanced detection and parsing
export function detectAndParseFile(fileName: string, content: string): FileStructure {
  return SmartFileParser.detectFileFormat(fileName, content);
}

export function exportWithFormat(structure: FileStructure, items: SmartTranslationItem[]): string {
  return SmartFileParser.exportWithOriginalFormat(structure, items);
}