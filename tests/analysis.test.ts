import { describe, it, expect } from 'vitest';
import { buildAnalysisPrompt, parseReportResponse } from '../lib/analysis';
import type { PageSpeedResult, AIPresenceResult } from '../lib/types';

const mockScraped = {
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
    expect(prompt).toContain('72');
    expect(prompt).toContain('SEO');
    expect(prompt).toContain('AI');
  });

  it('includes instructions for Hebrew output', () => {
    const prompt = buildAnalysisPrompt(mockScraped, mockPageSpeed, mockAIPresence);
    expect(prompt).toContain('Hebrew');
  });
});

describe('parseReportResponse', () => {
  it('parses valid JSON response from Gemini', () => {
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
