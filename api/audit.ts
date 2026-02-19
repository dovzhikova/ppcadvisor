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
  const scraped = await scrapeWebsite(request.website);

  const [pageSpeed, aiPresence] = await Promise.all([
    getPageSpeedInsights(request.website),
    checkAIPresence(scraped.title || new URL(request.website).hostname, request.website),
  ]);

  const report = await analyzeWebsite(scraped, pageSpeed, aiPresence);

  const auditData: AuditData = { request, scraped, pageSpeed, aiPresence, report };

  const pdfBuffer = await generatePDF(auditData);

  const keyFindings = report.actionPlan.slice(0, 3).map(
    (item) => `${item.title} (${item.impact === 'high' ? 'עדיפות גבוהה' : item.impact === 'medium' ? 'עדיפות בינונית' : 'עדיפות נמוכה'})`
  );

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

  // Respond immediately
  res.status(200).json({ success: true, message: 'Audit request received' });

  // Run pipeline in background (within maxDuration)
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
