import { describe, expect, it } from "vitest";
import {
  communityMemberById,
  communityMemberHref,
  slugifyName,
  unknownCommunityMemberIds,
} from "./community-members";

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
});
