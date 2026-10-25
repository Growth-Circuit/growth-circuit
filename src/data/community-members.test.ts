import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blogAttendees } from "./blog-attendees";
import {
  communityMemberById,
  communityMemberHref,
  slugifyName,
  unknownCommunityMemberIds,
} from "./community-members";
import { featuredMembers } from "./featured-community";

describe("blog post attendee references", () => {
  it("slugifies names into stable ids", () => {
    expect(slugifyName("Andy McCutcheon")).toBe("andy-mccutcheon");
    expect(slugifyName("  Nick   Lafferty  ")).toBe("nick-lafferty");
  });

  it("finds a featured-community member who has no src/content/members profile", () => {
    const andy = communityMemberById("andy-mccutcheon");
    expect(andy?.name).toBe("Andy McCutcheon");
    expect(andy?.company).toBe("Toast");
    expect(andy?.github).toBeUndefined();
    expect(communityMemberHref(andy!)).toBe("https://www.linkedin.com/in/andysmccutcheon/");
  });

  it("links to the /people profile when one exists for a featured member", () => {
    const nick = communityMemberById("nick-lafferty");
    expect(nick?.github).toBe("nicklafferty");
    expect(communityMemberHref(nick!)).toBe("/people/nicklafferty");
  });

  it("reports ids that are not in featured-community.ts or src/content/members", () => {
    expect(communityMemberById("someone-new")).toBeNull();
    expect(unknownCommunityMemberIds(["andy-mccutcheon", "someone-new"])).toEqual(["someone-new"]);
    expect(unknownCommunityMemberIds(["andy-mccutcheon", "nick-lafferty"])).toEqual([]);
  });

  it("links Oct 23 attendees to LinkedIn and does not publish a profile", () => {
    const featuredNames = new Set(featuredMembers.map((member) => member.name));
    const profileFiles = readdirSync(new URL("../content/members/", import.meta.url))
      .filter((name) => name.endsWith(".json"))
      .sort();
    expect(profileFiles).toEqual(["lucy-jane-hoyle.json", "nicklafferty.json"]);

    for (const attendee of blogAttendees) {
      const member = communityMemberById(attendee.id);
      expect(member?.name).toBe(attendee.name);
      expect(member?.github).toBeUndefined();
      expect(member?.photo).toBeUndefined();
      expect(member?.linkedin).toBe(attendee.linkedin);
      expect(communityMemberHref(member!)).toBe(attendee.linkedin);
      expect(featuredNames.has(attendee.name)).toBe(false);
    }

    expect(communityMemberById("david-ronen")?.company).toBeUndefined();
    expect(communityMemberById("felicia-baskin")?.company).toBeUndefined();
    expect(communityMemberById("hayley-brunetto")?.role).toBeUndefined();
    expect(communityMemberById("hayley-brunetto")?.company).toBeUndefined();
    expect(communityMemberById("lucy-hoyle")?.github).toBe("lucy-jane-hoyle");
    expect(communityMemberHref(communityMemberById("lucy-hoyle")!)).toBe("/people/lucy-jane-hoyle");
  });
});
