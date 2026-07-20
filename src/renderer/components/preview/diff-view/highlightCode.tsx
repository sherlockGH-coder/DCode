import React from 'react';

export function highlightCode(text: string, ext: string): React.ReactNode {
  if (!text) return '';

  if (ext === 'py') {
    const pyRegex = /(#.*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b(?:def|class|import|from|as|return|if|elif|else|for|while|try|except|finally|with|in|is|and|or|not|lambda|pass|break|continue|yield|global|nonlocal|assert|del|None|True|False)\b)|(\b\d+(?:\.\d+)?\b)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = pyRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const [_, comment, str, keyword, num] = match;
      if (comment) {
        parts.push(<span key={match.index} className="text-[#a0a1a7] dark:text-[#5c6370]">{comment}</span>);
      } else if (str) {
        parts.push(<span key={match.index} className="text-[#50a14f] dark:text-[#98c379]">{str}</span>);
      } else if (keyword) {
        parts.push(<span key={match.index} className="text-[#a626a4] dark:text-[#c678dd] font-semibold">{keyword}</span>);
      } else if (num) {
        parts.push(<span key={match.index} className="text-[#986801] dark:text-[#d19a66]">{num}</span>);
      }

      lastIndex = pyRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    return parts.length > 0 ? <>{parts}</> : text;
  }

  if (ext === 'json') {
    const jsonRegex = /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|(-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|true|false|null)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = jsonRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const [_, str, colon, numOrBool] = match;
      if (str) {
        if (colon) {
          parts.push(<span key={match.index} className="text-[#e45649] dark:text-[#e06c75] font-medium">{str}</span>);
          parts.push(colon);
        } else {
          parts.push(<span key={match.index} className="text-[#50a14f] dark:text-[#98c379]">{str}</span>);
        }
      } else if (numOrBool) {
        parts.push(<span key={match.index} className="text-[#986801] dark:text-[#d19a66] font-semibold">{numOrBool}</span>);
      }

      lastIndex = jsonRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    return parts.length > 0 ? <>{parts}</> : text;
  }

  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') {
    const jsRegex = /(\/\/.*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:const|let|var|function|return|class|interface|type|import|export|from|default|extends|implements|as|new|this|typeof|instanceof|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|async|await|yield|null|undefined|true|false)\b)|(\b\d+(?:\.\d+)?\b)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = jsRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const [_, comment, str, keyword, num] = match;
      if (comment) {
        parts.push(<span key={match.index} className="text-[#a0a1a7] dark:text-[#5c6370]">{comment}</span>);
      } else if (str) {
        parts.push(<span key={match.index} className="text-[#50a14f] dark:text-[#98c379]">{str}</span>);
      } else if (keyword) {
        parts.push(<span key={match.index} className="text-[#a626a4] dark:text-[#c678dd] font-semibold">{keyword}</span>);
      } else if (num) {
        parts.push(<span key={match.index} className="text-[#986801] dark:text-[#d19a66]">{num}</span>);
      }

      lastIndex = jsRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    return parts.length > 0 ? <>{parts}</> : text;
  }

  if (ext === 'css') {
    const cssRegex = /(\/\*[\s\S]*?\*\/)|(#[a-zA-Z0-9_-]+|\.[a-zA-Z0-9_-]+|[a-zA-Z0-9_-]+)(?=\s*\{)|([a-zA-Z0-9_-]+)(?=\s*:)|(:[^;]+;)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = cssRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const [_, comment, selector, prop, val] = match;
      if (comment) {
        parts.push(<span key={match.index} className="text-[#a0a1a7] dark:text-[#5c6370]">{comment}</span>);
      } else if (selector) {
        parts.push(<span key={match.index} className="text-[#e45649] dark:text-[#e06c75] font-medium">{selector}</span>);
      } else if (prop) {
        parts.push(<span key={match.index} className="text-[#4078f2] dark:text-[#61afef]">{prop}</span>);
      } else if (val) {
        parts.push(<span key={match.index} className="text-[#986801] dark:text-[#d19a66]">{val}</span>);
      }

      lastIndex = cssRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    return parts.length > 0 ? <>{parts}</> : text;
  }

  const defaultRegex = /(\/\/.*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = defaultRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const [_, comment, str] = match;
    if (comment) {
      parts.push(<span key={match.index} className="text-[#a0a1a7] dark:text-[#5c6370]">{comment}</span>);
    } else if (str) {
      parts.push(<span key={match.index} className="text-[#50a14f] dark:text-[#98c379]">{str}</span>);
    }

    lastIndex = defaultRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? <>{parts}</> : text;
}
