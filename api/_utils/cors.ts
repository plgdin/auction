import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

/**
 * Determines the set of allowed origins for CORS based on environment.
 *
 * - Production (VERCEL_ENV=production): only the explicit ALLOWED_ORIGINS or https://lelam.co
 * - Preview (VERCEL_ENV=preview): the exact VERCEL_URL for this deployment (scoped, not wildcard)
 * - Development: localhost on any port
 */
function getAllowedOrigins(): string[] {
  const vercelEnv = process.env.VERCEL_ENV || '';

  if (vercelEnv === 'production') {
    const explicit = process.env.ALLOWED_ORIGINS;
    if (explicit) {
      return explicit.split(',').map(o => o.trim()).filter(Boolean);
    }
    return ['https://lelam.co'];
  }

  if (vercelEnv === 'preview') {
    // VERCEL_URL is the unique deployment URL (e.g. lelam-git-branch-team.vercel.app)
    // It does NOT include the protocol, so we prepend https://
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) {
      return [`https://${vercelUrl}`];
    }
    return [];
  }

  // Development: allow localhost on any port
  return ['http://localhost'];
}

const allowedOrigins = getAllowedOrigins();

/**
 * Checks whether a given Origin header value is allowed.
 * In development, any localhost origin (any port) is allowed.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;

  return allowedOrigins.some(allowed => {
    // Development localhost: match any port
    if (allowed === 'http://localhost') {
      return origin === 'http://localhost' || origin.startsWith('http://localhost:');
    }
    return origin === allowed;
  });
}

/**
 * Sets CORS headers on the response. Returns true if the origin is allowed,
 * false if it was rejected (caller should return 403 for non-preflight requests).
 */
export function setCorsHeaders(req: any, res: any): boolean {
  const origin = req.headers.origin || req.headers.Origin || '';

  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  // If origin is not allowed, we intentionally do NOT set Access-Control-Allow-Origin.
  // Browsers will block the response on the client side.

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  return isAllowedOrigin(origin);
}

/**
 * Handles CORS preflight (OPTIONS) requests.
 * Returns true if the request was an OPTIONS preflight and has been handled.
 */
export function handleCorsPreflightIfNeeded(req: any, res: any): boolean {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  return false;
}
