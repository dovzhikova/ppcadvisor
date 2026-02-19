import Anthropic from '@anthropic-ai/sdk';
import type { ScrapedData, PageSpeedResult, AIPresenceResult, AuditReport } from './types';

const client = new Anthropic();

type ScrapedDataWithoutBuffers = Omit<ScrapedData, 'screenshotDesktop' | 'screenshotMobile'>;

export function buildAnalysisPrompt(
  scraped: ScrapedDataWithoutBuffers,
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
