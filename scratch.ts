import { URL } from 'url';

function extractStoragePath(urlOrPath: string, bucketName: string): string {
  if (!urlOrPath.startsWith('http')) return urlOrPath;
  try {
    const urlObj = new URL(urlOrPath);
    // pathname is like /storage/v1/object/public/BUCKET/path/to/file
    const marker = `/object/public/${bucketName}/`;
    const idx = urlObj.pathname.indexOf(marker);
    if (idx !== -1) {
      return decodeURI(urlObj.pathname.substring(idx + marker.length));
    }
    // Fallback: also handle /object/sign/ style
    const signMarker = `/object/sign/${bucketName}/`;
    const signIdx = urlObj.pathname.indexOf(signMarker);
    if (signIdx !== -1) {
      const afterBucket = urlObj.pathname.substring(signIdx + signMarker.length);
      // signed URL paths may have a query string embedded — strip it
      return decodeURI(afterBucket.split('?')[0]);
    }
    // Last-resort: just use the last path segment (old behaviour)
    const parts = urlObj.pathname.split('/');
    return decodeURI(parts[parts.length - 1]);
  } catch {
    return urlOrPath;
  }
}

console.log(extractStoragePath('https://xnhtcswiteuiggaipzvj.supabase.co/storage/v1/object/public/auction_documents/mstc-previews/MSTC_VZG_POSTMASTER%20NARASARAOPET/1/NARASARAOPET/25-26/58132.jpg', 'auction_documents'));
