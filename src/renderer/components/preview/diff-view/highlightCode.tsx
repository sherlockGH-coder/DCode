import React from 'react';

type MatchRenderer = (match: RegExpExecArray) => React.ReactNode[];

function highlightMatches(text: string, regex: RegExp, renderMatch: MatchRenderer): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.substring(lastIndex, match.index));
    parts.push(...renderMatch(match));
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) parts.push(text.substring(lastIndex));
  return parts.length > 0 ? <>{parts}</> : text;
}

function renderCommonToken(match: RegExpExecArray): React.ReactNode[] {
  const [, comment, str, keyword, num] = match;
  if (comment) {
    return [<span key={match.index} className="text-[#a0a1a7] dark:text-[#5c6370]">{comment}</span>];
  }
  if (str) return [<span key={match.index} className="text-[#50a14f] dark:text-[#98c379]">{str}</span>];
  if (keyword) return [<span key={match.index} className="text-[#a626a4] dark:text-[#c678dd] font-semibold">{keyword}</span>];
  return [<span key={match.index} className="text-[#986801] dark:text-[#d19a66]">{num}</span>];
}

export function highlightCode(text: string, ext: string): React.ReactNode {
  if (!text) return '';

  if (ext === 'py') {
    const pyRegex = /(#.*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b(?:def|class|import|from|as|return|if|elif|else|for|while|try|except|finally|with|in|is|and|or|not|lambda|pass|break|continue|yield|global|nonlocal|assert|del|None|True|False)\b)|(\b\d+(?:\.\d+)?\b)/g;
    return highlightMatches(text, pyRegex, renderCommonToken);
  }

  if (ext === 'json') {
    const jsonRegex = /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|(-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|true|false|null)/g;
    return highlightMatches(text, jsonRegex, (match) => {
      const [, str, colon, numOrBool] = match;
      if (str) {
        if (colon) {
          return [
            <span key={match.index} className="text-[#e45649] dark:text-[#e06c75] font-medium">{str}</span>,
            colon,
          ];
        }
        return [<span key={match.index} className="text-[#50a14f] dark:text-[#98c379]">{str}</span>];
      }
      return [<span key={match.index} className="text-[#986801] dark:text-[#d19a66] font-semibold">{numOrBool}</span>];
    });
  }

  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') {
    const jsRegex = /(\/\/.*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:const|let|var|function|return|class|interface|type|import|export|from|default|extends|implements|as|new|this|typeof|instanceof|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|async|await|yield|null|undefined|true|false)\b)|(\b\d+(?:\.\d+)?\b)/g;
    return highlightMatches(text, jsRegex, renderCommonToken);
  }

  if (ext === 'css') {
    const cssRegex = /(\/\*[\s\S]*?\*\/)|(#[a-zA-Z0-9_-]+|\.[a-zA-Z0-9_-]+|[a-zA-Z0-9_-]+)(?=\s*\{)|([a-zA-Z0-9_-]+)(?=\s*:)|(:[^;]+;)/g;
    return highlightMatches(text, cssRegex, (match) => {
      const [, comment, selector, prop, val] = match;
      if (comment) {
        return [<span key={match.index} className="text-[#a0a1a7] dark:text-[#5c6370]">{comment}</span>];
      }
      if (selector) return [<span key={match.index} className="text-[#e45649] dark:text-[#e06c75] font-medium">{selector}</span>];
      if (prop) return [<span key={match.index} className="text-[#4078f2] dark:text-[#61afef]">{prop}</span>];
      return [<span key={match.index} className="text-[#986801] dark:text-[#d19a66]">{val}</span>];
    });
  }

  const defaultRegex = /(\/\/.*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;
  return highlightMatches(text, defaultRegex, (match) => {
    const [, comment, str] = match;
    if (comment) {
      return [<span key={match.index} className="text-[#a0a1a7] dark:text-[#5c6370]">{comment}</span>];
    }
    return [<span key={match.index} className="text-[#50a14f] dark:text-[#98c379]">{str}</span>];
  });
}
