# 📱 Meta WhatsApp Business Cloud API Setup Guide

This guide walks you through setting up the official **Meta WhatsApp Business Cloud API** for the Lelam Auction Platform to enable:
1. **Transactional Alerts**: Instant notifications for bid confirmations, outbid alerts, auction closing reminders, and EMD receipts.
2. **Interactive Support & Query Bot**: Allow scrap buyers to search live auctions and check bid status directly inside WhatsApp.
3. **Marketing Broadcasts**: Send targeted category updates and tender digests to opt-in buyers.

---

## 1. Meta Developer Account & WhatsApp App

1. Go to [Meta for Developers](https://developers.facebook.com/) and log in with your Facebook account.
2. Click **My Apps** > **Create App**.
3. Select **Other** > **Business** as the app type.
4. Name your app (e.g. `Lelam Auction WhatsApp`) and link your **Meta Business Account**.
5. On the App Dashboard, scroll to **WhatsApp** and click **Set up**.

---

## 2. Retrieve Credentials

Once WhatsApp is added to your app, navigate to **WhatsApp > API Setup** on the left menu:

1. **Test Phone Number**:
   - Meta gives you a free **Test WhatsApp Phone Number** for development.
   - Note the **Phone number ID** and **WhatsApp Business Account ID**.
2. **Access Token**:
   - For quick testing, you can use the **Temporary access token** shown on the API Setup page (valid for 24 hours).
   - **For Production (Permanent Token)**:
     - Go to [Meta Business Settings](https://business.facebook.com/settings/).
     - Go to **Users > System Users** and click **Add**.
     - Give the system user the **Admin** role.
     - Under **Assigned Assets**, assign your WhatsApp App with full control.
     - Click **Generate New Token**, select your app, check `whatsapp_business_management` and `whatsapp_business_messaging`, and generate a permanent token.
3. Copy these credentials into your `.env` or `.env.local`:
   ```env
   WHATSAPP_TOKEN=EAAB...
   WHATSAPP_PHONE_NUMBER_ID=100000000000000
   WHATSAPP_BUSINESS_ACCOUNT_ID=200000000000000
   WHATSAPP_VERIFY_TOKEN=lelam_whatsapp_verify_secret
   ```

---

## 3. Registering Message Templates

Meta requires pre-approved **Message Templates** for business-initiated messages outside the 24-hour customer service window.

In **Meta WhatsApp Manager** (via API Setup > "To create your own message template, click here"):

### Template 1: `bid_confirmation`
- **Category**: UTILITY
- **Language**: English (`en`)
- **Body**:
  ```text
  Hello {{1}}, your bid of {{2}} has been confirmed for:
  "{{3}}"

  Track your auction and live bids here:
  {{4}}
  ```
- **Sample values**:
  - `{{1}}`: Rajesh
  - `{{2}}`: ₹2,50,000
  - `{{3}}`: Heavy Copper Scrap Lot #4910
  - `{{4}}`: https://lelam.co/auctions/demo

### Template 2: `outbid_alert`
- **Category**: UTILITY
- **Language**: English (`en`)
- **Body**:
  ```text
  Hello {{1}}, another bidder has placed a higher bid on:
  "{{2}}"

  Don't let it slip away! Place your counter-bid now:
  {{3}}
  ```
- **Sample values**:
  - `{{1}}`: Rajesh
  - `{{2}}`: Heavy Copper Scrap Lot #4910
  - `{{3}}`: https://lelam.co/auctions/demo

*(Note: If a template is still pending Meta approval or not yet registered, the Lelam integration automatically falls back to direct messaging within active 24-hour service sessions).*

---

## 4. Webhook Configuration (For 2-Way Bot & Delivery Reports)

1. Deploy your app or expose your local dev server using an HTTPS tunnel (e.g. ngrok: `ngrok http 5173`).
2. In Meta App Dashboard, navigate to **WhatsApp > Configuration**:
   - **Callback URL**: `https://<your-domain-or-ngrok>/api/whatsapp-webhook`
   - **Verify Token**: Enter the same token set in `WHATSAPP_VERIFY_TOKEN` (default: `lelam_whatsapp_verify_secret`).
   - Click **Verify and Save**.
3. Under **Webhook fields**, click **Manage**:
   - Subscribe to **`messages`** (for inbound messages from buyers).
   - Subscribe to **`message_template_status_update`** (optional, to track template approvals).

---

## 5. Testing WhatsApp Automation

### Using the CLI Test Runner
Run test dispatches and bot simulations directly from your terminal:

```bash
# 1. Inspect configuration status & help
npx tsx scripts/test-whatsapp.ts

# 2. Test text message dispatch (simulates in mock mode if token is empty)
npx tsx scripts/test-whatsapp.ts --text 919876543210 "Hello from Lelam!"

# 3. Test interactive buttons
npx tsx scripts/test-whatsapp.ts --buttons 919876543210

# 4. Test pre-approved template message
npx tsx scripts/test-whatsapp.ts --template 919876543210 bid_confirmation

# 5. Simulate inbound user query to test the Bot ("search copper")
npx tsx scripts/test-whatsapp.ts --simulate-inbound search copper
```

### In-App UI Testing
1. Navigate to **Dashboard > Settings > Communication Preferences**.
2. Under **WhatsApp Notifications**, ensure your phone number is saved.
3. Click **Test WhatsApp** to receive a verification alert on your mobile.

---

## 6. Going Live in Production

1. Navigate to **WhatsApp > Getting Started > Add a real phone number**.
2. Follow Meta's verification steps (SMS/voice call OTP).
3. Ensure your Meta Business Account is verified under **Business Settings > Security Center**.
4. Set the production environment variables on Vercel:
   - `WHATSAPP_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_BUSINESS_ACCOUNT_ID`
   - `WHATSAPP_VERIFY_TOKEN`
