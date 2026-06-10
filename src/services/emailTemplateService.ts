/**
 * Mock Email Template Service
 * 
 * In a production environment, this service would integrate with SendGrid, AWS SES, or Resend.
 * For this frontend architecture, it generates responsive HTML strings and logs them to the console
 * to demonstrate the transactional email capability.
 */

export const emailTemplateService = {
  
  _buildBaseTemplate(title: string, body: string, actionUrl?: string, actionText?: string) {
    return `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 24px; font-weight: 800;">Auction Central</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 5px;">Enterprise e-Auction Platform</p>
        </div>
        
        <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <h3 style="color: #0f172a; font-size: 18px; margin-top: 0; margin-bottom: 20px;">${title}</h3>
          
          <div style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 30px;">
            ${body}
          </div>
          
          ${actionUrl && actionText ? `
            <div style="text-align: center; margin-top: 30px;">
              <a href="${actionUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                ${actionText}
              </a>
            </div>
          ` : ''}
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #94a3b8; font-size: 12px;">
          <p>This is an automated message. Please do not reply directly to this email.</p>
          <p>© ${new Date().getFullYear()} Auction Central Procurement.</p>
        </div>
      </div>
    `;
  },

  sendBidConfirmation(email: string, auctionTitle: string, bidAmount: number, auctionUrl: string) {
    const html = this._buildBaseTemplate(
      'Bid Successfully Placed',
      `
        <p>Your bid has been successfully recorded in our ledger.</p>
        <div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Auction:</strong> ${auctionTitle}</p>
          <p style="margin: 0; color: #10b981; font-weight: bold; font-size: 18px;">Bid Amount: ₹${bidAmount.toLocaleString()}</p>
        </div>
        <p>You will be notified immediately if you are outbid.</p>
      `,
      auctionUrl,
      'View Live Auction'
    );
    
    console.log(`[EMAIL DISPATCH] To: ${email} | Subject: Bid Confirmation - ${auctionTitle}`);
    console.log(html);
  },

  sendOutbidAlert(email: string, auctionTitle: string, auctionUrl: string) {
    const html = this._buildBaseTemplate(
      '⚠️ You Have Been Outbid',
      `
        <p>Another participant has placed a higher bid on an auction you are watching.</p>
        <p style="font-weight: bold; color: #0f172a;">${auctionTitle}</p>
        <p>The auction is still active. Click below to return to the bidding room and place a new counter-bid before time runs out.</p>
      `,
      auctionUrl,
      'Place New Bid'
    );
    
    console.log(`[EMAIL DISPATCH] To: ${email} | Subject: Urgent: Outbid Alert - ${auctionTitle}`);
    console.log(html);
  },

  sendEmdReceipt(email: string, amount: number, referenceId: string, walletUrl: string) {
    const html = this._buildBaseTemplate(
      'Deposit Receipt',
      `
        <p>We have successfully processed your wallet deposit.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 0; color: #64748b;">Transaction Ref</td>
            <td style="padding: 10px 0; font-family: monospace; text-align: right;">${referenceId}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 0; color: #64748b;">Date</td>
            <td style="padding: 10px 0; text-align: right;">${new Date().toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; font-weight: bold;">Amount Deposited</td>
            <td style="padding: 10px 0; font-weight: bold; color: #10b981; text-align: right;">₹${amount.toLocaleString()}</td>
          </tr>
        </table>
        <p>These funds are now available in your ledger to block EMDs for active auctions.</p>
      `,
      walletUrl,
      'View Wallet Balance'
    );
    
    console.log(`[EMAIL DISPATCH] To: ${email} | Subject: Receipt - Deposit of ₹${amount.toLocaleString()}`);
    console.log(html);
  }
};
