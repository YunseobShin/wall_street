import type { Briefing } from "@/lib/types";
import { getMockBriefings } from "@/lib/mock";

const KEY = "wyws:briefings:v1";

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadBriefings(): Briefing[] {
  if (typeof window === "undefined") return getMockBriefings();
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return getMockBriefings();
  const parsed = safeJsonParse<Briefing[]>(raw);
  if (!parsed || !Array.isArray(parsed)) return getMockBriefings();
  return parsed;
}

export function saveBriefings(items: Briefing[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
}

export function upsertBriefing(b: Briefing) {
  const items = loadBriefings();
  const next = [b, ...items.filter((x) => x.id !== b.id)];
  saveBriefings(next);
  return next;
}

export function getBriefingById(id: string): Briefing | null {
  const items = loadBriefings();
  return items.find((b) => b.id === id) ?? null;
}


