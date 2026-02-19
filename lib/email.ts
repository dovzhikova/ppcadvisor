import { Resend } from 'resend';
import type { AuditRequest } from './types';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM_EMAIL = process.env.EMAIL_FROM || 'PPC Advisor <onboarding@resend.dev>';
const TEAM_EMAIL = 'felix@ppcadvisor.co.il';

export function buildUserEmailHTML(name: string, domain: string, keyFindings: string[]): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;direction:rtl;margin:0;padding:0;background:#f5f5f5;">
<div style="max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:#060d18;padding:24px;text-align:center;">
    <span style="color:#4dbcd0;font-size:24px;font-weight:700;">PPC Advisor</span>
  </div>
  <div style="padding:32px 24px;">
    <p style="font-size:16px;color:#333;">שלום ${name},</p>
    <p style="font-size:15px;color:#555;line-height:1.7;">
      הדוח שלכם מוכן! ביצענו אבחון דיגיטלי מקיף לאתר <strong>${domain}</strong> ומצאנו כמה תובנות חשובות:
    </p>
    <div style="background:#f0fafb;border-right:4px solid #4dbcd0;padding:16px;border-radius:0 8px 8px 0;margin:20px 0;">
      <ul style="margin:0;padding-right:20px;font-size:14px;color:#333;line-height:2;">
        ${keyFindings.map(f => `<li>${f}</li>`).join('')}
      </ul>
    </div>
    <p style="font-size:15px;color:#555;">
      הדוח המלא מצורף כקובץ PDF. מומלץ לעבור עליו ולהתחיל מהפעולות בעדיפות הגבוהה ביותר.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="https://wa.me/972587497497" style="display:inline-block;background:#4dbcd0;color:#fff;padding:14px 36px;border-radius:24px;font-weight:700;font-size:15px;text-decoration:none;">
        רוצים שנעבור על הדוח ביחד? דברו איתנו
      </a>
    </div>
    <p style="font-size:13px;color:#888;line-height:1.6;">
      הייעוץ הראשוני חינם ובלי התחייבות. אנחנו כאן לעזור.
    </p>
  </div>
  <div style="background:#f5f5f5;padding:16px 24px;text-align:center;font-size:11px;color:#999;">
    PPC Advisor | 058-749-7497 | felix@ppcadvisor.co.il
  </div>
</div>
</body>
</html>`;
}

export function buildTeamNotificationHTML(request: AuditRequest): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:sans-serif;padding:20px;">
  <h2 style="color:#4dbcd0;">New Audit Request</h2>
  <table style="border-collapse:collapse;width:100%;max-width:500px;">
    <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:700;">Name</td><td style="padding:8px;border-bottom:1px solid #eee;">${request.name}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:700;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;">${request.email}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:700;">Phone</td><td style="padding:8px;border-bottom:1px solid #eee;">${request.phone}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:700;">Website</td><td style="padding:8px;border-bottom:1px solid #eee;"><a href="${request.website}">${request.website}</a></td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:700;">Source</td><td style="padding:8px;border-bottom:1px solid #eee;">${request.source}</td></tr>
  </table>
  <p style="margin-top:16px;color:#888;">Audit report has been generated and sent to the client.</p>
</body></html>`;
}

export async function sendAuditEmail(
  request: AuditRequest,
  pdfBuffer: Buffer,
  keyFindings: string[]
): Promise<void> {
  const domain = new URL(request.website).hostname;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: request.email,
    subject: 'הדוח שלכם מוכן — אבחון דיגיטלי מ-PPC Advisor',
    html: buildUserEmailHTML(request.name, domain, keyFindings),
    attachments: [
      {
        filename: `audit-report-${domain}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: TEAM_EMAIL,
    subject: `ליד חדש: ${request.name} — ${domain}`,
    html: buildTeamNotificationHTML(request),
    attachments: [
      {
        filename: `audit-report-${domain}.pdf`,
        content: pdfBuffer,
      },
    ],
  });
}

export async function sendErrorNotification(request: AuditRequest, error: string): Promise<void> {
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: TEAM_EMAIL,
    subject: `[ERROR] Audit pipeline failed for ${request.website}`,
    html: `<h2>Pipeline Error</h2>
      <p><strong>Client:</strong> ${request.name} (${request.email})</p>
      <p><strong>Website:</strong> ${request.website}</p>
      <p><strong>Error:</strong></p>
      <pre style="background:#f5f5f5;padding:16px;border-radius:8px;overflow-x:auto;">${error}</pre>
      <p>Please follow up with the client manually.</p>`,
  });
}
