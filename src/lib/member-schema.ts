import { z } from "astro/zod";

const text = (max: number) => z.string().trim().min(1, "Add a value or omit this optional field.").max(max);
const publicUrl = text(2000).pipe(z.url()).refine((value) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Use a public HTTP or HTTPS URL without credentials.");
const mediaUrl = publicUrl.refine((value) => value.startsWith("https:"), "Use an HTTPS media URL.");
const reserved = new Set(["admin", "claim", "edit", "contribute", "api", "auth"]);

const projectSchema = z.object({
  id: text(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a stable lowercase project ID with hyphens."),
  name: text(120),
  description: text(600),
  url: publicUrl,
  contribution: text(300).optional(),
  tools: z.array(text(60)).max(20).optional(),
  screenshot: mediaUrl.optional(),
  screenshotAlt: text(250).optional(),
  video: mediaUrl.optional(),
  result: text(400).optional(),
}).strict().superRefine((project, ctx) => {
  if (project.screenshot && !project.screenshotAlt) {
    ctx.addIssue({ code: "custom", path: ["screenshotAlt"], message: "Describe the screenshot for people using screen readers." });
  }
});

export const memberProfileSchema = z.object({
  name: text(120),
  github: text(39).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use your lowercase GitHub username.")
    .refine((value) => !reserved.has(value), "This username is reserved for a site route."),
  bio: text(500),
  location: text(100).optional(),
  website: publicUrl.optional(),
  linkedin: publicUrl.optional(),
  twitter: publicUrl.optional(),
  email: text(254).pipe(z.email()).optional(),
  photo: mediaUrl.optional(),
  projects: z.array(projectSchema),
}).strict().superRefine((member, ctx) => {
  const ids = new Set<string>();
  member.projects.forEach((project, index) => {
    if (ids.has(project.id)) ctx.addIssue({ code: "custom", path: ["projects", index, "id"], message: "Each project needs a unique ID within your profile." });
    ids.add(project.id);
  });
});

export type MemberProfile = z.infer<typeof memberProfileSchema>;

export function memberIdFromFilename(filename: string, data: unknown) {
  const member = memberProfileSchema.parse(data);
  if (filename !== `${member.github}.json`) throw new Error(`Name the file ${member.github}.json to match your GitHub username.`);
  return member.github;
}

export function memberAvatarUrl(member: Pick<MemberProfile, "github" | "photo">) {
  return member.photo || `https://github.com/${member.github}.png?size=192`;
}
