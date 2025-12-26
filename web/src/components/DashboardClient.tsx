"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMockTrending } from "@/lib/mock";
import { loadBriefings, saveBriefings } from "@/lib/storage";
import { fetchTrendingStocks, createBriefing, fetchBriefing, type TrendingResult } from "@/lib/api";
import type { Briefing, TrendingStock } from "@/lib/types";
import { Badge, PriceBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/Card";
import { SubscribeForm } from "@/components/SubscribeForm";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

function formatPrice(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function TrendingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23,6 13.5,15.5 8.5,10.5 1,18" />
      <polyline points="17,6 23,6 23,12" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12,5 19,12 12,19" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function DashboardClient() {
  const [trendingData, setTrendingData] = useState<TrendingResult | null>(null);
  const [trendingError, setTrendingError] = useState<string | null>(null);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [mounted, setMounted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  // 클라이언트 마운트 후에만 localStorage에서 데이터 로드 (hydration 오류 방지)
  useEffect(() => {
    setBriefings(loadBriefings());
    setMounted(true);
  }, []);

  // 백엔드 API에서 화제 종목 데이터 가져오기
  useEffect(() => {
    async function loadTrending() {
      try {
        setTrendingLoading(true);
        setTrendingError(null);
        const data = await fetchTrendingStocks(10);
        setTrendingData(data);
      } catch (err) {
        console.error("Failed to fetch trending stocks:", err);
        setTrendingError(err instanceof Error ? err.message : "API 연결 실패");
        // 폴백: mock 데이터 사용
        const mockData = getMockTrending();
        setTrendingData({
          stocks: mockData.items,
          top1: mockData.top1,
          date: mockData.date,
          timezone: "America/New_York",
        });
      } finally {
        setTrendingLoading(false);
      }
    }
    loadTrending();
  }, []);

  // 로딩 중이거나 데이터가 없으면 로딩 표시
  if (trendingLoading || !trendingData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[color:var(--wyws-amber)] border-t-transparent" />
          <p className="mt-4 font-mono text-sm text-[color:var(--wyws-muted)]">
            화제 종목 로딩 중...
          </p>
        </div>
      </div>
    );
  }

  const top = trendingData.top1;
  const isUp = top.regularMarketChangePercent >= 0;

  async function onManualCreate() {
    setCreating(true);
    try {
      // 백엔드 API로 브리핑 생성
      const result = await createBriefing();

      // 생성된 브리핑 상세 조회
      const briefingDetail = await fetchBriefing(result.briefingId);

      // 프론트엔드 Briefing 타입으로 변환
      const newBriefing: Briefing = {
        id: briefingDetail.briefingId,
        date: briefingDetail.date,
        title: briefingDetail.title,
        status: briefingDetail.status as Briefing["status"],
        top1Symbol: briefingDetail.top1Symbol,
        criteriaLabel: briefingDetail.criteriaLabel,
        summaryText: briefingDetail.summaryText,
        reportText: briefingDetail.reportText,
        imageDataUrl: briefingDetail.assets.image.dataUrl,
        createdAt: briefingDetail.createdAt,
        meta: {
          tradingDate: briefingDetail.meta.tradingDate,
          dataAsOf: briefingDetail.meta.dataAsOf,
          timezone: briefingDetail.meta.timezone,
          usedCache: briefingDetail.meta.usedCache,
          sources: briefingDetail.meta.sources as Briefing["meta"]["sources"],
          citations: [],
          disclaimer: briefingDetail.meta.disclaimer,
        },
      };

      // localStorage에 저장 및 상태 업데이트
      const updatedBriefings = [newBriefing, ...briefings.filter(b => b.id !== newBriefing.id)];
      saveBriefings(updatedBriefings);
      setBriefings(updatedBriefings);

      setFlash(`브리핑 생성 완료: ${result.date} (${result.top1Symbol})`);
      window.setTimeout(() => setFlash(null), 3000);
    } catch (err) {
      console.error("Failed to create briefing:", err);
      setFlash(`브리핑 생성 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
      window.setTimeout(() => setFlash(null), 5000);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="stagger-children space-y-8">
      {/* ═══════════════════════════════════════════════════════════════════
          Header Section
          ═══════════════════════════════════════════════════════════════════ */}
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Badge tone={trendingError ? "neutral" : "amber"} pulse={!trendingError}>
              {trendingError ? "FALLBACK" : "LIVE"}
            </Badge>
            <span className="font-mono text-xs text-[color:var(--wyws-dim)]">
              {trendingError
                ? `Mock 데이터 사용 중 (${trendingError})`
                : `실시간 데이터 | ${trendingData.date}`}
            </span>
          </div>
          <h1 className="mt-3 font-display text-3xl text-[color:var(--wyws-cream)] sm:text-4xl">
            오늘의 화제 종목
          </h1>
          <p className="mt-2 font-mono text-sm text-[color:var(--wyws-muted)]">
            당신이 잠든 사이, 월스트리트에서 가장 뜨거웠던 종목
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={onManualCreate}
            loading={creating}
          >
            {creating ? "생성 중..." : "브리핑 생성"}
          </Button>
          {mounted && briefings.length > 0 ? (
            <Link href={`/briefings/${briefings[0].id}`}>
              <Button variant="outline">
                최근 브리핑
                <ArrowRightIcon />
              </Button>
            </Link>
          ) : (
            <Button variant="outline" disabled={!mounted}>
              {mounted ? "브리핑 없음" : "로딩..."}
            </Button>
          )}
        </div>
      </header>

      {/* Flash Message */}
      {flash && (
        <div className="animate-fade-in rounded-lg border border-[color:var(--wyws-border-amber)] bg-[color:var(--wyws-amber-soft)] px-4 py-3">
          <div className="flex items-center gap-3">
            <SparkleIcon />
            <span className="font-mono text-sm text-[color:var(--wyws-amber)]">
              {flash}
            </span>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          Hero Card - Top Trending Stock
          ═══════════════════════════════════════════════════════════════════ */}
      <Card variant="highlight" glow className="overflow-visible">
        {/* Decorative gradient overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background: isUp
              ? "radial-gradient(ellipse 60% 40% at 80% 20%, rgba(16, 185, 129, 0.15), transparent)"
              : "radial-gradient(ellipse 60% 40% at 80% 20%, rgba(244, 63, 94, 0.15), transparent)",
          }}
        />

        <div className="relative px-6 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            {/* Left: Stock Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="hot" pulse>
                  <TrendingIcon />
                  TOP 1
                </Badge>
                <PriceBadge value={top.regularMarketChangePercent} />
                <Badge tone="neutral">VOL {formatNumber(top.regularMarketVolume)}</Badge>
              </div>

              <div className="mt-5">
                <div className="flex items-baseline gap-4">
                  <span className="font-display text-4xl tracking-tight text-[color:var(--wyws-cream)] sm:text-5xl">
                    {top.symbol}
                  </span>
                  <span className="font-mono text-lg text-[color:var(--wyws-muted)]">
                    {top.shortName}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="font-mono text-xs uppercase tracking-wider text-[color:var(--wyws-dim)]">
                    선정 기준:
                  </span>
                  <span className="font-mono text-sm text-[color:var(--wyws-amber)]">
                    {top.selectedReason ?? "거래량/상승률 스크리너 합산 TOP"}
                  </span>
                </div>
              </div>

              {/* Source Tags */}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {top.sourceTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded border border-[color:var(--wyws-border)] bg-[color:var(--wyws-void)] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[color:var(--wyws-muted)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Stats Panel */}
            <div className="w-full max-w-sm shrink-0">
              <div className="rounded-lg border border-[color:var(--wyws-border)] bg-[color:var(--wyws-void)] p-4">
                <div className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--wyws-dim)]">
                  오늘의 숫자
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div>
                    <div className="font-mono text-[10px] text-[color:var(--wyws-dim)]">
                      가격
                    </div>
                    <div className="mt-1 font-display text-xl tabular-nums text-[color:var(--wyws-cream)]">
                      ${formatPrice(top.regularMarketPrice)}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] text-[color:var(--wyws-dim)]">
                      스코어
                    </div>
                    <div className="mt-1 font-display text-xl tabular-nums text-[color:var(--wyws-amber)]">
                      {top.score.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] text-[color:var(--wyws-dim)]">
                      태그
                    </div>
                    <div className="mt-1 font-display text-xl tabular-nums text-[color:var(--wyws-cream)]">
                      {top.sourceTags.length}
                    </div>
                  </div>
                </div>

                {/* Mini Progress Bar */}
                <div className="mt-4 pt-3 border-t border-[color:var(--wyws-border)]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-[color:var(--wyws-dim)]">
                      Score Confidence
                    </span>
                    <span className="font-mono text-[10px] text-[color:var(--wyws-amber)]">
                      {Math.min(100, Math.round(top.score * 20))}%
                    </span>
                  </div>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[color:var(--wyws-surface)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[color:var(--wyws-amber)] to-[color:var(--wyws-gold)]"
                      style={{ width: `${Math.min(100, top.score * 20)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════
          Stats Row
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Briefings"
          value={mounted ? briefings.length : "-"}
          suffix={mounted ? "개" : ""}
        />
        <StatCard
          label="Today's Volume"
          value={formatNumber(top.regularMarketVolume)}
        />
        <StatCard
          label="Market Price"
          value={formatPrice(top.regularMarketPrice)}
          prefix="$"
        />
        <StatCard
          label="Data Sources"
          value={top.sourceTags.length}
          suffix="개"
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          Subscribe + Briefing History (Two Column Layout)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Subscribe Form - Right Side (order first on mobile, last on desktop) */}
        <div className="lg:col-span-1 lg:order-last">
          <SubscribeForm />
        </div>

        {/* Briefing History - Left Side */}
        <div className="lg:col-span-2">
          <Card>
        <CardHeader
          title="브리핑 히스토리"
          subtitle="최근 생성된 브리핑 목록"
          icon={<HistoryIcon />}
          right={<Badge tone="neutral">{mounted ? `${briefings.length}건` : "-"}</Badge>}
        />
        <CardBody className="p-0">
          <div className="divide-y divide-[color:var(--wyws-border)]">
            {!mounted ? (
              <div className="px-5 py-8 text-center">
                <p className="font-mono text-sm text-[color:var(--wyws-muted)]">
                  로딩 중...
                </p>
              </div>
            ) : briefings.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="font-mono text-sm text-[color:var(--wyws-muted)]">
                  아직 생성된 브리핑이 없습니다
                </p>
                <p className="mt-1 font-mono text-xs text-[color:var(--wyws-dim)]">
                  상단의 "브리핑 생성" 버튼을 클릭하세요
                </p>
              </div>
            ) : (
              briefings.slice(0, 6).map((b, idx) => (
                <Link
                  key={b.id}
                  href={`/briefings/${b.id}`}
                  className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[color:var(--wyws-elevated)]"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Index Number */}
                    <span className="font-mono text-xs text-[color:var(--wyws-dim)] w-6">
                      {String(idx + 1).padStart(2, "0")}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-[color:var(--wyws-cream)] group-hover:text-[color:var(--wyws-amber)] transition-colors truncate">
                          {b.title}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 font-mono text-xs text-[color:var(--wyws-dim)]">
                        <span>{b.date}</span>
                        <span className="text-[color:var(--wyws-muted)]">•</span>
                        <span className="text-[color:var(--wyws-amber)]">{b.top1Symbol}</span>
                        <span className="text-[color:var(--wyws-muted)]">•</span>
                        <span className="truncate max-w-[150px]">{b.criteriaLabel}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={b.status as "READY" | "PENDING"} size="sm" />
                    <span className="text-[color:var(--wyws-dim)] opacity-0 transition-opacity group-hover:opacity-100">
                      <ArrowRightIcon />
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </CardBody>
      </Card>
        </div>
      </div>
    </div>
  );
}
