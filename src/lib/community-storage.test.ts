import { describe, expect, it, vi } from "vitest";

import {
  MAX_IMAGE_BYTES,
  CommunityImageError,
  evaluateUploadQuota,
  normalizeCommunityImage,
  validateImageUploadRequest,
} from "@/lib/community-storage";

const signatures = {
  "image/jpeg": "ffd8ffe000104a464946",
  "image/png": "89504e470d0a1a0a0000",
  "image/webp": "524946462400000057454250",
} as const;

function signatureBytes(mimeType: keyof typeof signatures) {
  return Uint8Array.from(signatures[mimeType].match(/.{2}/g) || [], (byte) => Number.parseInt(byte, 16));
}

describe("image upload request validation", () => {
  it.each(Object.entries(signatures))("accepts a bounded %s with a matching signature", (mimeType, signatureHex) => {
    expect(validateImageUploadRequest({
      postId: "20000000-0000-0000-0000-000000000001",
      fileName: `build.${mimeType.split("/")[1]}`,
      mimeType,
      byteSize: 1024,
      signatureHex,
    })).toMatchObject({ ok: true, value: { mimeType, byteSize: 1024 } });
  });

  it.each([
    [{ fileName: "../secret.png", mimeType: "image/png", byteSize: 100, signatureHex: signatures["image/png"] }, "file name"],
    [{ fileName: "image.svg", mimeType: "image/svg+xml", byteSize: 100, signatureHex: "3c737667" }, "JPEG, PNG, or WebP"],
    [{ fileName: "image.gif", mimeType: "image/gif", byteSize: 100, signatureHex: "474946383961" }, "JPEG, PNG, or WebP"],
    [{ fileName: "image.png", mimeType: "image/png", byteSize: 100, signatureHex: signatures["image/jpeg"] }, "signature"],
    [{ fileName: "image.png", mimeType: "image/png", byteSize: MAX_IMAGE_BYTES + 1, signatureHex: signatures["image/png"] }, "5 MiB"],
  ])("rejects unsafe metadata", (partial, message) => {
    const result = validateImageUploadRequest({ postId: "20000000-0000-0000-0000-000000000001", ...partial });
    expect(result).toEqual({ ok: false, error: expect.stringContaining(message) });
  });
});

describe("upload quotas", () => {
  it("permits one bounded image within every quota", () => {
    expect(evaluateUploadQuota({ recentSigns: 2, hourlyBytes: 2_000_000, postObjects: 2, incomingBytes: 1_000_000 })).toEqual({ ok: true });
  });

  it.each([
    [{ recentSigns: 12, hourlyBytes: 0, postObjects: 0, incomingBytes: 10 }, "signing"],
    [{ recentSigns: 0, hourlyBytes: 25 * 1024 * 1024, postObjects: 0, incomingBytes: 10 }, "hourly image"],
    [{ recentSigns: 0, hourlyBytes: 0, postObjects: 5, incomingBytes: 10 }, "five"],
  ])("fails closed when a quota is exhausted", (input, reason) => {
    expect(evaluateUploadQuota(input)).toEqual({ ok: false, error: expect.stringContaining(reason) });
  });
});

describe("Cloudflare image normalization", () => {
  function binding(info: { format: string; fileSize: number; width: number; height: number }, output: { type: string; bytes: Uint8Array }) {
    const response = vi.fn(() => new Response(Uint8Array.from(output.bytes).buffer, { headers: { "content-type": output.type } }));
    const outputFn = vi.fn().mockResolvedValue({ response, contentType: () => output.type, image: vi.fn() });
    const input = vi.fn(() => ({ output: outputFn }));
    return { binding: { info: vi.fn().mockResolvedValue(info), input }, input, outputFn };
  }

  it.each(["image/jpeg", "image/png", "image/webp"])("fully decodes and re-encodes %s without animation", async (mimeType) => {
    const fake = binding(
      { format: mimeType, fileSize: 100, width: 1200, height: 800 },
      { type: mimeType, bytes: new Uint8Array([1, 2, 3]) },
    );
    const result = await normalizeCommunityImage(fake.binding, signatureBytes(mimeType as keyof typeof signatures), mimeType);

    expect(result).toMatchObject({ mimeType, byteSize: 3, width: 1200, height: 800 });
    expect(fake.input).toHaveBeenCalledOnce();
    expect(fake.outputFn).toHaveBeenCalledWith(expect.objectContaining({ format: mimeType, anim: false }));
  });

  it("rejects a decompression bomb before output", async () => {
    const fake = binding(
      { format: "image/png", fileSize: 100, width: 5000, height: 5000 },
      { type: "image/png", bytes: new Uint8Array([1]) },
    );
    await expect(normalizeCommunityImage(fake.binding, signatureBytes("image/png"), "image/png"))
      .rejects.toEqual(new CommunityImageError("IMAGE_DIMENSIONS", "Images must be no larger than 12 megapixels."));
    expect(fake.input).not.toHaveBeenCalled();
  });

  it("rejects decoded format mismatches and malformed decodes", async () => {
    const mismatch = binding(
      { format: "image/jpeg", fileSize: 100, width: 100, height: 100 },
      { type: "image/jpeg", bytes: new Uint8Array([1]) },
    );
    await expect(normalizeCommunityImage(mismatch.binding, signatureBytes("image/png"), "image/png"))
      .rejects.toMatchObject({ code: "IMAGE_SIGNATURE" });

    const malformed = { info: vi.fn().mockRejectedValue(new Error("decode failed")), input: vi.fn() };
    await expect(normalizeCommunityImage(malformed, signatureBytes("image/png"), "image/png"))
      .rejects.toMatchObject({ code: "IMAGE_DECODE" });
  });

  it("rejects normalized output that exceeds the byte limit", async () => {
    const fake = binding(
      { format: "image/png", fileSize: 100, width: 100, height: 100 },
      { type: "image/png", bytes: new Uint8Array(MAX_IMAGE_BYTES + 1) },
    );
    await expect(normalizeCommunityImage(fake.binding, signatureBytes("image/png"), "image/png"))
      .rejects.toMatchObject({ code: "IMAGE_BYTES" });
  });
});
