import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ScrapedData, PageSpeedResult, AIPresenceResult, AuditReport } from './types';

let _genAI: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    _genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  }
  return _genAI;
}

type ScrapedDataWithoutBuffers = Omit<ScrapedData, 'screenshotDesktop' | 'screenshotMobile'>;

export function buildAnalysisPrompt(
  scraped: ScrapedDataWithoutBuffers,
  pageSpeed: PageSpeedResult,
  aiPresence: AIPresenceResult
): string {
  return `You are a senior digital marketing strategist at PPC Advisor (ppcadvisor.co.il), a leading Israeli digital marketing agency with 14 years of experience, 267+ clients, and ₪47M+ in managed media budgets. You produce strategic audit reports comparable to top-tier consulting deliverables — combining business analysis, competitive intelligence, CRO insights, and phased action plans.

Write ALL content in professional Hebrew — marketing-appropriate, authoritative, solution-oriented. Not overly formal, not casual.

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

Analyze the website holistically — not just technically, but as a business asset. Infer the business model, target audience, competitive landscape, and growth opportunities from the available data. Be specific with competitor names, realistic with projections, and actionable with recommendations.

Respond with a JSON object (no markdown fencing) matching this exact structure:

{
  "executiveSummary": "3-4 sentence strategic overview — the key finding, biggest opportunity, and recommended direction. In Hebrew.",
  "screenshotObservations": {
    "desktop": "What stands out in the desktop view: visual hierarchy, CTAs, trust signals, layout quality. In Hebrew.",
    "mobile": "Mobile experience: responsiveness, thumb-friendly navigation, load feel, content priority. In Hebrew."
  },
  "reportPurpose": "2-3 sentences explaining what this audit covers and why it matters for this specific business. Mention the scope: technical performance, business positioning, competitive landscape, and growth roadmap. In Hebrew.",
  "situationOverview": "A paragraph assessing where this business stands digitally: what the site does well, where the main gaps are, and what the central challenge or opportunity is. Think of it as a 'state of the digital presence' summary. In Hebrew.",
  "businessModelAnalysis": "Infer and analyze: what type of business is this (ecommerce, services, SaaS, local business)? Who is the target audience? What is the likely purchase behavior? Are there retention/repeat purchase opportunities? What business model improvements could the website support? 2-3 paragraphs in Hebrew.",
  "competitorAnalysis": {
    "insight": "A paragraph comparing this business to its competitive landscape — where it's ahead, where it's behind, and the strategic implication. In Hebrew.",
    "competitors": [
      { "name": "Competitor Name 1", "url": "https://competitor1.com", "strengths": "What they do well that this site doesn't — be specific. In Hebrew." },
      { "name": "Competitor Name 2", "url": "https://competitor2.com", "strengths": "Specific strength. In Hebrew." },
      { "name": "Competitor Name 3", "url": "https://competitor3.com", "strengths": "Specific strength. In Hebrew." }
    ]
  },
  "seoAnalysis": "Detailed technical + on-page SEO analysis: meta tags, heading structure, schema markup, internal linking, content quality signals. Specific recommendations. In Hebrew.",
  "croAnalysis": "Conversion Rate Optimization analysis: homepage first impression, service/product page effectiveness, trust signals (reviews, badges, guarantees), contact/checkout UX, call-to-action clarity and placement. What's working, what's losing conversions. In Hebrew.",
  "marketingChannelInsights": "What's visible from the site about their marketing setup: tracking pixels present, social media links, UTM patterns in links, remarketing evidence, email capture. Then recommend 2-3 marketing channel priorities with rationale. In Hebrew.",
  "aiPresenceAnalysis": "AI search presence analysis: visibility in ChatGPT, Gemini, Perplexity. What this means for their business and how to improve AI discoverability. In Hebrew.",
  "businessPotential": "Growth opportunity framing: given the current state, what realistic improvement percentages are achievable (traffic, conversions, revenue)? Where is the biggest ROI? Frame as opportunity, not criticism. 1-2 paragraphs in Hebrew.",
  "phasedActionPlan": {
    "phase1": {
      "title": "ימים 1-30: [theme in Hebrew]",
      "items": [
        { "title": "Action title in Hebrew", "description": "What to do, why, and expected impact. In Hebrew.", "impact": "high" },
        { "title": "Action title in Hebrew", "description": "Description. In Hebrew.", "impact": "high" }
      ]
    },
    "phase2": {
      "title": "ימים 31-60: [theme in Hebrew]",
      "items": [
        { "title": "Action title in Hebrew", "description": "Description. In Hebrew.", "impact": "medium" },
        { "title": "Action title in Hebrew", "description": "Description. In Hebrew.", "impact": "medium" }
      ]
    },
    "phase3": {
      "title": "ימים 61-90: [theme in Hebrew]",
      "items": [
        { "title": "Action title in Hebrew", "description": "Description. In Hebrew.", "impact": "medium" },
        { "title": "Action title in Hebrew", "description": "Description. In Hebrew.", "impact": "low" }
      ]
    }
  }
}

Each phase should have 2-3 items. Use real competitor names relevant to this business's industry and geography. Return ONLY the JSON object.`;
}

export function parseReportResponse(text: string): AuditReport {
  // Strip markdown code fences
  let cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
  // Extract the JSON object if surrounded by extra text
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  return JSON.parse(cleaned) as AuditReport;
}

export async function analyzeWebsite(
  scraped: ScrapedData,
  pageSpeed: PageSpeedResult,
  aiPresence: AIPresenceResult
): Promise<AuditReport> {
  const { screenshotDesktop, screenshotMobile, ...scrapedWithoutBuffers } = scraped;
  const prompt = buildAnalysisPrompt(scrapedWithoutBuffers, pageSpeed, aiPresence);

  const model = getGenAI().getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  return parseReportResponse(responseText);
}

export async function checkAIPresence(
  businessName: string,
  url: string
): Promise<AIPresenceResult> {
  const model = getGenAI().getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent(
    `Check if the business "${businessName}" (website: ${url}) appears in AI search results. Search for the business name and related industry terms. Report whether this business is mentioned by AI assistants like ChatGPT, Gemini, or Perplexity when users ask about their industry/services.

Respond with a JSON object (no markdown fencing):
{
  "summary": "Brief summary in Hebrew",
  "foundInChatGPT": true/false/null,
  "foundInGemini": true/false/null,
  "foundInPerplexity": true/false/null,
  "details": "Detailed findings in Hebrew"
}

Return ONLY the JSON object.`
  );

  const responseText = result.response.text();
  const cleaned = responseText.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
  return JSON.parse(cleaned) as AIPresenceResult;
}
