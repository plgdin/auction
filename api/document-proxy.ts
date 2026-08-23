import https from 'https';
import http from 'http';
import { URL } from 'url';
import { isAllowedOrigin } from './utils/cors.js';

// Allowlist of trusted auction sources to protect against SSRF (OWASP A10 Compliance)
const ALLOWED_HOSTNAMES = [
  'forwardauction.gem.gov.in',
  'bidplus.gem.gov.in',
  'bidnext.gem.gov.in',
  'bestprice.gem.gov.in',
  'gem.gov.in',
  'baanknet.com',
  'ibbi.baanknet.com',
  'eauction.baanknet.com',
  'cdn.baanknet.com',
  'api.baanknet.com',
  'files.baanknet.com',
  'static.baanknet.com',
  'psballianceeauction.com',
  'ibapi.in',
  'cersai.org.in',
  'mstcecommerce.com',
  'eprocure.gov.in',
  'amazonaws.com',
  's3.ap-south-1.amazonaws.com',
  'supabase.co',
  'postromania.com',
];

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

/**
 * Universal In-App Document Stream & Proxy API
 * Streams notice PDFs and tender documents directly to the client without external redirections or session expiration.
 */
export default async function handler(req: any, res: any): Promise<void> {
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
  } catch {
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
      } catch {
        // Fallback: proceed without cookies
      }
    }

    // Prepare upstream request options
    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'application/pdf,application/octet-stream,text/html,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: `${parsedTarget.protocol}//${parsedTarget.hostname}/`,
    };

    if (sessionCookies) {
      headers['Cookie'] = sessionCookies;
    }

    const client = parsedTarget.protocol === 'https:' ? https : http;

    const proxyReq = client.get(parsedTarget.toString(), { headers }, (proxyRes: any) => {
      // Handle redirect (e.g. 301, 302)
      if (
        proxyRes.statusCode &&
        proxyRes.statusCode >= 300 &&
        proxyRes.statusCode < 400 &&
        proxyRes.headers.location
      ) {
        const redirectUrl = new URL(proxyRes.headers.location, parsedTarget.toString()).toString();
        res.writeHead(302, {
          Location: `/api/document-proxy?url=${encodeURIComponent(redirectUrl)}&filename=${encodeURIComponent(customFilename)}&disposition=${encodeURIComponent(disposition)}`
        });
        res.end();
        return;
      }

      const contentType = proxyRes.headers['content-type'] || 'application/pdf';
      const sanitizedFilename = customFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const origin = req.headers.origin || req.headers.Origin || '';
      const corsOrigin = isAllowedOrigin(origin) ? origin : (process.env.NODE_ENV === 'production' ? 'https://lelam.co' : '*');

      // If it's a binary PDF, pipe it directly
      if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `${disposition}; filename="${sanitizedFilename}"`,
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          'Access-Control-Allow-Origin': corsOrigin,
          Vary: 'Origin',
        });
        proxyRes.pipe(res);
        return;
      }

      // If it's an HTML page (like GeM view-auction-notice), clean and transform into a clean document starting at GENERAL DETAIL
      if (contentType.includes('html') || contentType.includes('text')) {
        let rawHtml = '';
        proxyRes.setEncoding('utf-8');
        proxyRes.on('data', (chunk: any) => {
          rawHtml += chunk;
        });
        proxyRes.on('end', () => {
          const styledHtml = renderStyledNoticeDocument(rawHtml);
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': corsOrigin,
            Vary: 'Origin',
          });
          res.end(styledHtml);
        });
        return;
      }

      // Fallback stream
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Disposition': `${disposition}; filename="${sanitizedFilename}"`,
        'Access-Control-Allow-Origin': corsOrigin,
        Vary: 'Origin',
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err: any) => {
      console.error('Document proxy fetch error:', err?.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to fetch document from source portal', details: err?.message }));
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
      (res: any) => {
        const rawCookies = res.headers['set-cookie'] || [];
        const cookies = rawCookies
          .map((c: any) => c.split(';')[0])
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

/**
 * Transforms raw GeM portal HTML into a clean document starting directly at GENERAL DETAIL
 */
function renderStyledNoticeDocument(rawHtml: string): string {
  let cleanContent = rawHtml;

  // Search specifically for GENERAL DETAIL / General Details header
  const genDetailMatch = cleanContent.match(/(?:GENERAL|General)\s+DETAIL/i);
  if (genDetailMatch && genDetailMatch.index !== undefined) {
    const matchIdx = genDetailMatch.index;
    
    // Look backwards up to 300 characters to capture the opening heading/div tag of GENERAL DETAIL
    const beforeChunk = cleanContent.substring(Math.max(0, matchIdx - 300), matchIdx);
    const tagMatch = beforeChunk.match(/<(div|h[1-6]|section|article)[^>]*>[^<]*$/i);
    
    if (tagMatch && tagMatch.index !== undefined) {
      cleanContent = cleanContent.substring(Math.max(0, matchIdx - 300) + tagMatch.index);
    } else {
      cleanContent = cleanContent.substring(matchIdx);
    }
  } else {
    // Fallback: search for first table or main content div if GENERAL DETAIL marker is missing
    const tableMatch = cleanContent.match(/<table/i);
    if (tableMatch && tableMatch.index !== undefined) {
      cleanContent = cleanContent.substring(tableMatch.index);
    }
  }

  // Strip all lingering website navigation junk, headers, buttons, and redundant labels
  cleanContent = cleanContent
    .replace(/AUCTION NOTICE\s*SAVE AS PDF\s*\|\s*GO BACK/gi, '')
    .replace(/SAVE AS PDF\s*\|\s*GO BACK/gi, '')
    .replace(/SAVE AS PDF/gi, '')
    .replace(/GO BACK/gi, '')
    .replace(/Auction Notice/gi, '')
    .replace(/1800-419-3436[\s\S]*?Need Help\?[\s\S]*?<\/ul>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<ul[\s\S]*?<\/ul>/gi, (m) => (m.includes('Bids') || m.includes('Login') || m.includes('Help') ? '' : m))
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/href="\/[^"]*"/gi, 'href="javascript:void(0)"')
    .replace(/href="http[^"]*"/gi, 'href="javascript:void(0)" target="_self"');

  // Format key label patterns into styled label tags
  const keyLabelRegex = /(Office\/Zone|Seller\/Auctioneer Name|Auctioneer Name|Seller Name|Reference No\.|Category|Auction Brief|Auction Detail|Starting Price|Reserve Price|EMD Amount|Payment Terms|Inspection Date)\s*:/gi;
  cleanContent = cleanContent.replace(keyLabelRegex, '<div class="field-label-pill">$1</div>');

  const titleMatch = rawHtml.match(/<title>([^<]+)<\/title>/i);
  const docTitle = titleMatch ? titleMatch[1].trim() : 'Official Government e-Auction Notice Document';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(docTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #2563eb;
      --primary-dark: #1d4ed8;
      --slate-950: #020617;
      --slate-900: #0f172a;
      --slate-800: #1e293b;
      --slate-700: #334155;
      --slate-600: #475569;
      --slate-500: #64748b;
      --slate-100: #f1f5f9;
      --slate-50: #f8fafc;
      --border: #e2e8f0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: var(--slate-900);
      line-height: 1.6;
      padding: 24px;
      font-size: 13.5px;
      -webkit-font-smoothing: antialiased;
    }
    .document-wrapper {
      max-width: 960px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    }
    .document-header-banner {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      color: #ffffff;
      padding: 20px 28px;
      border-bottom: 3px solid #2563eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .document-header-banner h2 {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #f8fafc;
      border: none;
      margin: 0;
      padding: 0;
    }
    .document-header-banner .badge {
      background: rgba(37, 99, 235, 0.3);
      border: 1px solid rgba(147, 197, 253, 0.4);
      color: #bfdbfe;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .document-body {
      padding: 28px;
    }
    .field-label-pill {
      display: inline-block;
      margin-top: 14px;
      margin-bottom: 4px;
      color: #2563eb;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      background: #eff6ff;
      border: 1px solid #dbeafe;
      padding: 2px 8px;
      border-radius: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 18px 0 24px 0;
      font-size: 12.5px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.02);
    }
    th, td {
      padding: 11px 16px;
      border: 1px solid #e2e8f0;
      text-align: left;
      vertical-align: middle;
    }
    th {
      background: #f8fafc;
      font-weight: 700;
      color: #1e293b;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.04em;
      border-bottom: 2px solid #cbd5e1;
    }
    tr:nth-child(even) td {
      background: #f8fafc/60;
    }
    tr:hover td {
      background: #f1f5f9;
    }
    h1, h2, h3, h4, .general-detail-title {
      color: #0f172a;
      font-weight: 800;
      margin: 20px 0 12px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid #2563eb;
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: -0.01em;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    strong, b {
      color: #0f172a;
      font-weight: 700;
    }
    a {
      color: #2563eb;
      text-decoration: none;
      pointer-events: none;
    }
    header, footer, nav, .official-header, .notice-footer, .print-btn {
      display: none !important;
    }
    @media print {
      body {
        padding: 0;
        background: #ffffff;
      }
      .document-wrapper {
        border: none;
        box-shadow: none;
        border-radius: 0;
      }
    }
  </style>
</head>
<body>
  <div class="document-wrapper">
    <div class="document-header-banner">
      <h2>Official e-Auction Notice Document</h2>
      <span class="badge">Verified Government Notice</span>
    </div>
    <div class="document-body">
      ${cleanContent}
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
