import { useRef, useState } from "react";
import exifr from "exifr";
import {
  HouseIcon,
  MagicWandIcon,
  StorefrontIcon,
  BellSimpleIcon,
  ChatCircleDotsIcon,
  GearSixIcon,
  UserCircleIcon,
  ScissorsIcon,
  PaintBrushIcon,
  UploadSimpleIcon,
  FrameCornersIcon,
  PlusIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import type { ImageData } from "./ImageGrid";
import type { ImportFolder } from "./ImportGate";

interface HomePageProps {
  onReady: (source: "sample" | "tethering" | ImportFolder) => void;
}

import heroPortrait from "../assets/UI/home-hero-portrait.png";
import tetheringPortrait from "../assets/UI/home-tethering-portrait.png";
import logoImg from "../assets/UI/logo.png";
import userImg from "../assets/UI/user.png";

const toJpegName = (name: string) => name.replace(/\.[^.]+$/, ".jpeg");

const folderNameFromFiles = (files: File[]): string => {
  for (const f of files) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
    if (rel && rel.includes("/")) return rel.split("/")[0];
  }
  return "Imported Folder";
};

type Album = {
  id: string;
  name: string;
  imageCount: number;
  coverSrc?: string;
  source: ImportFolder | "sample" | "tethering";
};

const SAMPLE_ALBUM: Album = {
  id: "sample",
  name: "Juliana Wedding",
  imageCount: 24,
  source: "sample",
};

function AlbumCard({ album, onOpen }: { album: Album; onOpen: () => void }) {
  return (
    <div className="flex flex-col w-[257px] shrink-0">
      <div className="h-[190px] bg-[#242424] rounded-lg overflow-hidden relative flex flex-col justify-between">
        {album.coverSrc && (
          <img
            src={album.coverSrc}
            className="absolute inset-0 w-full h-full object-cover"
            alt=""
          />
        )}
        <div className="p-2 relative z-10" />
        <div className="flex items-end justify-between p-1 relative z-10">
          <div className="flex gap-1">
            <div className="w-6 h-6 bg-[rgba(17,17,17,0.85)] border-[0.5px] border-[#474747] rounded flex items-center justify-center backdrop-blur-sm">
              <ScissorsIcon size={16} className="text-[#e2e2e2]" weight="fill" />
            </div>
            <div className="w-6 h-6 bg-[rgba(17,17,17,0.85)] border-[0.5px] border-[#474747] rounded flex items-center justify-center backdrop-blur-sm">
              <PaintBrushIcon size={16} className="text-[#e2e2e2]" weight="fill" />
            </div>
            <div className="w-6 h-6 bg-[rgba(17,17,17,0.85)] border-[0.5px] border-[#474747] rounded flex items-center justify-center backdrop-blur-sm">
              <SparkleIcon size={16} className="text-[#e2e2e2]" weight="fill" />
            </div>
            <div className="w-6 h-6 bg-[rgba(17,17,17,0.85)] border-[0.5px] border-[#474747] rounded flex items-center justify-center backdrop-blur-sm">
              <UploadSimpleIcon size={16} className="text-[#e2e2e2]" weight="fill" />
            </div>
            <div className="w-6 h-6 bg-[rgba(17,17,17,0.85)] border-[0.5px] border-[#474747] rounded flex items-center justify-center backdrop-blur-sm">
              <FrameCornersIcon size={16} className="text-[#e2e2e2]" weight="fill" />
            </div>
          </div>
        </div>
      </div>
      <div className="pt-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-[#e2e2e2] text-sm font-medium leading-5 truncate">{album.name}</p>
            <p className="text-[#ababab] text-xs font-medium">{album.imageCount} Images</p>
          </div>
          <button
            onClick={onOpen}
            className="bg-[#303030] text-[#e2e2e2] text-xs font-medium px-3 py-2 rounded shrink-0 ml-3 hover:bg-[#3a3a3a] transition-colors"
          >
            Cull Now
          </button>
        </div>
      </div>
    </div>
  );
}

const HomePage = ({ onReady }: HomePageProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [albums, setAlbums] = useState<Album[]>([SAMPLE_ALBUM]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartTethering = () => {
    const newAlbum: Album = {
      id: `tether-${Date.now()}`,
      name: "Tethered Shoot",
      imageCount: 0,
      source: "tethering",
    };
    setAlbums((prev) => [...prev, newAlbum]);
    onReady("tethering");
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const allFiles = Array.from(e.target.files ?? []);
    const folderName = folderNameFromFiles(allFiles);
    const files = allFiles
      .filter(
        (f) =>
          f.type === "image/jpeg" || f.type === "image/webp" || /\.(jpg|jpeg|webp)$/i.test(f.name)
      )
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
        } catch {
          /* no metadata */
        }
        return { src, filename: toJpegName(file.name), stars, colorTag: "none" };
      })
    );

    setIsLoading(false);
    onReady({ name: folderName, images });
  };

  return (
    <div className="h-screen bg-[#111] flex flex-col overflow-hidden">
      {/* Title Bar */}
      <div className="h-8 bg-[#1c1c1c] flex items-center justify-between shrink-0">
        {/* Left */}
        <div className="flex items-center h-full">
          {/* macOS traffic lights */}
          <div className="flex items-center gap-[7px] px-[10px]">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          {/* Logo + PRO chip */}
          <div className="flex items-center gap-1 px-1">
            <div className="w-6 h-6 flex items-center justify-center">
              <img src={logoImg} className="w-full h-full object-contain" alt="Aftershoot" />
            </div>
            <div className="bg-[rgba(224,198,9,0.1)] border border-[#e0c609] text-[8px] font-semibold text-white tracking-[0.32px] uppercase px-1.5 py-0.5 rounded-[2px] leading-none">
              PRO
            </div>
          </div>
          {/* Divider */}
          <div className="w-px h-4 bg-[#303030] mx-4" />
          {/* Nav links */}
          <nav className="flex items-center gap-4">
            <button className="flex items-center gap-1 text-[#ababab] text-xs font-medium hover:text-[#e2e2e2] transition-colors">
              <HouseIcon size={16} />
              <span>Home</span>
            </button>
            <button className="flex items-center gap-1 text-[#ababab] text-xs font-medium hover:text-[#e2e2e2] transition-colors">
              <MagicWandIcon size={16} />
              <span>AI Profiles</span>
            </button>
            <button className="flex items-center gap-1 text-[#ababab] text-xs font-medium hover:text-[#e2e2e2] transition-colors">
              <StorefrontIcon size={16} />
              <span>Marketplace</span>
            </button>
          </nav>
        </div>
        {/* Right icon buttons */}
        <div className="flex items-center gap-3 pr-[23px]">
          <div className="relative">
            <button className="w-6 h-6 flex items-center justify-center rounded text-[#ababab] hover:text-[#ffffff] transition-colors">
              <BellSimpleIcon size={16} className="" />
            </button>
            <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-blue-500 pointer-events-none" />
          </div>
          <button className="w-6 h-6 flex items-center justify-center rounded text-[#ababab] hover:text-[#ffffff] transition-colors">
            <ChatCircleDotsIcon size={16} className="" />
          </button>
          <button className="w-6 h-6 flex items-center justify-center rounded text-[#ababab] hover:text-[#ffffff] transition-colors">
            <GearSixIcon size={16} className="" />
          </button>
          <button className="w-6 h-6 flex items-center justify-center rounded text-[#ababab] hover:text-[#ffffff] transition-colors">
            <UserCircleIcon size={16} className="" />
          </button>
          <button className="w-6 h-6 flex items-center justify-center rounded">
            <img src={userImg} className="w-4 h-4 rounded-full object-cover" alt="User" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left content */}
        <div className="flex-1 flex flex-col gap-5 pl-[30px] py-6 overflow-y-auto min-w-0">
          {/* Hero "Create a new album" card */}
          <div
            className="w-[380px] h-[144px] rounded-[9.6px] overflow-hidden relative shrink-0"
            style={{
              backgroundImage: `linear-gradient(to right, #1c1c1c 40%, transparent 75%), url(${heroPortrait})`,
              backgroundSize: "cover",
              backgroundPosition: "center top",
            }}
          >
            {/* Left content */}
            <div className="absolute inset-0 flex flex-col justify-center px-4 py-3 w-[240px]">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <p className="text-white text-base font-semibold leading-5">Create a new album</p>
                  <p className="text-[#ababab] text-xs leading-4">
                    Smart Selections. Effortless Editing. AI-precise Retouching
                  </p>
                </div>
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={isLoading}
                  className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-medium px-3 py-2 rounded w-fit h-8 transition-colors"
                >
                  <PlusIcon size={16} />
                  {isLoading ? "Loading…" : "Create Album"}
                </button>
              </div>
            </div>
          </div>

          {/* My Albums heading */}
          <p className="text-white text-lg shrink-0" style={{ fontFamily: "Archivo, sans-serif" }}>
            My albums <span className="text-[#ababab]">({albums.length})</span>
          </p>

          {/* Albums grid */}
          <div className="flex gap-5 flex-wrap">
            {albums.map((album) => (
              <AlbumCard key={album.id} album={album} onOpen={() => onReady(album.source)} />
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-[361px] border-l border-[#1c1c1c] flex flex-col gap-2 p-2 overflow-y-auto shrink-0">
          {/* Tethering promo card */}
          <div
            className="rounded-[4px] px-5 relative overflow-hidden shrink-0 flex items-center"
            style={{
              minHeight: "160px",
              backgroundImage: `url(${tetheringPortrait})`,
              backgroundSize: "cover",
              backgroundPosition: "right top",
            }}
          >
            <div className="relative z-10 flex flex-col gap-4 w-[230px]">
              <div className="flex flex-col gap-0.5">
                <p className="text-white text-sm leading-5">Tethering just launched!</p>
                <p className="text-[#ababab] text-xs leading-4">
                  Your workflow just got a whole lot smoother and faster
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleStartTethering}
                  className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors"
                >
                  Try Now
                </button>
              </div>
            </div>
          </div>

          {/* You & Aftershoot stats card */}
          <div className="bg-[#1c1c1c] rounded-[4px] p-5 flex flex-col gap-6 shrink-0">
            <div className="flex flex-col gap-1.5">
              <p className="text-white text-base font-semibold leading-5">You &amp; Aftershoot</p>
              <p className="text-[#ababab] text-xs leading-4">
                Look at all the time you won back while using Aftershoot!
              </p>
            </div>

            <div
              className="grid gap-y-5"
              style={{ gridTemplateColumns: "repeat(2, fit-content(100%))", columnGap: "54px" }}
            >
              <div className="col-span-2 flex flex-col gap-1">
                <p className="text-white text-base font-semibold leading-5">1 day and 11 hrs</p>
                <p className="text-[#ababab] text-[10px] font-medium leading-3">Time Saved</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-white text-base font-semibold leading-5">11k</p>
                <p className="text-[#ababab] text-[10px] font-medium leading-3">Total Photos</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-white text-base font-semibold leading-5">212</p>
                <p className="text-[#ababab] text-[10px] font-medium leading-3">Albums Culled</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-white text-base font-semibold leading-5">1.8k</p>
                <p className="text-[#ababab] text-[10px] font-medium leading-3">Edited Photos</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-white text-base font-semibold leading-5">5.3k</p>
                <p className="text-[#ababab] text-[10px] font-medium leading-3">Selected Photos</p>
              </div>
            </div>

            <div className="h-px bg-[#474747] rounded-full shrink-0" />

            <div className="flex items-center justify-between">
              <p className="text-[#ababab] text-xs">Brag about your newfound time!</p>
              <div className="flex items-center gap-2">
                <button className="w-6 h-6 rounded-full bg-[#303030] flex items-center justify-center hover:bg-[#3a3a3a] transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#ababab">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                  </svg>
                </button>
                <button className="w-6 h-6 rounded-full bg-[#303030] flex items-center justify-center hover:bg-[#3a3a3a] transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 4l16 16M4 20L20 4"
                      stroke="#ababab"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden folder picker */}
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

export default HomePage;
