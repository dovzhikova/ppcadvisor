import { describe, it, expect } from 'vitest';
import { parseMetaTags, countLinks, analyzeImages, detectHeadings } from '../lib/scraper';

describe('parseMetaTags', () => {
  it('extracts title and meta description from raw page data', () => {
    const raw = {
      title: 'My Business',
      metaTags: [
        { name: 'description', content: 'We do great things' },
        { name: 'keywords', content: 'business, services' },
        { property: 'og:title', content: 'OG Title' },
      ],
    };
    const result = parseMetaTags(raw);
    expect(result.title).toBe('My Business');
    expect(result.metaDescription).toBe('We do great things');
    expect(result.metaKeywords).toBe('business, services');
    expect(result.ogTags).toEqual({ 'og:title': 'OG Title' });
  });

  it('returns empty strings when meta tags are missing', () => {
    const result = parseMetaTags({ title: '', metaTags: [] });
    expect(result.metaDescription).toBe('');
    expect(result.metaKeywords).toBe('');
    expect(result.ogTags).toEqual({});
  });
});

describe('countLinks', () => {
  it('separates internal and external links', () => {
    const links = [
      'https://example.com/about',
      'https://example.com/contact',
      'https://external.com/page',
      'https://another.com',
    ];
    const result = countLinks(links, 'example.com');
    expect(result.internal).toBe(2);
    expect(result.external).toBe(2);
  });
});

describe('analyzeImages', () => {
  it('counts total images and images with alt text', () => {
    const images = [
      { src: 'a.jpg', alt: 'description' },
      { src: 'b.jpg', alt: '' },
      { src: 'c.jpg', alt: 'another' },
    ];
    const result = analyzeImages(images);
    expect(result.total).toBe(3);
    expect(result.withAlt).toBe(2);
  });
});

describe('detectHeadings', () => {
  it('parses heading elements into structured array', () => {
    const headings = [
      { tagName: 'H1', textContent: 'Main Title' },
      { tagName: 'H2', textContent: 'Subtitle' },
      { tagName: 'H3', textContent: 'Section' },
    ];
    const result = detectHeadings(headings);
    expect(result).toEqual([
      { level: 1, text: 'Main Title' },
      { level: 2, text: 'Subtitle' },
      { level: 3, text: 'Section' },
    ]);
  });
});
