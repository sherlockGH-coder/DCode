interface HastElement {
  type: 'element';
  tagName: string;
  properties: Record<string, string | boolean | number | null | undefined>;
  children: HastNode[];
}

interface HastRoot {
  type: 'root';
  children: HastNode[];
}

type HastNode = HastElement | HastRoot | { type: string; [key: string]: unknown };

/** 递归遍历 HAST 树 */
function walkHast(node: HastNode, visitor: (el: HastElement) => void): void {
  if (node.type === 'element') {
    visitor(node as HastElement);
  }
  if ('children' in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      walkHast(child, visitor);
    }
  }
}

/** 从尺寸字符串中解析纯数字部分（如 "200px" → 200, "200" → 200） */
function parseNumericSize(val: unknown): number | null {
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

/** 判断尺寸是否为纯数字（可安全转为 viewBox） */
function isNumericSize(val: unknown): boolean {
  if (typeof val === 'number') return true;
  if (typeof val !== 'string') return false;

  return /^\d+(\.\d+)?(px)?$/.test(val.trim());
}

/** 合并样式字符串 */
function appendStyle(existing: unknown, addition: string): string {
  if (typeof existing === 'string' && existing.trim()) {
    return existing.trimEnd().replace(/;?\s*$/, `; ${addition}`);
  }
  return addition;
}

/**
 * rehype 插件：使 SVG 响应式
 * 应放在 rehypeRaw 之后，确保 raw HTML 已解析为 HAST 元素
 */
const rehypeScalableSvg = () => (tree: HastRoot) => {
  walkHast(tree, (el) => {
    if (el.tagName !== 'svg') return;

    const props = el.properties;
    const viewBox = props.viewBox;
    const width = props.width;
    const height = props.height;

    props.style = appendStyle(props.style, 'max-width: 100%; height: auto;');

    if (viewBox) {

      delete props.width;
      delete props.height;
      return;
    }

    if (isNumericSize(width) && isNumericSize(height)) {

      const w = parseNumericSize(width);
      const h = parseNumericSize(height);
      if (w && h) {
        props.viewBox = `0 0 ${w} ${h}`;
        delete props.width;
        delete props.height;
        return;
      }
    }

    props['data-needs-measurement'] = 'true';
  });
};

export default rehypeScalableSvg;
