export interface ParsedTranslation {
  key: string;
  originalText: string;
  status: 'untranslated' | 'translated' | 'needs_review';
  context?: string; // For PO files
  comments?: string; // For PO files
}

export function parsePHPFile(content: string): ParsedTranslation[] {
  const items: ParsedTranslation[] = [];
  
  try {
    // Remove PHP opening/closing tags and clean content
    let cleanContent = content
      .replace(/<\?php/g, '')
      .replace(/\?>/g, '')
      .trim();

    // Handle different PHP array formats
    if (cleanContent.includes('return array')) {
      // Handle "return array(" pattern
      cleanContent = cleanContent.replace(/return\s+array\s*\(/, '');
      // Remove the last closing parenthesis and semicolon
      cleanContent = cleanContent.replace(/\);?\s*$/, '');
    } else if (cleanContent.includes('return [')) {
      // Handle "return [" pattern
      cleanContent = cleanContent.replace(/return\s*\[/, '');
      // Remove the last closing bracket and semicolon
      cleanContent = cleanContent.replace(/\];?\s*$/, '');
    }

    // Enhanced regex patterns to handle more complex cases
    const patterns = [
      // 'key' => 'value',
      /'([^'\\]*(?:\\.[^'\\]*)*)'\s*=>\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g,
      // "key" => "value",
      /"([^"\\]*(?:\\.[^"\\]*)*)"\s*=>\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g,
      // 'key' => "value",
      /'([^'\\]*(?:\\.[^'\\]*)*)'\s*=>\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g,
      // "key" => 'value',
      /"([^"\\]*(?:\\.[^"\\]*)*)"\s*=>\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g,
    ];

    patterns.forEach(pattern => {
      // Reset regex lastIndex for each pattern
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(cleanContent)) !== null) {
        const key = match[1].replace(/\\'/g, "'").replace(/\\"/g, '"'); // Unescape quotes
        const value = match[2].replace(/\\'/g, "'").replace(/\\"/g, '"'); // Unescape quotes
        
        // Skip if already exists
        if (items.some(item => item.key === key)) {
          continue;
        }
        
        // Check if text contains Arabic characters
        const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(value);
        
        items.push({
          key,
          originalText: value,
          status: hasArabic ? 'translated' : 'untranslated',
        });
      }
    });

  } catch (error) {
    console.error('Error parsing PHP file:', error);
    throw new Error('فشل في تحليل ملف PHP. تأكد من صحة تنسيق الملف.');
  }

  if (items.length === 0) {
    throw new Error('لم يتم العثور على أي عناصر ترجمة في الملف. تأكد من أن الملف يحتوي على مصفوفة PHP صحيحة.');
  }

  return items;
}

export function parseJSONFile(content: string): ParsedTranslation[] {
  try {
    const data = JSON.parse(content);
    
    if (typeof data !== 'object' || data === null) {
      throw new Error('الملف يجب أن يحتوي على كائن JSON');
    }

    const items: ParsedTranslation[] = [];
    
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'string') {
        const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(value);
        
        items.push({
          key,
          originalText: value,
          status: hasArabic ? 'translated' : 'untranslated',
        });
      }
    });

    if (items.length === 0) {
      throw new Error('لم يتم العثور على أي نصوص قابلة للترجمة في الملف.');
    }

    return items;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('ملف JSON غير صالح. تأكد من صحة تنسيق الملف.');
    }
    throw error;
  }
}

export function exportToPHP(items: any[]): string {
  let content = "<?php return array (\n";
  
  items.forEach(item => {
    // Use translated text if available, otherwise original text
    const text = item.translatedText || item.originalText || '';
    
    // Keep the text exactly as it should be in PHP - only escape unescaped single quotes
    // First, temporarily replace already escaped quotes to protect them
    let processedKey = item.key
      .replace(/\\'/g, '__ESCAPED_QUOTE__')  // Protect existing escaped quotes
      .replace(/'/g, "\\'")                  // Escape unescaped quotes
      .replace(/__ESCAPED_QUOTE__/g, "\\'"); // Restore escaped quotes
    
    let processedText = text
      .replace(/\\'/g, '__ESCAPED_QUOTE__')  // Protect existing escaped quotes
      .replace(/'/g, "\\'")                  // Escape unescaped quotes  
      .replace(/__ESCAPED_QUOTE__/g, "\\'"); // Restore escaped quotes
    
    // Use 2-space indentation as requested
    content += `  '${processedKey}' => '${processedText}',\n`;
  });
  
  content += ");\n";
  return content;
}

export function exportToJSON(items: any[]): string {
  const data: Record<string, string> = {};
  
  items.forEach(item => {
    // Use translated text if available, otherwise original text
    const text = item.translatedText || item.originalText || '';
    data[item.key] = text;
  });
  
  return JSON.stringify(data, null, 2);
}

export function exportToCSV(items: any[]): string {
  let content = "Key,Original Text,Translation,Status\n";
  
  items.forEach(item => {
    const escapedKey = `"${item.key.replace(/"/g, '""')}"`;
    const originalText = item.originalText || '';
    const translatedText = item.translatedText || item.originalText || '';
    const status = item.status || (item.translatedText ? 'translated' : 'untranslated');
    
    const escapedOriginal = `"${originalText.replace(/"/g, '""')}"`;
    const escapedTranslation = `"${translatedText.replace(/"/g, '""')}"`;
    
    content += `${escapedKey},${escapedOriginal},${escapedTranslation},${status}\n`;
  });
  
  return content;
}

export function parsePOFile(content: string): ParsedTranslation[] {
  const items: ParsedTranslation[] = [];
  const lines = content.split('\n');
  
  let currentItem: Partial<ParsedTranslation> = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('#.')) {
      currentItem.comments = line.substring(2).trim();
    } else if (line.startsWith('msgctxt')) {
      const match = line.match(/msgctxt\s+"(.*)"/);
      if (match) {
        currentItem.context = match[1];
      }
    } else if (line.startsWith('msgid')) {
      const match = line.match(/msgid\s+"(.*)"/);
      if (match) {
        currentItem.key = match[1] || `msgid_${i}`;
        currentItem.originalText = match[1];
      }
    } else if (line.startsWith('msgstr')) {
      const match = line.match(/msgstr\s+"(.*)"/);
      if (match) {
        const translatedText = match[1];
        currentItem.status = translatedText ? 'translated' : 'untranslated';
        
        if (currentItem.key && currentItem.originalText) {
          items.push({
            key: currentItem.key,
            originalText: currentItem.originalText,
            status: currentItem.status,
            context: currentItem.context,
            comments: currentItem.comments
          });
        }
        
        currentItem = {};
      }
    }
  }
  
  return items;
}

export function parseCSVFile(content: string): ParsedTranslation[] {
  const items: ParsedTranslation[] = [];
  const lines = content.split('\n');
  
  const startIndex = lines[0] && lines[0].toLowerCase().includes('key') ? 1 : 0;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const columns = [];
    let currentColumn = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        columns.push(currentColumn.replace(/^"|"$/g, ''));
        currentColumn = '';
      } else {
        currentColumn += char;
      }
    }
    columns.push(currentColumn.replace(/^"|"$/g, ''));
    
    if (columns.length >= 2) {
      const key = columns[0] || `item_${i}`;
      const originalText = columns[1] || '';
      const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(originalText);
      
      items.push({
        key,
        originalText,
        status: hasArabic ? 'translated' : 'untranslated'
      });
    }
  }
  
  return items;
}

export function exportToPO(items: any[]): string {
  let content = '# Translation file\n';
  content += '# Generated by Translation Tool\n';
  content += 'msgid ""\n';
  content += 'msgstr ""\n';
  content += '"Content-Type: text/plain; charset=UTF-8\\n"\n\n';
  
  items.forEach(item => {
    const text = item.translatedText || '';
    
    if (item.comments) {
      content += `#. ${item.comments}\n`;
    }
    
    if (item.context) {
      content += `msgctxt "${item.context}"\n`;
    }
    
    content += `msgid "${item.originalText || item.key}"\n`;
    content += `msgstr "${text}"\n\n`;
  });
  
  return content;
}

export function detectFileType(fileName: string, content: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  if (extension === 'php') return 'php';
  if (extension === 'json') return 'json';
  if (extension === 'po') return 'po';
  if (extension === 'csv') return 'csv';
  
  // Detect by content
  if (content.includes('<?php') && content.includes('return array')) return 'php';
  if (content.trim().startsWith('{') && content.trim().endsWith('}')) return 'json';
  if (content.includes('msgid') && content.includes('msgstr')) return 'po';
  if (content.includes(',') && content.split('\n').length > 1) return 'csv';
  
  return 'unknown';
}

export function parseFileByType(content: string, fileType: string): ParsedTranslation[] {
  switch (fileType) {
    case 'php':
      return parsePHPFile(content);
    case 'json':
      return parseJSONFile(content);
    case 'po':
      return parsePOFile(content);
    case 'csv':
      return parseCSVFile(content);
    default:
      throw new Error(`نوع الملف غير مدعوم: ${fileType}`);
  }
}

export function exportWithOriginalFormat(originalContent: string, items: any[], fileType: string): string {
  switch (fileType) {
    case 'php':
      return exportToPHPWithFormat(originalContent, items);
    case 'json':
      return exportToJSONWithFormat(originalContent, items);
    case 'po':
      return exportToPOWithFormat(originalContent, items);
    case 'csv':
      return exportToCSV(items);
    default:
      return exportToPHP(items);
  }
}

function exportToPHPWithFormat(originalContent: string, items: any[]): string {
  const lines = originalContent.split('\n');
  const itemsMap = new Map(items.map(item => [item.key, item.translatedText || item.originalText]));
  
  // Process each line and update translations while preserving format
  const updatedLines = lines.map(line => {
    // Match PHP array patterns
    const patterns = [
      /'([^']+)'\s*=>\s*'([^']*)'/g,
      /"([^"]+)"\s*=>\s*"([^"]*)"/g,
      /'([^']+)'\s*=>\s*"([^"]*)"/g,
      /"([^"]+)"\s*=>\s*'([^']*)'/g
    ];

    let updatedLine = line;
    
    for (const pattern of patterns) {
      updatedLine = updatedLine.replace(pattern, (match, key, value) => {
        const cleanKey = key.replace(/\\'/g, "'").replace(/\\"/g, '"');
        const newValue = itemsMap.get(cleanKey);
        
        if (newValue !== undefined) {
          // Preserve the original quote style and escaping
          const escapedValue = newValue.replace(/'/g, "\\'").replace(/"/g, '\\"');
          return match.replace(value, escapedValue);
        }
        
        return match;
      });
    }
    
    return updatedLine;
  });

  return updatedLines.join('\n');
}

function exportToJSONWithFormat(originalContent: string, items: any[]): string {
  try {
    // Parse original to maintain structure
    const originalData = JSON.parse(originalContent);
    const itemsMap = new Map(items.map(item => [item.key, item.translatedText || item.originalText]));
    
    const updateObject = (obj: any, prefix: string = '', map: Map<string, string>): any => {
      const result: any = Array.isArray(obj) ? [] : {};
      
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof value === 'string') {
          result[key] = map.get(fullKey) || value;
        } else if (typeof value === 'object' && value !== null) {
          result[key] = updateObject(value, fullKey, map);
        } else {
          result[key] = value;
        }
      }
      
      return result;
    };
    
    const updatedData = updateObject(originalData, '', itemsMap);
    
    // Detect original indentation
    const lines = originalContent.split('\n');
    let indentation = '  '; // default
    for (const line of lines) {
      const match = line.match(/^(\s+)/);
      if (match && match[1].length > 0) {
        indentation = match[1];
        break;
      }
    }
    
    return JSON.stringify(updatedData, null, indentation);
  } catch (error) {
    // Fallback to standard export
    return exportToJSON(items);
  }
}

function exportToPOWithFormat(originalContent: string, items: any[]): string {
  const lines = originalContent.split('\n');
  const itemsMap = new Map(items.map(item => [item.key, item.translatedText || item.originalText]));
  
  const updatedLines = [...lines];
  let currentKey = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('msgid')) {
      const match = line.match(/msgid\s+"(.*)"/);
      if (match) {
        currentKey = match[1];
      }
    } else if (line.startsWith('msgstr') && currentKey) {
      const newValue = itemsMap.get(currentKey);
      if (newValue !== undefined) {
        updatedLines[i] = `msgstr "${newValue}"`;
      }
      currentKey = '';
    }
  }
  
  return updatedLines.join('\n');
}
