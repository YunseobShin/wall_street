"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getMockBriefings } from "@/lib/mock";
import { getBriefingById, loadBriefings, upsertBriefing } from "@/lib/storage";
import { sendBriefingEmail } from "@/lib/api";
import type { Briefing, DispatchChannel, DispatchResult } from "@/lib/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function nowIso() {
  return new Date().toISOString();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function makeDispatch(
  channel: DispatchChannel,
  briefingId: string
): DispatchResult {
  const id = `dsp_${Date.now()}_${channel}`;
  return {
    id,
    briefingId,
    channel,
    status: "SENT",
    sentAt: nowIso(),
    message:
      channel === "email"
        ? "이메일 발송 완료 (목업)"
        : "슬랙 발송 완료 (목업)",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function ArrowLeftIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12,19 5,12 12,5" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22,7 L12,13 L2,7" />
    </svg>
  );
}

function SlackIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M14.5,10 C13.67,10 13,9.33 13,8.5 L13,3.5 C13,2.67 13.67,2 14.5,2 C15.33,2 16,2.67 16,3.5 L16,8.5 C16,9.33 15.33,10 14.5,10 Z" />
      <path d="M20.5,10 L19,10 L19,8.5 C19,7.67 19.67,7 20.5,7 C21.33,7 22,7.67 22,8.5 C22,9.33 21.33,10 20.5,10 Z" />
      <path d="M9.5,14 C10.33,14 11,14.67 11,15.5 L11,20.5 C11,21.33 10.33,22 9.5,22 C8.67,22 8,21.33 8,20.5 L8,15.5 C8,14.67 8.67,14 9.5,14 Z" />
      <path d="M3.5,14 L5,14 L5,15.5 C5,16.33 4.33,17 3.5,17 C2.67,17 2,16.33 2,15.5 C2,14.67 2.67,14 3.5,14 Z" />
      <path d="M14,14.5 C14,13.67 14.67,13 15.5,13 L20.5,13 C21.33,13 22,13.67 22,14.5 C22,15.33 21.33,16 20.5,16 L15.5,16 C14.67,16 14,15.33 14,14.5 Z" />
      <path d="M14,20.5 L14,19 L15.5,19 C16.33,19 17,19.67 17,20.5 C17,21.33 16.33,22 15.5,22 C14.67,22 14,21.33 14,20.5 Z" />
      <path d="M10,9.5 C10,10.33 9.33,11 8.5,11 L3.5,11 C2.67,11 2,10.33 2,9.5 C2,8.67 2.67,8 3.5,8 L8.5,8 C9.33,8 10,8.67 10,9.5 Z" />
      <path d="M10,3.5 L10,5 L8.5,5 C7.67,5 7,4.33 7,3.5 C7,2.67 7.67,2 8.5,2 C9.33,2 10,2.67 10,3.5 Z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10,9 9,9 8,9" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22,2 15,22 11,13 2,9" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function BriefingDetailClient({ id }: { id: string }) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [dispatches, setDispatches] = useState<DispatchResult[]>([]);
  const [sending, setSending] = useState<DispatchChannel | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const fallback = useMemo(() => getMockBriefings()[0], []);

  useEffect(() => {
    const found = getBriefingById(id);
    if (found) {
      setBriefing(found);
      return;
    }
    const items = loadBriefings();
    const fromList = items.find((b) => b.id === id) ?? null;
    setBriefing(fromList ?? fallback);
  }, [id, fallback]);

  async function onSend(channel: DispatchChannel) {
    if (!briefing) return;

    // 이메일인 경우 폼 표시
    if (channel === "email") {
      setShowEmailForm(true);
      return;
    }

    // 슬랙은 기존 목업 로직
    setSending(channel);
    try {
      await new Promise((r) => setTimeout(r, 600));
      const d = makeDispatch(channel, briefing.id);
      setDispatches((prev) => [d, ...prev]);
    } finally {
      setSending(null);
    }
  }

  async function onSendEmail() {
    if (!briefing || !email) return;

    // 이메일 유효성 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("올바른 이메일 주소를 입력하세요");
      return;
    }

    setEmailError("");
    setSending("email");
    try {
      const result = await sendBriefingEmail(briefing.id, email);
      const d: DispatchResult = {
        id: `dsp_${Date.now()}_email`,
        briefingId: briefing.id,
        channel: "email",
        status: "SENT",
        sentAt: result.sentAt,
        message: `${result.recipient}로 발송 완료`,
      };
      setDispatches((prev) => [d, ...prev]);
      setShowEmailForm(false);
      setEmail("");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "발송 실패";
      setEmailError(errMsg);
      const d: DispatchResult = {
        id: `dsp_${Date.now()}_email`,
        briefingId: briefing.id,
        channel: "email",
        status: "FAILED",
        sentAt: nowIso(),
        message: errMsg,
      };
      setDispatches((prev) => [d, ...prev]);
    } finally {
      setSending(null);
    }
  }

  async function onRegenerate() {
    if (!briefing) return;
    setRegenerating(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      const updated: Briefing = {
        ...briefing,
        title: briefing.title.replace("(수동 재생성)", "").trim() + " (수동 재생성)",
        summaryText: briefing.summaryText.replace("(재생성됨)", "").trim() + " (재생성됨)",
        createdAt: nowIso(),
      };
      upsertBriefing(updated);
      setBriefing(updated);
    } finally {
      setRegenerating(false);
    }
  }

  if (!briefing) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="font-mono text-sm text-[color:var(--wyws-muted)]">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="stagger-children space-y-8">
      {/* ═══════════════════════════════════════════════════════════════════
          Header
          ═══════════════════════════════════════════════════════════════════ */}
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {/* Breadcrumb */}
          <Link
            href="/"
            className="group inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[color:var(--wyws-muted)] transition-colors hover:text-[color:var(--wyws-amber)]"
          >
            <ArrowLeftIcon />
            <span>대시보드로 돌아가기</span>
          </Link>

          {/* Title Section */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Badge tone="neutral">{briefing.date}</Badge>
            <Badge tone="amber">{briefing.top1Symbol}</Badge>
            <StatusBadge status={briefing.status as "READY" | "PENDING"} />
          </div>

          <h1 className="mt-4 font-display text-2xl text-[color:var(--wyws-cream)] sm:text-3xl">
            브리핑 상세
          </h1>
          <p className="mt-2 font-mono text-sm text-[color:var(--wyws-muted)]">
            {briefing.title}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            onClick={onRegenerate}
            loading={regenerating}
          >
            <RefreshIcon />
            {regenerating ? "재생성 중..." : "재생성"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => onSend("slack")}
            loading={sending === "slack"}
            disabled={sending !== null}
          >
            <SlackIcon />
            {sending === "slack" ? "발송 중..." : "슬랙"}
          </Button>
          <Button
            variant="primary"
            onClick={() => onSend("email")}
            loading={sending === "email"}
            disabled={sending !== null && sending !== "email"}
          >
            <MailIcon />
            {sending === "email" ? "발송 중..." : "이메일"}
          </Button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          Email Form (표시 시)
          ═══════════════════════════════════════════════════════════════════ */}
      {showEmailForm && (
        <Card variant="elevated" className="border-[color:var(--wyws-amber)] bg-[color:var(--wyws-amber-soft)]">
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-[color:var(--wyws-cream)]">
                이메일로 브리핑 받기
              </h3>
              <button
                onClick={() => {
                  setShowEmailForm(false);
                  setEmail("");
                  setEmailError("");
                }}
                className="text-[color:var(--wyws-muted)] hover:text-[color:var(--wyws-cream)]"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }}
                placeholder="your@email.com"
                className="flex-1 rounded-lg border border-[color:var(--wyws-border)] bg-[color:var(--wyws-void)] px-4 py-3 font-mono text-sm text-[color:var(--wyws-cream)] placeholder:text-[color:var(--wyws-dim)] focus:border-[color:var(--wyws-amber)] focus:outline-none focus:ring-1 focus:ring-[color:var(--wyws-amber)]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSendEmail();
                }}
              />
              <Button
                variant="primary"
                onClick={onSendEmail}
                loading={sending === "email"}
                disabled={!email || sending === "email"}
              >
                <SendIcon />
                발송하기
              </Button>
            </div>

            {emailError && (
              <p className="font-mono text-xs text-[color:var(--wyws-down)]">
                {emailError}
              </p>
            )}

            <p className="font-mono text-xs text-[color:var(--wyws-dim)]">
              입력하신 이메일로 오늘의 브리핑이 발송됩니다.
            </p>
          </CardBody>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          Main Content Grid
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Image Preview */}
        <Card variant="elevated">
          <CardHeader
            title="브리핑 이미지"
            subtitle="미리보기 (목업 SVG)"
            icon={<ImageIcon />}
          />
          <div className="relative bg-[color:var(--wyws-void)] p-4">
            {/* Decorative grid */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                `,
                backgroundSize: "20px 20px",
              }}
            />

            <div className="relative overflow-hidden rounded-lg border border-[color:var(--wyws-border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={briefing.imageDataUrl}
                alt="브리핑 미리보기"
                className="w-full"
              />
            </div>

            {/* Image meta info */}
            <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-[color:var(--wyws-dim)]">
              <span>FORMAT: SVG</span>
              <span>SIZE: 800 × 600</span>
            </div>
          </div>
        </Card>

        {/* Right: Report Text */}
        <Card variant="elevated">
          <CardHeader
            title="리포트 텍스트"
            subtitle={`선정 기준: ${briefing.criteriaLabel}`}
            icon={<DocumentIcon />}
            right={<Badge tone="hot">요약</Badge>}
          />
          <CardBody className="space-y-4">
            {/* Summary */}
            <div className="rounded-lg border border-[color:var(--wyws-border-amber)] bg-[color:var(--wyws-amber-soft)] p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--wyws-amber)]">
                한줄 요약
              </div>
              <p className="mt-2 font-mono text-sm leading-relaxed text-[color:var(--wyws-cream)]">
                {briefing.summaryText}
              </p>
            </div>

            {/* Detailed Report */}
            <div className="rounded-lg border border-[color:var(--wyws-border)] bg-[color:var(--wyws-void)] p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--wyws-dim)]">
                상세 분석
              </div>
              <pre className="mt-3 whitespace-pre-wrap font-mono text-xs leading-relaxed text-[color:var(--wyws-muted)]">
                {briefing.reportText}
              </pre>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          Dispatch Log
          ═══════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader
          title="발송 로그"
          subtitle="이메일/슬랙 발송 기록"
          icon={<SendIcon />}
          right={<Badge tone="neutral">{dispatches.length}건</Badge>}
        />
        <CardBody className="p-0">
          {dispatches.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--wyws-surface)] text-[color:var(--wyws-dim)]">
                <SendIcon />
              </div>
              <p className="font-mono text-sm text-[color:var(--wyws-muted)]">
                아직 발송 기록이 없습니다
              </p>
              <p className="mt-1 font-mono text-xs text-[color:var(--wyws-dim)]">
                상단의 이메일 또는 슬랙 버튼을 클릭하세요
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[color:var(--wyws-border)]">
              {dispatches.slice(0, 10).map((d, idx) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="flex items-center gap-4">
                    {/* Channel Icon */}
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        d.channel === "email"
                          ? "bg-[color:var(--wyws-amber-soft)] text-[color:var(--wyws-amber)]"
                          : "bg-[rgba(59,130,246,0.12)] text-[#93c5fd]"
                      }`}
                    >
                      {d.channel === "email" ? <MailIcon /> : <SlackIcon />}
                    </div>

                    <div>
                      <div className="font-mono text-sm text-[color:var(--wyws-cream)]">
                        {d.channel.toUpperCase()} 발송
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-[color:var(--wyws-dim)]">
                        {d.message}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <StatusBadge
                      status={d.status as "SENT" | "FAILED"}
                      size="sm"
                    />
                    <span className="font-mono text-xs tabular-nums text-[color:var(--wyws-dim)]">
                      {d.sentAt ? formatTime(d.sentAt) : "-"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════
          Metadata Footer
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg border border-[color:var(--wyws-border)] bg-[color:var(--wyws-surface)] p-4">
        <div className="grid gap-4 font-mono text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-[color:var(--wyws-dim)]">ID:</span>
            <span className="ml-2 text-[color:var(--wyws-muted)]">
              {briefing.id}
            </span>
          </div>
          <div>
            <span className="text-[color:var(--wyws-dim)]">Created:</span>
            <span className="ml-2 text-[color:var(--wyws-muted)]">
              {new Date(briefing.createdAt).toLocaleString("ko-KR")}
            </span>
          </div>
          <div>
            <span className="text-[color:var(--wyws-dim)]">Criteria:</span>
            <span className="ml-2 text-[color:var(--wyws-amber)]">
              {briefing.criteriaLabel}
            </span>
          </div>
          <div>
            <span className="text-[color:var(--wyws-dim)]">Status:</span>
            <span className="ml-2 text-[color:var(--wyws-up)]">
              {briefing.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
