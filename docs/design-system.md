# Growth Circuit design system

## Typography and line wrapping

Never leave one or two words hanging alone on the final line of a heading, paragraph, caption, or other editorial text. This applies on desktop and mobile. A label that is only one or two words long can remain a single line.

- Use `text-wrap: balance` for headings and short display copy. Headings receive this by default; `.text-balance` is available for other elements.
- Use `text-wrap: pretty` for paragraphs, list copy, captions, and quotations. These receive it by default; `.text-pretty` is available elsewhere.
- Treat CSS wrapping as a starting point. If a short final line remains, keep the final three or more words together with `<span class="keep-together">…</span>`, or adjust the text container width and responsive type size.
- Preserve approved copy. Do not rewrite it to fix a line break without an explicit request.
- Do not force a whole heading onto one line, hide overflow, shrink text until it is hard to read, or add a desktop-only `<br>` that produces poor mobile wrapping.
- A protected phrase must fit at the narrowest supported viewport. If it cannot fit, adjust the layout or responsive typography. Never trade a widow for horizontal scrolling.
- Intentional line breaks must follow the same rule. User-generated content and long URLs must remain readable and fit the viewport.

Before shipping typography or layout changes, inspect the actual rendered text at 320px, 390px, 768px, and 1440px, plus widths around any changed breakpoint. Verify no one-word or two-word trailing lines, no clipped text, and no horizontal overflow. Browser balancing differs, so also verify protected phrases with ordinary wrapping.

### Logo wall example

```astro
<h2>
  Growth Circuit members <span class="keep-together">include marketers from</span>
</h2>
```

The exact wording stays unchanged. The final phrase stays intact if the heading wraps. Shared defaults and utilities live in `src/styles/global.css`.
