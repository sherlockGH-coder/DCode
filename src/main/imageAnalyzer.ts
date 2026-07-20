import { readFile, stat } from 'node:fs/promises';
import { settingsManager } from './settings';
import type { Attachment } from '../shared/types';

/** 支持的图片 MIME 类型 */
const SUPPORTED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

/** 图片大小上限：20MB */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/** Vision API 超时：60s */
const VISION_TIMEOUT_MS = 60_000;

export interface ImageAnalysis {
  /** 附件 ID */
  attachmentId: string;
  /** 文件名 */
  name: string;
  /** 分析得到的文本描述 */
  description: string;
}

/** 图片扩展名 → MIME（补充附件表中可能缺失的场景） */
function extToMime(ext: string): string | null {
  const m: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return m[ext.toLowerCase()] ?? null;
}

/**
 * 读取图片文件并编码为 base64 data URL
 */
async function readImageAsDataUrl(filePath: string, mimeType: string): Promise<string> {
  const st = await stat(filePath);
  if (st.size > MAX_IMAGE_BYTES) {
    throw new Error(`图片过大 (${(st.size / 1024 / 1024).toFixed(1)}MB)，上限 ${MAX_IMAGE_BYTES / 1024 / 1024}MB`);
  }
  const buf = await readFile(filePath);
  const b64 = buf.toString('base64');
  return `data:${mimeType};base64,${b64}`;
}

async function analyzeWithAnthropic(
  dataUrls: Array<{ name: string; url: string; mimeType: string }>,
  prompt: string,
): Promise<string> {
  const apiKey = settingsManager.getVisionApiKey();
  const baseUrl = settingsManager.getVisionBaseUrl();
  const model = settingsManager.getVisionModel();

  const url = baseUrl.replace(/\/+$/, '');
  const messagesUrl = url.endsWith('/v1/messages') ? url
    : url.endsWith('/v1') ? `${url}/messages`
    : `${url}/v1/messages`;

  const imageBlocks = dataUrls.map((img) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: img.mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
      data: img.url.split(',')[1],
    },
  }));

  const body = {
    model,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          ...imageBlocks,
          {
            type: 'text' as const,
            text: prompt,
          },
        ],
      },
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);

  try {
    const resp = await fetch(messagesUrl, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Anthropic Vision API HTTP ${resp.status}: ${errText.slice(0, 200)}`);
    }

    const data = await resp.json();
    const content = data?.content;
    if (Array.isArray(content)) {
      const texts = content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
      return texts || '(图片分析返回空结果)';
    }
    return '(图片分析返回格式异常)';
  } finally {
    clearTimeout(timer);
  }
}

async function analyzeWithOpenAI(
  dataUrls: Array<{ name: string; url: string; mimeType: string }>,
  prompt: string,
): Promise<string> {
  const apiKey = settingsManager.getVisionApiKey();
  const baseUrl = settingsManager.getVisionBaseUrl();
  const model = settingsManager.getVisionModel();

  const url = baseUrl.replace(/\/+$/, '');
  const chatUrl = url.endsWith('/chat/completions') ? url
    : url.endsWith('/v1') ? `${url}/chat/completions`
    : `${url}/v1/chat/completions`;

  const imageContents = dataUrls.map((img) => ({
    type: 'image_url' as const,
    image_url: { url: img.url, detail: 'auto' as const },
  }));

  const body = {
    model,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text' as const, text: prompt },
          ...imageContents,
        ],
      },
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);

  try {
    const resp = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`OpenAI Vision API HTTP ${resp.status}: ${errText.slice(0, 200)}`);
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content || '(图片分析返回空结果)';
    if (Array.isArray(content)) {
      const texts = content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
      return texts || '(图片分析返回空结果)';
    }
    return '(图片分析返回格式异常)';
  } finally {
    clearTimeout(timer);
  }
}

function resolveImageMime(attachment: Pick<Attachment, 'mimeType' | 'name'>): string {
  const dotIndex = attachment.name.lastIndexOf('.');
  const inferred = dotIndex >= 0 ? extToMime(attachment.name.slice(dotIndex)) : null;
  const explicit = attachment.mimeType.trim().toLowerCase();
  if (SUPPORTED_IMAGE_MIMES.has(explicit)) return explicit;
  return inferred || explicit;
}

export function isSupportedImageAttachment(attachment: Attachment): boolean {
  return SUPPORTED_IMAGE_MIMES.has(resolveImageMime(attachment));
}

function assertSupportedImageMime(attachment: Attachment): string {
  const mime = resolveImageMime(attachment);
  if (!SUPPORTED_IMAGE_MIMES.has(mime)) {
    throw new Error(`不支持的图片类型: ${attachment.name} (${mime || 'unknown'})`);
  }
  return mime;
}

function normalizeQuestion(question: string): string {
  const normalized = question.trim();
  if (!normalized) {
    throw new Error('视觉分析问题不能为空。请说明需要识别图片中的哪些细节。');
  }
  return normalized;
}

function buildVisionToolPrompt(imageName: string, question: string): string {
  return [
    '你是一个按需视觉分析工具。调用方是一个不具备原生视觉能力的模型，它只需要你回答本次工具调用提出的具体问题。',
    '请基于图片内容客观作答，优先回答问题本身，不要输出与问题无关的完整通用报告。',
    '如果问题涉及文字、UI、代码、表格或图表，请尽量逐字转录可见内容，并标注位置、层级和不确定之处。',
    '如果图片模糊、被遮挡或无法确认某个细节，请明确说明“不确定”，不要补全或猜测。',
    `图片文件名：${imageName}`,
    `调用方问题：${question}`,
  ].join('\n\n');
}

async function analyzeWithConfiguredProvider(
  dataUrls: Array<{ name: string; url: string; mimeType: string }>,
  prompt: string,
): Promise<string> {
  const provider = settingsManager.getVisionProvider();
  if (provider === 'none') {
    throw new Error('Vision Provider 未配置。请配置 Anthropic、OpenAI 或自定义兼容服务。');
  }
  if (provider === 'openai' || provider === 'custom') {
    return analyzeWithOpenAI(dataUrls, prompt);
  }
  return analyzeWithAnthropic(dataUrls, prompt);
}

/**
 * 按需分析单张用户附件图片。
 *
 * 失败时直接抛错，由工具层作为 error tool_result 暴露给模型。
 */
export async function analyzeImageAttachment(
  attachment: Attachment,
  question: string,
): Promise<ImageAnalysis> {
  const normalizedQuestion = normalizeQuestion(question);
  const mime = assertSupportedImageMime(attachment);
  const dataUrl = await readImageAsDataUrl(attachment.path, mime);
  const description = await analyzeWithConfiguredProvider(
    [{ name: attachment.name, url: dataUrl, mimeType: mime }],
    buildVisionToolPrompt(attachment.name, normalizedQuestion),
  );

  return {
    attachmentId: attachment.id,
    name: attachment.name,
    description,
  };
}
