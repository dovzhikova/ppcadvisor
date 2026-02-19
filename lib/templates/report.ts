import * as fs from 'fs';
import * as path from 'path';
import type { AuditData } from '../types';

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 90) return '#0cce6b';
  if (score >= 50) return '#ffa400';
  return '#ff4e42';
}

function ratingColor(rating: 'good' | 'needs-improvement' | 'poor'): string {
  if (rating === 'good') return '#0cce6b';
  if (rating === 'needs-improvement') return '#ffa400';
  return '#ff4e42';
}

function ratingLabel(rating: 'good' | 'needs-improvement' | 'poor'): string {
  if (rating === 'good') return '\u05EA\u05E7\u05D9\u05DF';           // תקין
  if (rating === 'needs-improvement') return '\u05D3\u05D5\u05E8\u05E9 \u05E9\u05D9\u05E4\u05D5\u05E8'; // דורש שיפור
  return '\u05D1\u05E2\u05D9\u05D9\u05EA\u05D9';                      // בעייתי
}

function impactBadge(impact: 'high' | 'medium' | 'low'): string {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    high:   { bg: '#ff4e42', text: '#fff', label: '\u05D2\u05D1\u05D5\u05D4' },   // גבוה
    medium: { bg: '#ffa400', text: '#fff', label: '\u05D1\u05D9\u05E0\u05D5\u05E0\u05D9' }, // בינוני
    low:    { bg: '#0cce6b', text: '#fff', label: '\u05E0\u05DE\u05D5\u05DA' },    // נמוך
  };
  const c = colors[impact] || colors.medium;
  return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700;background:${c.bg};color:${c.text};">${c.label}</span>`;
}

function scoreGaugeSVG(score: number, label: string): string {
  const color = scoreColor(score);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return `
    <svg width="130" height="150" viewBox="0 0 130 150">
      <circle cx="65" cy="65" r="${radius}" fill="none" stroke="#e0e0e0" stroke-width="10"/>
      <circle cx="65" cy="65" r="${radius}" fill="none" stroke="${color}" stroke-width="10"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
        stroke-linecap="round" transform="rotate(-90 65 65)"/>
      <text x="65" y="70" text-anchor="middle" font-size="28" font-weight="700" fill="${color}">${score}</text>
      <text x="65" y="140" text-anchor="middle" font-size="13" fill="#333">${label}</text>
    </svg>`;
}

function loadAssetBase64(filename: string): string {
  try {
    const filePath = path.join(process.cwd(), filename);
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filename).replace('.', '').toLowerCase();
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// CSS Styles
// ---------------------------------------------------------------------------

function getStyles(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Heebo', sans-serif; color: #1a1a2e; background: #f5f5f5; line-height: 1.6; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; page-break-after: always; position: relative; overflow: hidden; }
    .page:last-child { page-break-after: avoid; }

    /* Cover page */
    .cover { background: #060d18; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 60px 40px; }
    .cover-logo { max-width: 220px; margin-bottom: 40px; }
    .cover h1 { font-size: 38px; font-weight: 900; margin-bottom: 12px; letter-spacing: -0.5px; }
    .cover h2 { font-size: 22px; font-weight: 400; color: #a0b4d0; margin-bottom: 8px; }
    .cover .cover-date { font-size: 16px; color: #6b7fa3; margin-top: 20px; }
    .cover .cover-divider { width: 80px; height: 3px; background: linear-gradient(90deg, #4a6cf7, #6c63ff); border-radius: 2px; margin: 30px auto; }
    .cover .partner-badges { display: flex; gap: 20px; margin-top: 40px; align-items: center; justify-content: center; }
    .cover .partner-badges img { height: 50px; opacity: 0.85; }

    /* Content pages */
    .content { background: #fff; padding: 40px 50px 80px; }
    .page-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #eaedf3; padding-bottom: 16px; margin-bottom: 30px; }
    .page-header img { height: 32px; }
    .page-header .header-title { font-size: 14px; color: #6b7fa3; }
    .page-footer { position: absolute; bottom: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 14px 50px; background: #f8f9fc; border-top: 1px solid #eaedf3; font-size: 11px; color: #8896ab; }
    .page-footer img { height: 20px; }
    .page-footer .footer-contact { text-align: center; }
    .page-footer .page-number { font-weight: 700; }

    h2.section-title { font-size: 24px; font-weight: 700; color: #060d18; margin-bottom: 20px; padding-bottom: 8px; border-bottom: 3px solid #4a6cf7; display: inline-block; }
    h3.sub-title { font-size: 18px; font-weight: 700; color: #1a1a2e; margin: 20px 0 10px; }

    .summary-box { background: linear-gradient(135deg, #f0f4ff 0%, #f8f9fc 100%); border-right: 4px solid #4a6cf7; border-radius: 8px; padding: 20px 24px; margin-bottom: 24px; font-size: 15px; }

    .screenshots { display: flex; gap: 24px; margin-top: 16px; }
    .screenshot-card { flex: 1; text-align: center; }
    .screenshot-card img { max-width: 100%; border-radius: 8px; border: 1px solid #e0e0e0; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
    .screenshot-card .caption { margin-top: 8px; font-size: 13px; color: #6b7fa3; }
    .screenshot-observation { font-size: 13px; color: #444; margin-top: 6px; background: #fafbfd; padding: 8px 12px; border-radius: 6px; }

    .scores-grid { display: flex; gap: 16px; justify-content: center; margin: 24px 0; }
    .vital-cards { display: flex; gap: 16px; margin: 20px 0; }
    .vital-card { flex: 1; background: #fafbfd; border-radius: 10px; padding: 16px; text-align: center; border: 1px solid #eaedf3; }
    .vital-card .vital-name { font-size: 13px; font-weight: 700; color: #444; margin-bottom: 4px; }
    .vital-card .vital-value { font-size: 26px; font-weight: 700; }
    .vital-card .vital-rating { font-size: 12px; margin-top: 4px; font-weight: 500; }

    .opportunities-list { margin-top: 16px; }
    .opportunity-item { background: #fffcf0; border-right: 3px solid #ffa400; padding: 10px 14px; margin-bottom: 8px; border-radius: 6px; }
    .opportunity-item .opp-title { font-weight: 700; font-size: 14px; }
    .opportunity-item .opp-desc { font-size: 13px; color: #555; }

    .checklist-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 16px 0; }
    .check-item { display: flex; align-items: center; gap: 8px; font-size: 14px; padding: 6px 0; }
    .check-icon { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; color: #fff; flex-shrink: 0; }
    .check-pass { background: #0cce6b; }
    .check-fail { background: #ff4e42; }

    .analysis-text { font-size: 14px; color: #333; line-height: 1.7; margin-bottom: 16px; white-space: pre-line; }

    .action-list { counter-reset: action-counter; margin: 16px 0; }
    .action-item { display: flex; gap: 14px; align-items: flex-start; padding: 14px 0; border-bottom: 1px solid #eaedf3; }
    .action-number { width: 34px; height: 34px; background: #4a6cf7; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; flex-shrink: 0; }
    .action-body { flex: 1; }
    .action-title { font-weight: 700; font-size: 15px; margin-bottom: 2px; }
    .action-desc { font-size: 13px; color: #555; }
    .action-meta { display: flex; gap: 8px; align-items: center; margin-top: 6px; }

    .cta-box { background: linear-gradient(135deg, #060d18 0%, #1a1a2e 100%); color: #fff; border-radius: 12px; padding: 30px; text-align: center; margin-top: 30px; }
    .cta-box h3 { font-size: 22px; margin-bottom: 10px; }
    .cta-box p { font-size: 15px; color: #a0b4d0; margin-bottom: 16px; white-space: pre-line; }
    .cta-box .cta-btn { display: inline-block; background: #4a6cf7; color: #fff; padding: 12px 32px; border-radius: 8px; font-size: 16px; font-weight: 700; text-decoration: none; }

    @media print {
      body { background: #fff; }
      .page { box-shadow: none; margin: 0; width: 100%; }
    }
  `;
}

// ---------------------------------------------------------------------------
// Page renderers
// ---------------------------------------------------------------------------

function renderCoverPage(data: AuditData): string {
  const logo = loadAssetBase64('public/images/ppcadvisor-logo-white.png');
  const today = new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });
  const domain = data.request.website.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `
    <div class="page cover">
      ${logo ? `<img class="cover-logo" src="${logo}" alt="PPC Advisor"/>` : '<div class="cover-logo" style="font-size:32px;font-weight:900;color:#4a6cf7;">PPC Advisor</div>'}
      <div class="cover-divider"></div>
      <h1>\u05D3\u05D5\u05D7 \u05D1\u05D9\u05E7\u05D5\u05E8\u05EA \u05E0\u05D5\u05DB\u05D7\u05D5\u05EA \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9\u05EA</h1>
      <h2>${domain}</h2>
      <h2>\u05E2\u05D1\u05D5\u05E8: ${data.request.name}</h2>
      <div class="cover-date">${today}</div>
      <div class="partner-badges">
        ${loadAssetBase64('public/images/google-partner-badge.png') ? `<img src="${loadAssetBase64('public/images/google-partner-badge.png')}" alt="Google Partner"/>` : ''}
        ${loadAssetBase64('public/images/meta-partner-badge.png') ? `<img src="${loadAssetBase64('public/images/meta-partner-badge.png')}" alt="Meta Partner"/>` : ''}
      </div>
    </div>`;
}

function renderPageHeader(title: string): string {
  const logo = loadAssetBase64('public/images/ppcadvisor-logo.png');
  return `
    <div class="page-header">
      ${logo ? `<img src="${logo}" alt="PPC Advisor"/>` : '<span style="font-weight:700;color:#4a6cf7;">PPC Advisor</span>'}
      <span class="header-title">${title}</span>
    </div>`;
}

function renderPageFooter(pageNum: number): string {
  const logo = loadAssetBase64('public/images/ppcadvisor-logo.png');
  return `
    <div class="page-footer">
      ${logo ? `<img src="${logo}" alt="PPC Advisor"/>` : '<span style="font-weight:700;color:#4a6cf7;">PPC Advisor</span>'}
      <div class="footer-contact">felix@ppcadvisor.co.il | 058-749-7497</div>
      <div class="page-number">${pageNum}</div>
    </div>`;
}

function renderSummaryPage(data: AuditData): string {
  const desktopB64 = data.scraped.screenshotDesktop
    ? `data:image/png;base64,${data.scraped.screenshotDesktop.toString('base64')}`
    : '';
  const mobileB64 = data.scraped.screenshotMobile
    ? `data:image/png;base64,${data.scraped.screenshotMobile.toString('base64')}`
    : '';

  return `
    <div class="page content">
      ${renderPageHeader('\u05E1\u05E7\u05D9\u05E8\u05EA \u05DE\u05E0\u05D4\u05DC\u05D9\u05DD')}
      <h2 class="section-title">\u05E1\u05E7\u05D9\u05E8\u05EA \u05DE\u05E0\u05D4\u05DC\u05D9\u05DD</h2>
      <div class="summary-box">${data.report.executiveSummary}</div>

      <h3 class="sub-title">\u05E6\u05D9\u05DC\u05D5\u05DE\u05D9 \u05DE\u05E1\u05DA</h3>
      <div class="screenshots">
        <div class="screenshot-card">
          ${desktopB64 ? `<img src="${desktopB64}" alt="Desktop screenshot"/>` : '<div style="padding:40px;background:#eee;border-radius:8px;">No screenshot</div>'}
          <div class="caption">Desktop</div>
          <div class="screenshot-observation">${data.report.screenshotObservations.desktop}</div>
        </div>
        <div class="screenshot-card">
          ${mobileB64 ? `<img src="${mobileB64}" alt="Mobile screenshot"/>` : '<div style="padding:40px;background:#eee;border-radius:8px;">No screenshot</div>'}
          <div class="caption">Mobile</div>
          <div class="screenshot-observation">${data.report.screenshotObservations.mobile}</div>
        </div>
      </div>
      ${renderPageFooter(2)}
    </div>`;
}

function renderPerformancePage(data: AuditData): string {
  const ps = data.pageSpeed;
  return `
    <div class="page content">
      ${renderPageHeader('\u05D1\u05D9\u05E6\u05D5\u05E2\u05D9\u05DD \u05D5\u05DE\u05D3\u05D3\u05D9\u05DD')}
      <h2 class="section-title">\u05E6\u05D9\u05D5\u05E0\u05D9 \u05D1\u05D9\u05E6\u05D5\u05E2\u05D9\u05DD</h2>
      <div class="scores-grid">
        ${scoreGaugeSVG(ps.performanceScore, 'Performance')}
        ${scoreGaugeSVG(ps.accessibilityScore, 'Accessibility')}
        ${scoreGaugeSVG(ps.seoScore, 'SEO')}
        ${scoreGaugeSVG(ps.bestPracticesScore, 'Best Practices')}
      </div>

      <h3 class="sub-title">Core Web Vitals</h3>
      <div class="vital-cards">
        <div class="vital-card">
          <div class="vital-name">LCP</div>
          <div class="vital-value" style="color:${ratingColor(ps.lcp.rating)}">${ps.lcp.value}${ps.lcp.unit}</div>
          <div class="vital-rating" style="color:${ratingColor(ps.lcp.rating)}">${ratingLabel(ps.lcp.rating)}</div>
        </div>
        <div class="vital-card">
          <div class="vital-name">INP</div>
          <div class="vital-value" style="color:${ratingColor(ps.inp.rating)}">${ps.inp.value}${ps.inp.unit}</div>
          <div class="vital-rating" style="color:${ratingColor(ps.inp.rating)}">${ratingLabel(ps.inp.rating)}</div>
        </div>
        <div class="vital-card">
          <div class="vital-name">CLS</div>
          <div class="vital-value" style="color:${ratingColor(ps.cls.rating)}">${ps.cls.value}${ps.cls.unit}</div>
          <div class="vital-rating" style="color:${ratingColor(ps.cls.rating)}">${ratingLabel(ps.cls.rating)}</div>
        </div>
      </div>

      ${ps.opportunities.length > 0 ? `
        <h3 class="sub-title">\u05D4\u05D6\u05D3\u05DE\u05E0\u05D5\u05D9\u05D5\u05EA \u05DC\u05E9\u05D9\u05E4\u05D5\u05E8</h3>
        <div class="opportunities-list">
          ${ps.opportunities.map(o => `
            <div class="opportunity-item">
              <div class="opp-title">${o.title}</div>
              <div class="opp-desc">${o.description}</div>
            </div>`).join('')}
        </div>` : ''}
      ${renderPageFooter(3)}
    </div>`;
}

function renderAnalysisPage(data: AuditData): string {
  const s = data.scraped;
  const checks = [
    { label: 'SSL (HTTPS)', pass: s.hasSSL },
    { label: 'Viewport Meta', pass: s.hasViewportMeta },
    { label: 'Schema.org', pass: s.hasSchemaOrg },
    { label: 'Meta Description', pass: !!s.metaDescription },
    { label: 'Meta Keywords', pass: !!s.metaKeywords },
    { label: 'OG Tags', pass: Object.keys(s.ogTags).length > 0 },
    { label: `\u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05E2\u05DD Alt (${s.imagesWithAlt}/${s.imageCount})`, pass: s.imagesWithAlt === s.imageCount },
    { label: `\u05E7\u05D9\u05E9\u05D5\u05E8\u05D9\u05DD \u05E4\u05E0\u05D9\u05DE\u05D9\u05D9\u05DD (${s.internalLinkCount})`, pass: s.internalLinkCount >= 5 },
  ];

  return `
    <div class="page content">
      ${renderPageHeader('\u05E0\u05D9\u05EA\u05D5\u05D7 SEO \u05D5\u05E0\u05D5\u05DB\u05D7\u05D5\u05EA AI')}
      <h2 class="section-title">\u05E0\u05D9\u05EA\u05D5\u05D7 SEO</h2>
      <div class="checklist-grid">
        ${checks.map(c => `
          <div class="check-item">
            <div class="check-icon ${c.pass ? 'check-pass' : 'check-fail'}">${c.pass ? '\u2713' : '\u2717'}</div>
            <span>${c.label}</span>
          </div>`).join('')}
      </div>
      <div class="analysis-text">${data.report.seoAnalysis}</div>

      <h2 class="section-title">\u05E0\u05D5\u05DB\u05D7\u05D5\u05EA \u05D1\u05DE\u05E0\u05D5\u05E2\u05D9 AI</h2>
      <div class="checklist-grid">
        <div class="check-item">
          <div class="check-icon ${data.aiPresence.foundInChatGPT ? 'check-pass' : 'check-fail'}">${data.aiPresence.foundInChatGPT ? '\u2713' : '\u2717'}</div>
          <span>ChatGPT</span>
        </div>
        <div class="check-item">
          <div class="check-icon ${data.aiPresence.foundInGemini ? 'check-pass' : 'check-fail'}">${data.aiPresence.foundInGemini ? '\u2713' : '\u2717'}</div>
          <span>Gemini</span>
        </div>
        <div class="check-item">
          <div class="check-icon ${data.aiPresence.foundInPerplexity ? 'check-pass' : 'check-fail'}">${data.aiPresence.foundInPerplexity ? '\u2713' : '\u2717'}</div>
          <span>Perplexity</span>
        </div>
      </div>
      <div class="analysis-text">${data.report.aiPresenceAnalysis}</div>

      <h2 class="section-title">\u05E2\u05DE\u05D3\u05D4 \u05EA\u05D7\u05E8\u05D5\u05EA\u05D9\u05EA</h2>
      <div class="analysis-text">${data.report.competitorPositioning}</div>
      ${renderPageFooter(4)}
    </div>`;
}

function renderActionPlanPage(data: AuditData): string {
  return `
    <div class="page content">
      ${renderPageHeader('\u05EA\u05D5\u05DB\u05E0\u05D9\u05EA \u05E4\u05E2\u05D5\u05DC\u05D4')}
      <h2 class="section-title">\u05EA\u05D5\u05DB\u05E0\u05D9\u05EA \u05E4\u05E2\u05D5\u05DC\u05D4</h2>
      <div class="action-list">
        ${data.report.actionPlan.map((item, idx) => `
          <div class="action-item">
            <div class="action-number">${idx + 1}</div>
            <div class="action-body">
              <div class="action-title">${item.title}</div>
              <div class="action-desc">${item.description}</div>
              <div class="action-meta">
                ${impactBadge(item.impact)}
                <span style="font-size:12px;color:#888;">\u05E2\u05D3\u05D9\u05E4\u05D5\u05EA: ${item.priority}</span>
              </div>
            </div>
          </div>`).join('')}
      </div>

      <h2 class="section-title">\u05E6\u05E2\u05D3\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD</h2>
      <div class="analysis-text">${data.report.nextSteps}</div>

      <div class="cta-box">
        <h3>\u05E8\u05D5\u05E6\u05D9\u05DD \u05DC\u05E9\u05E4\u05E8 \u05D0\u05EA \u05D4\u05EA\u05D5\u05E6\u05D0\u05D5\u05EA?</h3>
        <p>\u05E6\u05D5\u05D5\u05EA PPC Advisor \u05D9\u05E2\u05D6\u05D5\u05E8 \u05DC\u05DB\u05DD \u05DC\u05DE\u05DE\u05E9 \u05D0\u05EA \u05D4\u05DE\u05DC\u05E6\u05D5\u05EA \u05D4\u05D0\u05DC\u05D5\n\u05D5\u05DC\u05D4\u05E4\u05D5\u05DA \u05D0\u05EA \u05D4\u05E0\u05D5\u05DB\u05D7\u05D5\u05EA \u05D4\u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9\u05EA \u05E9\u05DC\u05DB\u05DD \u05DC\u05DE\u05DB\u05D5\u05E0\u05EA \u05E6\u05DE\u05D9\u05D7\u05D4</p>
        <a class="cta-btn" href="mailto:felix@ppcadvisor.co.il">\u05E6\u05D5\u05E8 \u05E7\u05E9\u05E8</a>
      </div>
      ${renderPageFooter(5)}
    </div>`;
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

export function renderReportHTML(data: AuditData): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>\u05D3\u05D5\u05D7 \u05D1\u05D9\u05E7\u05D5\u05E8\u05EA \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9\u05EA - ${data.request.name}</title>
  <style>${getStyles()}</style>
</head>
<body>
  ${renderCoverPage(data)}
  ${renderSummaryPage(data)}
  ${renderPerformancePage(data)}
  ${renderAnalysisPage(data)}
  ${renderActionPlanPage(data)}
</body>
</html>`;
}
