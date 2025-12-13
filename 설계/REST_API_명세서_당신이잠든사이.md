## REST API 명세서 — 당신이 잠든 사이 (While You Were Sleeping)

- **목표**: “화제 종목 선정 → 종목 정보/뉴스 수집 → 브리핑(텍스트+이미지) 생성 → 이메일/슬랙 발송 → 히스토리 조회”를 REST API로 제공
- **Base URL**: `/api/v1`
- **Content-Type**: `application/json; charset=utf-8`
- **인증(권장)**: `Authorization: Bearer <JWT>` (MVP에서 생략 가능)
- **시간 기준**: 기본 `America/New_York`(거래일 판단) + 사용자 브리핑 표시는 `Asia/Seoul`

---

## 공통 규칙

### 공통 Response Envelope (권장)

성공/실패 모두 일관된 형태를 사용한다.

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "req_01J...",
    "generatedAt": "2025-12-13T00:58:50Z"
  }
}
```

### 공통 에러 포맷

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameter: date",
    "details": {
      "field": "date",
      "reason": "must be YYYY-MM-DD"
    }
  },
  "meta": {
    "requestId": "req_01J..."
  }
}
```

### 공통 에러 코드(예시)

| HTTP | code | 의미 |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | 요청 파라미터/바디 검증 실패 |
| 401 | `UNAUTHORIZED` | 인증 실패 |
| 403 | `FORBIDDEN` | 권한 없음 |
| 404 | `NOT_FOUND` | 리소스 없음 |
| 409 | `CONFLICT` | 중복 생성/상태 충돌 |
| 429 | `RATE_LIMITED` | 호출 제한 |
| 502 | `UPSTREAM_ERROR` | Yahoo/외부 소스 오류 |
| 503 | `SERVICE_UNAVAILABLE` | 생성/발송 워커 장애 등 |

---

## 1) 화제 종목 조회 API (Yahoo Finance Screener 활용)

### API

| 항목 | 내용 |
|---|---|
| **HTTP Method** | `GET` |
| **Endpoint** | `/api/v1/trending-stocks` |
| **Query** | `date`(옵션, `YYYY-MM-DD`), `market`(옵션, 기본 `US`), `limit`(옵션, 기본 10, 최대 50), `include`(옵션: `most_actives,day_gainers,day_losers`) |

### Request 예시

`GET /api/v1/trending-stocks?date=2025-12-12&limit=10&include=most_actives,day_gainers,day_losers`

### Response 예시(200)

```json
{
  "success": true,
  "data": {
    "date": "2025-12-12",
    "timezone": "America/New_York",
    "criteria": {
      "sources": ["most_actives", "day_gainers", "day_losers"],
      "limitPerSource": 10,
      "dedupeBy": "symbol"
    },
    "items": [
      {
        "symbol": "TSLA",
        "shortName": "Tesla, Inc.",
        "quoteType": "EQUITY",
        "regularMarketPrice": 248.12,
        "regularMarketChangePercent": 8.34,
        "regularMarketVolume": 195004321,
        "sourceTags": ["most_actives", "day_gainers"],
        "rank": { "most_actives": 2, "day_gainers": 5 },
        "score": 0.83
      }
    ],
    "top1": {
      "symbol": "TSLA",
      "score": 0.83,
      "selectedReason": "High volume + top gainer overlap"
    }
  },
  "meta": { "requestId": "req_01J..." }
}
```

### 에러 케이스

| HTTP | code | 상황 |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | `date` 포맷 오류/`limit` 범위 초과 |
| 502 | `UPSTREAM_ERROR` | Yahoo Screener 응답 오류/스키마 변경 |
| 503 | `SERVICE_UNAVAILABLE` | 내부 캐시/워커 장애로 결과 생성 불가 |

---

## 2) 종목 상세 정보 API

### API

| 항목 | 내용 |
|---|---|
| **HTTP Method** | `GET` |
| **Endpoint** | `/api/v1/stocks/{symbol}` |
| **Path** | `symbol`(필수, 예: `TSLA`) |
| **Query** | `fields`(옵션: `quote,profile,stats,news`, 기본 `quote,news`), `newsLimit`(옵션, 기본 3, 최대 10), `lang`(옵션, 기본 `ko`) |

### Response 예시(200)

```json
{
  "success": true,
  "data": {
    "symbol": "TSLA",
    "quote": {
      "shortName": "Tesla, Inc.",
      "currency": "USD",
      "exchange": "NMS",
      "regularMarketPrice": 248.12,
      "regularMarketChange": 19.10,
      "regularMarketChangePercent": 8.34,
      "regularMarketVolume": 195004321,
      "marketState": "REGULAR"
    },
    "profile": {
      "sector": "Consumer Cyclical",
      "industry": "Auto Manufacturers",
      "marketCap": 789000000000
    },
    "news": [
      {
        "id": "news_123",
        "title": "Tesla surges after delivery outlook",
        "publisher": "Reuters",
        "publishedAt": "2025-12-12T21:10:00Z",
        "url": "https://example.com/news/123",
        "summaryKo": "테슬라가 인도 전망 상향 소식으로 급등했습니다."
      }
    ]
  },
  "meta": { "requestId": "req_01J..." }
}
```

### 에러 케이스

| HTTP | code | 상황 |
|---:|---|---|
| 404 | `NOT_FOUND` | `symbol`이 유효하지 않음/조회 불가 |
| 502 | `UPSTREAM_ERROR` | 외부 시세/뉴스 소스 장애 |

---

## 3) 브리핑 생성 API (이미지 + 텍스트)

브리핑은 “선정된 화제 종목들”로 구성되며, 생성은 비동기(권장)로 처리한다.

### 3-1. 브리핑 생성 요청 (비동기)

| 항목 | 내용 |
|---|---|
| **HTTP Method** | `POST` |
| **Endpoint** | `/api/v1/briefings` |
| **Request Body** | 아래 참고 |

#### Request Body 예시

```json
{
  "date": "2025-12-12",
  "market": "US",
  "symbols": ["TSLA", "NVDA", "AAPL"],
  "template": "daily_v1",
  "language": "ko",
  "channels": {
    "email": { "enabled": false },
    "slack": { "enabled": false }
  }
}
```

#### Response 예시(202)

```json
{
  "success": true,
  "data": {
    "briefingId": "brf_01J...",
    "status": "QUEUED",
    "date": "2025-12-12",
    "estimatedReadyInSec": 30
  },
  "meta": { "requestId": "req_01J..." }
}
```

#### 에러 케이스

| HTTP | code | 상황 |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | symbols 비어있음/최대 개수 초과 |
| 409 | `CONFLICT` | 동일 date+template 브리핑이 이미 존재(멱등키 권장) |
| 503 | `SERVICE_UNAVAILABLE` | 생성 워커/큐 장애 |

### 3-2. 브리핑 조회(생성 결과 확인)

| 항목 | 내용 |
|---|---|
| **HTTP Method** | `GET` |
| **Endpoint** | `/api/v1/briefings/{briefingId}` |

#### Response 예시(200)

```json
{
  "success": true,
  "data": {
    "briefingId": "brf_01J...",
    "status": "READY",
    "date": "2025-12-12",
    "title": "당신이 잠든 사이 — 12/12 미국주식 브리핑",
    "summaryText": "오늘은 TSLA 급등과 반도체 변동성이 두드러졌습니다.",
    "items": [
      {
        "symbol": "TSLA",
        "headlineKo": "테슬라 급등: 인도 전망 상향",
        "keyPointsKo": ["거래량 급증", "상승률 상위", "뉴스: 인도 전망"],
        "sourceTags": ["most_actives", "day_gainers"]
      }
    ],
    "assets": {
      "image": {
        "contentType": "image/png",
        "url": "https://cdn.example.com/briefings/brf_01J/briefing.png",
        "width": 1080,
        "height": 1350
      }
    },
    "createdAt": "2025-12-13T00:58:00Z"
  },
  "meta": { "requestId": "req_01J..." }
}
```

---

## 4) 발송 API (이메일/슬랙)

발송은 “브리핑 ID”를 기반으로 수행한다. 발송도 비동기(권장)로 처리한다.

### 4-1. 발송 요청

| 항목 | 내용 |
|---|---|
| **HTTP Method** | `POST` |
| **Endpoint** | `/api/v1/dispatches` |
| **Request Body** | 아래 참고 |

#### Request Body 예시

```json
{
  "briefingId": "brf_01J...",
  "channels": {
    "email": {
      "to": ["user@example.com"],
      "subject": "[당신이 잠든 사이] 12/12 미국주식 브리핑",
      "from": "noreply@whileyouwere.sleeping"
    },
    "slack": {
      "workspaceId": "T123",
      "channelId": "C123",
      "webhookUrl": "https://hooks.slack.com/services/XXX/YYY/ZZZ"
    }
  }
}
```

#### Response 예시(202)

```json
{
  "success": true,
  "data": {
    "dispatchId": "dsp_01J...",
    "status": "QUEUED",
    "briefingId": "brf_01J..."
  },
  "meta": { "requestId": "req_01J..." }
}
```

### 4-2. 발송 상태 조회

| 항목 | 내용 |
|---|---|
| **HTTP Method** | `GET` |
| **Endpoint** | `/api/v1/dispatches/{dispatchId}` |

#### Response 예시(200)

```json
{
  "success": true,
  "data": {
    "dispatchId": "dsp_01J...",
    "briefingId": "brf_01J...",
    "status": "SENT",
    "results": {
      "email": { "status": "SENT", "messageId": "msg_123" },
      "slack": { "status": "SENT", "ts": "1734048000.000100" }
    },
    "sentAt": "2025-12-13T00:59:10Z"
  },
  "meta": { "requestId": "req_01J..." }
}
```

### 에러 케이스

| HTTP | code | 상황 |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | 채널 파라미터 누락/이메일 주소 형식 오류 |
| 404 | `NOT_FOUND` | `briefingId`가 존재하지 않음 |
| 409 | `CONFLICT` | 이미 발송 완료된 브리핑 재발송(정책에 따라 허용/차단) |
| 502 | `UPSTREAM_ERROR` | 이메일(SMTP/ESP) 또는 Slack webhook 오류 |

---

## 5) 브리핑 히스토리 조회 API

### API

| 항목 | 내용 |
|---|---|
| **HTTP Method** | `GET` |
| **Endpoint** | `/api/v1/briefings` |
| **Query** | `from`(옵션, `YYYY-MM-DD`), `to`(옵션), `status`(옵션: `QUEUED,READY,FAILED`), `cursor`(옵션), `limit`(옵션, 기본 20, 최대 100) |

### Response 예시(200)

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "briefingId": "brf_01J...",
        "date": "2025-12-12",
        "status": "READY",
        "title": "당신이 잠든 사이 — 12/12 미국주식 브리핑",
        "createdAt": "2025-12-13T00:58:00Z"
      }
    ],
    "page": {
      "nextCursor": "cur_01J...",
      "limit": 20
    }
  },
  "meta": { "requestId": "req_01J..." }
}
```

### 에러 케이스

| HTTP | code | 상황 |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | from/to 역전, 날짜 포맷 오류 |
| 401 | `UNAUTHORIZED` | 인증 필요(사용자별 히스토리 제공 시) |

---

## (권장) 멱등성/재현성 설계 메모

- **브리핑 생성**: `Idempotency-Key` 헤더(예: `date+template+market` 해시)로 중복 생성 방지
- **선정 근거 저장**: trending 결과의 `rank/score/sourceTags`를 briefing 메타로 저장해 “왜 화제인가” 설명과 디버깅에 재사용
- **폴백**: 외부 소스 오류 시 전일(최근 거래일) 캐시 제공 + 상태/근거 명시


