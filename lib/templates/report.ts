import * as fs from 'fs';
import * as path from 'path';
import type { AuditData } from '../types';

// ---------------------------------------------------------------------------
// Helpers
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

// Translate common PageSpeed opportunity titles to Hebrew
const psTranslations: Record<string, string> = {
  'Eliminate render-blocking resources': '\u05D4\u05E1\u05E8\u05EA \u05DE\u05E9\u05D0\u05D1\u05D9\u05DD \u05D4\u05D7\u05D5\u05E1\u05DE\u05D9\u05DD \u05E8\u05E0\u05D3\u05E8',
  'Properly size images': '\u05D4\u05EA\u05D0\u05DE\u05EA \u05D2\u05D5\u05D3\u05DC \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA',
  'Reduce unused JavaScript': '\u05E6\u05DE\u05E6\u05D5\u05DD JavaScript \u05DC\u05D0 \u05D1\u05E9\u05D9\u05DE\u05D5\u05E9',
  'Serve images in next-gen formats': '\u05D4\u05DE\u05E8\u05EA \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DC\u05E4\u05D5\u05E8\u05DE\u05D8 \u05DE\u05EA\u05E7\u05D3\u05DD',
  'Enable text compression': '\u05D4\u05E4\u05E2\u05DC\u05EA \u05D3\u05D7\u05D9\u05E1\u05EA \u05D8\u05E7\u05E1\u05D8',
  'Reduce unused CSS': '\u05E6\u05DE\u05E6\u05D5\u05DD CSS \u05DC\u05D0 \u05D1\u05E9\u05D9\u05DE\u05D5\u05E9',
  'Minify CSS': '\u05DE\u05D6\u05E2\u05D5\u05E8 CSS',
  'Minify JavaScript': '\u05DE\u05D6\u05E2\u05D5\u05E8 JavaScript',
  'Defer offscreen images': '\u05D3\u05D7\u05D9\u05D9\u05EA \u05D8\u05E2\u05D9\u05E0\u05EA \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D7\u05D5\u05E5 \u05DC\u05DE\u05E1\u05DA',
  'Efficiently encode images': '\u05E7\u05D9\u05D3\u05D5\u05D3 \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05D9\u05E2\u05D9\u05DC',
  'Preconnect to required origins': '\u05D7\u05D9\u05D1\u05D5\u05E8 \u05DE\u05D5\u05E7\u05D3\u05DD \u05DC\u05E9\u05E8\u05EA\u05D9\u05DD \u05E0\u05D3\u05E8\u05E9\u05D9\u05DD',
  'Avoid multiple page redirects': '\u05D4\u05D9\u05DE\u05E0\u05E2\u05D5\u05EA \u05DE\u05D4\u05E4\u05E0\u05D9\u05D5\u05EA \u05DE\u05D9\u05D5\u05EA\u05E8\u05D5\u05EA',
  'Reduce server response times (TTFB)': '\u05E6\u05DE\u05E6\u05D5\u05DD \u05D6\u05DE\u05DF \u05EA\u05D2\u05D5\u05D1\u05EA \u05E9\u05E8\u05EA',
  'Avoid enormous network payloads': '\u05D4\u05E7\u05D8\u05E0\u05EA \u05DE\u05E9\u05E7\u05DC \u05D4\u05E8\u05E9\u05EA',
  'Use a Content Delivery Network (CDN)': '\u05E9\u05D9\u05DE\u05D5\u05E9 \u05D1\u05E8\u05E9\u05EA \u05D4\u05E4\u05E6\u05EA \u05EA\u05D5\u05DB\u05DF (CDN)',
  'Avoid an excessive DOM size': '\u05D4\u05D9\u05DE\u05E0\u05E2\u05D5\u05EA \u05DE\u05D2\u05D5\u05D3\u05DC DOM \u05DE\u05D5\u05E4\u05E8\u05D6',
};

function translatePS(title: string): string {
  return psTranslations[title] || title;
}

// Common PageSpeed description fragments → Hebrew
const psDescTranslations: [RegExp, string][] = [
  // Full sentence patterns FIRST (before word-level replacements)
  [/Consider deferring non-critical JS and inlining critical CSS\.?/gi, 'מומלץ לדחות JS לא קריטי ולהטמיע CSS קריטי.'],
  [/Serve images that are appropriately-sized to save cellular data and improve load time\.?/gi, 'הגישו תמונות בגודל מתאים לחיסכון בנתונים סלולריים ולשיפור זמן טעינה.'],
  [/Image formats like WebP and AVIF provide better compression than PNG or JPEG\.?/gi, 'פורמטים כמו WebP ו-AVIF מספקים דחיסה טובה יותר מ-PNG או JPEG.'],
  [/Remove or defer scripts that are not needed during initial page load\.?/gi, 'הסירו או דחו סקריפטים שלא נחוצים בטעינה הראשונית.'],
  [/Text-based resources should be served with compression/gi, 'משאבים מבוססי טקסט צריכים להיות מוגשים עם דחיסה'],
  [/to minimize total network bytes\.?/gi, 'למזעור נפח הרשת.'],
  // Phrase patterns
  [/render-blocking scripts?/gi, 'סקריפטים החוסמים רנדר'],
  [/stylesheets? found/gi, 'קבצי סגנון שנמצאו'],
  [/images? could be resized/gi, 'תמונות ניתנות להקטנה'],
  [/of unused JavaScript detected/gi, 'של JavaScript לא בשימוש נמצא'],
  [/Convert (\d+) images\.?/gi, 'המירו $1 תמונות.'],
  [/\(gzip,?\s*deflate\s+or\s+brotli\)/gi, '(gzip, deflate או brotli)'],
  // Word-level LAST
  [/\band\b/gi, 'ו-'],
];

function translatePSDesc(desc: string): string {
  let result = desc;
  for (const [pattern, replacement] of psDescTranslations) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

let _logoB64: string | null = null;
function getLogoB64(): string {
  if (!_logoB64) {
    const logoPath = path.join(process.cwd(), 'logo-horizontal-white.png');
    _logoB64 = fs.readFileSync(logoPath).toString('base64');
  }
  return _logoB64;
}

function textLogo(height = 24): string {
  return `<img src="data:image/png;base64,${getLogoB64()}" height="${height}" style="height:${height}px;width:auto;display:inline-block;vertical-align:middle;" alt="PPC Advisor">`;
}

function impactBadge(impact: 'high' | 'medium' | 'low'): string {
  const m: Record<string, { bg: string; border: string; text: string; label: string }> = {
    high:   { bg: 'rgba(255,78,66,.15)', border: 'rgba(255,78,66,.35)', text: '#ff6b5e', label: '\u05D2\u05D1\u05D5\u05D4' },
    medium: { bg: 'rgba(255,164,0,.15)', border: 'rgba(255,164,0,.35)', text: '#ffb84d', label: '\u05D1\u05D9\u05E0\u05D5\u05E0\u05D9' },
    low:    { bg: 'rgba(77,188,208,.15)', border: 'rgba(77,188,208,.35)', text: '#4DBCD0', label: '\u05E0\u05DE\u05D5\u05DA' },
  };
  const c = m[impact] || m.medium;
  return `<span style="display:inline-block;padding:4px 16px;border-radius:500px;font-size:12px;font-weight:700;background:${c.bg};color:${c.text};border:1px solid ${c.border};">${c.label}</span>`;
}

function scoreGaugeSVG(score: number, label: string): string {
  const color = scoreColor(score);
  const r = 40, circ = 2 * Math.PI * r, off = circ - (score / 100) * circ;
  return `<div style="text-align:center;">
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="${r}" fill="none" stroke="rgba(77,188,208,.1)" stroke-width="7"/>
      <circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="7"
        stroke-dasharray="${circ}" stroke-dashoffset="${off}" stroke-linecap="round" transform="rotate(-90 50 50)"/>
      <text x="50" y="46" text-anchor="middle" font-size="28" font-weight="800" fill="${color}" font-family="'Ploni','Heebo',sans-serif">${score}</text>
      <text x="50" y="64" text-anchor="middle" font-size="12" fill="rgba(236,236,236,.4)" font-family="'Ploni','Heebo',sans-serif">/100</text>
    </svg>
    <div style="font-size:13px;font-weight:600;color:rgba(236,236,236,.6);margin-top:2px;">${label}</div>
  </div>`;
}

function loadAssetBase64(filename: string): string {
  try {
    const filePath = path.join(process.cwd(), filename);
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filename).replace('.', '').toLowerCase();
    const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'webp' ? 'image/webp' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch { return ''; }
}

function loadFontBase64(filename: string): string {
  try {
    const filePath = path.join(process.cwd(), filename);
    const buf = fs.readFileSync(filePath);
    return `data:font/woff2;base64,${buf.toString('base64')}`;
  } catch { return ''; }
}

function statCard(value: string, label: string, color = '#4DBCD0'): string {
  return `<div class="stat-card">
    <div style="font-size:22px;font-weight:800;color:${color};line-height:1;letter-spacing:-.02em;">${value}</div>
    <div style="font-size:12px;font-weight:500;color:rgba(236,236,236,.55);margin-top:5px;">${label}</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// CSS — matching ppcadvisor.co.il design system
// ---------------------------------------------------------------------------

function getStyles(): string {
  // Embed Ploni fonts as base64 for PDF rendering
  const ploniLight = loadFontBase64('fonts/ploni-light.woff2');
  const ploniRegular = loadFontBase64('fonts/ploni-regular.woff2');
  const ploniBold = loadFontBase64('fonts/ploni-bold.woff2');

  return `
    @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');

    ${ploniLight ? `@font-face{font-family:'Ploni';src:url('${ploniLight}') format('woff2');font-weight:300;font-style:normal;font-display:swap}` : ''}
    ${ploniRegular ? `@font-face{font-family:'Ploni';src:url('${ploniRegular}') format('woff2');font-weight:400;font-style:normal;font-display:swap}` : ''}
    ${ploniBold ? `@font-face{font-family:'Ploni';src:url('${ploniBold}') format('woff2');font-weight:700;font-style:normal;font-display:swap}` : ''}

    *{margin:0;padding:0;box-sizing:border-box}
    body{
      font-family:'Ploni','Heebo',sans-serif;
      background:#0E1F33;color:#ECECEC;line-height:1.55;direction:rtl;
      font-size:17px;-webkit-font-smoothing:antialiased;
    }

    .page{width:297mm;height:210mm;position:relative;overflow:hidden;page-break-after:always;background:#0E1F33}
    .page:last-child{page-break-after:avoid}

    /* Header / Footer */
    .page-header{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;padding:18px 64px;z-index:10;border-bottom:1px solid rgba(77,188,208,.08)}
    .page-header .lbl{font-size:14px;color:rgba(236,236,236,.4);font-weight:600;letter-spacing:.06em}
    .page-footer{position:absolute;bottom:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;padding:14px 64px;background:rgba(9,21,37,.6);border-top:1px solid rgba(77,188,208,.08);font-size:13px;color:rgba(236,236,236,.35);z-index:10}
    .page-footer .pn{color:#4DBCD0;font-weight:700;font-size:14px}
    .pb{position:absolute;top:56px;bottom:42px;left:64px;right:64px;overflow:hidden}

    /* Glow effects */
    .glow{position:absolute;border-radius:50%;pointer-events:none;z-index:0}
    .g-tr{top:-140px;right:-140px;width:450px;height:450px;background:radial-gradient(circle,rgba(77,188,208,.12),transparent 70%)}
    .g-bl{bottom:-120px;left:-120px;width:400px;height:400px;background:radial-gradient(circle,rgba(77,188,208,.08),transparent 70%)}

    /* ===== Glass Card — matches .svc-glass from site ===== */
    .glass{
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.15);
      border-radius:16px;
      padding:16px 20px;
      position:relative;overflow:hidden;
      box-shadow:0 8px 32px rgba(0,0,0,.08),inset 0 1px 0 rgba(255,255,255,.1);
    }
    .glass::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.06) 0%,transparent 50%);pointer-events:none}

    /* ===== Stat Card — matches .stat-card from site ===== */
    .stat-card{
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.15);
      border-radius:16px;
      padding:16px 14px;
      text-align:center;
      flex:1;
      position:relative;overflow:hidden;
      box-shadow:0 8px 32px rgba(0,0,0,.08),inset 0 1px 0 rgba(255,255,255,.1);
    }
    .stat-card::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.06) 0%,transparent 50%);pointer-events:none;border-radius:16px}

    /* ===== Cover ===== */
    .cover{background:linear-gradient(170deg,#0E1F33 0%,#091525 60%,#0a1a2e 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px 80px}
    .cover-badge{display:inline-block;padding:8px 28px;border-radius:500px;border:1px solid rgba(77,188,208,.35);background:rgba(77,188,208,.1);color:#4DBCD0;font-size:16px;font-weight:700;letter-spacing:.04em;margin-bottom:16px;position:relative;z-index:1}
    .cover h1{font-size:38px;font-weight:800;letter-spacing:-.02em;line-height:1.1;margin-bottom:4px;position:relative;z-index:1}
    .cover .ca{color:#4DBCD0;font-size:48px;font-weight:900;display:block;margin-bottom:10px;line-height:1;letter-spacing:-.03em}
    .cover h2{font-size:20px;font-weight:400;color:rgba(236,236,236,.6);position:relative;z-index:1}
    .cover-div{width:60px;height:3px;background:linear-gradient(90deg,#4DBCD0,#6BD4D9);border-radius:2px;margin:16px auto;position:relative;z-index:1}
    .cover-date{font-size:15px;color:rgba(236,236,236,.45);margin-top:10px;position:relative;z-index:1}
    .cover-stats{display:flex;gap:44px;margin-top:20px;position:relative;z-index:1}
    .cs-n{font-size:28px;font-weight:800;color:#4DBCD0;letter-spacing:-.02em;line-height:1}
    .cs-l{font-size:13px;color:rgba(236,236,236,.5);margin-top:4px;font-weight:500}

    /* ===== Section title with accent underline ===== */
    .st{font-size:24px;font-weight:800;color:#ECECEC;margin-bottom:12px;padding-bottom:8px;position:relative;display:inline-block;letter-spacing:-.01em}
    .st::after{content:'';position:absolute;bottom:0;right:0;width:100%;height:3px;background:linear-gradient(90deg,#4DBCD0,#6BD4D9);border-radius:2px}

    /* Sub-section title */
    .sst{font-size:17px;font-weight:700;color:rgba(236,236,236,.9);margin:12px 0 8px;letter-spacing:-.01em}

    /* Summary blockquote */
    .sb{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:14px 20px;font-size:15px;color:rgba(236,236,236,.75);line-height:1.7;position:relative;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.08),inset 0 1px 0 rgba(255,255,255,.1)}
    .sb::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.06) 0%,transparent 50%);pointer-events:none;border-radius:16px}

    /* Two-column layout */
    .two{display:flex;gap:28px;height:100%}
    .two>.c{flex:1;overflow:hidden}

    /* Body text */
    .at{font-size:14px;color:rgba(236,236,236,.65);line-height:1.65;white-space:pre-line}

    /* Screenshots */
    .ss-row{display:flex;gap:14px;margin:10px 0}
    .ss-card{text-align:center}
    .ss-card img{max-width:100%;max-height:240px;object-fit:contain;border-radius:14px;border:1px solid rgba(77,188,208,.15);box-shadow:0 8px 32px rgba(0,0,0,.4)}
    .ss-cap{margin-top:6px;font-size:13px;font-weight:700;color:#4DBCD0;letter-spacing:.06em}
    .ss-obs{font-size:13px;color:rgba(236,236,236,.55);margin-top:4px;line-height:1.45}
    .ss-placeholder{padding:30px 16px;background:rgba(255,255,255,.04);border-radius:16px;color:rgba(236,236,236,.3);border:1px solid rgba(255,255,255,.15);text-align:center;font-size:14px;box-shadow:0 8px 32px rgba(0,0,0,.08),inset 0 1px 0 rgba(255,255,255,.1)}

    /* Score gauges grid */
    .sc-grid{display:flex;gap:12px;justify-content:center;margin:10px 0}

    /* Core Web Vitals */
    .vc{display:flex;gap:12px;margin:10px 0}
    .vi{
      flex:1;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.15);
      border-radius:16px;padding:14px;text-align:center;
      position:relative;overflow:hidden;
      box-shadow:0 8px 32px rgba(0,0,0,.08),inset 0 1px 0 rgba(255,255,255,.1);
    }
    .vi::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.06) 0%,transparent 50%);pointer-events:none;border-radius:16px}
    .vn{font-size:13px;font-weight:700;color:rgba(236,236,236,.5);margin-bottom:4px;letter-spacing:.04em}
    .vv{font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1}
    .vr{font-size:12px;margin-top:4px;font-weight:700}

    /* Opportunities list — glass card style matching site */
    .ol{margin-top:8px}
    .oi{
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.15);
      border-radius:16px;
      padding:12px 18px;margin-bottom:8px;
      position:relative;overflow:hidden;
      box-shadow:0 8px 32px rgba(0,0,0,.08),inset 0 1px 0 rgba(255,255,255,.1);
    }
    .oi::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.06) 0%,transparent 50%);pointer-events:none}
    .ot{font-weight:700;font-size:15px;color:rgba(236,236,236,.9);position:relative;z-index:1}
    .od{font-size:13px;color:rgba(236,236,236,.55);line-height:1.5;margin-top:4px;position:relative;z-index:1}

    /* SEO checklist */
    .cg{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0}
    .ci{
      display:flex;align-items:center;gap:8px;font-size:13px;padding:7px 12px;border-radius:12px;
      background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);
      color:rgba(236,236,236,.8);font-weight:500;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
    }
    .ck{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;color:#fff;flex-shrink:0}
    .cp{background:#4DBCD0}
    .cf{background:#ff4e42}

    /* AI platform cards */
    .ag{display:flex;gap:12px;margin:10px 0}
    .ac{
      flex:1;padding:16px;border-radius:16px;text-align:center;
      border:1px solid rgba(255,255,255,.15);
      background:rgba(255,255,255,.04);
      box-shadow:0 8px 32px rgba(0,0,0,.08),inset 0 1px 0 rgba(255,255,255,.1);
    }
    .an{font-size:15px;font-weight:700;margin-top:6px;color:rgba(236,236,236,.7)}
    .as{font-size:28px;line-height:1}

    /* Action plan list */
    .al{margin:8px 0}
    .ai{display:flex;gap:14px;align-items:flex-start;padding:10px 0;border-bottom:1px solid rgba(77,188,208,.08)}
    .ai:last-child{border-bottom:none}
    .anum{
      width:34px;height:34px;
      background:linear-gradient(135deg,rgba(77,188,208,.25),rgba(46,139,154,.35));
      color:#4DBCD0;border:2px solid rgba(77,188,208,.4);border-radius:50%;
      display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;flex-shrink:0;
    }
    .ab{flex:1}
    .atit{font-weight:700;font-size:15px;margin-bottom:3px;color:rgba(236,236,236,.92)}
    .adesc{font-size:13px;color:rgba(236,236,236,.55);line-height:1.5}
    .am{display:flex;gap:10px;align-items:center;margin-top:6px}

    /* CTA card */
    .cta{
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.15);border-radius:16px;
      padding:20px 24px;text-align:center;margin-top:14px;position:relative;overflow:hidden;
      box-shadow:0 8px 32px rgba(0,0,0,.08),inset 0 1px 0 rgba(255,255,255,.1);
    }
    .cta::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.06) 0%,transparent 50%);pointer-events:none}
    .cta::after{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;background:radial-gradient(circle,rgba(77,188,208,.12),transparent 70%);border-radius:50%;pointer-events:none}
    .cta h3{font-size:22px;font-weight:800;margin-bottom:6px;position:relative;z-index:1;color:#ECECEC}
    .cta p{font-size:15px;color:rgba(236,236,236,.55);margin-bottom:12px;position:relative;z-index:1;line-height:1.5;white-space:pre-line}
    .cta-btn{display:inline-block;background:#4DBCD0;color:#0E1F33;padding:12px 44px;border-radius:500px;font-size:17px;font-weight:700;text-decoration:none;position:relative;z-index:1}
    .cta-c{display:flex;gap:24px;justify-content:center;margin-top:10px;font-size:14px;color:rgba(236,236,236,.45);position:relative;z-index:1}

    /* Meta tags */
    .meta-row{display:flex;gap:8px;margin-bottom:6px;align-items:baseline}
    .meta-tag{font-size:11px;font-weight:700;color:#4DBCD0;background:rgba(77,188,208,.1);border:1px solid rgba(77,188,208,.15);border-radius:6px;padding:2px 8px;white-space:nowrap}
    .meta-val{font-size:13px;color:rgba(236,236,236,.6);line-height:1.4;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

    /* Heading hierarchy */
    .h-list{margin:6px 0}
    .h-item{display:flex;align-items:baseline;gap:8px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.05)}
    .h-level{font-size:11px;font-weight:700;color:#4DBCD0;background:rgba(77,188,208,.12);border-radius:5px;padding:2px 8px;flex-shrink:0}
    .h-text{font-size:13px;color:rgba(236,236,236,.6);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

    @media print{body{background:#0E1F33}.page{box-shadow:none;margin:0}}
  `;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function renderCover(data: AuditData): string {
  const today = new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });
  const domain = data.request.website.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `
    <div class="page cover">
      <div class="glow g-tr"></div><div class="glow g-bl"></div>
      <div style="margin-bottom:24px;position:relative;z-index:1;">${textLogo(44)}</div>
      <div class="cover-badge">\u05D3\u05D5\u05D7 \u05D0\u05D1\u05D7\u05D5\u05DF \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9</div>
      <h1><span class="ca">${domain}</span>\u05D1\u05D9\u05E7\u05D5\u05E8\u05EA \u05E0\u05D5\u05DB\u05D7\u05D5\u05EA \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9\u05EA</h1>
      <div class="cover-div"></div>
      <h2>\u05E2\u05D1\u05D5\u05E8: ${data.request.name}</h2>
      <div class="cover-date">${today}</div>
      <div class="cover-stats">
        <div style="text-align:center"><div class="cs-n">267+</div><div class="cs-l">\u05DC\u05E7\u05D5\u05D7\u05D5\u05EA \u05DE\u05E8\u05D5\u05E6\u05D9\u05DD</div></div>
        <div style="text-align:center"><div class="cs-n">14</div><div class="cs-l">\u05E9\u05E0\u05D5\u05EA \u05D1\u05E9\u05D5\u05E7</div></div>
        <div style="text-align:center"><div class="cs-n">\u20AA47M+</div><div class="cs-l">\u05EA\u05E7\u05E6\u05D9\u05D1\u05D9 \u05DE\u05D3\u05D9\u05D4</div></div>
      </div>
      <div style="max-width:520px;margin:18px auto 0;position:relative;z-index:1;">
        <div class="sb" style="font-size:14px;text-align:right;padding:12px 18px;">${data.report.reportPurpose}</div>
      </div>
    </div>`;
}

function chrome(label: string, num: number) {
  const h = `<div class="page-header">${textLogo(18)}<span class="lbl">${label}</span></div>`;
  const f = `<div class="page-footer">${textLogo(14)}<span>felix@ppcadvisor.co.il | 058-749-7497</span><span class="pn">${num}</span></div>`;
  return { h, f };
}

function renderSituation(data: AuditData): string {
  const { h, f } = chrome('\u05DE\u05E6\u05D1 \u05D5\u05E0\u05D9\u05EA\u05D5\u05D7 \u05E2\u05E1\u05E7\u05D9', 2);

  return `
    <div class="page"><div class="glow g-tr"></div>${h}
      <div class="pb">
        <div class="two">
          <div class="c">
            <h2 class="st">\u05E1\u05E7\u05D9\u05E8\u05EA \u05DE\u05E6\u05D1</h2>
            <div class="sb" style="margin-bottom:14px;">${data.report.executiveSummary}</div>
            <div class="at">${data.report.situationOverview}</div>
          </div>
          <div class="c">
            <h2 class="st">\u05E0\u05D9\u05EA\u05D5\u05D7 \u05DE\u05D5\u05D3\u05DC \u05E2\u05E1\u05E7\u05D9</h2>
            <div class="at">${data.report.businessModelAnalysis}</div>
          </div>
        </div>
      </div>
    ${f}</div>`;
}

function renderCRO(data: AuditData): string {
  const { h, f } = chrome('CRO \u05D5\u05D7\u05D5\u05D5\u05D9\u05D9\u05EA \u05DE\u05E9\u05EA\u05DE\u05E9', 3);
  const s = data.scraped;
  const desktopB64 = s.screenshotDesktop?.length > 0 ? `data:image/png;base64,${s.screenshotDesktop.toString('base64')}` : '';
  const mobileB64 = s.screenshotMobile?.length > 0 ? `data:image/png;base64,${s.screenshotMobile.toString('base64')}` : '';

  return `
    <div class="page"><div class="glow g-bl"></div>${h}
      <div class="pb">
        <div class="two">
          <div class="c">
            <h2 class="st">\u05E6\u05D9\u05DC\u05D5\u05DE\u05D9 \u05DE\u05E1\u05DA</h2>
            <div class="ss-row" style="gap:12px;">
              <div class="ss-card" style="flex:3;">
                ${desktopB64 ? `<img src="${desktopB64}" alt="\u05E9\u05D5\u05DC\u05D7\u05E0\u05D9" style="max-height:230px;"/>` : '<div class="ss-placeholder">\u05E6\u05D9\u05DC\u05D5\u05DD \u05DE\u05E1\u05DA \u05E9\u05D5\u05DC\u05D7\u05E0\u05D9</div>'}
                <div class="ss-cap">\u05E9\u05D5\u05DC\u05D7\u05E0\u05D9</div>
              </div>
              <div class="ss-card" style="flex:1;">
                ${mobileB64 ? `<img src="${mobileB64}" alt="\u05E0\u05D9\u05D9\u05D3" style="max-height:230px;"/>` : '<div class="ss-placeholder">\u05E6\u05D9\u05DC\u05D5\u05DD \u05DE\u05E1\u05DA \u05E0\u05D9\u05D9\u05D3</div>'}
                <div class="ss-cap">\u05E0\u05D9\u05D9\u05D3</div>
              </div>
            </div>
            <div style="display:flex;gap:12px;margin-top:10px;">
              <div class="glass" style="flex:3;padding:10px 14px;font-size:13px;color:rgba(236,236,236,.6);line-height:1.5;"><strong style="color:#4DBCD0;font-size:11px;letter-spacing:.04em;display:block;margin-bottom:4px;">\u05E9\u05D5\u05DC\u05D7\u05E0\u05D9</strong>${data.report.screenshotObservations.desktop}</div>
              <div class="glass" style="flex:1;padding:10px 14px;font-size:13px;color:rgba(236,236,236,.6);line-height:1.5;"><strong style="color:#4DBCD0;font-size:11px;letter-spacing:.04em;display:block;margin-bottom:4px;">\u05E0\u05D9\u05D9\u05D3</strong>${data.report.screenshotObservations.mobile}</div>
            </div>
          </div>
          <div class="c">
            <h2 class="st">\u05E0\u05D9\u05EA\u05D5\u05D7 CRO \u05D5\u05D7\u05D5\u05D5\u05D9\u05D9\u05EA \u05DE\u05E9\u05EA\u05DE\u05E9</h2>
            <div class="at">${data.report.croAnalysis}</div>
          </div>
        </div>
      </div>
    ${f}</div>`;
}

function renderCompetitorMarket(data: AuditData): string {
  const { h, f } = chrome('\u05EA\u05D7\u05E8\u05D5\u05EA \u05D5\u05E9\u05D5\u05E7', 4);
  const comp = data.report.competitorAnalysis;

  return `
    <div class="page"><div class="glow g-tr"></div>${h}
      <div class="pb">
        <div class="two">
          <div class="c">
            <h2 class="st">\u05E0\u05D9\u05EA\u05D5\u05D7 \u05EA\u05D7\u05E8\u05D5\u05EA\u05D9</h2>
            <div class="at" style="margin-bottom:14px;">${comp.insight}</div>
            <div style="display:flex;flex-direction:column;gap:10px;">
              ${comp.competitors.map(c => `
                <div class="glass" style="padding:14px 18px;">
                  <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                    <span style="font-size:16px;font-weight:800;color:#ECECEC;">${c.name}</span>
                    <span style="font-size:11px;color:rgba(236,236,236,.35);">${c.url}</span>
                  </div>
                  <div style="font-size:13px;color:rgba(236,236,236,.6);line-height:1.55;">${c.strengths}</div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="c">
            <h2 class="st">\u05EA\u05D5\u05D1\u05E0\u05D5\u05EA \u05E9\u05D9\u05D5\u05D5\u05E7\u05D9\u05D5\u05EA</h2>
            <div class="at">${data.report.marketingChannelInsights}</div>
          </div>
        </div>
      </div>
    ${f}</div>`;
}

function renderTechnical(data: AuditData): string {
  const { h, f } = chrome('\u05E0\u05D9\u05EA\u05D5\u05D7 \u05D8\u05DB\u05E0\u05D9', 5);
  const s = data.scraped;

  const checks = [
    { label: '\u05D0\u05D9\u05E9\u05D5\u05E8 SSL (HTTPS)', pass: s.hasSSL },
    { label: '\u05EA\u05D2\u05D9\u05EA Viewport', pass: s.hasViewportMeta },
    { label: '\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05DE\u05D5\u05D1\u05E0\u05D9\u05DD (Schema.org)', pass: s.hasSchemaOrg },
    { label: '\u05EA\u05D9\u05D0\u05D5\u05E8 \u05D4\u05D3\u05E3 (Meta Description)', pass: !!s.metaDescription },
    { label: '\u05DE\u05D9\u05DC\u05D5\u05EA \u05DE\u05E4\u05EA\u05D7 (Meta Keywords)', pass: !!s.metaKeywords },
    { label: '\u05EA\u05D2\u05D9\u05D5\u05EA OG \u05DC\u05E8\u05E9\u05EA\u05D5\u05EA \u05D7\u05D1\u05E8\u05EA\u05D9\u05D5\u05EA', pass: Object.keys(s.ogTags).length > 0 },
    { label: `\u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05E2\u05DD \u05EA\u05D9\u05D0\u05D5\u05E8 Alt (${s.imagesWithAlt}/${s.imageCount})`, pass: s.imageCount > 0 && s.imagesWithAlt === s.imageCount },
    { label: `\u05E7\u05D9\u05E9\u05D5\u05E8\u05D9\u05DD \u05E4\u05E0\u05D9\u05DE\u05D9\u05D9\u05DD (${s.internalLinkCount})`, pass: s.internalLinkCount >= 5 },
  ];

  const topHeadings = s.headings.slice(0, 6);

  return `
    <div class="page"><div class="glow g-bl"></div>${h}
      <div class="pb">
        <div class="two">
          <div class="c">
            <h2 class="st">\u05D1\u05D3\u05D9\u05E7\u05EA SEO \u05D8\u05DB\u05E0\u05D9\u05EA</h2>
            <div class="cg">
              ${checks.map(c => `<div class="ci"><div class="ck ${c.pass ? 'cp' : 'cf'}">${c.pass ? '\u2713' : '\u2717'}</div><span>${c.label}</span></div>`).join('')}
            </div>

            <h3 class="sst">\u05EA\u05D2\u05D9\u05D5\u05EA Meta</h3>
            <div class="glass" style="padding:10px 14px;margin:4px 0;">
              <div class="meta-row">
                <span class="meta-tag">\u05DB\u05D5\u05EA\u05E8\u05EA</span>
                <span class="meta-val">${s.title || '\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0'}</span>
              </div>
              <div class="meta-row">
                <span class="meta-tag">\u05EA\u05D9\u05D0\u05D5\u05E8</span>
                <span class="meta-val">${s.metaDescription ? s.metaDescription.slice(0, 120) + (s.metaDescription.length > 120 ? '...' : '') : '\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0'}</span>
              </div>
              <div class="meta-row">
                <span class="meta-tag">\u05DE\u05D9\u05DC\u05D5\u05EA \u05DE\u05E4\u05EA\u05D7</span>
                <span class="meta-val">${s.metaKeywords ? s.metaKeywords.slice(0, 100) + (s.metaKeywords.length > 100 ? '...' : '') : '\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0'}</span>
              </div>
              <div class="meta-row">
                <span class="meta-tag">\u05E9\u05E4\u05D4</span>
                <span class="meta-val">${s.language || '\u05DC\u05D0 \u05DE\u05D5\u05D2\u05D3\u05E8'} (${s.direction || 'ltr'})</span>
              </div>
              ${Object.keys(s.ogTags).length > 0 ? Object.entries(s.ogTags).slice(0, 3).map(([k, v]) => `
              <div class="meta-row">
                <span class="meta-tag">og:${k}</span>
                <span class="meta-val">${String(v).slice(0, 80)}</span>
              </div>`).join('') : ''}
            </div>

            <h3 class="sst">\u05DE\u05D1\u05E0\u05D4 \u05DB\u05D5\u05EA\u05E8\u05D5\u05EA</h3>
            <div class="h-list">
              ${topHeadings.map(x => `<div class="h-item"><span class="h-level">H${x.level}</span><span class="h-text" style="padding-right:${(x.level - 1) * 14}px;">${x.text.slice(0, 60)}</span></div>`).join('')}
              ${s.headings.length > 6 ? `<div style="font-size:12px;color:rgba(236,236,236,.35);margin-top:4px;">+${s.headings.length - 6} \u05E0\u05D5\u05E1\u05E4\u05D5\u05EA...</div>` : ''}
            </div>
          </div>
          <div class="c">
            <h2 class="st">\u05E0\u05D9\u05EA\u05D5\u05D7 SEO</h2>
            <div class="at">${data.report.seoAnalysis}</div>
          </div>
        </div>
      </div>
    ${f}</div>`;
}

function renderPerformance(data: AuditData): string {
  const { h, f } = chrome('\u05D1\u05D9\u05E6\u05D5\u05E2\u05D9\u05DD', 6);
  const ps = data.pageSpeed;
  const hasScores = ps.performanceScore > 0;

  return `
    <div class="page"><div class="glow g-tr"></div>${h}
      <div class="pb">
        <div class="two">
          <div class="c">
            <h2 class="st">\u05E6\u05D9\u05D5\u05E0\u05D9 \u05D1\u05D9\u05E6\u05D5\u05E2\u05D9\u05DD</h2>
            ${hasScores ? `<div class="sc-grid">${scoreGaugeSVG(ps.performanceScore, '\u05D1\u05D9\u05E6\u05D5\u05E2\u05D9\u05DD')}${scoreGaugeSVG(ps.accessibilityScore, '\u05E0\u05D2\u05D9\u05E9\u05D5\u05EA')}${scoreGaugeSVG(ps.seoScore, 'SEO')}${scoreGaugeSVG(ps.bestPracticesScore, '\u05E9\u05D9\u05D8\u05D5\u05EA \u05DE\u05D5\u05DE\u05DC\u05E6\u05D5\u05EA')}</div>` : `<div class="glass" style="text-align:center;padding:28px;color:rgba(236,236,236,.45);font-size:16px;">\u05E0\u05EA\u05D5\u05E0\u05D9 PageSpeed \u05DC\u05D0 \u05D6\u05DE\u05D9\u05E0\u05D9\u05DD \u05DB\u05E8\u05D2\u05E2.</div><div class="at" style="margin-top:14px;">\u05D4\u05D0\u05EA\u05E8 \u05D0\u05D9\u05E0\u05D5 \u05E0\u05DE\u05E6\u05D0 \u05D1\u05DE\u05D0\u05D2\u05E8 \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05E9\u05DC Google PageSpeed Insights \u2014 \u05D6\u05D4 \u05E7\u05D5\u05E8\u05D4 \u05DC\u05E8\u05D5\u05D1 \u05DC\u05D0\u05EA\u05E8\u05D9\u05DD \u05D7\u05D3\u05E9\u05D9\u05DD \u05D0\u05D5 \u05D0\u05EA\u05E8\u05D9\u05DD \u05E2\u05DD \u05EA\u05E0\u05D5\u05E2\u05D4 \u05DE\u05D5\u05E2\u05D8\u05D4. \u05DE\u05D5\u05DE\u05DC\u05E5 \u05DC\u05D1\u05D3\u05D5\u05E7 \u05D0\u05EA \u05D4\u05D1\u05D9\u05E6\u05D5\u05E2\u05D9\u05DD \u05D9\u05D3\u05E0\u05D9\u05EA \u05D1\u05DB\u05EA\u05D5\u05D1\u05EA: <span style="color:#4DBCD0;">pagespeed.web.dev</span></div>`}
            <h3 class="sst">\u05DE\u05D3\u05D3\u05D9 \u05D0\u05D9\u05E0\u05D8\u05E8\u05E0\u05D8 \u05DE\u05E8\u05DB\u05D6\u05D9\u05D9\u05DD (Core Web Vitals)</h3>
            <div class="vc">
              <div class="vi"><div class="vn">LCP</div><div class="vv" style="color:${ratingColor(ps.lcp.rating)}">${hasScores ? ps.lcp.value + ps.lcp.unit : '\u2014'}</div><div class="vr" style="color:${ratingColor(ps.lcp.rating)}">${hasScores ? ratingLabel(ps.lcp.rating) : ''}</div></div>
              <div class="vi"><div class="vn">INP</div><div class="vv" style="color:${ratingColor(ps.inp.rating)}">${hasScores ? ps.inp.value + ps.inp.unit : '\u2014'}</div><div class="vr" style="color:${ratingColor(ps.inp.rating)}">${hasScores ? ratingLabel(ps.inp.rating) : ''}</div></div>
              <div class="vi"><div class="vn">CLS</div><div class="vv" style="color:${ratingColor(ps.cls.rating)}">${hasScores ? ps.cls.value + ps.cls.unit : '\u2014'}</div><div class="vr" style="color:${ratingColor(ps.cls.rating)}">${hasScores ? ratingLabel(ps.cls.rating) : ''}</div></div>
            </div>
          </div>
          <div class="c">
            ${ps.opportunities.length > 0 ? `<h2 class="st">\u05D4\u05D6\u05D3\u05DE\u05E0\u05D5\u05D9\u05D5\u05EA \u05DC\u05E9\u05D9\u05E4\u05D5\u05E8</h2><div class="ol">${ps.opportunities.slice(0, 6).map(o => `<div class="oi"><div class="ot">${translatePS(o.title)}</div><div class="od">${translatePSDesc(o.description)}</div></div>`).join('')}</div>` : `<h2 class="st">\u05D4\u05DE\u05DC\u05E6\u05D5\u05EA \u05DC\u05E9\u05D9\u05E4\u05D5\u05E8 \u05D1\u05D9\u05E6\u05D5\u05E2\u05D9\u05DD</h2>
              <div class="ol">
                <div class="oi"><div class="ot">\u05D0\u05D5\u05E4\u05D8\u05D9\u05DE\u05D9\u05D6\u05E6\u05D9\u05D4 \u05E9\u05DC \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA</div><div class="od">\u05D4\u05DE\u05E8\u05EA \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DC\u05E4\u05D5\u05E8\u05DE\u05D8 WebP, \u05D3\u05D7\u05D9\u05E1\u05D4, \u05D5\u05D4\u05EA\u05D0\u05DE\u05EA \u05D2\u05D5\u05D3\u05DC \u05DC\u05E6\u05D5\u05E8\u05DA \u05D4\u05EA\u05E6\u05D5\u05D2\u05D4 \u05D1\u05E4\u05D5\u05E2\u05DC.</div></div>
                <div class="oi"><div class="ot">\u05E6\u05DE\u05E6\u05D5\u05DD JavaScript \u05D5-CSS</div><div class="od">\u05D4\u05E1\u05E8\u05EA \u05E7\u05D5\u05D3 \u05DC\u05D0 \u05D1\u05E9\u05D9\u05DE\u05D5\u05E9, \u05DE\u05D6\u05E2\u05D5\u05E8 \u05E7\u05D1\u05E6\u05D9\u05DD, \u05D5\u05D3\u05D7\u05D9\u05D9\u05EA \u05D8\u05E2\u05D9\u05E0\u05EA \u05E1\u05E7\u05E8\u05D9\u05E4\u05D8\u05D9\u05DD \u05DC\u05D0 \u05E7\u05E8\u05D9\u05D8\u05D9\u05D9\u05DD.</div></div>
                <div class="oi"><div class="ot">\u05E9\u05D9\u05DE\u05D5\u05E9 \u05D1-CDN</div><div class="od">\u05E8\u05E9\u05EA \u05D4\u05E4\u05E6\u05EA \u05EA\u05D5\u05DB\u05DF \u05DE\u05E7\u05E8\u05D1\u05EA \u05D0\u05EA \u05D4\u05E7\u05D1\u05E6\u05D9\u05DD \u05DC\u05DE\u05E9\u05EA\u05DE\u05E9 \u05D5\u05DE\u05E9\u05E4\u05E8\u05EA \u05D6\u05DE\u05E0\u05D9 \u05D8\u05E2\u05D9\u05E0\u05D4 \u05DE\u05E9\u05DE\u05E2\u05D5\u05EA\u05D9\u05EA.</div></div>
                <div class="oi"><div class="ot">\u05DE\u05D8\u05DE\u05D5\u05DF \u05D3\u05E4\u05D3\u05E4\u05DF (\u05E7\u05E9\u05D9\u05E0\u05D2)</div><div class="od">\u05D4\u05D2\u05D3\u05E8\u05EA Cache-Control \u05DC\u05DE\u05E9\u05D0\u05D1\u05D9\u05DD \u05E1\u05D8\u05D8\u05D9\u05D9\u05DD \u05DE\u05E4\u05D7\u05D9\u05EA\u05D4 \u05D0\u05EA \u05D4\u05E6\u05D5\u05E8\u05DA \u05D1\u05D8\u05E2\u05D9\u05E0\u05D5\u05EA \u05D7\u05D5\u05D6\u05E8\u05D5\u05EA.</div></div>
                <div class="oi"><div class="ot">\u05D8\u05E2\u05D9\u05E0\u05EA \u05D2\u05D5\u05E4\u05E0\u05D9\u05DD \u05D9\u05E2\u05D9\u05DC\u05D4</div><div class="od">\u05E9\u05D9\u05DE\u05D5\u05E9 \u05D1-font-display: swap \u05D5\u05D8\u05E2\u05D9\u05E0\u05D4 \u05DE\u05E7\u05D3\u05D9\u05DE\u05D4 \u05E9\u05DC \u05D2\u05D5\u05E4\u05E0\u05D9\u05DD \u05DC\u05DE\u05E0\u05D9\u05E2\u05EA \u05D4\u05D1\u05D4\u05D5\u05D1 \u05D1\u05D8\u05E7\u05E1\u05D8.</div></div>
              </div>`}
          </div>
        </div>
      </div>
    ${f}</div>`;
}

function aiStatusSVG(found: boolean | null): string {
  if (found === true) {
    return `<svg width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#4DBCD0"/><path d="M10 18l5 5 11-11" stroke="#0E1F33" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  return `<svg width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#ff4e42"/><path d="M12 12l12 12M24 12l-12 12" stroke="#0E1F33" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
}

function renderAI(data: AuditData): string {
  const { h, f } = chrome('\u05E0\u05D5\u05DB\u05D7\u05D5\u05EA AI \u05D5\u05E0\u05D5\u05DB\u05D7\u05D5\u05EA \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9\u05EA', 7);

  return `
    <div class="page"><div class="glow g-bl"></div>${h}
      <div class="pb">
        <h2 class="st">\u05E0\u05D5\u05DB\u05D7\u05D5\u05EA \u05D1\u05DE\u05E0\u05D5\u05E2\u05D9 AI</h2>
        <div class="ag">
          <div class="ac"><div class="as">${aiStatusSVG(data.aiPresence.foundInChatGPT)}</div><div class="an">ChatGPT</div></div>
          <div class="ac"><div class="as">${aiStatusSVG(data.aiPresence.foundInGemini)}</div><div class="an">Gemini</div></div>
          <div class="ac"><div class="as">${aiStatusSVG(data.aiPresence.foundInPerplexity)}</div><div class="an">Perplexity</div></div>
        </div>
        <div class="glass" style="margin-top:16px;padding:22px 26px;">
          <h3 class="sst" style="margin-top:0;">\u05DE\u05D4 \u05D6\u05D4 \u05D0\u05D5\u05DE\u05E8?</h3>
          <div class="at" style="font-size:15px;">${data.aiPresence.details || data.aiPresence.summary}</div>
        </div>
        <div class="at" style="margin-top:16px;">${data.report.aiPresenceAnalysis}</div>
      </div>
    ${f}</div>`;
}

function renderPhaseColumn(phase: { title: string; items: { title: string; description: string; impact: 'high' | 'medium' | 'low' }[] }): string {
  return `
    <div class="c">
      <h3 class="sst" style="color:#4DBCD0;margin-top:0;font-size:15px;">${phase.title}</h3>
      <div class="al" style="margin:4px 0;">
        ${phase.items.map((item, i) => `
          <div class="ai" style="padding:5px 0;">
            <div class="anum" style="width:24px;height:24px;font-size:12px;">${i + 1}</div>
            <div class="ab">
              <div class="atit" style="font-size:13px;margin-bottom:2px;">${item.title}</div>
              <div class="adesc" style="font-size:11px;line-height:1.4;">${item.description.slice(0, 100)}${item.description.length > 100 ? '...' : ''}</div>
              <div style="margin-top:3px;">${impactBadge(item.impact)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
}

function renderPhasedActionPlan(data: AuditData): string {
  const { h, f } = chrome('\u05EA\u05D5\u05DB\u05E0\u05D9\u05EA 90 \u05D9\u05D5\u05DD', 8);
  const plan = data.report.phasedActionPlan;

  return `
    <div class="page"><div class="glow g-bl"></div><div class="glow g-tr"></div>${h}
      <div class="pb">
        <h2 class="st">\u05EA\u05D5\u05DB\u05E0\u05D9\u05EA \u05E4\u05E2\u05D5\u05DC\u05D4 \u05DC-90 \u05D9\u05D5\u05DD</h2>
        <div style="display:flex;gap:18px;margin-top:8px;">
          ${renderPhaseColumn(plan.phase1)}
          ${renderPhaseColumn(plan.phase2)}
          ${renderPhaseColumn(plan.phase3)}
        </div>

        <!-- Bottom row: Business potential + CTA side by side -->
        <div style="display:flex;gap:14px;margin-top:10px;">
          <div class="glass" style="flex:1;padding:12px 18px;">
            <h3 class="sst" style="margin-top:0;color:#4DBCD0;font-size:15px;">\u05E4\u05D5\u05D8\u05E0\u05E6\u05D9\u05D0\u05DC \u05E6\u05DE\u05D9\u05D7\u05D4</h3>
            <div class="at" style="font-size:12px;line-height:1.5;">${data.report.businessPotential}</div>
          </div>
          <div class="cta" style="flex:1;margin-top:0;padding:12px 18px;">
            <h3 style="font-size:18px;margin-bottom:4px;">\u05E8\u05D5\u05E6\u05D9\u05DD \u05DC\u05E9\u05E4\u05E8 \u05D0\u05EA \u05D4\u05EA\u05D5\u05E6\u05D0\u05D5\u05EA?</h3>
            <p style="font-size:12px;margin-bottom:8px;">\u05E6\u05D5\u05D5\u05EA PPC Advisor \u05D9\u05E2\u05D6\u05D5\u05E8 \u05DC\u05DB\u05DD \u05DC\u05DE\u05DE\u05E9 \u05D0\u05EA \u05D4\u05DE\u05DC\u05E6\u05D5\u05EA \u05D5\u05DC\u05D4\u05E4\u05D5\u05DA \u05D0\u05EA \u05D4\u05E0\u05D5\u05DB\u05D7\u05D5\u05EA \u05D4\u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9\u05EA \u05E9\u05DC\u05DB\u05DD</p>
            <a class="cta-btn" style="padding:10px 36px;font-size:15px;display:inline-flex;align-items:center;gap:8px;" href="https://wa.me/972587497497">\u05D3\u05D1\u05E8\u05D5 \u05D0\u05D9\u05EA\u05E0\u05D5 <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="#0E1F33" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
            <div class="cta-c" style="margin-top:8px;font-size:12px;"><span>058-749-7497</span><span>felix@ppcadvisor.co.il</span></div>
          </div>
        </div>
      </div>
    ${f}</div>`;
}

// ---------------------------------------------------------------------------
// Main
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
  ${renderCover(data)}
  ${renderSituation(data)}
  ${renderCRO(data)}
  ${renderCompetitorMarket(data)}
  ${renderTechnical(data)}
  ${renderPerformance(data)}
  ${renderAI(data)}
  ${renderPhasedActionPlan(data)}
</body>
</html>`;
}
