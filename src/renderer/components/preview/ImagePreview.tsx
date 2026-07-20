import React, { memo } from 'react';

interface ImagePreviewProps {
  src: string;
}

const ImagePreview: React.FC<ImagePreviewProps> = memo(({ src }) => {
  return (
    <div className="flex items-center justify-center w-full h-full p-4 bg-[#f5f5f5]">
      <img
        src={src}
        alt="Preview"
        className="max-w-full max-h-full object-contain rounded-md shadow-sm"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    </div>
  );
});

export default ImagePreview;
