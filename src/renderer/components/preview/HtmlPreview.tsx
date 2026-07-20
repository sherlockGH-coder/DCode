import React, { useRef, useEffect, memo } from 'react';

interface HtmlPreviewProps {
  code: string;
  filePath?: string;
}

const PREVIEW_CSP = [
  "default-src 'none'",
  "base-uri local-file: file:",
  "connect-src 'none'",
  "font-src data: local-file: file:",
  "form-action 'none'",
  "frame-src 'none'",
  "img-src data: blob: local-file: file:",
  "media-src data: blob: local-file: file:",
  "object-src 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline' local-file: file:",
].join('; ');

function toLocalFileUrl(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const prefixed = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `local-file://${encodeURI(prefixed)}`;
}

function withBaseHref(code: string, filePath?: string): string {
  if (!filePath) return code;
  const directoryUrl = toLocalFileUrl(filePath).replace(/\/[^/]*$/, '/');
  const base = `<base href="${directoryUrl}">`;
  if (/<base\s/i.test(code)) return code;
  if (/<head[^>]*>/i.test(code)) {
    return code.replace(/<head([^>]*)>/i, `<head$1>${base}`);
  }
  return `${base}${code}`;
}

function withPreviewCsp(code: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`;
  if (/<head[^>]*>/i.test(code)) {
    return code.replace(/<head([^>]*)>/i, `<head$1>${meta}`);
  }
  return `${meta}${code}`;
}

const HtmlPreview: React.FC<HtmlPreviewProps> = memo(({ code, filePath }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const html = withPreviewCsp(withBaseHref(code, filePath));

  useEffect(() => {
    if (!iframeRef.current) return;
    const iframe = iframeRef.current;
    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          const h = doc.documentElement.scrollHeight;
          iframe.style.height = `${Math.max(h + 16, 300)}px`;
        }
      } catch {                            }
    };
    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [html]);

  return (
    <div className="w-full h-full bg-white">
      <iframe
        ref={iframeRef}
        srcDoc={html}
        sandbox=""
        referrerPolicy="no-referrer"
        style={{ width: '100%', height: '100%', minHeight: 300, border: 'none', display: 'block' }}
        title="HTML Preview"
      />
    </div>
  );
});

export default HtmlPreview;
