import { sql } from '@vercel/postgres';
import type { AuditRequest, ScrapedData, PageSpeedResult, AIPresenceResult, AuditReport } from './types';

export type AuditStatus =
  | 'received'
  | 'scraping'
  | 'analyzing'
  | 'generating_pdf'
  | 'sending_email'
  | 'completed'
  | 'failed';

/** Insert a new audit row when the form is received. Returns the audit ID. */
export async function createAudit(request: AuditRequest): Promise<string | null> {
  try {
    const result = await sql`
      INSERT INTO audits (name, email, phone, website, source, status)
      VALUES (${request.name}, ${request.email}, ${request.phone}, ${request.website}, ${request.source}, 'received')
      RETURNING id
    `;
    const id = result.rows[0]?.id as string;
    console.log(`[db] Created audit ${id}`);
    return id;
  } catch (err) {
    console.error('[db] Failed to create audit:', err);
    return null;
  }
}

/** Update the pipeline status of an audit. */
export async function updateAuditStatus(
  auditId: string | null,
  status: AuditStatus,
  errorMessage?: string,
): Promise<void> {
  if (!auditId) return;
  try {
    if (errorMessage !== undefined) {
      await sql`
        UPDATE audits
        SET status = ${status}, error_message = ${errorMessage}, updated_at = now()
        WHERE id = ${auditId}::uuid
      `;
    } else {
      await sql`
        UPDATE audits
        SET status = ${status}, updated_at = now()
        WHERE id = ${auditId}::uuid
      `;
    }
    console.log(`[db] Status → ${status}${errorMessage ? ' (with error)' : ''}`);
  } catch (err) {
    console.error(`[db] Failed to update status to ${status}:`, err);
  }
}

/** Save scores, AI presence, and nested data after analysis is complete. */
export async function saveAuditResults(
  auditId: string | null,
  scraped: ScrapedData,
  pageSpeed: PageSpeedResult,
  aiPresence: AIPresenceResult,
  report: AuditReport,
): Promise<void> {
  if (!auditId) return;
  try {
    const pagespeedDetails = JSON.stringify({
      lcp: pageSpeed.lcp,
      inp: pageSpeed.inp,
      cls: pageSpeed.cls,
      opportunities: pageSpeed.opportunities,
    });

    const actionPlan = JSON.stringify(report.phasedActionPlan);

    const scrapedMeta = JSON.stringify({
      title: scraped.title,
      metaDescription: scraped.metaDescription,
      language: scraped.language,
      hasSSL: scraped.hasSSL,
      hasViewportMeta: scraped.hasViewportMeta,
      hasSchemaOrg: scraped.hasSchemaOrg,
      loadTimeMs: scraped.loadTimeMs,
      imageCount: scraped.imageCount,
      internalLinkCount: scraped.internalLinkCount,
      externalLinkCount: scraped.externalLinkCount,
    });

    await sql`
      UPDATE audits SET
        performance_score = ${pageSpeed.performanceScore},
        accessibility_score = ${pageSpeed.accessibilityScore},
        seo_score = ${pageSpeed.seoScore},
        best_practices_score = ${pageSpeed.bestPracticesScore},
        load_time_ms = ${scraped.loadTimeMs},
        ai_chatgpt = ${aiPresence.foundInChatGPT},
        ai_gemini = ${aiPresence.foundInGemini},
        ai_perplexity = ${aiPresence.foundInPerplexity},
        pagespeed_details = ${pagespeedDetails}::jsonb,
        action_plan = ${actionPlan}::jsonb,
        scraped_meta = ${scrapedMeta}::jsonb,
        status = 'generating_pdf',
        updated_at = now()
      WHERE id = ${auditId}::uuid
    `;
    console.log('[db] Saved audit results');
  } catch (err) {
    console.error('[db] Failed to save audit results:', err);
  }
}

/** Save email timestamps after emails are sent. */
export async function saveEmailTimestamps(
  auditId: string | null,
  timestamps: { userEmailScheduledAt?: string; teamEmailSentAt?: string },
): Promise<void> {
  if (!auditId) return;
  try {
    await sql`
      UPDATE audits SET
        user_email_scheduled_at = ${timestamps.userEmailScheduledAt ?? null}::timestamptz,
        team_email_sent_at = ${timestamps.teamEmailSentAt ?? null}::timestamptz,
        status = 'completed',
        completed_at = now(),
        updated_at = now()
      WHERE id = ${auditId}::uuid
    `;
    console.log('[db] Saved email timestamps, status → completed');
  } catch (err) {
    console.error('[db] Failed to save email timestamps:', err);
  }
}
