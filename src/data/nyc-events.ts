export type NycEvent = {
  name: string;
  startsAt: string;
  endsAt: string;
  when: string;
  location: string;
  description: string;
  registration: string;
  url: string;
  nickSpeaking?: boolean;
};
// Calendar candidates verified against the organizers' public pages on 2026-09-18.
// Include only publicly listed details. Calendar invitations alone are not publishable.
export const nycEvents: NycEvent[] = [
  {
    name: "Marketing Brew Summit",
    startsAt: "2026-09-30T08:30:00-04:00", endsAt: "2026-09-30T18:00:00-04:00",
    when: "September 30 · Nick’s session: 11:15–11:35am ET",
    location: "The Times Center · Manhattan",
    description: "Nick is speaking on The Marketing Engineer: Part Builder, Part Artist. A full day of conversations about where marketing goes next.",
    registration: "Paid tickets · Public registration", nickSpeaking: true,
    url: "https://www.marketingbrew.com/events/marketing-brew-summit-2026",
  },
  {
    name: "NYC AI Demos #11: Media",
    startsAt: "2026-10-01T17:00:00-04:00", endsAt: "2026-10-01T20:00:00-04:00",
    when: "October 1 · 5–8pm ET", location: "Brooklyn · Location details after registration",
    description: "Live demos from Profound, Kargo, Higgsfield, Air, and Markup AI. Hosted by Tech:NYC, Pensar, and Two Trees.",
    registration: "Request to join · Host approval required", url: "https://luma.com/nyc11",
  },
  {
    name: "Every’s Thesis: 2027",
    startsAt: "2026-11-05T08:00:00-05:00", endsAt: "2026-11-05T21:00:00-05:00",
    when: "November 5 · 8am–9pm ET", location: "Pioneer Works · Brooklyn",
    description: "A conference for builders, operators, and creatives exploring how work changes with AI. Applications are open to everyone.",
    registration: "Paid conference · Application and approval required", url: "https://every.to/thesis-2027",
  },
];
export function upcomingNycEvents(now = new Date()) {
  return nycEvents.filter((event) => Date.parse(event.endsAt) > now.getTime())
    .sort((a, b) => Number(Boolean(b.nickSpeaking)) - Number(Boolean(a.nickSpeaking)) || Date.parse(a.startsAt) - Date.parse(b.startsAt));
}
