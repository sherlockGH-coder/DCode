import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { closeMarkdown } from '../utils/streamingMarkdown';
import { linkifyFilePaths } from '../utils/linkifyFilePaths';
import { safeUrlTransform } from '../utils/urlTransform';
import { ALLOWED_ELEMENTS, DISALLOWED_ELEMENTS } from './message-bubble/utils';

interface MarkdownBlockProps {
  text: string;
  /** Whether this is the last growing block, which needs incomplete Markdown structures closed temporarily. */
  isTail: boolean;
  components: Record<string, unknown>;
}

const MarkdownBlock: React.FC<MarkdownBlockProps> = ({ text, isTail, components }) => {
  const processed = useMemo(
    () => linkifyFilePaths(isTail ? closeMarkdown(text) : text),
    [text, isTail],
  );
  const hasHtml = ALLOWED_ELEMENTS.test(processed);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={hasHtml ? ([rehypeRaw] as any) : ([] as any)}
      disallowedElements={DISALLOWED_ELEMENTS}
      urlTransform={safeUrlTransform}
      components={components}
    >
      {processed}
    </ReactMarkdown>
  );
};

export default React.memo(MarkdownBlock);
