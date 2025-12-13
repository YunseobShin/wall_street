export type ScreenerSource = "most_actives" | "day_gainers" | "day_losers";

export type TrendingStock = {
  symbol: string;
  shortName: string;
  quoteType?: "EQUITY" | "ETF" | "CRYPTOCURRENCY" | string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  regularMarketVolume: number;
  sourceTags: ScreenerSource[];
  rank: Partial<Record<ScreenerSource, number>>;
  score: number;
  selectedReason?: string;
};

export type BriefingStatus = "QUEUED" | "READY" | "FAILED";

export type Briefing = {
  id: string;
  date: string; // YYYY-MM-DD (America/New_York 기준 “거래일”)
  title: string;
  status: BriefingStatus;
  top1Symbol: string;
  criteriaLabel: string; // 예: "거래량 1위 + 상승률 상위 중복"
  summaryText: string;
  reportText: string;
  imageDataUrl: string; // data:image/svg+xml;utf8,...
  createdAt: string; // ISO
};

export type DispatchChannel = "email" | "slack";

export type DispatchResult = {
  id: string;
  briefingId: string;
  channel: DispatchChannel;
  status: "QUEUED" | "SENT" | "FAILED";
  sentAt?: string;
  message?: string;
};


