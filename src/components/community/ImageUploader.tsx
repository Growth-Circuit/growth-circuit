import { useEffect, useRef, useState } from "react";

type ImageItem = {
  id: string;
  postId: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  position: number;
  state: "staging" | "ready" | "deleted";
  previewUrl?: string;
  status?: "uploading" | "processing" | "ready" | "failed";
  error?: string;
  file?: File;
  signedUrl?: string;
};

type Props = {
  postId: string;
  csrfToken: string;
  initialImages?: ImageItem[];
  initialHeaderImageId?: string | null;
  initialHeaderEnabled?: boolean;
};

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function ImageUploader({
  postId,
  csrfToken,
  initialImages = [],
  initialHeaderImageId = null,
  initialHeaderEnabled = true,
}: Props) {
  const [images, setImages] = useState(() => initialImages.filter((image) => image.state !== "deleted").sort((a, b) => a.position - b.position));
  const [headerImageId, setHeaderImageId] = useState(initialHeaderImageId);
  const [headerEnabled, setHeaderEnabled] = useState(initialHeaderEnabled);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const previewUrls = useRef(new Set<string>());

  useEffect(() => () => {
    for (const url of previewUrls.current) URL.revokeObjectURL(url);
    previewUrls.current.clear();
  }, []);

  async function finalize(imageId: string) {
    setImages((current) => current.map((image) => image.id === imageId ? { ...image, status: "processing", error: undefined } : image));
    const response = await fetch("/api/community/uploads/finalize", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify({ imageId }),
    });
    const result = await response.json() as { image?: ImageItem; error?: { message?: string } };
    if (!response.ok || !result.image) throw new Error(result.error?.message || "The image could not be processed.");
    setImages((current) => current.map((image) => image.id === imageId
      ? { ...image, ...result.image, status: "ready", error: undefined, file: undefined, signedUrl: undefined }
      : image));
    if (headerEnabled && !headerImageId) setHeaderImageId(imageId);
  }

  async function uploadStaged(imageId: string, file: File, signedUrl: string) {
    const form = new FormData();
    form.append("cacheControl", "0");
    form.append("", file);
    const uploadResponse = await fetch(signedUrl, { method: "PUT", headers: { "x-upsert": "false" }, body: form });
    if (!uploadResponse.ok) throw new Error("The upload stopped before processing. Retry or remove this image.");
    await finalize(imageId);
  }

  async function upload(file: File) {
    if (!ALLOWED_TYPES.has(file.type)) throw new Error("Choose a JPEG, PNG, or WebP image.");
    if (file.size < 1 || file.size > MAX_BYTES) throw new Error("Images must be 5 MiB or smaller.");
    const signatureHex = bytesToHex(new Uint8Array(await file.slice(0, 32).arrayBuffer()));
    const signResponse = await fetch("/api/community/uploads/sign", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify({ postId, fileName: file.name, mimeType: file.type, byteSize: file.size, signatureHex }),
    });
    const signed = await signResponse.json() as { image?: ImageItem; upload?: { signedUrl: string }; error?: { message?: string } };
    if (!signResponse.ok || !signed.image || !signed.upload) throw new Error(signed.error?.message || "The private upload could not start.");

    const previewUrl = URL.createObjectURL(file);
    previewUrls.current.add(previewUrl);
    const pendingImage: ImageItem = { ...signed.image, previewUrl, status: "uploading", file, signedUrl: signed.upload.signedUrl };
    setImages((current) => [...current, pendingImage].sort((a, b) => a.position - b.position));
    await uploadStaged(signed.image.id, file, signed.upload.signedUrl);
  }

  async function retry(image: ImageItem) {
    setBusy(true);
    setNotice(null);
    try {
      if (image.file && image.signedUrl) {
        setImages((current) => current.map((item) => item.id === image.id ? { ...item, status: "uploading", error: undefined } : item));
        await uploadStaged(image.id, image.file, image.signedUrl);
      } else {
        await finalize(image.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "The image could not be processed.";
      setImages((current) => current.map((item) => item.id === image.id ? { ...item, status: "failed", error: message } : item));
      setNotice(message);
    } finally {
      setBusy(false);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setNotice(null);
    for (const file of Array.from(files).slice(0, Math.max(0, 5 - images.length))) {
      try {
        await upload(file);
      } catch (error) {
        const message = error instanceof Error ? error.message : "The image upload failed.";
        setNotice(message);
        setImages((current) => current.map((image) => image.status === "uploading" || image.status === "processing"
          ? { ...image, status: "failed", error: message }
          : image));
      }
    }
    setBusy(false);
  }

  async function patch(body: Record<string, unknown>) {
    const response = await fetch(`/api/community/uploads/${postId}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify(body),
    });
    const result = await response.json() as { images?: ImageItem[]; headerImageId?: string | null; headerEnabled?: boolean; error?: { message?: string } };
    if (!response.ok) throw new Error(result.error?.message || "The image change was not saved.");
    return result;
  }

  async function move(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= images.length) return;
    const reordered = [...images];
    [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
    setBusy(true);
    try {
      const result = await patch({ action: "reorder", imageIds: reordered.map((image) => image.id) });
      setImages(result.images || reordered.map((image, position) => ({ ...image, position })));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The image order was not saved.");
    } finally {
      setBusy(false);
    }
  }

  async function selectHeader(imageId: string | null) {
    setBusy(true);
    try {
      const result = await patch({ action: "header", enabled: imageId !== null, imageId });
      setHeaderEnabled(Boolean(result.headerEnabled));
      setHeaderImageId(result.headerImageId || null);
      setNotice(imageId ? "Header image updated." : "This post will publish without a header image.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The header was not changed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(image: ImageItem) {
    if (!window.confirm("Remove this image from the draft? It will also be cleared as the header if selected.")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/community/uploads/${image.id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "x-csrf-token": csrfToken },
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message || "The image was not removed.");
      if (image.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(image.previewUrl);
        previewUrls.current.delete(image.previewUrl);
      }
      setImages((current) => current.filter((item) => item.id !== image.id));
      if (headerImageId === image.id) setHeaderImageId(null);
      setNotice("Image removed from the draft.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The image was not removed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="image-uploader" aria-labelledby="image-uploader-title">
      <div>
        <h3 id="image-uploader-title">Images</h3>
        <p>Add up to five JPEG, PNG, or WebP images. Each image can be up to 5 MiB.</p>
      </div>
      <label className="image-uploader__pick">
        <span>{busy ? "Working…" : "Choose images"}</span>
        <input disabled={busy || images.length >= 5} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => void onFiles(event.target.files)} />
      </label>
      <p aria-live="polite" className="image-uploader__notice">{notice}</p>
      <ol className="image-uploader__list">
        {images.map((image, index) => (
          <li key={image.id}>
            <div className="image-uploader__preview">
              {image.previewUrl ? <img src={image.previewUrl} alt="" /> : <span>Image {index + 1}</span>}
            </div>
            <div className="image-uploader__meta">
              <strong>{image.status === "ready" ? "Ready" : image.status === "failed" ? "Needs attention" : "Processing"}</strong>
              {headerEnabled && headerImageId === image.id && <span>Current header</span>}
              {image.error && <span>{image.error}</span>}
            </div>
            <div className="image-uploader__actions">
              <button type="button" disabled={busy || index === 0} onClick={() => void move(index, -1)}>Move up</button>
              <button type="button" disabled={busy || index === images.length - 1} onClick={() => void move(index, 1)}>Move down</button>
              <button type="button" disabled={busy || image.status !== "ready"} onClick={() => void selectHeader(image.id)}>Use as header</button>
              {image.status === "failed" && <button type="button" disabled={busy} onClick={() => void retry(image)}>Retry</button>}
              <button type="button" disabled={busy} onClick={() => void remove(image)}>Remove</button>
            </div>
          </li>
        ))}
      </ol>
      {images.length > 0 && <button className="image-uploader__no-header" type="button" disabled={busy || !headerEnabled} onClick={() => void selectHeader(null)}>Publish without a header image</button>}
      <style>{`
        .image-uploader { display: grid; gap: 14px; padding: 18px; border: 1px solid var(--line); border-radius: 18px; background: var(--surface); }
        .image-uploader h3, .image-uploader p { margin: 0; }
        .image-uploader p { color: var(--muted); font-size: 14px; }
        .image-uploader__pick { display: inline-flex; width: fit-content; min-height: 42px; align-items: center; padding: 0 16px; border: 1px solid var(--line-strong); border-radius: 999px; cursor: pointer; font-weight: 730; }
        .image-uploader__pick input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
        .image-uploader__notice { min-height: 20px; color: var(--matcha-ink) !important; }
        .image-uploader__list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
        .image-uploader__list li { display: grid; grid-template-columns: 88px minmax(120px, 1fr) minmax(280px, auto); align-items: center; gap: 14px; padding: 12px; border: 1px solid var(--line); border-radius: 14px; }
        .image-uploader__preview { display: grid; width: 88px; height: 66px; place-items: center; overflow: hidden; border-radius: 9px; background: var(--surface-field); color: var(--muted); font-size: 12px; }
        .image-uploader__preview img { width: 100%; height: 100%; object-fit: cover; }
        .image-uploader__meta { display: grid; gap: 3px; font-size: 13px; }
        .image-uploader__meta span { color: var(--muted); }
        .image-uploader__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
        .image-uploader button { min-height: 38px; border: 1px solid var(--line); border-radius: 999px; padding: 0 12px; background: var(--paper); color: var(--porcelain); cursor: pointer; }
        .image-uploader button:disabled { cursor: not-allowed; opacity: .55; }
        .image-uploader__no-header { width: fit-content; }
        @media (max-width: 760px) { .image-uploader__list li { grid-template-columns: 72px 1fr; } .image-uploader__actions { grid-column: 1 / -1; justify-content: flex-start; } }
      `}</style>
    </section>
  );
}
