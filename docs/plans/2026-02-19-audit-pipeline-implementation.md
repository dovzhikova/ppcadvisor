# Automated Audit Report Pipeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a user submits the free audit form, automatically scrape their website, analyze it with Claude, generate a branded Hebrew PDF report, and email it to them.

**Architecture:** Single Vercel serverless function at `/api/audit` that responds 200 immediately, then uses `waitUntil()` to run the full pipeline (scrape → analyze → PDF → email) in the background. Uses `@sparticuz/chromium` + `puppeteer-core` for screenshots and PDF rendering, Claude API for analysis, and Resend for email delivery.

**Tech Stack:** TypeScript, Vercel Serverless Functions, Puppeteer Core, @sparticuz/chromium, Anthropic SDK, Resend, Google PageSpeed Insights API

**Design doc:** `docs/plans/2026-02-19-audit-pipeline-design.md`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vercel.json`
- Create: `.env.example`
- Modify: `.gitignore`

**Step 1: Create package.json**

```json
{
  "name": "ppcadvisor",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@sparticuz/chromium": "^131.0.0",
    "puppeteer-core": "^24.0.0",
    "resend": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "lib": ["ES2022"]
  },
  "include": ["api/**/*.ts", "lib/**/*.ts", "tests/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create vercel.json**

```json
{
  "functions": {
    "api/audit.ts": {
      "maxDuration": 300,
      "memory": 3009
    }
  }
}
```

Note: 3009 MB memory needed for Chromium. `maxDuration: 300` requires Vercel Pro plan.

**Step 4: Create .env.example**

```
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
```

**Step 5: Update .gitignore**

Add these lines to the existing `.gitignore`:

```
node_modules/
dist/
.env
.env.local
```

**Step 6: Install dependencies**

Run: `cd /Users/dariadovzhikova/ppcadvisor && npm install`

**Step 7: Commit**

```bash
git add package.json tsconfig.json vercel.json .env.example .gitignore
git commit -m "feat: scaffold project for serverless audit pipeline"
```

---

## Task 2: Type Definitions

**Files:**
- Create: `lib/types.ts`

**Step 1: Create shared type definitions**

This file defines all the data structures passed between modules. Every other module imports from here.

```typescript
// lib/types.ts

export interface AuditRequest {
  name: string;
  email: string;
  phone: string;
  website: string;
  source: 'landing_page_section' | 'popup' | 'contact_form';
}

export interface ScrapedData {
  url: string;
  title: string;
  metaDescription: string;
  metaKeywords: string;
  ogTags: Record<string, string>;
  headings: { level: number; text: string }[];
  internalLinkCount: number;
  externalLinkCount: number;
  imageCount: number;
  imagesWithAlt: number;
  hasSSL: boolean;
  language: string;
  direction: string;
  hasViewportMeta: boolean;
  hasSchemaOrg: boolean;
  loadTimeMs: number;
  screenshotDesktop: Buffer;
  screenshotMobile: Buffer;
}

export interface PageSpeedResult {
  performanceScore: number;
  accessibilityScore: number;
  seoScore: number;
  bestPracticesScore: number;
  lcp: { value: number; unit: string; rating: 'good' | 'needs-improvement' | 'poor' };
  inp: { value: number; unit: string; rating: 'good' | 'needs-improvement' | 'poor' };
  cls: { value: number; unit: string; rating: 'good' | 'needs-improvement' | 'poor' };
  opportunities: { title: string; description: string }[];
}

export interface AIPresenceResult {
  summary: string;
  foundInChatGPT: boolean | null;
  foundInGemini: boolean | null;
  foundInPerplexity: boolean | null;
  details: string;
}

export interface AuditReport {
  executiveSummary: string;
  screenshotObservations: { desktop: string; mobile: string };
  seoAnalysis: string;
  aiPresenceAnalysis: string;
  competitorPositioning: string;
  actionPlan: { priority: number; title: string; description: string; impact: 'high' | 'medium' | 'low' }[];
  nextSteps: string;
}

export interface AuditData {
  request: AuditRequest;
  scraped: ScrapedData;
  pageSpeed: PageSpeedResult;
  aiPresence: AIPresenceResult;
  report: AuditReport;
}
```

**Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add shared type definitions for audit pipeline"
```

---

## Task 3: Website Scraper Module

**Files:**
- Create: `lib/scraper.ts`
- Create: `tests/scraper.test.ts`

**Step 1: Write tests for data extraction helpers**

The scraper has two parts: (a) Chromium browser automation (hard to unit test) and (b) pure functions that parse the scraped HTML data. We test the pure functions.

```typescript
// tests/scraper.test.ts
import { describe, it, expect } from 'vitest';
import { parseMetaTags, countLinks, analyzeImages, detectHeadings } from '../lib/scraper';

describe('parseMetaTags', () => {
  it('extracts title and meta description from raw page data', () => {
    const raw = {
      title: 'My Business',
      metaTags: [
        { name: 'description', content: 'We do great things' },
        { name: 'keywords', content: 'business, services' },
        { property: 'og:title', content: 'OG Title' },
      ],
    };
    const result = parseMetaTags(raw);
    expect(result.title).toBe('My Business');
    expect(result.metaDescription).toBe('We do great things');
    expect(result.metaKeywords).toBe('business, services');
    expect(result.ogTags).toEqual({ 'og:title': 'OG Title' });
  });

  it('returns empty strings when meta tags are missing', () => {
    const result = parseMetaTags({ title: '', metaTags: [] });
    expect(result.metaDescription).toBe('');
    expect(result.metaKeywords).toBe('');
    expect(result.ogTags).toEqual({});
  });
});

describe('countLinks', () => {
  it('separates internal and external links', () => {
    const links = [
      'https://example.com/about',
      'https://example.com/contact',
      'https://external.com/page',
      'https://another.com',
    ];
    const result = countLinks(links, 'example.com');
    expect(result.internal).toBe(2);
    expect(result.external).toBe(2);
  });
});

describe('analyzeImages', () => {
  it('counts total images and images with alt text', () => {
    const images = [
      { src: 'a.jpg', alt: 'description' },
      { src: 'b.jpg', alt: '' },
      { src: 'c.jpg', alt: 'another' },
    ];
    const result = analyzeImages(images);
    expect(result.total).toBe(3);
    expect(result.withAlt).toBe(2);
  });
});

describe('detectHeadings', () => {
  it('parses heading elements into structured array', () => {
    const headings = [
      { tagName: 'H1', textContent: 'Main Title' },
      { tagName: 'H2', textContent: 'Subtitle' },
      { tagName: 'H3', textContent: 'Section' },
    ];
    const result = detectHeadings(headings);
    expect(result).toEqual([
      { level: 1, text: 'Main Title' },
      { level: 2, text: 'Subtitle' },
      { level: 3, text: 'Section' },
    ]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/scraper.test.ts`
Expected: FAIL — modules not yet created

**Step 3: Implement scraper module**

```typescript
// lib/scraper.ts
import chromium from '@sparticuz/chromium';
import puppeteer, { type Browser } from 'puppeteer-core';
import type { ScrapedData } from './types';

// --- Pure helper functions (exported for testing) ---

interface RawMetaTags {
  title: string;
  metaTags: { name?: string; property?: string; content: string }[];
}

export function parseMetaTags(raw: RawMetaTags) {
  const ogTags: Record<string, string> = {};
  let metaDescription = '';
  let metaKeywords = '';

  for (const tag of raw.metaTags) {
    if (tag.name === 'description') metaDescription = tag.content;
    if (tag.name === 'keywords') metaKeywords = tag.content;
    if (tag.property?.startsWith('og:')) ogTags[tag.property] = tag.content;
  }

  return { title: raw.title, metaDescription, metaKeywords, ogTags };
}

export function countLinks(hrefs: string[], hostname: string) {
  let internal = 0;
  let external = 0;
  for (const href of hrefs) {
    try {
      const url = new URL(href);
      if (url.hostname === hostname || url.hostname.endsWith('.' + hostname)) {
        internal++;
      } else {
        external++;
      }
    } catch {
      internal++; // relative URLs are internal
    }
  }
  return { internal, external };
}

export function analyzeImages(images: { src: string; alt: string }[]) {
  return {
    total: images.length,
    withAlt: images.filter((img) => img.alt.trim().length > 0).length,
  };
}

export function detectHeadings(elements: { tagName: string; textContent: string }[]) {
  return elements.map((el) => ({
    level: parseInt(el.tagName.replace('H', ''), 10),
    text: el.textContent.trim(),
  }));
}

// --- Browser-based scraping ---

async function launchBrowser(): Promise<Browser> {
  const executablePath = await chromium.executablePath();
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: null,
    executablePath,
    headless: chromium.headless,
  });
}

export async function scrapeWebsite(url: string): Promise<ScrapedData> {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();

    // Desktop viewport
    await page.setViewport({ width: 1440, height: 900 });

    const startTime = Date.now();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const loadTimeMs = Date.now() - startTime;

    // Take desktop screenshot
    const screenshotDesktop = Buffer.from(
      await page.screenshot({ fullPage: false, type: 'png' })
    );

    // Extract page data via evaluate
    const rawData = await page.evaluate(() => {
      const metaTags = Array.from(document.querySelectorAll('meta')).map((m) => ({
        name: m.getAttribute('name') || '',
        property: m.getAttribute('property') || '',
        content: m.getAttribute('content') || '',
      }));

      const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) => ({
        tagName: h.tagName,
        textContent: h.textContent || '',
      }));

      const links = Array.from(document.querySelectorAll('a[href]')).map(
        (a) => (a as HTMLAnchorElement).href
      );

      const images = Array.from(document.querySelectorAll('img')).map((img) => ({
        src: img.src,
        alt: img.alt || '',
      }));

      const hasViewportMeta = !!document.querySelector('meta[name="viewport"]');
      const hasSchemaOrg =
        !!document.querySelector('script[type="application/ld+json"]') ||
        !!document.querySelector('[itemscope]');
      const lang = document.documentElement.lang || '';
      const dir = document.documentElement.dir || getComputedStyle(document.documentElement).direction || '';

      return {
        title: document.title,
        metaTags,
        headings,
        links,
        images,
        hasViewportMeta,
        hasSchemaOrg,
        lang,
        dir,
      };
    });

    // Mobile screenshot
    await page.setViewport({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    const screenshotMobile = Buffer.from(
      await page.screenshot({ fullPage: false, type: 'png' })
    );

    // Parse extracted data
    const meta = parseMetaTags({ title: rawData.title, metaTags: rawData.metaTags });
    const hostname = new URL(url).hostname;
    const linkCounts = countLinks(rawData.links, hostname);
    const imageCounts = analyzeImages(rawData.images);
    const headings = detectHeadings(rawData.headings);

    return {
      url,
      title: meta.title,
      metaDescription: meta.metaDescription,
      metaKeywords: meta.metaKeywords,
      ogTags: meta.ogTags,
      headings,
      internalLinkCount: linkCounts.internal,
      externalLinkCount: linkCounts.external,
      imageCount: imageCounts.total,
      imagesWithAlt: imageCounts.withAlt,
      hasSSL: url.startsWith('https'),
      language: rawData.lang,
      direction: rawData.dir,
      hasViewportMeta: rawData.hasViewportMeta,
      hasSchemaOrg: rawData.hasSchemaOrg,
      loadTimeMs,
      screenshotDesktop,
      screenshotMobile,
    };
  } finally {
    await browser.close();
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/scraper.test.ts`
Expected: PASS (all 4 test suites)

**Step 5: Commit**

```bash
git add lib/scraper.ts tests/scraper.test.ts
git commit -m "feat: add website scraper with Chromium screenshots"
```

---

## Task 4: PageSpeed Insights Module

**Files:**
- Create: `lib/pagespeed.ts`
- Create: `tests/pagespeed.test.ts`

**Step 1: Write test for PageSpeed response parsing**

```typescript
// tests/pagespeed.test.ts
import { describe, it, expect } from 'vitest';
import { parsePageSpeedResponse } from '../lib/pagespeed';

describe('parsePageSpeedResponse', () => {
  it('extracts scores and web vitals from API response', () => {
    const apiResponse = {
      lighthouseResult: {
        categories: {
          performance: { score: 0.85 },
          accessibility: { score: 0.92 },
          seo: { score: 0.78 },
          'best-practices': { score: 0.88 },
        },
        audits: {
          'largest-contentful-paint': { numericValue: 2500, displayValue: '2.5 s' },
          'interaction-to-next-paint': { numericValue: 150, displayValue: '150 ms' },
          'cumulative-layout-shift': { numericValue: 0.05, displayValue: '0.05' },
        },
      },
    };

    const result = parsePageSpeedResponse(apiResponse);
    expect(result.performanceScore).toBe(85);
    expect(result.accessibilityScore).toBe(92);
    expect(result.seoScore).toBe(78);
    expect(result.bestPracticesScore).toBe(88);
    expect(result.lcp.value).toBe(2500);
    expect(result.lcp.rating).toBe('good');
    expect(result.cls.value).toBe(0.05);
    expect(result.cls.rating).toBe('good');
  });

  it('rates LCP as poor when above 4000ms', () => {
    const apiResponse = {
      lighthouseResult: {
        categories: {
          performance: { score: 0.3 },
          accessibility: { score: 0.5 },
          seo: { score: 0.5 },
          'best-practices': { score: 0.5 },
        },
        audits: {
          'largest-contentful-paint': { numericValue: 5000, displayValue: '5.0 s' },
          'interaction-to-next-paint': { numericValue: 500, displayValue: '500 ms' },
          'cumulative-layout-shift': { numericValue: 0.3, displayValue: '0.3' },
        },
      },
    };

    const result = parsePageSpeedResponse(apiResponse);
    expect(result.lcp.rating).toBe('poor');
    expect(result.inp.rating).toBe('poor');
    expect(result.cls.rating).toBe('poor');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/pagespeed.test.ts`
Expected: FAIL

**Step 3: Implement PageSpeed module**

```typescript
// lib/pagespeed.ts
import type { PageSpeedResult } from './types';

function rateLCP(ms: number): 'good' | 'needs-improvement' | 'poor' {
  if (ms <= 2500) return 'good';
  if (ms <= 4000) return 'needs-improvement';
  return 'poor';
}

function rateINP(ms: number): 'good' | 'needs-improvement' | 'poor' {
  if (ms <= 200) return 'good';
  if (ms <= 500) return 'needs-improvement';
  return 'poor';
}

function rateCLS(value: number): 'good' | 'needs-improvement' | 'poor' {
  if (value <= 0.1) return 'good';
  if (value <= 0.25) return 'needs-improvement';
  return 'poor';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parsePageSpeedResponse(response: any): PageSpeedResult {
  const cats = response.lighthouseResult.categories;
  const audits = response.lighthouseResult.audits;

  const lcpMs = audits['largest-contentful-paint']?.numericValue ?? 0;
  const inpMs = audits['interaction-to-next-paint']?.numericValue ?? 0;
  const clsVal = audits['cumulative-layout-shift']?.numericValue ?? 0;

  // Extract top opportunities (audits with savings)
  const opportunities: { title: string; description: string }[] = [];
  const opportunityIds = [
    'render-blocking-resources',
    'unused-css-rules',
    'unused-javascript',
    'modern-image-formats',
    'offscreen-images',
    'unminified-css',
    'unminified-javascript',
    'efficient-animated-content',
    'uses-responsive-images',
  ];
  for (const id of opportunityIds) {
    const audit = audits[id];
    if (audit && audit.score !== null && audit.score < 1) {
      opportunities.push({ title: audit.title || id, description: audit.description || '' });
    }
  }

  return {
    performanceScore: Math.round((cats.performance?.score ?? 0) * 100),
    accessibilityScore: Math.round((cats.accessibility?.score ?? 0) * 100),
    seoScore: Math.round((cats.seo?.score ?? 0) * 100),
    bestPracticesScore: Math.round((cats['best-practices']?.score ?? 0) * 100),
    lcp: { value: lcpMs, unit: 'ms', rating: rateLCP(lcpMs) },
    inp: { value: inpMs, unit: 'ms', rating: rateINP(inpMs) },
    cls: { value: clsVal, unit: '', rating: rateCLS(clsVal) },
    opportunities: opportunities.slice(0, 5),
  };
}

export async function getPageSpeedInsights(url: string): Promise<PageSpeedResult> {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=performance&category=accessibility&category=seo&category=best-practices&strategy=mobile`;

  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`PageSpeed API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return parsePageSpeedResponse(data);
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/pagespeed.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/pagespeed.ts tests/pagespeed.test.ts
git commit -m "feat: add PageSpeed Insights module with scoring"
```

---

## Task 5: Claude Analysis Module

**Files:**
- Create: `lib/analysis.ts`
- Create: `tests/analysis.test.ts`

**Step 1: Write test for prompt construction**

```typescript
// tests/analysis.test.ts
import { describe, it, expect } from 'vitest';
import { buildAnalysisPrompt, parseReportResponse } from '../lib/analysis';
import type { ScrapedData, PageSpeedResult, AIPresenceResult } from '../lib/types';

const mockScraped: Omit<ScrapedData, 'screenshotDesktop' | 'screenshotMobile'> = {
  url: 'https://example.co.il',
  title: 'Example Business',
  metaDescription: 'We provide services',
  metaKeywords: 'services, business',
  ogTags: { 'og:title': 'Example' },
  headings: [{ level: 1, text: 'Welcome' }],
  internalLinkCount: 15,
  externalLinkCount: 3,
  imageCount: 10,
  imagesWithAlt: 6,
  hasSSL: true,
  language: 'he',
  direction: 'rtl',
  hasViewportMeta: true,
  hasSchemaOrg: false,
  loadTimeMs: 3200,
};

const mockPageSpeed: PageSpeedResult = {
  performanceScore: 72,
  accessibilityScore: 88,
  seoScore: 82,
  bestPracticesScore: 90,
  lcp: { value: 3100, unit: 'ms', rating: 'needs-improvement' },
  inp: { value: 180, unit: 'ms', rating: 'good' },
  cls: { value: 0.08, unit: '', rating: 'good' },
  opportunities: [{ title: 'Reduce unused JS', description: 'Remove unused JavaScript' }],
};

const mockAIPresence: AIPresenceResult = {
  summary: 'Low AI presence',
  foundInChatGPT: false,
  foundInGemini: false,
  foundInPerplexity: false,
  details: 'Business not found in AI responses',
};

describe('buildAnalysisPrompt', () => {
  it('includes all data sections in the prompt', () => {
    const prompt = buildAnalysisPrompt(mockScraped, mockPageSpeed, mockAIPresence);
    expect(prompt).toContain('example.co.il');
    expect(prompt).toContain('72'); // performance score
    expect(prompt).toContain('SEO');
    expect(prompt).toContain('AI');
  });

  it('includes instructions for Hebrew output', () => {
    const prompt = buildAnalysisPrompt(mockScraped, mockPageSpeed, mockAIPresence);
    expect(prompt).toContain('Hebrew');
  });
});

describe('parseReportResponse', () => {
  it('parses valid JSON response from Claude', () => {
    const json = JSON.stringify({
      executiveSummary: 'Summary text',
      screenshotObservations: { desktop: 'Looks clean', mobile: 'Responsive' },
      seoAnalysis: 'SEO needs work',
      aiPresenceAnalysis: 'Not found in AI',
      competitorPositioning: 'Behind competitors',
      actionPlan: [
        { priority: 1, title: 'Fix SEO', description: 'Add meta tags', impact: 'high' },
      ],
      nextSteps: 'Schedule a call',
    });
    const result = parseReportResponse(json);
    expect(result.executiveSummary).toBe('Summary text');
    expect(result.actionPlan).toHaveLength(1);
    expect(result.actionPlan[0].priority).toBe(1);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/analysis.test.ts`
Expected: FAIL

**Step 3: Implement analysis module**

```typescript
// lib/analysis.ts
import Anthropic from '@anthropic-ai/sdk';
import type { ScrapedData, PageSpeedResult, AIPresenceResult, AuditReport } from './types';

const client = new Anthropic();

export function buildAnalysisPrompt(
  scraped: Omit<ScrapedData, 'screenshotDesktop' | 'screenshotMobile'>,
  pageSpeed: PageSpeedResult,
  aiPresence: AIPresenceResult
): string {
  return `You are a senior digital marketing consultant at PPC Advisor (ppcadvisor.co.il), a leading Israeli digital marketing agency with 14 years of experience and 267+ clients. You write in professional Hebrew — marketing-appropriate, not overly formal, not casual.

Analyze the following website data and produce a structured audit report in Hebrew.

## Website Data
- URL: ${scraped.url}
- Title: ${scraped.title}
- Meta Description: ${scraped.metaDescription}
- Meta Keywords: ${scraped.metaKeywords}
- Open Graph Tags: ${JSON.stringify(scraped.ogTags)}
- Headings: ${JSON.stringify(scraped.headings)}
- Internal Links: ${scraped.internalLinkCount}
- External Links: ${scraped.externalLinkCount}
- Images: ${scraped.imageCount} total, ${scraped.imagesWithAlt} with alt text
- SSL: ${scraped.hasSSL ? 'Yes' : 'No'}
- Language: ${scraped.language}, Direction: ${scraped.direction}
- Viewport Meta: ${scraped.hasViewportMeta ? 'Yes' : 'No'}
- Schema.org: ${scraped.hasSchemaOrg ? 'Yes' : 'No'}
- Load Time: ${scraped.loadTimeMs}ms

## PageSpeed Insights
- Performance: ${pageSpeed.performanceScore}/100
- Accessibility: ${pageSpeed.accessibilityScore}/100
- SEO: ${pageSpeed.seoScore}/100
- Best Practices: ${pageSpeed.bestPracticesScore}/100
- LCP: ${pageSpeed.lcp.value}ms (${pageSpeed.lcp.rating})
- INP: ${pageSpeed.inp.value}ms (${pageSpeed.inp.rating})
- CLS: ${pageSpeed.cls.value} (${pageSpeed.cls.rating})
- Top Opportunities: ${JSON.stringify(pageSpeed.opportunities)}

## AI Presence
${aiPresence.details}

## Instructions
Write ALL content in Hebrew. Be helpful and authoritative — point out issues without being alarmist, always offer solutions. Focus on actionable recommendations.

Respond with a JSON object (no markdown fencing) with this exact structure:
{
  "executiveSummary": "3-4 sentence overview in Hebrew",
  "screenshotObservations": {
    "desktop": "Observations about desktop appearance in Hebrew",
    "mobile": "Observations about mobile appearance in Hebrew"
  },
  "seoAnalysis": "Detailed SEO analysis paragraph in Hebrew",
  "aiPresenceAnalysis": "AI presence analysis paragraph in Hebrew",
  "competitorPositioning": "Brief competitive analysis in Hebrew",
  "actionPlan": [
    { "priority": 1, "title": "Action title in Hebrew", "description": "What to do and why in Hebrew", "impact": "high" },
    { "priority": 2, "title": "...", "description": "...", "impact": "medium" }
  ],
  "nextSteps": "CTA paragraph in Hebrew mentioning free consultation with PPC Advisor"
}

Include 5-8 action plan items ordered by impact. Return ONLY the JSON object.`;
}

export function parseReportResponse(text: string): AuditReport {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
  return JSON.parse(cleaned) as AuditReport;
}

export async function analyzeWebsite(
  scraped: ScrapedData,
  pageSpeed: PageSpeedResult,
  aiPresence: AIPresenceResult
): Promise<AuditReport> {
  const { screenshotDesktop, screenshotMobile, ...scrapedWithoutBuffers } = scraped;

  const prompt = buildAnalysisPrompt(scrapedWithoutBuffers, pageSpeed, aiPresence);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  return parseReportResponse(responseText);
}

export async function checkAIPresence(
  businessName: string,
  url: string
): Promise<AIPresenceResult> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Check if the business "${businessName}" (website: ${url}) appears in AI search results. Search for the business name and related industry terms. Report whether this business is mentioned by AI assistants like ChatGPT, Gemini, or Perplexity when users ask about their industry/services.

Respond with a JSON object (no markdown fencing):
{
  "summary": "Brief summary in Hebrew",
  "foundInChatGPT": true/false/null,
  "foundInGemini": true/false/null,
  "foundInPerplexity": true/false/null,
  "details": "Detailed findings in Hebrew"
}

Return ONLY the JSON object.`,
      },
    ],
  });

  const responseText = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const cleaned = responseText.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
  return JSON.parse(cleaned) as AIPresenceResult;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/analysis.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/analysis.ts tests/analysis.test.ts
git commit -m "feat: add Claude analysis module for Hebrew report generation"
```

---

## Task 6: PDF Report HTML Template

**Files:**
- Create: `lib/templates/report.ts`
- Create: `tests/report-template.test.ts`

This is the largest single file. It generates the complete branded HTML that gets rendered to PDF.

**Step 1: Write test for template rendering**

```typescript
// tests/report-template.test.ts
import { describe, it, expect } from 'vitest';
import { renderReportHTML } from '../lib/templates/report';
import type { AuditData } from '../lib/types';

function makeMockAuditData(): AuditData {
  return {
    request: { name: 'Test User', email: 'test@example.com', phone: '050-1234567', website: 'https://example.co.il', source: 'landing_page_section' },
    scraped: {
      url: 'https://example.co.il', title: 'Example', metaDescription: 'Desc', metaKeywords: '',
      ogTags: {}, headings: [{ level: 1, text: 'Title' }], internalLinkCount: 10,
      externalLinkCount: 2, imageCount: 5, imagesWithAlt: 3, hasSSL: true,
      language: 'he', direction: 'rtl', hasViewportMeta: true, hasSchemaOrg: false,
      loadTimeMs: 2500, screenshotDesktop: Buffer.from('desktop-png'), screenshotMobile: Buffer.from('mobile-png'),
    },
    pageSpeed: {
      performanceScore: 75, accessibilityScore: 90, seoScore: 80, bestPracticesScore: 85,
      lcp: { value: 2800, unit: 'ms', rating: 'needs-improvement' },
      inp: { value: 150, unit: 'ms', rating: 'good' },
      cls: { value: 0.05, unit: '', rating: 'good' },
      opportunities: [{ title: 'Reduce JS', description: 'Remove unused JS' }],
    },
    aiPresence: { summary: 'Low', foundInChatGPT: false, foundInGemini: false, foundInPerplexity: false, details: 'Not found' },
    report: {
      executiveSummary: 'סיכום מנהלים', screenshotObservations: { desktop: 'נראה טוב', mobile: 'רספונסיבי' },
      seoAnalysis: 'ניתוח SEO', aiPresenceAnalysis: 'ניתוח AI', competitorPositioning: 'עמדה תחרותית',
      actionPlan: [{ priority: 1, title: 'תקנו SEO', description: 'הוסיפו meta tags', impact: 'high' }],
      nextSteps: 'צרו קשר',
    },
  };
}

describe('renderReportHTML', () => {
  it('produces valid HTML with RTL direction', () => {
    const html = renderReportHTML(makeMockAuditData());
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="he"');
  });

  it('includes the client name and website', () => {
    const html = renderReportHTML(makeMockAuditData());
    expect(html).toContain('Test User');
    expect(html).toContain('example.co.il');
  });

  it('includes performance scores', () => {
    const html = renderReportHTML(makeMockAuditData());
    expect(html).toContain('75');
    expect(html).toContain('90');
    expect(html).toContain('80');
  });

  it('includes action plan items', () => {
    const html = renderReportHTML(makeMockAuditData());
    expect(html).toContain('תקנו SEO');
  });

  it('embeds screenshots as base64 data URIs', () => {
    const html = renderReportHTML(makeMockAuditData());
    expect(html).toContain('data:image/png;base64,');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/report-template.test.ts`
Expected: FAIL

**Step 3: Implement the HTML template**

This file is large. The template renders a multi-page A4 PDF with branded styling. Key sections:

```typescript
// lib/templates/report.ts
import type { AuditData } from '../types';
import { readFileSync } from 'fs';
import { join } from 'path';

function loadAssetBase64(filename: string): string {
  try {
    const buffer = readFileSync(join(process.cwd(), filename));
    const ext = filename.split('.').pop()?.toLowerCase();
    const mime =
      ext === 'svg' ? 'image/svg+xml' :
      ext === 'png' ? 'image/png' :
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      'application/octet-stream';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return '';
  }
}

function scoreColor(score: number): string {
  if (score >= 90) return '#0cce6b';
  if (score >= 50) return '#ffa400';
  return '#ff4e42';
}

function ratingColor(rating: string): string {
  if (rating === 'good') return '#0cce6b';
  if (rating === 'needs-improvement') return '#ffa400';
  return '#ff4e42';
}

function ratingLabel(rating: string): string {
  if (rating === 'good') return 'תקין';
  if (rating === 'needs-improvement') return 'דורש שיפור';
  return 'בעייתי';
}

function impactBadge(impact: string): string {
  const colors: Record<string, string> = { high: '#ff4e42', medium: '#ffa400', low: '#0cce6b' };
  const labels: Record<string, string> = { high: 'גבוהה', medium: 'בינונית', low: 'נמוכה' };
  return `<span style="background:${colors[impact] || '#999'};color:#fff;padding:2px 10px;border-radius:12px;font-size:11px;">${labels[impact] || impact}</span>`;
}

function scoreGaugeSVG(score: number, label: string): string {
  const color = scoreColor(score);
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;
  return `
    <div style="text-align:center;width:110px;">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#eee" stroke-width="8"/>
        <circle cx="50" cy="50" r="40" fill="none" stroke="${color}" stroke-width="8"
          stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
          stroke-linecap="round" transform="rotate(-90 50 50)"/>
        <text x="50" y="52" text-anchor="middle" dominant-baseline="middle"
          font-size="22" font-weight="700" fill="${color}">${score}</text>
      </svg>
      <div style="font-size:11px;color:#555;margin-top:4px;">${label}</div>
    </div>`;
}

export function renderReportHTML(data: AuditData): string {
  const { request, scraped, pageSpeed, report } = data;
  const date = new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });
  const domain = new URL(scraped.url).hostname;

  const logoBase64 = loadAssetBase64('logo-horizontal.png');
  const googleBadge = loadAssetBase64('google-partner-badge.svg');
  const metaBadge = loadAssetBase64('meta-partner-badge.svg');
  const hubspotBadge = loadAssetBase64('hubspot-badge.svg');

  const desktopScreenshot = `data:image/png;base64,${scraped.screenshotDesktop.toString('base64')}`;
  const mobileScreenshot = `data:image/png;base64,${scraped.screenshotMobile.toString('base64')}`;

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800;900&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Heebo', sans-serif; color: #333; line-height: 1.6; direction: rtl; }

  .page { width: 210mm; min-height: 297mm; padding: 20mm 25mm; page-break-after: always; position: relative; }
  .page:last-child { page-break-after: auto; }

  /* Cover page */
  .cover { background: linear-gradient(135deg, #060d18 0%, #0a1628 50%, #060d18 100%); color: #fff; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
  .cover-logo { width: 200px; margin-bottom: 40px; }
  .cover-title { font-size: 36px; font-weight: 800; color: #4dbcd0; margin-bottom: 12px; }
  .cover-subtitle { font-size: 18px; color: rgba(255,255,255,.7); margin-bottom: 40px; }
  .cover-client { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
  .cover-url { font-size: 16px; color: #4dbcd0; margin-bottom: 8px; }
  .cover-date { font-size: 14px; color: rgba(255,255,255,.5); margin-bottom: 48px; }
  .cover-badges { display: flex; gap: 24px; justify-content: center; align-items: center; }
  .cover-badges img { height: 48px; }

  /* Content pages */
  .content { background: #fff; }
  .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #4dbcd0; }
  .page-header img { height: 28px; }
  .page-header .page-title { font-size: 11px; color: #999; }

  h2 { font-size: 22px; font-weight: 800; color: #0a1628; margin-bottom: 16px; position: relative; padding-bottom: 8px; }
  h2::after { content: ''; position: absolute; bottom: 0; right: 0; width: 40px; height: 3px; background: #4dbcd0; border-radius: 2px; }
  h3 { font-size: 16px; font-weight: 700; color: #0a1628; margin-bottom: 8px; }
  p { font-size: 13px; line-height: 1.7; margin-bottom: 12px; }

  .summary-box { background: #f0fafb; border-right: 4px solid #4dbcd0; padding: 20px; border-radius: 0 12px 12px 0; margin-bottom: 24px; }

  .scores-grid { display: flex; justify-content: center; gap: 24px; margin: 24px 0; }

  .vitals-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin: 16px 0; }
  .vital-card { background: #f8f9fa; border-radius: 12px; padding: 16px; text-align: center; }
  .vital-value { font-size: 24px; font-weight: 800; }
  .vital-label { font-size: 11px; color: #666; }
  .vital-rating { font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 12px; display: inline-block; margin-top: 4px; }

  .screenshots { display: flex; gap: 20px; margin: 16px 0; align-items: flex-start; }
  .screenshot-desktop { flex: 2; }
  .screenshot-mobile { flex: 0.6; }
  .screenshot-desktop img, .screenshot-mobile img { width: 100%; border-radius: 8px; border: 1px solid #eee; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
  .screenshot-label { font-size: 11px; color: #999; text-align: center; margin-top: 6px; }

  .seo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0; }
  .seo-item { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .seo-check { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #fff; flex-shrink: 0; }
  .seo-pass { background: #0cce6b; }
  .seo-fail { background: #ff4e42; }
  .seo-warn { background: #ffa400; }

  .action-item { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 16px; padding: 16px; background: #f8f9fa; border-radius: 12px; }
  .action-number { width: 32px; height: 32px; border-radius: 50%; background: #4dbcd0; color: #fff; font-weight: 800; font-size: 15px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .action-content { flex: 1; }
  .action-title { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
  .action-desc { font-size: 12px; color: #555; }

  .cta-box { background: linear-gradient(135deg, #060d18, #0a1628); color: #fff; border-radius: 16px; padding: 32px; text-align: center; margin-top: 24px; }
  .cta-box h3 { color: #4dbcd0; font-size: 20px; margin-bottom: 12px; }
  .cta-box p { color: rgba(255,255,255,.8); font-size: 14px; }
  .cta-btn { display: inline-block; background: #4dbcd0; color: #fff; padding: 12px 32px; border-radius: 24px; font-weight: 700; font-size: 14px; text-decoration: none; margin-top: 16px; }
  .cta-contact { color: #4dbcd0; font-size: 13px; margin-top: 12px; }

  .page-footer { position: absolute; bottom: 15mm; left: 25mm; right: 25mm; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 8px; }
  .page-footer img { height: 16px; }
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="page cover">
  ${logoBase64 ? `<img src="${logoBase64}" class="cover-logo" alt="PPC Advisor">` : '<div class="cover-logo" style="font-size:28px;font-weight:800;color:#4dbcd0;">PPC Advisor</div>'}
  <div class="cover-title">דוח אבחון דיגיטלי</div>
  <div class="cover-subtitle">Digital Audit Report</div>
  <div class="cover-client">${request.name}</div>
  <div class="cover-url">${domain}</div>
  <div class="cover-date">${date}</div>
  <div class="cover-badges">
    ${googleBadge ? `<img src="${googleBadge}" alt="Google Partner">` : ''}
    ${metaBadge ? `<img src="${metaBadge}" alt="Meta Partner">` : ''}
    ${hubspotBadge ? `<img src="${hubspotBadge}" alt="HubSpot">` : ''}
  </div>
</div>

<!-- PAGE 2: EXECUTIVE SUMMARY + SCREENSHOTS -->
<div class="page content">
  <div class="page-header">
    ${logoBase64 ? `<img src="${logoBase64}" alt="PPC Advisor">` : ''}
    <div class="page-title">דוח אבחון דיגיטלי — ${domain}</div>
  </div>

  <h2>סיכום מנהלים</h2>
  <div class="summary-box">
    <p>${report.executiveSummary}</p>
  </div>

  <h2>מראה האתר</h2>
  <div class="screenshots">
    <div class="screenshot-desktop">
      <img src="${desktopScreenshot}" alt="Desktop view">
      <div class="screenshot-label">תצוגת דסקטופ (1440px)</div>
      <p style="font-size:12px;color:#555;margin-top:8px;">${report.screenshotObservations.desktop}</p>
    </div>
    <div class="screenshot-mobile">
      <img src="${mobileScreenshot}" alt="Mobile view">
      <div class="screenshot-label">תצוגת מובייל (390px)</div>
      <p style="font-size:12px;color:#555;margin-top:8px;">${report.screenshotObservations.mobile}</p>
    </div>
  </div>

  <div class="page-footer">
    ${logoBase64 ? `<img src="${logoBase64}" alt="">` : '<span>PPC Advisor</span>'}
    <span>felix@ppcadvisor.co.il | 058-749-7497</span>
    <span>2</span>
  </div>
</div>

<!-- PAGE 3: PERFORMANCE SCORES + WEB VITALS -->
<div class="page content">
  <div class="page-header">
    ${logoBase64 ? `<img src="${logoBase64}" alt="PPC Advisor">` : ''}
    <div class="page-title">דוח אבחון דיגיטלי — ${domain}</div>
  </div>

  <h2>ציוני ביצועים</h2>
  <div class="scores-grid">
    ${scoreGaugeSVG(pageSpeed.performanceScore, 'ביצועים')}
    ${scoreGaugeSVG(pageSpeed.accessibilityScore, 'נגישות')}
    ${scoreGaugeSVG(pageSpeed.seoScore, 'SEO')}
    ${scoreGaugeSVG(pageSpeed.bestPracticesScore, 'Best Practices')}
  </div>

  <h2>Core Web Vitals</h2>
  <div class="vitals-grid">
    <div class="vital-card">
      <div class="vital-value" style="color:${ratingColor(pageSpeed.lcp.rating)}">${(pageSpeed.lcp.value / 1000).toFixed(1)}s</div>
      <div class="vital-label">LCP — Largest Contentful Paint</div>
      <div class="vital-rating" style="background:${ratingColor(pageSpeed.lcp.rating)}20;color:${ratingColor(pageSpeed.lcp.rating)}">${ratingLabel(pageSpeed.lcp.rating)}</div>
    </div>
    <div class="vital-card">
      <div class="vital-value" style="color:${ratingColor(pageSpeed.inp.rating)}">${pageSpeed.inp.value}ms</div>
      <div class="vital-label">INP — Interaction to Next Paint</div>
      <div class="vital-rating" style="background:${ratingColor(pageSpeed.inp.rating)}20;color:${ratingColor(pageSpeed.inp.rating)}">${ratingLabel(pageSpeed.inp.rating)}</div>
    </div>
    <div class="vital-card">
      <div class="vital-value" style="color:${ratingColor(pageSpeed.cls.rating)}">${pageSpeed.cls.value.toFixed(2)}</div>
      <div class="vital-label">CLS — Cumulative Layout Shift</div>
      <div class="vital-rating" style="background:${ratingColor(pageSpeed.cls.rating)}20;color:${ratingColor(pageSpeed.cls.rating)}">${ratingLabel(pageSpeed.cls.rating)}</div>
    </div>
  </div>

  ${pageSpeed.opportunities.length > 0 ? `
  <h3>הזדמנויות לשיפור</h3>
  <ul style="font-size:13px;padding-right:20px;">
    ${pageSpeed.opportunities.map(o => `<li style="margin-bottom:8px;"><strong>${o.title}</strong></li>`).join('')}
  </ul>
  ` : ''}

  <div class="page-footer">
    ${logoBase64 ? `<img src="${logoBase64}" alt="">` : '<span>PPC Advisor</span>'}
    <span>felix@ppcadvisor.co.il | 058-749-7497</span>
    <span>3</span>
  </div>
</div>

<!-- PAGE 4: SEO ANALYSIS -->
<div class="page content">
  <div class="page-header">
    ${logoBase64 ? `<img src="${logoBase64}" alt="PPC Advisor">` : ''}
    <div class="page-title">דוח אבחון דיגיטלי — ${domain}</div>
  </div>

  <h2>ניתוח SEO</h2>

  <div class="seo-grid">
    <div class="seo-item"><div class="seo-check ${scraped.title ? 'seo-pass' : 'seo-fail'}">&#10003;</div> כותרת עמוד (Title Tag)</div>
    <div class="seo-item"><div class="seo-check ${scraped.metaDescription ? 'seo-pass' : 'seo-fail'}">&#10003;</div> Meta Description</div>
    <div class="seo-item"><div class="seo-check ${scraped.hasSSL ? 'seo-pass' : 'seo-fail'}">&#10003;</div> אבטחת SSL</div>
    <div class="seo-item"><div class="seo-check ${scraped.hasViewportMeta ? 'seo-pass' : 'seo-fail'}">&#10003;</div> Viewport Meta Tag</div>
    <div class="seo-item"><div class="seo-check ${scraped.hasSchemaOrg ? 'seo-pass' : 'seo-fail'}">&#10003;</div> Schema.org / נתונים מובנים</div>
    <div class="seo-item"><div class="seo-check ${Object.keys(scraped.ogTags).length > 0 ? 'seo-pass' : 'seo-fail'}">&#10003;</div> Open Graph Tags</div>
    <div class="seo-item"><div class="seo-check ${scraped.headings.some(h => h.level === 1) ? 'seo-pass' : 'seo-fail'}">&#10003;</div> כותרת H1</div>
    <div class="seo-item"><div class="seo-check ${scraped.imagesWithAlt / Math.max(scraped.imageCount, 1) > 0.8 ? 'seo-pass' : scraped.imagesWithAlt / Math.max(scraped.imageCount, 1) > 0.5 ? 'seo-warn' : 'seo-fail'}">&#10003;</div> Alt Text לתמונות (${scraped.imagesWithAlt}/${scraped.imageCount})</div>
  </div>

  <p style="margin-top:16px;">${report.seoAnalysis}</p>

  <h2 style="margin-top:32px;">נוכחות AI</h2>
  <p>${report.aiPresenceAnalysis}</p>

  <h2 style="margin-top:32px;">עמדה תחרותית</h2>
  <p>${report.competitorPositioning}</p>

  <div class="page-footer">
    ${logoBase64 ? `<img src="${logoBase64}" alt="">` : '<span>PPC Advisor</span>'}
    <span>felix@ppcadvisor.co.il | 058-749-7497</span>
    <span>4</span>
  </div>
</div>

<!-- PAGE 5: ACTION PLAN + NEXT STEPS -->
<div class="page content">
  <div class="page-header">
    ${logoBase64 ? `<img src="${logoBase64}" alt="PPC Advisor">` : ''}
    <div class="page-title">דוח אבחון דיגיטלי — ${domain}</div>
  </div>

  <h2>תכנית פעולה מתועדפת</h2>
  ${report.actionPlan.map(item => `
    <div class="action-item">
      <div class="action-number">${item.priority}</div>
      <div class="action-content">
        <div class="action-title">${item.title} ${impactBadge(item.impact)}</div>
        <div class="action-desc">${item.description}</div>
      </div>
    </div>
  `).join('')}

  <div class="cta-box">
    <h3>מה הצעד הבא?</h3>
    <p>${report.nextSteps}</p>
    <a href="https://wa.me/972587497497" class="cta-btn">דברו איתנו בוואצאפ</a>
    <div class="cta-contact">058-749-7497 | felix@ppcadvisor.co.il</div>
  </div>

  <div class="page-footer">
    ${logoBase64 ? `<img src="${logoBase64}" alt="">` : '<span>PPC Advisor</span>'}
    <span>felix@ppcadvisor.co.il | 058-749-7497</span>
    <span>5</span>
  </div>
</div>

</body>
</html>`;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/report-template.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/templates/report.ts tests/report-template.test.ts
git commit -m "feat: add branded HTML template for PDF report"
```

---

## Task 7: PDF Generator Module

**Files:**
- Create: `lib/pdf-generator.ts`

**Step 1: Implement PDF generator**

This module takes the HTML string from the template and renders it to a PDF buffer using Chromium.

```typescript
// lib/pdf-generator.ts
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import type { AuditData } from './types';
import { renderReportHTML } from './templates/report';

export async function generatePDF(data: AuditData): Promise<Buffer> {
  const html = renderReportHTML(data);

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: null,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
```

**Step 2: Commit**

```bash
git add lib/pdf-generator.ts
git commit -m "feat: add PDF generator using Chromium"
```

---

## Task 8: Email Module

**Files:**
- Create: `lib/email.ts`
- Create: `tests/email.test.ts`

**Step 1: Write test for email HTML construction**

```typescript
// tests/email.test.ts
import { describe, it, expect } from 'vitest';
import { buildUserEmailHTML, buildTeamNotificationHTML } from '../lib/email';

describe('buildUserEmailHTML', () => {
  it('produces RTL Hebrew email with client name', () => {
    const html = buildUserEmailHTML('דני', 'example.co.il', ['ציון ביצועים: 72/100', 'חסר Schema.org']);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('דני');
    expect(html).toContain('example.co.il');
  });

  it('includes key findings', () => {
    const html = buildUserEmailHTML('דני', 'example.co.il', ['ציון ביצועים: 72/100']);
    expect(html).toContain('72/100');
  });
});

describe('buildTeamNotificationHTML', () => {
  it('includes all form data', () => {
    const html = buildTeamNotificationHTML({
      name: 'Test', email: 'test@test.com', phone: '050-1234567',
      website: 'https://example.com', source: 'landing_page_section',
    });
    expect(html).toContain('test@test.com');
    expect(html).toContain('050-1234567');
    expect(html).toContain('example.com');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/email.test.ts`
Expected: FAIL

**Step 3: Implement email module**

```typescript
// lib/email.ts
import { Resend } from 'resend';
import type { AuditRequest } from './types';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'PPC Advisor <audit@ppcadvisor.co.il>';
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

  // Send report to user
  await resend.emails.send({
    from: FROM_EMAIL,
    to: request.email,
    subject: 'הדוח שלכם מוכן — אבחון דיגיטלי מ-PPC Advisor',
    html: buildUserEmailHTML(request.name, domain, keyFindings),
    attachments: [
      {
        filename: `אבחון-דיגיטלי-${domain}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  // Notify team
  await resend.emails.send({
    from: FROM_EMAIL,
    to: TEAM_EMAIL,
    subject: `ליד חדש: ${request.name} — ${domain}`,
    html: buildTeamNotificationHTML(request),
    attachments: [
      {
        filename: `אבחון-דיגיטלי-${domain}.pdf`,
        content: pdfBuffer,
      },
    ],
  });
}

export async function sendErrorNotification(request: AuditRequest, error: string): Promise<void> {
  await resend.emails.send({
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
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/email.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/email.ts tests/email.test.ts
git commit -m "feat: add email module with Resend integration"
```

---

## Task 9: Main API Endpoint

**Files:**
- Create: `api/audit.ts`

**Step 1: Implement the serverless function**

This is the orchestrator that ties everything together. It validates input, responds immediately, then runs the pipeline via `waitUntil()`.

```typescript
// api/audit.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AuditRequest, AuditData } from '../lib/types';
import { scrapeWebsite } from '../lib/scraper';
import { getPageSpeedInsights } from '../lib/pagespeed';
import { analyzeWebsite, checkAIPresence } from '../lib/analysis';
import { generatePDF } from '../lib/pdf-generator';
import { sendAuditEmail, sendErrorNotification } from '../lib/email';

function validateRequest(body: Record<string, unknown>): AuditRequest | null {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const website = typeof body.website === 'string' ? body.website.trim() : '';
  const source = typeof body.source === 'string' ? body.source : 'landing_page_section';

  if (!name || !email || !website) return null;

  // Ensure website has protocol
  let url = website;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  return {
    name,
    email,
    phone,
    website: url,
    source: source as AuditRequest['source'],
  };
}

async function runAuditPipeline(request: AuditRequest): Promise<void> {
  // Step 1: Scrape website + take screenshots
  const scraped = await scrapeWebsite(request.website);

  // Step 2: Get PageSpeed scores (run in parallel with AI presence check)
  const [pageSpeed, aiPresence] = await Promise.all([
    getPageSpeedInsights(request.website),
    checkAIPresence(scraped.title || new URL(request.website).hostname, request.website),
  ]);

  // Step 3: Claude analysis — generate Hebrew report
  const report = await analyzeWebsite(scraped, pageSpeed, aiPresence);

  // Step 4: Build full audit data object
  const auditData: AuditData = { request, scraped, pageSpeed, aiPresence, report };

  // Step 5: Generate branded PDF
  const pdfBuffer = await generatePDF(auditData);

  // Step 6: Extract key findings for email teaser
  const keyFindings = report.actionPlan.slice(0, 3).map(
    (item) => `${item.title} (${item.impact === 'high' ? 'עדיפות גבוהה' : item.impact === 'medium' ? 'עדיפות בינונית' : 'עדיפות נמוכה'})`
  );

  // Step 7: Send emails
  await sendAuditEmail(request, pdfBuffer, keyFindings);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const request = validateRequest(req.body || {});
  if (!request) {
    return res.status(400).json({ error: 'Missing required fields: name, email, website' });
  }

  // Respond immediately so the frontend can show the thank-you message
  res.status(200).json({ success: true, message: 'Audit request received' });

  // Run the pipeline in the background
  // Note: In Vercel, the function stays alive until the response is fully sent
  // and any pending promises resolve (within maxDuration).
  // For production, consider using waitUntil() from @vercel/functions
  try {
    await runAuditPipeline(request);
  } catch (error) {
    console.error('Audit pipeline failed:', error);
    try {
      await sendErrorNotification(request, error instanceof Error ? error.stack || error.message : String(error));
    } catch (emailError) {
      console.error('Failed to send error notification:', emailError);
    }
  }
}
```

**Important note:** Vercel's behavior after `res.status(200).json(...)` depends on the runtime. For Node.js runtime, the function continues executing after sending the response. For best reliability, add `@vercel/functions` and use `waitUntil()`:

```typescript
// At the top of api/audit.ts, add:
import { waitUntil } from '@vercel/functions';

// Then replace the background execution section with:
  res.status(200).json({ success: true, message: 'Audit request received' });

  waitUntil(
    runAuditPipeline(request).catch(async (error) => {
      console.error('Audit pipeline failed:', error);
      try {
        await sendErrorNotification(request, error instanceof Error ? error.stack || error.message : String(error));
      } catch (emailError) {
        console.error('Failed to send error notification:', emailError);
      }
    })
  );
```

This requires adding `@vercel/functions` to package.json dependencies.

**Step 2: Commit**

```bash
git add api/audit.ts
git commit -m "feat: add main audit API endpoint with pipeline orchestration"
```

---

## Task 10: Update Frontend Form

**Files:**
- Modify: `index.html` (lines 1926-1954 — audit form submission handler)
- Modify: `index.html` (lines 2012-2043 — popup form submission handler)

**Step 1: Update audit form to POST to /api/audit**

Replace the form submission handler (lines ~1928-1954) to send JSON to `/api/audit` instead of FormSubmit.co:

Find (approximately line 1928-1954):
```javascript
auditForm.addEventListener('submit', async(e)=>{
    e.preventDefault();
    const btn = auditForm.querySelector('.audit-submit');
    btn.disabled = true;
    btn.textContent = 'שולח...';
    const data = new FormData(auditForm);
    data.append('_subject','אבחון דיגיטלי חינם - PPC Advisor');
    data.append('_template','table');
    data.append('_captcha','false');
    data.append('_honey','');
    data.append('source','landing_page_section');
    const ac=new AbortController();const tid=setTimeout(()=>ac.abort(),10000);
    try{
      const res = await fetch('https://formsubmit.co/ajax/felix@ppcadvisor.co.il',{method:'POST',body:data,headers:{'Accept':'application/json'},signal:ac.signal});
      clearTimeout(tid);
      if(res.ok){
        showAuditThankyou(document.getElementById('auditCard'));
      } else {
        btn.textContent='שגיאה - נסו שוב';
        btn.disabled=false;
      }
    }catch(err){
      clearTimeout(tid);
      btn.textContent='שגיאה - נסו שוב';
      btn.disabled=false;
    }
  });
```

Replace with:
```javascript
auditForm.addEventListener('submit', async(e)=>{
    e.preventDefault();
    const btn = auditForm.querySelector('.audit-submit');
    btn.disabled = true;
    btn.textContent = 'שולח...';
    const payload = {
      name: auditForm.querySelector('#audit_name').value,
      email: auditForm.querySelector('#audit_email').value,
      phone: auditForm.querySelector('#audit_phone').value,
      website: auditForm.querySelector('#audit_url').value,
      source: 'landing_page_section'
    };
    const ac=new AbortController();const tid=setTimeout(()=>ac.abort(),15000);
    try{
      const res = await fetch('/api/audit',{method:'POST',body:JSON.stringify(payload),headers:{'Content-Type':'application/json','Accept':'application/json'},signal:ac.signal});
      clearTimeout(tid);
      if(res.ok){
        showAuditThankyou(document.getElementById('auditCard'));
      } else {
        btn.textContent='שגיאה - נסו שוב';
        btn.disabled=false;
      }
    }catch(err){
      clearTimeout(tid);
      btn.textContent='שגיאה - נסו שוב';
      btn.disabled=false;
    }
  });
```

**Step 2: Update popup form similarly**

Find the popup form handler (lines ~2012-2043) and update to POST JSON to `/api/audit` with `source: 'popup'`. The popup form doesn't have an email field, so we need to add one to the popup HTML or handle it gracefully. Since the popup lacks an email field, add one to the popup form HTML (around line 1518-1521):

Add after the phone field input:
```html
<div class="form-field"><svg class="form-field__icon" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="#bbb"/></svg><label for="popup_email" class="sr-only">אימייל</label><input type="email" id="popup_email" name="popup_email" placeholder="אימייל" required></div>
```

Then update the popup form submit handler to:
```javascript
popupForm.addEventListener('submit', async(e)=>{
    e.preventDefault();
    const btn = popupForm.querySelector('.popup-submit');
    btn.disabled = true;
    btn.textContent = 'שולח...';
    const payload = {
      name: popupForm.querySelector('#popup_name').value,
      email: popupForm.querySelector('#popup_email').value,
      phone: popupForm.querySelector('#popup_phone').value,
      website: popupForm.querySelector('#popup_url').value,
      source: 'popup'
    };
    const ac=new AbortController();const tid=setTimeout(()=>ac.abort(),15000);
    try{
      const res = await fetch('/api/audit',{method:'POST',body:JSON.stringify(payload),headers:{'Content-Type':'application/json','Accept':'application/json'},signal:ac.signal});
      clearTimeout(tid);
      if(!res.ok){
        btn.textContent='שגיאה - נסו שוב';
        btn.disabled=false;
        return;
      }
    }catch(err){
      clearTimeout(tid);
      btn.textContent='שגיאה - נסו שוב';
      btn.disabled=false;
      return;
    }
    auditSubmitted = true;
    sessionStorage.setItem('ppc_audit_submitted','1');
    const card = popupOverlay.querySelector('.popup-card');
    card.innerHTML = '<div class="audit__thankyou"><h3>תודה! אנחנו כבר על זה</h3><p>הצוות שלנו כבר התחיל לעבוד על האבחון שלכם. תוך מספר דקות תקבלו דוח מפורט לאימייל.</p><a href="https://wa.me/972587497497" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16.75 13.96c.25.13.41.2.46.3.06.11.04.61-.21 1.18-.2.56-1.24 1.1-1.7 1.12-.46.02-.47.36-2.96-.73-2.49-1.09-3.99-3.75-4.11-3.92-.12-.17-.96-1.38-.92-2.61.05-1.22.69-1.8.95-2.04.24-.26.51-.29.68-.28h.5c.16 0 .37-.05.58.45.21.5.71 1.83.78 1.97.07.13.1.29.02.47l-.27.48c-.14.15-.28.34-.4.45-.12.12-.26.25-.11.5.15.25.66 1.1 1.42 1.78.96.87 1.78 1.14 2.04 1.27.26.13.4.11.55-.07.15-.18.65-.75.82-1.01.17-.26.35-.21.58-.13l1.83.87z"/><path d="M12.05 2C6.53 2 2.06 6.48 2.06 12c0 1.77.47 3.44 1.29 4.88L2 22l5.27-1.38A9.94 9.94 0 0012.05 22c5.52 0 10-4.48 10-10s-4.48-10-10-10z"/></svg> דברו איתנו בוואצאפ</a></div>';
    setTimeout(closePopup, 5000);
  });
```

**Step 3: Update thank-you message timing**

In `showAuditThankyou` function (line 1920-1924), update the message from "48 שעות" to reflect the automated delivery:

Find: `תוך 48 שעות תקבלו דוח מפורט לאימייל שלכם עם ממצאים, המלצות ותכנית פעולה.`
Replace: `תוך מספר דקות תקבלו דוח מפורט לאימייל שלכם עם ממצאים, המלצות ותכנית פעולה.`

Also update the micro text (line 1298):
Find: `ללא עלות. ללא התחייבות. דוח מפורט תוך 48 שעות.`
Replace: `ללא עלות. ללא התחייבות. דוח מפורט תוך דקות.`

And the form micro text (line 1312):
Find: `ללא עלות. ללא התחייבות. דוח מפורט תוך 48 שעות.`
Replace: `ללא עלות. ללא התחייבות. דוח מפורט תוך דקות.`

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat: update forms to POST to /api/audit and update delivery time messaging"
```

---

## Task 11: Add @vercel/functions Dependency

**Files:**
- Modify: `package.json`
- Modify: `api/audit.ts`

**Step 1: Add @vercel/functions to package.json**

Add to dependencies:
```json
"@vercel/functions": "^2.0.0"
```

**Step 2: Update api/audit.ts to use waitUntil()**

Add import at the top of `api/audit.ts`:
```typescript
import { waitUntil } from '@vercel/functions';
```

Replace the background execution block (after `res.status(200).json(...)`) with:
```typescript
  waitUntil(
    runAuditPipeline(request).catch(async (error) => {
      console.error('Audit pipeline failed:', error);
      try {
        await sendErrorNotification(
          request,
          error instanceof Error ? error.stack || error.message : String(error)
        );
      } catch (emailError) {
        console.error('Failed to send error notification:', emailError);
      }
    })
  );
```

**Step 3: Run npm install**

Run: `npm install`

**Step 4: Commit**

```bash
git add package.json package-lock.json api/audit.ts
git commit -m "feat: add waitUntil for reliable background processing"
```

---

## Task 12: Environment Setup & Deployment

**Files:** None (configuration only)

**Step 1: Set up Resend**

1. Sign up at resend.com
2. Add domain `ppcadvisor.co.il` and verify DNS records
3. Create API key
4. Add `RESEND_API_KEY` to Vercel environment variables

**Step 2: Set up Anthropic API**

1. Get API key from console.anthropic.com
2. Add `ANTHROPIC_API_KEY` to Vercel environment variables

**Step 3: Configure Vercel environment variables**

Run:
```bash
cd /Users/dariadovzhikova/ppcadvisor
npx vercel env add ANTHROPIC_API_KEY
npx vercel env add RESEND_API_KEY
```

**Step 4: Deploy to Vercel**

Run: `npx vercel --prod`

**Step 5: Test end-to-end**

1. Open ppcadvisor.co.il
2. Fill in the audit form with a test website
3. Submit and verify:
   - Thank-you message appears immediately
   - PDF report arrives via email within 2-3 minutes
   - Felix gets the team notification email
   - PDF contains all sections: cover, summary, screenshots, scores, SEO, AI, action plan

**Step 6: Commit any final adjustments**

```bash
git add -A
git commit -m "feat: finalize audit pipeline deployment configuration"
```

---

## Summary

| Task | Description | Key Files |
|------|------------|-----------|
| 1 | Project scaffolding | package.json, tsconfig.json, vercel.json |
| 2 | Type definitions | lib/types.ts |
| 3 | Website scraper | lib/scraper.ts, tests/scraper.test.ts |
| 4 | PageSpeed module | lib/pagespeed.ts, tests/pagespeed.test.ts |
| 5 | Claude analysis | lib/analysis.ts, tests/analysis.test.ts |
| 6 | PDF HTML template | lib/templates/report.ts, tests/report-template.test.ts |
| 7 | PDF generator | lib/pdf-generator.ts |
| 8 | Email module | lib/email.ts, tests/email.test.ts |
| 9 | Main API endpoint | api/audit.ts |
| 10 | Frontend form update | index.html |
| 11 | waitUntil integration | package.json, api/audit.ts |
| 12 | Environment setup & deploy | Vercel config |
