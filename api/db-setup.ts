import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || token !== process.env.DB_SETUP_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS audits (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

        -- Form submission
        name                    TEXT NOT NULL,
        email                   TEXT NOT NULL,
        phone                   TEXT NOT NULL DEFAULT '',
        website                 TEXT NOT NULL,
        source                  TEXT NOT NULL DEFAULT 'landing_page_section',

        -- Pipeline status
        status                  TEXT NOT NULL DEFAULT 'received'
                                CHECK (status IN ('received','scraping','analyzing','generating_pdf','sending_email','completed','failed')),
        error_message           TEXT,

        -- Key scores (flat for querying)
        performance_score       INTEGER,
        accessibility_score     INTEGER,
        seo_score               INTEGER,
        best_practices_score    INTEGER,
        load_time_ms            INTEGER,

        -- AI presence (flat booleans)
        ai_chatgpt              BOOLEAN,
        ai_gemini               BOOLEAN,
        ai_perplexity           BOOLEAN,

        -- Nested data as JSONB
        pagespeed_details       JSONB,
        action_plan             JSONB,
        scraped_meta            JSONB,

        -- Email tracking
        user_email_scheduled_at TIMESTAMPTZ,
        team_email_sent_at      TIMESTAMPTZ,
        completed_at            TIMESTAMPTZ
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_audits_created_at ON audits (created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audits_email ON audits (email)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audits_status ON audits (status)`;

    return res.status(200).json({ success: true, message: 'Database setup complete' });
  } catch (error) {
    console.error('[db-setup] Migration failed:', error);
    return res.status(500).json({
      error: 'Migration failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
