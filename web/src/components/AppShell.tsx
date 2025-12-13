import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(80%_60%_at_20%_0%,rgba(163,255,18,0.22),transparent_60%),radial-gradient(70%_60%_at_90%_10%,rgba(255,43,214,0.18),transparent_55%),radial-gradient(60%_70%_at_70%_90%,rgba(25,183,255,0.16),transparent_60%),linear-gradient(180deg,#070912,rgba(7,9,18,0.96))] text-zinc-50">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/30 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <span className="text-lg font-black tracking-tight text-[color:var(--wyws-neon)]">
                WY
              </span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white">
                당신이 잠든 사이
              </div>
              <div className="text-xs text-white/70">
                While You Were Sleeping • US Stocks Daily
              </div>
            </div>
          </Link>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
              Next {process.env.NEXT_PUBLIC_NEXT_VERSION ?? "latest"}
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
              Tailwind v4
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {children}
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-10 pt-2 text-xs text-white/50 sm:px-6">
        목업 UI • 로컬 저장소 기반 • API 연동 전 단계
      </footer>
    </div>
  );
}


