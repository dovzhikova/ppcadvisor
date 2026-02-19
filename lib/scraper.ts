import './chromium-setup';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import type { ScrapedData } from './types';

// --- Types for raw page data extracted via page.evaluate() ---

interface RawMetaTag {
  name?: string;
  property?: string;
  content: string;
}

interface RawPageData {
  title: string;
  metaTags: RawMetaTag[];
}

interface RawHeading {
  tagName: string;
  textContent: string;
}

interface RawImage {
  src: string;
  alt: string;
}

// --- Pure helper functions (exported for testing) ---

export function parseMetaTags(raw: RawPageData): {
  title: string;
  metaDescription: string;
  metaKeywords: string;
  ogTags: Record<string, string>;
} {
  let metaDescription = '';
  let metaKeywords = '';
  const ogTags: Record<string, string> = {};

  for (const tag of raw.metaTags) {
    if (tag.name === 'description') {
      metaDescription = tag.content;
    } else if (tag.name === 'keywords') {
      metaKeywords = tag.content;
    } else if (tag.property && tag.property.startsWith('og:')) {
      ogTags[tag.property] = tag.content;
    }
  }

  return {
    title: raw.title,
    metaDescription,
    metaKeywords,
    ogTags,
  };
}

export function countLinks(
  links: string[],
  domain: string,
): { internal: number; external: number } {
  let internal = 0;
  let external = 0;

  for (const link of links) {
    try {
      const url = new URL(link);
      if (url.hostname === domain || url.hostname.endsWith('.' + domain)) {
        internal++;
      } else {
        external++;
      }
    } catch {
      // Relative URLs or malformed — count as internal
      internal++;
    }
  }

  return { internal, external };
}

export function analyzeImages(
  images: RawImage[],
): { total: number; withAlt: number } {
  const total = images.length;
  const withAlt = images.filter((img) => img.alt.trim().length > 0).length;
  return { total, withAlt };
}

export function detectHeadings(
  headings: RawHeading[],
): { level: number; text: string }[] {
  return headings.map((h) => ({
    level: parseInt(h.tagName.replace(/\D/g, ''), 10),
    text: h.textContent,
  }));
}

// --- Main scraper function ---

export async function scrapeWebsite(url: string): Promise<ScrapedData> {
  const startTime = Date.now();

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: null,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  try {
    const page = await browser.newPage();

    // Desktop: 1440px width
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const screenshotDesktop = Buffer.from(
      await page.screenshot({ fullPage: true }),
    );

    // Extract all page data in a single evaluate call
    const rawData = await page.evaluate(() => {
      const title = document.title || '';

      // Meta tags
      const metaElements = document.querySelectorAll('meta');
      const metaTags: { name?: string; property?: string; content: string }[] = [];
      metaElements.forEach((el) => {
        const name = el.getAttribute('name') || undefined;
        const property = el.getAttribute('property') || undefined;
        const content = el.getAttribute('content') || '';
        if (name || property) {
          metaTags.push({ name, property, content });
        }
      });

      // Headings
      const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const headings: { tagName: string; textContent: string }[] = [];
      headingElements.forEach((el) => {
        headings.push({
          tagName: el.tagName,
          textContent: (el.textContent || '').trim(),
        });
      });

      // Links
      const anchorElements = document.querySelectorAll('a[href]');
      const links: string[] = [];
      anchorElements.forEach((el) => {
        const href = el.getAttribute('href');
        if (href) {
          try {
            links.push(new URL(href, window.location.origin).href);
          } catch {
            links.push(href);
          }
        }
      });

      // Images
      const imgElements = document.querySelectorAll('img');
      const images: { src: string; alt: string }[] = [];
      imgElements.forEach((el) => {
        images.push({
          src: el.getAttribute('src') || '',
          alt: el.getAttribute('alt') || '',
        });
      });

      // Viewport meta
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      const hasViewportMeta = viewportMeta !== null;

      // Schema.org
      const schemaScripts = document.querySelectorAll(
        'script[type="application/ld+json"]',
      );
      const hasSchemaOrg = schemaScripts.length > 0;

      // Language and direction
      const htmlEl = document.documentElement;
      const language = htmlEl.getAttribute('lang') || '';
      const direction = htmlEl.getAttribute('dir') || '';

      return {
        title,
        metaTags,
        headings,
        links,
        images,
        hasViewportMeta,
        hasSchemaOrg,
        language,
        direction,
      };
    });

    // Mobile: 390px width
    await page.setViewport({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });

    const screenshotMobile = Buffer.from(
      await page.screenshot({ fullPage: true }),
    );

    const loadTimeMs = Date.now() - startTime;

    // Parse extracted data using helper functions
    const parsedUrl = new URL(url);
    const meta = parseMetaTags(rawData);
    const linkCounts = countLinks(rawData.links, parsedUrl.hostname);
    const imageStats = analyzeImages(rawData.images);
    const headings = detectHeadings(rawData.headings);

    const scrapedData: ScrapedData = {
      url,
      title: meta.title,
      metaDescription: meta.metaDescription,
      metaKeywords: meta.metaKeywords,
      ogTags: meta.ogTags,
      headings,
      internalLinkCount: linkCounts.internal,
      externalLinkCount: linkCounts.external,
      imageCount: imageStats.total,
      imagesWithAlt: imageStats.withAlt,
      hasSSL: parsedUrl.protocol === 'https:',
      language: rawData.language,
      direction: rawData.direction,
      hasViewportMeta: rawData.hasViewportMeta,
      hasSchemaOrg: rawData.hasSchemaOrg,
      loadTimeMs,
      screenshotDesktop,
      screenshotMobile,
    };

    return scrapedData;
  } finally {
    await browser.close();
  }
}
