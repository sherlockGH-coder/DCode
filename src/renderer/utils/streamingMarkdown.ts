function isAsciiWordChar(ch: string | undefined): boolean {
  return !!ch && /[A-Za-z0-9]/.test(ch);
}

function countSingleUnderscoreMarkers(text: string): number {
  let count = 0;

  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '_') continue;
    if (text[i - 1] === '\\') continue;
    if (text[i - 1] === '_' || text[i + 1] === '_') continue;

    if (isAsciiWordChar(text[i - 1]) && isAsciiWordChar(text[i + 1])) continue;

    count++;
  }

  return count;
}

/**
 * 流式 Markdown 预处理
 *
 * 在把文本丢给 react-markdown 之前调用此函数
 * 它会检测未闭合的 Markdown 结构并补上闭合符号
 *
 * @param text - 可能不完整的 Markdown 文本
 * @returns 预处理后的"完整" Markdown 文本
 *
 * @example
 *   closeMarkdown('```python\nprint("hello")')
 *   // → '```python\nprint("hello")\n```'
 *
 *   closeMarkdown('**粗体')
 *   // → '**粗体**'
 */
export function closeMarkdown(text: string): string {
  let result = text;

  const codeBlockMarkers = result.match(/```/g);
  if (codeBlockMarkers && codeBlockMarkers.length % 2 !== 0) {
    if (!result.endsWith('\n')) {
      result += '\n';
    }
    result += '```';
  }

  let singleBacktickCount = 0;
  let i = 0;
  while (i < result.length) {
    if (result[i] === '`') {

      if ((i > 0 && result[i - 1] === '`') || (i < result.length - 1 && result[i + 1] === '`')) {

        while (i < result.length && result[i] === '`') {
          i++;
        }
        continue;
      }

      singleBacktickCount++;
    }
    i++;
  }

  if (singleBacktickCount % 2 !== 0) {
    result += '`';
  }

  const codeFree = result
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '');

  const doubleStars = codeFree.match(/\*\*/g);
  if (doubleStars && doubleStars.length % 2 !== 0) {
    result += '**';
  }

  const starText = codeFree
    .replace(/\*\*/g, '')
    .replace(/^ {0,3}\*(?=\s)/gm, '');
  const singleStars = starText.match(/\*/g);
  if (singleStars && singleStars.length % 2 !== 0) {
    result += '*';
  }

  const doubleUnderscores = codeFree.match(/__/g);
  if (doubleUnderscores && doubleUnderscores.length % 2 !== 0) {
    result += '__';
  }

  const singleUnderscores = countSingleUnderscoreMarkers(codeFree.replace(/__/g, ''));
  if (singleUnderscores % 2 !== 0) {
    result += '_';
  }

  return result;
}
