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
          'interaction-to-next-paint': { numericValue: 600, displayValue: '600 ms' },
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
