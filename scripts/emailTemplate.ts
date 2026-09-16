/**
 * Generates personalized, responsive HTML email for B2B procurement campaign.
 */
export function generateCampaignEmailHtml(params: {
  companyName: string;
  recipientEmail: string;
  unsubscribeUrl?: string;
}): string {
  const company = params.companyName?.trim() || 'Valued Team';
  const encodedEmail = encodeURIComponent(params.recipientEmail);
  const unsubUrl = params.unsubscribeUrl || `https://lelam.co/api/unsubscribe?email=${encodedEmail}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lelam - Sourcing Industrial Machinery & Materials</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px 32px; text-align: left;">
              <a href="https://lelam.co" target="_blank" style="text-decoration: none;">
                <span style="font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">lelam<span style="color: #38bdf8;">.co</span></span>
              </a>
              <div style="color: #94a3b8; font-size: 13px; margin-top: 4px; font-weight: 500;">India's Auctions Marketplace & Intelligence Platform</div>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 16px;">
                Hi Team at ${company},
              </h2>

              <p style="font-size: 15px; color: #334155; margin-bottom: 16px;">
                I hope this email finds you well.
              </p>

              <p style="font-size: 15px; color: #334155; margin-bottom: 20px;">
                We noticed <strong>${company}</strong>'s active role in the manufacturing and export sector. Sourcing reliable industrial equipment, machinery, processing tools, and raw materials at competitive rates is a key driver for business margins.
              </p>

              <p style="font-size: 15px; color: #334155; margin-bottom: 24px;">
                At <strong>Lelam</strong> (<a href="https://lelam.co" style="color: #0284c7; text-decoration: underline;">lelam.co</a>), we track and aggregate official <strong>Government (MSTC, GeM), Bank, and Industrial Liquidation Auctions</strong> across India into a single, searchable platform.
              </p>

              <!-- Value Prop Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; border-radius: 8px; border-left: 4px solid #0284c7; padding: 16px; margin-bottom: 24px;">
                <tr>
                  <td>
                    <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">How Lelam helps ${company}:</div>
                    <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #334155;">
                      <li style="margin-bottom: 8px;"><strong>Direct Sourcing:</strong> Find industrial machinery, plant equipment, vehicles, and scrap materials at 40%–70% below market price.</li>
                      <li style="margin-bottom: 8px;"><strong>Single Window:</strong> Search MSTC eAuctions, BaankNet bank properties, and commercial liquidations without visiting 10+ portals.</li>
                      <li style="margin-bottom: 0;"><strong>Smart Catalog Data:</strong> Instant access to lot specifications, estimated values, and auction schedules.</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="https://lelam.co/auctions" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.25);">
                      Explore Live Auctions on Lelam.co &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0;" />

              <!-- Contact Info -->
              <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">
                Need assistance or looking for specific assets?
              </h3>
              <p style="font-size: 14px; color: #475569; margin-bottom: 16px;">
                Our procurement team is available to help you find relevant lots:
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px; color: #334155; line-height: 1.8;">
                <tr>
                  <td style="width: 24px; vertical-align: top;">&#128222;</td>
                  <td><strong>Phone:</strong> <a href="tel:+919447753889" style="color: #0284c7; text-decoration: none;">+91 94477 53889</a> <span style="color: #64748b; font-size: 12px;">(Mon–Sat, 9:00 AM – 6:00 PM IST)</span></td>
                </tr>
                <tr>
                  <td style="width: 24px; vertical-align: top;">&#9993;</td>
                  <td><strong>Email:</strong> <a href="mailto:business@lelam.co" style="color: #0284c7; text-decoration: none;">business@lelam.co</a> / <a href="mailto:support@lelam.co" style="color: #0284c7; text-decoration: none;">support@lelam.co</a></td>
                </tr>
                <tr>
                  <td style="width: 24px; vertical-align: top;">&#128205;</td>
                  <td><strong>Office:</strong> No: 2, 20th Cross Lakshimpuram, Halasuru, Bangalore 560008</td>
                </tr>
                <tr>
                  <td style="width: 24px; vertical-align: top;">&#127760;</td>
                  <td><strong>Website:</strong> <a href="https://lelam.co" style="color: #0284c7; text-decoration: none;">https://lelam.co</a></td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #334155; margin-top: 24px; margin-bottom: 0;">
                Best regards,<br />
                <strong>The Lelam Team</strong><br />
                <span style="color: #64748b; font-size: 13px;">Lelam — India's Auctions Marketplace</span>
              </p>
            </td>
          </tr>

          <!-- Footer with Unsubscribe -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="font-size: 12px; color: #94a3b8; margin: 0 0 8px 0;">
                &copy; ${new Date().getFullYear()} Lelam Company. All rights reserved.
              </p>
              <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                You received this email because ${company} is an active enterprise in India.
                If you do not wish to receive procurement alerts, 
                <a href="${unsubUrl}" target="_blank" style="color: #64748b; text-decoration: underline;">unsubscribe here</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
