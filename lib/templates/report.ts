import * as fs from 'fs';
import * as path from 'path';
import type { AuditData } from '../types';

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 90) return '#4DBCD0';
  if (score >= 50) return '#ffa400';
  return '#ff4e42';
}

function ratingColor(rating: 'good' | 'needs-improvement' | 'poor'): string {
  if (rating === 'good') return '#4DBCD0';
  if (rating === 'needs-improvement') return '#ffa400';
  return '#ff4e42';
}

function ratingLabel(rating: 'good' | 'needs-improvement' | 'poor'): string {
  if (rating === 'good') return '\u05EA\u05E7\u05D9\u05DF';
  if (rating === 'needs-improvement') return '\u05D3\u05D5\u05E8\u05E9 \u05E9\u05D9\u05E4\u05D5\u05E8';
  return '\u05D1\u05E2\u05D9\u05D9\u05EA\u05D9';
}

function impactBadge(impact: 'high' | 'medium' | 'low'): string {
  const colors: Record<string, { bg: string; border: string; text: string; label: string }> = {
    high:   { bg: 'rgba(255,78,66,.12)', border: 'rgba(255,78,66,.3)', text: '#ff4e42', label: '\u05D2\u05D1\u05D5\u05D4' },
    medium: { bg: 'rgba(255,164,0,.12)', border: 'rgba(255,164,0,.3)', text: '#ffa400', label: '\u05D1\u05D9\u05E0\u05D5\u05E0\u05D9' },
    low:    { bg: 'rgba(77,188,208,.12)', border: 'rgba(77,188,208,.3)', text: '#4DBCD0', label: '\u05E0\u05DE\u05D5\u05DA' },
  };
  const c = colors[impact] || colors.medium;
  return `<span style="display:inline-block;padding:3px 14px;border-radius:500px;font-size:11px;font-weight:700;background:${c.bg};color:${c.text};border:1px solid ${c.border};">${c.label}</span>`;
}

function scoreGaugeSVG(score: number, label: string): string {
  const color = scoreColor(score);
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return `
    <div style="text-align:center;">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="${radius}" fill="none" stroke="rgba(77,188,208,.1)" stroke-width="8"/>
        <circle cx="60" cy="60" r="${radius}" fill="none" stroke="${color}" stroke-width="8"
          stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
          stroke-linecap="round" transform="rotate(-90 60 60)"/>
        <text x="60" y="55" text-anchor="middle" font-size="28" font-weight="800" fill="${color}" font-family="'Heebo',sans-serif">${score}</text>
        <text x="60" y="74" text-anchor="middle" font-size="11" fill="#6b7fa3" font-family="'Heebo',sans-serif">/100</text>
      </svg>
      <div style="font-size:12px;font-weight:700;color:#0E1F33;margin-top:4px;">${label}</div>
    </div>`;
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
// CSS Styles — matching PPC Advisor website design system
// ---------------------------------------------------------------------------

function getStyles(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800;900&display=swap');

    :root {
      --bg: #0E1F33;
      --bg-deep: #091525;
      --primary: #4DBCD0;
      --primary-light: #6BD4D9;
      --white: #fff;
      --text-light: #ECECEC;
      --text-dark: #0E1F33;
      --card-glass: rgba(77,188,208,.07);
      --card-border: rgba(77,188,208,.15);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Heebo', sans-serif;
      color: var(--text-dark);
      background: #f5f5f5;
      line-height: 1.6;
      direction: rtl;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      page-break-after: always;
      position: relative;
      overflow: hidden;
    }
    .page:last-child { page-break-after: avoid; }

    /* ---- Cover Page ---- */
    .cover {
      background: linear-gradient(170deg, #0E1F33 0%, #091525 60%, #0a1a2e 100%);
      color: var(--white);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 60px 50px;
      position: relative;
    }
    .cover::before {
      content: '';
      position: absolute;
      top: -120px;
      right: -120px;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(77,188,208,.15), transparent 70%);
      border-radius: 50%;
    }
    .cover::after {
      content: '';
      position: absolute;
      bottom: -80px;
      left: -80px;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(77,188,208,.08), transparent 70%);
      border-radius: 50%;
    }
    .cover-logo { height: 48px; margin-bottom: 48px; position: relative; z-index: 1; }
    .cover-badge { display: inline-block; padding: 6px 20px; border-radius: 500px; border: 1px solid rgba(77,188,208,.3); background: rgba(77,188,208,.08); color: var(--primary); font-size: 13px; font-weight: 700; letter-spacing: 0.08em; margin-bottom: 32px; position: relative; z-index: 1; }
    .cover h1 { font-size: 42px; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.02em; line-height: 1.1; position: relative; z-index: 1; }
    .cover .cover-accent { color: var(--primary); font-size: 52px; font-weight: 800; display: block; margin-bottom: 16px; line-height: 1; }
    .cover h2 { font-size: 20px; font-weight: 400; color: rgba(236,236,236,.6); margin-bottom: 4px; position: relative; z-index: 1; }
    .cover .cover-date { font-size: 14px; color: rgba(236,236,236,.4); margin-top: 24px; position: relative; z-index: 1; }
    .cover .cover-divider { width: 60px; height: 3px; background: linear-gradient(90deg, var(--primary), var(--primary-light)); border-radius: 2px; margin: 28px auto; position: relative; z-index: 1; }
    .cover .partner-badges { display: flex; gap: 16px; margin-top: 48px; align-items: center; justify-content: center; position: relative; z-index: 1; }
    .cover .partner-badges img { height: 44px; opacity: 0.8; background: rgba(255,255,255,.08); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,.08); }
    .cover-stats { display: flex; gap: 32px; margin-top: 48px; position: relative; z-index: 1; }
    .cover-stat { text-align: center; }
    .cover-stat-num { font-size: 28px; font-weight: 800; color: var(--primary); letter-spacing: -0.02em; }
    .cover-stat-label { font-size: 12px; color: rgba(236,236,236,.5); }

    /* ---- Content Pages ---- */
    .content { background: var(--white); padding: 40px 48px 70px; }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 14px;
      margin-bottom: 28px;
      border-bottom: 1px solid #eaedf3;
    }
    .page-header img { height: 28px; }
    .page-header .header-title { font-size: 13px; color: #8896ab; font-weight: 500; }

    .page-footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 48px;
      background: linear-gradient(135deg, #0E1F33 0%, #132840 100%);
      font-size: 11px;
      color: rgba(236,236,236,.5);
    }
    .page-footer img { height: 18px; }
    .page-footer .footer-contact { text-align: center; }
    .page-footer .page-number { color: var(--primary); font-weight: 700; }

    h2.section-title {
      font-size: 22px;
      font-weight: 800;
      color: var(--text-dark);
      margin-bottom: 18px;
      padding-bottom: 8px;
      position: relative;
      display: inline-block;
    }
    h2.section-title::after {
      content: '';
      position: absolute;
      bottom: 0;
      right: 0;
      width: 100%;
      height: 3px;
      background: linear-gradient(90deg, var(--primary), var(--primary-light));
      border-radius: 2px;
    }

    h3.sub-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-dark);
      margin: 20px 0 10px;
    }

    /* ---- Glass Card (website-style) ---- */
    .glass-card {
      background: linear-gradient(150deg, rgba(14,31,51,.03), rgba(9,21,37,.02));
      border: 1px solid rgba(14,31,51,.08);
      border-radius: 16px;
      padding: 20px 24px;
      margin-bottom: 16px;
    }

    /* ---- Summary Box ---- */
    .summary-box {
      background: linear-gradient(135deg, rgba(77,188,208,.06) 0%, rgba(77,188,208,.02) 100%);
      border-right: 4px solid var(--primary);
      border-radius: 0 12px 12px 0;
      padding: 20px 24px;
      margin-bottom: 24px;
      font-size: 14px;
      color: #333;
      line-height: 1.8;
    }

    /* ---- Screenshots ---- */
    .screenshots { display: flex; gap: 20px; margin-top: 16px; }
    .screenshot-card { flex: 1; text-align: center; }
    .screenshot-card img {
      max-width: 100%;
      max-height: 280px;
      object-fit: contain;
      border-radius: 12px;
      border: 1px solid #e0e4ea;
      box-shadow: 0 4px 16px rgba(0,0,0,.06);
    }
    .screenshot-card .caption {
      margin-top: 8px;
      font-size: 12px;
      font-weight: 700;
      color: var(--primary);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .screenshot-observation {
      font-size: 12px;
      color: #555;
      margin-top: 6px;
      background: rgba(77,188,208,.04);
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid rgba(77,188,208,.08);
      line-height: 1.6;
    }

    /* ---- Score Gauges ---- */
    .scores-grid { display: flex; gap: 12px; justify-content: center; margin: 20px 0; }

    /* ---- Web Vitals ---- */
    .vital-cards { display: flex; gap: 12px; margin: 16px 0; }
    .vital-card {
      flex: 1;
      background: linear-gradient(150deg, rgba(14,31,51,.04), rgba(14,31,51,.02));
      border-radius: 14px;
      padding: 18px;
      text-align: center;
      border: 1px solid rgba(14,31,51,.08);
    }
    .vital-card .vital-name { font-size: 12px; font-weight: 700; color: #6b7fa3; margin-bottom: 4px; letter-spacing: 0.05em; }
    .vital-card .vital-value { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; }
    .vital-card .vital-rating { font-size: 11px; margin-top: 4px; font-weight: 700; }

    /* ---- Opportunities ---- */
    .opportunities-list { margin-top: 14px; }
    .opportunity-item {
      background: rgba(255,164,0,.04);
      border-right: 3px solid #ffa400;
      padding: 10px 14px;
      margin-bottom: 8px;
      border-radius: 0 8px 8px 0;
    }
    .opportunity-item .opp-title { font-weight: 700; font-size: 13px; color: var(--text-dark); }
    .opportunity-item .opp-desc { font-size: 12px; color: #666; line-height: 1.5; }

    /* ---- Checklist ---- */
    .checklist-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 14px 0; }
    .check-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      padding: 8px 12px;
      border-radius: 10px;
      background: rgba(14,31,51,.02);
      border: 1px solid rgba(14,31,51,.06);
    }
    .check-icon {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      color: var(--white);
      flex-shrink: 0;
    }
    .check-pass { background: var(--primary); }
    .check-fail { background: #ff4e42; }

    .analysis-text { font-size: 13px; color: #444; line-height: 1.8; margin-bottom: 16px; white-space: pre-line; }

    /* ---- AI Presence Cards ---- */
    .ai-grid { display: flex; gap: 12px; margin: 14px 0; }
    .ai-card {
      flex: 1;
      padding: 14px;
      border-radius: 12px;
      text-align: center;
      border: 1px solid rgba(14,31,51,.08);
      background: rgba(14,31,51,.02);
    }
    .ai-card-name { font-size: 14px; font-weight: 700; margin-bottom: 6px; }
    .ai-card-status { font-size: 22px; }

    /* ---- Action Plan ---- */
    .action-list { margin: 16px 0; }
    .action-item {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      padding: 16px 0;
      border-bottom: 1px solid #eaedf3;
    }
    .action-number {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, rgba(77,188,208,.2), rgba(46,139,154,.3));
      color: var(--primary);
      border: 2px solid rgba(77,188,208,.35);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 15px;
      flex-shrink: 0;
    }
    .action-body { flex: 1; }
    .action-title { font-weight: 700; font-size: 14px; margin-bottom: 4px; color: var(--text-dark); }
    .action-desc { font-size: 12px; color: #555; line-height: 1.6; }
    .action-meta { display: flex; gap: 10px; align-items: center; margin-top: 8px; }

    /* ---- CTA Box ---- */
    .cta-box {
      background: linear-gradient(150deg, #0E1F33 0%, #132840 50%, #0E1F33 100%);
      color: var(--white);
      border-radius: 20px;
      padding: 32px;
      text-align: center;
      margin-top: 28px;
      position: relative;
      overflow: hidden;
    }
    .cta-box::before {
      content: '';
      position: absolute;
      top: -60px;
      right: -60px;
      width: 200px;
      height: 200px;
      background: radial-gradient(circle, rgba(77,188,208,.12), transparent 70%);
      border-radius: 50%;
    }
    .cta-box h3 { font-size: 22px; font-weight: 800; margin-bottom: 8px; position: relative; z-index: 1; }
    .cta-box p { font-size: 14px; color: rgba(236,236,236,.6); margin-bottom: 18px; white-space: pre-line; position: relative; z-index: 1; line-height: 1.7; }
    .cta-btn {
      display: inline-block;
      background: var(--primary);
      color: var(--white);
      padding: 14px 40px;
      border-radius: 500px;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      position: relative;
      z-index: 1;
    }
    .cta-contact {
      display: flex;
      gap: 24px;
      justify-content: center;
      margin-top: 16px;
      font-size: 13px;
      color: rgba(236,236,236,.5);
      position: relative;
      z-index: 1;
    }

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
  const logo = loadAssetBase64('public/images/logo-horizontal.png') || loadAssetBase64('public/images/ppcadvisor-logo-white.png');
  const googleBadge = loadAssetBase64('public/images/google-partner-badge.svg') || loadAssetBase64('public/images/google-partner-badge.png');
  const metaBadge = loadAssetBase64('public/images/meta-partner-badge.svg') || loadAssetBase64('public/images/meta-partner-badge.png');
  const today = new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });
  const domain = data.request.website.replace(/^https?:\/\//, '').replace(/\/+$/, '');

  return `
    <div class="page cover">
      ${logo ? `<img class="cover-logo" src="${logo}" alt="PPC Advisor"/>` : '<div class="cover-logo" style="font-size:28px;font-weight:900;color:#4DBCD0;">PPC Advisor</div>'}
      <div class="cover-badge">\u05D3\u05D5\u05D7 \u05D0\u05D1\u05D7\u05D5\u05DF \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9</div>
      <h1>
        <span class="cover-accent">${domain}</span>
        \u05D1\u05D9\u05E7\u05D5\u05E8\u05EA \u05E0\u05D5\u05DB\u05D7\u05D5\u05EA \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9\u05EA
      </h1>
      <div class="cover-divider"></div>
      <h2>\u05E2\u05D1\u05D5\u05E8: ${data.request.name}</h2>
      <div class="cover-date">${today}</div>
      <div class="cover-stats">
        <div class="cover-stat">
          <div class="cover-stat-num">267+</div>
          <div class="cover-stat-label">\u05DC\u05E7\u05D5\u05D7\u05D5\u05EA \u05DE\u05E8\u05D5\u05E6\u05D9\u05DD</div>
        </div>
        <div class="cover-stat">
          <div class="cover-stat-num">14</div>
          <div class="cover-stat-label">\u05E9\u05E0\u05D5\u05EA \u05D1\u05E9\u05D5\u05E7</div>
        </div>
        <div class="cover-stat">
          <div class="cover-stat-num">\u20AA47M+</div>
          <div class="cover-stat-label">\u05EA\u05E7\u05E6\u05D9\u05D1\u05D9 \u05DE\u05D3\u05D9\u05D4</div>
        </div>
      </div>
      <div class="partner-badges">
        ${googleBadge ? `<img src="${googleBadge}" alt="Google Partner"/>` : ''}
        ${metaBadge ? `<img src="${metaBadge}" alt="Meta Partner"/>` : ''}
      </div>
    </div>`;
}

function renderPageHeader(title: string): string {
  const logo = loadAssetBase64('public/images/logo-horizontal.png') || loadAssetBase64('public/images/ppcadvisor-logo.png');
  return `
    <div class="page-header">
      ${logo ? `<img src="${logo}" alt="PPC Advisor"/>` : '<span style="font-weight:800;color:#4DBCD0;font-size:16px;">PPC Advisor</span>'}
      <span class="header-title">${title}</span>
    </div>`;
}

function renderPageFooter(pageNum: number): string {
  return `
    <div class="page-footer">
      <span style="font-weight:700;color:#4DBCD0;">PPC Advisor</span>
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
        <div class="screenshot-card" style="flex:2;">
          ${desktopB64 ? `<img src="${desktopB64}" alt="Desktop screenshot"/>` : '<div style="padding:40px;background:#f0f2f5;border-radius:12px;color:#8896ab;">No screenshot</div>'}
          <div class="caption">Desktop</div>
          <div class="screenshot-observation">${data.report.screenshotObservations.desktop}</div>
        </div>
        <div class="screenshot-card" style="flex:1;">
          ${mobileB64 ? `<img src="${mobileB64}" alt="Mobile screenshot"/>` : '<div style="padding:40px;background:#f0f2f5;border-radius:12px;color:#8896ab;">No screenshot</div>'}
          <div class="caption">Mobile</div>
          <div class="screenshot-observation">${data.report.screenshotObservations.mobile}</div>
        </div>
      </div>
      ${renderPageFooter(2)}
    </div>`;
}

function renderPerformancePage(data: AuditData): string {
  const ps = data.pageSpeed;
  const hasScores = ps.performanceScore > 0;

  return `
    <div class="page content">
      ${renderPageHeader('\u05D1\u05D9\u05E6\u05D5\u05E2\u05D9\u05DD \u05D5\u05DE\u05D3\u05D3\u05D9\u05DD')}
      <h2 class="section-title">\u05E6\u05D9\u05D5\u05E0\u05D9 \u05D1\u05D9\u05E6\u05D5\u05E2\u05D9\u05DD</h2>
      ${hasScores ? `
        <div class="scores-grid">
          ${scoreGaugeSVG(ps.performanceScore, 'Performance')}
          ${scoreGaugeSVG(ps.accessibilityScore, 'Accessibility')}
          ${scoreGaugeSVG(ps.seoScore, 'SEO')}
          ${scoreGaugeSVG(ps.bestPracticesScore, 'Best Practices')}
        </div>
      ` : `
        <div class="glass-card" style="text-align:center;padding:24px;color:#6b7fa3;">
          \u05E0\u05EA\u05D5\u05E0\u05D9 PageSpeed \u05DC\u05D0 \u05D6\u05DE\u05D9\u05E0\u05D9\u05DD \u05DB\u05E8\u05D2\u05E2. \u05D4\u05E0\u05D9\u05EA\u05D5\u05D7 \u05DE\u05D1\u05D5\u05E1\u05E1 \u05E2\u05DC \u05E1\u05E8\u05D9\u05E7\u05EA \u05D4\u05D0\u05EA\u05E8 \u05D1\u05DC\u05D1\u05D3.
        </div>
      `}

      <h3 class="sub-title">Core Web Vitals</h3>
      <div class="vital-cards">
        <div class="vital-card">
          <div class="vital-name">LCP</div>
          <div class="vital-value" style="color:${ratingColor(ps.lcp.rating)}">${hasScores ? ps.lcp.value + ps.lcp.unit : '—'}</div>
          <div class="vital-rating" style="color:${ratingColor(ps.lcp.rating)}">${hasScores ? ratingLabel(ps.lcp.rating) : ''}</div>
        </div>
        <div class="vital-card">
          <div class="vital-name">INP</div>
          <div class="vital-value" style="color:${ratingColor(ps.inp.rating)}">${hasScores ? ps.inp.value + ps.inp.unit : '—'}</div>
          <div class="vital-rating" style="color:${ratingColor(ps.inp.rating)}">${hasScores ? ratingLabel(ps.inp.rating) : ''}</div>
        </div>
        <div class="vital-card">
          <div class="vital-name">CLS</div>
          <div class="vital-value" style="color:${ratingColor(ps.cls.rating)}">${hasScores ? ps.cls.value + ps.cls.unit : '—'}</div>
          <div class="vital-rating" style="color:${ratingColor(ps.cls.rating)}">${hasScores ? ratingLabel(ps.cls.rating) : ''}</div>
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
      <div class="ai-grid">
        <div class="ai-card">
          <div class="ai-card-status">${data.aiPresence.foundInChatGPT ? '\u2705' : '\u274C'}</div>
          <div class="ai-card-name">ChatGPT</div>
        </div>
        <div class="ai-card">
          <div class="ai-card-status">${data.aiPresence.foundInGemini ? '\u2705' : '\u274C'}</div>
          <div class="ai-card-name">Gemini</div>
        </div>
        <div class="ai-card">
          <div class="ai-card-status">${data.aiPresence.foundInPerplexity ? '\u2705' : '\u274C'}</div>
          <div class="ai-card-name">Perplexity</div>
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
                <span style="font-size:11px;color:#8896ab;font-weight:500;">\u05E2\u05D3\u05D9\u05E4\u05D5\u05EA: ${item.priority}</span>
              </div>
            </div>
          </div>`).join('')}
      </div>

      <h3 class="sub-title">\u05E6\u05E2\u05D3\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD</h3>
      <div class="analysis-text">${data.report.nextSteps}</div>

      <div class="cta-box">
        <h3>\u05E8\u05D5\u05E6\u05D9\u05DD \u05DC\u05E9\u05E4\u05E8 \u05D0\u05EA \u05D4\u05EA\u05D5\u05E6\u05D0\u05D5\u05EA?</h3>
        <p>\u05E6\u05D5\u05D5\u05EA PPC Advisor \u05D9\u05E2\u05D6\u05D5\u05E8 \u05DC\u05DB\u05DD \u05DC\u05DE\u05DE\u05E9 \u05D0\u05EA \u05D4\u05DE\u05DC\u05E6\u05D5\u05EA \u05D4\u05D0\u05DC\u05D5\n\u05D5\u05DC\u05D4\u05E4\u05D5\u05DA \u05D0\u05EA \u05D4\u05E0\u05D5\u05DB\u05D7\u05D5\u05EA \u05D4\u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9\u05EA \u05E9\u05DC\u05DB\u05DD \u05DC\u05DE\u05DB\u05D5\u05E0\u05EA \u05E6\u05DE\u05D9\u05D7\u05D4</p>
        <a class="cta-btn" href="https://wa.me/972587497497">\u05D3\u05D1\u05E8\u05D5 \u05D0\u05D9\u05EA\u05E0\u05D5 \u2190</a>
        <div class="cta-contact">
          <span>058-749-7497</span>
          <span>felix@ppcadvisor.co.il</span>
        </div>
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
