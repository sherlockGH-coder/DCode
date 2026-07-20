declare module 'react-syntax-highlighter/dist/esm/prism-light' {
  const PrismLight: typeof import('react-syntax-highlighter').PrismLight;
  export default PrismLight;
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism/one-light' {
  const style: Record<string, CSSProperties>;
  export default style;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/*' {
  const language: unknown;
  export default language;
}
import type { CSSProperties } from 'react';
