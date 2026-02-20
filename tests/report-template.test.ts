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
      reportPurpose: 'מטרת הדוח',
      situationOverview: 'סקירת מצב',
      businessModelAnalysis: 'ניתוח מודל עסקי',
      competitorAnalysis: { insight: 'תובנה תחרותית', competitors: [{ name: 'מתחרה1', url: 'https://comp.co.il', strengths: 'חוזקות' }] },
      seoAnalysis: 'ניתוח SEO', croAnalysis: 'ניתוח CRO', marketingChannelInsights: 'תובנות שיווק',
      aiPresenceAnalysis: 'ניתוח AI',
      businessPotential: 'פוטנציאל צמיחה',
      phasedActionPlan: {
        phase1: { title: 'ימים 1-30', items: [{ title: 'תקנו SEO', description: 'הוסיפו meta tags', impact: 'high' as const }] },
        phase2: { title: 'ימים 31-60', items: [{ title: 'שפרו CRO', description: 'הוסיפו trust signals', impact: 'medium' as const }] },
        phase3: { title: 'ימים 61-90', items: [{ title: 'הגדילו שיווק', description: 'השיקו קמפיינים', impact: 'low' as const }] },
      },
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
