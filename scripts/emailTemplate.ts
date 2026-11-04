/**
 * Generates personalized, responsive HTML email for B2B procurement campaign.
 */
export function generateCampaignEmailHtml(params: {
  companyName?: string;
  recipientEmail: string;
  unsubscribeUrl?: string;
}): string {
  const companyGreeting = params.companyName?.trim()
    ? `Hi Team at ${params.companyName},`
    : 'Hi Team,';
  const encodedEmail = encodeURIComponent(params.recipientEmail);
  const unsubUrl = params.unsubscribeUrl || `https://lelam.co/api/unsubscribe?email=${encodedEmail}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Track MSTC, GeM &amp; Bank Auctions in One Place | Lelam.co</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);">
          
          <!-- Banner Image -->
          <tr>
            <td align="center" style="background-color: #ffffff; line-height: 0;">
              <a href="https://lelam.co" target="_blank" style="display: block; text-decoration: none;">
                <img src="https://lelam.co/email-banner.jpg" alt="Lelam Auctions" width="600" style="display: block; width: 100%; max-width: 600px; height: auto; border: 0;" />
              </a>
            </td>
          </tr>

          <!-- Main Content Card -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 16px;">
                ${companyGreeting}
              </p>

              <p style="font-size: 15px; color: #334155; margin-bottom: 14px;">
                I hope you&rsquo;re doing well.
              </p>

              <p style="font-size: 15px; color: #334155; margin-bottom: 14px;">
                If your business regularly participates in auctions or sources scrap, industrial machinery, plant assets, metals, and vehicles across India, finding the right lots on time is critical.
              </p>

              <p style="font-size: 15px; font-weight: 700; color: #0284c7; margin-bottom: 14px;">
                Lelam.co brings all major Indian auction portals together in one place.
              </p>

              <p style="font-size: 15px; color: #334155; margin-bottom: 24px;">
                Instead of checking dozens of different websites daily, you can discover live and upcoming auctions from official Government platforms like <strong>MSTC</strong> and <strong>GeM</strong>, bank e-auctions, PSUs, and industrial liquidation sales on one clean, searchable dashboard.
              </p>

              <!-- How Lelam Can Help Section -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td>
                    <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 16px;">
                      How Lelam helps your bidding team:
                    </div>

                    <div style="margin-bottom: 14px;">
                      <div style="font-size: 14px; font-weight: 700; color: #0369a1; margin-bottom: 3px;">
                        &bull; All Major Auction Sources in One Place
                      </div>
                      <div style="font-size: 14px; color: #475569; padding-left: 12px;">
                        Explore verified listings from MSTC, GeM, DRT, nationalized banks, and private industrial liquidations without portal hopping.
                      </div>
                    </div>

                    <div style="margin-bottom: 14px;">
                      <div style="font-size: 14px; font-weight: 700; color: #0369a1; margin-bottom: 3px;">
                        &bull; Filter by Category &amp; Location
                      </div>
                      <div style="font-size: 14px; color: #475569; padding-left: 12px;">
                        Quickly find scrap materials, industrial machinery, manufacturing plant equipment, vehicles, and commercial assets near your region.
                      </div>
                    </div>

                    <div style="margin-bottom: 14px;">
                      <div style="font-size: 14px; font-weight: 700; color: #0369a1; margin-bottom: 3px;">
                        &bull; Complete Lot Details &amp; Deadlines
                      </div>
                      <div style="font-size: 14px; color: #475569; padding-left: 12px;">
                        Instantly see lot descriptions, EMD amounts, inspection schedules, auction dates, and contact information before bidding.
                      </div>
                    </div>

                    <div>
                      <div style="font-size: 14px; font-weight: 700; color: #0369a1; margin-bottom: 3px;">
                        &bull; Discover Undervalued &amp; Surplus Lots
                      </div>
                      <div style="font-size: 14px; color: #475569; padding-left: 12px;">
                        Identify profitable procurement opportunities and liquidation lots that competitors often miss.
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0 24px 0;">
                <tr>
                  <td align="center">
                    <a href="https://lelam.co" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.25);">
                      Explore Live Auctions on Lelam.co &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #475569; line-height: 1.5; margin-bottom: 24px;">
                Looking for specific lots or need help setting up custom alerts for your procurement category? Our team is glad to assist you.
              </p>

              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

              <!-- Contact Info -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #334155; line-height: 1.8;">
                <tr>
                  <td style="width: 24px; vertical-align: top;">&#128222;</td>
                  <td><strong>Phone:</strong> <a href="tel:+919447753889" style="color: #0284c7; text-decoration: none;">+91 94477 53889</a> <span style="color: #64748b;">(Mon&ndash;Sat, 9:00 AM&ndash;6:00 PM IST)</span></td>
                </tr>
                <tr>
                  <td style="width: 24px; vertical-align: top;">&#9993;</td>
                  <td><strong>Email:</strong> <a href="mailto:business@lelam.co" style="color: #0284c7; text-decoration: none;">business@lelam.co</a> / <a href="mailto:support@lelam.co" style="color: #0284c7; text-decoration: none;">support@lelam.co</a></td>
                </tr>
                <tr>
                  <td style="width: 24px; vertical-align: top;">&#127760;</td>
                  <td><strong>Website:</strong> <a href="https://lelam.co" style="color: #0284c7; text-decoration: none;">lelam.co</a></td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #334155; margin-top: 24px; margin-bottom: 0;">
                Best regards,<br />
                <strong>The Lelam Team</strong><br />
                <span style="color: #64748b; font-size: 13px;"><em>Lelam &mdash; Making Auctions Mainstream</em></span>
              </p>
            </td>
          </tr>

          <!-- Footer with Unsubscribe -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="font-size: 12px; color: #94a3b8; margin: 0;">
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
