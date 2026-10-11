// Curated by Nick, separate from members' self-managed accounts and profiles.
export const communityCompanies = [
  { name: "Profound", logo: "profound.svg", connection: "Nick Lafferty", mark: false },
  { name: "Carta", logo: "carta.svg", connection: "Lucy Hoyle", mark: false },
  { name: "Figma", logo: "figma.svg", connection: "Chase Wilson", mark: true },
  { name: "Toast", logo: "toast.svg", connection: "Andy McCutcheon", mark: false },
  { name: "Block", logo: "block.svg", connection: "Andy McCutcheon, former employer", mark: false },
  { name: "Vercel", logo: "vercel.svg", connection: "Cheryl Wolf", mark: false },
  { name: "Clay", logo: "clay.avif", connection: "Steven Male", mark: false },
  { name: "Mutiny", logo: "mutiny.svg", connection: "Matt Ratchford", mark: true },
  { name: "Infinite Machine", logo: "infinite-machine.svg", connection: "Obie Odom", mark: true },
];
export const featuredMembers = [
  { name: "Nick Lafferty", github: "nicklafferty", initials: "NL", company: "Profound", detail: "Founding Marketing Engineer", cofounder: true, linkedin: "https://www.linkedin.com/in/nicklafferty/", photo: "/community/members/nick-lafferty.jpeg" },
  { name: "Lucy Hoyle", initials: "LH", company: "Carta", detail: "Senior Content Engineer", cofounder: true, linkedin: "https://www.linkedin.com/in/lucyjanehoyle/", photo: "/community/members/lucy-hoyle.png" },
  { name: "Chase Wilson", initials: "CW", company: "Figma", detail: "AI & developer marketing", linkedin: "https://www.linkedin.com/in/chasecwilson/", photo: "/community/members/chase-wilson.jpeg" },
  { name: "Andy McCutcheon", initials: "AM", company: "Toast", detail: "Previously at Block", linkedin: "https://www.linkedin.com/in/andysmccutcheon/", photo: "/community/members/andy-mccutcheon.jpeg" },
  { name: "Cheryl Wolf", initials: "CW", company: "Vercel", detail: "Enterprise marketing", linkedin: "https://www.linkedin.com/in/wolf-cheryl/", photo: "/community/members/cheryl-wolf.png" },
  { name: "Steven Male", initials: "SM", company: "Clay", detail: "AI education & community", linkedin: "https://www.linkedin.com/in/stevenmale/", photo: "/community/members/steven-male.jpeg" },
  { name: "Matt Ratchford", initials: "MR", company: "Mutiny", detail: "Growth Marketing Lead", linkedin: "https://www.linkedin.com/in/matt-ratchford-940019142/", photo: "/community/members/matt-ratchford.png" },
  { name: "Obie Odom", initials: "OO", company: "Infinite Machine", detail: "Head of Growth", linkedin: "https://www.linkedin.com/in/obieodom/", photo: "/community/members/obie-odom.jpeg" },
];

export const memberAnchor = (name: string) => `member-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
