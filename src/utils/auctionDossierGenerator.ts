import type { BaanknetAuction } from '../services/publicService';

function escapeHtml(unsafe?: string | null): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateStr(dStr?: string | null): string {
  if (!dStr) return 'Refer to Notice';
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return dStr;
  }
}

/**
 * Generates an official, print-ready Bank Auction Notice & Due Diligence Dossier HTML document.
 */
export function generateAuctionDossierHtml(item: BaanknetAuction): string {
  const formattedPrice = item.reserve_price_value
    ? new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(item.reserve_price_value)
    : item.reserve_price_text || 'Refer to Notice';

  const formattedEmd = item.emd_amount_value
    ? new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(item.emd_amount_value)
    : item.emd_amount_text || 'Refer to Notice';

  const formattedInc = item.bid_increment_amount
    ? new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(item.bid_increment_amount)
    : item.bid_increment_text || 'As per Bank Terms';

  const bankName = item.bank_name || 'Public Sector / Scheduled Commercial Bank';
  const branchName = item.branch_name || 'Designated Asset Recovery Branch';
  const displayTitle = item.title || `${item.property_type || 'Property'} Auction in ${item.location || 'India'}`;
  const address = item.full_address || item.location || 'Refer to Notice Document';
  const cersai = item.cersai_id || 'Not Disclosed / Refer Notice';
  const possession = item.possession_status || 'Physical / Symbolic Possession under SARFAESI';
  const actionType = item.action_type || 'SARFAESI Act 2002 / Securitisation & Reconstruction';
  const borrower = item.borrower_name || (Array.isArray(item.borrower_names) && item.borrower_names.join(', ')) || 'Confidential / As per Bank Record';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Detailed Auction Catalogue - ${escapeHtml(item.baanknet_auction_id)}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #ffffff;
      color: #0f172a;
      padding: 8px;
      font-size: 11px;
      line-height: 1.35;
      -webkit-font-smoothing: antialiased;
    }
    .doc-container {
      width: 100%;
      max-width: 100%;
      border: 1.5px solid #64748b;
      background: #ffffff;
      position: relative;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 1.5px solid #64748b;
    }
    .header-table td {
      padding: 6px 10px;
      vertical-align: middle;
    }
    .logo-badge-left {
      display: inline-block;
      border: 1.5px solid #ea580c;
      color: #ea580c;
      font-weight: 800;
      font-size: 8.5px;
      padding: 2px 6px;
      border-radius: 3px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .logo-badge-right {
      display: inline-block;
      border: 1.5px solid #16a34a;
      color: #16a34a;
      font-weight: 800;
      font-size: 8.5px;
      padding: 2px 6px;
      border-radius: 3px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .emblem {
      font-size: 18px;
      line-height: 1;
      text-align: center;
    }
    .catalogue-title {
      background: #f1f5f9;
      text-align: center;
      padding: 5px;
      font-weight: 800;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1.5px solid #64748b;
      color: #0f172a;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
    }
    .data-table td, .data-table th {
      border: 1px solid #94a3b8;
      padding: 3.5px 6px;
      font-size: 10px;
      vertical-align: top;
    }
    .label-col {
      width: 38%;
      background: #f8fafc;
      font-weight: 700;
      color: #334155;
    }
    .value-col {
      width: 62%;
      color: #0f172a;
      font-weight: 500;
    }
    .section-header {
      background: #e2e8f0;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 9.5px;
      letter-spacing: 0.03em;
      color: #1e293b;
      padding: 4px 6px;
      border: 1px solid #94a3b8;
    }
    .highlight-price {
      font-weight: 800;
      color: #0f172a;
    }
    .status-badge {
      display: inline-block;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      font-weight: 700;
      padding: 1px 4px;
      border-radius: 2px;
      font-size: 9px;
    }
    .footer-note {
      padding: 4px 6px;
      font-size: 8px;
      color: #64748b;
      background: #f8fafc;
      border-top: 1px solid #94a3b8;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="doc-container">
    <table class="header-table">
      <tr>
        <td style="width: 35%;"><span class="logo-badge-left">EK KAAM DESH KE NAAM</span></td>
        <td style="width: 30%; text-align: center;"><div class="emblem">🏛️</div></td>
        <td style="width: 35%; text-align: right;"><span class="logo-badge-right">e-auctions INDIA</span></td>
      </tr>
    </table>

    <div class="catalogue-title">Detailed Auction Catalogue</div>

    <table class="data-table">
      <tr>
        <td class="label-col">Auction Number:</td>
        <td class="value-col"><strong>${escapeHtml(item.baanknet_auction_id)}</strong></td>
      </tr>
      <tr>
        <td class="label-col">Auction Type:</td>
        <td class="value-col">${escapeHtml(item.property_type || actionType || 'Bank Foreclosure')}</td>
      </tr>
      <tr>
        <td class="label-col">Scheduled Auction Start Date and Time:</td>
        <td class="value-col">${formatDateStr(item.auction_start_date)}</td>
      </tr>
      <tr>
        <td class="label-col">Scheduled Auction Close Date and Time:</td>
        <td class="value-col">${formatDateStr(item.auction_end_date)}</td>
      </tr>
      <tr>
        <td class="label-col">EMD Submission Deadline:</td>
        <td class="value-col">${formatDateStr(item.emd_end_date)}</td>
      </tr>
      <tr>
        <td class="label-col">Auction Status:</td>
        <td class="value-col"><span class="status-badge">Official Scheduled Auction</span></td>
      </tr>
      <tr>
        <td class="label-col">Reserve Price:</td>
        <td class="value-col highlight-price">${escapeHtml(formattedPrice)}</td>
      </tr>
      <tr>
        <td class="label-col">Pre-Bid EMD Amount:</td>
        <td class="value-col highlight-price">${escapeHtml(formattedEmd)}</td>
      </tr>
      <tr>
        <td class="label-col">Min. Bid Increment:</td>
        <td class="value-col">${escapeHtml(formattedInc)}</td>
      </tr>
      <tr>
        <td class="label-col">Possession Status:</td>
        <td class="value-col">${escapeHtml(possession)}</td>
      </tr>
      <tr>
        <td class="label-col">CERSAI Asset ID:</td>
        <td class="value-col"><code>${escapeHtml(cersai)}</code></td>
      </tr>

      <tr>
        <td colspan="2" class="section-header">Seller / Lending Institution Details</td>
      </tr>
      <tr>
        <td class="label-col">Bank / Creditor Name:</td>
        <td class="value-col"><strong>${escapeHtml(bankName)}</strong></td>
      </tr>
      <tr>
        <td class="label-col">Dealing Branch:</td>
        <td class="value-col">${escapeHtml(branchName)}</td>
      </tr>
      <tr>
        <td class="label-col">Authorized Officer:</td>
        <td class="value-col">${escapeHtml(item.contact_person || item.officer_designation || 'Chief Manager / Authorized Officer')}</td>
      </tr>
      <tr>
        <td class="label-col">Officer Contact:</td>
        <td class="value-col">${escapeHtml(item.contact_phone || 'Refer to Notice')} | ${escapeHtml(item.officer_email || 'Refer to Notice')}</td>
      </tr>

      <tr>
        <td colspan="2" class="section-header">Property & Asset Specification</td>
      </tr>
      <tr>
        <td class="label-col">Asset Description:</td>
        <td class="value-col"><strong>${escapeHtml(displayTitle)}</strong></td>
      </tr>
      <tr>
        <td class="label-col">Physical Address:</td>
        <td class="value-col">${escapeHtml(address)}</td>
      </tr>
      <tr>
        <td class="label-col">City & State:</td>
        <td class="value-col">${escapeHtml(item.city || item.location || 'India')}, ${escapeHtml(item.state || '')} ${item.pincode ? `(${escapeHtml(item.pincode)})` : ''}</td>
      </tr>
      ${item.carpet_area || item.carpet_area_sqft ? `
      <tr>
        <td class="label-col">Carpet / Built-up Area:</td>
        <td class="value-col">${escapeHtml(item.carpet_area || `${item.carpet_area_sqft} sq. ft.`)}</td>
      </tr>` : ''}
      <tr>
        <td class="label-col">Borrower / Account:</td>
        <td class="value-col">${escapeHtml(borrower)}</td>
      </tr>
    </table>

    <div class="footer-note">
      Official Statutory e-Auction Notice under SARFAESI Act, 2002 • Verified by Auction Platform
    </div>
  </div>
</body>
</html>`;
}

/**
 * Returns a Data URI for the generated dossier HTML that can be loaded in an iframe / viewer directly.
 */
export function getAuctionDossierDataUrl(item: BaanknetAuction): string {
  const html = generateAuctionDossierHtml(item);
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}
