"use client";

import { useState } from "react";
import { ImagePlus, X } from "lucide-react";

export type Color = { hex: string; tone: "cool" | "warm" | "neutral"; depth: "light" | "dark" };
export type Photo = { url: string; name: string; width: number; height: number; color?: Color };

export function describeColor(r: number, g: number, b: number): Color {
  return {
    hex: "#" + [r, g, b].map(value => value.toString(16).padStart(2, "0")).join(""),
    tone: Math.abs(r - b) < 16 ? "neutral" : r > b ? "warm" : "cool",
    depth: r * 0.2126 + g * 0.7152 + b * 0.0722 >= 135 ? "light" : "dark",
  };
}

function sampleCloth(context: CanvasRenderingContext2D, width: number, height: number): Color | undefined {
  const area = context.getImageData(Math.floor(width * 0.39), Math.floor(height * 0.37), Math.max(1, Math.floor(width * 0.22)), Math.max(1, Math.floor(height * 0.23))).data;
  const groups = new Map<number, { count: number; red: number; green: number; blue: number }>();
  for (let i = 0; i < area.length; i += 16) {
    const [r, g, b] = [area[i], area[i + 1], area[i + 2]];
    if (Math.min(r, g, b) > 240) continue;
    const bucket = ((r >> 5) * 64) + ((g >> 5) * 8) + (b >> 5);
    const group = groups.get(bucket) ?? { count: 0, red: 0, green: 0, blue: 0 };
    group.count++;
    group.red += r;
    group.green += g;
    group.blue += b;
    groups.set(bucket, group);
  }
  const peak = [...groups.values()].sort((a, b) => b.count - a.count)[0];
  if (!peak || peak.count < area.length / 16 * 0.12) return;
  const [r, g, b] = [peak.red, peak.green, peak.blue].map(value => Math.round(value / peak.count));
  return describeColor(r, g, b);
}
export const imageTypes = ["image/jpeg", "image/png", "image/webp"];

export async function preparePhoto(file: File, detectColor: boolean): Promise<Photo> {
  if (!imageTypes.includes(file.type) || file.size > 12 * 1024 * 1024) {
    throw new Error("请选用不超过 12 MB 的 JPG、PNG 或 WebP 图片。");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => { throw new Error("这张图片打不开，请换一张。"); });
    const { naturalWidth: width, naturalHeight: height } = image;
    if (Math.min(width, height) < 128) throw new Error("图片太小，请换一张短边至少 128 像素的图片。");
    const ratio = Math.min(1, 1440 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器无法处理这张图片。");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { url: canvas.toDataURL("image/jpeg", 0.85), name: file.name, width, height, color: detectColor ? sampleCloth(context, canvas.width, canvas.height) : undefined };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoSlot({ label, photo, busy, loading, onFile, onRemove }: {
  label: string; photo: Photo | null; busy: boolean; loading: boolean;
  onFile: (file: File) => void; onRemove: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div className="upload-item">
      <div className="upload-frame">
        <label className={`upload-box ${hover ? "is-hovered" : ""}`}
          onDragOver={event => { event.preventDefault(); if (!busy) setHover(true); }}
          onDragLeave={() => setHover(false)}
          onDrop={event => {
            event.preventDefault();
            setHover(false);
            const file = event.dataTransfer.files[0];
            if (file && !busy) onFile(file);
          }}>
          <input type="file" accept={imageTypes.join(",")} disabled={busy} aria-label={`上传${label}`}
            onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onFile(file);
            }} />
          {photo ? <img src={photo.url} alt={label} /> : <ImagePlus size={20} aria-hidden />}
          <span>{loading ? "处理中…" : photo ? "替换" : "点击或拖入"}</span>
        </label>
        {photo && <button className="remove-photo" type="button" disabled={busy} aria-label={`移除${label}`} onClick={onRemove}><X size={14} /></button>}
      </div>
      <strong>{label}</strong>
      {photo && <small title={photo.name}>{photo.width} × {photo.height}</small>}
    </div>
  );
}
