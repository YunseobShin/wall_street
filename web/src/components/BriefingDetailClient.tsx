"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getMockBriefings } from "@/lib/mock";
import { getBriefingById, loadBriefings, upsertBriefing } from "@/lib/storage";
import type { Briefing, DispatchChannel, DispatchResult } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

function nowIso() {
  return new Date().toISOString();
}

function makeDispatch(channel: DispatchChannel, briefingId: string): DispatchResult {
  const id = `dsp_${Date.now()}_${channel}`;
  return {
    id,
    briefingId,
    channel,
    status: "SENT",
    sentAt: nowIso(),
    message:
      channel === "email"
        ? "이메일 발송 완료(목업) — 실제 연동 전"
        : "슬랙 발송 완료(목업) — 실제 연동 전",
  };
}

export function BriefingDetailClient({ id }: { id: string }) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [dispatches, setDispatches] = useState<DispatchResult[]>([]);
  const [sending, setSending] = useState<DispatchChannel | null>(null);

  const fallback = useMemo(() => getMockBriefings()[0], []);

  useEffect(() => {
    const found = getBriefingById(id);
    if (found) {
      setBriefing(found);
      return;
    }
    // 로컬스토리지에 없으면 목업 초기 데이터로부터 유추(최초 방문 대비)
    const items = loadBriefings();
    const fromList = items.find((b) => b.id === id) ?? null;
    setBriefing(fromList ?? fallback);
  }, [id, fallback]);

  async function onSend(channel: DispatchChannel) {
    if (!briefing) return;
    setSending(channel);
    try {
      await new Promise((r) => setTimeout(r, 500));
      const d = makeDispatch(channel, briefing.id);
      setDispatches((prev) => [d, ...prev]);
    } finally {
      setSending(null);
    }
  }

  async function onManualRegenerate() {
    if (!briefing) return;
    // “수동 생성 버튼” 요구사항: 상세에서도 즉시 재생성(목업) 가능하게
    const updated: Briefing = {
      ...briefing,
      title: briefing.title.replace("(수동 생성)", "").trim() + " (수동 재생성)",
      summaryText: briefing.summaryText + " (재생성됨)",
      createdAt: nowIso(),
    };
    upsertBriefing(updated);
    setBriefing(updated);
  }

  if (!briefing) return null;

  const isUp = briefing.criteriaLabel.includes("상승") || briefing.criteriaLabel.includes("급등");

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-sm text-white/70 hover:text-white">
              ← 대시보드
            </Link>
            <Badge tone="neutral">{briefing.date}</Badge>
            <Badge tone={isUp ? "up" : "down"}>TOP1: {briefing.top1Symbol}</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
            브리핑 상세
          </h1>
          <p className="mt-1 text-sm text-white/70">{briefing.title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={onManualRegenerate}>
            수동 브리핑 생성(재생성)
          </Button>
          <Button
            variant="primary"
            onClick={() => onSend("email")}
            disabled={sending !== null}
          >
            {sending === "email" ? "이메일 발송 중..." : "이메일 발송"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => onSend("slack")}
            disabled={sending !== null}
          >
            {sending === "slack" ? "슬랙 발송 중..." : "슬랙 발송"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title="브리핑 이미지 미리보기" subtitle="목업 SVG 이미지" />
          <div className="bg-black/20 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={briefing.imageDataUrl}
              alt="briefing preview"
              className="w-full rounded-2xl border border-white/10"
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="리포트 텍스트"
            subtitle={`선정 기준: ${briefing.criteriaLabel}`}
            right={<Badge tone="hot">아침용 요약</Badge>}
          />
          <CardBody>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-7 text-white/90">
              <div className="text-xs font-semibold text-white/60">한줄 요약</div>
              <div className="mt-1 font-semibold text-white">{briefing.summaryText}</div>
              <div className="mt-4 text-xs font-semibold text-white/60">상세</div>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-white/80">
                {briefing.reportText}
              </pre>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="발송 로그(목업)"
          subtitle="버튼 클릭 시 SENT 기록이 쌓입니다."
          right={<Badge tone="neutral">{dispatches.length}건</Badge>}
        />
        <CardBody>
          {dispatches.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              아직 발송 기록이 없습니다. 위 버튼으로 이메일/슬랙 발송을 눌러보세요.
            </div>
          ) : (
            <div className="grid gap-3">
              {dispatches.slice(0, 8).map((d) => (
                <div
                  key={d.id}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-bold">
                      {d.channel.toUpperCase()} • {d.status}
                    </div>
                    <Badge tone="neutral">{d.sentAt?.slice(11, 19)}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-white/70">{d.message}</div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}


