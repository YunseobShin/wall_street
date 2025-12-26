"use client";

import { useState } from "react";
import { subscribe } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";

// KST 시간 옵션 (06:00 ~ 10:00)
const TIME_OPTIONS = [
  { value: "06:00", label: "오전 6:00" },
  { value: "06:30", label: "오전 6:30" },
  { value: "07:00", label: "오전 7:00" },
  { value: "07:30", label: "오전 7:30" },
  { value: "08:00", label: "오전 8:00" },
  { value: "08:30", label: "오전 8:30" },
  { value: "09:00", label: "오전 9:00" },
];

function MailIcon() {
  return (
    <svg
      width="20"
      height="20"
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

function BellIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [time, setTime] = useState("07:00");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email) {
      setError("이메일을 입력하세요");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("올바른 이메일 주소를 입력하세요");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await subscribe(email, time);
      setSuccess(true);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "구독 실패");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <Card variant="elevated" className="border-[color:var(--wyws-up)]">
        <CardBody className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--wyws-up)]/20 text-[color:var(--wyws-up)]">
            <CheckIcon />
          </div>
          <div>
            <h3 className="font-display text-lg text-[color:var(--wyws-cream)]">
              구독 완료!
            </h3>
            <p className="mt-2 font-mono text-sm text-[color:var(--wyws-muted)]">
              매일 {TIME_OPTIONS.find((t) => t.value === time)?.label} (KST)에
              <br />
              브리핑을 보내드립니다.
            </p>
          </div>
          <Button variant="ghost" onClick={() => setSuccess(false)}>
            다른 이메일로 구독
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card variant="elevated">
      <CardBody className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--wyws-amber-soft)] text-[color:var(--wyws-amber)]">
            <BellIcon />
          </div>
          <div>
            <h3 className="font-display text-lg text-[color:var(--wyws-cream)]">
              매일 아침 브리핑 받기
            </h3>
            <p className="font-mono text-xs text-[color:var(--wyws-muted)]">
              어젯밤 미국 시장 소식을 이메일로
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div>
            <label className="mb-2 block font-mono text-xs text-[color:var(--wyws-dim)]">
              이메일 주소
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--wyws-dim)]">
                <MailIcon />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="your@email.com"
                className="w-full rounded-lg border border-[color:var(--wyws-border)] bg-[color:var(--wyws-void)] py-3 pl-11 pr-4 font-mono text-sm text-[color:var(--wyws-cream)] placeholder:text-[color:var(--wyws-dim)] focus:border-[color:var(--wyws-amber)] focus:outline-none focus:ring-1 focus:ring-[color:var(--wyws-amber)]"
              />
            </div>
          </div>

          {/* Time Select */}
          <div>
            <label className="mb-2 block font-mono text-xs text-[color:var(--wyws-dim)]">
              수신 시간 (KST)
            </label>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-lg border border-[color:var(--wyws-border)] bg-[color:var(--wyws-void)] px-4 py-3 font-mono text-sm text-[color:var(--wyws-cream)] focus:border-[color:var(--wyws-amber)] focus:outline-none focus:ring-1 focus:ring-[color:var(--wyws-amber)]"
            >
              {TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <p className="font-mono text-xs text-[color:var(--wyws-down)]">
              {error}
            </p>
          )}

          {/* Submit */}
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={loading}
          >
            <BellIcon />
            구독하기
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center font-mono text-[10px] text-[color:var(--wyws-dim)]">
          언제든 구독 취소 가능 · 스팸 없음
        </p>
      </CardBody>
    </Card>
  );
}
