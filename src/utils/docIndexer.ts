import * as fs from 'fs';
import * as path from 'path';

/**
 * 문서 인덱스 항목 인터페이스
 */
export interface DocumentIndex {
    filePath: string;           // 파일 경로 (상대 경로)
    absolutePath: string;        // 절대 경로
    fileName: string;            // 파일명
    title: string;               // 문서 제목 (첫 번째 # 제목)
    content: string;             // 전체 내용
    sections: DocumentSection[]; // 섹션 목록
    keywords: string[];          // 키워드 (제목과 주요 텍스트에서 추출)
}

/**
 * 문서 섹션 인터페이스
 */
export interface DocumentSection {
    level: number;               // 헤딩 레벨 (1-6)
    title: string;              // 섹션 제목
    content: string;             // 섹션 내용
    anchor: string;             // 앵커 (URL fragment용)
}

/**
 * 문서 인덱서 클래스
 */
export class DocumentIndexer {
    private docsBasePath: string;
    private index: Map<string, DocumentIndex> = new Map();

    constructor(docsBasePath: string) {
        this.docsBasePath = docsBasePath;
    }

    /**
     * 모든 마크다운 파일을 인덱싱합니다.
     */
    async buildIndex(): Promise<void> {
        this.index.clear();

        // 인덱싱할 디렉토리 목록
        const targetDirs = ['api', 'common', 'management', 'migration'];

        for (const dir of targetDirs) {
            const dirPath = path.join(this.docsBasePath, dir);
            if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
                await this.indexDirectory(dirPath, dir);
            }
        }

        // 루트의 README.md도 인덱싱
        const rootReadme = path.join(this.docsBasePath, 'README.md');
        if (fs.existsSync(rootReadme)) {
            await this.indexFile(rootReadme, 'README.md');
        }
    }

    /**
     * 디렉토리를 재귀적으로 탐색하여 마크다운 파일을 인덱싱합니다.
     */
    private async indexDirectory(dirPath: string, relativeBase: string): Promise<void> {
        const entries = fs.readdirSync(dirPath, {withFileTypes: true});

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                // image 디렉토리는 건너뛰기
                if (entry.name !== 'image' && entry.name !== 'node_modules' && entry.name !== 'dist') {
                    await this.indexDirectory(fullPath, path.join(relativeBase, entry.name));
                }
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                const relativePath = path.join(relativeBase, entry.name);
                await this.indexFile(fullPath, relativePath);
            }
        }
    }

    /**
     * 단일 마크다운 파일을 인덱싱합니다.
     */
    private async indexFile(filePath: string, relativePath: string): Promise<void> {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const parsed = this.parseMarkdown(content);

            const docIndex: DocumentIndex = {
                filePath: relativePath,
                absolutePath: filePath,
                fileName: path.basename(filePath),
                title: parsed.title,
                content: content,
                sections: parsed.sections,
                keywords: this.extractKeywords(parsed.title, content),
            };

            this.index.set(relativePath, docIndex);
        } catch (error) {
            console.error(`파일 인덱싱 실패: ${filePath}`, error);
        }
    }

    /**
     * 마크다운 내용을 파싱하여 제목과 섹션을 추출합니다.
     */
    private parseMarkdown(content: string): { title: string; sections: DocumentSection[] } {
        const lines = content.split('\n');
        const sections: DocumentSection[] = [];
        let title = '';
        let currentSection: { level: number; title: string; content: string [] } | null = null;

        for (const line of lines) {
            // 헤딩 확인 (# ~ ######)
            const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

            if (headingMatch) {
                // 이전 섹션 저장
                if (currentSection) {
                    sections.push({
                        level: currentSection.level,
                        title: currentSection.title,
                        content: currentSection.content.join('\n'),
                        anchor: this.generateAnchor(currentSection.title),
                    });
                }

                const level = headingMatch[1].length;
                const headingText = headingMatch[2].trim();

                // 첫 번째 헤딩을 제목으로 사용
                if (!title) {
                    title = headingText;
                }

                // 새 섹션 시작
                currentSection = {
                    level,
                    title: headingText,
                    content: [],
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
                anchor: this.generateAnchor(currentSection.title),
            });
        }

        return {title: title || 'Untitled', sections};
    }

    /**
     * 제목에서 앵커를 생성합니다.
     */
    private generateAnchor(title: string): string {
        return title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    }

    /**
     * 키워드를 추출합니다.
     */
    private extractKeywords(title: string, content: string): string[] {
        const keywords = new Set<string>();

        // 제목에서 키워드 추출
        const titleWords = title.split(/\s+/).filter(w => w.length > 1);
        titleWords.forEach(word => keywords.add(word.toLowerCase()));

        // 내용에서 중요한 단어 추출 (한글, 영문)
        const words = content.match(/[\uAC00-\uD7A3]+|[a-zA-Z]+[a-zA-Z0-9]*/g) || [];
        words
            .filter(w => w.length > 2) // 2글자 이상
            .slice(0, 50) // 최대 50개
            .forEach(word => keywords.add(word.toLowerCase()));

        return Array.from(keywords);
    }

    /**
     * 전체 인덱스를 반환합니다.
     */
    getAllDocuments(): DocumentIndex[] {
        return Array.from(this.index.values());
    }

    /**
     * 파일 경로로 문서를 조회합니다.
     */
    getDocument(filePath: string): DocumentIndex | undefined {
        return this.index.get(filePath);
    }

    /**
     * 키워드로 문서를 검색합니다.
     */
    searchDocuments(query: string): DocumentIndex[] {
        const lowerQuery = query.toLowerCase();
        const results: Array<{ doc: DocumentIndex; score: number }> = [];

        for (const doc of this.index.values()) {
            let score = 0;

            // 제목 매치 (높은 점수)
            if (doc.title.toLowerCase().includes(lowerQuery)) {
                score += 10;
            }

            // 파일명 매치
            if (doc.fileName.toLowerCase().includes(lowerQuery)) {
                score += 5;
            }

            // 키워드 매치
            const keywordMatches = doc.keywords.filter(k => k.includes(lowerQuery)).length;
            score += keywordMatches;

            // 내용 매치 (낮은 점수)
            if (doc.content.toLowerCase().includes(lowerQuery)) {
                score += 1;
            }

            if (score > 0) {
                results.push({doc, score});
            }
        }

        // 점수 순으로 정렬
        results.sort((a, b) => b.score - a.score);

        return results.map(r => r.doc);
    }

    /**
     * 특정 섹션을 찾습니다.
     */
    findSection(filePath: string, sectionTitle: string): DocumentSection | undefined {
        const doc = this.getDocument(filePath);
        if (!doc) return undefined;

        return doc.sections.find(
            section => section.title.toLowerCase().includes(sectionTitle.toLowerCase())
        );
    }

    /**
     * 인덱스 크기를 반환합니다.
     */
    getIndexSize(): number {
        return this.index.size;
    }
}