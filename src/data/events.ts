export type GrowthCircuitEvent = {
  slug: string;
  title: string;
  dateLabel: string;
  dateTime: string;
  timeLabel: string;
  location: string;
  locationDetail: string;
  description: string;
  partifulUrl: string;
  image: string;
  imageAlt: string;
  status: "upcoming" | "past";
};

export const growthCircuitEvents: GrowthCircuitEvent[] = [
  {
    slug: "launch-party-2026",
    title: "Growth Circuit Launch Party",
    dateLabel: "Sunday, September 13, 2026",
    dateTime: "2026-09-13T14:00:00-04:00",
    timeLabel: "2:00pm onwards",
    location: "Prospect Park, Brooklyn",
    locationDetail: "Near 95 Prospect Park West",
    description: "A casual afternoon with balloons, food, and drinks. Bring yourself, bring friends, and something to eat or drink if you want.",
    partifulUrl: "https://partiful.com/e/d93jqKwACf819w164lmr",
    image: "/growth-circuit-launch-party-2026-square.png",
    imageAlt: "Growth Circuit Launch Party in Prospect Park on September 13",
    status: "upcoming",
  },
];

export const upcomingEvents = growthCircuitEvents.filter((event) => event.status === "upcoming");
