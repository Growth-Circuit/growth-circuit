/**
 * Line breaking for OG images. Satori's own wrapping can leave one word alone
 * on a line, so text is measured with the font's advance widths and split
 * into explicit lines before rendering.
 */

export interface FontMetrics {
  /** Advance width of one character, in em. */
  advance(char: string): number;
}

export interface LayoutOptions {
  metrics: FontMetrics;
  fontSize: number;
  /** Tracking in em, matching CSS `letter-spacing`. */
  letterSpacing?: number;
  maxWidth: number;
  maxLines: number;
}

export interface TextLayout {
  lines: string[];
  isTruncated: boolean;
  /** Count of lone or dangling words the layout could not avoid. */
  penalty: number;
}

const ELLIPSIS = "…";
const SINGLE_WORD_LINE = 1e12;
const DANGLING_WORD = 1e9;

/** Reads `head`, `hhea`, `hmtx`, and `cmap` from a static TrueType font. */
export function parseFontMetrics(font: Uint8Array): FontMetrics {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  const tables = new Map<string, number>();
  for (let index = 0; index < view.getUint16(4); index += 1) {
    const record = 12 + index * 16;
    const tag = String.fromCharCode(...font.subarray(record, record + 4));
    tables.set(tag, view.getUint32(record + 8));
  }
  const table = (tag: string) => {
    const offset = tables.get(tag);
    if (offset === undefined) throw new Error(`Font is missing the ${tag} table.`);
    return offset;
  };

  const unitsPerEm = view.getUint16(table("head") + 18);
  const metricCount = view.getUint16(table("hhea") + 34);
  const hmtx = table("hmtx");
  const advanceOf = (glyph: number) => view.getUint16(hmtx + Math.min(glyph, metricCount - 1) * 4);
  const glyphOf = cmapLookup(view, table("cmap"));
  const cache = new Map<string, number>();

  return {
    advance(char) {
      let width = cache.get(char);
      if (width === undefined) {
        width = advanceOf(glyphOf(char.codePointAt(0) ?? 0)) / unitsPerEm;
        cache.set(char, width);
      }
      return width;
    },
  };
}

function cmapLookup(view: DataView, cmap: number): (codePoint: number) => number {
  const subtables: Array<{ platform: number; encoding: number; offset: number }> = [];
  for (let index = 0; index < view.getUint16(cmap + 2); index += 1) {
    const record = cmap + 4 + index * 8;
    subtables.push({ platform: view.getUint16(record), encoding: view.getUint16(record + 2), offset: cmap + view.getUint32(record + 4) });
  }

  const full = subtables.find((entry) => view.getUint16(entry.offset) === 12);
  if (full) {
    const groups = view.getUint32(full.offset + 12);
    return (codePoint) => {
      for (let index = 0; index < groups; index += 1) {
        const group = full.offset + 16 + index * 12;
        const start = view.getUint32(group);
        if (codePoint >= start && codePoint <= view.getUint32(group + 4)) return view.getUint32(group + 8) + codePoint - start;
      }
      return 0;
    };
  }

  const bmp = subtables.find((entry) => view.getUint16(entry.offset) === 4);
  if (!bmp) throw new Error("Font has no Unicode cmap.");
  const segments = view.getUint16(bmp.offset + 6) / 2;
  const ends = bmp.offset + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const rangeOffsets = deltas + segments * 2;
  return (codePoint) => {
    for (let index = 0; index < segments; index += 1) {
      if (codePoint > view.getUint16(ends + index * 2)) continue;
      const start = view.getUint16(starts + index * 2);
      if (codePoint < start) return 0;
      const delta = view.getInt16(deltas + index * 2);
      const rangeOffset = view.getUint16(rangeOffsets + index * 2);
      if (!rangeOffset) return (codePoint + delta) & 0xffff;
      const glyph = view.getUint16(rangeOffsets + index * 2 + rangeOffset + (codePoint - start) * 2);
      return glyph ? (glyph + delta) & 0xffff : 0;
    }
    return 0;
  };
}

export function measureText(text: string, options: Pick<LayoutOptions, "metrics" | "fontSize" | "letterSpacing">) {
  const chars = Array.from(text);
  const ems = chars.reduce((sum, char) => sum + options.metrics.advance(char), 0) + chars.length * (options.letterSpacing ?? 0);
  return ems * options.fontSize;
}

/** Words of one letter, or symbols like `&`, read badly at the end of a line. */
function isDangling(word: string) {
  return Array.from(word.replace(/[^\p{L}\p{N}&+]/gu, "")).length <= 1;
}

/**
 * Splits words into the fewest lines that fit, then picks the most even
 * breaks. A line never holds a single word when the text has enough words
 * to avoid it, and a line never ends on a one-letter word like "I" or "a".
 */
function breakWords(words: string[], lineCount: number, options: LayoutOptions): { lines: string[]; penalty: number } | null {
  const width = (from: number, to: number) => measureText(words.slice(from, to).join(" "), options);
  const canAvoidSingles = words.length >= lineCount * 2;
  const best: Array<Array<{ cost: number; breaks: number[] } | null>> = Array.from({ length: lineCount + 1 }, () =>
    Array.from({ length: words.length + 1 }, () => null),
  );
  best[0][0] = { cost: 0, breaks: [] };

  for (let line = 1; line <= lineCount; line += 1) {
    for (let end = line; end <= words.length; end += 1) {
      for (let start = line - 1; start < end; start += 1) {
        const previous = best[line - 1][start];
        if (!previous) continue;
        const lineWidth = width(start, end);
        if (lineWidth > options.maxWidth) continue;
        let cost = previous.cost + (options.maxWidth - lineWidth) ** 2;
        if (end - start === 1 && lineCount > 1 && canAvoidSingles) cost += SINGLE_WORD_LINE;
        if (end - start === 1 && lineCount > 1 && end === words.length) cost += SINGLE_WORD_LINE;
        if (end < words.length && isDangling(words[end - 1])) cost += DANGLING_WORD;
        if (!best[line][end] || cost < best[line][end]!.cost) best[line][end] = { cost, breaks: [...previous.breaks, end] };
      }
    }
  }

  const result = best[lineCount][words.length];
  if (!result) return null;
  const lines = result.breaks.map((end, index) => words.slice(index ? result.breaks[index - 1] : 0, end).join(" "));
  return { lines, penalty: layoutPenalty(lines) };
}

function layoutPenalty(lines: string[]) {
  if (lines.length < 2) return 0;
  return lines.reduce((count, line, index) => {
    const words = line.split(" ");
    return count + (words.length === 1 ? 1 : 0) + (index < lines.length - 1 && isDangling(words.at(-1)!) ? 1 : 0);
  }, 0);
}

/** Fewest lines wins, unless one more line removes a lone or dangling word. */
function bestBreaks(words: string[], options: LayoutOptions) {
  let best: { lines: string[]; penalty: number } | null = null;
  for (let lineCount = 1; lineCount <= Math.min(options.maxLines, words.length); lineCount += 1) {
    const result = breakWords(words, lineCount, options);
    if (!result) continue;
    if (!best || result.penalty < best.penalty) best = result;
    if (!best.penalty) break;
  }
  return best;
}

export function layoutText(text: string, options: LayoutOptions): TextLayout {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return { lines: [], isTruncated: false, penalty: 0 };

  const fitted = bestBreaks(words, options);
  if (fitted) return { ...fitted, isTruncated: false };

  for (let keep = words.length - 1; keep >= 1; keep -= 1) {
    const shortened = [...words.slice(0, keep - 1), `${words[keep - 1].replace(/[\s,.;:!?·-]+$/u, "")}${ELLIPSIS}`];
    const shortenedLayout = bestBreaks(shortened, options);
    if (shortenedLayout) return { ...shortenedLayout, isTruncated: true };
  }
  return { lines: [`${words[0]}${ELLIPSIS}`], isTruncated: true, penalty: 0 };
}
