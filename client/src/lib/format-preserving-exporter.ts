export interface FormatMetadata {
  indentation?: string;
  quotes?: 'single' | 'double';
  arrayStyle?: 'short' | 'long';
  encoding?: string;
}

export interface TranslationItem {
  key: string;
  originalText: string;
  translatedText?: string;
  status: 'untranslated' | 'translated' | 'needs_review';
}

export class FormatPreservingExporter {
  static exportWithFormat(
    originalContent: string,
    items: TranslationItem[],
    fileType: string,
    formatMetadata?: FormatMetadata
  ): string {
    const itemsMap = new Map(
      items.map(item => [item.key, item.translatedText || item.originalText])
    );

    switch (fileType) {
      case 'php':
        return this.exportPHPWithFormat(originalContent, itemsMap, formatMetadata);
      case 'json':
        return this.exportJSONWithFormat(originalContent, itemsMap, formatMetadata);
      case 'po':
        return this.exportPOWithFormat(originalContent, itemsMap);
      case 'csv':
        return this.exportCSVWithFormat(originalContent, itemsMap);
      default:
        return originalContent;
    }
  }

  private static exportPHPWithFormat(
    originalContent: string,
    itemsMap: Map<string, string>,
    formatMetadata?: FormatMetadata
  ): string {
    const lines = originalContent.split('\n');
    const quotes = formatMetadata?.quotes || 'single';
    const arrayStyle = formatMetadata?.arrayStyle || 'short';
    
    const patterns = [
      /'([^']+)'\s*=>\s*'([^']*)',?/g,
      /"([^"]+)"\s*=>\s*"([^"]*)",?/g,
      /\$([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*'([^']*)';?/g,
      /\$([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*"([^"]*)";?/g,
    ];

    return lines.map(line => {
      let updatedLine = line;
      
      for (const pattern of patterns) {
        updatedLine = updatedLine.replace(pattern, (match, key, value) => {
          const translatedValue = itemsMap.get(key);
          if (translatedValue !== undefined) {
            const quoteChar = quotes === 'single' ? "'" : '"';
            if (match.includes('=>')) {
              return `${quoteChar}${key}${quoteChar} => ${quoteChar}${translatedValue}${quoteChar}${match.endsWith(',') ? ',' : ''}`;
            } else {
              return `$${key} = ${quoteChar}${translatedValue}${quoteChar}${match.endsWith(';') ? ';' : ''}`;
            }
          }
          return match;
        });
      }
      
      return updatedLine;
    }).join('\n');
  }

  private static exportJSONWithFormat(
    originalContent: string,
    itemsMap: Map<string, string>,
    formatMetadata?: FormatMetadata
  ): string {
    try {
      const originalData = JSON.parse(originalContent);
      const indentation = formatMetadata?.indentation || '  ';
      
      const updateObject = (obj: any, prefix: string = ''): any => {
        const result: any = Array.isArray(obj) ? [] : {};
        
        for (const [key, value] of Object.entries(obj)) {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          
          if (typeof value === 'string') {
            result[key] = itemsMap.get(fullKey) || value;
          } else if (typeof value === 'object' && value !== null) {
            result[key] = updateObject(value, fullKey);
          } else {
            result[key] = value;
          }
        }
        
        return result;
      };
      
      const updatedData = updateObject(originalData);
      return JSON.stringify(updatedData, null, indentation);
    } catch (error) {
      return originalContent;
    }
  }

  private static exportPOWithFormat(
    originalContent: string,
    itemsMap: Map<string, string>
  ): string {
    const lines = originalContent.split('\n');
    let currentMsgid = '';
    let inMsgid = false;
    let inMsgstr = false;

    return lines.map(line => {
      if (line.startsWith('msgid ')) {
        currentMsgid = line.substring(6).replace(/^"|"$/g, '');
        inMsgid = true;
        inMsgstr = false;
        return line;
      } else if (line.startsWith('msgstr ')) {
        inMsgid = false;
        inMsgstr = true;
        const translation = itemsMap.get(currentMsgid);
        if (translation !== undefined) {
          return `msgstr "${translation}"`;
        }
        return line;
      } else if (inMsgid && line.startsWith('"')) {
        currentMsgid += line.replace(/^"|"$/g, '');
        return line;
      } else if (inMsgstr && line.startsWith('"')) {
        const translation = itemsMap.get(currentMsgid);
        if (translation !== undefined) {
          return `"${translation}"`;
        }
        return line;
      } else if (line.trim() === '') {
        inMsgid = false;
        inMsgstr = false;
        currentMsgid = '';
        return line;
      }
      
      return line;
    }).join('\n');
  }

  private static exportCSVWithFormat(
    originalContent: string,
    itemsMap: Map<string, string>
  ): string {
    const lines = originalContent.split('\n');
    const header = lines[0];
    
    return [
      header,
      ...lines.slice(1).map(line => {
        const [key, original, ...rest] = this.parseCSVLine(line);
        const translation = itemsMap.get(key) || original;
        return `"${key}","${original}","${translation}"${rest.length > 0 ? ',' + rest.join(',') : ''}`;
      })
    ].join('\n');
  }

  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }

  static detectFormatMetadata(content: string, fileType: string): FormatMetadata {
    const metadata: FormatMetadata = {};

    // Detect indentation
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^(\s+)/);
      if (match && match[1].length > 0) {
        metadata.indentation = match[1];
        break;
      }
    }
    metadata.indentation = metadata.indentation || '  ';

    // Detect quote style
    if (fileType === 'json') {
      metadata.quotes = 'double';
    } else {
      const singleQuotes = (content.match(/'/g) || []).length;
      const doubleQuotes = (content.match(/"/g) || []).length;
      metadata.quotes = singleQuotes > doubleQuotes ? 'single' : 'double';
    }

    // Detect array style for PHP
    if (fileType === 'php') {
      metadata.arrayStyle = content.includes('array(') ? 'long' : 'short';
    }

    return metadata;
  }
}