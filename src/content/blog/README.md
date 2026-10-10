# Blog posts

One Markdown file per post. The filename is the URL slug: `src/content/blog/how-we-run-growth-circuit-with-grok-bot.md` is published at `/blog/how-we-run-growth-circuit-with-grok-bot`.

This file is not a post. Files named `README.md` or starting with `_` are left out of the collection.

## Frontmatter

```yaml
title: "Short title"
description: "One or two sentences used as the meta description and the card summary."
publishDate: 2026-10-07
updatedDate: 2026-10-07
authors:
  - nick
featured: false
category: Community ops
# heroImage: /blog/images/example.png
# heroImageAlt: Describe the image.
# faq: false
```

- `title`, `description`, `publishDate`, `updatedDate`, `authors`, and `featured` are required.
- `authors` is a list of ids from `src/data/authors.ts`. An unknown id fails the build. Nick’s id is `nick`. Lucy’s id is `lucy`.
- `publishDate` and `updatedDate` are calendar dates (`YYYY-MM-DD`). `updatedDate` cannot be earlier than `publishDate`.
- `featured: true` promotes a post to the top of `/blog`. If several are featured, the newest one is shown there. If none are, the newest post is.
- `category` is optional. It appears on the post next to the date.
- `heroImage` is an optional site path (`/images/post.png`) or `https://` URL. When you set it, `heroImageAlt` is required. Posts without a hero use the site social image.
- `faq: false` turns off FAQ structured data. Leave it unset to publish `FAQPage` JSON-LD whenever the post has an H2 titled `FAQ`.

Do not set `slug` in frontmatter. The filename is the only slug.

## Slug rule

Slugs are short, human-readable, and descriptive. Use lowercase words separated by hyphens.

A slug must not contain a year or a date. These filenames fail the build:

- `weekly-update-2026.md`
- `2026-10-07-launch.md`
- `10-07-2026-notes.md`
- `notes-20261007.md`

`how-we-run-growth-circuit-with-grok-bot.md` is a valid slug.

## Writing

The page title is the only H1. Start body headings at H2. A Markdown H1 fails the build.

Put each post's images in `public/blog/<slug>/img/`. They are served at `/blog/<slug>/img/<file>`.

Write the answer in the first sentence under each heading so answer engines can quote it. Use a later paragraph for the story, the caveat, or the example.

For a FAQ, add an H2 titled `FAQ` and make each question an H3. The paragraphs under that H3 become the answer.
