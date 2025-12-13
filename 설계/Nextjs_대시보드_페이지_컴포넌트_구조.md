## Next.js + TailwindCSS 대시보드 — 페이지/컴포넌트 구조

### 라우트 구조 (App Router)

| Route | 파일 | 설명 |
|---|---|---|
| `/` | `web/src/app/page.tsx` | 메인 대시보드(클라이언트 컴포넌트 렌더) |
| `/briefings/[id]` | `web/src/app/briefings/[id]/page.tsx` | 브리핑 상세(이미지/텍스트/발송 버튼) |

### 컴포넌트 구조

| 구분 | 파일 | 역할 |
|---|---|---|
| Shell | `web/src/components/AppShell.tsx` | 공통 레이아웃(헤더/푸터/배경 그라데이션) |
| Page(Client) | `web/src/components/DashboardClient.tsx` | 대시보드 UI + 수동 생성(로컬 저장) |
| Page(Client) | `web/src/components/BriefingDetailClient.tsx` | 상세 UI + 재생성/발송(목업) |
| UI | `web/src/components/ui/*` | Button/Card/Badge 등 카드 기반 UI 프리미티브 |

### 목업 데이터/상태

| 구분 | 파일 | 역할 |
|---|---|---|
| types | `web/src/lib/types.ts` | Trending/Briefing 타입 정의 |
| mock | `web/src/lib/mock.ts` | 화제 종목/브리핑 목업 + SVG 이미지 dataURL 생성 |
| storage | `web/src/lib/storage.ts` | 로컬스토리지 기반 briefings 저장/조회(upsert 포함) |

### “수동 브리핑 생성 버튼” 동작

- 대시보드 상단 `수동 브리핑 생성` 클릭 → `makeNewMockBriefing()` 생성 → `upsertBriefing()`로 로컬 저장 → 히스토리 UI 즉시 갱신
- 상세 페이지에서는 `수동 브리핑 생성(재생성)` 버튼으로 현재 브리핑을 업데이트(upsert)


