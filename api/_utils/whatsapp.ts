import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const getWhatsAppToken = () => process.env.WHATSAPP_TOKEN || '';
const getWhatsAppPhoneId = () => process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const getWhatsAppApiVersion = () => process.env.WHATSAPP_API_VERSION || 'v21.0';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

/**
 * Normalizes phone numbers to Meta's expected E.164 without leading '+' or punctuation.
 * If 10 digits are passed without country code, defaults to India (+91).
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  let digits = rawPhone.replace(/\D/g, '');

  // Strip leading zeros
  digits = digits.replace(/^0+/, '');

  // If 10-digit Indian number, prepend 91
  if (digits.length === 10) {
    digits = `91${digits}`;
  }

  return digits;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  isMock?: boolean;
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: 'url' | 'quick_reply';
  index?: string;
  parameters: Array<{
    type: 'text' | 'currency' | 'date_time' | 'image';
    text?: string;
    currency?: { fallback_value: string; code: string; amount_1000: number };
    date_time?: { fallback_value: string };
    image?: { link: string };
  }>;
}

/**
 * Log message event into whatsapp_messages database table for auditing
 */
async function logWhatsAppRecord(record: {
  userId?: string | null;
  phone: string;
  direction: 'inbound' | 'outbound';
  type: string;
  templateName?: string;
  content: string;
  payload?: any;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  whatsappMessageId?: string;
  errorMessage?: string;
}) {
  if (!supabase) return;
  try {
    await supabase.from('whatsapp_messages').insert({
      user_id: record.userId || null,
      phone: record.phone,
      direction: record.direction,
      type: record.type,
      template_name: record.templateName || null,
      content: record.content,
      payload: record.payload || null,
      status: record.status,
      whatsapp_message_id: record.whatsappMessageId || null,
      error_message: record.errorMessage || null,
    });
  } catch (err: any) {
    console.warn('[WhatsApp] Failed to write audit log to database:', err.message || err);
  }
}

/**
 * Send official Meta WhatsApp Cloud API request
 */
async function callMetaGraphApi(payload: Record<string, any>): Promise<any> {
  const token = getWhatsAppToken();
  const phoneId = getWhatsAppPhoneId();
  const apiVersion = getWhatsAppApiVersion();
  const url = `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data?.error?.message || response.statusText;
    throw new Error(`Meta API error (${response.status}): ${errorMsg}`);
  }

  return data;
}

/**
 * Sends a pre-approved template message (required by Meta for business-initiated notifications outside 24h window).
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string = 'en',
  components: TemplateComponent[] = [],
  userId?: string
): Promise<WhatsAppSendResult> {
  const phone = normalizePhoneNumber(to);
  if (!phone) {
    return { success: false, error: 'Invalid phone number provided' };
  }

  // Summary content description for auditing
  const contentSummary = `Template: ${templateName} (${components.map(c => c.parameters.map(p => p.text).filter(Boolean).join(', ')).join(' | ')})`;

  // Mock / Dev fallback if token or phone number id is missing
  if (!getWhatsAppToken() || !getWhatsAppPhoneId()) {
    const mockId = `mock_wam_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    console.log(`\x1b[36m[WhatsApp Mock: Template]\x1b[0m To: +${phone} | Template: ${templateName}`);
    console.log(`\x1b[90mPayload: ${JSON.stringify(components)}\x1b[0m`);

    await logWhatsAppRecord({
      userId,
      phone,
      direction: 'outbound',
      type: 'template',
      templateName,
      content: contentSummary,
      payload: components,
      status: 'sent',
      whatsappMessageId: mockId,
    });

    return { success: true, messageId: mockId, isMock: true };
  }

  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: components.length > 0 ? components : undefined,
      },
    };

    const res = await callMetaGraphApi(payload);
    const messageId = res?.messages?.[0]?.id;

    await logWhatsAppRecord({
      userId,
      phone,
      direction: 'outbound',
      type: 'template',
      templateName,
      content: contentSummary,
      payload: components,
      status: 'sent',
      whatsappMessageId: messageId,
    });

    return { success: true, messageId };
  } catch (err: any) {
    console.error(`[WhatsApp] Failed to send template '${templateName}' to +${phone}:`, err.message || err);

    await logWhatsAppRecord({
      userId,
      phone,
      direction: 'outbound',
      type: 'template',
      templateName,
      content: contentSummary,
      payload: components,
      status: 'failed',
      errorMessage: err.message,
    });

    return { success: false, error: err.message };
  }
}

/**
 * Sends a freeform text message (Used within 24h user-initiated conversation window or bot replies).
 */
export async function sendWhatsAppText(
  to: string,
  text: string,
  previewUrl: boolean = false,
  userId?: string
): Promise<WhatsAppSendResult> {
  const phone = normalizePhoneNumber(to);
  if (!phone) {
    return { success: false, error: 'Invalid phone number provided' };
  }

  if (!getWhatsAppToken() || !getWhatsAppPhoneId()) {
    const mockId = `mock_wam_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    console.log(`\x1b[32m[WhatsApp Mock: Text]\x1b[0m To: +${phone}`);
    console.log(`\x1b[37m${text}\x1b[0m`);

    await logWhatsAppRecord({
      userId,
      phone,
      direction: 'outbound',
      type: 'text',
      content: text,
      status: 'sent',
      whatsappMessageId: mockId,
    });

    return { success: true, messageId: mockId, isMock: true };
  }

  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: {
        preview_url: previewUrl,
        body: text,
      },
    };

    const res = await callMetaGraphApi(payload);
    const messageId = res?.messages?.[0]?.id;

    await logWhatsAppRecord({
      userId,
      phone,
      direction: 'outbound',
      type: 'text',
      content: text,
      status: 'sent',
      whatsappMessageId: messageId,
    });

    return { success: true, messageId };
  } catch (err: any) {
    console.error(`[WhatsApp] Failed to send text to +${phone}:`, err.message || err);

    await logWhatsAppRecord({
      userId,
      phone,
      direction: 'outbound',
      type: 'text',
      content: text,
      status: 'failed',
      errorMessage: err.message,
    });

    return { success: false, error: err.message };
  }
}

/**
 * Sends an interactive quick-reply message (Up to 3 buttons, for conversational bot menus).
 */
export async function sendWhatsAppInteractiveButtons(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  headerText?: string,
  footerText?: string,
  userId?: string
): Promise<WhatsAppSendResult> {
  const phone = normalizePhoneNumber(to);
  if (!phone) return { success: false, error: 'Invalid phone number' };

  if (!getWhatsAppToken() || !getWhatsAppPhoneId()) {
    const mockId = `mock_wam_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    console.log(`\x1b[35m[WhatsApp Mock: Interactive Buttons]\x1b[0m To: +${phone}`);
    if (headerText) console.log(`Header: ${headerText}`);
    console.log(`Body: ${bodyText}`);
    console.log(`Buttons: ${buttons.map(b => `[${b.title}]`).join(' ')}`);

    await logWhatsAppRecord({
      userId,
      phone,
      direction: 'outbound',
      type: 'interactive',
      content: `${bodyText} (Buttons: ${buttons.map(b => b.title).join(', ')})`,
      status: 'sent',
      whatsappMessageId: mockId,
    });

    return { success: true, messageId: mockId, isMock: true };
  }

  try {
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.slice(0, 3).map(btn => ({
            type: 'reply',
            reply: { id: btn.id, title: btn.title.slice(0, 20) },
          })),
        },
      },
    };

    if (headerText) {
      payload.interactive.header = { type: 'text', text: headerText };
    }
    if (footerText) {
      payload.interactive.footer = { text: footerText };
    }

    const res = await callMetaGraphApi(payload);
    const messageId = res?.messages?.[0]?.id;

    await logWhatsAppRecord({
      userId,
      phone,
      direction: 'outbound',
      type: 'interactive',
      content: bodyText,
      payload: buttons,
      status: 'sent',
      whatsappMessageId: messageId,
    });

    return { success: true, messageId };
  } catch (err: any) {
    console.error(`[WhatsApp] Failed to send interactive buttons to +${phone}:`, err.message || err);
    return { success: false, error: err.message };
  }
}

/**
 * Mark an incoming WhatsApp message as read to display double blue ticks
 */
export async function markWhatsAppMessageAsRead(messageId: string): Promise<boolean> {
  if (!getWhatsAppToken() || !getWhatsAppPhoneId() || !messageId || messageId.startsWith('mock_')) {
    return true;
  }

  try {
    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };
    await callMetaGraphApi(payload);
    return true;
  } catch (err: any) {
    console.warn('[WhatsApp] Mark as read warning:', err.message || err);
    return false;
  }
}
