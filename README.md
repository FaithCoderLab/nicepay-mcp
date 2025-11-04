# NicePay MCP Server

나이스페이 개발자 가이드를 위한 Model Context Protocol (MCP) 서버입니다.

이 MCP 서버는 Cursor IDE나 다른 MCP 호환 도구에서 나이스페이 API 문서를 쉽게 검색하고 조회할 수 있도록 해줍니다.

<a href="https://glama.ai/mcp/servers/@FaithCoderLab/nicepay-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@FaithCoderLab/nicepay-mcp/badge" alt="NicePay Server MCP server" />
</a>

> **참고**: 이 프로젝트는 [나이스페이먼츠 공식 매뉴얼 저장소](https://github.com/nicepayments/nicepay-manual)의 마크다운 문서를 기반으로 작동합니다.

## 기능

### 1. 문서 검색 (`search_nicepay_docs`)
키워드로 나이스페이 개발자 가이드 문서를 검색합니다.

**사용 예시:**
- "결제창"
- "취소"
- "웹훅"
- "API"

### 2. API 엔드포인트 조회 (`get_api_endpoint`)
특정 API 엔드포인트의 상세 정보를 조회합니다.

**조회 내용:**
- HTTP Method (GET, POST 등)
- 엔드포인트 URL
- 요청/응답 파라미터
- 샘플 코드

**사용 예시:**
- "결제 승인"
- "거래 조회"
- "취소"

### 3. 코드 샘플 조회 (`get_code_sample`)
주제와 언어에 맞는 코드 샘플을 제공합니다.

**사용 예시:**
- 주제: "결제창 호출", 언어: "javascript"
- 주제: "Basic 인증", 언어: "curl"
- 주제: "결제 승인"

### 4. JS SDK 메서드 조회 (`get_sdk_method`)
JS SDK 메서드의 사용법과 파라미터 정보를 제공합니다.

**사용 예시:**
- "requestPay"
- "cancelPay"
- "AUTHNICE.requestPay"

## 설치

### 요구사항
- Node.js 18 이상
- npm 또는 yarn

### 설치 방법

1. 프로젝트 디렉토리로 이동:
```bash
cd mcp-server
```

2. 의존성 설치:
```bash
npm install
```

3. 빌드:
```bash
npm run build
```

## 사용 방법

### Cursor IDE 설정

1. Cursor 설정 파일(`.cursorrules` 또는 MCP 설정)을 엽니다.

2. MCP 서버를 추가합니다:

```json
{
  "mcpServers": {
    "nicepay": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"]
    }
  }
}
```

**참고:** 위 경로는 실제 프로젝트 경로로 변경해야 합니다.

### 개발 모드 실행

개발 중에는 `tsx`를 사용하여 실행할 수 있습니다:

```bash
npm run dev
```

### 프로덕션 빌드

```bash
npm run build
npm start
```

## 프로젝트 구조

```
mcp-server/
├── src/
│   ├── index.ts                 # MCP 서버 진입점
│   └── utils/
│       ├── docIndexer.ts        # 문서 인덱싱 시스템
│       ├── markdownParser.ts    # 마크다운 파서
│       └── logger.ts           # 로깅 유틸리티
├── dist/                        # 빌드 결과물
├── package.json
├── tsconfig.json
└── README.md
```

## 문서 경로

서버는 다음 디렉토리의 마크다운 파일들을 자동으로 인덱싱합니다:

- `api/` - API 명세 문서
- `common/` - 공통 가이드 문서
- `management/` - 운영 관련 문서
- `migration/` - 마이그레이션 문서

이 문서들은 [나이스페이먼츠 공식 매뉴얼 저장소](https://github.com/nicepayments/nicepay-manual)에서 제공됩니다.

**문서 구조:**
서버는 프로젝트 루트의 상위 디렉토리(`../../`)에서 위 디렉토리들을 찾아 인덱싱합니다. 
공식 저장소를 클론한 경우, 이 MCP 서버를 해당 저장소의 하위 디렉토리로 배치하거나, 
`DOCS_BASE_PATH` 환경 변수로 문서 경로를 지정할 수 있습니다.

## 스크립트

- `npm run build` - TypeScript 컴파일
- `npm start` - 빌드된 파일 실행
- `npm run dev` - 개발 모드 실행 (tsx 사용)
- `npm run watch` - 파일 변경 감지하여 자동 빌드

## 로깅

서버는 `stderr`를 통해 로그를 출력합니다. 로그 레벨:

- `ERROR` - 오류 발생
- `WARN` - 경고 사항
- `INFO` - 정보성 메시지
- `DEBUG` - 디버그 정보

## 문제 해결

### 문서 인덱싱 실패
서버 시작 시 문서 인덱싱이 실패하면 로그를 확인하세요. 인덱싱이 실패해도 서버는 계속 실행되지만 검색 기능이 제한될 수 있습니다.

### MCP 연결 실패
- Node.js 버전이 18 이상인지 확인
- 빌드가 완료되었는지 확인 (`dist/index.js` 파일 존재 여부)
- 경로가 올바른지 확인

### 검색 결과가 없을 때
- 키워드를 변경하여 다시 시도
- 대소문자는 구분하지 않으므로 자유롭게 입력 가능

## 라이선스

MIT

## 기여

이슈나 개선 사항이 있으면 알려주세요!