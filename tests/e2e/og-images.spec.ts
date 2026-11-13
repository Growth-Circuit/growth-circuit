import { test, expect, type APIRequestContext } from '@playwright/test';

const pageTypes: Record<string, string> = {
  homepage: '/',
  events: '/events',
  newsletterArchive: '/newsletter',
  newsletterIssue: '/newsletter/2026-11-13',
  jobsPost: '/jobs/2026-11-03',
  blog: '/blog',
  blogPost: '/blog/how-we-run-growth-circuit-with-grok-bot',
  showAndTell: '/blog/show-and-tell-proactive-agents',
  memberProjects: '/people',
  profileGuide: '/people/contribute',
  memberProfile: '/people/nicklafferty',
  shipOrSkip: '/ship-or-skip',
  shipOrSkipModel: '/ship-or-skip/claude-fable-5-1',
};

function meta(html: string, attribute: 'property' | 'name', key: string) {
  const tag = html.match(new RegExp(`<meta[^>]*${attribute}="${key.replace(/[:.]/g, '\\$&')}"[^>]*>`))?.[0];
  return tag?.match(/content="([^"]*)"/)?.[1]?.replaceAll('&amp;', '&');
}

async function socialMeta(request: APIRequestContext, route: string) {
  const response = await request.get(route);
  expect(response.status(), route).toBe(200);
  const html = await response.text();
  return {
    image: meta(html, 'property', 'og:image'),
    width: meta(html, 'property', 'og:image:width'),
    height: meta(html, 'property', 'og:image:height'),
    alt: meta(html, 'property', 'og:image:alt'),
    card: meta(html, 'name', 'twitter:card'),
    twitterImage: meta(html, 'name', 'twitter:image'),
    twitterAlt: meta(html, 'name', 'twitter:image:alt'),
  };
}

test('each page type has its own absolute 1200x630 og:image and twitter:image', async ({ request }) => {
  const images = new Map<string, string>();
  for (const [pageType, route] of Object.entries(pageTypes)) {
    const tags = await socialMeta(request, route);
    expect(tags.image, pageType).toMatch(/^https:\/\/growthcircuit\.club\/og\/.+\.png$/);
    expect(tags.twitterImage, pageType).toBe(tags.image);
    expect(tags.card, pageType).toBe('summary_large_image');
    expect([tags.width, tags.height], pageType).toEqual(['1200', '630']);
    expect(tags.alt, pageType).toMatch(/^Growth Circuit social card: .+/);
    expect(tags.twitterAlt, pageType).toBe(tags.alt);
    expect(`${tags.alt}`, pageType).not.toMatch(/\u2014/);
    expect(images.get(tags.image!), `${pageType} reuses the ${images.get(tags.image!)} image`).toBeUndefined();
    images.set(tags.image!, pageType);

    const image = await request.get(new URL(tags.image!).pathname);
    expect(image.status(), pageType).toBe(200);
    expect(image.headers()['content-type'], pageType).toContain('image/png');
    const png = await image.body();
    expect([png.readUInt32BE(16), png.readUInt32BE(20)], pageType).toEqual([1200, 630]);
  }
});

test('issue images name the issue date and recaps leave out attendees', async ({ request }) => {
  expect((await socialMeta(request, pageTypes.newsletterIssue)).alt).toContain('Friday, November 13, 2026');
  expect((await socialMeta(request, pageTypes.jobsPost)).alt).toContain('Tuesday, November 3, 2026');
  expect((await socialMeta(request, pageTypes.showAndTell)).alt).not.toMatch(/Dabinett|Ronen|Leatherman/);
});

test('pages without a generated image keep the shared fallback image', async ({ request }) => {
  const tags = await socialMeta(request, '/newsletter/confirm');
  expect(tags.image).toBe('https://growthcircuit.club/growth-circuit-og-v4.png');
  expect(tags.twitterImage).toBe(tags.image);
  expect([tags.width, tags.height]).toEqual(['1200', '628']);
});
