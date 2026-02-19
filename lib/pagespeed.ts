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

export function parsePageSpeedResponse(response: any): PageSpeedResult {
  const cats = response.lighthouseResult.categories;
  const audits = response.lighthouseResult.audits;

  const lcpMs = audits['largest-contentful-paint']?.numericValue ?? 0;
  const inpMs = audits['interaction-to-next-paint']?.numericValue ?? 0;
  const clsVal = audits['cumulative-layout-shift']?.numericValue ?? 0;

  const opportunities: { title: string; description: string }[] = [];
  const opportunityIds = [
    'render-blocking-resources', 'unused-css-rules', 'unused-javascript',
    'modern-image-formats', 'offscreen-images', 'unminified-css',
    'unminified-javascript', 'efficient-animated-content', 'uses-responsive-images',
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
