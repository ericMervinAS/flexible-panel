import { useRef, useState, useCallback } from "react";
import exifr from "exifr";
import { UploadSimpleIcon, FolderOpenIcon, CameraIcon, HouseSimpleIcon } from "@phosphor-icons/react";
import type { ImageData } from "@/components/ImageGrid";
import type { ImportFolder } from "@/components/ImportGate";

interface ImportScreenProps {
  onReady: (folder: ImportFolder) => void;
  onBack: () => void;
  onStartTethering?: () => void;
}

const toJpegName = (name: string) => name.replace(/\.[^.]+$/, ".jpeg");

const folderNameFromFiles = (files: File[]): string => {
  for (const f of files) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
    if (rel && rel.includes("/")) return rel.split("/")[0];
  }
  return "Imported Folder";
};

const collectFilesFromDirectory = (
  entry: FileSystemDirectoryEntry,
  results: File[]
): Promise<void> =>
  new Promise((resolve) => {
    const reader = entry.createReader();
    const readBatch = () => {
      reader.readEntries(
        async (entries) => {
          if (!entries.length) {
            resolve();
            return;
          }
          for (const e of entries) {
            if (e.isFile) {
              await new Promise<void>((res) => {
                (e as FileSystemFileEntry).file(
                  (f) => {
                    results.push(f);
                    res();
                  },
                  () => res()
                );
              });
            } else if (e.isDirectory) {
              await collectFilesFromDirectory(e as FileSystemDirectoryEntry, results);
            }
          }
          readBatch();
        },
        () => resolve()
      );
    };
    readBatch();
  });

const processFiles = async (allFiles: File[]): Promise<ImportFolder | null> => {
  const folderName = folderNameFromFiles(allFiles);
  const files = allFiles
    .filter(
      (f) =>
        f.type === "image/jpeg" || f.type === "image/webp" || /\.(jpg|jpeg|webp)$/i.test(f.name)
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 24);

  if (!files.length) return null;

  const images: ImageData[] = await Promise.all(
    files.map(async (file): Promise<ImageData> => {
      const src = URL.createObjectURL(file);
      let stars = 0;
      try {
        const meta = await exifr.parse(file, { xmp: true });
        if (typeof meta?.Rating === "number") {
          stars = Math.min(5, Math.max(0, Math.round(meta.Rating)));
        }
      } catch {
        /* no metadata */
      }
      return { src, filename: toJpegName(file.name), stars, colorTag: "none" };
    })
  );

  return { name: folderName, images };
};

const ImportScreen = ({ onReady, onBack, onStartTethering }: ImportScreenProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleFiles = useCallback(
    async (files: File[]) => {
      setError(null);
      setIsLoading(true);
      const result = await processFiles(files);
      setIsLoading(false);
      if (!result) {
        setError("No supported images found. Drop a folder with JPG or WebP files.");
        return;
      }
      onReady(result);
    },
    [onReady]
  );

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);

    const files: File[] = [];
    for (const item of Array.from(e.dataTransfer.items)) {
      if (item.kind !== "file") continue;
      const entry = item.webkitGetAsEntry?.();
      if (entry?.isDirectory) {
        await collectFilesFromDirectory(entry as FileSystemDirectoryEntry, files);
      } else {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length) handleFiles(files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) handleFiles(files);
  };

  return (
    <div
      className="h-screen bg-[#111] flex flex-col select-none"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Minimal title bar — Home only */}
      <header className="flex items-center h-11 px-3 bg-[#1c1c1c] shrink-0 border-b border-background">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-6 h-6 rounded transition-colors hover:bg-white/5"
        >
          <HouseSimpleIcon weight="fill" className="w-4 h-4 text-[#777] hover:text-[#fff]" />
        </button>
      </header>

      {/* Two-option layout */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
        {/* Import Folder card */}
        <div
          onClick={() => !isLoading && inputRef.current?.click()}
          className={`
            flex-1 h-full w-full rounded-2xl border flex flex-col items-center justify-center gap-6 transition-all duration-200
            ${isLoading ? "cursor-default" : "cursor-pointer"}
            ${
              isDragging
                ? "border-blue-500 bg-blue-500/[0.04]"
                : "border-[#2a2a2a] bg-[#161616] hover:border-[#3a3a3a] hover:bg-[#181818]"
            }
          `}
        >
          {isLoading ? (
            <>
              <div className="w-10 h-10 rounded-full border-2 border-[#333] border-t-[#ababab] animate-spin" />
              <p className="text-[#ababab] text-sm font-medium">Loading images…</p>
            </>
          ) : isDragging ? (
            <>
              <div className="w-20 h-20 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <FolderOpenIcon size={40} className="text-blue-400" weight="light" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-blue-300 text-lg font-semibold">Drop to import</p>
                <p className="text-blue-400/60 text-sm">Release to load your images</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-xl bg-[#1e1e1e] flex items-center justify-center">
                <UploadSimpleIcon size={36} className="text-[#4a4a4a]" weight="light" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-[#e2e2e2] text-lg font-semibold">Import Folder</p>
                <p className="text-[#4a4a4a] text-sm">Drop a folder or click to browse</p>
              </div>
              {error && (
                <p className="text-red-400 text-xs text-center max-w-xs bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">
                  {error}
                </p>
              )}
              <div className="flex items-center gap-3">
                <div className="h-px w-16 bg-[#232323]" />
                <span className="text-[11px] text-[#383838] tracking-wide uppercase">
                  JPG · WebP
                </span>
                <div className="h-px w-16 bg-[#232323]" />
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        {/* <div className="flex flex-rows items-center gap-3 shrink-0">
          <div className="h-px w-16 bg-[#232323]" />
          <span className="text-[11px] text-[#383838] tracking-wide uppercase">or</span>
          <div className="h-px w-16 bg-[#232323]" />
        </div> */}

        {/* Tethered Shooting card */}
        <div
          onClick={() => onStartTethering?.()}
          className="shrink-0 w-full rounded-2xl border border-[#2a2a2a] bg-[#161616] flex flex-col items-center justify-center gap-6 cursor-pointer hover:border-[#3a3a3a] hover:bg-[#181818] transition-all duration-200 py-8"
        >
          <div className="w-20 h-20 rounded-xl bg-[#1e1e1e] flex items-center justify-center">
            <CameraIcon size={36} className="text-[#4a4a4a]" weight="light" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-[#e2e2e2] text-lg font-semibold">Tethered Shooting</p>
            <p className="text-[#4a4a4a] text-sm">Connect a camera to shoot live</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-px w-16 bg-[#232323]" />
            <span className="text-[11px] text-[#383838] tracking-wide uppercase">USB · Wi-Fi</span>
            <div className="h-px w-16 bg-[#232323]" />
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleInputChange}
        accept=".jpg,.jpeg,.webp"
        multiple
        // @ts-ignore
        webkitdirectory=""
        directory=""
      />
    </div>
  );
};

export default ImportScreen;
