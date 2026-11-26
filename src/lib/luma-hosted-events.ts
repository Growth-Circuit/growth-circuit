export const GROWTH_CIRCUIT_CALENDAR_ID = "cal-l48U97luvjJDet7";
export const GROWTH_CIRCUIT_CALENDAR_URL = "https://luma.com/growth-circuit";
const ITEMS_URL = "https://api.lu.ma/calendar/get-items";
const MAX_PAGES = 4;
const MAX_BYTES = 512 * 1024;
const PAGE_TIMEOUT_MS = 3000;

export interface HostedGrowthCircuitEvent {
  name: string;
  startAt: string;
  dateLabel: string;
  detail: string;
  url: string;
}

export type HostedCalendar =
  | { status: "ok"; events: HostedGrowthCircuitEvent[] }
  | { status: "unavailable" };

interface CalendarEntry {
  platform?: unknown;
  status?: unknown;
  event?: {
    name?: unknown;
    start_at?: unknown;
    end_at?: unknown;
    timezone?: unknown;
    calendar_api_id?: unknown;
    visibility?: unknown;
    url?: unknown;
    location_type?: unknown;
    geo_address_visibility?: unknown;
    geo_address_info?: {
      mode?: unknown;
      address?: unknown;
      city?: unknown;
      city_state?: unknown;
    };
  };
}

function text(value: unknown, max: number) {
  if (typeof value !== "string") return;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > max || /https?:|@/i.test(cleaned)) return;
  return cleaned;
}

function instant(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : undefined;
}

function clock(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
    timeZone,
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";
  const dayPeriod = (parts.find((part) => part.type === "dayPeriod")?.value ?? "").toLowerCase();
  return { hour, minute, dayPeriod, label: `${hour}:${minute}${dayPeriod}` };
}

function whenLabel(start: Date, end: Date | undefined, timeZone: string) {
  const startClock = clock(start, timeZone);
  if (!end || end.getTime() <= start.getTime()) return `${startClock.label} ET`;
  const endClock = clock(end, timeZone);
  if (startClock.dayPeriod === endClock.dayPeriod) return `${startClock.hour}:${startClock.minute} to ${endClock.hour}:${endClock.minute}${endClock.dayPeriod} ET`;
  return `${startClock.label} to ${endClock.label} ET`;
}

function placeLabel(event: CalendarEntry["event"]) {
  const locationType = String(event?.location_type || "");
  if (["meet", "zoom", "google-meet", "virtual", "online"].includes(locationType)) return "Online";
  if (event?.geo_address_visibility !== "public" || event.geo_address_info?.mode !== "shown") return "";
  const address = text(event.geo_address_info.address, 120);
  const city = text(event.geo_address_info.city_state, 80) || text(event.geo_address_info.city, 80);
  if (address && city && !address.toLowerCase().includes(city.toLowerCase())) return `${address}, ${city}`;
  return address || city || "";
}

function publicEventUrl(slug: unknown) {
  if (typeof slug !== "string" || !/^[A-Za-z0-9]{4,40}$/.test(slug)) return;
  return `https://luma.com/${slug}`;
}

function timeZoneFor(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)+$/.test(value)) return "America/New_York";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return value;
  } catch {
    return "America/New_York";
  }
}

export function hostedEventsFromEntries(entries: unknown, now = new Date()): HostedGrowthCircuitEvent[] {
  if (!Array.isArray(entries)) return [];
  const events: HostedGrowthCircuitEvent[] = [];
  for (const entry of entries as CalendarEntry[]) {
    if (entry?.platform !== "luma" || entry.status !== "approved") continue;
    const event = entry.event;
    if (!event || event.visibility !== "public" || event.calendar_api_id !== GROWTH_CIRCUIT_CALENDAR_ID) continue;
    const name = text(event.name, 200);
    const url = publicEventUrl(event.url);
    const starts = instant(event.start_at);
    if (!name || !url || starts === undefined) continue;
    const ends = instant(event.end_at);
    if ((ends ?? starts) <= now.getTime()) continue;
    const timeZone = timeZoneFor(event.timezone);
    const start = new Date(starts);
    let dateLabel = "";
    let detail = "";
    try {
      dateLabel = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone,
      }).format(start);
      const place = placeLabel(event);
      const when = whenLabel(start, ends === undefined ? undefined : new Date(ends), timeZone);
      detail = place ? `${when}, ${place}` : when;
    } catch {
      continue;
    }
    events.push({ name, startAt: new Date(starts).toISOString(), dateLabel, detail, url });
  }
  events.sort((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt));
  return events;
}

async function readBody(response: Response) {
  if (!response.body) throw new Error("Empty calendar");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let textBody = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new Error("Calendar too large");
    }
    textBody += decoder.decode(value, { stream: true });
  }
  textBody += decoder.decode();
  return textBody;
}

function nextCursor(payload: unknown, previous: string | undefined) {
  if (!payload || typeof payload !== "object" || !("has_more" in payload) || payload.has_more !== true) return;
  const cursor = "next_cursor" in payload ? payload.next_cursor : undefined;
  if (typeof cursor !== "string" || cursor === previous || !/^[A-Za-z0-9_-]{8,400}$/.test(cursor)) return;
  return cursor;
}

export async function listHostedGrowthCircuitEvents(now = new Date(), fetchImpl: typeof fetch = fetch): Promise<HostedCalendar> {
  const entries: unknown[] = [];
  let cursor: string | undefined;
  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const url = new URL(ITEMS_URL);
      url.searchParams.set("calendar_api_id", GROWTH_CIRCUIT_CALENDAR_ID);
      url.searchParams.set("period", "future");
      url.searchParams.set("pagination_limit", "50");
      if (cursor) url.searchParams.set("pagination_cursor", cursor);
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
        headers: { Accept: "application/json", "User-Agent": "GrowthCircuit/1.0 (+https://growthcircuit.club)" },
      });
      if (!response.ok) throw new Error("Calendar unavailable");
      const payload = JSON.parse(await readBody(response)) as { entries?: unknown };
      if (!Array.isArray(payload.entries)) throw new Error("Invalid calendar");
      entries.push(...payload.entries);
      const upcoming = nextCursor(payload, cursor);
      if (!upcoming) break;
      cursor = upcoming;
    }
    return { status: "ok", events: hostedEventsFromEntries(entries, now) };
  } catch {
    return { status: "unavailable" };
  }
}
