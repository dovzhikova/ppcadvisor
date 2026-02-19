import { describe, it, expect } from 'vitest';
import { buildUserEmailHTML, buildTeamNotificationHTML } from '../lib/email';
import type { AuditData } from '../lib/types';

function mockAuditData(overrides: Partial<AuditData> = {}): AuditData {
  return {
    request: { name: '\u05D3\u05E0\u05D9', email: 'test@test.com', phone: '050-1234567', website: 'https://example.co.il', source: 'landing_page_section' },
    scraped: {
      url: 'https://example.co.il', title: 'Example', metaDescription: 'desc', metaKeywords: '',
      ogTags: {}, headings: [], internalLinkCount: 10, externalLinkCount: 5,
      imageCount: 8, imagesWithAlt: 6, hasSSL: true, language: 'he', direction: 'rtl',
      hasViewportMeta: true, hasSchemaOrg: false, loadTimeMs: 2300,
      screenshotDesktop: Buffer.from(''), screenshotMobile: Buffer.from(''),
    },
    pageSpeed: {
      performanceScore: 72, accessibilityScore: 85, seoScore: 90, bestPracticesScore: 80,
      lcp: { value: 2.4, unit: 's', rating: 'needs-improvement' },
      inp: { value: 120, unit: 'ms', rating: 'good' },
      cls: { value: 0.15, unit: '', rating: 'needs-improvement' },
      opportunities: [],
    },
    aiPresence: { summary: 'Found in 1/3', foundInChatGPT: true, foundInGemini: false, foundInPerplexity: null, details: '' },
    report: {
      executiveSummary: 'Summary text',
      screenshotObservations: { desktop: 'desktop obs', mobile: 'mobile obs' },
      seoAnalysis: 'SEO analysis text',
      aiPresenceAnalysis: 'AI analysis text',
      competitorPositioning: 'Competitor text',
      actionPlan: [
        { priority: 1, title: '\u05E6\u05D9\u05D5\u05DF \u05D1\u05D9\u05E6\u05D5\u05E2\u05D9\u05DD: 72/100', description: 'Needs improvement', impact: 'high' },
        { priority: 2, title: '\u05D7\u05E1\u05E8 Schema.org', description: 'Add structured data', impact: 'medium' },
      ],
      nextSteps: 'Next steps text',
    },
    ...overrides,
  };
}

describe('buildUserEmailHTML', () => {
  it('produces RTL Hebrew email with client name', () => {
    const html = buildUserEmailHTML(mockAuditData());
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('\u05D3\u05E0\u05D9');
    expect(html).toContain('example.co.il');
  });

  it('includes scores and key findings', () => {
    const html = buildUserEmailHTML(mockAuditData());
    expect(html).toContain('72');
    expect(html).toContain('72/100');
  });

  it('includes AI presence indicators', () => {
    const html = buildUserEmailHTML(mockAuditData());
    expect(html).toContain('ChatGPT');
    expect(html).toContain('Gemini');
    expect(html).toContain('Perplexity');
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
