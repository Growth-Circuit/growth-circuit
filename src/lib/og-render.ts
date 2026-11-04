import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, ogText, type OgCard, type OgVisual } from "@/lib/og";
import { layoutText, measureText, parseFontMetrics, type FontMetrics } from "@/lib/og-text-layout";

const colors = {
  ink: "#17313a",
  night: "#0e2029",
  sky: "#dceef5",
  mist: "#c8dce0",
  sun: "#f6a93b",
  green: "#6fb23f",
};

const root = process.cwd();
const publicDir = join(root, "public");
const imageTypes: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

type Node = { type: string; props: Record<string, unknown> };
type Child = Node | string | null | false | undefined;

function h(type: string, style: Record<string, unknown>, ...children: Child[]): Node {
  const kids = children.filter((child): child is Node | string => Boolean(child));
  return { type, props: { style, children: kids.length === 1 ? kids[0] : kids } };
}

function img(src: string, style: Record<string, unknown>): Node {
  return { type: "img", props: { src, style, width: style.width, height: style.height } };
}

interface OgAssets {
  fonts: Array<{ name: string; data: Buffer; weight: 500 | 700; style: "normal" }>;
  metrics: { medium: FontMetrics; bold: FontMetrics };
  logo: string;
}

let assetsPromise: Promise<OgAssets> | undefined;

function loadAssets() {
  assetsPromise ??= (async (): Promise<OgAssets> => {
    const [medium, bold, logo] = await Promise.all([
      readFile(join(root, "src/assets/og/parkinsans-500.ttf")),
      readFile(join(root, "src/assets/og/parkinsans-700.ttf")),
      readFile(join(publicDir, "growth-circuit-icon.svg"), "utf8"),
    ]);
    return {
      fonts: [
        { name: "Parkinsans", data: medium, weight: 500, style: "normal" },
        { name: "Parkinsans", data: bold, weight: 700, style: "normal" },
      ],
      metrics: { medium: parseFontMetrics(medium), bold: parseFontMetrics(bold) },
      logo: `data:image/svg+xml;base64,${Buffer.from(resolvePathLength(logo)).toString("base64")}`,
    };
  })();
  return assetsPromise;
}

/** resvg ignores `pathLength`, so dash lengths are converted to real circumference units. */
function resolvePathLength(svg: string) {
  return svg.replace(/<circle([^>]*?)\/?>(?:<\/circle>)?/g, (tag, attrs: string) => {
    const pathLength = Number(attrs.match(/pathLength="([\d.]+)"/)?.[1]);
    const radius = Number(attrs.match(/\sr="([\d.]+)"/)?.[1]);
    const dash = attrs.match(/stroke-dasharray="([\d.\s]+)"/)?.[1];
    if (!pathLength || !radius || !dash) return tag;
    const scale = (2 * Math.PI * radius) / pathLength;
    const dasharray = dash.trim().split(/\s+/).map((value) => (Number(value) * scale).toFixed(2)).join(" ");
    return `<circle${attrs.replace(/\spathLength="[\d.]+"/, "").replace(/stroke-dasharray="[\d.\s]+"/, `stroke-dasharray="${dasharray}"`)}></circle>`;
  });
}

async function heroDataUri(src: string) {
  try {
    if (/^https:\/\//i.test(src)) {
      const response = await fetch(src);
      const type = response.headers.get("content-type")?.split(";")[0] ?? "";
      if (!response.ok || !Object.values(imageTypes).includes(type)) return null;
      return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
    }
    const type = imageTypes[extname(src).toLowerCase()];
    const filePath = normalize(join(publicDir, decodeURIComponent(src).replace(/^\/+/, "")));
    if (!type || !filePath.startsWith(`${publicDir}${sep}`)) return null;
    return `data:${type};base64,${(await readFile(filePath)).toString("base64")}`;
  } catch {
    return null;
  }
}

const TITLE_SIZES = [92, 80, 76, 68, 60, 54, 50, 44];
/** Measured widths ignore kerning, so lines get a little room to spare. */
const WIDTH_SAFETY = 0.97;
const TITLE_TRACKING = -0.035;
const CONTENT_WIDTH = OG_IMAGE_WIDTH - 40 - 112;
const FOOTER_GAP = 32;
const PILL_PADDING = 48;
const EYEBROW_TRACKING = 0.04;

function titleSize(title: string, narrow: boolean) {
  const length = title.length;
  if (length <= 22) return narrow ? 80 : 92;
  if (length <= 40) return narrow ? 60 : 76;
  if (length <= 64) return narrow ? 50 : 60;
  return narrow ? 44 : 52;
}

function fitTitle(title: string, metrics: FontMetrics, narrow: boolean, maxWidth: number) {
  const layouts = TITLE_SIZES.filter((size) => size <= titleSize(title, narrow)).map((fontSize) => ({
    ...layoutText(title, { metrics, fontSize, letterSpacing: TITLE_TRACKING, maxWidth, maxLines: 3 }),
    fontSize,
  }));
  return (
    layouts.find((layout) => !layout.isTruncated && !layout.penalty) ??
    layouts.find((layout) => !layout.isTruncated) ??
    layouts.at(-1)!
  );
}

function fitLine(text: string, options: { metrics: FontMetrics; fontSize: number; maxWidth: number }) {
  if (measureText(text, options) <= options.maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length && measureText(`${chars.join("")}…`, options) > options.maxWidth) chars.pop();
  return `${chars.join("").replace(/[-/.\s]+$/, "")}…`;
}

function lines(text: string[], style: Record<string, unknown>): Node {
  return h("div", { display: "flex", flexDirection: "column", ...style }, ...text.map((line) => h("div", { display: "flex", whiteSpace: "nowrap" }, line)));
}

function rings(): Node {
  const ring = (size: number, color: string, width: number) =>
    h("div", {
      position: "absolute",
      width: size,
      height: size,
      left: 1010 - size / 2,
      top: 300 - size / 2,
      borderRadius: 9999,
      border: `${width}px solid ${color}`,
    });
  return h(
    "div",
    { position: "absolute", left: 0, top: 0, width: 1160, height: 590, display: "flex" },
    ring(1060, "rgba(220,238,245,0.06)", 34),
    ring(760, "rgba(220,238,245,0.08)", 30),
    ring(460, "rgba(246,169,59,0.22)", 26),
    h("div", { position: "absolute", left: 1010 + 230 * Math.cos(-2.3) - 26, top: 300 + 230 * Math.sin(-2.3) - 26, width: 52, height: 52, borderRadius: 9999, background: colors.sun }),
  );
}

function dateBadge(isoDate: string): Node {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(date);
  return h(
    "div",
    { display: "flex", flexDirection: "column", width: 260, borderRadius: 28, overflow: "hidden", background: colors.sky, color: colors.ink },
    h("div", { display: "flex", justifyContent: "center", padding: "16px 0", background: colors.sun, fontSize: 26, fontWeight: 700, letterSpacing: "0.06em" }, `${format({ month: "short" }).toUpperCase()} ${year}`),
    h("div", { display: "flex", justifyContent: "center", fontSize: 150, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.05em", padding: "26px 0 6px" }, String(day)),
    h("div", { display: "flex", justifyContent: "center", fontSize: 26, fontWeight: 500, paddingBottom: 26 }, format({ weekday: "long" })),
  );
}

function initialsBadge(initials: string): Node {
  return h(
    "div",
    { display: "flex", alignItems: "center", justifyContent: "center", width: 260, height: 260, borderRadius: 9999, background: colors.sun, color: colors.ink, fontSize: 104, fontWeight: 700, letterSpacing: "-0.04em", border: `10px solid ${colors.sky}` },
    initials,
  );
}

function verdictBadge(ship: number, skip: number): Node {
  const row = (label: string, value: number, background: string) =>
    h(
      "div",
      { display: "flex", alignItems: "center", justifyContent: "space-between", width: 270, padding: "22px 30px", borderRadius: 9999, background, color: colors.ink },
      h("div", { display: "flex", fontSize: 34, fontWeight: 700 }, label),
      h("div", { display: "flex", fontSize: 54, fontWeight: 700, letterSpacing: "-0.04em" }, String(value)),
    );
  return h(
    "div",
    { display: "flex", flexDirection: "column", gap: 18 },
    row("Ship", ship, colors.green),
    row("Skip", skip, colors.sun),
    h("div", { display: "flex", justifyContent: "center", fontSize: 22, fontWeight: 500, color: colors.mist }, `${ship + skip} GTM tasks scored`),
  );
}

function sideVisual(visual: OgVisual, hero: string | null): Node | null {
  if (visual.kind === "date") return dateBadge(visual.isoDate);
  if (visual.kind === "initials") return initialsBadge(visual.initials);
  if (visual.kind === "verdict") return verdictBadge(visual.ship, visual.skip);
  if (visual.kind === "hero" && hero) {
    return img(hero, { width: 340, height: 380, borderRadius: 28, objectFit: "cover", objectPosition: "center top", border: `6px solid ${colors.sky}` });
  }
  return null;
}

/** Explicit lines for each text block, so satori never re-wraps them. */
export async function layoutOgCard(card: OgCard, narrow: boolean) {
  const { metrics } = await loadAssets();
  const textWidth = (narrow ? 640 : 860) * WIDTH_SAFETY;
  const eyebrow = layoutText(ogText(card.eyebrow), { metrics: metrics.bold, fontSize: 24, letterSpacing: EYEBROW_TRACKING, maxWidth: textWidth, maxLines: 2 });
  const title = fitTitle(ogText(card.title), metrics.bold, narrow, textWidth);
  const isLongTitle = title.lines.length >= 3;
  const descriptionSize = isLongTitle ? 26 : 28;
  const description = layoutText(ogText(card.description), { metrics: metrics.medium, fontSize: descriptionSize, maxWidth: textWidth, maxLines: 3 });
  return { eyebrow, title, description, descriptionSize, isLongTitle };
}

export async function renderOgSvg(card: OgCard) {
  const { fonts, metrics, logo } = await loadAssets();
  const hero = card.visual.kind === "hero" ? await heroDataUri(card.visual.src) : null;
  const side = sideVisual(card.visual, hero);
  const narrow = Boolean(side);
  const { eyebrow, title, description, descriptionSize, isLongTitle } = await layoutOgCard(card, narrow);
  const url = fitLine(`growthcircuit.club${card.path === "/" ? "" : card.path}`, {
    metrics: metrics.medium,
    fontSize: 22,
    maxWidth: (CONTENT_WIDTH - FOOTER_GAP - PILL_PADDING - measureText(card.cta, { metrics: metrics.bold, fontSize: 22 })) * WIDTH_SAFETY,
  });

  const tree = h(
    "div",
    { display: "flex", boxSizing: "border-box", width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, padding: 20, background: colors.sky, fontFamily: "Parkinsans" },
    h(
      "div",
      { display: "flex", flexDirection: "column", position: "relative", boxSizing: "border-box", width: OG_IMAGE_WIDTH - 40, height: OG_IMAGE_HEIGHT - 40, borderRadius: 28, overflow: "hidden", background: colors.night, color: "white", padding: "44px 56px 40px" },
      !side && rings(),
      h(
        "div",
        { display: "flex", alignItems: "center", gap: 16 },
        img(logo, { width: 60, height: 60, borderRadius: 9999, border: `3px solid ${colors.sky}` }),
        h("div", { display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }, "Growth Circuit"),
      ),
      h(
        "div",
        { display: "flex", flex: 1, alignItems: "center", gap: 48 },
        h(
          "div",
          { display: "flex", flexDirection: "column", flex: 1, minWidth: 0, maxWidth: narrow ? 640 : 860 },
          lines(eyebrow.lines, { fontSize: 24, fontWeight: 700, lineHeight: 1.3, color: colors.sun, letterSpacing: `${EYEBROW_TRACKING}em`, marginBottom: 18 }),
          lines(title.lines, { fontSize: title.fontSize, fontWeight: 700, lineHeight: 1.05, letterSpacing: `${TITLE_TRACKING}em`, color: "white" }),
          lines(description.lines, { fontSize: descriptionSize, fontWeight: 500, lineHeight: 1.45, color: colors.mist, marginTop: isLongTitle ? 20 : 24 }),
        ),
        side && h("div", { display: "flex", flexShrink: 0, justifyContent: "center", width: 360 }, side),
      ),
      h(
        "div",
        { display: "flex", alignItems: "center", justifyContent: "space-between" },
        h("div", { display: "flex", fontSize: 22, fontWeight: 500, color: colors.mist }, url),
        h(
          "div",
          { display: "flex", alignItems: "center", padding: "12px 24px", borderRadius: 9999, background: colors.sun, color: colors.ink, fontSize: 22, fontWeight: 700 },
          card.cta,
        ),
      ),
    ),
  );

  return satori(tree as Parameters<typeof satori>[0], { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, fonts });
}

export async function renderOgImage(card: OgCard) {
  const svg = await renderOgSvg(card);
  return new Resvg(svg, { fitTo: { mode: "width", value: OG_IMAGE_WIDTH } }).render().asPng();
}
