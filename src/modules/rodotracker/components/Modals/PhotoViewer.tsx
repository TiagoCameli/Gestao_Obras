import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface PhotoViewerProps {
  photos: string[];
  index: number;
  onChangeIndex: (index: number) => void;
  onClose: () => void;
}

export function PhotoViewer({ photos, index, onChangeIndex, onClose }: PhotoViewerProps) {
  const total = photos.length;
  const hasPrev = index > 0;
  const hasNext = index < total - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onChangeIndex(index - 1);
  }, [hasPrev, index, onChangeIndex]);

  const goNext = useCallback(() => {
    if (hasNext) onChangeIndex(index + 1);
  }, [hasNext, index, onChangeIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goPrev, goNext]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center animate-fadeIn"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10"
      >
        <X className="h-8 w-8" />
      </button>

      {/* Counter */}
      {total > 1 && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/50 text-sm font-mono z-10">
          {index + 1} / {total}
        </div>
      )}

      {/* Previous */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white/70 hover:text-white rounded-full p-3 transition-all z-10"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Next */}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white/70 hover:text-white rounded-full p-3 transition-all z-10"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Image */}
      <img
        src={photos[index]}
        alt={`Foto ${index + 1}`}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
