import { decryptPdfPath } from '../src/lib/crypto.js';
import fetch from 'node-fetch';

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = req.url || '';
  const urlParams = new URL(url, `http://${req.headers.host || 'localhost'}`).searchParams;
  const file = urlParams.get('file');

  if (!file) {
    res.status(400).json({ error: 'Missing file parameter' });
    return;
  }

  const decryptedUrl = decryptPdfPath(file);
  if (!decryptedUrl) {
    res.status(400).json({ error: 'Invalid file parameter' });
    return;
  }

  // SSRF Protection: Validate that the URL points exclusively to our Supabase Storage bucket
  const allowedPrefix = 'https://xnhtcswiteuiggaipzvj.supabase.co/storage/v1/object/public/';
  if (!decryptedUrl.startsWith(allowedPrefix)) {
    res.status(403).json({ error: 'Access denied: URL not allowed' });
    return;
  }

  try {
    const response = await fetch(decryptedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      res.status(response.status).json({ error: `Failed to retrieve PDF: ${response.statusText}` });
      return;
    }

    // Set headers to serve the PDF
    res.setHeader('Content-Type', 'application/pdf');
    const filename = decryptedUrl.split('/').pop() || 'document.pdf';
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    // Stream/send the response buffer
    const buffer = await response.buffer();
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
