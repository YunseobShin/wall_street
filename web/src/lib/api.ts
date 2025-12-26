import type { TrendingStock } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type TrendingResponse = {
  success: boolean;
  data: {
    date: string;
    timezone: string;
    criteria: {
      sources: string[];
      limitPerSource: number;
      dedupeBy: string;
    };
    items: Array<{
      symbol: string;
      shortName: string;
      quoteType: string;
      regularMarketPrice: number;
      regularMarketChange: number;
      regularMarketChangePercent: number;
      regularMarketVolume: number;
      marketCap: number | null;
      sourceTags: string[];
      rank: Record<string, number>;
      score: number;
    }>;
    top1: {
      symbol: string;
      score: number;
      selectedReason: string;
    } | null;
  };
  meta: {
    requestId: string;
    generatedAt: string;
  };
};

export type TrendingResult = {
  stocks: TrendingStock[];
  top1: TrendingStock;
  date: string;
  timezone: string;
};

/**
 * 백엔드 API에서 화제 종목 조회
 */
// ─────────────────────────────────────────────────────────────────────────────
// Briefing API Types
// ─────────────────────────────────────────────────────────────────────────────

export type BriefingApiResponse = {
  success: boolean;
  data: {
    briefingId: string;
    date: string;
    title: string;
    status: string;
    top1Symbol: string;
    criteriaLabel: string;
    summaryText: string;
    reportText: string;
    items: Array<{
      symbol: string;
      shortName: string;
      headlineKo: string;
      keyPointsKo: string[];
      sourceTags: string[];
      regularMarketPrice: number;
      regularMarketChangePercent: number;
    }>;
    assets: {
      image: {
        dataUrl: string;
        width: number;
        height: number;
      };
    };
    createdAt: string;
    meta: {
      tradingDate: string;
      dataAsOf: string;
      timezone: string;
      usedCache: boolean;
      sources: string[];
      disclaimer: string;
    };
  };
  meta: {
    requestId: string;
    generatedAt: string;
  };
};

export type CreateBriefingResponse = {
  success: boolean;
  data: {
    briefingId: string;
    status: string;
    date: string;
    title: string;
    top1Symbol: string;
  };
  meta: {
    requestId: string;
    generatedAt: string;
  };
};

/**
 * 백엔드 API에서 브리핑 생성
 */
export async function createBriefing(): Promise<CreateBriefingResponse["data"]> {
  const url = `${API_BASE_URL}/api/v1/briefings`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`);
  }

  const json: CreateBriefingResponse = await res.json();

  if (!json.success) {
    throw new Error("API returned unsuccessful response");
  }

  return json.data;
}

/**
 * 백엔드 API에서 브리핑 상세 조회
 */
export async function fetchBriefing(briefingId: string): Promise<BriefingApiResponse["data"]> {
  const url = `${API_BASE_URL}/api/v1/briefings/${briefingId}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`);
  }

  const json: BriefingApiResponse = await res.json();

  if (!json.success) {
    throw new Error("API returned unsuccessful response");
  }

  return json.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trending Stocks API
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchTrendingStocks(limit = 10): Promise<TrendingResult> {
  const url = `${API_BASE_URL}/api/v1/trending-stocks?limit=${limit}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`);
  }

  const json: TrendingResponse = await res.json();

  if (!json.success) {
    throw new Error("API returned unsuccessful response");
  }

  // API 응답을 프론트엔드 타입으로 변환
  const stocks: TrendingStock[] = json.data.items.map((item) => ({
    symbol: item.symbol,
    shortName: item.shortName,
    quoteType: item.quoteType,
    regularMarketPrice: item.regularMarketPrice,
    regularMarketChangePercent: item.regularMarketChangePercent,
    regularMarketVolume: item.regularMarketVolume,
    sourceTags: item.sourceTags as TrendingStock["sourceTags"],
    rank: item.rank as TrendingStock["rank"],
    score: item.score,
  }));

  // top1 찾기
  const top1Data = json.data.top1;
  let top1: TrendingStock;

  if (top1Data) {
    const top1Item = stocks.find((s) => s.symbol === top1Data.symbol);
    if (top1Item) {
      top1 = {
        ...top1Item,
        selectedReason: top1Data.selectedReason,
      };
    } else {
      top1 = stocks[0];
    }
  } else {
    top1 = stocks[0];
  }

  return {
    stocks,
    top1,
    date: json.data.date,
    timezone: json.data.timezone,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Email API
// ─────────────────────────────────────────────────────────────────────────────

export type SendEmailResponse = {
  success: boolean;
  data: {
    sent: boolean;
    recipient: string;
    subject: string;
    sentAt: string;
  };
  meta: {
    requestId: string;
    generatedAt: string;
  };
};

/**
 * 브리핑 이메일 발송
 */
export async function sendBriefingEmail(
  briefingId: string,
  recipient: string
): Promise<SendEmailResponse["data"]> {
  const url = `${API_BASE_URL}/api/v1/briefings/${briefingId}/send-email`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`이메일 발송 실패: ${res.status} - ${errorText}`);
  }

  const json: SendEmailResponse = await res.json();

  if (!json.success) {
    throw new Error("이메일 발송에 실패했습니다");
  }

  return json.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscription API
// ─────────────────────────────────────────────────────────────────────────────

export type SubscriptionResponse = {
  success: boolean;
  data: {
    subscriptionId: string;
    email: string;
    sendTimeKst: string;
    isActive: boolean;
    message: string;
  };
  meta: {
    requestId: string;
    generatedAt: string;
  };
};

/**
 * 이메일 구독 등록
 */
export async function subscribe(
  email: string,
  sendTimeKst: string = "07:00"
): Promise<SubscriptionResponse["data"]> {
  const url = `${API_BASE_URL}/api/v1/subscriptions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, send_time_kst: sendTimeKst }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`구독 실패: ${res.status} - ${errorText}`);
  }

  const json: SubscriptionResponse = await res.json();

  if (!json.success) {
    throw new Error("구독에 실패했습니다");
  }

  return json.data;
}

/**
 * 구독 취소
 */
export async function unsubscribe(email: string): Promise<void> {
  const url = `${API_BASE_URL}/api/v1/subscriptions/${encodeURIComponent(email)}`;

  const res = await fetch(url, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error("구독 취소에 실패했습니다");
  }
}
