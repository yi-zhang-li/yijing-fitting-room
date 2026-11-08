export const categories = { jacket: "外套 / 西装", shirt: "衬衫 / T 恤", knit: "针织 / 卫衣", pants: "长裤 / 短裤", skirt: "半身裙", dress: "连衣裙 / 连体装" } as const;
export const categoryApi = { jacket: "tops", shirt: "tops", knit: "tops", pants: "bottoms", skirt: "bottoms", dress: "one-pieces" } as const;
export type Category = keyof typeof categories;
export const scenes = { daily: "日常通勤", interview: "面试 / 正式", weekend: "周末出门", date: "约会 / 聚餐", campus: "校园 / 上课", travel: "旅行 / 逛街", event: "庆典 / 活动" } as const;
export const shapes = { either: "都可以", straight: "利落有型", relaxed: "宽松自在" } as const;
export const palettes = { either: "无偏好", cool: "冷调衬色", warm: "暖调衬色" } as const;
export const styles = { smart: "简洁正式", casual: "休闲随性", versatile: "简约百搭" } as const;
export const tones = { neutral: "中性色", cool: "冷调", warm: "暖调" } as const;
export const contrasts = { either: "都可以", light: "浅色提亮", dark: "深色对比" } as const;
export const photoEffects = { echo: "明暗呼应", contrast: "拉开明暗" } as const;
export const depths = { light: "浅色", dark: "深色" } as const;

export type Goal = {
  scene: keyof typeof scenes;
  shape: keyof typeof shapes;
  palette: keyof typeof palettes;
  contrast: keyof typeof contrasts;
};
export type PhotoReference = { depth: keyof typeof depths; effect: keyof typeof photoEffects };
export type Garment = {
  category?: Category;
  name: string;
  style: keyof typeof styles | "";
  shape: "straight" | "relaxed" | "";
  tone: keyof typeof tones | "";
  depth: keyof typeof depths | "";
};
export const blankGarment: Garment = { name: "", style: "", shape: "", tone: "", depth: "" };
const sceneScores = {
  daily: { smart: 2, casual: 2, versatile: 4 },
  interview: { smart: 4, casual: 0, versatile: 2 },
  weekend: { smart: 0, casual: 4, versatile: 2 },
  date: { smart: 3, casual: 1, versatile: 4 },
  campus: { smart: 1, casual: 4, versatile: 3 },
  travel: { smart: 0, casual: 4, versatile: 3 },
  event: { smart: 4, casual: 1, versatile: 3 },
};

type Match = { label: string; value: number | null; max: number; detail: string };
function evaluate(garment: Garment, goal: Goal, reference?: PhotoReference) {
  const scene = garment.style ? sceneScores[goal.scene][garment.style] : null;
  const checks: Match[] = [{
    label: "场合", value: scene, max: 4,
    detail: scene === null ? "请选择衣物风格" : scene === 0 ? `和「${scenes[goal.scene]}」的着装需求差异较大` : `${styles[garment.style || "versatile"]}，适合「${scenes[goal.scene]}」${scene < 3 ? "的部分需求" : ""}`,
  }];
  if (goal.shape !== "either") checks.push({
    label: "轮廓", value: garment.shape ? Number(garment.shape === goal.shape) * 3 : null, max: 3,
    detail: !garment.shape ? "请选择衣物轮廓" : garment.shape === goal.shape ? `符合「${shapes[goal.shape]}」` : `实际偏「${shapes[garment.shape]}」`,
  });
  if (goal.palette !== "either") checks.push({
    label: "衬色", value: garment.tone ? garment.tone === goal.palette ? 2 : garment.tone === "neutral" ? 1 : 0 : null, max: 2,
    detail: !garment.tone ? "请选择衣物色调" : garment.tone === goal.palette ? `符合「${palettes[goal.palette]}」` : garment.tone === "neutral" ? "中性色可作折中" : `与自选偏好不同，实际偏${tones[garment.tone]}`,
  });
  if (goal.contrast !== "either") checks.push({
    label: "明暗", value: garment.depth ? Number(garment.depth === goal.contrast) * 2 : null, max: 2,
    detail: !garment.depth ? "请选择衣物明暗" : garment.depth === goal.contrast ? `符合「${contrasts[goal.contrast]}」` : `实际偏${depths[garment.depth]}`,
  });
  if (reference) {
    const match = Boolean(garment.depth) && (reference.effect === "echo" ? garment.depth === reference.depth : garment.depth !== reference.depth);
    checks.push({
      label: "照片配色", value: garment.depth ? Number(match) * 2 : null, max: 2,
      detail: garment.depth
        ? `取样为${depths[reference.depth]}，衣物为${depths[garment.depth]}，${match ? "符合" : "未达到"}「${photoEffects[reference.effect]}」`
        : "请确认衣物颜色的明暗",
    });
  }
  return { score: checks.reduce((sum, check) => sum + (check.value ?? 0), 0), checks };
}

export function recommend(garments: [Garment, Garment], goal: Goal, reference?: PhotoReference) {
  const [a, b] = garments.map(garment => evaluate(garment, goal, reference));
  const missing = [...a.checks, ...b.checks].some(check => check.value === null);
  return { a, b, missing, winner: missing || a.score === b.score ? null : a.score > b.score ? 0 : 1 } as const;
}
