import type {
  AffiliateAccount,
  AffiliateCommission,
  PlatformSettings,
  User,
} from "./types";

const REF_STORAGE_KEY = "lelam-affiliate-ref";
const CLICK_SESSION_KEY = "lelam-affiliate-clicked";

export const AFFILIATE_WINDOW_DAYS = 30;

export function normaliseCode(raw: string | null | undefined): string | null {
  const code = (raw || "").trim().toLowerCase();
  return /^[a-z0-9]{4,20}$/.test(code) ? code : null;
}

/** Stable personal code derived from the account id. */
export function codeForUser(userId: string): string {
  const cleaned = userId.toLowerCase().replace(/[^a-z0-9]/g, "");
  const body = cleaned.slice(-10) || "lelam";
  return body.length >= 4 ? body : `lelam${body}`;
}

export function affiliateUrl(code: string, path = "/"): string {
  const base = `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}ref=${encodeURIComponent(code)}`;
}

type StoredRef = { code: string; at: number };

function readStored(): StoredRef | null {
  try {
    const raw = localStorage.getItem(REF_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRef;
    if (!parsed?.code || !normaliseCode(parsed.code)) return null;
    const age = Date.now() - Number(parsed.at || 0);
    if (age > AFFILIATE_WINDOW_DAYS * 86_400_000) {
      localStorage.removeItem(REF_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getStoredRef(): string | null {
  return readStored()?.code ?? null;
}

export function clearStoredRef(): void {
  try {
    localStorage.removeItem(REF_STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

/** Reads ?ref= from the query string (legacy hash links still supported). */
export function readRefFromUrl(): string | null {
  try {
    const search = new URLSearchParams(window.location.search).get("ref");
    const hashQuery = window.location.hash.includes("?")
      ? new URLSearchParams(window.location.hash.split("?")[1]).get("ref")
      : null;
    return normaliseCode(search) ?? normaliseCode(hashQuery);
  } catch {
    return null;
  }
}

/**
 * Captures a referral code from the URL and remembers it for the attribution
 * window. First click wins. Returns the code only the first time it is seen in
 * this session, so the caller can record one click instead of one per view.
 */
export function captureRef(): { code: string; firstSeen: boolean } | null {
  const urlCode = readRefFromUrl();
  if (!urlCode) return null;

  const stored = readStored();
  const code = stored?.code ?? urlCode;
  if (!stored) {
    try {
      localStorage.setItem(REF_STORAGE_KEY, JSON.stringify({ code, at: Date.now() }));
    } catch {
      /* private mode */
    }
  }

  let firstSeen = true;
  try {
    const seen = sessionStorage.getItem(CLICK_SESSION_KEY);
    if (seen === code) firstSeen = false;
    else sessionStorage.setItem(CLICK_SESSION_KEY, code);
  } catch {
    /* private mode */
  }

  return { code, firstSeen };
}

export function findAffiliateByCode(
  code: string,
  affiliates: AffiliateAccount[] | undefined,
): AffiliateAccount | null {
  const target = normaliseCode(code);
  if (!target) return null;
  return (affiliates ?? []).find((account) => account.code === target) ?? null;
}

export function accountForUser(
  user: User,
  affiliates: AffiliateAccount[] | undefined,
): AffiliateAccount | null {
  return (affiliates ?? []).find((account) => account.userId === user.id) ?? null;
}

/** Shape used for display before the store has persisted a personal account. */
export function previewAccount(
  user: User,
  settings: PlatformSettings,
): AffiliateAccount {
  return {
    id: `aff-${user.id}`,
    userId: user.id,
    name: user.name,
    code: codeForUser(user.id),
    kind: "creator",
    email: user.email,
    commissionRate: (settings.affiliateCommissionPct || 5) / 100,
    status: "active",
    createdAt: user.joinedAt,
  };
}

export type AffiliateSummary = {
  code: string;
  link: string;
  clicks: number;
  signups: number;
  orders: number;
  pending: number;
  available: number;
  paid: number;
};

export function summariseAffiliate(
  account: AffiliateAccount,
  db: {
    users: User[];
    affiliateClicks?: { affiliateId: string }[];
    affiliateCommissions?: AffiliateCommission[];
  },
): AffiliateSummary {
  const commissions = (db.affiliateCommissions ?? []).filter(
    (entry) => entry.affiliateId === account.id && entry.status !== "void",
  );

  return {
    code: account.code,
    link: affiliateUrl(account.code),
    clicks: account.totalClicks ?? (db.affiliateClicks ?? []).filter((click) => click.affiliateId === account.id).length,
    signups: account.totalSignups ?? db.users.filter((candidate) => candidate.referredBy === account.id).length,
    orders: account.totalOrders ?? commissions.length,
    pending: commissions
      .filter((entry) => entry.status === "pending")
      .reduce((total, entry) => total + entry.amount, 0),
    available: commissions
      .filter((entry) => entry.status === "approved")
      .reduce((total, entry) => total + entry.amount, 0),
    paid: commissions
      .filter((entry) => entry.status === "paid")
      .reduce((total, entry) => total + entry.amount, 0),
  };
}
