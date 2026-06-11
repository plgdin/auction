import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FAILSAFE_RETRIES_CEILING = 3;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("CRITICAL EXCEPTION: Background worker is missing database environment keys.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function runAssetPipelineQueue() {
  const { data: executableQueue, error: queryError } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, source_pdf_url, retry_count')
    .or('asset_status.eq.pending,asset_status.eq.failed')
    .lt('retry_count', FAILSAFE_RETRIES_CEILING)
    .limit(10); // Throttle downloads to avoid triggering IP blocking

  if (queryError) {
    console.error('Queue state querying engine failed:', queryError.message);
    return;
  }

  if (!executableQueue || executableQueue.length === 0) {
    return;
  }

  console.log(`Processing queue batch: Found ${executableQueue.length} pending catalogs.`);

  for (const record of executableQueue) {
    // Row-Lock: Set state to processing immediately so concurrent instances don't pull the same task
    await supabase
      .from('mstc_auctions')
      .update({ asset_status: 'processing' })
      .eq('id', record.id);

    try {
      console.log(`Downloading document for index key: ${record.mstc_auction_number}`);
      
      const url = new URL(record.source_pdf_url);
      const aucId = url.searchParams.get('auc') || '';
      
      const formData = new URLSearchParams();
      formData.append('auc', aucId);
      formData.append('cat', '0');
      formData.append('sell', '0');

      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      try {
        if (fs.existsSync('cookies.txt')) {
          const cookieString = fs.readFileSync('cookies.txt', 'utf-8');
          if (cookieString.trim()) {
            headers['Cookie'] = cookieString.trim();
          }
        }
      } catch (cookieErr: any) {
        console.warn('Warning reading cookies.txt:', cookieErr.message);
      }

      const payloadResponse = await fetch('https://www.mstcecommerce.com/auctionhome/mstc/auction_detailed_report_pdf.jsp', {
        method: 'POST',
        body: formData,
        headers,
        timeout: 45000
      } as any);

      if (!payloadResponse.ok) {
        throw new Error(`External file target thrown bad response: status ${payloadResponse.status}`);
      }
      
      // Node-fetch body payload casting to buffer
      const fileBuffer = await payloadResponse.buffer();

      // Corrupt payload guard: ensure the file data is an actual valid PDF structure
      if (fileBuffer.toString('utf-8', 0, 4) !== '%PDF') {
        const preview = fileBuffer.toString('utf-8', 0, 200);
        if (preview.includes('session') || preview.includes('timeout') || preview.includes('login')) {
          throw new Error('Verification failed: session is expired or invalid. Please run the scraper again to renew cookies.');
        }
        throw new Error('Asset payload content failed structural binary layout verification.');
      }

      const sanitizedAuctionNum = record.mstc_auction_number.replace(/[\/\\:*?"<>|]/g, '_');
      const cloudStorageLocation = `mstc-catalogs/${sanitizedAuctionNum}.pdf`;

      // Upload payload buffer. Upsert: true replaces files in place, avoiding storage bloat.
      const { error: storageWriteError } = await supabase.storage
        .from('auction_documents')
        .upload(cloudStorageLocation, fileBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (storageWriteError) throw storageWriteError;

      const { data: structuralPublicMeta } = supabase.storage
        .from('auction_documents')
        .getPublicUrl(cloudStorageLocation);

      // Successfully processed: update row data with our secure public path link
      await supabase
        .from('mstc_auctions')
        .update({
          asset_status: 'completed',
          sanitized_document_path: structuralPublicMeta.publicUrl,
          error_log: null
        })
        .eq('id', record.id);

      console.log(`Document processing successfully finalized for: ${record.mstc_auction_number}`);

    } catch (jobExecutionFault: any) {
      const scaledRetryTracker = record.retry_count + 1;
      const reachedMaxLimit = scaledRetryTracker >= FAILSAFE_RETRIES_CEILING;

      console.error(`Asset Sync processing error caught on item ${record.mstc_auction_number}:`, jobExecutionFault.message);

      await supabase
        .from('mstc_auctions')
        .update({
          asset_status: reachedMaxLimit ? 'failed' : 'pending',
          retry_count: scaledRetryTracker,
          error_log: `[Error State Cycle ${scaledRetryTracker}] ${jobExecutionFault.message}`
        })
        .eq('id', record.id);
    }
  }
}

async function startWorker() {
  console.log('Background Worker Service Started. Scanning for pending uploads every 15 seconds...');
  while (true) {
    try {
      await runAssetPipelineQueue();
    } catch (err: any) {
      console.error('Worker loop iteration failed:', err.message);
    }
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
}

startWorker();
