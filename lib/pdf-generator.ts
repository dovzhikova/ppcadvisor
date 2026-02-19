import './chromium-setup';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import type { AuditData } from './types';
import { renderReportHTML } from './templates/report';

export async function generatePDF(data: AuditData): Promise<Buffer> {
  const html = renderReportHTML(data);

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: null,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
