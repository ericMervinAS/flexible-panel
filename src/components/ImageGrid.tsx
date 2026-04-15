import { useState, useCallback, useEffect } from "react";
import exifr from "exifr";
import ImageTile from "./ImageTile";

export type ColorTag = "green" | "yellow" | "red" | "none";

export interface ImageData {
  src: string;
  filename: string;
  stars: number;
  colorTag: ColorTag;
}

const sampleModules = import.meta.glob(
  "../assets/samples/*.webp",
  { eager: true }
) as Record<string, { default: string }>;

const toJpegName = (name: string) => name.replace(/\.[^.]+$/, ".jpeg");

const sampleImages: ImageData[] = Object.entries(sampleModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, mod]) => ({
    src: mod.default,
    filename: toJpegName(path.split("/").pop() ?? path),
    stars: 0,
    colorTag: "none" as ColorTag,
  }));

interface ImageGridProps {
  columns: number;
  isScanning: boolean;
  onImageDoubleClick: (index: number) => void;
  onImagesChange?: (images: ImageData[]) => void;
}

const ImageGrid = ({ columns, isScanning, onImageDoubleClick, onImagesChange }: ImageGridProps) => {
  const [allImages, setAllImages] = useState<ImageData[]>(sampleImages);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  useEffect(() => {
    onImagesChange?.(allImages);
  }, [allImages, onImagesChange]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "image/jpeg" || /\.(jpg|jpeg)$/i.test(f.name)
    );
    if (!files.length) return;
    const newImages = await Promise.all(
      files.map(async (file): Promise<ImageData> => {
        const src = URL.createObjectURL(file);
        let stars = 0;
        try {
          const meta = await exifr.parse(file, { xmp: true });
          if (typeof meta?.Rating === "number") {
            stars = Math.min(5, Math.max(0, Math.round(meta.Rating)));
          }
        } catch { /* no metadata */ }
        return { src, filename: toJpegName(file.name), stars, colorTag: "none" };
      })
    );
    setAllImages((prev) => [...prev, ...newImages]);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const rangeSet = (a: number, b: number): Set<number> => {
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    return new Set(Array.from({ length: hi - lo + 1 }, (_, k) => lo + k));
  };

  const handleClick = (index: number, e: React.MouseEvent) => {
    if (e.shiftKey && anchorIndex !== null) {
      setSelectedIndices(rangeSet(anchorIndex, index));
      setFocusIndex(index);
    } else if (e.metaKey || e.ctrlKey) {
      setSelectedIndices((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index); else next.add(index);
        return next;
      });
      setAnchorIndex((prev) => (prev === null ? index : prev));
      setFocusIndex(index);
    } else {
      setSelectedIndices(new Set([index]));
      setAnchorIndex(index);
      setFocusIndex(index);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const total = allImages.length;

    if (e.key === "Enter") {
      if (anchorIndex !== null) onImageDoubleClick(anchorIndex);
      return;
    }

    const cur = focusIndex ?? 0;
    let next: number;
    if (e.key === "ArrowRight") next = Math.min(cur + 1, total - 1);
    else if (e.key === "ArrowLeft") next = Math.max(cur - 1, 0);
    else if (e.key === "ArrowDown") next = Math.min(cur + columns, total - 1);
    else if (e.key === "ArrowUp") next = Math.max(cur - columns, 0);
    else return;

    e.preventDefault();

    if (e.shiftKey && anchorIndex !== null) {
      setSelectedIndices(rangeSet(anchorIndex, next));
      setFocusIndex(next);
    } else {
      setSelectedIndices(new Set([next]));
      setAnchorIndex(next);
      setFocusIndex(next);
    }
  };

  const isMultiSelected = selectedIndices.size > 1;

  return (
    <div
      className="relative flex-1 min-h-0 flex flex-col overflow-hidden"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div
        tabIndex={0}
        className="grid gap-px flex-1 overflow-y-auto content-start outline-none select-none"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, contain: "layout style" }}
        onKeyDown={handleKeyDown}
      >
        {allImages.map((img, i) => (
          <ImageTile
            key={i}
            src={img.src}
            filename={img.filename}
            isScanning={isScanning}
            isSelected={selectedIndices.has(i)}
            isPrimary={i === anchorIndex && isMultiSelected}
            onClick={(e) => handleClick(i, e)}
            onDoubleClick={() => onImageDoubleClick(i)}
          />
        ))}
      </div>

      {isDragOver && (
        <div className="absolute inset-0 z-10 pointer-events-none border-2 border-dashed border-[#777] bg-[#1c1c1c]/70 flex items-center justify-center">
          <span className="text-[14px] text-[#ababab]">Drop JPEGs here</span>
        </div>
      )}
    </div>
  );
};

export default ImageGrid;
