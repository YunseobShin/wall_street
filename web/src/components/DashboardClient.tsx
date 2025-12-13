"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getMockTrending, makeNewMockBriefing } from "@/lib/mock";
import { loadBriefings, upsertBriefing } from "@/lib/storage";
import type { Briefing } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

function formatPct(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function formatInt(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

export function DashboardClient() {
  const trending = useMemo(() => getMockTrending(), []);
  const [briefings, setBriefings] = useState<Briefing[]>(() => loadBriefings());
  const [creating, setCreating] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const top = trending.top1;
  const isUp = top.regularMarketChangePercent >= 0;

  async function onManualCreate() {
    setCreating(true);
    try {
      // UX용 지연(“생성 중” 느낌)
      await new Promise((r) => setTimeout(r, 550));
      const b = makeNewMockBriefing({
        top1Symbol: top.symbol,
        criteriaLabel: top.selectedReason ?? "거래량/변동률 가중치 TOP",
      });
      const next = upsertBriefing(b);
      setBriefings(next);
      setFlash(`브리핑 생성 완료: ${b.date} (${b.top1Symbol})`);
      window.setTimeout(() => setFlash(null), 2200);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            메인 대시보드
          </h1>
          <p className="mt-1 text-sm text-white/70">
            오늘 아침, 가장 뜨거운 미국주식만 딱 집어드립니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={onManualCreate} disabled={creating}>
            {creating ? "브리핑 생성 중..." : "수동 브리핑 생성"}
          </Button>
          <Link href={`/briefings/${briefings[0]?.id ?? "brf_mock_today"}`}>
            <Button variant="secondary">최근 브리핑 보기</Button>
          </Link>
        </div>
      </div>

      {flash ? (
        <div className="rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-white">
          <span className="font-semibold text-[color:var(--wyws-neon)]">
            완료
          </span>{" "}
          · {flash}
        </div>
      ) : null}

      {/* 오늘의 화제 종목 큰 카드 */}
      <Card className="overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 bg-[radial-gradient(80%_70%_at_20%_0%,rgba(163,255,18,0.28),transparent_55%),radial-gradient(70%_70%_at_90%_10%,rgba(255,43,214,0.22),transparent_50%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent)]" />
          <div className="relative px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="hot">오늘의 화제 종목</Badge>
                  <Badge tone={isUp ? "up" : "down"}>
                    {isUp ? "상승" : "하락"} {formatPct(top.regularMarketChangePercent)}
                  </Badge>
                  <Badge tone="neutral">거래량 {formatInt(top.regularMarketVolume)}</Badge>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-black tracking-tight sm:text-4xl">
                    {top.symbol}
                    <span className="ml-3 text-base font-semibold text-white/70">
                      {top.shortName}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-white/70">
                    선정 기준:{" "}
                    <span className="font-semibold text-white">
                      {top.selectedReason ?? "거래량/상승률 스크리너 합산 TOP"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full max-w-sm rounded-2xl border border-white/12 bg-black/20 px-4 py-4">
                <div className="text-xs text-white/60">오늘의 숫자</div>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs text-white/60">가격</div>
                    <div className="text-lg font-extrabold">
                      ${top.regularMarketPrice.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-white/60">스코어</div>
                    <div className="text-lg font-extrabold">{top.score.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/60">태그</div>
                    <div className="text-lg font-extrabold">{top.sourceTags.length}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-white/60">
                  tags:{" "}
                  <span className="text-white/80">
                    {top.sourceTags.join(", ")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 최근 브리핑 히스토리 */}
      <Card>
        <CardHeader
          title="최근 브리핑 히스토리"
          subtitle="클릭하면 브리핑 상세로 이동합니다."
          right={<Badge tone="neutral">{briefings.length}개</Badge>}
        />
        <CardBody>
          <div className="grid gap-3">
            {briefings.slice(0, 6).map((b) => (
              <Link
                key={b.id}
                href={`/briefings/${b.id}`}
                className="group rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition hover:bg-white/8"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-white group-hover:text-[color:var(--wyws-neon)]">
                      {b.title}
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      {b.date} • TOP1: {b.top1Symbol} • {b.criteriaLabel}
                    </div>
                  </div>
                  <Badge tone={b.status === "READY" ? "up" : "neutral"}>
                    {b.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}


