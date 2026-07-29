// Simple IP-based in-memory sliding-window rate limiter for serverless environment
// Keeps track of timestamps per IP address.

const ipCache = new Map<string, number[]>();

/**
 * Checks if a given IP address has exceeded the rate limit.
 * 
 * @param ip IP address of the requester.
 * @param limit Maximum number of requests allowed in the window.
 * @param windowMs Time window in milliseconds.
 * @returns boolean - True if rate limited, False if allowed.
 */
export function isRateLimited(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = ipCache.get(ip) || [];

  // Filter out timestamps outside the active sliding window
  const validTimestamps = timestamps.filter(t => now - t < windowMs);

  if (validTimestamps.length >= limit) {
    ipCache.set(ip, validTimestamps);
    return true;
  }

  validTimestamps.push(now);
  ipCache.set(ip, validTimestamps);
  return false;
}

/**
 * Helper to retrieve the client IP from requests.
 */
export function getClientIp(req: any): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // x-forwarded-for might contain a list of proxy IPs, we take the first one
    return typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : forwardedFor[0].trim();
  }
  return req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
}

// Automatically clean up cache every 5 minutes to prevent memory exhaustion
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of ipCache.entries()) {
      // Clean up requests older than 15 minutes (max plausible rate limiting window)
      const valid = timestamps.filter(t => now - 15 * 60 * 1000 < t);
      if (valid.length === 0) {
        ipCache.delete(ip);
      } else {
        ipCache.set(ip, valid);
      }
    }
  }, 5 * 60 * 1000);
}
