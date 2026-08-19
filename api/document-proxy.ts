import https from 'https';
import http from 'http';
import { URL } from 'url';

// Allowlist of trusted auction sources to protect against SSRF (OWASP A10 Compliance)
const ALLOWED_HOSTNAMES = [
  'forwardauction.gem.gov.in',
  'bidplus.gem.gov.in',
  'gem.gov.in',
  'baanknet.com',
  'ibbi.baanknet.com',
  'eauction.baanknet.com',
  'mstcecommerce.com',
  'eprocure.gov.in',
  'supabase.co'
];

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

/**
 * Universal In-App Document Stream & Proxy API
 * Streams notice PDFs and tender documents directly to the client without external redirections or session expiration.
 */
export default async function handler(req: any, res: any) {
  // Only allow GET requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  const rawUrl = (req.query?.url as string) || new URL(req.url, 'http://localhost').searchParams.get('url');
  const customFilename =
    (req.query?.filename as string) ||
    new URL(req.url, 'http://localhost').searchParams.get('filename') ||
    'Auction_Document.pdf';
  const disposition =
    (req.query?.disposition as string) ||
    new URL(req.url, 'http://localhost').searchParams.get('disposition') ||
    'inline';

  if (!rawUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing required "url" parameter' }));
    return;
  }

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(rawUrl);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid document URL' }));
    return;
  }

  // SSRF Validation: Check hostname against trusted allowlist
  const isAllowed = ALLOWED_HOSTNAMES.some(
    (allowed) => parsedTarget.hostname === allowed || parsedTarget.hostname.endsWith(`.${allowed}`)
  );

  if (!isAllowed) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Access to the requested host is not permitted' }));
    return;
  }

  try {
    let sessionCookies = '';

    // If fetching from forwardauction.gem.gov.in, acquire session cookies from home first
    if (parsedTarget.hostname.includes('forwardauction.gem.gov.in')) {
      try {
        sessionCookies = await getGeMSessionCookies();
      } catch (e) {
        // Fallback: proceed without cookies
      }
    }

    // Prepare upstream request options
    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'application/pdf,application/octet-stream,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: `${parsedTarget.protocol}//${parsedTarget.hostname}/`,
    };

    if (sessionCookies) {
      headers['Cookie'] = sessionCookies;
    }

    const client = parsedTarget.protocol === 'https:' ? https : http;

    const proxyReq = client.get(parsedTarget.toString(), { headers }, (proxyRes) => {
      // Handle redirect (e.g. 301, 302)
      if (
        proxyRes.statusCode &&
        proxyRes.statusCode >= 300 &&
        proxyRes.statusCode < 400 &&
        proxyRes.headers.location
      ) {
        const redirectUrl = new URL(proxyRes.headers.location, parsedTarget.toString()).toString();
        // Redirect client to proxy the redirected target
        res.writeHead(302, { Location: `/api/document-proxy?url=${encodeURIComponent(redirectUrl)}&filename=${encodeURIComponent(customFilename)}&disposition=${encodeURIComponent(disposition)}` });
        res.end();
        return;
      }

      const contentType = proxyRes.headers['content-type'] || 'application/pdf';
      const sanitizedFilename = customFilename.replace(/[^a-zA-Z0-9._-]/g, '_');

      // Set response headers
      res.writeHead(200, {
        'Content-Type': contentType.includes('pdf') ? 'application/pdf' : contentType,
        'Content-Disposition': `${disposition}; filename="${sanitizedFilename}"`,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Access-Control-Allow-Origin': '*',
      });

      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('Document proxy fetch error:', err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to fetch document from source portal', details: err.message }));
      }
    });

    proxyReq.setTimeout(30000, () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Gateway timeout fetching document' }));
      }
    });
  } catch (err: any) {
    console.error('Unhandled document proxy error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error while processing document' }));
    }
  }
}

/**
 * Acquire PHP / portal session cookies for GeM Forward Auctions
 */
function getGeMSessionCookies(): Promise<string> {
  return new Promise((resolve) => {
    const homeReq = https.get(
      'https://forwardauction.gem.gov.in/eprocure/home',
      {
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      },
      (res) => {
        const rawCookies = res.headers['set-cookie'] || [];
        const cookies = rawCookies
          .map((c) => c.split(';')[0])
          .filter(Boolean)
          .join('; ');
        resolve(cookies);
      }
    );

    homeReq.on('error', () => resolve(''));
    homeReq.setTimeout(5000, () => {
      homeReq.destroy();
      resolve('');
    });
  });
}
