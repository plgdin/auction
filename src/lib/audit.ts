import { supabase } from "./supabase";
import type { AuditLog, VisitorStats } from "./types";

interface GeoInfo {
  ip: string;
  location: string;
  city: string;
  country: string;
  countryCode: string;
}

let memoryGeoCache: GeoInfo | null = null;
let lastLoggedPath = "";
let lastLoggedTime = 0;

/**
 * Fast, non-blocking lookup of visitor's public IP and location.
 * Cached in sessionStorage so it only makes 1 network request per user session.
 */
export async function getClientGeo(): Promise<GeoInfo> {
  if (memoryGeoCache) return memoryGeoCache;

  try {
    const cached = sessionStorage.getItem("lelam_geo_cache");
    if (cached) {
      const parsed = JSON.parse(cached) as GeoInfo;
      memoryGeoCache = parsed;
      return parsed;
    }
  } catch {
    // SessionStorage may be restricted or disabled
  }

  const defaultGeo: GeoInfo = {
    ip: "127.0.0.1",
    location: "Local",
    city: "Local",
    country: "India",
    countryCode: "IN",
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch("https://ipapi.co/json/", {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const ip = data.ip || data.network || "unknown";
      const city = data.city || "";
      const region = data.region || "";
      const country = data.country_name || "India";
      const countryCode = data.country_code || "IN";
      const location = [city, region, countryCode].filter(Boolean).join(", ");

      const geo: GeoInfo = {
        ip,
        location: location || country,
        city,
        country,
        countryCode,
      };

      memoryGeoCache = geo;
      try {
        sessionStorage.setItem("lelam_geo_cache", JSON.stringify(geo));
      } catch {}
      return geo;
    }
  } catch {
    // Fallback: try quick ipify for raw IP
    try {
      const ipRes = await fetch("https://api.ipify.org?format=json", {
        signal: AbortSignal.timeout(1500),
      });
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        const geo: GeoInfo = {
          ip: ipData.ip || "unknown",
          location: "India",
          city: "",
          country: "India",
          countryCode: "IN",
        };
        memoryGeoCache = geo;
        try {
          sessionStorage.setItem("lelam_geo_cache", JSON.stringify(geo));
        } catch {}
        return geo;
      }
    } catch {
      // Return default
    }
  }

  return defaultGeo;
}

/**
 * Parses userAgent string into a friendly "Browser · OS" badge.
 */
export function formatDeviceBrowser(ua?: string | null): string {
  if (!ua) return "Web Browser";

  let browser = "Browser";
  if (/edg/i.test(ua)) browser = "Edge";
  else if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua)) browser = "Safari";
  else if (/opera|opr/i.test(ua)) browser = "Opera";

  let os = "Desktop";
  if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";

  return `${browser} · ${os}`;
}

export interface LogVisitorOptions {
  action?: string;
  pagePath?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
}

/**
 * Record a page visit or user activity event in the database.
 * Silently catches errors so navigation and client experience are never affected.
 */
export async function recordVisitorEvent(options: LogVisitorOptions = {}): Promise<string | null> {
  const pagePath = options.pagePath || window.location.pathname || "/";
  const action = options.action || "page_view";
  const now = Date.now();

  // Deduplicate consecutive identical page views within 4 seconds
  if (action === "page_view" && lastLoggedPath === pagePath && now - lastLoggedTime < 4000) {
    return null;
  }

  lastLoggedPath = pagePath;
  lastLoggedTime = now;

  try {
    const geo = await getClientGeo();
    const userAgent = navigator.userAgent;

    const { data, error } = await supabase.rpc("log_visitor_activity", {
      p_action: action,
      p_page_path: pagePath,
      p_entity_type: options.entityType || null,
      p_entity_id: options.entityId || null,
      p_ip_address: geo.ip,
      p_user_agent: userAgent,
      p_location: geo.location,
      p_city: geo.city,
      p_country: geo.country,
      p_country_code: geo.countryCode,
      p_metadata: {
        referrer: document.referrer || "direct",
        url: window.location.href,
        title: document.title,
        ...(options.metadata || {}),
      },
    });

    if (error) {
      console.warn("[VisitorAudit] RPC failed:", error.message);
      return null;
    }

    return data as string;
  } catch (err) {
    console.warn("[VisitorAudit] Error recording activity:", err);
    return null;
  }
}

export interface FetchAuditFilters {
  userType?: "all" | "registered" | "guest";
  action?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Admin query to fetch visitor and audit logs with user profile data.
 */
export async function fetchAdminAuditLogs(
  filters: FetchAuditFilters = {},
  fallbackLogs: AuditLog[] = [],
): Promise<{ logs: AuditLog[]; totalCount: number; stats: VisitorStats }> {
  const page = filters.page || 1;
  const limit = filters.limit || 25;
  const userType = filters.userType || "all";
  const action = filters.action || "all";
  const search = (filters.search || "").trim().toLowerCase();

  try {
    let query = supabase
      .from("audit_logs_with_users")
      .select("*", { count: "exact" });

    if (userType === "registered") {
      query = query.not("actor_id", "is", null);
    } else if (userType === "guest") {
      query = query.is("actor_id", null);
    }

    if (action !== "all") {
      query = query.eq("action", action);
    }

    if (search) {
      query = query.or(
        `ip_address.ilike.%${search}%,page_path.ilike.%${search}%,user_email.ilike.%${search}%,location.ilike.%${search}%,action.ilike.%${search}%`,
      );
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    // Format returned rows
    const logs: AuditLog[] = (data || []).map((row: any) => ({
      id: row.id,
      actorId: row.actor_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      pagePath: row.page_path,
      ipAddress: row.ip_address,
      location: row.location,
      city: row.city,
      country: row.country,
      countryCode: row.country_code,
      userAgent: row.user_agent,
      metadata: row.metadata,
      createdAt: row.created_at,
      userName: row.user_name,
      userEmail: row.user_email,
      userRole: row.user_role,
    }));

    // Calculate quick stats across recent events
    const { data: statsData } = await supabase
      .from("audit_logs_with_users")
      .select("actor_id, ip_address, page_path")
      .limit(500);

    const rows = statsData || [];
    const uniqueIps = new Set(rows.map((r) => r.ip_address).filter(Boolean)).size;
    const registeredViews = rows.filter((r) => r.actor_id !== null).length;
    const guestViews = rows.filter((r) => r.actor_id === null).length;

    const pageCountMap = new Map<string, number>();
    for (const r of rows) {
      const p = r.page_path || "/";
      pageCountMap.set(p, (pageCountMap.get(p) || 0) + 1);
    }

    const topPages = Array.from(pageCountMap.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      logs,
      totalCount: count || logs.length,
      stats: {
        totalViews: count || rows.length || logs.length,
        uniqueIps: Math.max(uniqueIps, 1),
        registeredViews,
        guestViews,
        topPages,
      },
    };
  } catch (err) {
    console.warn("[AdminAudit] Querying audit_logs_with_users failed, using fallback:", err);

    // Filter fallback in-memory logs
    let list = [...fallbackLogs];

    if (userType === "registered") {
      list = list.filter((l) => Boolean(l.actorId));
    } else if (userType === "guest") {
      list = list.filter((l) => !l.actorId);
    }

    if (action !== "all") {
      list = list.filter((l) => l.action === action);
    }

    if (search) {
      list = list.filter(
        (l) =>
          l.pagePath?.toLowerCase().includes(search) ||
          l.ipAddress?.toLowerCase().includes(search) ||
          l.userEmail?.toLowerCase().includes(search) ||
          l.location?.toLowerCase().includes(search) ||
          l.action.toLowerCase().includes(search),
      );
    }

    const totalCount = list.length;
    const from = (page - 1) * limit;
    const paged = list.slice(from, from + limit);

    const uniqueIps = new Set(list.map((r) => r.ipAddress).filter(Boolean)).size;
    const registeredViews = list.filter((r) => Boolean(r.actorId)).length;
    const guestViews = list.filter((r) => !r.actorId).length;

    const pageCountMap = new Map<string, number>();
    for (const r of list) {
      const p = r.pagePath || "/";
      pageCountMap.set(p, (pageCountMap.get(p) || 0) + 1);
    }

    const topPages = Array.from(pageCountMap.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      logs: paged,
      totalCount,
      stats: {
        totalViews: totalCount,
        uniqueIps: Math.max(uniqueIps, 1),
        registeredViews,
        guestViews,
        topPages,
      },
    };
  }
}

