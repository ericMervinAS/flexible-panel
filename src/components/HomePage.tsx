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
import { useState, useEffect } from "react";
import type { ImportFolder } from "./ImportGate";
import type { Album } from "@/types/album";
import { useAlbums } from "@/context/AlbumsContext";
import heroPortrait from "../assets/UI/home-hero-portrait.png";
import tetheringEntry from "../assets/UI/tethering-entry.png";
import tetheringPortrait from "../assets/UI/home-tethering-portrait.png";
import logoImg from "../assets/UI/logo.png";
import userImg from "../assets/UI/user.png";

interface HomePageProps {
  onReady: (source: "sample" | "tethering" | ImportFolder) => void;
  onOpenAlbum: (album: Album) => void;
  onCreateAlbum: () => void;
  onTryTethering?: () => void;
}

function AlbumCard({ album, onOpen }: { album: Album; onOpen: () => void }) {
  const isTethered = album.source === "tethering";
  return (
    <div className="flex flex-col w-full">
      <div
        className="aspect-[257/190] bg-[#242424] rounded-lg overflow-hidden relative flex flex-col justify-between group cursor-pointer"
        onDoubleClick={onOpen}
      >
        {album.coverSrc && (
          <img
            src={album.coverSrc}
            className="absolute inset-0 w-full h-full object-cover"
            alt=""
          />
        )}
        <div className="p-2 relative z-10" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10" />
        <div className="flex items-end justify-between p-1 relative z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
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
            {isTethered ? "Continue Tethering" : "Retouch Now"}
          </button>
        </div>
      </div>
    </div>
  );
}

const HomePage = ({ onReady, onOpenAlbum, onCreateAlbum, onTryTethering }: HomePageProps) => {
  const { albums } = useAlbums();
  const [showCoachmark, setShowCoachmark] = useState(false);
  const [visible, setVisible] = useState(false);
  const [fillStarted, setFillStarted] = useState(false);

  useEffect(() => {
    if (Math.random() < 0.9) {
      setShowCoachmark(true);
      const t = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const fillTimer = setTimeout(() => setFillStarted(true), 100);
    const dismissTimer = setTimeout(() => dismissCoachmark(), 10200);
    return () => {
      clearTimeout(fillTimer);
      clearTimeout(dismissTimer);
    };
  }, [visible]);

  const dismissCoachmark = () => {
    setVisible(false);
    setFillStarted(false);
    setTimeout(() => setShowCoachmark(false), 350);
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
          <div className="flex gap-5 ">
            <div
              onClick={onCreateAlbum}
              className="w-[380px] h-[144px] rounded-[10px] overflow-hidden relative shrink-0 hover:cursor-pointer"
              style={{
                backgroundImage: `url(${heroPortrait})`,
                backgroundSize: "cover",
                backgroundPosition: "center top",
              }}
            >
              {/* Left content */}
              <div className="absolute inset-0 flex flex-col justify-center px-4 py-3 w-[240px]">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <p className="text-white text-base font-semibold leading-5">
                      Create a new album
                    </p>
                    <p className="text-[#ababab] text-xs leading-4">
                      Smart Selections. Effortless Editing. AI-precise Retouching
                    </p>
                  </div>
                  <button className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-2 rounded w-fit h-8 transition-colors">
                    <PlusIcon size={16} />
                    Create Album
                  </button>
                </div>
              </div>
            </div>

            {/* <div
              onClick={() => onReady("tethering")}
              className="w-[380px] h-[144px] rounded-[10px] overflow-hidden relative shrink-0 hover:cursor-pointer"
              style={{
                backgroundImage: `url(${tetheringEntry})`,
                backgroundSize: "cover",
                backgroundPosition: "center top",
              }}
            >
              <div className="absolute inset-0 flex flex-col justify-center px-4 py-3 w-[240px]">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <p className="text-white text-base font-semibold leading-5">
                      Tethering is now Live
                    </p>
                    <p className="text-[#ababab] text-xs leading-4">
                      Your workflow just got a whole lot faster and smoother!
                    </p>
                  </div>
                  <button className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-medium px-3 py-2 rounded w-fit h-8 transition-colors">
                    Try Now
                  </button>
                </div>
              </div>
            </div> */}
          </div>

          {/* My Albums heading */}
          <p className="text-white text-lg shrink-0" style={{ fontFamily: "Archivo, sans-serif" }}>
            My albums <span className="text-[#ababab]">({albums.length})</span>
          </p>

          {/* Albums grid */}
          <div className="grid grid-cols-4 gap-5 pr-[30px]">
            {albums.map((album) => (
              <AlbumCard key={album.id} album={album} onOpen={() => onOpenAlbum(album)} />
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-[361px] border-l border-[#1c1c1c] flex flex-col gap-2 p-2 overflow-y-auto shrink-0">
          {/* Tethering promo card */}
          <div
            className="rounded-[4px] px-5 relative overflow-hidden shrink-0 flex items-center"
            style={{
              minHeight: "140px",
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
                  onClick={() => onReady("tethering")}
                  className="flex items-center gap-1 bg-[#303030] hover:bg-[#474747] text-white text-xs font-medium px-3 py-1.5 rounded transition-colors"
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

      {/* Tethering coachmark — slides in from the right */}
      {showCoachmark && (
        <div
          className={`fixed bottom-5 right-5 z-50 w-[320px] bg-white rounded-xl shadow-2xl overflow-hidden transition-all duration-350 ease-out ${
            visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
          }`}
          style={{ transitionProperty: "transform, opacity" }}
        >
          <div className="flex flex-col gap-4 px-5 pt-3 pb-5">
            <div className="flex flex-col gap-1">
              <p className="text-[#474747] text-base font-semibold leading-5">
                Nikon Z6 III Detected
              </p>
              <p className="text-[#71717a] text-sm leading-5">
                A camera has been detected as connected on this device.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={dismissCoachmark}
                className="relative px-4 py-2 rounded bg-[rgba(37,99,235,0.12)] text-[#3b82f6] text-sm font-medium overflow-hidden"
              >
                <span
                  className="absolute inset-y-0 left-0 bg-[rgba(37,99,235,0.22)] ease-linear"
                  style={{
                    width: fillStarted ? "100%" : "0%",
                    transition: fillStarted ? "width 10000ms linear" : "none",
                  }}
                />
                <span className="relative">Skip Now</span>
              </button>
              <button
                onClick={() => {
                  dismissCoachmark();
                  onTryTethering ? onTryTethering() : onReady("tethering");
                }}
                className="px-4 py-2 rounded bg-[#2563eb] text-white text-sm font-medium hover:bg-[#1d4ed8] transition-colors"
              >
                Try Tethering
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
