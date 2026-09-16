/**
 * Pipeline & Worker Failure Alerting Service
 *
 * Automatically dispatches critical pipeline alerts via email / system logs
 * whenever document mirroring or scraper ingestion experiences unhandled errors.
 */
import { sendEmail } from "../../../api/utils/email.js";
import { logger } from "./logger.js";

const log = logger.child({ module: "alertingService" });
const ALERT_RECIPIENT = process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_FROM || "admin@lelam.co";

export interface PipelineAlertPayload {
  serviceName: string;
  totalInspected: number;
  totalFailed: number;
  failures: Array<{ auctionId: string; url?: string; error: string }>;
}

export async function sendPipelineFailureAlert(payload: PipelineAlertPayload): Promise<boolean> {
  if (!payload.totalFailed || payload.totalFailed === 0) {
    return true;
  }

  log.warn(
    { service: payload.serviceName, failedCount: payload.totalFailed },
    "Dispatching pipeline failure alert"
  );

  const failureRowsHtml = payload.failures
    .slice(0, 20)
    .map(
      (f) =>
        `<tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb; font-family: monospace;">${f.auctionId}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb; word-break: break-all;">${f.url || "N/A"}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb; color: #dc2626;">${f.error}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; margin: 0 auto; color: #1f2937;">
      <h2 style="color: #dc2626; border-bottom: 2px solid #fee2e2; padding-bottom: 8px;">
        ⚠️ Scraping Pipeline Alert: ${payload.serviceName}
      </h2>
      <p>The automated ingestion / asset worker detected <strong>${payload.totalFailed}</strong> failure(s) during its latest run.</p>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Auction ID</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Target URL</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Error Reason</th>
          </tr>
        </thead>
        <tbody>
          ${failureRowsHtml}
        </tbody>
      </table>

      <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">
        Total Inspected: ${payload.totalInspected} | Failed: ${payload.totalFailed} | Environment: ${process.env.NODE_ENV || "production"}
      </p>
    </div>
  `;

  try {
    return await sendEmail({
      to: ALERT_RECIPIENT,
      subject: `🚨 [Alert] ${payload.serviceName}: ${payload.totalFailed} Failures Detected`,
      html,
    });
  } catch (err: any) {
    log.error({ error: err.message }, "Failed to send pipeline failure alert email");
    return false;
  }
}
