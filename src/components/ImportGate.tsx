import { useRef, useState } from "react";
import exifr from "exifr";
import type { ImageData } from "./ImageGrid";

export interface ImportFolder {
  name: string;
  images: ImageData[];
}

interface ImportGateProps {
  onReady: (source: "sample" | "sample-v2" | ImportFolder) => void;
}

const toJpegName = (name: string) => name.replace(/\.[^.]+$/, ".jpeg");

const folderNameFromFiles = (files: File[]): string => {
  for (const f of files) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
    if (rel && rel.includes("/")) return rel.split("/")[0];
  }
  return "Imported Folder";
};

const ImportGate = ({ onReady }: ImportGateProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const allFiles = Array.from(e.target.files ?? []);
    const folderName = folderNameFromFiles(allFiles);
    const files = allFiles
      .filter((f) => f.type === "image/jpeg" || f.type === "image/webp" || /\.(jpg|jpeg|webp)$/i.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 24);

    if (!files.length) return;
    setIsLoading(true);

    const images: ImageData[] = await Promise.all(
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

    setIsLoading(false);
    onReady({ name: folderName, images });
  };

  return (
    <div className="fixed inset-0 bg-[#141414] flex flex-col items-center justify-center gap-10">
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex flex-row"><span className="text-[24px] font-semibold text-[#e8e8e8] ">after</span><span className="text-[24px] font-noral text-[#e8e8e8] ">shoot</span></div>
        <span className="text-[14px] text-[#666]">Choose how to load your album</span>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-[#444] border-t-[#ababab] animate-spin" />
          <span className="text-[13px] text-[#ababab]">Loading images…</span>
        </div>
      ) : (
        <div className="flex gap-4">
          {/* Upload option — temporarily disabled.
          <button
            onClick={() => inputRef.current?.click()}
            className="group flex flex-col items-center gap-4 w-[268px] py-12 px-8 rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] hover:border-[#444] hover:bg-[#222] transition-colors cursor-pointer"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[#ababab] transition-colors">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <div className="flex flex-col gap-1 text-center">
              <span className="text-[18px] font-medium text-[#d8d8d8]">Upload Folder</span>
              <span className="text-[16px] text-[#555] group-hover:text-[#777] transition-colors">First 24 Images from folder</span>
            </div>
          </button>
          */}

          {/* Option 1 — sample album, original behavior. */}
          <button
            onClick={() => onReady("sample")}
            className="group flex flex-col items-center gap-4 w-[268px] py-12 px-8 rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] hover:border-[#444] hover:bg-[#222] transition-colors cursor-pointer"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[#ababab] transition-colors">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <div className="flex flex-col gap-1 text-center">
              <span className="text-[18px] font-medium text-[#d8d8d8]">Option 1</span>
              <span className="text-[16px] text-[#555] group-hover:text-[#777] transition-colors">Juliana Wedding</span>
            </div>
          </button>

          {/* Option 2 — sample album, inline album-scan in the loupe patch tab. */}
          <button
            onClick={() => onReady("sample-v2")}
            className="group flex flex-col items-center gap-4 w-[268px] py-12 px-8 rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] hover:border-[#444] hover:bg-[#222] transition-colors cursor-pointer"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[#ababab] transition-colors">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <div className="flex flex-col gap-1 text-center">
              <span className="text-[18px] font-medium text-[#d8d8d8]">Option 2</span>
              <span className="text-[16px] text-[#555] group-hover:text-[#777] transition-colors">Juliana Wedding</span>
            </div>
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleInputChange}
        accept=".jpg,.jpeg,.webp"
        multiple
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        webkitdirectory=""
        directory=""
      />
    </div>
  );
};

export default ImportGate;
