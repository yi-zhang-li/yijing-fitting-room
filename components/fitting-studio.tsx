"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, Check, Columns2, Download, Focus, ImageIcon, LoaderCircle, RotateCcw, ScanLine, ShieldCheck, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { PhotoSlot, preparePhoto, type Photo } from "./fitting-photo";
import { Wardrobe } from "./fitting-wardrobe";
import { FittingReference, type Sample } from "./fitting-reference";
import { blankGarment, contrasts, depths, categories, palettes, recommend, scenes, shapes, styles, tones, type Garment, type Goal, type PhotoReference } from "@/lib/fitting";

type Index = 0 | 1;
type Slot = 0 | 1 | 2;
type Images = [Photo | null, Photo | null, Photo | null];
type Trial = { image?: string; error?: string; busy?: boolean };
type Trials = [Trial, Trial];
const emptyImages: Images = [null, null, null];
const emptyTrials: Trials = [{}, {}];
const labels = ["本人照片", "衣物 A", "衣物 B"] as const;
const initialGoal: Goal = { scene: "daily", shape: "either", palette: "either", contrast: "either" };
const slots = [0, 1, 2] as const;
const indexes = [0, 1] as const;

function Field<T extends string>({ label, value, options, onChange, optional, disabled }: {
  label: string; value: T | ""; options: Record<T, string>; onChange: (value: T | "") => void; optional?: boolean; disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={event => onChange(event.target.value as T | "")}>
        {optional && <option value="">未填写</option>}
        {Object.entries(options).map(([id, text]) => <option key={id} value={id}>{text as string}</option>)}
      </select>
    </label>
  );
}

export function FittingStudio() {
  const [page, setPage] = useState<"studio" | "wardrobe">("studio");
  const [task, setTask] = useState<"single" | "compare">("single");
  const [service, setService] = useState<"checking" | "enabled" | "disabled" | "unavailable">("checking");
  const [goal, setGoal] = useState(initialGoal);
  const [personalReference, setPersonalReference] = useState<Sample | null>(null);
  const [photoEffect, setPhotoEffect] = useState<PhotoReference["effect"]>("echo");
  const [garments, setGarments] = useState<[Garment, Garment]>([blankGarment, blankGarment]);
  const [images, setImages] = useState<Images>(emptyImages);
  const [trials, setTrials] = useState<Trials>(emptyTrials);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState(["", "", ""]);
  const [decoding, setDecoding] = useState([false, false, false]);
  const [view, setView] = useState<"side" | "overlay">("side");
  const [split, setSplit] = useState(50);
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const uploadVersions = useRef([0, 0, 0]);
  const activeTrial = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/try-on", { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error();
        const result = await response.json() as { enabled?: unknown } | null;
        setService(result?.enabled === true ? "enabled" : "disabled");
      })
      .catch(() => { if (!controller.signal.aborted) setService("unavailable"); });
    return () => {
      controller.abort();
      activeTrial.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (preview && !dialog.current?.open) dialog.current?.showModal();
    if (!preview && dialog.current?.open) dialog.current.close();
  }, [preview]);

  const currentGarments = garments;
  const activeIndexes: readonly Index[] = task === "single" ? [0] : indexes;
  const activeSlots: readonly Slot[] = task === "single" ? [0, 1] : slots;
  const readyCount = activeSlots.filter(index => images[index]).length;
  const busy = trials.some(trial => trial.busy);
  const reference = personalReference;
  const personPhoto = images[0]?.url;
  const comparison = recommend(task === "single" ? [garments[0], garments[0]] : currentGarments, goal, reference ? { depth: reference.depth, effect: photoEffect } : undefined);
  const looks = [trials[0].image, trials[1].image];
  const canOverlay = task === "compare" && looks.every(Boolean);
  const canRun = service === "enabled" && Boolean(images[0]) && readyCount > 1 && consent && !busy && !decoding.some(Boolean);
  const pending = activeIndexes.filter(index => images[index + 1] && !trials[index].image);

  function clear() {
    uploadVersions.current = uploadVersions.current.map(version => version + 1);
    activeTrial.current?.abort();
    activeTrial.current = null;
    setImages(emptyImages);
    setPersonalReference(null);
    setTrials(emptyTrials);
    setConsent(false);
    setErrors(["", "", ""]);
    setDecoding([false, false, false]);
    setView("side");
    setPreview(null);
    setGarments([blankGarment, blankGarment]);
  }

  function replacePhoto(index: Slot, photo: Photo | null) {
    setImages(current => current.map((item, i) => i === index ? photo : item) as Images);
    if (index === 0) setPersonalReference(null);
    setTrials(current => index === 0 ? emptyTrials : current.map((trial, i) => i === index - 1 ? {} : trial) as Trials);
    setConsent(false);
    setView("side");
    if (index !== 0) {
      setGarments(current => current.map((garment, i) => i === index - 1 ? blankGarment : garment) as [Garment, Garment]);
    }
  }

  async function loadPhoto(index: Slot, file: File) {
    const version = ++uploadVersions.current[index];
    setDecoding(current => current.map((value, i) => i === index || value));
    setErrors(current => current.map((value, i) => i === index ? "" : value));
    try {
      const photo = await preparePhoto(file, index !== 0);
      if (version === uploadVersions.current[index]) replacePhoto(index, photo);
    } catch (reason) {
      if (version === uploadVersions.current[index]) {
        setErrors(current => current.map((value, i) => i === index ? reason instanceof Error ? reason.message : "无法打开这张照片。" : value));
      }
    } finally {
      if (version === uploadVersions.current[index]) {
        setDecoding(current => current.map((value, i) => i === index ? false : value));
      }
    }
  }

  function removePhoto(index: Slot) {
    uploadVersions.current[index]++;
    replacePhoto(index, null);
    setErrors(current => current.map((value, i) => i === index ? "" : value));
    setDecoding(current => current.map((value, i) => i === index ? false : value));
  }

  async function generate(requested: readonly Index[]) {
    if (!canRun || activeTrial.current) return;
    const selected = requested.filter(index => images[index + 1]);
    if (!selected.length) return;
    const controller = new AbortController();
    activeTrial.current = controller;
    setView("side");
    setTrials(current => current.map((trial, index) => selected.includes(index as Index) ? { busy: true } : trial) as Trials);
    await Promise.all(selected.map(async index => {
      let trial: Trial;
      try {
        const response = await fetch("/api/try-on", {
          method: "POST", signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ person: images[0]?.url, garment: images[index + 1]?.url, category: garments[index].category || "jacket" }),
        });
        const result = await response.json().catch(() => null) as { image?: unknown; error?: unknown } | null;
        trial = response.ok && typeof result?.image === "string"
          ? { image: result.image }
          : { error: typeof result?.error === "string" ? result.error : "试穿失败，请稍后再试。" };
      } catch {
        trial = { error: "试穿连接中断，请稍后再试。" };
      }
      if (!controller.signal.aborted) {
        setTrials(current => current.map((value, i) => i === index ? trial : value) as Trials);
      }
    }));
    if (activeTrial.current === controller) activeTrial.current = null;
  }

  function useSaved(photo: Photo, garment: Garment, index: Index) {
    if (index === 1) setTask("compare");
    replacePhoto((index + 1) as Slot, photo);
    setGarments(current => current.map((item, i) => i === index ? garment : item) as [Garment, Garment]);
    setPage("studio");
  }

  function updateGarment<K extends keyof Garment>(index: number, key: K, value: Garment[K]) {
    setGarments(current => current.map((garment, i) => i === index ? { ...garment, [key]: value } : garment) as [Garment, Garment]);
    if (key === "category") {
      setTrials(current => current.map((trial, i) => i === index ? {} : trial) as Trials);
      setView("side");
    }
  }

  function updateGoal<K extends keyof Goal>(key: K, value: Goal[K] | "") {
    if (value) setGoal(current => ({ ...current, [key]: value }));
  }

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a href="#" className="brand" aria-label="衣镜首页"><span className="brand-mark"><ScanLine size={19} /></span><span>衣镜 <small>FITTING ROOM</small></span></a>
          <div className="mode-switch" role="group" aria-label="工作区">
            <button type="button" aria-pressed={page === "studio"} onClick={() => setPage("studio")}>试穿工作室</button>
            <button type="button" aria-pressed={page === "wardrobe"} onClick={() => setPage("wardrobe")}>我的衣橱</button>
          </div>
        </div>
      </header>
      <main>
        <section className="intro">
          <div><div className="eyebrow"><i /> 虚拟试穿工作室 <span>V0.4</span></div>
          <h1>你的穿搭，<em>从这里开始。</em></h1>
          <p>添加本人照片与衣物，试穿、比较，再收藏喜欢的搭配。</p></div>
          <a className="hero-link" href="#comparison" onClick={() => setPage("studio")}>查看试穿 <ArrowDown size={17} /></a>
        </section>

        <Wardrobe visible={page === "wardrobe"} photos={images} garments={garments} onUse={useSaved} busy={busy || decoding.some(Boolean)} />
        <div className="workspace" hidden={page !== "studio"}>
          <aside className="controls panel" aria-label="试穿设置">
            <div className="task-switch" role="group" aria-label="试穿任务">
              <button type="button" aria-pressed={task === "single"} disabled={busy} onClick={() => {setTask("single"); setView("side");}}>单件试穿</button>
              <button type="button" aria-pressed={task === "compare"} disabled={busy} onClick={() => setTask("compare")}>两件对比</button>
            </div>
            <div className="section-head"><span>01</span><h2>准备照片</h2><small>{`${readyCount} / ${activeSlots.length}`}</small></div>
            <p className="section-note">{garments.some(g => ["pants", "skirt", "dress"].includes(g.category || "")) ? "下装与连体装请用全身正面照，腿部完整可见。" : "准备清晰的正面照，以及一张单件衣物图片。"}</p>
            <div className="photo-slots">
              {activeSlots.map(index => <PhotoSlot key={index} label={labels[index]} photo={images[index]} busy={busy || decoding[index]} loading={decoding[index]} onFile={file => void loadPhoto(index, file)} onRemove={() => removePhoto(index)} />)}
            </div>
            {errors.map((error, index) => error && <p key={index} className="error" role="alert">{labels[index]} · {error}</p>)}
            {<p className="section-note compact">JPG / PNG / WebP，单张不超过 12 MB。</p>}

            <div className="divider" />
            <div className="section-head"><span>02</span><h2>设定穿搭目标</h2></div>
            <p className="section-note">按今天的场合选择，也可以指定你希望呈现的视觉效果。</p>
            <div className="goal-fields">
              <Field label="使用场合" value={goal.scene} options={scenes} onChange={value => updateGoal("scene", value)} />
              <Field label="穿搭轮廓" value={goal.shape} options={shapes} onChange={value => updateGoal("shape", value)} />
              <Field label="自选衬色" value={goal.palette} options={palettes} onChange={value => updateGoal("palette", value)} />
              <Field label="明暗效果" value={goal.contrast} options={contrasts} onChange={value => updateGoal("contrast", value)} />
            </div>

            {personPhoto && <FittingReference key={personPhoto} url={personPhoto} sample={reference} effect={photoEffect} onSample={setPersonalReference} onEffect={setPhotoEffect} />}
                <div className="divider" />
                <div className="section-head"><span>03</span><h2>确认衣物信息</h2></div>
                <p className="section-note">填风格即可比较场合。已设定轮廓或颜色时，再补对应信息。</p>
                {activeIndexes.map(index => {
                  const garment = garments[index];
                  const color = images[index + 1]?.color;
                  return <fieldset className="garment-fields" key={index}>
                    <legend>{labels[index + 1]}</legend>
                    <div className="garment-name"><Field label="衣物类型" disabled={busy} value={garment.category || "jacket"} options={categories} onChange={value => value && updateGarment(index, "category", value)} /></div>
                    <label className="field garment-name"><span>自定义名称</span><input value={garment.name} maxLength={28} placeholder="例如：深灰短夹克" onChange={event => updateGarment(index, "name", event.target.value)} /></label>
                    <Field label="风格" value={garment.style} options={styles} onChange={value => updateGarment(index, "style", value)} optional />
                    <Field label="轮廓" value={garment.shape} options={{ straight: shapes.straight, relaxed: shapes.relaxed }} onChange={value => updateGarment(index, "shape", value)} optional />
                    <Field label="色调" value={garment.tone} options={tones} onChange={value => updateGarment(index, "tone", value)} optional />
                    <Field label="明暗" value={garment.depth} options={depths} onChange={value => updateGarment(index, "depth", value)} optional />
                    {color && <div className="color-suggestion">
                      <i className="color-swatch" style={{ background: color.hex }} />
                      <span>照片中心取色：{tones[color.tone]} · {depths[color.depth]}</span>
                      <button type="button" onClick={() => {
                        updateGarment(index, "tone", color.tone);
                        updateGarment(index, "depth", color.depth);
                      }}>采用</button>
                    </div>}
                  </fieldset>;
                })}
                <div className="service-box" role="status">
                  <ShieldCheck size={17} />
                  <div><strong>{service === "checking" ? "正在检查试穿服务" : service === "enabled" ? "真人试穿已启用" : service === "disabled" ? "试穿服务待配置" : "暂时无法查询试穿服务"}</strong>
                    <p>{service === "enabled" ? "预览和推荐在本页完成。发起生成才会把相关图片发送给 FASHN。" : "添加照片即可预览、取色和分析搭配。生成试穿图需要接通图像服务。"}</p></div>
                </div>
                {service === "enabled" && <label className="consent"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />我同意将本次试穿所用的人像和衣物图发送给 FASHN。</label>}
                <button className="primary" type="button" disabled={!canRun || !pending.length} onClick={() => void generate(pending)}>
                  {busy ? <LoaderCircle className="spinner" size={17} /> : <Sparkles size={17} />}
                  {busy ? "试穿正在生成" : pending.length === 0 && readyCount > 1 ? "已生成可用结果" : pending.length === 1 ? "生成这件衣物" : "生成试穿图"}
                </button>
                <button className="clear" type="button" disabled={readyCount === 0 && !decoding.some(Boolean) && !garments.some(garment => Object.values(garment).some(Boolean))} onClick={clear}><RotateCcw size={13} /> 清空本次照片和衣物信息</button>
          </aside>

          <section className="results panel" id="comparison" aria-labelledby="results-title">
            <div className="result-header">
              <div><div className="eyebrow">01 / FITTING GALLERY</div><h2 id="results-title">{task === "single" ? "单件试穿" : "两件对比"}</h2></div>
              <div className="view-switch" hidden={task === "single"} role="group" aria-label="对比方式">
                <button type="button" aria-pressed={view === "side"} onClick={() => setView("side")}><Columns2 size={15} /> 并排</button>
                <button type="button" aria-pressed={view === "overlay"} disabled={!canOverlay} onClick={() => setView("overlay")}><SlidersHorizontal size={15} /> 滑动</button>
              </div>
            </div>
            {view === "overlay" && canOverlay ? (
              <div className="overlay-wrap">
                <div className="overlay-stage">
                  <img src={looks[0]} alt="A 穿搭预览" />
                  <img src={looks[1]} alt="B 穿搭预览" style={{ clipPath: `inset(0 0 0 ${split}%)` }} />
                  <span className="overlay-label left">A</span><span className="overlay-label right">B</span>
                  <span className="overlay-line" style={{ left: `${split}%` }} />
                </div>
                <label className="split-label">拖动对比 <input type="range" min="0" max="100" value={split} onChange={event => setSplit(Number(event.target.value))} /></label>
              </div>
            ) : (
              <div className={`comparison ${task === "single" ? "single" : ""}`}>
                {activeIndexes.map(index => {
                  const garment = currentGarments[index];
                  const trial = trials[index];
                  const photo = images[index + 1];
                  const url = looks[index];
                  const badge = url ? "AI 试穿图" : photo ? "原商品图" : "等待图片";
                  return (
                    <article className="look" key={index}>
                      <div className="look-image">
                        <span className="letter">{index === 0 ? "A" : "B"}</span>
                        {url || (photo && !trial.busy && !trial.error) ? (
                          <button className="photo-preview" type="button" aria-label={`放大${labels[index + 1]} · ${badge}`} onClick={() => setPreview({ url: url || photo!.url, label: badge })}>
                            <img src={url || photo!.url} alt={`${garment.name || labels[index + 1]} · ${badge}`} />
                            <Focus className="zoom-icon" size={17} />
                          </button>
                        ) : (
                          <div className="image-status" role="status">
                            {trial.busy ? <LoaderCircle className="spinner" size={24} /> : <ImageIcon size={24} />}
                            <span>{trial.busy ? "正在生成试穿图…" : trial.error || "上传后查看商品图"}</span>
                            {trial.error && <button type="button" className="retry" disabled={!canRun} onClick={() => void generate([index])}>单独重试</button>}
                          </div>
                        )}
                        <span className="image-badge">{badge}</span>
                        {url && <a className="download" aria-label={`保存${labels[index + 1]}试穿图`} href={url} download={`yijing-try-on-${index === 0 ? "a" : "b"}.jpg`}><Download size={16} /></a>}
                      </div>
                      <div className="look-caption">
                        <div><h3>{garment.name.trim() || labels[index + 1]}</h3><p>{[garment.style && styles[garment.style], garment.shape && shapes[garment.shape], garment.tone && tones[garment.tone], garment.depth && depths[garment.depth]].filter(Boolean).join(" · ") || "待补衣物属性"}</p></div>
                        {task === "compare" && comparison.winner === index && <span className="winner"><Check size={13} /> 推荐</span>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="advice" aria-live="polite">
              <div className="advice-header"><div className="advice-icon"><Sparkles size={19} /></div><div>
                <div className="eyebrow">02 / STYLING NOTES</div>
                <h3>{!images[1] ? "添加衣物，开始你的穿搭分析" : comparison.missing ? "填写衣物信息后查看分析" : task === "single" ? "这件衣物与目标的匹配情况" : comparison.winner === null ? "两件各有取舍" : `按当前目标，优先考虑 ${comparison.winner === 0 ? "A" : "B"}`}</h3>
              </div></div>
              <div className="reason-grid">
                {activeIndexes.map(index => { const item = index === 0 ? comparison.a : comparison.b; return (
                  <div className="reason-card" key={index}>
                    <strong>{index === 0 ? "A" : "B"} · {currentGarments[index].name.trim() || labels[index + 1]}</strong>
                    <ul>{item.checks.map(check => <li key={check.label}><span>{check.label}</span><span>{check.detail}</span></li>)}</ul>
                  </div>
                ); })}
              </div>
              <p className="fine-print">推荐按所选目标和衣物属性计算。试穿图用于外观预览，实际尺码以尺码表和实穿为准。</p>
            </div>
          </section>
        </div>
        <footer><span>衣镜 / FITTING ROOM</span><span>虚拟试穿 · 搭配参考</span></footer>
      </main>
      <dialog ref={dialog} onClose={() => setPreview(null)} className="preview-dialog">
        {preview && <><header><strong>{preview.label}</strong><button type="button" aria-label="关闭放大预览" onClick={() => setPreview(null)}><X size={19} /></button></header><img src={preview.url} alt={preview.label} /></>}
      </dialog>
    </>
  );
}
