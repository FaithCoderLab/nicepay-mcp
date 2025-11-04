/**
 * 마크다운 파서 유틸리티
 * 코드 블록, 표, 링크 등을 추출하는 기능 제공
 */

/**
 * 코드 블록 정보
 */
export interface CodeBlock {
  language: string | null;  // 언어 (javascript, python, curl 등)
  code: string;             // 코드 내용
  lineStart: number;        // 시작 라인 번호 (0-based)
  lineEnd: number;          // 끝 라인 번호 (0-based)
}

/**
 * 표 셀 정보
 */
export interface TableCell {
  content: string;
  isHeader: boolean;
}

/**
 * 표 행 정보
 */
export interface TableRow {
  cells: TableCell[];
}

/**
 * 표 정보
 */
export interface Table {
  headers: string[];
  rows: TableRow[];
  raw: string;  // 원본 표 텍스트
}

/**
 * 링크 정보
 */
export interface Link {
  text: string;
  url: string;
  title?: string;
}

/**
 * 마크다운 파서 클래스
 */
export class MarkdownParser {
  /**
   * 마크다운에서 코드 블록을 모두 추출합니다.
   */
  static extractCodeBlocks(content: string): CodeBlock[] {
    const codeBlocks: CodeBlock[] = [];
    const lines = content.split('\n');
    
    let inCodeBlock = false;
    let currentLanguage: string | null = null;
    let codeStart = 0;
    let codeLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 코드 블록 시작 체크 (```language 또는 ```)
      const codeBlockStart = line.match(/^```(\w+)?\s*$/);
      
      if (codeBlockStart && !inCodeBlock) {
        inCodeBlock = true;
        currentLanguage = codeBlockStart[1] || null;
        codeStart = i;
        codeLines = [];
        continue;
      }

      // 코드 블록 끝 체크 (```)
      if (line.trim() === '```' && inCodeBlock) {
        inCodeBlock = false;
        codeBlocks.push({
          language: currentLanguage,
          code: codeLines.join('\n'),
          lineStart: codeStart,
          lineEnd: i - 1,
        });
        currentLanguage = null;
        codeLines = [];
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
      }
    }

    // 닫히지 않은 코드 블록 처리
    if (inCodeBlock && codeLines.length > 0) {
      codeBlocks.push({
        language: currentLanguage,
        code: codeLines.join('\n'),
        lineStart: codeStart,
        lineEnd: lines.length - 1,
      });
    }

    return codeBlocks;
  }

  /**
   * 특정 언어의 코드 블록만 추출합니다.
   */
  static extractCodeBlocksByLanguage(content: string, language: string): CodeBlock[] {
    const allBlocks = this.extractCodeBlocks(content);
    const normalizedLang = language.toLowerCase();
    
    return allBlocks.filter(block => {
      if (!block.language) return false;
      return block.language.toLowerCase() === normalizedLang ||
             block.language.toLowerCase().includes(normalizedLang) ||
             normalizedLang.includes(block.language.toLowerCase());
    });
  }

  /**
   * 모든 표를 추출합니다.
   */
  static extractTables(content: string): Table[] {
    const tables: Table[] = [];
    const lines = content.split('\n');
    
    let currentTable: string[] = [];
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 표 시작 체크 (|로 시작하는 줄)
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        if (!inTable) {
          inTable = true;
          currentTable = [];
        }
        currentTable.push(line);
      } else if (line.trim().startsWith('|')) {
        // 표가 계속되는 경우
        if (inTable) {
          currentTable.push(line);
        }
      } else {
        // 표가 끝난 경우
        if (inTable && currentTable.length >= 2) {
          const table = this.parseTable(currentTable.join('\n'));
          if (table) {
            tables.push(table);
          }
          currentTable = [];
          inTable = false;
        }
      }
    }

    // 마지막 표 처리
    if (inTable && currentTable.length >= 2) {
      const table = this.parseTable(currentTable.join('\n'));
      if (table) {
        tables.push(table);
      }
    }

    return tables;
  }

  /**
   * 표 텍스트를 파싱합니다.
   */
  private static parseTable(tableText: string): Table | null {
    const lines = tableText.trim().split('\n').filter(line => line.trim());
    if (lines.length < 2) return null;

    const headers: string[] = [];
    const rows: TableRow[] = [];

    // 헤더 파싱 (첫 번째 줄)
    const headerLine = lines[0];
    const headerCells = headerLine
      .split('|')
      .map(cell => cell.trim())
      .filter(cell => cell.length > 0);
    
    headers.push(...headerCells);

    // 구분선 건너뛰기 (두 번째 줄)
    // 데이터 행 파싱 (세 번째 줄부터)
    for (let i = 2; i < lines.length; i++) {
      const rowLine = lines[i];
      const rowCells: TableCell[] = rowLine
        .split('|')
        .map(cell => cell.trim())
        .filter(cell => cell.length > 0)
        .map(cell => ({
          content: cell,
          isHeader: false,
        }));

      if (rowCells.length > 0) {
        rows.push({ cells: rowCells });
      }
    }

    return {
      headers,
      rows,
      raw: tableText,
    };
  }

  /**
   * 표에서 특정 열을 찾아 반환합니다.
   */
  static findTableColumn(table: Table, columnName: string): string[] {
    const columnIndex = table.headers.findIndex(
      header => header.toLowerCase().includes(columnName.toLowerCase())
    );

    if (columnIndex === -1) return [];

    return table.rows.map(row => {
      if (row.cells[columnIndex]) {
        return row.cells[columnIndex].content;
      }
      return '';
    }).filter(cell => cell.length > 0);
  }

  /**
   * 마크다운에서 모든 링크를 추출합니다.
   */
  static extractLinks(content: string): Link[] {
    const links: Link[] = [];
    
    // [텍스트](URL "타이틀") 형식
    const linkPattern = /\[([^\]]+)\]\(([^)]+)(?:\s+"([^"]+)")?\)/g;
    let match;

    while ((match = linkPattern.exec(content)) !== null) {
      links.push({
        text: match[1],
        url: match[2],
        title: match[3],
      });
    }

    // [텍스트][참조] 형식도 처리 가능 (참조 링크)
    const referenceLinkPattern = /\[([^\]]+)\]\[([^\]]+)\]/g;
    while ((match = referenceLinkPattern.exec(content)) !== null) {
      // 참조 정의 찾기 (문서 하단에 [참조]: URL 형태)
      const refDefinitionPattern = new RegExp(
        `\\[${match[2]}\\]:\\s+([^\\s]+)`,
        'g'
      );
      const refMatch = refDefinitionPattern.exec(content);
      
      if (refMatch) {
        links.push({
          text: match[1],
          url: refMatch[1],
        });
      }
    }

    return links;
  }

  /**
   * 섹션(헤딩)으로 문서를 분할합니다.
   */
  static extractSections(content: string): Array<{
    level: number;
    title: string;
    content: string;
    lineStart: number;
    lineEnd: number;
  }> {
    const sections: Array<{
      level: number;
      title: string;
      content: string;
      lineStart: number;
      lineEnd: number;
    }> = [];

    const lines = content.split('\n');
    let currentSection: {
      level: number;
      title: string;
      content: string[];
      lineStart: number;
    } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        // 이전 섹션 저장
        if (currentSection) {
          sections.push({
            level: currentSection.level,
            title: currentSection.title,
            content: currentSection.content.join('\n'),
            lineStart: currentSection.lineStart,
            lineEnd: i - 1,
          });
        }

        // 새 섹션 시작
        currentSection = {
          level: headingMatch[1].length,
          title: headingMatch[2].trim(),
          content: [],
          lineStart: i,
        };
      } else if (currentSection) {
        currentSection.content.push(line);
      }
    }

    // 마지막 섹션 저장
    if (currentSection) {
      sections.push({
        level: currentSection.level,
        title: currentSection.title,
        content: currentSection.content.join('\n'),
        lineStart: currentSection.lineStart,
        lineEnd: lines.length - 1,
      });
    }

    return sections;
  }

  /**
   * 특정 키워드가 포함된 섹션을 찾습니다.
   */
  static findSectionsByKeyword(
    content: string,
    keyword: string
  ): Array<{
    level: number;
    title: string;
    content: string;
    lineStart: number;
    lineEnd: number;
  }> {
    const sections = this.extractSections(content);
    const lowerKeyword = keyword.toLowerCase();

    return sections.filter(
      section =>
        section.title.toLowerCase().includes(lowerKeyword) ||
        section.content.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * API 엔드포인트 정보를 표에서 추출합니다.
   */
  static extractAPIEndpoints(content: string): Array<{
    api: string;
    method: string;
    endpoint: string;
  }> {
    const tables = this.extractTables(content);
    const endpoints: Array<{
      api: string;
      method: string;
      endpoint: string;
    }> = [];

    for (const table of tables) {
      // API 표 형식 체크 (API, Method, Endpoint 컬럼이 있는지)
      const apiIndex = table.headers.findIndex(h =>
        h.toLowerCase().includes('api') || h.toLowerCase().includes('기능')
      );
      const methodIndex = table.headers.findIndex(h =>
        h.toLowerCase().includes('method')
      );
      const endpointIndex = table.headers.findIndex(h =>
        h.toLowerCase().includes('endpoint') || h.toLowerCase().includes('url')
      );

      if (apiIndex !== -1 && methodIndex !== -1 && endpointIndex !== -1) {
        for (const row of table.rows) {
          const api = row.cells[apiIndex]?.content || '';
          const method = row.cells[methodIndex]?.content || '';
          const endpoint = row.cells[endpointIndex]?.content || '';

          if (api && method && endpoint) {
            endpoints.push({ api, method, endpoint });
          }
        }
      }
    }

    return endpoints;
  }

  /**
   * 코드 블록에서 API 호출 예시를 찾습니다 (curl, fetch 등).
   */
  static findAPICodeExamples(content: string, language?: string): CodeBlock[] {
    const codeBlocks = language
      ? this.extractCodeBlocksByLanguage(content, language)
      : this.extractCodeBlocks(content);

    return codeBlocks.filter(block => {
      const code = block.code.toLowerCase();
      return (
        code.includes('curl') ||
        code.includes('fetch') ||
        code.includes('axios') ||
        code.includes('http') ||
        code.includes('post') ||
        code.includes('get') ||
        code.includes('api.nicepay') ||
        code.includes('sandbox-api.nicepay')
      );
    });
  }
}
