import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, ogText, truncateOgText, type OgCard, type OgVisual } from "@/lib/og";

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

let assetsPromise: Promise<{ fonts: Array<{ name: string; data: Buffer; weight: 500 | 700; style: "normal" }>; logo: string }> | undefined;

function loadAssets() {
  assetsPromise ??= (async () => {
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

function titleSize(title: string, narrow: boolean) {
  const length = title.length;
  if (length <= 22) return narrow ? 80 : 92;
  if (length <= 40) return narrow ? 60 : 76;
  if (length <= 64) return narrow ? 50 : 60;
  return narrow ? 44 : 52;
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

export async function renderOgSvg(card: OgCard) {
  const { fonts, logo } = await loadAssets();
  const hero = card.visual.kind === "hero" ? await heroDataUri(card.visual.src) : null;
  const side = sideVisual(card.visual, hero);
  const narrow = Boolean(side);
  const title = truncateOgText(card.title, 96);
  const isLongTitle = title.length > (narrow ? 32 : 44);
  const description = truncateOgText(card.description, isLongTitle ? (narrow ? 110 : 150) : narrow ? 150 : 170);
  const url = truncateOgText(`growthcircuit.club${card.path === "/" ? "" : card.path}`, 56);

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
          h("div", { display: "flex", fontSize: 24, fontWeight: 700, color: colors.sun, letterSpacing: "0.04em", marginBottom: 18 }, ogText(card.eyebrow)),
          h("div", { display: "flex", fontSize: titleSize(title, narrow), fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.035em", color: "white", textWrap: "balance" }, title),
          h("div", { display: "flex", fontSize: isLongTitle ? 26 : 28, fontWeight: 500, lineHeight: 1.45, color: colors.mist, marginTop: isLongTitle ? 20 : 24, textWrap: "pretty" }, description),
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
