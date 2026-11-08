import { categories, categoryApi, type Category } from "@/lib/fitting";
const endpoint = "https://api.fashn.ai/v1";
const maxImageLength = 2_500_000;
const json = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function isImage(value: unknown): value is string {
  return typeof value === "string" && value.length <= maxImageLength &&
    /^data:image\/(jpeg|png|webp);base64,[\w+/]+={0,2}$/.test(value);
}

function apiKey() {
  return process.env.FASHN_API_KEY?.trim();
}

export const dynamic = "force-dynamic";

export function GET() {
  return json({ enabled: Boolean(apiKey()) });
}

export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return json({ error: "请从试穿页面发起请求。" }, 403);
  }

  const key = apiKey();
  if (!key) return json({ error: "真实试穿暂未启用。可以先上传照片并查看搭配推荐。" }, 503);
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return json({ error: "图片请求格式有误。" }, 415);
  }
  if (Number(request.headers.get("content-length")) > 2 * maxImageLength + 100) {
    return json({ error: "图片太大，请压缩后重试。" }, 413);
  }

  const body = await request.json().catch(() => null) as { person?: unknown; garment?: unknown; category?: unknown } | null;
  if (!body || !isImage(body.person) || !isImage(body.garment)) {
    return json({ error: "请选择有效的人像和衣物图片。" }, 400);
  }

  const category = body.category ?? "jacket";
  if (typeof category !== "string" || !Object.hasOwn(categories, category)) {
    return json({ error: "请选择支持的衣物类型。" }, 400);
  }
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(55_000)]);
  try {
    const start = await fetch(`${endpoint}/run`, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        model_name: "tryon-v1.6",
        inputs: {
          model_image: body.person,
          garment_image: body.garment,
          category: categoryApi[category as Category],
          mode: "balanced",
          output_format: "jpeg",
          return_base64: true,
        },
      }),
    });
    if (start.status === 401 || start.status === 403) return json({ error: "试穿服务鉴权失败，请检查服务密钥。" }, 502);
    if (start.status === 402) return json({ error: "试穿服务额度不足，请检查服务账户。" }, 502);
    if (start.status === 429) return json({ error: "试穿服务繁忙，请稍后再试。" }, 429);
    if (!start.ok) return json({ error: "试穿服务暂时无法接单，请稍后再试。" }, 502);

    const job = await start.json() as { id?: unknown } | null;
    if (typeof job?.id !== "string" || !job.id) {
      return json({ error: "试穿服务未返回任务编号。" }, 502);
    }

    while (!signal.aborted) {
      await new Promise(resolve => setTimeout(resolve, 2_000));
      const response = await fetch(`${endpoint}/status/${encodeURIComponent(job.id)}`, {
        headers, signal, cache: "no-store",
      });
      if (!response.ok) return json({ error: "暂时无法取得试穿结果。" }, 502);
      const result = await response.json() as { status?: string; output?: unknown[] } | null;
      if (result?.status === "completed") {
        const image = result.output?.[0];
        return isImage(image) ? json({ image }) : json({ error: "试穿结果格式有误。" }, 502);
      }
      if (result?.status === "failed" || result?.status === "canceled") {
        return json({ error: "未生成试穿图。请尝试换成清晰、无遮挡的正面照和单件衣物图。" }, 422);
      }
    }
  } catch {
    if (!signal.aborted) return json({ error: "试穿服务暂时无法连接。" }, 502);
  }
  return json({ error: "试穿等待超时，请稍后再试。" }, 504);
}
