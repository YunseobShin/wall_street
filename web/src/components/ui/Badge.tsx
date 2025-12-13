type Tone = "neutral" | "up" | "down" | "hot";

const toneClass: Record<Tone, string> = {
  neutral: "bg-white/10 text-white/80 ring-1 ring-white/15",
  up: "bg-[color:rgba(34,197,94,0.18)] text-[color:rgb(134,239,172)] ring-1 ring-[color:rgba(34,197,94,0.35)]",
  down: "bg-[color:rgba(239,68,68,0.18)] text-[color:rgb(254,202,202)] ring-1 ring-[color:rgba(239,68,68,0.35)]",
  hot: "bg-[color:rgba(255,43,214,0.18)] text-[color:rgb(251,207,232)] ring-1 ring-[color:rgba(255,43,214,0.35)]",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass[tone]} ${className}`}
    >
      {children}
    </span>
  );
}


