import {fileURLToPath} from "node:url";
import * as path from 'path';
import {Server} from "@modelcontextprotocol/sdk/server/index.js";
import {CallToolRequestSchema, ListToolsRequestSchema, Tool} from "@modelcontextprotocol/sdk/types.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {DocumentIndexer} from "./utils/docIndexer.js";
import {MarkdownParser} from "./utils/markdownParser.js";
import {logger} from "./utils/logger.js";

// 현재 파일의 디렉토리 경로 가져오기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 나이스페이 가이드 문서 디렉토리 경로
const DOCS_BASE_PATH = path.resolve(__dirname, '../../');

class NicePayMCPServer {
    private server: Server;
    private docIndexer: DocumentIndexer;

    constructor() {
        this.server = new Server(
            {
                name: 'nicepay-mcp-server',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                }
            }
        );

        // 인덱서 초기화 및 인덱싱
        this.docIndexer = new DocumentIndexer(DOCS_BASE_PATH);
        this.initializeIndexer();

        this.setupHandlers();
    }

    private setupHandlers() {
        // 도구 목록 제공
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'search_nicepay_docs',
                        description: '나이스페이 개발자 가이드 문서를 검색합니다. 키워드로 관련 문서를 찾을 수 있습니다.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: '검색할 키워드 (예: "결제창", "취소", "웹훅", "API" 등)',
                                },
                            },
                            required: ['query'],
                        },
                    },
                    {
                        name: 'get_api_endpoint',
                        description: '특정 API 엔드포인트의 상세 정보를 조회합니다. 메서드, URL, 파라미터, 예시 등을 제공합니다.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                endpoint_name: {
                                    type: 'string',
                                    description: '조회할 API 엔드포인트 이름 (예: "결제 승인", "거래 조회" ,"취소" 등)',
                                },
                            },
                            required: ['endpoint_name'],
                        },
                    },
                    {
                        name: 'get_code_sample',
                        description: '나이스페이 API 사용 예시 코드를 제공합니다. 언어별로 코드 샘플을 조회할 수 있습니다.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                topic: {
                                    type: 'string',
                                    description: '코드 샘플을 찾을 주제 (예: "결제창 호출", "Basic 인증", "결제 승인" 등)',
                                },
                                language: {
                                    type: 'string',
                                    description: '언어 (선택사항, 예 "javascript", "python", "curl" 등)',
                                },
                            },
                            required: ['topic'],
                        },
                    },
                    {
                        name: 'get_sdk_method',
                        description: 'JS SDK 메서드 정보를 조회합니다. AUTHNICE.requestPay() 등의 메서드 사용법을 제공합니다.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                method_name: {
                                    type: 'string',
                                    description: '조회할 SDK 메서드 이름 (예: "requestPay", "cancelPay" 등)',
                                },
                            },
                            required: ['method_name'],
                        },
                    },
                ] as Tool[],
            };
        });

        // 도구 실행 처리
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const {name, arguments: args} = request.params;

            try {
                logger.debug(`도구 호출: ${name}`, args);

                let result;
                switch (name) {
                    case 'search_nicepay_docs':
                        if (!args?.query || typeof args.query !== 'string') {
                            logger.warn(`잘못된 파라미터: search_nicepay_docs`, args);
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: 'query 파라미터가 필요합니다.',
                                    },
                                ],
                                isError: true,
                            };
                        }
                        result = await this.searchDocs(args.query);
                        break;

                    case 'get_api_endpoint':
                        if (!args?.endpoint_name || typeof args.endpoint_name !== 'string') {
                            logger.warn(`잘못된 파라미터: get_api_endpoint`, args);
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: 'endpoint_name 파라미터가 필요합니다.',
                                    },
                                ],
                                isError: true,
                            };
                        }
                        result = await this.getAPIEndpoint(args.endpoint_name);
                        break;

                    case 'get_code_sample':
                        if (!args?.topic || typeof args.topic !== 'string') {
                            logger.warn(`잘못된 파라미터: get_code_sample`, args);
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: 'topic 파라미터가 필요합니다.',
                                    },
                                ],
                                isError: true,
                            };
                        }
                        result = await this.getCodeSample(
                            args.topic,
                            args.language as string | undefined,
                        );
                        break;

                    case 'get_sdk_method':
                        if (!args?.method_name || typeof args.method_name !== 'string') {
                            logger.warn(`잘못된 파라미터: get_sdk_method`, args);
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: 'method_name 파라미터가 필요합니다.',
                                    },
                                ],
                                isError: true,
                            };
                        }
                        result = await this.getSDKMethod(args.method_name);
                        break;

                    default:
                        logger.warn(`알 수 없는 도구: ${name}`);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `알 수 없는 도구: ${name}`,
                                },
                            ],
                            isError: true,
                        };
                }

                logger.debug(`도구 실행 완료: ${name}`);
                return result;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const errorStack = error instanceof Error ? error.stack : undefined;

                logger.error(`도구 실행 중 오류 발생: ${name}`, errorMessage, errorStack);

                return {
                    content: [
                        {
                            type: 'text',
                            text: `예상치 못한 오류가 발생했습니다: ${errorMessage}\n\n문제가 지속되면 관리자에게 문의해주세요.`
                        },
                    ],
                    isError: true,
                };
            }
        });
    }

    private async initializeIndexer() {
        try {
            logger.info('문서 인덱싱 시작...');
            await this.docIndexer.buildIndex();
            const indexSize = this.docIndexer.getIndexSize();
            logger.info(`문서 인덱싱 완료: ${indexSize}개 파일`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('문서 인덱싱 실패:', errorMessage, error);
            // 인덱싱 실패해도 서버는 계속 실행 (빈 인덱스로 동작)
        }
    }

    // 도구 메서드들
    private async searchDocs(query: string) {
        if (!query || query.trim().length === 0) {
            return {
                content: [
                    {
                        type: 'text',
                        text: '검색어를 입력해주세요.',
                    },
                ],
                isError: true,
            };
        }

        try {
            const results = this.docIndexer.searchDocuments(query.trim());

            if (results.length === 0) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `"${query}"에 대한 검색 결과를 찾을 수 없습니다.\n\n다른 키워드로 검색해보세요.`,
                        },
                    ],
                };
            }

            // 최대 10개까지만 반환
            const limitedResults = results.slice(0, 10);

            let resultText = `"${query}" 검색 결과 (${results.length}개 문서 중 상위 ${limitedResults.length}개)\n\n`;

            limitedResults.forEach((doc, index) => {
                resultText += `## ${index + 1}. ${doc.title}\n`;
                resultText += `📄 파일: ${doc.filePath}\n\n`;

                // 문서의 처음 200자 미리보기
                const preview = doc.content.substring(0, 200).replace(/\n/g, ' ').trim();
                if (preview.length > 0) {
                    resultText += `${preview}${doc.content.length > 200 ? '...' : ''}\n\n`;
                }

                // 주요 섹션 제목 목록 (최대 5개)
                if (doc.sections.length > 0) {
                    resultText += `**주요 섹션:**\n`;
                    doc.sections.slice(0, 5).forEach(section => {
                        resultText += `- ${'  '.repeat(section.level - 1)}${section.title}\n`;
                    });
                    resultText += '\n';
                }

                resultText += '---\n\n';
            });

            if (results.length > 10) {
                resultText += `\n*총 ${results.length}개 문서 중 상위 10개만 표시됩니다.*\n`;
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: resultText,
                    },
                ],
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`문서 검색 오류 (query: ${query}):`, errorMessage);
            return {
                content: [
                    {
                        type: 'text',
                        text: `검색 중 오류가 발생했습니다. 다시 시도해주세요.`,
                    },
                ],
                isError: true,
            };
        }
    }

    private async getAPIEndpoint(endpointName: string) {
        if (!endpointName || endpointName.trim().length === 0) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'API 엔드포인트 이름을 입력해주세요.',
                    },
                ],
                isError: true,
            };
        }

        try {
            const query = endpointName.trim();

            // 1. 먼저 common/api.md에서 URI 목록 표를 찾기
            const apiDoc = this.docIndexer.getDocument('common/api.md');
            if (!apiDoc) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'API 문서를 찾을 수 없습니다.',
                        },
                    ],
                    isError: true,
                };
            }

            // URI 목록 표 찾기
            const tables = MarkdownParser.extractTables(apiDoc.content);
            const uriTable = tables.find(table => {
                const headers = table.headers.map(h => h.toLowerCase());
                return headers.includes('api') && headers.includes('method') && headers.includes('endpoint');
            });

            if (!uriTable) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'URI 목록 표를 찾을 수 없습니다.',
                        },
                    ],
                    isError: true,
                };
            }

            // 2. 요청한 API 찾기
            const apiIndex = uriTable.headers.findIndex(h =>
                h.toLowerCase().includes('api') || h.toLowerCase().includes('기능')
            );
            const methodIndex = uriTable.headers.findIndex(h =>
                h.toLowerCase().includes('method')
            );
            const endpointIndex = uriTable.headers.findIndex(h =>
                h.toLowerCase().includes('endpoint') || h.toLowerCase().includes('url')
            );

            if (apiIndex === -1 || methodIndex === -1 || endpointIndex === -1) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'API 목록 표 형식이 올바르지 않습니다.',
                        },
                    ],
                    isError: true,
                };
            }

            // 관련 API 행 찾기
            const matchingRows = uriTable.rows.filter(row => {
                const apiName = row.cells[apiIndex]?.content || '';
                return apiName.toLowerCase().includes(query.toLowerCase());
            });

            if (matchingRows.length === 0) {
                // URI 목록에서 못 찾으면 전체 문서에서 검색
                const searchResults = this.docIndexer.searchDocuments(query);
                if (searchResults.length === 0) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `"${query}"에 대한 API 엔드포인트를 찾을 수 없습니다.\n\n다른 키워드로 검색해보세요.`,
                            },
                        ],
                    };
                }

                // 검색 결과에서 API 관련 문서 찾기
                let resultText = `"${query}" 관련 문서 검색 결과:\n\n`;
                searchResults.slice(0, 5).forEach((doc, index) => {
                    resultText += `${index + 1}. ${doc.title} (${doc.filePath})\n`;
                });
                resultText += `\n더 구체적인 API 이름을 입력해주세요 (예: "결제 승인", "취소", "거래 조회" 등)`;

                return {
                    content: [
                        {
                            type: 'text',
                            text: resultText,
                        },
                    ],
                };
            }

            // 3. 첫 번째 매칭 결과 사용
            const matchedRow = matchingRows[0];
            const apiName = matchedRow.cells[apiIndex]?.content || '';
            const method = matchedRow.cells[methodIndex]?.content || '';
            const endpoint = matchedRow.cells[endpointIndex]?.content || '';

            // 4. 링크에서 실제 문서 경로 추출
            const apiLink = MarkdownParser.extractLinks(apiName);
            let docPath = '';
            if (apiLink.length > 0) {
                docPath = apiLink[0].url.split('#')[0]; // 앵커 제거
                if (docPath.startsWith('/')) {
                    docPath = docPath.substring(1); // 앞의 / 제거
                }
                if (docPath.endsWith('.md')) {
                    // 이미 .md 포함
                } else if (!docPath.includes('.')) {
                    docPath += '.md';
                }
            }

            // 5. 실제 API 문서 찾기
            let apiDetailDoc = null;
            if (docPath) {
                apiDetailDoc = this.docIndexer.getDocument(docPath);
            }

            // 문서를 못 찾으면 검색으로 찾기
            if (!apiDetailDoc) {
                const searchResults = this.docIndexer.searchDocuments(apiName);
                if (searchResults.length > 0) {
                    apiDetailDoc = searchResults[0];
                }
            }

            // 6. 결과 포맷팅
            let resultText = `## ${apiName}\n\n`;
            resultText += `**Method:** ${method}\n`;
            resultText += `**Endpoint:** ${endpoint}\n\n`;
            resultText += `---\n\n`;

            if (apiDetailDoc) {
                // 요청 명세 섹션 찾기
                const requestSection = apiDetailDoc.sections.find(s =>
                    s.title.toLowerCase().includes('요청') &&
                    (s.title.toLowerCase().includes('명세') || s.title.toLowerCase().includes('파라미터'))
                );

                if (requestSection) {
                    resultText += `### 요청 명세\n\n`;

                    // 표 추출
                    const sectionTables = MarkdownParser.extractTables(requestSection.content);
                    if (sectionTables.length > 0) {
                        const paramTable = sectionTables[0];
                        if (paramTable.headers.length > 0) {
                            resultText += `| ${paramTable.headers.join(' | ')} |\n`;
                            resultText += `|${paramTable.headers.map(() => '---').join('|')}|\n`;
                            paramTable.rows.slice(0, 10).forEach(row => {
                                const cells = row.cells.map(c => c.content);
                                resultText += `| ${cells.join(' | ')} |\n`;
                            });
                            resultText += '\n';
                        }
                    } else {
                        // 표가 없으면 섹션 내용의 일부 표시
                        const preview = requestSection.content.substring(0, 500).trim();
                        if (preview) {
                            resultText += `${preview}...\n\n`;
                        }
                    }
                }

                // 응답 명세 섹션 찾기
                const responseSection = apiDetailDoc.sections.find(s =>
                    s.title.toLowerCase().includes('응답') &&
                    (s.title.toLowerCase().includes('명세') || s.title.toLowerCase().includes('결과'))
                );

                if (responseSection) {
                    resultText += `### 응답 명세\n\n`;
                    const preview = responseSection.content.substring(0, 500).trim();
                    if (preview) {
                        resultText += `${preview}...\n\n`;
                    }
                }

                // 샘플 코드 찾기
                const codeBlocks = MarkdownParser.findAPICodeExamples(apiDetailDoc.content);
                if (codeBlocks.length > 0) {
                    resultText += `### 샘플 코드\n\n`;
                    codeBlocks.slice(0, 3).forEach((block, index) => {
                        resultText += `\`\`\`${block.language || ''}\n${block.code}\n\`\`\`\n\n`;
                    });
                }

                resultText += `\n---\n`;
                resultText += `📄 전체 문서: ${apiDetailDoc.filePath}\n`;
            } else {
                resultText += `\n*상세 문서를 찾을 수 없습니다.*\n`;
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: resultText,
                    },
                ],
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`API 엔드포인트 조회 오류 (endpoint: ${endpointName}):`, errorMessage);
            return {
                content: [
                    {
                        type: 'text',
                        text: `API 엔드포인트 조회 중 오류가 발생했습니다. 다시 시도해주세요.`,
                    },
                ],
                isError: true,
            };
        }
    }

    private async getCodeSample(topic: string, language?: string) {
        if (!topic || topic.trim().length === 0) {
            return {
                content: [
                    {
                        type: 'text',
                        text: '주제를 입력해주세요.',
                    },
                ],
                isError: true,
            };
        }

        try {
            const query = topic.trim();

            // 1. 관련 문서 검색
            const searchResults = this.docIndexer.searchDocuments(query);

            if (searchResults.length === 0) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `"${query}"에 대한 코드 샘플을 찾을 수 없습니다.\n\n다른 키워드로 검색해보세요.`,
                        },
                    ],
                };
            }

            // 2. 각 문서에서 코드 블록 추출
            const codeBlocks: Array<{
                doc: any;
                block: any;
                relevance: number;
            }> = [];

            for (const doc of searchResults.slice(0, 10)) {
                let blocks = language
                    ? MarkdownParser.extractCodeBlocksByLanguage(doc.content, language)
                    : MarkdownParser.extractCodeBlocks(doc.content);

                // 주제와 관련성 계산
                blocks.forEach(block => {
                    const blockText = block.code.toLowerCase();
                    const queryLower = query.toLowerCase();
                    let relevance = 0;

                    // 코드 내용에 주제 키워드가 포함되어 있는지
                    if (blockText.includes(queryLower)) {
                        relevance += 10;
                    }

                    // 언어 매칭 (언어가 지정된 경우)
                    if (language && block.language) {
                        const blockLang = block.language.toLowerCase();
                        const targetLang = language.toLowerCase();
                        if (blockLang === targetLang || blockLang.includes(targetLang) || targetLang.includes(blockLang)) {
                            relevance += 5;
                        }
                    }

                    // API 관련 키워드 체크
                    const apiKeywords = ['nicepay', 'api', 'request', 'pay', 'payment', 'curl', 'fetch', 'axios', 'http'];
                    if (apiKeywords.some(keyword => blockText.includes(keyword))) {
                        relevance += 3;
                    }

                    if (relevance > 0 || blocks.length === 1) {
                        codeBlocks.push({
                            doc,
                            block,
                            relevance,
                        });
                    }
                });
            }

            // 관련성 순으로 정렬
            codeBlocks.sort((a, b) => b.relevance - a.relevance);

            if (codeBlocks.length === 0) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `"${query}"${language ? ` (${language})` : ''}에 대한 코드 샘플을 찾을 수 없습니다.\n\n다른 키워드나 언어로 검색해보세요.`,
                        },
                    ],
                };
            }

            // 3. 결과 포맷팅
            let resultText = `## "${query}" 코드 샘플${language ? ` (${language})` : ''}\n\n`;
            resultText += `총 ${codeBlocks.length}개의 코드 샘플을 찾았습니다.\n\n`;
            resultText += `---\n\n`;

            // 최대 5개만 표시
            const limitedBlocks = codeBlocks.slice(0, 5);

            limitedBlocks.forEach((item, index) => {
                resultText += `### ${index + 1}. ${item.doc.title}\n\n`;
                resultText += `📄 출처: ${item.doc.filePath}\n\n`;

                if (item.block.language) {
                    resultText += `**언어:** ${item.block.language}\n\n`;
                }

                resultText += `\`\`\`${item.block.language || ''}\n${item.block.code}\n\`\`\`\n\n`;

                // 코드 블록 근처의 설명 찾기 (섹션 내용에서)
                const section = item.doc.sections.find((s: any) => {
                    const sectionContent = s.content.toLowerCase();
                    return sectionContent.includes(item.block.code.substring(0, 50).toLowerCase());
                });

                if (section) {
                    const description = section.content.substring(0, 200).trim();
                    if (description && !description.toLowerCase().includes(item.block.code.substring(0, 30).toLowerCase())) {
                        resultText += `**설명:** ${description}...\n\n`;
                    }
                }

                resultText += `---\n\n`;
            });

            if (codeBlocks.length > 5) {
                resultText += `\n*총 ${codeBlocks.length}개 중 상위 5개만 표시됩니다.*\n`;
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: resultText,
                    },
                ],
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`코드 샘플 조회 오류 (topic: ${topic}):`, errorMessage);
            return {
                content: [
                    {
                        type: 'text',
                        text: `코드 샘플 조회 중 오류가 발생했습니다. 다시 시도해주세요.`,
                    },
                ],
                isError: true,
            };
        }
    }

    private async getSDKMethod(methodName: string) {
        if (!methodName || methodName.trim().length === 0) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'SDK 메서드 이름을 입력해주세요.',
                    },
                ],
                isError: true,
            };
        }

        try {
            const query = methodName.trim().toLowerCase();

            // 1. AUTHNICE. 접두사 제거 (있을 경우)
            const cleanMethodName = query.replace(/^authnice\.?/, '').replace(/^\./, '');

            // 2. 메서드 이름으로 문서 검색
            const searchQueries = [
                `AUTHNICE.${cleanMethodName}`,
                cleanMethodName,
                query.includes('request') ? '결제창' : '',
                query.includes('cancel') ? '취소' : '',
            ].filter(q => q.length > 0);

            let searchResults: any[] = [];
            for (const searchQuery of searchQueries) {
                const results = this.docIndexer.searchDocuments(searchQuery);
                searchResults = [...searchResults, ...results];
            }

            // 중복 제거
            const uniqueResults = Array.from(
                new Map(searchResults.map(doc => [doc.filePath, doc])).values()
            );

            if (uniqueResults.length === 0) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `"${methodName}"에 대한 SDK 메서드 정보를 찾을 수 없습니다.\n\n다른 키워드로 검색해보세요. (예: "requestPay", "cancelPay" 등)`,
                        },
                    ],
                };
            }

            // 3. 각 문서에서 메서드 관련 정보 추출
            const methodInfo: Array<{
                doc: any;
                sections: any[];
                codeBlocks: any[];
                description: string;
                relevance: number;
            }> = [];

            for (const doc of uniqueResults.slice(0, 10)) {
                const contentLower = doc.content.toLowerCase();
                const methodPattern = new RegExp(`authnice\\.${cleanMethodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${cleanMethodName}`, 'i');

                if (!methodPattern.test(contentLower)) {
                    continue;
                }

                // 관련 섹션 찾기
                const relevantSections = doc.sections.filter((s: any) => {
                    const sectionContent = s.content.toLowerCase();
                    return sectionContent.includes(cleanMethodName) ||
                        sectionContent.includes('authnice') ||
                        sectionContent.includes('js sdk') ||
                        sectionContent.includes('결제창');
                });

                // JavaScript 코드 블록 찾기
                const jsBlocks = MarkdownParser.extractCodeBlocksByLanguage(doc.content, 'javascript')
                    .concat(MarkdownParser.extractCodeBlocksByLanguage(doc.content, 'html'))
                    .filter(block => {
                        const code = block.code.toLowerCase();
                        return code.includes(cleanMethodName) || code.includes('authnice');
                    });

                // 설명 추출
                let description = '';
                for (const section of relevantSections.slice(0, 3)) {
                    const sectionText = section.content;
                    if (sectionText.length > 100) {
                        description = sectionText.substring(0, 500).trim();
                        break;
                    }
                    description += sectionText + ' ';
                }

                // 관련성 계산
                let relevance = 0;
                if (contentLower.includes(`authnice.${cleanMethodName}`)) {
                    relevance += 20;
                }
                if (contentLower.includes(cleanMethodName)) {
                    relevance += 10;
                }
                if (jsBlocks.length > 0) {
                    relevance += 5;
                }
                if (relevantSections.length > 0) {
                    relevance += relevantSections.length;
                }

                if (relevance > 0) {
                    methodInfo.push({
                        doc,
                        sections: relevantSections,
                        codeBlocks: jsBlocks,
                        description,
                        relevance,
                    });
                }
            }

            // 관련성 순으로 정렬
            methodInfo.sort((a, b) => b.relevance - a.relevance);

            if (methodInfo.length === 0) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `"${methodName}"에 대한 SDK 메서드 정보를 찾을 수 없습니다.\n\n다른 키워드로 검색해보세요.`,
                        },
                    ],
                };
            }

            // 4. 결과 포맷팅
            const topResult = methodInfo[0];
            let resultText = `## AUTHNICE.${cleanMethodName}() 메서드 정보\n\n`;

            if (topResult.description) {
                resultText += `### 설명\n\n${topResult.description.substring(0, 1000)}${topResult.description.length > 1000 ? '...' : ''}\n\n`;
                resultText += `---\n\n`;
            }

            // 코드 예시
            if (topResult.codeBlocks.length > 0) {
                resultText += `### 코드 예시\n\n`;
                topResult.codeBlocks.slice(0, 3).forEach((block, index) => {
                    resultText += `#### 예시 ${index + 1}\n\n`;
                    resultText += `\`\`\`${block.language || 'javascript'}\n${block.code}\n\`\`\`\n\n`;
                });
                resultText += `---\n\n`;
            }

            // 파라미터 정보 찾기 (표에서 추출)
            const paramTables = MarkdownParser.extractTables(topResult.doc.content);
            const paramTable = paramTables.find(table => {
                const headers = table.headers.map((h: string) => h.toLowerCase());
                return headers.some(h =>
                    h.includes('parameter') ||
                    h.includes('파라미터') ||
                    h.includes('parameter') ||
                    (h.includes('필수') || h.includes('type'))
                );
            });

            if (paramTable) {
                resultText += `### 파라미터\n\n`;
                resultText += `| ${paramTable.headers.join(' | ')} |\n`;
                resultText += `|${paramTable.headers.map(() => '---').join('|')}|\n`;
                paramTable.rows.slice(0, 20).forEach(row => {
                    const cells = row.cells.map(c => c.content);
                    resultText += `| ${cells.join(' | ')} |\n`;
                });
                resultText += `\n---\n\n`;
            }

            // 관련 섹션 정보
            if (topResult.sections.length > 0) {
                resultText += `### 주요 섹션\n\n`;
                topResult.sections.slice(0, 5).forEach((section: any) => {
                    resultText += `- **${section.title}**\n`;
                });
                resultText += `\n---\n\n`;
            }

            // 추가 문서 링크
            if (methodInfo.length > 1) {
                resultText += `### 관련 문서\n\n`;
                methodInfo.slice(1, 4).forEach((info, index) => {
                    resultText += `${index + 2}. ${info.doc.title} (${info.doc.filePath})\n`;
                });
                resultText += `\n---\n\n`;
            }

            resultText += `📄 출처: ${topResult.doc.filePath}\n`;

            return {
                content: [
                    {
                        type: 'text',
                        text: resultText,
                    },
                ],
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`SDK 메서드 조회 오류 (method: ${methodName}):`, errorMessage);
            return {
                content: [
                    {
                        type: 'text',
                        text: `SDK 메서드 조회 중 오류가 발생했습니다. 다시 시도해주세요.`,
                    },
                ],
                isError: true,
            };
        }
    }

    async run() {
        try {
            const transport = new StdioServerTransport();
            await this.server.connect(transport);
            logger.info('NicePay MCP Server가 시작되었습니다.');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('서버 시작 실패:', errorMessage, error);
            process.exit(1);
        }
    }
}

// 서버 실행
const server = new NicePayMCPServer();
server.run().catch((error) => {
    logger.error('서버 실행 중 치명적 오류:', error instanceof Error ? error.message : String(error));
    process.exit(1);
});
