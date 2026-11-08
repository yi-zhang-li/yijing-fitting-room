"use client";

import { useRef, type MouseEvent } from "react";
import { Pipette } from "lucide-react";
import { describeColor, type Color } from "./fitting-photo";
import { depths, photoEffects, type PhotoReference } from "@/lib/fitting";

export type Sample = Color & { x: number; y: number };

export function FittingReference({ url, sample, effect, onSample, onEffect }: {
  url: string; sample: Sample | null; effect: PhotoReference["effect"];
  onSample: (sample: Sample | null) => void; onEffect: (effect: PhotoReference["effect"]) => void;
}) {
  const picture = useRef<HTMLImageElement>(null);

  function choose(event: MouseEvent<HTMLButtonElement>) {
    const image = picture.current;
    if (!image?.naturalWidth) return;
    const bounds = image.getBoundingClientRect();
    const position = (offset: number, size: number) => Math.max(0, Math.min(1, offset / size));
    const x = event.detail ? position(event.clientX - bounds.left, bounds.width) : 0.5;
    const y = event.detail ? position(event.clientY - bounds.top, bounds.height) : 0.5;
    const crop = Math.max(2, Math.round(Math.min(image.naturalWidth, image.naturalHeight) * 0.02));
    const start = (ratio: number, size: number) => Math.max(0, Math.min(size - crop, Math.round(ratio * size - crop / 2)));
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(image, start(x, image.naturalWidth), start(y, image.naturalHeight), crop, crop, 0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    onSample({ ...describeColor(r, g, b), x, y });
  }

  return (
    <details className="photo-reference">
      <summary><Pipette size={15} /> 从人物照片取搭配参考色 <span>可选</span></summary>
      <p>点选头发、眼镜、内搭或配饰。键盘按回车取图片中心。取色在浏览器里完成，光线会影响结果。</p>
      <button type="button" className="reference-image" onClick={choose} aria-label="在人物照片上取参考色">
        <img ref={picture} src={url} alt="用于选择参考色的人物照片" />
        {sample && <i style={{ left: `${sample.x * 100}%`, top: `${sample.y * 100}%`, backgroundColor: sample.hex }} />}
      </button>
      {sample && (
        <div className="reference-settings">
          <p role="status"><i style={{ backgroundColor: sample.hex }} /> 参考色：{depths[sample.depth]} <span>{sample.hex}</span></p>
          <label className="field"><span>外套和参考色的关系</span>
            <select value={effect} onChange={event => onEffect(event.target.value as PhotoReference["effect"])}>
              {Object.entries(photoEffects).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
            </select>
          </label>
          <button type="button" className="clear" onClick={() => onSample(null)}>移除参考色</button>
        </div>
      )}
    </details>
  );
}
