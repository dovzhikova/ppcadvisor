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
