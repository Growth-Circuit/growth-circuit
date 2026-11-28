export interface HomepageFaqItem {
  question: string;
  answer: string;
}

/** Visible homepage FAQ. Homepage FAQPage JSON-LD is built from this list. */
export const homepageFaq: HomepageFaqItem[] = [
  {
    question: "Is this for marketers or engineers?",
    answer: "Both, and anyone building growth systems. Your job title matters less than your interest in the work and willingness to share what you’re learning.",
  },
  {
    question: "Do I have to live in New York?",
    answer: "No. The newsletter includes NYC and virtual events, so you can find something to join from wherever you are. Our in-person gatherings are in New York.",
  },
  {
    question: "Can I come to an event on my own?",
    answer: "Yes! Public events are a way to meet people. Browse the events above for details and RSVP requirements, and come by yourself or bring a friend.",
  },
  {
    question: "What happens after I subscribe?",
    answer: "Confirm your email and we’ll send you the most recent list of events. A few days later, you’ll get an invitation to join us on WhatsApp. You can keep reading the newsletter whether or not you join the group.",
  },
];
