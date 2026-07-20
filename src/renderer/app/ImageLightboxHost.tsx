import React, { useCallback } from 'react';
import { IconX } from '../components/icons';

const IMAGE_ZOOM_MIN = 0.5;
const IMAGE_ZOOM_MAX = 8;
const IMAGE_ZOOM_STEP = 1.2;

function clampImageZoom(value: number): number {
  return Math.min(IMAGE_ZOOM_MAX, Math.max(IMAGE_ZOOM_MIN, value));
}

const IconZoomIn: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = 'shrink-0 text-current' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
    <path d="M11 8v6" />
    <path d="M8 11h6" />
  </svg>
);

const IconZoomOut: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = 'shrink-0 text-current' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
    <path d="M8 11h6" />
  </svg>
);

const IconFitImage: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = 'shrink-0 text-current' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M16 3h3a2 2 0 0 1 2 2v3" />
    <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    <path d="M8 12h8" />
  </svg>
);

const IconActualSize: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = 'shrink-0 text-current' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="5" y="5" width="14" height="14" rx="2" />
    <path d="M9 9h6v6H9z" />
  </svg>
);

interface ImageLightboxHostProps {
  activeImage: { src: string; title?: string } | null;
  setActiveImage: (img: { src: string; title?: string } | null) => void;
  isMacOS: boolean;
}

const ImageLightboxHost: React.FC<ImageLightboxHostProps> = ({
  activeImage,
  setActiveImage,
  isMacOS,
}) => {
  const [imageZoom, setImageZoom] = React.useState(1);
  const [imagePan, setImagePan] = React.useState({ x: 0, y: 0 });
  const [imageNaturalSize, setImageNaturalSize] = React.useState<{ width: number; height: number } | null>(null);
  const [imageDrag, setImageDrag] = React.useState<{ pointerId: number; x: number; y: number } | null>(null);
  const lightboxImageRef = React.useRef<HTMLImageElement>(null);

  const resetImageView = useCallback(() => {
    setImageZoom(1);
    setImagePan({ x: 0, y: 0 });
    setImageDrag(null);
  }, []);

  const zoomLightboxImage = useCallback((factor: number) => {
    setImageZoom((current) => {
      const next = clampImageZoom(current * factor);
      if (next <= 1) setImagePan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const setActualImageSize = useCallback(() => {
    const image = lightboxImageRef.current;
    if (!image || image.clientWidth === 0) return;
    setImageZoom(clampImageZoom(image.naturalWidth / image.clientWidth));
    setImagePan({ x: 0, y: 0 });
  }, []);

  React.useEffect(() => {
    resetImageView();
    setImageNaturalSize(null);
  }, [activeImage?.src, resetImageView]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeImage) return;
      if (e.key === 'Escape') {
        setActiveImage(null);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomLightboxImage(IMAGE_ZOOM_STEP);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomLightboxImage(1 / IMAGE_ZOOM_STEP);
      } else if (e.key === '0') {
        e.preventDefault();
        resetImageView();
      } else if (e.key === '1') {
        e.preventDefault();
        setActualImageSize();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeImage, resetImageView, setActiveImage, setActualImageSize, zoomLightboxImage]);

  const imageZoomPercent = Math.round(imageZoom * 100);

  const handleLightboxWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    zoomLightboxImage(event.deltaY < 0 ? IMAGE_ZOOM_STEP : 1 / IMAGE_ZOOM_STEP);
  }, [zoomLightboxImage]);

  const handleLightboxPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (imageZoom <= 1) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setImageDrag({ pointerId: event.pointerId, x: event.clientX, y: event.clientY });
  }, [imageZoom]);

  const handleLightboxPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!imageDrag || imageDrag.pointerId !== event.pointerId) return;
    const dx = event.clientX - imageDrag.x;
    const dy = event.clientY - imageDrag.y;
    setImagePan((current) => ({ x: current.x + dx, y: current.y + dy }));
    setImageDrag({ pointerId: event.pointerId, x: event.clientX, y: event.clientY });
  }, [imageDrag]);

  const handleLightboxPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (imageDrag?.pointerId === event.pointerId) {
      setImageDrag(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }, [imageDrag]);

  return (
    <>
      {activeImage && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 animate-[menu-in_150ms_ease-out]"
          onClick={() => setActiveImage(null)}
        >
          <div
            className={`absolute top-0 left-0 right-0 h-16 flex items-center gap-3 ${isMacOS ? 'pl-[116px]' : 'pl-6'} pr-6 bg-gradient-to-b from-black/60 to-transparent select-none z-10`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0 flex-1">
              <div className="text-white/86 text-[13.5px] font-medium truncate drop-shadow-sm">
                {activeImage.title || '图片预览'}
              </div>
              {imageNaturalSize && (
                <div className="mt-0.5 text-white/42 text-[11px] tabular-nums leading-none">
                  {imageNaturalSize.width} x {imageNaturalSize.height}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-black/40 p-1">
              <button
                type="button"
                onClick={() => zoomLightboxImage(1 / IMAGE_ZOOM_STEP)}
                className="flex h-8 w-8 items-center justify-center rounded-full border-none bg-transparent text-white/76 transition-all duration-150 hover:bg-white/12 hover:text-white active:scale-95 disabled:opacity-35 disabled:cursor-default"
                aria-label="缩小"
                title="缩小"
                disabled={imageZoom <= IMAGE_ZOOM_MIN}
              >
                <IconZoomOut size={15} />
              </button>
              <div className="min-w-[54px] px-1 text-center text-[11px] font-semibold tabular-nums text-white/70">
                {imageZoomPercent}%
              </div>
              <button
                type="button"
                onClick={() => zoomLightboxImage(IMAGE_ZOOM_STEP)}
                className="flex h-8 w-8 items-center justify-center rounded-full border-none bg-transparent text-white/76 transition-all duration-150 hover:bg-white/12 hover:text-white active:scale-95 disabled:opacity-35 disabled:cursor-default"
                aria-label="放大"
                title="放大"
                disabled={imageZoom >= IMAGE_ZOOM_MAX}
              >
                <IconZoomIn size={15} />
              </button>
              <span className="mx-0.5 h-4 w-px bg-white/12" />
              <button
                type="button"
                onClick={resetImageView}
                className="flex h-8 w-8 items-center justify-center rounded-full border-none bg-transparent text-white/76 transition-all duration-150 hover:bg-white/12 hover:text-white active:scale-95"
                aria-label="适应窗口"
                title="适应窗口"
              >
                <IconFitImage size={15} />
              </button>
              <button
                type="button"
                onClick={setActualImageSize}
                className="flex h-8 w-8 items-center justify-center rounded-full border-none bg-transparent text-white/76 transition-all duration-150 hover:bg-white/12 hover:text-white active:scale-95"
                aria-label="原始尺寸"
                title="原始尺寸"
              >
                <IconActualSize size={15} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setActiveImage(null)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/90 transition-all duration-150 hover:bg-white/20 active:scale-95 cursor-pointer focus:outline-none"
              aria-label="关闭预览"
              title="关闭"
            >
              <IconX size={16} />
            </button>
          </div>

          <div
            className={`relative flex h-[calc(100vh-9rem)] w-[calc(100vw-5rem)] items-center justify-center overflow-hidden p-4 ${imageZoom > 1 ? (imageDrag ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'}`}
            onClick={(e) => e.stopPropagation()}
            onWheel={handleLightboxWheel}
            onPointerDown={handleLightboxPointerDown}
            onPointerMove={handleLightboxPointerMove}
            onPointerUp={handleLightboxPointerUp}
            onPointerCancel={handleLightboxPointerUp}
          >
            <img
              ref={lightboxImageRef}
              src={activeImage.src}
              alt={activeImage.title || 'Preview'}
              className="max-w-full max-h-full object-contain rounded-md shadow-2xl select-none will-change-transform [-webkit-user-drag:none]"
              style={{
                userSelect: 'none',
                transform: `translate3d(${imagePan.x}px, ${imagePan.y}px, 0) scale(${imageZoom})`,
                transformOrigin: 'center center',
                transition: imageDrag ? 'none' : 'transform 140ms ease-out',
              }}
              onLoad={(e) => {
                const img = e.currentTarget;
                setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>

          <div
            className="absolute bottom-5 text-white/40 text-[11px] select-none"
            onClick={(e) => e.stopPropagation()}
          >
            点击空白处关闭
          </div>
        </div>
      )}
    </>
  );
};

export default ImageLightboxHost;
