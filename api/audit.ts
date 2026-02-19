import type { VercelRequest, VercelResponse } from '@vercel/node';
import { waitUntil } from '@vercel/functions';
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
  console.log(`[audit] Starting pipeline for ${request.website}`);

  console.log('[audit] Scraping website...');
  const scraped = await scrapeWebsite(request.website);
  console.log(`[audit] Scrape done: ${scraped.title} (${scraped.loadTimeMs}ms)`);

  console.log('[audit] Running PageSpeed + AI presence...');
  const [pageSpeed, aiPresence] = await Promise.all([
    getPageSpeedInsights(request.website).catch((err) => {
      console.warn('[audit] PageSpeed failed, using defaults:', err.message);
      return {
        performanceScore: 0, accessibilityScore: 0, seoScore: 0, bestPracticesScore: 0,
        lcp: { value: 0, unit: 'ms' as const, rating: 'needs-improvement' as const },
        inp: { value: 0, unit: 'ms' as const, rating: 'needs-improvement' as const },
        cls: { value: 0, unit: '' as const, rating: 'needs-improvement' as const },
        opportunities: [],
      };
    }),
    checkAIPresence(scraped.title || new URL(request.website).hostname, request.website),
  ]);
  console.log(`[audit] PageSpeed: ${pageSpeed.performanceScore}/100, AI: ${aiPresence.summary}`);

  console.log('[audit] Generating report with Gemini...');
  const report = await analyzeWebsite(scraped, pageSpeed, aiPresence);
  console.log(`[audit] Report done: ${report.actionPlan.length} action items`);

  const auditData: AuditData = { request, scraped, pageSpeed, aiPresence, report };

  console.log('[audit] Generating PDF...');
  const pdfBuffer = await generatePDF(auditData);
  console.log(`[audit] PDF generated: ${(pdfBuffer.length / 1024).toFixed(0)}KB`);

  console.log('[audit] Sending emails...');
  await sendAuditEmail(auditData, pdfBuffer);
  console.log('[audit] Pipeline complete!');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const request = validateRequest(req.body || {});
  if (!request) {
    return res.status(400).json({ error: 'Missing required fields: name, email, website' });
  }

  // Respond immediately so the frontend shows the thank-you message
  res.status(200).json({ success: true, message: 'Audit request received' });

  // Run the pipeline in the background using waitUntil
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
}
