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
    timeLabel: "2:00 to 4:00pm ET",
    location: "493 3rd St, Brooklyn",
    locationDetail: "",
    description: "A casual afternoon with balloons, food, and drinks. Bring yourself, bring friends, and something to eat or drink if you want.",
    partifulUrl: "https://partiful.com/e/d93jqKwACf819w164lmr",
    image: "/growth-circuit-launch-party-2026-square.png",
    imageAlt: "Growth Circuit Launch Party at 493 3rd St in Brooklyn on September 13",
    status: "past",
  },
];

// Historical archive only. Live upcoming events are managed in the Luma calendar.
