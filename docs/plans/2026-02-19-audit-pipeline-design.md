# Automated Audit Report Pipeline — Design Document

**Date:** 2026-02-19
**Status:** Approved

## Overview

When a user submits the free audit form on ppcadvisor.co.il, the system automatically:
1. Scrapes and screenshots their website
2. Runs SEO and performance analysis
3. Checks AI presence (ChatGPT/Gemini)
4. Uses Claude API to generate a professional Hebrew report
5. Renders a branded PDF
6. Sends it to the user via email

## Architecture

**Approach:** Single long-running Vercel serverless function (Approach A).

- Platform: Vercel Pro (300s function timeout)
- Runtime: Node.js with TypeScript
- The form POSTs to `/api/audit`, which responds 200 immediately
- `waitUntil()` keeps the function alive for background processing

### Project Structure

```
ppcadvisor/
├── index.html                    # Modify form target to /api/audit
├── api/
│   └── audit.ts                  # Main serverless function
├── lib/
│   ├── scraper.ts                # Website scraping + screenshots
│   ├── analysis.ts               # Claude API analysis
│   ├── pdf-generator.ts          # HTML → PDF with Chromium
│   ├── email.ts                  # Resend email delivery
│   └── templates/
│       └── report.ts             # HTML template for branded PDF
├── fonts/                        # Existing (Ploni)
├── package.json                  # NEW
├── tsconfig.json                 # NEW
└── vercel.json                   # NEW (maxDuration: 300)
```

### Request Flow

```
User submits form
  → POST /api/audit {name, email, phone, website, budget}
  → Function validates input, responds 200 immediately
  → waitUntil() runs pipeline:
      1. Launch Chromium → scrape site + take screenshots
      2. Call PageSpeed Insights API (free, no key needed)
      3. Check AI presence via Claude web search
      4. Send all data to Claude API → get structured Hebrew report
      5. Render branded HTML → PDF via Chromium page.pdf()
      6. Send PDF to user via Resend
      7. Notify felix@ppcadvisor.co.il of new lead
```

## Data Gathering (scraper.ts)

### Screenshots
- Homepage at 1440px width (desktop)
- Homepage at 390px width (mobile)
- Saved as PNG buffers (passed to PDF, not to disk)

### Website Data
- Page title, meta description, meta keywords
- All H1-H6 headings
- Open Graph / social meta tags
- Internal/external link count
- Image count and alt tag coverage
- SSL presence
- Language/direction detection
- Responsive viewport meta tag
- Schema.org / structured data presence
- Load time (Chromium performance metrics)

### Google PageSpeed Insights
- Performance, Accessibility, SEO, Best Practices scores
- Core Web Vitals: LCP, INP, CLS
- Top improvement opportunities

### AI Presence Check
- Claude with web search checks if the business appears in AI chatbot responses for relevant industry queries

## AI Analysis (analysis.ts)

Claude API receives all scraped data and generates a structured Hebrew report.

**Prompt persona:** Senior digital marketing consultant from PPC Advisor.
**Language:** Professional Hebrew, RTL. Marketing-appropriate (not overly formal, not casual).
**Tone:** Helpful and authoritative — points out issues without being alarmist, always offers solutions.

### Report Sections

1. **Cover Page** — "דוח אבחון דיגיטלי" + client name + website + date + PPC Advisor branding
2. **Executive Summary** — 3-4 sentence overview of findings and top priority
3. **Website Screenshots** — Desktop & mobile screenshots with brief observations
4. **Performance Scores** — PageSpeed scores as visual gauges
5. **Core Web Vitals** — LCP, INP, CLS with pass/fail indicators
6. **SEO Analysis** — Meta tags, headings, structured data, link profile, image optimization
7. **AI Presence Analysis** — Appearance in ChatGPT/Gemini/Perplexity responses
8. **Competitor Positioning** — Brief competitive analysis
9. **Priority Action Plan** — Numbered recommendations ordered by impact
10. **Next Steps** — CTA to schedule free consultation with PPC Advisor

## PDF Generation (pdf-generator.ts + report.ts)

**Method:** Generate branded HTML page → render to PDF using Chromium `page.pdf()`.

### Branding
- Colors: Dark navy (#060d18) cover, white content pages, teal accent (#4dbcd0)
- Fonts: Ploni for headings, Heebo for body text
- Logo: logo-horizontal.png on cover and page footers
- Partner badges: Google Partner, Meta Partner, HubSpot on cover
- Layout: A4, RTL, professional margins

### Visual Elements
- Score gauges as SVG circles (PageSpeed-style UI)
- Green/yellow/red color coding for metrics
- Embedded screenshots
- Numbered priority badges for action items

### Specs
- A4, ~8-12 pages
- Embedded fonts (base64 in HTML template)
- Footer: logo + contact info + page number
- Filename: `אבחון-דיגיטלי-{company-name}.pdf`

## Email Delivery (email.ts)

**Service:** Resend (requires domain verification for ppcadvisor.co.il)

### User Email
- **From:** `PPC Advisor <audit@ppcadvisor.co.il>`
- **Subject:** `הדוח שלכם מוכן — אבחון דיגיטלי מ-PPC Advisor`
- **Body:** Clean HTML email (RTL Hebrew):
  - PPC Advisor logo header
  - Greeting with name
  - Brief message teasing top 1-2 findings
  - CTA button
  - WhatsApp link
  - Footer with contact info
- **Attachment:** Generated PDF report

### Team Notification
- Send copy to felix@ppcadvisor.co.il with form data (replaces FormSubmit.co)

### Error Handling
- On pipeline failure: send fallback email to Felix with form data + error details
- User still sees thank-you message (200 was already sent)

## Dependencies

- `@sparticuz/chromium` — headless Chrome for Vercel
- `puppeteer-core` — browser automation (screenshots + PDF)
- `@anthropic-ai/sdk` — Claude API
- `resend` — email delivery
- `typescript` — type safety

## Environment Variables (Vercel)

- `ANTHROPIC_API_KEY` — Claude API key
- `RESEND_API_KEY` — Resend API key

## Costs

- Vercel Pro: $20/mo
- Claude API: ~$0.10-0.30 per audit (depending on content size)
- Resend: free tier covers 100 emails/day
- PageSpeed Insights API: free
