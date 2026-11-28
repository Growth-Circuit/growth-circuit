import { describe, expect, it } from "vitest";
import { GROWTH_CIRCUIT_CALENDAR_ID, hostedEventsFromEntries } from "@/lib/luma-hosted-events";
import { blogPostingJsonLd, eventsItemListJsonLd, faqPageJsonLd, jobsIssueJsonLd, newsletterIssueJsonLd, serializeJsonLd } from "@/lib/seo";

describe("JSON-LD serialization", () => {
  it("cannot close the containing script element", () => {
    const serialized = serializeJsonLd({ title: "</script><script>alert(1)</script>" });

    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual({ title: "</script><script>alert(1)</script>" });
  });

  it("describes a public newsletter issue without injecting markup", () => {
    const serialized = serializeJsonLd(
      newsletterIssueJsonLd({
        title: "</script>Week of September 21",
        description: "Five public NYC events.",
        publishedAt: "2026-09-21",
        slug: "2026-09-21",
      }),
    );

    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toMatchObject({
      "@type": "NewsArticle",
      url: "https://growthcircuit.club/newsletter/2026-09-21",
      datePublished: "2026-09-21",
    });
  });

  it("describes a jobs issue as Lucy’s newsletter", () => {
    const serialized = serializeJsonLd(
      jobsIssueJsonLd({
        title: "The best jobs in growth and marketing – 11/3",
        description: "Profound, Clay, Vercel, and more",
        publishedAt: "2026-11-03",
        slug: "2026-11-03",
      }),
    );

    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toMatchObject({
      "@type": "NewsArticle",
      url: "https://growthcircuit.club/jobs/2026-11-03",
      datePublished: "2026-11-03",
      author: [{ "@type": "Person", name: "Lucy Hoyle" }],
    });
  });

  it("describes a blog post with one Person per author and a FAQ page", () => {
    const article = blogPostingJsonLd({
      title: "How We Run Growth Circuit With Grok Bot",
      description: "What each bot does.",
      publishDate: "2026-10-07",
      updatedDate: "2026-10-07",
      path: "/blog/how-we-run-growth-circuit-with-grok-bot",
      image: "/growth-circuit-og-v4.png",
      authors: [
        {
          name: "Nick Lafferty",
          role: "Profound",
          photo: "/hosts/nick-lafferty.jpg",
          website: "https://nicklafferty.com",
          linkedin: "https://www.linkedin.com/in/nicklafferty/",
        },
        {
          name: "Lucy Hoyle",
          role: "Carta",
          photo: "/hosts/lucy-hoyle-blurred.jpg",
          linkedin: "https://www.linkedin.com/in/lucyjanehoyle",
        },
      ],
    });
    const faq = faqPageJsonLd([{ question: "How do I join?", answer: "Subscribe to the newsletter." }]);
    const serialized = serializeJsonLd(article);

    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toMatchObject({
      "@type": "Article",
      headline: "How We Run Growth Circuit With Grok Bot",
      datePublished: "2026-10-07",
      dateModified: "2026-10-07",
      mainEntityOfPage: "https://growthcircuit.club/blog/how-we-run-growth-circuit-with-grok-bot",
      image: "https://growthcircuit.club/growth-circuit-og-v4.png",
      publisher: { name: "Growth Circuit" },
    });
    expect(article.author).toEqual([
      {
        "@type": "Person",
        name: "Nick Lafferty",
        jobTitle: "Profound",
        url: "https://nicklafferty.com",
        image: "https://growthcircuit.club/hosts/nick-lafferty.jpg",
        sameAs: ["https://nicklafferty.com", "https://www.linkedin.com/in/nicklafferty/"],
      },
      {
        "@type": "Person",
        name: "Lucy Hoyle",
        jobTitle: "Carta",
        image: "https://growthcircuit.club/hosts/lucy-hoyle-blurred.jpg",
        sameAs: ["https://www.linkedin.com/in/lucyjanehoyle"],
      },
    ]);
    expect(JSON.parse(serializeJsonLd(faq))).toMatchObject({
      "@type": "FAQPage",
      mainEntity: [{ "@type": "Question", name: "How do I join?" }],
    });
  });
});

const now = new Date("2026-11-26T17:00:00Z");

function calendarEntry(event: Record<string, unknown> = {}, entry: Record<string, unknown> = {}) {
  return {
    platform: "luma",
    status: "approved",
    featured_guests: [{ name: "Secret Guest" }],
    guest_count: 14,
    hosts: [{ name: "Nick Lafferty", email: "nick@growthcircuit.club" }],
    event: {
      name: "Growth Circuit Show & Tell",
      start_at: "2026-12-04T17:30:00.000Z",
      end_at: "2026-12-04T18:00:00.000Z",
      timezone: "America/New_York",
      calendar_api_id: GROWTH_CIRCUIT_CALENDAR_ID,
      visibility: "public",
      url: "p3it0t90",
      location_type: "meet",
      geo_address_visibility: "public",
      virtual_info: { url: "https://meet.google.com/secret-room" },
      coordinate: { latitude: 40.6721, longitude: -73.9698 },
      ...event,
    },
    ...entry,
  };
}

describe("events ItemList JSON-LD", () => {
  it("describes an in-person event from the public place shown on the card", () => {
    const description = `A public Friday run. https://meet.google.com/secret-room nick@growthcircuit.club ${"loop ".repeat(80)}`;
    const events = hostedEventsFromEntries([
      calendarEntry({
        name: "Good Friends Run Club",
        start_at: "2026-11-27T14:00:00.000Z",
        end_at: "2026-11-27T15:00:00.000Z",
        url: "584nqg6c",
        location_type: "offline",
        cover_url: "https://images.lumacdn.com/uploads/er/cover.png",
        description,
        geo_address_info: {
          mode: "shown",
          address: "Grand Army Plaza",
          city_state: "Brooklyn, NY",
          sublocality: "Prospect Heights",
          full_address: "493 3rd St, Top Floor, Brooklyn, NY 11238",
          description: "Meet at the side door",
        },
      }, {
        ticket_info: { is_free: true, is_sold_out: false, price: null, spots_remaining: 14 },
      }),
    ], now);
    const jsonLd = eventsItemListJsonLd(events);
    const serialized = serializeJsonLd(jsonLd);

    expect(serialized).not.toContain("<");
    expect(events[0].detail).toBe("9:00 to 10:00am ET, Grand Army Plaza, Brooklyn, NY");
    expect(jsonLd).toMatchObject({
      "@type": "ItemList",
      numberOfItems: 1,
      url: "https://growthcircuit.club/events",
      itemListElement: [{
        "@type": "ListItem",
        position: 1,
        item: {
          "@type": "Event",
          name: "Good Friends Run Club",
          startDate: "2026-11-27T09:00:00-05:00",
          endDate: "2026-11-27T10:00:00-05:00",
          eventStatus: "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          url: "https://luma.com/584nqg6c",
          image: "https://images.lumacdn.com/uploads/er/cover.png",
          organizer: { "@type": "Organization", name: "Growth Circuit", url: "https://growthcircuit.club" },
          location: {
            "@type": "Place",
            name: "Grand Army Plaza",
            address: { "@type": "PostalAddress", addressLocality: "Brooklyn", addressRegion: "NY" },
          },
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            url: "https://luma.com/584nqg6c",
            availability: "https://schema.org/InStock",
          },
        },
      }],
    });
    expect(jsonLd?.itemListElement[0].item.description).toBe(events[0].description);
    expect(jsonLd?.itemListElement[0].item.startDate).toBe(events[0].startAt);
    expect(jsonLd?.itemListElement[0].item.image).toBe(events[0].image);
    expect(events[0].description?.endsWith("…")).toBe(true);
    expect(events[0].description?.length).toBeLessThanOrEqual(240);
    expect(serialized).not.toMatch(/meet\.google|secret|3rd St|11238|Prospect Heights|side door|latitude|longitude|streetAddress|spots_remaining|@growthcircuit/i);
  });

  it("describes an online event as a virtual location at the public Luma URL", () => {
    const events = hostedEventsFromEntries([calendarEntry()], now);
    const item = eventsItemListJsonLd(events)?.itemListElement[0].item;

    expect(events[0].detail).toBe("12:30 to 1:00pm ET, Online");
    expect(item).toMatchObject({
      "@type": "Event",
      name: "Growth Circuit Show & Tell",
      startDate: events[0].startAt,
      endDate: events[0].endAt,
      eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
      url: "https://luma.com/p3it0t90",
      location: { "@type": "VirtualLocation", url: "https://luma.com/p3it0t90" },
    });
    expect(item?.image).toBeUndefined();
    expect(item?.offers).toBeUndefined();
    expect(item?.description).toBeUndefined();
    expect(JSON.stringify(item)).not.toMatch(/meet\.google|secret|latitude|Place/i);
  });

  it("omits an address Luma hides from the card", () => {
    const events = hostedEventsFromEntries([
      calendarEntry({
        location_type: "offline",
        geo_address_visibility: "guests-only",
        geo_address_info: {
          mode: "obfuscated",
          address: "493 3rd St, Top Floor",
          city: "Brooklyn",
          city_state: "Brooklyn, NY",
          sublocality: "Prospect Heights",
          full_address: "493 3rd St, Top Floor, Brooklyn, NY",
        },
        coordinate: { latitude: 40.111, longitude: -73.222 },
        url: "house123",
      }),
    ], now);
    const jsonLd = eventsItemListJsonLd(events);
    const item = jsonLd?.itemListElement[0].item;

    expect(events[0].detail).toBe("12:30 to 1:00pm ET");
    expect(events[0].place).toBeUndefined();
    expect(item?.eventAttendanceMode).toBe("https://schema.org/OfflineEventAttendanceMode");
    expect(item?.location).toBeUndefined();
    expect(JSON.stringify(jsonLd)).not.toMatch(/3rd|Brooklyn|Prospect|40\.111|-73\.222|streetAddress|PostalAddress|latitude|longitude/i);
  });

  it("includes a public USD ticket price and skips a price it cannot read", () => {
    const priced = hostedEventsFromEntries([
      calendarEntry({ url: "paid1234" }, { ticket_info: { is_free: false, is_sold_out: false, price: { cents: 2500, currency: "usd" } } }),
    ], now);
    expect(eventsItemListJsonLd(priced)?.itemListElement[0].item.offers).toMatchObject({
      price: "25",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    });

    const unread = hostedEventsFromEntries([
      calendarEntry({ url: "paid5678" }, { ticket_info: { is_free: false, price: "twenty five" } }),
    ], now);
    expect(eventsItemListJsonLd(unread)?.itemListElement[0].item.offers).toBeUndefined();
  });

  it("emits no ItemList for an empty event list", () => {
    expect(eventsItemListJsonLd([])).toBeNull();
    expect(eventsItemListJsonLd(hostedEventsFromEntries([], now))).toBeNull();
  });
});
