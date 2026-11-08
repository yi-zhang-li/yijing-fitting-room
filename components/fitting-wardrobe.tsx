"use client";

import { useEffect, useState } from "react";
import { Shirt, Trash2 } from "lucide-react";
import { categories, styles, shapes, tones, depths, type Garment } from "@/lib/fitting";
import { type Photo } from "./fitting-photo";

type Saved = { id: string; photo: Photo; garment: Garment };
const key = "yijing.wardrobe.v1";
const isOption = (value: unknown, options: object) => value === "" || typeof value === "string" && Object.hasOwn(options, value);

function readSaved(): Saved[] {
  const raw = JSON.parse(localStorage.getItem(key) || "[]") as unknown;
  if (!Array.isArray(raw)) throw new Error("衣橱数据格式异常。");
  return raw.filter((item): item is Saved => {
    const garment = item?.garment;
    const photo = item?.photo;
    return typeof item?.id === "string" && typeof garment?.name === "string" &&
      Object.hasOwn(categories, garment.category || "jacket") &&
      isOption(garment.style, styles) && isOption(garment.shape, shapes) &&
      isOption(garment.tone, tones) && isOption(garment.depth, depths) &&
      typeof photo?.url === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(photo.url) &&
      typeof photo.name === "string" && Number.isFinite(photo.width) && Number.isFinite(photo.height);
  }).slice(0, 12);
}

export function Wardrobe({ visible, photos, garments, onUse, busy }: {
  visible: boolean; photos: [Photo | null, Photo | null, Photo | null]; garments: [Garment, Garment];
  onUse: (photo: Photo, garment: Garment, index: 0 | 1) => void; busy: boolean;
}) {
  const [items, setItems] = useState<Saved[]>([]);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    try { setItems(readSaved()); } catch { setNotice("当前浏览器无法读取衣橱，暂时可继续使用试穿功能。"); }
  }, [visible]);

  function save(index: 0 | 1) {
    const photo = photos[index + 1];
    if (!photo) return;
    try {
      const current = readSaved();
      if (current.some(item => item.photo.url === photo.url)) {
        setNotice("这件衣物已经在衣橱中了。"); return;
      }
      if (current.length >= 12) { setNotice("衣橱最多保存 12 件，请先删除不需要的衣物。"); return; }
      const garment = { ...garments[index], category: garments[index].category || "jacket" as const };
      const next = [...current, { id: crypto.randomUUID(), photo, garment }];
      localStorage.setItem(key, JSON.stringify(next));
      setItems(next); setNotice("已保存到本机浏览器，可随时选入试穿。");
    } catch { setNotice("保存失败，浏览器空间可能不足。请删除部分收藏或换用更小的图片。"); }
  }

  function remove(id: string) {
    try {
      const next = readSaved().filter(item => item.id !== id);
      localStorage.setItem(key, JSON.stringify(next));
      setItems(next); setNotice("已从本机衣橱移除。");
    } catch { setNotice("删除失败，请检查浏览器存储权限。"); }
  }

  const shown = items.filter(item => (filter === "all" || (item.garment.category || "jacket") === filter) &&
    (item.garment.name || item.photo.name).toLowerCase().includes(query.toLowerCase()));
  return (
    <section className="wardrobe panel" hidden={!visible} aria-label="我的衣橱">
      <div className="result-header"><div><div className="eyebrow">MY WARDROBE</div><h2>我的衣橱</h2></div><span>{items.length} / 12 件</span></div>
      <p className="section-note">主动保存后，衣物照片会保存在此浏览器。换设备或清理浏览器数据后需重新添加。</p>
      <div className="wardrobe-actions">
        <button type="button" disabled={!photos[1] || busy} onClick={() => save(0)}>收藏当前衣物 A 到本机</button>
        <button type="button" disabled={!photos[2] || busy} onClick={() => save(1)}>收藏当前衣物 B 到本机</button>
      </div>
      <div className="wardrobe-filters">
        <label className="field"><span>搜索衣物</span><input value={query} placeholder="输入衣物名称" onChange={event => setQuery(event.target.value)} /></label>
        <label className="field"><span>筛选类型</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">全部类型</option>{Object.entries(categories).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      </div>
      {notice && <p role="status" className="section-note">{notice}</p>}
      {shown.length ? <div className="wardrobe-grid">{shown.map(item => <article key={item.id}>
        <img src={item.photo.url} alt={item.garment.name || "收藏的衣物"} />
        <h3>{item.garment.name || item.photo.name}</h3><p>{categories[item.garment.category || "jacket"]}</p>
        <div className="wardrobe-actions">
          <button type="button" disabled={busy} onClick={() => onUse(item.photo, item.garment, 0)}>选入 A</button>
          <button type="button" disabled={busy} onClick={() => onUse(item.photo, item.garment, 1)}>选入 B</button>
          <button type="button" aria-label={`删除 ${item.garment.name || item.photo.name}`} onClick={() => remove(item.id)}><Trash2 size={15} /></button>
        </div>
      </article>)}</div> : <div className="wardrobe-empty"><Shirt size={32} /><h3>{items.length ? "没有符合筛选条件的衣物" : "你的衣橱，从第一件衣物开始"}</h3><p>{items.length ? "试试更换名称或类型。" : "先在试穿工作室上传衣物，再回这里收藏。"}</p></div>}
    </section>
  );
}
