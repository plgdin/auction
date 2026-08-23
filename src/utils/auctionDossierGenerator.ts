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
    : item.bid_increment_text || '₹ 10,000 / standard increment';

  const bankName = item.bank_name || 'Public Sector / Scheduled Commercial Bank';
  const branchName = item.branch_name || 'Designated Asset Recovery Branch';
  const displayTitle = item.title || `${item.property_type || 'Property'} Auction in ${item.location || 'India'}`;
  const address = item.full_address || item.location || 'Refer to Notice Document';
  const cersai = item.cersai_id || 'Not Disclosed / Refer Document';
  const possession = item.possession_status || 'Physical / Symbolic Possession under SARFAESI Act';
  const actionType = item.action_type || 'SARFAESI Act 2002 / Securitisation & Reconstruction';
  const borrower = item.borrower_name || (Array.isArray(item.borrower_names) && item.borrower_names.join(', ')) || 'Confidential / Under SARFAESI Record';
  const dues = item.outstanding_dues_text || (item.outstanding_dues_value ? `₹ ${item.outstanding_dues_value.toLocaleString('en-IN')}` : 'As per demand notice + applicable interest');
  const encumbrances = item.encumbrances_text || 'Not Known / Sold on "AS IS WHERE IS AND AS IS WHAT IS BASIS"';

  const boundaries = item.boundaries;
  const hasBoundaries = boundaries && (boundaries.north || boundaries.south || boundaries.east || boundaries.west);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Official Bank Auction Dossier - ${escapeHtml(item.baanknet_auction_id)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #1e3a8a;
      --primary-dark: #0f172a;
      --accent: #2563eb;
      --emerald: #059669;
      --slate-900: #0f172a;
      --slate-800: #1e293b;
      --slate-700: #334155;
      --slate-600: #475569;
      --slate-500: #64748b;
      --slate-100: #f1f5f9;
      --slate-50: #f8fafc;
      --border: #cbd5e1;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f1f5f9;
      color: var(--slate-900);
      padding: 24px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    .dossier-card {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
      overflow: hidden;
    }
    .header-banner {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
      color: #ffffff;
      padding: 28px 32px;
      border-bottom: 3px solid #2563eb;
      position: relative;
    }
    .header-banner h1 {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -0.02em;
      margin-bottom: 6px;
      color: #ffffff;
    }
    .header-banner .subtitle {
      font-size: 13px;
      color: #93c5fd;
      font-weight: 600;
    }
    .header-meta {
      margin-top: 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
    }
    .header-badge {
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.2);
      padding: 4px 10px;
      border-radius: 6px;
      color: #e0f2fe;
    }
    .verified-seal {
      position: absolute;
      top: 24px;
      right: 32px;
      background: #059669;
      color: #ffffff;
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 5px 12px;
      border-radius: 9999px;
      box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3);
    }
    .content-body {
      padding: 32px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--primary);
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 6px;
      margin: 24px 0 14px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title:first-child {
      margin-top: 0;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 14px;
      margin-bottom: 20px;
    }
    .metric-box {
      background: var(--slate-50);
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
    }
    .metric-label {
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--slate-500);
      display: block;
      margin-bottom: 4px;
    }
    .metric-value {
      font-size: 18px;
      font-weight: 900;
      color: #0f172a;
      display: block;
    }
    .metric-highlight {
      color: #1e3a8a;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
      margin-bottom: 20px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .data-table th, .data-table td {
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      text-align: left;
    }
    .data-table th {
      background: #f8fafc;
      color: #475569;
      font-weight: 700;
      width: 32%;
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .data-table td {
      background: #ffffff;
      color: #0f172a;
      font-weight: 500;
    }
    .data-table tr:hover td {
      background: #f8fafc;
    }
    .notice-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 10px;
      padding: 14px 18px;
      margin-top: 24px;
      font-size: 12px;
      color: #166534;
      line-height: 1.6;
    }
    .footer-stamp {
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: var(--slate-500);
    }
    @media print {
      body {
        padding: 0;
        background: #ffffff;
      }
      .dossier-card {
        border: none;
        box-shadow: none;
        border-radius: 0;
        max-width: 100%;
      }
      .header-banner {
        background: #0f172a !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="dossier-card">
    <div class="header-banner">
      <div class="verified-seal">✓ Verified Bank Notice</div>
      <h1>${escapeHtml(bankName)}</h1>
      <div class="subtitle">Branch: ${escapeHtml(branchName)} • Statutory e-Auction Notice</div>
      <div class="header-meta">
        <span class="header-badge">Auction Ref: ${escapeHtml(item.baanknet_auction_id)}</span>
        ${item.bank_property_id ? `<span class="header-badge">Property ID: ${escapeHtml(item.bank_property_id)}</span>` : ''}
        <span class="header-badge">Classification: ${escapeHtml(item.property_type || 'Bank Foreclosure')}</span>
      </div>
    </div>

    <div class="content-body">
      <div class="section-title">1. Asset Identification & Location</div>
      <table class="data-table">
        <tr>
          <th>Asset Description</th>
          <td><strong>${escapeHtml(displayTitle)}</strong></td>
        </tr>
        <tr>
          <th>Full Physical Address</th>
          <td>${escapeHtml(address)}</td>
        </tr>
        <tr>
          <th>Location / State / PIN</th>
          <td>${escapeHtml(item.city || item.location || 'India')}, ${escapeHtml(item.state || '')} - ${escapeHtml(item.pincode || 'Refer Notice')}</td>
        </tr>
        ${item.carpet_area || item.carpet_area_sqft ? `
        <tr>
          <th>Carpet / Super Area</th>
          <td>${escapeHtml(item.carpet_area || `${item.carpet_area_sqft} sq. ft.`)}</td>
        </tr>` : ''}
        ${item.furnishing ? `
        <tr>
          <th>Furnishing Status</th>
          <td>${escapeHtml(item.furnishing)}</td>
        </tr>` : ''}
      </table>

      ${hasBoundaries ? `
      <div class="section-title">2. Property Boundaries (Schedule)</div>
      <table class="data-table">
        <tr><th>North Boundary</th><td>${escapeHtml(boundaries?.north || 'Refer Registered Document')}</td></tr>
        <tr><th>South Boundary</th><td>${escapeHtml(boundaries?.south || 'Refer Registered Document')}</td></tr>
        <tr><th>East Boundary</th><td>${escapeHtml(boundaries?.east || 'Refer Registered Document')}</td></tr>
        <tr><th>West Boundary</th><td>${escapeHtml(boundaries?.west || 'Refer Registered Document')}</td></tr>
      </table>` : ''}

      <div class="section-title">3. Financial Parameters & EMD Account Details</div>
      <div class="metrics-grid">
        <div class="metric-box">
          <span class="metric-label">Reserve Price</span>
          <span class="metric-value metric-highlight">${escapeHtml(formattedPrice)}</span>
        </div>
        <div class="metric-box">
          <span class="metric-label">Earnest Money Deposit (EMD)</span>
          <span class="metric-value">${escapeHtml(formattedEmd)}</span>
        </div>
        <div class="metric-box">
          <span class="metric-label">Bid Increment Value</span>
          <span class="metric-value" style="font-size: 15px;">${escapeHtml(formattedInc)}</span>
        </div>
      </div>

      <table class="data-table">
        <tr>
          <th>EMD Remittance Bank</th>
          <td>${escapeHtml(item.emd_bank_name || bankName)}</td>
        </tr>
        <tr>
          <th>EMD Account Number</th>
          <td><code>${escapeHtml(item.emd_account_number || 'Refer to Tender Annexure')}</code></td>
        </tr>
        <tr>
          <th>Bank IFSC Code</th>
          <td><code>${escapeHtml(item.emd_account_ifsc || 'Refer to Tender Annexure')}</code></td>
        </tr>
        ${item.tender_fee_text || item.tender_fee_value ? `
        <tr>
          <th>Tender Application Fee</th>
          <td>${escapeHtml(item.tender_fee_text || `₹ ${item.tender_fee_value}`)}</td>
        </tr>` : ''}
      </table>

      <div class="section-title">4. Legal, Regulatory & Due Diligence Information</div>
      <table class="data-table">
        <tr>
          <th>Enforcement Framework</th>
          <td>${escapeHtml(actionType)}</td>
        </tr>
        <tr>
          <th>Possession Status</th>
          <td>${escapeHtml(possession)}</td>
        </tr>
        <tr>
          <th>CERSAI Security Interest ID</th>
          <td><code>${escapeHtml(cersai)}</code></td>
        </tr>
        <tr>
          <th>Borrower / Mortgagor Name(s)</th>
          <td>${escapeHtml(borrower)}</td>
        </tr>
        <tr>
          <th>Outstanding Bank Dues</th>
          <td>${escapeHtml(dues)}</td>
        </tr>
        <tr>
          <th>Encumbrances / Liens Known</th>
          <td>${escapeHtml(encumbrances)}</td>
        </tr>
        ${item.corporate_debtor_name ? `
        <tr>
          <th>Corporate Debtor (IBC)</th>
          <td>${escapeHtml(item.corporate_debtor_name)} (CIN: ${escapeHtml(item.corporate_debtor_cin || 'N/A')})</td>
        </tr>` : ''}
        ${item.liquidator_reg_no ? `
        <tr>
          <th>Insolvency Professional / Liquidator</th>
          <td>${escapeHtml(item.liquidator_reg_no)} (${escapeHtml(item.liquidator_email || 'Contact IP')})</td>
        </tr>` : ''}
        ${item.nclt_case_no ? `
        <tr>
          <th>NCLT Case Reference</th>
          <td>${escapeHtml(item.nclt_case_no)} [Bench: ${escapeHtml(item.nclt_bench || 'National Company Law Tribunal')}]</td>
        </tr>` : ''}
      </table>

      <div class="section-title">5. Critical Timelines & Inspection Schedule</div>
      <table class="data-table">
        <tr>
          <th>e-Auction Bidding Start</th>
          <td><strong>${formatDateStr(item.auction_start_date)}</strong></td>
        </tr>
        <tr>
          <th>e-Auction Bidding Close</th>
          <td><strong>${formatDateStr(item.auction_end_date)}</strong></td>
        </tr>
        <tr>
          <th>EMD Submission Deadline</th>
          <td>${formatDateStr(item.emd_end_date)}</td>
        </tr>
        <tr>
          <th>Physical Asset Inspection Period</th>
          <td>${formatDateStr(item.inspection_start_date)} to ${formatDateStr(item.inspection_end_date)}</td>
        </tr>
      </table>

      <div class="section-title">6. Authorized Dealing Officer Contacts</div>
      <table class="data-table">
        <tr>
          <th>Authorized / Nodal Officer</th>
          <td>${escapeHtml(item.contact_person || item.officer_designation || 'Chief Manager / Authorized Officer')}</td>
        </tr>
        <tr>
          <th>Official Contact Phone</th>
          <td>${escapeHtml(item.contact_phone || 'Refer to Branch Notice')}</td>
        </tr>
        <tr>
          <th>Official Email Address</th>
          <td>${escapeHtml(item.officer_email || 'Refer to Branch Notice')}</td>
        </tr>
      </table>

      <div class="notice-box">
        <strong>Statutory Notice Disclaimer:</strong> This official auction dossier is compiled from statutory notices published under SARFAESI Act, 2002 / IBC 2016 rules. Bidders are advised to inspect the physical asset, independently verify encumbrances with the sub-registrar office, and participate in accordance with bank guidelines.
      </div>

      <div class="footer-stamp">
        <span>Verified by Auction Intelligence Platform</span>
        <span>Generated: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}</span>
      </div>
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
