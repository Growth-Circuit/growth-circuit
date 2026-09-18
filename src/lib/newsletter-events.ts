import ICAL from "ical.js";

export const CALENDAR_URL = "https://luma.com/growth-circuit";
export const CALENDAR_FEED = "https://api.luma.com/ics/get?entity=calendar&id=cal-l48U97luvjJDet7";
const MAX_FEED_BYTES = 512 * 1024;
export type WelcomeEventProperties = {
  welcomeEventTitle: string;
  welcomeEventDetails: string;
  welcomeEventUrl: string;
  welcomeEventCta: string;
};
// Also configured as email-message fallbacks for manually added contacts.
export const EVENT_UNAVAILABLE: WelcomeEventProperties = {
  welcomeEventTitle: "Come hang out with us",
  welcomeEventDetails: "Check our calendar for the latest events. We'd love to see you there.",
  welcomeEventUrl: CALENDAR_URL,
  welcomeEventCta: "Browse our calendar",
};
export const NO_EVENTS: WelcomeEventProperties = {
  welcomeEventTitle: "More good hangs soon",
  welcomeEventDetails: "Nothing on the calendar just yet. We'll email you when the next event is ready.",
  welcomeEventUrl: CALENDAR_URL,
  welcomeEventCta: "Follow our calendar",
};

function publicEventUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && ["luma.com", "lu.ma"].includes(url.hostname) && !url.username && !url.password && !url.port && url.pathname !== "/") {
      // No registration tokens or private meeting links in the welcome email.
      return `${url.origin}${url.pathname}`;
    }
  } catch { /* Try the next public event link. */ }
}

export function eventPropertiesFromCalendar(ics: string, now = new Date()): WelcomeEventProperties {
  try {
    if (!ics.trimEnd().endsWith("END:VCALENDAR")) throw new Error("Truncated calendar");
    const calendar = new ICAL.Component(ICAL.parse(ics));
    if (calendar.name !== "vcalendar") throw new Error("Invalid calendar");
    const candidates: Array<{ starts: number; title: string; details: string; url: string }> = [];
    for (const component of calendar.getAllSubcomponents("vevent")) {
      if (String(component.getFirstPropertyValue("status")).toUpperCase() === "CANCELLED") continue;
      const visibility = String(component.getFirstPropertyValue("class") || "PUBLIC").toUpperCase();
      if (visibility !== "PUBLIC") continue;
      const event = new ICAL.Event(component);
      // Luma exports individual UTC events. Fail gracefully if that contract changes,
      // rather than guessing recurring dates or unresolved local timezones.
      if (event.isRecurring() || event.isRecurrenceException()) throw new Error("Unsupported recurrence");
      const start = event.startDate;
      if (!start || (!start.isDate && start.zone.tzid === "floating")) throw new Error("Missing timezone");
      const starts = start.toJSDate().getTime();
      if (!Number.isFinite(starts)) throw new Error("Invalid date");
      if (start.isDate) {
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
        if (start.toString() <= today) continue;
      } else if (starts <= now.getTime()) continue;
      const title = event.summary?.trim();
      const descriptionUrl = event.description?.match(/https:\/\/(?:luma\.com|lu\.ma)\/[^\s]+/)?.[0];
      const url = publicEventUrl(component.getFirstPropertyValue("url")) || publicEventUrl(descriptionUrl) || publicEventUrl(event.location);
      if (!title || !url) throw new Error("Incomplete event");
      const details = new Intl.DateTimeFormat("en-US", {
        timeZone: start.isDate ? "UTC" : "America/New_York", weekday: "long", month: "long", day: "numeric", year: "numeric",
        ...(start.isDate ? {} : { hour: "numeric", minute: "2-digit", timeZoneName: "short" }),
      }).format(new Date(starts));
      candidates.push({ starts, title: title.slice(0, 240), details, url });
    }
    candidates.sort((a, b) => a.starts - b.starts);
    const event = candidates[0];
    return event ? {
      welcomeEventTitle: `Up next: ${event.title}`,
      welcomeEventDetails: event.details,
      welcomeEventUrl: event.url,
      welcomeEventCta: "See event details & RSVP",
    } : { ...NO_EVENTS };
  } catch { return { ...EVENT_UNAVAILABLE }; }
}

export async function getWelcomeEventProperties(now = new Date()): Promise<WelcomeEventProperties> {
  try {
    const response = await fetch(CALENDAR_FEED, { signal: AbortSignal.timeout(3000), headers: { Accept: "text/calendar" } });
    if (!response.ok || !response.body) throw new Error("Calendar unavailable");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let size = 0; let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_FEED_BYTES) { await reader.cancel(); throw new Error("Calendar too large"); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return eventPropertiesFromCalendar(text, now);
  } catch {
    // A Luma outage must never block a verified newsletter signup.
    return { ...EVENT_UNAVAILABLE };
  }
}
