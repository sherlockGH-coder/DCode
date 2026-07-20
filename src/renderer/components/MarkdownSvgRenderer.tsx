import React, { useRef, useEffect } from 'react';

interface MarkdownSvgRendererProps extends React.SVGProps<SVGSVGElement> {
  children?: React.ReactNode;
}

const MarkdownSvgRenderer: React.FC<MarkdownSvgRendererProps> = ({ children, ...props }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const measuredRef = useRef(false);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || measuredRef.current) return;

    const measure = () => {
      try {
        const bbox = svg.getBBox();
        const w = bbox.width;
        const h = bbox.height;

        if (w > 0 && h > 0) {
          svg.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${w} ${h}`);
          svg.removeAttribute('width');
          svg.removeAttribute('height');
          svg.style.maxWidth = '100%';
          svg.style.height = 'auto';
          measuredRef.current = true;
        }
      } catch {

        requestAnimationFrame(() => {
          try {
            const bbox = svg.getBBox();
            if (bbox.width > 0 && bbox.height > 0) {
              svg.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
              svg.removeAttribute('width');
              svg.removeAttribute('height');
              svg.style.maxWidth = '100%';
              svg.style.height = 'auto';
              measuredRef.current = true;
            }
          } catch {               }
        });
      }
    };

    requestAnimationFrame(measure);
  }, []);

  const { 'data-needs-measurement': _, ...cleanProps } = props as Record<string, unknown>;

  return (
    <svg ref={svgRef} {...(cleanProps as React.SVGProps<SVGSVGElement>)}>
      {children}
    </svg>
  );
};

export default MarkdownSvgRenderer;
