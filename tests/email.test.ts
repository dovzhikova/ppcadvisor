import { describe, it, expect } from 'vitest';
import { buildUserEmailHTML, buildTeamNotificationHTML } from '../lib/email';

describe('buildUserEmailHTML', () => {
  it('produces RTL Hebrew email with client name', () => {
    const html = buildUserEmailHTML('דני', 'example.co.il', ['ציון ביצועים: 72/100', 'חסר Schema.org']);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('דני');
    expect(html).toContain('example.co.il');
  });

  it('includes key findings', () => {
    const html = buildUserEmailHTML('דני', 'example.co.il', ['ציון ביצועים: 72/100']);
    expect(html).toContain('72/100');
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
