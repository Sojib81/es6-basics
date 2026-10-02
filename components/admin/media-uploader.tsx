"use client";
/** Upload: photos are resized in the browser to ≤1600 px WebP (fast pages, no paid image service). */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminButton, adminInput } from "./ui";

const MAX = 1600;

async function toWebp(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
  if (!blob || blob.type !== "image/webp")
    throw new Error("This browser can't convert images — try Chrome or Safari.");
  return { blob, width, height };
}

export function MediaUploader() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [usage, setUsage] = useState<"image" | "pm-pack" | "document">("image");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function upload() {
    if (!file) return setMsg({ ok: false, text: "Choose a file first." });
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      if (file.type.startsWith("image/")) {
        if (usage !== "image") throw new Error("Choose 'Photo' for images.");
        const { blob, width, height } = await toWebp(file);
        fd.set(
          "file",
          new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" }),
        );
        fd.set("width", String(width));
        fd.set("height", String(height));
      } else fd.set("file", file);
      fd.set("alt", alt);
      fd.set("usage", usage);
      const res = await fetch("/api/admin/media", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({ ok: false, message: "Upload failed" }))) as {
        ok: boolean;
        message?: string;
      };
      if (!data.ok) throw new Error(data.message ?? "Upload failed");
      setMsg({ ok: true, text: "Uploaded." });
      setFile(null);
      setAlt("");
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-sm font-semibold">File</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold">What is it?</span>
        <select
          value={usage}
          onChange={(e) => setUsage(e.target.value as typeof usage)}
          className={adminInput}
        >
          <option value="image">Photo / logo</option>
          <option value="pm-pack">Property manager pack (PDF)</option>
          <option value="document">Other document (PDF)</option>
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold">Description</span>
        <input
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          placeholder="e.g. Our team cleaning a kitchen in Belmont"
          className={adminInput}
        />
        <span className="text-muted block text-xs">
          Read out to blind visitors, and used as the link text for PDFs.
        </span>
      </label>
      <button
        type="button"
        onClick={upload}
        disabled={busy}
        className={`${adminButton} bg-brand text-white`}
      >
        {busy ? "Uploading…" : "Upload"}
      </button>
      {msg && (
        <p
          role={msg.ok ? "status" : "alert"}
          className={`text-sm ${msg.ok ? "text-green-800" : "text-red-700"}`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
