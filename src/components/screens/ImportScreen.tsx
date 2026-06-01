import { useRef, useState, useCallback } from "react";
import exifr from "exifr";
import {
  UploadSimpleIcon,
  FolderOpenIcon,
  CameraIcon,
  HouseSimpleIcon,
  GridFourIcon,
  MonitorIcon,
  PlusIcon,
  ImageIcon,
  CaretDownIcon,
} from "@phosphor-icons/react";
import ImageGrid from "@/components/ImageGrid";
import type { ImageData } from "@/components/ImageGrid";
import type { ImportFolder } from "@/components/ImportGate";
import BottomBar from "@/components/BottomBar";
import LoupeView from "@/components/LoupeView";
import PreCullRightPanel from "./PreCullRightPanel";
import { Toggle } from "@/components/RightPanel/RetouchingPanel/tethering/Toggle";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { useDistractionDetection } from "@/hooks/useDistractionDetection";

interface ImportScreenProps {
  onReady: (folder: ImportFolder, initialTopTab?: string) => void;
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
  const [folder, setFolder] = useState<ImportFolder | null>(null);
  const [view, setView] = useState<"grid" | "loupe">("grid");
  const [columns, setColumns] = useState(4);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const [formatType, setFormatType] = useState<"raw" | "jpeg">("raw");
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  const [ingestBackup, setIngestBackup] = useState(false);
  const [helpImprove, setHelpImprove] = useState(true);

  // Kick off models as soon as a folder is loaded so they're ready for Cull
  const images: ImageData[] = folder?.images ?? [];
  useFaceDetection(images);
  useDistractionDetection(images);

  const handleFiles = useCallback(async (files: File[]) => {
    setError(null);
    setIsLoading(true);
    const result = await processFiles(files);
    setIsLoading(false);
    if (!result) {
      setError("No supported images found. Drop a folder with JPG or WebP files.");
      return;
    }
    setFolder(result);
    setSelectedIndex(0);
  }, []);

  const handleAddFiles = useCallback(async (files: File[]) => {
    const added = await processFiles(files);
    if (!added) return;
    setFolder((prev) => (prev ? { ...prev, images: [...prev.images, ...added.images] } : added));
  }, []);

  const handleCull = () => {
    if (folder) onReady(folder, "CULL");
  };

  const handleEdit = () => {
    if (folder) onReady(folder, "EDIT");
  };

  const handleRetouch = () => {
    if (folder) onReady(folder, "RETOUCH");
  };

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

    if (files.length) {
      if (folder) handleAddFiles(files);
      else handleFiles(files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) handleFiles(files);
    e.target.value = "";
  };

  const handleAddInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) handleAddFiles(files);
    e.target.value = "";
  };

  if (folder) {
    return (
      <div
        className="h-screen bg-[#111] flex flex-col select-none"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Minimal top bar: Home + Grid/Loupe + Add Images */}
        <header className="flex items-center h-11 px-3 bg-[#1c1c1c] shrink-0 border-b border-background gap-2.5">
          <button
            onClick={onBack}
            className="flex items-center justify-center w-6 h-6 rounded transition-colors hover:bg-white/5"
          >
            <HouseSimpleIcon weight="fill" className="w-4 h-4 text-[#777] hover:text-[#fff]" />
          </button>

          <div className="w-px h-4 bg-[#303030]" />

          <div className="flex items-center gap-1">
            <button
              onClick={() => setView("grid")}
              className={`flex items-center justify-center w-6 h-6 rounded transition-colors ${view === "grid" ? "bg-white/10 border border-[#5e5e5e]" : "hover:bg-white/5"}`}
            >
              <GridFourIcon
                weight="fill"
                className={`w-4 h-4 ${view === "grid" ? "text-[#e2e2e2]" : "text-[#777]"}`}
              />
            </button>
            <button
              onClick={() => setView("loupe")}
              className={`flex items-center justify-center w-6 h-6 rounded transition-colors ${view === "loupe" ? "bg-white/10 border border-[#5e5e5e]" : "hover:bg-white/5"}`}
            >
              <MonitorIcon
                weight="fill"
                className={`w-4 h-4 ${view === "loupe" ? "text-[#e2e2e2]" : "text-[#777]"}`}
              />
            </button>
          </div>

          <div className="w-px h-4 bg-[#303030]" />

          <button
            onClick={() => addInputRef.current?.click()}
            className="flex items-center gap-1 text-[#ababab] text-[12px] font-medium hover:text-[#e2e2e2] transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add Images</span>
          </button>
        </header>

        {/* Body: grid/loupe + right panel */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-col flex-1 overflow-hidden">
            {view === "grid" ? (
              <ImageGrid
                images={folder.images}
                columns={columns}
                isScanning={false}
                onImageDoubleClick={(i) => {
                  setSelectedIndex(i);
                  setView("loupe");
                }}
                onImagesChange={(imgs) =>
                  setFolder((prev) => (prev ? { ...prev, images: imgs } : prev))
                }
                initialSelectedIndex={selectedIndex}
              />
            ) : (
              folder.images[selectedIndex] && (
                <LoupeView
                  image={folder.images[selectedIndex]}
                  images={folder.images}
                  currentIndex={selectedIndex}
                  totalImages={folder.images.length}
                  onSelectImage={setSelectedIndex}
                  onGoToGrid={() => setView("grid")}
                />
              )
            )}
            {view === "grid" && (
              <BottomBar
                mode="grid"
                columns={columns}
                onColumnsChange={setColumns}
                totalPhotos={folder.images.length}
                visiblePhotos={folder.images.length}
                albumName={folder.name}
              />
            )}
          </div>
          <PreCullRightPanel
            onCull={handleCull}
            onRetouch={handleRetouch}
            onEdit={handleEdit}
            onOneClickCullEdit={handleCull}
          />
        </div>

        <input
          ref={addInputRef}
          type="file"
          className="hidden"
          onChange={handleAddInputChange}
          accept=".jpg,.jpeg,.webp"
          multiple
        />
      </div>
    );
  }

  return (
    <div
      className="h-screen bg-[#111] flex flex-col select-none"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Title bar */}
      <header className="flex items-center h-11 px-3 bg-[#1c1c1c] shrink-0 border-b border-[#222]">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-6 h-6 rounded transition-colors hover:bg-white/5"
        >
          <HouseSimpleIcon weight="fill" className="w-4 h-4 text-[#555] hover:text-[#ccc]" />
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: drop area ── */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-7 h-7 rounded-full border-2 border-[#2a2a2a] border-t-[#777] animate-spin" />
              <p className="text-[#555] text-[13px]">Loading images…</p>
            </div>
          ) : isDragging ? (
            <div className="w-full max-w-[480px] h-48 rounded-2xl border-2 border-dashed border-blue-500/40 bg-blue-500/[0.03] flex flex-col items-center justify-center gap-3">
              <FolderOpenIcon size={32} className="text-blue-400/70" weight="light" />
              <p className="text-blue-300/80 text-[13px] font-medium">Release to import</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex flex-col items-center gap-0.5 text-center">
                <p className="text-[#888] text-[13px]">Click to import folder(s)</p>
                <p className="text-[#888] text-[13px]">or Drag and Drop them here</p>
              </div>

              {/* Two cards */}
              <div className="flex flex-col gap-3 w-full max-w-[480px]">
                {/* RAW / JPEG / TIFF */}
                <button
                  onClick={() => inputRef.current?.click()}
                  className="group w-full flex flex-col items-center gap-3 py-7 px-6 rounded-2xl border border-[#252525] bg-[#181818] hover:border-[#333] hover:bg-[#1b1b1b] transition-all duration-200 cursor-pointer"
                >
                  <ImageIcon
                    weight="light"
                    size={26}
                    className="text-[#555] group-hover:text-[#777] transition-colors"
                  />
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[#bbb] text-[14px] font-semibold">
                        RAW / JPEG / TIFF
                      </span>
                      <span className="text-[9px] font-semibold tracking-widest uppercase text-[#555] border border-[#2a2a2a] px-2 py-0.5 rounded">
                        Cull, Edit, &amp; Retouch
                      </span>
                    </div>
                    <p className="text-[#555] text-[12px]">Recommended for better experience</p>
                  </div>
                </button>

                {/* Lr / C1 Catalog */}
                <button className="group w-full flex flex-col items-center gap-3 py-7 px-6 rounded-2xl border border-[#252525] bg-[#181818] hover:border-[#333] hover:bg-[#1b1b1b] transition-all duration-200 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-md flex items-center justify-center bg-[#1c2b40] text-[#4a85c8] text-[9px] font-bold tracking-tight">
                      Lr
                    </span>
                    <span className="text-[#383838] text-[13px]">/</span>
                    <span className="w-8 h-8 rounded-md flex items-center justify-center bg-[#28221a] text-[#c8913a] text-[9px] font-bold tracking-tight">
                      C1
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#bbb] text-[14px] font-semibold group-hover:text-[#d4d4d4] transition-colors">
                      Lr / C1 Catalog
                    </span>
                    <span className="text-[9px] font-semibold tracking-widest uppercase text-[#555] border border-[#2a2a2a] px-2 py-0.5 rounded">
                      Edits only
                    </span>
                  </div>
                </button>
              </div>

              {/* Explanation */}
              <div className="flex flex-col items-center gap-1 text-center max-w-[420px]">
                <p className="text-[#444] text-[11px] leading-relaxed">
                  RAW, JPEG, and TIFF files support all features – culling, editing, retouching, and
                  previewing results.
                </p>
                <p className="text-[#444] text-[11px] leading-relaxed">
                  Lr/C1 Catalogs support edits only and must be previewed in Lightroom or Capture
                  One.
                </p>
              </div>

              {/* Tethered */}
              <button
                onClick={() => onStartTethering?.()}
                className="flex items-center gap-1.5 text-blue-500 hover:text-blue-400 transition-colors"
              >
                <CameraIcon size={13} />
                <span className="text-[12px] font-medium">Tethered Shooting</span>
              </button>

              {error && (
                <p className="text-red-400/80 text-[11px] text-center bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {/* ── Right: settings panel ── */}
        <div className="w-[300px] shrink-0 border-l border-[#1e1e1e] bg-[#131313] flex flex-col overflow-y-auto">
          <div className="px-5 pt-5 pb-4 border-b border-[#1e1e1e]">
            <p className="text-[#888] text-[11px] font-semibold tracking-widest uppercase">
              Import Settings
            </p>
          </div>

          <div className="flex flex-col gap-6 px-5 py-5">
            {/* File type */}
            <div className="flex flex-col gap-2">
              <label className="text-[#555] text-[11px] font-medium tracking-wide uppercase">
                File type
              </label>
              <div className="flex rounded-lg border border-[#222] overflow-hidden">
                {(["raw", "jpeg"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFormatType(t)}
                    className={`flex-1 py-1.5 text-[12px] font-medium transition-colors ${
                      formatType === t
                        ? "bg-[#242424] text-[#d4d4d4]"
                        : "bg-transparent text-[#444] hover:text-[#666]"
                    }`}
                  >
                    {t === "raw" ? "RAW" : "JPEG / TIFF"}
                  </button>
                ))}
              </div>
            </div>

            {/* Include sub-folders */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#bbb] text-[13px]">Include sub-folders</p>
              </div>
              <div className="relative">
                <select
                  value={includeSubfolders ? "yes" : "no"}
                  onChange={(e) => setIncludeSubfolders(e.target.value === "yes")}
                  className="appearance-none bg-[#1c1c1c] border border-[#272727] rounded-md pl-3 pr-7 py-1.5 text-[#aaa] text-[12px] cursor-pointer focus:outline-none focus:border-[#333]"
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                <CaretDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#555] pointer-events-none" />
              </div>
            </div>

            <div className="h-px bg-[#1e1e1e]" />

            {/* Ingest & backup */}
            <div className="flex flex-col gap-3">
              <p className="text-[#555] text-[11px] font-medium tracking-wide uppercase">Ingest</p>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[#bbb] text-[13px]">Ingest &amp; backup photos</p>
                  <p className="text-[#444] text-[11px] mt-0.5 leading-relaxed">
                    Copy from memory card before processing
                  </p>
                </div>
                <div className="mt-0.5">
                  <Toggle value={ingestBackup} onChange={setIngestBackup} />
                </div>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[#bbb] text-[13px]">Help improve AI</p>
                  <p className="text-[#444] text-[11px] mt-0.5 leading-relaxed">
                    Share image data to improve results
                  </p>
                </div>
                <div className="mt-0.5">
                  <Toggle value={helpImprove} onChange={setHelpImprove} />
                </div>
              </div>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Bottom actions */}
          <div className="px-4 py-4 border-t border-[#1e1e1e] flex gap-2">
            <button className="flex-1 py-2 rounded-lg border border-[#252525] text-[#666] text-[12px] font-medium hover:border-[#333] hover:text-[#888] transition-colors">
              Recent
            </button>
            <button
              onClick={() => inputRef.current?.click()}
              className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-medium transition-colors"
            >
              Browse
            </button>
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
