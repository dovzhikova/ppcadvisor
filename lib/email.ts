import { Resend } from 'resend';
import type { AuditRequest, AuditData } from './types';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM_EMAIL = process.env.EMAIL_FROM || 'PPC Advisor <audit@ppcadvisor.co.il>';
const TEAM_EMAIL = 'felix@ppcadvisor.co.il';

// ---------------------------------------------------------------------------
// Design tokens — email-safe solid approximations of site rgba values
// Site bg: #0E1F33 | Deep bg: #091525 | Primary: #4DBCD0
// ---------------------------------------------------------------------------
const BG = '#0E1F33';
const BG_DEEP = '#091525';
const PRIMARY = '#4DBCD0';
const CARD_BG = '#122338';        // rgba(255,255,255,0.04) on #0E1F33
const CARD_BORDER = '#253547';    // rgba(255,255,255,0.15) on #0E1F33
const TEXT_1 = '#ECECEC';         // primary text
const TEXT_2 = '#B0BAC4';         // rgba(236,236,236,0.6)
const TEXT_3 = '#8E9BA8';         // rgba(236,236,236,0.45)
const TEXT_MUTED = '#5A6570';     // rgba(236,236,236,0.3)
const DIVIDER = '#1A2D42';        // rgba(77,188,208,0.08)

function scoreColor(score: number): string {
  if (score >= 90) return PRIMARY;
  if (score >= 50) return '#ffa400';
  return '#ff4e42';
}

function aiStatusIcon(found: boolean | null): string {
  if (found === true) return '\u2705';
  if (found === false) return '\u274C';
  return '\u2754';
}

// Glass card wrapper — email-safe approximation of site's .svc-glass
function glassCard(content: string, padding = '20px 24px'): string {
  return `<div style="background:${CARD_BG};border:1px solid ${CARD_BORDER};border-radius:16px;padding:${padding};">${content}</div>`;
}

// Score card — matches site .stat-card (border-radius:43px)
function scoreCard(value: string, label: string, color = PRIMARY): string {
  return `<td style="padding:0 4px;">
    <div style="background:${CARD_BG};border:1px solid ${CARD_BORDER};border-radius:20px;padding:18px 8px;text-align:center;">
      <div style="font-size:28px;font-weight:800;color:${color};line-height:1;letter-spacing:-0.02em;">${value}</div>
      <div style="font-size:11px;font-weight:600;color:${TEXT_3};margin-top:6px;">${label}</div>
    </div>
  </td>`;
}

// Impact badge — matches site action plan badges
function impactLabel(impact: string): string {
  const m: Record<string, { bg: string; color: string; label: string }> = {
    high:   { bg: '#2A1516', color: '#ff6b5e', label: '\u05D2\u05D1\u05D5\u05D4' },
    medium: { bg: '#2A2215', color: '#ffb84d', label: '\u05D1\u05D9\u05E0\u05D5\u05E0\u05D9' },
    low:    { bg: '#152A2D', color: PRIMARY, label: '\u05E0\u05DE\u05D5\u05DA' },
  };
  const c = m[impact] || m.medium;
  return `<span style="display:inline-block;padding:4px 14px;border-radius:500px;font-size:11px;font-weight:700;background:${c.bg};color:${c.color};">${c.label}</span>`;
}

export function buildUserEmailHTML(data: AuditData): string {
  const domain = data.request.website.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const ps = data.pageSpeed;
  const hasScores = ps.performanceScore > 0;
  const topActions = data.report.actionPlan.slice(0, 3);
  const loadTime = data.scraped.loadTimeMs > 0 ? `${(data.scraped.loadTimeMs / 1000).toFixed(1)}s` : '\u2014';

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${BG_DEEP};font-family:'Heebo','Helvetica Neue',Arial,sans-serif;direction:rtl;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG_DEEP};">
<tr><td align="center" style="padding:32px 16px;">

<!-- Main card -->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${BG};border-radius:20px;overflow:hidden;border:1px solid ${CARD_BORDER};box-shadow:0 24px 80px rgba(0,0,0,0.25);">

<!-- Header with logo — matches site header -->
<tr><td style="padding:28px 40px;border-bottom:1px solid ${DIVIDER};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td style="text-align:right;">
      <img src="https://ppcadvisor.co.il/logo-horizontal-white.png" height="28" style="height:28px;width:auto;display:inline-block;vertical-align:middle;" alt="PPC Advisor">
    </td>
    <td style="text-align:left;">
      <span style="display:inline-block;padding:5px 16px;border-radius:500px;border:1px solid #1D3A4A;background:#0F2237;color:${PRIMARY};font-size:11px;font-weight:700;letter-spacing:0.06em;">\u05D3\u05D5\u05D7 \u05D0\u05D1\u05D7\u05D5\u05DF \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9</span>
    </td>
  </tr>
  </table>
</td></tr>

<!-- Domain hero -->
<tr><td style="padding:32px 40px 8px;text-align:center;">
  <div style="font-size:32px;font-weight:800;color:${PRIMARY};letter-spacing:-0.03em;line-height:1;">${domain}</div>
  <div style="font-size:16px;font-weight:400;color:${TEXT_2};margin-top:8px;">\u05D1\u05D9\u05E7\u05D5\u05E8\u05EA \u05E0\u05D5\u05DB\u05D7\u05D5\u05EA \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9\u05EA</div>
</td></tr>

<!-- Greeting -->
<tr><td style="padding:20px 40px 0;">
  <p style="margin:0;font-size:17px;font-weight:700;color:${TEXT_1};">\u05E9\u05DC\u05D5\u05DD ${data.request.name},</p>
  <p style="margin:10px 0 0;font-size:14px;color:${TEXT_2};line-height:1.7;">
    \u05D4\u05D3\u05D5\u05D7 \u05E9\u05DC\u05DA \u05DE\u05D5\u05DB\u05DF! \u05D1\u05D9\u05E6\u05E2\u05E0\u05D5 \u05D0\u05D1\u05D7\u05D5\u05DF \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9 \u05DE\u05E7\u05D9\u05E3 \u05DC\u05D0\u05EA\u05E8 \u05E9\u05DC\u05DA \u05D5\u05D4\u05E0\u05D4 \u05EA\u05E7\u05E6\u05D9\u05E8 \u05E9\u05DC \u05D4\u05DE\u05DE\u05E6\u05D0\u05D9\u05DD \u05D4\u05E2\u05D9\u05E7\u05E8\u05D9\u05D9\u05DD.
    \u05D4\u05D3\u05D5\u05D7 \u05D4\u05DE\u05DC\u05D0 \u05DE\u05E6\u05D5\u05E8\u05E3 \u05DB\u05E7\u05D5\u05D1\u05E5 PDF.
  </p>
</td></tr>

<!-- Score cards row -->
${hasScores ? `
<tr><td style="padding:24px 40px 16px;">
  <div style="font-size:13px;font-weight:700;color:${PRIMARY};margin-bottom:12px;letter-spacing:0.04em;">\u05E6\u05D9\u05D5\u05E0\u05D9 \u05D1\u05D9\u05E6\u05D5\u05E2\u05D9\u05DD</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    ${scoreCard(String(ps.performanceScore), '\u05D1\u05D9\u05E6\u05D5\u05E2\u05D9\u05DD', scoreColor(ps.performanceScore))}
    ${scoreCard(String(ps.seoScore), 'SEO', scoreColor(ps.seoScore))}
    ${scoreCard(String(ps.accessibilityScore), '\u05E0\u05D2\u05D9\u05E9\u05D5\u05EA', scoreColor(ps.accessibilityScore))}
    ${scoreCard(loadTime, '\u05D6\u05DE\u05DF \u05D8\u05E2\u05D9\u05E0\u05D4')}
  </tr>
  </table>
</td></tr>
` : `
<tr><td style="padding:24px 40px 16px;">
  ${glassCard(`
    <span style="font-size:18px;font-weight:800;color:${TEXT_1};">${loadTime}</span>
    <span style="font-size:12px;color:${TEXT_3};margin-right:8px;">\u05D6\u05DE\u05DF \u05D8\u05E2\u05D9\u05E0\u05D4</span>
  `, '16px 20px')}
</td></tr>
`}

<!-- AI Presence row -->
<tr><td style="padding:0 40px 24px;">
  <div style="font-size:13px;font-weight:700;color:${PRIMARY};margin-bottom:12px;letter-spacing:0.04em;">\u05E0\u05D5\u05DB\u05D7\u05D5\u05EA \u05D1\u05DE\u05E0\u05D5\u05E2\u05D9 AI</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td width="33%" style="padding:0 4px;">
      <div style="background:${CARD_BG};border:1px solid ${CARD_BORDER};border-radius:16px;padding:14px 8px;text-align:center;">
        <div style="font-size:22px;line-height:1;">${aiStatusIcon(data.aiPresence.foundInChatGPT)}</div>
        <div style="font-size:12px;font-weight:600;color:${TEXT_2};margin-top:6px;">ChatGPT</div>
      </div>
    </td>
    <td width="33%" style="padding:0 4px;">
      <div style="background:${CARD_BG};border:1px solid ${CARD_BORDER};border-radius:16px;padding:14px 8px;text-align:center;">
        <div style="font-size:22px;line-height:1;">${aiStatusIcon(data.aiPresence.foundInGemini)}</div>
        <div style="font-size:12px;font-weight:600;color:${TEXT_2};margin-top:6px;">Gemini</div>
      </div>
    </td>
    <td width="33%" style="padding:0 4px;">
      <div style="background:${CARD_BG};border:1px solid ${CARD_BORDER};border-radius:16px;padding:14px 8px;text-align:center;">
        <div style="font-size:22px;line-height:1;">${aiStatusIcon(data.aiPresence.foundInPerplexity)}</div>
        <div style="font-size:12px;font-weight:600;color:${TEXT_2};margin-top:6px;">Perplexity</div>
      </div>
    </td>
  </tr>
  </table>
</td></tr>

<!-- Divider -->
<tr><td style="padding:0 40px;"><div style="height:1px;background:${DIVIDER};"></div></td></tr>

<!-- Action plan items — matches site process steps -->
<tr><td style="padding:24px 40px;">
  <div style="font-size:13px;font-weight:700;color:${PRIMARY};margin-bottom:16px;letter-spacing:0.04em;">\u05EA\u05D5\u05DB\u05E0\u05D9\u05EA \u05E4\u05E2\u05D5\u05DC\u05D4 \u05DE\u05D5\u05DE\u05DC\u05E6\u05EA</div>
  ${topActions.map((item, i) => `
    <div style="margin-bottom:${i < topActions.length - 1 ? '16px' : '0'};">
      ${glassCard(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="36" style="vertical-align:top;padding-left:14px;">
            <div style="width:32px;height:32px;border-radius:50%;background:#153040;border:2px solid #1D4A58;color:${PRIMARY};font-size:14px;font-weight:800;text-align:center;line-height:28px;">${i + 1}</div>
          </td>
          <td style="vertical-align:top;">
            <div style="font-size:14px;font-weight:700;color:${TEXT_1};margin-bottom:4px;">${item.title}</div>
            <div style="font-size:12px;color:${TEXT_3};line-height:1.55;">${item.description.slice(0, 140)}${item.description.length > 140 ? '...' : ''}</div>
            <div style="margin-top:8px;">${impactLabel(item.impact)}</div>
          </td>
        </tr>
        </table>
      `, '16px')}
    </div>
  `).join('')}
</td></tr>

<!-- Divider -->
<tr><td style="padding:0 40px;"><div style="height:1px;background:${DIVIDER};"></div></td></tr>

<!-- CTA section — matches site .cta glass card -->
<tr><td style="padding:28px 40px;">
  ${glassCard(`
    <div style="text-align:center;">
      <div style="font-size:18px;font-weight:800;color:${TEXT_1};margin-bottom:8px;">\u05E8\u05D5\u05E6\u05D9\u05DD \u05DC\u05E9\u05E4\u05E8 \u05D0\u05EA \u05D4\u05EA\u05D5\u05E6\u05D0\u05D5\u05EA?</div>
      <p style="margin:0 0 20px;font-size:13px;color:${TEXT_2};line-height:1.6;">
        \u05E6\u05D5\u05D5\u05EA PPC Advisor \u05D9\u05E2\u05D6\u05D5\u05E8 \u05DC\u05DB\u05DD \u05DC\u05DE\u05DE\u05E9 \u05D0\u05EA \u05D4\u05DE\u05DC\u05E6\u05D5\u05EA \u05D4\u05D0\u05DC\u05D5
        \u05D5\u05DC\u05D4\u05E4\u05D5\u05DA \u05D0\u05EA \u05D4\u05E0\u05D5\u05DB\u05D7\u05D5\u05EA \u05D4\u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9\u05EA \u05E9\u05DC\u05DB\u05DD \u05DC\u05DE\u05DB\u05D5\u05E0\u05EA \u05E6\u05DE\u05D9\u05D7\u05D4
      </p>
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://wa.me/972587497497" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="50%" fillcolor="${PRIMARY}">
        <w:anchorlock/>
        <center style="color:${BG};font-family:'Heebo',sans-serif;font-size:16px;font-weight:700;">\u05D3\u05D1\u05E8\u05D5 \u05D0\u05D9\u05EA\u05E0\u05D5 \u2190</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="https://wa.me/972587497497" style="display:inline-block;background:${PRIMARY};color:${BG};padding:14px 44px;border-radius:500px;font-weight:700;font-size:16px;text-decoration:none;letter-spacing:-0.01em;">
        \u05D3\u05D1\u05E8\u05D5 \u05D0\u05D9\u05EA\u05E0\u05D5 \u2190
      </a>
      <!--<![endif]-->
      <div style="margin-top:14px;font-size:12px;color:${TEXT_MUTED};">
        \u05D4\u05D9\u05D9\u05E2\u05D5\u05E5 \u05D4\u05E8\u05D0\u05E9\u05D5\u05E0\u05D9 \u05D7\u05D9\u05E0\u05DD \u05D5\u05D1\u05DC\u05D9 \u05D4\u05EA\u05D7\u05D9\u05D9\u05D1\u05D5\u05EA
      </div>
    </div>
  `, '28px 32px')}
</td></tr>

<!-- Footer — matches site footer -->
<tr><td style="padding:24px 40px;text-align:center;border-top:1px solid ${DIVIDER};background:${BG_DEEP};">
  <div style="margin-bottom:10px;">
    <img src="https://ppcadvisor.co.il/logo-horizontal-white.png" height="20" style="height:20px;width:auto;" alt="PPC Advisor">
  </div>
  <div style="font-size:12px;color:${TEXT_MUTED};line-height:1.8;">
    058-749-7497 &nbsp;\u00B7&nbsp; felix@ppcadvisor.co.il
  </div>
  <div style="margin-top:8px;font-size:11px;color:#3A4550;">
    \u00A9 ${new Date().getFullYear()} PPC Advisor. \u05DB\u05DC \u05D4\u05D6\u05DB\u05D5\u05D9\u05D5\u05EA \u05E9\u05DE\u05D5\u05E8\u05D5\u05EA.
  </div>
</td></tr>

</table>
<!-- /Main card -->

</td></tr>
</table>
</body>
</html>`;
}

export function buildTeamNotificationHTML(request: AuditRequest): string {
  const domain = request.website.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${BG_DEEP};font-family:'Heebo','Helvetica Neue',Arial,sans-serif;direction:rtl;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG_DEEP};">
<tr><td align="center" style="padding:24px 16px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${BG};border-radius:20px;overflow:hidden;border:1px solid ${CARD_BORDER};">

<!-- Header -->
<tr><td style="padding:24px 32px;border-bottom:1px solid ${DIVIDER};">
  <img src="https://ppcadvisor.co.il/logo-horizontal-white.png" height="22" style="height:22px;width:auto;display:inline-block;vertical-align:middle;" alt="PPC Advisor">
  <span style="float:left;display:inline-block;padding:4px 14px;border-radius:500px;background:#2A1516;color:#ff6b5e;font-size:11px;font-weight:700;">\u05DC\u05D9\u05D3 \u05D7\u05D3\u05E9</span>
</td></tr>

<!-- Content -->
<tr><td style="padding:24px 32px;">
  <div style="font-size:20px;font-weight:800;color:${TEXT_1};margin-bottom:4px;">${request.name}</div>
  <div style="font-size:14px;color:${PRIMARY};margin-bottom:20px;">${domain}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD_BG};border:1px solid ${CARD_BORDER};border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid ${DIVIDER};font-size:12px;font-weight:700;color:${TEXT_3};width:100px;">\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC</td>
      <td style="padding:12px 16px;border-bottom:1px solid ${DIVIDER};font-size:13px;color:${TEXT_1};"><a href="mailto:${request.email}" style="color:${PRIMARY};text-decoration:none;">${request.email}</a></td>
    </tr>
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid ${DIVIDER};font-size:12px;font-weight:700;color:${TEXT_3};">\u05D8\u05DC\u05E4\u05D5\u05DF</td>
      <td style="padding:12px 16px;border-bottom:1px solid ${DIVIDER};font-size:13px;color:${TEXT_1};">${request.phone}</td>
    </tr>
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid ${DIVIDER};font-size:12px;font-weight:700;color:${TEXT_3};">\u05D0\u05EA\u05E8</td>
      <td style="padding:12px 16px;border-bottom:1px solid ${DIVIDER};font-size:13px;color:${TEXT_1};"><a href="${request.website}" style="color:${PRIMARY};text-decoration:none;">${request.website}</a></td>
    </tr>
    <tr>
      <td style="padding:12px 16px;font-size:12px;font-weight:700;color:${TEXT_3};">\u05DE\u05E7\u05D5\u05E8</td>
      <td style="padding:12px 16px;font-size:13px;color:${TEXT_2};">${request.source}</td>
    </tr>
  </table>

  <div style="margin-top:16px;font-size:12px;color:${TEXT_MUTED};">\u05D4\u05D3\u05D5\u05D7 \u05E0\u05D5\u05E6\u05E8 \u05D5\u05E0\u05E9\u05DC\u05D7 \u05DC\u05DC\u05E7\u05D5\u05D7 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4.</div>
</td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

export async function sendAuditEmail(
  auditData: AuditData,
  pdfBuffer: Buffer,
): Promise<void> {
  const domain = new URL(auditData.request.website).hostname;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: auditData.request.email,
    subject: `\u05D4\u05D3\u05D5\u05D7 \u05E9\u05DC\u05DA \u05DE\u05D5\u05DB\u05DF \u2014 \u05D0\u05D1\u05D7\u05D5\u05DF \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9 \u05DC-${domain}`,
    html: buildUserEmailHTML(auditData),
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
    subject: `\u05DC\u05D9\u05D3 \u05D7\u05D3\u05E9: ${auditData.request.name} \u2014 ${domain}`,
    html: buildTeamNotificationHTML(auditData.request),
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
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${BG_DEEP};font-family:'Heebo',sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG_DEEP};">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${BG};border-radius:20px;overflow:hidden;border:1px solid ${CARD_BORDER};">
  <tr><td style="padding:24px 32px;border-bottom:1px solid ${DIVIDER};">
    <img src="https://ppcadvisor.co.il/logo-horizontal-white.png" height="22" style="height:22px;width:auto;display:inline-block;vertical-align:middle;" alt="PPC Advisor">
    <span style="float:left;display:inline-block;padding:4px 14px;border-radius:500px;background:#2A1516;color:#ff4e42;font-size:11px;font-weight:700;">ERROR</span>
  </td></tr>
  <tr><td style="padding:24px 32px;">
    <div style="font-size:14px;color:${TEXT_1};margin-bottom:16px;">
      <strong>\u05DC\u05E7\u05D5\u05D7:</strong> ${request.name} (${request.email})<br>
      <strong>\u05D0\u05EA\u05E8:</strong> ${request.website}
    </div>
    <div style="background:${CARD_BG};border:1px solid ${CARD_BORDER};border-radius:12px;padding:16px;overflow-x:auto;">
      <pre style="margin:0;font-size:12px;color:#ff6b5e;white-space:pre-wrap;word-break:break-all;font-family:monospace;">${error}</pre>
    </div>
    <div style="margin-top:16px;font-size:13px;color:${TEXT_3};">Please follow up with the client manually.</div>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`,
  });
}
