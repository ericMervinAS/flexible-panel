import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSessionState } from "@/hooks/useSessionState";
import PinnedSlidersCard from "../../PinnedSlidersCard";
import {
  FolderSimpleIcon,
  CaretDown,
  CaretLeft,
  CaretRight,
  BatteryHigh,
  GearIcon,
  CameraIcon,
  X,
  Stack,
  Monitor,
  Keyboard,
  LockSimple,
  ShieldCheck,
  ArrowRight,
  MagnifyingGlassIcon,
  CropSimple,
} from "@phosphor-icons/react";
import Accordion from "../../Accordion";
import PresetDropdown from "../../PresetDropdown";
import SliderRow from "../../SliderRow";
import Tooltip from "../../Tooltip";
import editorial_style from "@/assets/profile/editorial_style.webp";
import graicard from "@/assets/profile/graicard.jpg";
import matcha from "@/assets/profile/matcha.jpg";
import porta_400 from "@/assets/profile/porta_400.webp";

// ─── Camera stop arrays ────────────────────────────────────────────────────────

const APERTURE_STOPS = ["1.4", "1.8", "2", "2.8", "4", "5.6", "8", "11", "16", "22"];
const SHUTTER_STOPS = ["30", "60", "125", "250", "300", "500", "1000", "2000", "4000"];
const ISO_STOPS = ["100", "200", "400", "800", "1600", "3200", "6400"];

const WB_OPTIONS = [
  "Auto",
  "Daylight",
  "Cloudy",
  "Shade",
  "Tungsten",
  "Fluorescent",
  "Flash",
  "Custom",
] as const;
const ASPECT_OPTIONS = ["3:2", "1:1", "4:3", "16:9"] as const;
const FOCUS_OPTIONS = ["AI Focus", "Manual Focus"] as const;
const SHOOT_OPTIONS = [
  "Single Shot",
  "Continous high speed",
  "Continous low speed",
  "Timer 10 sec",
  "Timer 2 sec",
] as const;

// ─── Camera format config ─────────────────────────────────────────────────────

interface CameraSpec {
  raw: string;
  jpegQualities: string[];
}

const CAMERA_SPEC_MAP: Array<{ pattern: RegExp; spec: CameraSpec }> = [
  { pattern: /nikon/i, spec: { raw: "NEF", jpegQualities: ["Fine", "Normal", "Basic"] } },
  // EOS R / EOS M (2018+) use CR3; older Canon DSLRs use CR2
  {
    pattern: /canon.*(eos r\d|eos r$|r\d+.*mark|rebel sl3|eos m\d{2})/i,
    spec: { raw: "CR3", jpegQualities: ["Fine", "Normal"] },
  },
  { pattern: /canon/i, spec: { raw: "CR2", jpegQualities: ["Fine", "Normal"] } },
  {
    pattern: /sony/i,
    spec: { raw: "ARW", jpegQualities: ["Extra Fine", "Fine", "Standard"] },
  },
  { pattern: /fujifilm|fuji x/i, spec: { raw: "RAF", jpegQualities: ["Fine", "Normal"] } },
  {
    pattern: /olympus|om system/i,
    spec: { raw: "ORF", jpegQualities: ["Fine", "Normal", "Basic"] },
  },
  {
    pattern: /panasonic|lumix/i,
    spec: { raw: "RW2", jpegQualities: ["Fine", "Standard"] },
  },
  { pattern: /leica/i, spec: { raw: "DNG", jpegQualities: ["Fine", "Basic"] } },
  {
    pattern: /pentax|ricoh gr/i,
    spec: { raw: "PEF", jpegQualities: ["Fine", "Normal"] },
  },
];

const DEFAULT_CAMERA_SPEC: CameraSpec = { raw: "RAW", jpegQualities: ["Fine", "Normal"] };

const getCameraSpec = (cameraName: string): CameraSpec => {
  for (const { pattern, spec } of CAMERA_SPEC_MAP) {
    if (pattern.test(cameraName)) return spec;
  }
  return DEFAULT_CAMERA_SPEC;
};

const getFormatOptions = ({ raw, jpegQualities }: CameraSpec): string[] => [
  raw,
  ...jpegQualities.map((q) => `JPEG ${q}`),
  ...jpegQualities.map((q) => `${raw} + JPEG ${q}`),
];

// Cameras the mock detection will "find" (ordered by USB priority)
const MOCK_DETECTED_CAMERAS = ["Nikon Z6 III", "Canon EOS R6 Mark II"];

// ─── Editing Profile data ─────────────────────────────────────────────────────

interface ProfileItem {
  name: string;
  format: "JPEG" | "RAW";
  img: string | null;
}

interface ProfileSectionData {
  group: string;
  profiles: ProfileItem[];
}

const PROFILE_SECTIONS_DATA: ProfileSectionData[] = [
  {
    group: "Professional AI Profile(s)",
    profiles: [{ name: "Testing", format: "RAW", img: null }],
  },
  {
    group: "Downloaded",
    profiles: [
      { name: "Editorial Style", format: "JPEG", img: editorial_style },
      { name: "Graicard", format: "JPEG", img: graicard },
      { name: "Matcha", format: "JPEG", img: matcha },
      { name: "Porta 400", format: "JPEG", img: porta_400 },
    ],
  },
];

const ALL_PROFILES_FLAT = PROFILE_SECTIONS_DATA.flatMap((s) => s.profiles);

const LrcBadge = () => (
  <span className="text-[12px] font-semibold text-[#74b9d4] leading-none shrink-0">LrC</span>
);

const FormatBadge = ({ format }: { format: "JPEG" | "RAW" }) => (
  <span
    className={`text-[11px] font-semibold px-2 py-[3px] rounded leading-none shrink-0 ${
      format === "JPEG" ? "bg-[#2563eb] text-white" : "bg-[#166534]/60 text-[#4ade80]"
    }`}
  >
    {format}
  </span>
);

const ProfileThumb = ({ img, size = "md" }: { img: string | null; size?: "sm" | "md" }) => {
  const cls = size === "sm" ? "w-[56px] h-[38px]" : "w-[66px] h-[44px]";
  return (
    <div className={`${cls} rounded-[4px] overflow-hidden shrink-0 bg-[#2a2a2a]`}>
      {img ? (
        <img src={img} className="w-full h-full object-cover" alt="" />
      ) : (
        <div className="w-full h-full bg-[#7c3f58] flex items-center justify-center">
          <span className="text-[#e8a0bf] text-[18px] font-bold leading-none">ā</span>
        </div>
      )}
    </div>
  );
};

interface ProfileDropdownProps {
  value: string | null;
  onChange: (v: string | null) => void;
  currentImageSrc?: string;
  cols?: number;
  maxVisible?: number;
}

const ProfileDropdown = ({ value, onChange }: ProfileDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedProfile = ALL_PROFILES_FLAT.find((p) => p.name === value) ?? null;

  const updatePosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 300),
      zIndex: 9999,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onClickOutside = (e: MouseEvent) => {
      if (
        !containerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="w-full">
      {/* Trigger */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 px-3 py-2 bg-[#1c1c1c] border border-[#303030] rounded-[8px] hover:border-[#474747] transition-colors"
      >
        <ProfileThumb img={selectedProfile?.img ?? null} size="sm" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <LrcBadge />
          <span className="text-[14px] font-medium text-[#e2e2e2] flex-1 truncate text-left">
            {selectedProfile?.name ?? "Select a profile"}
          </span>
          {selectedProfile && <FormatBadge format={selectedProfile.format} />}
        </div>
        <CaretDown
          className={`w-4 h-4 shrink-0 text-[#777] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown menu */}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ ...menuStyle, scrollbarWidth: "none" } as React.CSSProperties}
            className="bg-[#1e1e1e] border border-[#303030] rounded-[10px] p-1 flex flex-col max-h-[420px] overflow-y-auto shadow-xl"
          >
            {/* Explore */}
            <button
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[6px] hover:bg-white/5 transition-colors"
            >
              <MagnifyingGlassIcon size={16} className="text-[#777] shrink-0" />
              <span className="text-[14px] text-[#ababab]">Explore AI Profiles…</span>
            </button>

            {/* Crop & Straighten */}
            <button
              onClick={() => {
                onChange("Crop & Straighten only");
                setOpen(false);
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[6px] hover:bg-white/5 transition-colors"
            >
              <CropSimple size={16} className="text-[#777] shrink-0" />
              <span className="text-[14px] text-[#ababab]">Crop &amp; Straighten only</span>
            </button>

            {/* Profile sections */}
            {PROFILE_SECTIONS_DATA.map((section, si) => (
              <div key={section.group}>
                <div className={`h-px bg-[#2a2a2a] mx-2 ${si === 0 ? "my-1" : "mt-1 mb-0"}`} />
                <div className="px-3 pt-2.5 pb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#555]">
                    {section.group}
                  </span>
                </div>
                {section.profiles.map((profile) => (
                  <button
                    key={profile.name}
                    onClick={() => {
                      onChange(profile.name);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-2 py-2 rounded-[6px] transition-colors ${
                      value === profile.name ? "bg-white/5" : "hover:bg-white/5"
                    }`}
                  >
                    <ProfileThumb img={profile.img} size="md" />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <LrcBadge />
                      <span className="text-[14px] font-medium text-[#e2e2e2] flex-1 truncate text-left">
                        {profile.name}
                      </span>
                      <FormatBadge format={profile.format} />
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};

// ─── Inline select (WB / Quality rows) ────────────────────────────────────────

interface InlineSelectProps {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}

const InlineSelect = ({ value, options, onChange }: InlineSelectProps) => {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      minWidth: 140,
      zIndex: 9999,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onClickOutside = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 text-[#ababab] hover:text-[#e2e2e2] transition-colors"
      >
        <span className="text-[13px]">{value}</span>
        <CaretDown className="w-3.5 h-3.5 shrink-0" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="bg-[#242424] border border-[#474747] rounded-lg p-1 flex flex-col gap-0.5"
          >
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded text-[13px] transition-colors ${
                  opt === value ? "text-[#e2e2e2] bg-white/5" : "text-[#ababab] hover:bg-white/5"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};

// ─── Camera value card ─────────────────────────────────────────────────────────

interface CameraCardProps {
  label: string;
  stops: string[];
  index: number;
  onPrev: () => void;
  onNext: () => void;
  renderValue: (v: string) => React.ReactNode;
  onDragStart: () => void;
  onDragEnd: () => void;
  suppressHover: boolean;
}

const DRAG_STEP_PX = 16;

const CameraCard = ({
  label,
  stops,
  index,
  onPrev,
  onNext,
  renderValue,
  onDragStart,
  onDragEnd,
  suppressHover,
}: CameraCardProps) => {
  const dragRef = useRef<{ lastX: number } | null>(null);
  const [isActive, setIsActive] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { lastX: e.clientX };
    setIsActive(true);
    onDragStart();
    document.body.style.cursor = "ew-resize";

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = ev.clientX - dragRef.current.lastX;
      if (delta > DRAG_STEP_PX) {
        onNext();
        dragRef.current.lastX = ev.clientX;
      } else if (delta < -DRAG_STEP_PX) {
        onPrev();
        dragRef.current.lastX = ev.clientX;
      }
    };

    const onUp = () => {
      dragRef.current = null;
      setIsActive(false);
      onDragEnd();
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const overlayClass = isActive
    ? "opacity-100"
    : suppressHover
      ? "opacity-0"
      : "opacity-0 group-hover:opacity-100";

  return (
    <div
      className="flex-1 bg-[#242424] rounded-[6px] flex flex-col items-center gap-[6px] pt-4 pb-[10px] px-1 relative cursor-ew-resize select-none group"
      onMouseDown={handleMouseDown}
    >
      <div
        className={`absolute inset-0 rounded-[6px] bg-white/5 transition-opacity pointer-events-none ${overlayClass}`}
      />
      <div className="flex items-baseline gap-0.5 justify-center w-full">
        {renderValue(stops[index])}
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.5px] text-[#777]">
        {label}
      </span>
      <div className="absolute inset-x-1 top-4 h-6 flex items-center justify-between pointer-events-none">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          disabled={index === 0}
          className="text-[#666] hover:text-[#ababab] disabled:opacity-25 transition-colors pointer-events-auto"
        >
          <CaretLeft size={12} weight="bold" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          disabled={index === stops.length - 1}
          className="text-[#666] hover:text-[#ababab] disabled:opacity-25 transition-colors pointer-events-auto"
        >
          <CaretRight size={12} weight="bold" />
        </button>
      </div>
    </div>
  );
};

// ─── Tether Welcome Modal ─────────────────────────────────────────────────────

interface TetherWelcomeModalProps {
  onClose: () => void;
}

const WELCOME_FEATURES = [
  {
    icon: Stack,
    title: "Two tabs, one shoot",
    description: "Switch between Edit (default) and Retouch on every shot.",
  },
  {
    icon: Monitor,
    title: "Camera info on the right",
    description: "Camera name, mode, shutter, ISO, aperture, battery, format, status.",
  },
  {
    icon: Keyboard,
    title: "Press keyboard button to shoot",
    description: "Or use your camera's shutter button. Either works.",
  },
];

const TetherWelcomeModal = ({ onClose }: TetherWelcomeModalProps) => {
  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#1c1c1c] border border-[#303030] rounded-[16px] p-6 flex flex-col gap-5 w-[480px]">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-[20px] font-semibold text-[#e2e2e2] leading-6">
              Welcome to Tethered Shooting
            </h3>
            <p className="text-[14px] text-[#777] leading-5">Three quick things and you're set.</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4 text-[#777]" />
          </button>
        </div>

        {/* Feature cards */}
        <div className="flex flex-col gap-2">
          {WELCOME_FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex items-start gap-3.5 bg-[#242424] rounded-[10px] px-4 py-3.5"
            >
              <div className="shrink-0 w-9 h-9 rounded-[8px] bg-[#2563eb]/20 flex items-center justify-center mt-0.5">
                <Icon size={18} weight="duotone" className="text-[#60a5fa]" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[14px] font-medium text-[#e2e2e2]">{title}</span>
                <span className="text-[13px] text-[#777] leading-[1.4]">{description}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Safety badges */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[#777]">
            <LockSimple size={13} />
            <span className="text-[12px]">Originals are safe.</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#777]">
            <ShieldCheck size={13} />
            <span className="text-[12px]">No edits are destructively applied.</span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-[13px] text-[#555] hover:text-[#ababab] transition-colors"
          >
            Don't show again
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#2563eb] hover:bg-[#3b7af5] active:bg-[#1d4ed8] rounded-[8px] text-[14px] font-medium text-white transition-colors"
          >
            Got it — let's go
            <ArrowRight size={15} weight="bold" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Tether Camera Select Modal ───────────────────────────────────────────────

interface TetherCameraSelectModalProps {
  onCancel: () => void;
  onSelect: (camera: string) => void;
}

const TetherCameraSelectModal = ({ onCancel, onSelect }: TetherCameraSelectModalProps) => {
  const cameras = [
    { name: "Nikon Z6 III", subtitle: "Connected via USB" },
    { name: "Canon EOS R6 Mark II", subtitle: "Connected via USB" },
  ];

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-[#1c1c1c] border border-[#303030] rounded-[16px] p-6 flex flex-col gap-6 w-[480px]">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-[20px] font-semibold text-[#e2e2e2] leading-6">
              Two cameras detected
            </h3>
            <p className="text-[14px] text-[#777] leading-5">
              Choose which one to use for this session.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4 text-[#777]" />
          </button>
        </div>

        {/* Camera cards */}
        <div className="flex gap-3">
          {cameras.map((cam) => (
            <button
              key={cam.name}
              onClick={() => onSelect(cam.name)}
              className="group flex flex-col items-center gap-4 flex-1 py-8 px-4 rounded-xl border border-[#161616] bg-[#161616] hover:border-[#212121] hover:bg-[#1e1e1e] transition-colors cursor-pointer"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#666"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="group-hover:stroke-[#ababab] transition-colors"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <div className="flex flex-col gap-1 text-center">
                <span className="text-[14px] font-medium text-[#d8d8d8]">{cam.name}</span>
                {/* <span className="text-[12px] text-[#555] group-hover:text-[#777] transition-colors">{cam.subtitle}</span> */}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-[8px] bg-[#2a2a2a] text-[14px] font-medium text-[#e2e2e2] hover:bg-[#333] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Tether Detect Modal ─────────────────────────────────────────────────────

interface TetherDetectModalProps {
  onCancel: () => void;
  onDetected: (cameras: string[]) => void;
}

const TetherDetectModal = ({ onCancel, onDetected }: TetherDetectModalProps) => {
  const [phase, setPhase] = useState<"detecting" | "not-found">("detecting");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (phase !== "detecting") return;
    const t = setTimeout(() => {
      // First attempt fails 2/3 of the time. Any retry always succeeds.
      const shouldFail = attempt === 0 && Math.random() < 2 / 3;
      if (shouldFail) setPhase("not-found");
      else {
        // TODO: restore to MOCK_DETECTED_CAMERAS.slice(0, 1) after testing
        onDetected(MOCK_DETECTED_CAMERAS);
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [phase, attempt, onDetected]);

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-[#1c1c1c] border border-[#303030] rounded-[16px] p-6 flex flex-col gap-6 w-[480px]">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-[20px] font-semibold text-[#e2e2e2] leading-6">
              Start Tethered Shoot
            </h3>
            <p className="text-[14px] text-[#777] leading-5">
              {phase === "detecting"
                ? "Looking for a connected camera…"
                : "No camera detected. Check your cable and try again."}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4 text-[#777]" />
          </button>
        </div>

        {/* Camera row */}
        <div className="flex items-center justify-between px-3 py-3 bg-[#242424] rounded-[8px]">
          {phase === "detecting" ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#777] animate-pulse shrink-0" />
                <span className="text-[14px] font-medium text-[#777]">Detecting camera…</span>
              </div>
              <span className="text-[13px] text-[#555]">Searching</span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#ef4444] shrink-0" />
                <span className="text-[14px] font-medium text-[#ababab]">No camera found</span>
              </div>
              <span className="text-[13px] text-[#ef4444]">Not connected</span>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-[8px] bg-[#2a2a2a] text-[14px] font-medium text-[#e2e2e2] hover:bg-[#333] transition-colors"
          >
            Cancel
          </button>
          {phase === "not-found" && (
            <button
              onClick={() => {
                setAttempt((a) => a + 1);
                setPhase("detecting");
              }}
              className="px-4 py-2.5 bg-[#2563eb] hover:bg-[#3b7af5] active:bg-[#1d4ed8] rounded-[8px] text-[14px] font-medium text-white transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Tether Setup Modal ───────────────────────────────────────────────────────

const buildPreview = (template: string) =>
  template
    .replace("{Date}", "2026-05-10")
    .replace("{Time}", "143022")
    .replace(/\{Counter(?::[^}]*)?\}/, "0001")
    .replace("{CameraModel}", "NikonZ6III")
    .concat(".NEF");

interface TetherSetupModalProps {
  onCancel: () => void;
  onStart: () => void;
  currentImageSrc?: string;
  mode?: "setup" | "preferences";
  editingProfile: string | null;
  onEditingProfileChange: (v: string | null) => void;
  cameraName: string;
  retouchPreset: string | null;
  onRetouchPresetChange: (v: string | null) => void;
  retouchPresetStrength: number;
  onRetouchPresetStrengthChange: (v: number) => void;
  fileFormat: string;
  onFileFormatChange: (v: string) => void;
  namingTemplate: string;
  onNamingTemplateChange: (v: string) => void;
  destination: string;
  onDestinationChange: (v: string) => void;
}

const TetherSetupModal = ({
  onCancel,
  onStart,
  currentImageSrc,
  mode = "setup",
  cameraName,
  editingProfile,
  onEditingProfileChange,
  retouchPreset,
  onRetouchPresetChange,
  retouchPresetStrength,
  onRetouchPresetStrengthChange,
  fileFormat,
  onFileFormatChange,
  namingTemplate,
  onNamingTemplateChange,
  destination,
  onDestinationChange,
}: TetherSetupModalProps) => {
  const isPreferences = mode === "preferences";
  const cameraSpec = getCameraSpec(cameraName);
  const formatOptions = getFormatOptions(cameraSpec);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Extract the user's prefix from a {Prefix}_… template (if present).
  const prefixMatch = namingTemplate.match(/\{Prefix:([^}]*)\}/);
  const userPrefix = prefixMatch?.[1] ?? "";

  // Pattern presets — concrete, named, with their own template strings.
  const NAMING_PATTERNS: Array<{
    id: string;
    label: string;
    template: string;
    needsPrefix?: boolean;
  }> = [
    { id: "date-seq", label: "Date + Sequence", template: "{Date}_{Counter:0001}" },
    {
      id: "prefix-seq",
      label: "Prefix + Sequence",
      template: "{Prefix:Smith}_{Counter:0001}",
      needsPrefix: true,
    },
    {
      id: "date-prefix-seq",
      label: "Date + Prefix + Sequence",
      template: "{Date}_{Prefix:Smith}_{Counter:0001}",
      needsPrefix: true,
    },
    { id: "camera-seq", label: "Camera + Sequence", template: "{CameraModel}_{Counter:0001}" },
    { id: "seq-only", label: "Sequence only", template: "IMG_{Counter:0001}" },
  ];

  const activePatternId = (() => {
    const stripped = namingTemplate.replace(/\{Prefix:[^}]*\}/g, "{Prefix}");
    for (const p of NAMING_PATTERNS) {
      const pStripped = p.template.replace(/\{Prefix:[^}]*\}/g, "{Prefix}");
      if (pStripped === stripped) return p.id;
    }
    return null;
  })();

  const applyPattern = (p: (typeof NAMING_PATTERNS)[number]) => {
    if (p.needsPrefix && userPrefix) {
      onNamingTemplateChange(p.template.replace(/\{Prefix:[^}]*\}/, `{Prefix:${userPrefix}}`));
    } else {
      onNamingTemplateChange(p.template);
    }
  };

  const updatePrefix = (next: string) => {
    const sanitized = next.replace(/[/\\:*?"<>|{}]/g, "");
    if (namingTemplate.includes("{Prefix:")) {
      onNamingTemplateChange(
        namingTemplate.replace(/\{Prefix:[^}]*\}/, `{Prefix:${sanitized || "Smith"}}`)
      );
    }
  };

  const previewFor = (tpl: string) =>
    tpl
      .replace("{Date}", "2026-05-15")
      .replace(/\{Prefix:([^}]*)\}/, (_m, p) => userPrefix || p)
      .replace(/\{Counter(?::[^}]*)?\}/, "0001")
      .replace("{CameraModel}", cameraName.replace(/\s+/g, ""))
      .concat(`.${cameraSpec.raw}`);

  const activePattern = NAMING_PATTERNS.find((p) => p.id === activePatternId);
  const showPrefixInput = !!activePattern?.needsPrefix;

  const pickFolder = async () => {
    const w = window as unknown as {
      showDirectoryPicker?: () => Promise<{ name: string }>;
    };
    if (w.showDirectoryPicker) {
      try {
        const handle = await w.showDirectoryPicker();
        onDestinationChange(`~/Pictures/${handle.name}`);
      } catch {
        /* user cancelled */
      }
    } else {
      const next = window.prompt("Destination folder path", destination);
      if (next) onDestinationChange(next);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="bg-[#1c1c1c] border border-[#303030] rounded-[16px] p-6 flex flex-col gap-6 w-[480px] max-h-[90vh] overflow-y-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-[20px] font-semibold text-[#e2e2e2] leading-6">
              {isPreferences ? "Tethering Preferences" : "Start Tethered Shoot"}
            </h3>
            <p className="text-[14px] text-[#777] leading-5">
              {isPreferences
                ? "Adjust settings for your current tethered session."
                : "Connect your camera and set up auto-processing."}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4 text-[#777]" />
          </button>
        </div>

        {/* Camera */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#777]">
            Camera
          </span>
          <div className="flex items-center justify-between px-3 py-3 bg-[#242424] rounded-[8px]">
            <span className="text-[14px] font-medium text-[#e2e2e2]">{cameraName}</span>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#e2e2e2]">Connected</span>
              <div className="w-2 h-2 rounded-full bg-[#4ade80] shrink-0" />
            </div>
          </div>
        </div>

        {/* Editing Profile */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#777]">
              Editing Profile
            </span>
            <ProfileDropdown
              compact
              menuWidth={300}
              triggerTextSize="13px"
              value={editingProfile}
              onChange={onEditingProfileChange}
            />
          </div>
        </div>

        {/* Retouching Preset */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#777]">
              Retouching Preset
            </span>

            <PresetDropdown
              compact
              menuWidth={300}
              value={retouchPreset}
              onChange={(v) => onRetouchPresetChange(v)}
            />
          </div>
          {retouchPreset && (
            <SliderRow
              label="Strength"
              value={retouchPresetStrength}
              onChange={onRetouchPresetStrengthChange}
              noPinArea
            />
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#777]">
            File Format
          </span>
          <InlineSelect value={fileFormat} options={formatOptions} onChange={onFileFormatChange} />
        </div>

        {/* Advanced toggle */}
        <div className="flex flex-col gap-6">
          <button
            onClick={() => setShowAdvanced((p) => !p)}
            className="flex items-center gap-1.5 self-start text-[12px] font-medium text-[#ababab] hover:text-[#fff] transition-colors"
          >
            <CaretDown
              size={12}
              weight="bold"
              className={`transition-transform ${showAdvanced ? "rotate-0" : "-rotate-90"}`}
            />
            Advanced
          </button>

          {showAdvanced && (
            <>
              {/* Destination Folder — path selector */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#777]">
                  Destination Folder
                </span>
                <button
                  onClick={pickFolder}
                  className={`group flex w-full text-left gap-2 items-center justify-between px-2.5 py-2 bg-[#242424] rounded hover:bg-[#2a2a2a] transition-colors`}
                >
                  <span className="text-[13px] text-[#e2e2e2] truncate flex-1">{destination}</span>
                  <FolderSimpleIcon size={16} className="text-[#777] shrink-0" />
                </button>
              </div>

              {/* File Naming — pattern picker */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#777]">
                  File Naming
                </span>

                <div className="flex flex-col gap-1 rounded-[8px] bg-[#161616] border border-[#2a2a2a] p-1">
                  {NAMING_PATTERNS.map((p) => {
                    const active = p.id === activePatternId;
                    return (
                      <button
                        key={p.id}
                        onClick={() => applyPattern(p)}
                        className={`flex items-center justify-between gap-3 px-2.5 py-2 rounded-[6px] text-left transition-colors ${
                          active ? "bg-[#1e3a5f]/40" : "hover:bg-white/[0.03]"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
                              active ? "border-[#60a5fa] bg-[#60a5fa]" : "border-[#444]"
                            }`}
                          />
                          <span
                            className={`text-[12px] font-medium ${active ? "text-[#e2e2e2]" : "text-[#ababab]"}`}
                          >
                            {p.label}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-[#777] truncate">
                          {previewFor(p.template)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {showPrefixInput && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#161616] border border-[#2a2a2a] rounded-[8px]">
                    <span className="text-[11px] uppercase tracking-[0.5px] text-[#777] shrink-0">
                      Prefix
                    </span>
                    <input
                      type="text"
                      value={userPrefix}
                      placeholder="Smith"
                      onChange={(e) => updatePrefix(e.target.value)}
                      className="flex-1 bg-transparent outline-none text-[13px] text-[#e2e2e2] placeholder:text-[#3a3a3a] font-mono"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-[8px] bg-[#2a2a2a] text-[14px] font-medium text-[#e2e2e2] hover:bg-[#333] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onStart}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#2563eb] hover:bg-[#3b7af5] active:bg-[#1d4ed8] rounded-[8px] text-[14px] font-medium text-white transition-colors"
          >
            {isPreferences ? "Save Preferences" : "Start Shooting"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── TetheringTab ─────────────────────────────────────────────────────────────

interface TetheringTabProps {
  currentImageSrc?: string;
  isTethering: boolean;
  isLoupeView?: boolean;
  onStartTethering: () => void;
  onCancelSetup?: () => void;
  onCancelTethering?: () => void;
  onCapture?: (autoAdvance: boolean) => void;
}

const TetheringTab = ({
  currentImageSrc,
  isTethering,
  isLoupeView = false,
  onStartTethering,
  onCancelSetup,
  onCancelTethering,
  onCapture,
}: TetheringTabProps) => {
  const [pinnedSliders, setPinnedSliders] = useSessionState<Set<string>>(
    "subjectTab:pinnedSliders",
    new Set(),
    { serialize: (s) => [...s], deserialize: (a) => new Set(a as string[]) }
  );
  const [favValues, setFavValues] = useSessionState<Record<string, number>>(
    "favorites:values",
    {}
  );

  const togglePin = (sIdx: number, sliderIdx: number) => {
    const key = `${sIdx}:${sliderIdx}`;
    setPinnedSliders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const [apertureIdx, setApertureIdx] = useState(5); // f/5.6
  const [shutterIdx, setShutterIdx] = useState(4); // 1/300
  const [isoIdx, setIsoIdx] = useState(1); // 200
  const [wb, setWb] = useState("Auto");
  const [destination, setDestination] = useState("/Users/photographer/Desktop/Shoot");
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [retouchPreset, setRetouchPreset] = useState<string | null>(null);
  const [retouchPresetStrength, setRetouchPresetStrength] = useState(100);
  const retouchPresetRowRef = useRef<HTMLDivElement>(null);
  const [cameraName, setCameraName] = useState("Nikon Z6 III");
  const cameraSpec = getCameraSpec(cameraName);
  const formatOptions = getFormatOptions(cameraSpec);
  const [fileFormat, setFileFormat] = useState(() => {
    const spec = getCameraSpec("Nikon Z6 III");
    return `${spec.raw} + JPEG ${spec.jpegQualities[0]}`;
  });

  const [aspectRatio, setAspectRatio] = useState<string>(ASPECT_OPTIONS[0]);
  const [focusMode, setFocusMode] = useState<string>(FOCUS_OPTIONS[0]);
  const [shootMode, setShootMode] = useState<string>(SHOOT_OPTIONS[0]);
  const [namingTemplate, setNamingTemplate] = useState("{Date}_{Counter:0001}");
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [draggingCard, setDraggingCard] = useState<string | null>(null);
  const [autoAdvanceHovered, setAutoAdvanceHovered] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showDetect, setShowDetect] = useState(!isTethering);
  const [showCameraSelect, setShowCameraSelect] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  return (
    <div
      className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4"
      style={{ scrollbarWidth: "none" }}
    >
      {/* ── Camera Info ── */}
      {isTethering && (
        <>
          <div className="flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium text-[#e2e2e2]">Camera Info</span>
              <div className="flex items-center">
                <div className="flex items-center gap-1 px-1.5 py-1 rounded border border-[rgba(21,128,61,0.4)] bg-[rgba(21,128,61,0.12)] backdrop-blur-[2px]">
                  <div className="w-3 h-3 flex items-center justify-center shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                  </div>
                  <span className="text-[11px] font-medium text-[#e2e2e2]">Connected</span>
                </div>
                <button
                  onClick={() => setShowSetup(true)}
                  className="text-[#666] hover:text-[#ababab] transition-colors pl-2 py-2"
                >
                  <GearIcon size={16} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium text-[#ababab]">{cameraName}</span>
              <div className="flex items-center gap-1.5 text-[#ababab]">
                <BatteryHigh size={16} />
                <span className="text-[14px] font-medium">78%</span>
              </div>
            </div>

            {/* Value cards */}
            <div className="flex gap-2">
              <CameraCard
                label="APERTURE"
                stops={APERTURE_STOPS}
                index={apertureIdx}
                onPrev={() => setApertureIdx((i) => Math.max(0, i - 1))}
                onNext={() => setApertureIdx((i) => Math.min(APERTURE_STOPS.length - 1, i + 1))}
                onDragStart={() => setDraggingCard("APERTURE")}
                onDragEnd={() => setDraggingCard(null)}
                suppressHover={draggingCard !== null && draggingCard !== "APERTURE"}
                renderValue={(v) => (
                  <span className="leading-none text-[#e2e2e2] font-medium">
                    <span className="text-[12px] pr-1">f</span>
                    <span className="text-[20px]">{v}</span>
                  </span>
                )}
              />
              <CameraCard
                label="SHUTTER"
                stops={SHUTTER_STOPS}
                index={shutterIdx}
                onPrev={() => setShutterIdx((i) => Math.max(0, i - 1))}
                onNext={() => setShutterIdx((i) => Math.min(SHUTTER_STOPS.length - 1, i + 1))}
                onDragStart={() => setDraggingCard("SHUTTER")}
                onDragEnd={() => setDraggingCard(null)}
                suppressHover={draggingCard !== null && draggingCard !== "SHUTTER"}
                renderValue={(v) => (
                  <span className="leading-none text-[#e2e2e2] font-medium">
                    <span className="text-[14px] pr-1">1/</span>
                    <span className="text-[20px]">{v}</span>
                  </span>
                )}
              />
              <CameraCard
                label="ISO"
                stops={ISO_STOPS}
                index={isoIdx}
                onPrev={() => setIsoIdx((i) => Math.max(0, i - 1))}
                onNext={() => setIsoIdx((i) => Math.min(ISO_STOPS.length - 1, i + 1))}
                onDragStart={() => setDraggingCard("ISO")}
                onDragEnd={() => setDraggingCard(null)}
                suppressHover={draggingCard !== null && draggingCard !== "ISO"}
                renderValue={(v) => (
                  <span className="text-[20px] font-medium text-[#e2e2e2] leading-none">{v}</span>
                )}
              />
            </div>

            {/* Capture button */}
            <div className="flex justify-center py-1">
              <button
                data-coachmark="capture-btn"
                onClick={() => onCapture?.(autoAdvance)}
                className="w-16 h-16 rounded-full border-[3px] border-white/30 flex items-center justify-center transition-all active:scale-95 group"
              >
                <div className="w-[52px] h-[52px] rounded-full bg-white group-hover:bg-white/90 group-active:bg-white/75 transition-colors" />
              </button>
            </div>

            {/* Settings rows */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ababab]">
                  WB
                </span>
                <InlineSelect value={wb} options={WB_OPTIONS} onChange={setWb} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ababab]">
                  Format
                </span>
                <InlineSelect value={fileFormat} options={formatOptions} onChange={setFileFormat} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ababab]">
                  Aspect Ratio
                </span>
                <InlineSelect
                  value={aspectRatio}
                  options={ASPECT_OPTIONS}
                  onChange={setAspectRatio}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ababab]">
                  Shoot Mode
                </span>
                <InlineSelect value={shootMode} options={SHOOT_OPTIONS} onChange={setShootMode} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ababab]">
                  Focus Mode
                </span>
                <InlineSelect value={focusMode} options={FOCUS_OPTIONS} onChange={setFocusMode} />
              </div>

              {isLoupeView ? (
                <button
                  onClick={() => setAutoAdvance((p) => !p)}
                  className="flex items-center justify-between w-full"
                >
                  <span
                    onMouseEnter={() => setAutoAdvanceHovered(true)}
                    onMouseLeave={() => setAutoAdvanceHovered(false)}
                    className="relative inline-flex text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ababab]"
                  >
                    <Tooltip
                      label="Automatically move to the next image after each capture"
                      visible={autoAdvanceHovered}
                      position="top"
                    />
                    Auto Advance
                  </span>
                  <div
                    className="relative w-8 h-[18px] rounded-full transition-colors"
                    style={{ backgroundColor: autoAdvance ? "#2563eb" : "#383838" }}
                  >
                    <div
                      style={{ transform: autoAdvance ? "translateX(18px)" : "translateX(2px)" }}
                      className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform"
                    />
                  </div>
                </button>
              ) : null}
            </div>
          </div>

          <div className="h-px bg-[#e2e2e20d]" />

          {/* ── Editing Profile ── */}
          <div data-coachmark="edit-profile">
            <Accordion
              title="Edit Profile"
              actions={
                <span className="text-[11px] font-medium text-[#777]">Auto Applied on next</span>
              }
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ababab] leading-3">
                  Profile
                </span>
                <ProfileDropdown
                  compact
                  menuWidth={300}
                  value={editingProfile}
                  onChange={setEditingProfile}
                />
              </div>
            </Accordion>
          </div>

          <div className="h-px bg-[#e2e2e20d]" />

          {/* ── Retouching Preset ── */}
          <div data-coachmark="retouch-preset">
            <div className="flex flex-col gap-4">
              <div ref={retouchPresetRowRef} className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ababab] leading-3">
                  Retouch Preset
                </span>
                <PresetDropdown
                  compact
                  anchorRef={retouchPresetRowRef}
                  value={retouchPreset}
                  onChange={setRetouchPreset}
                />
              </div>
              {retouchPreset && (
                <SliderRow
                  label="Strength"
                  value={retouchPresetStrength}
                  onChange={setRetouchPresetStrength}
                  noPinArea
                />
              )}
            </div>
          </div>

          {/* Favorite sliders */}
          {pinnedSliders.size > 0 && (
            <>
              <div className="h-px bg-[#e2e2e20d]" />
              <PinnedSlidersCard
                pinnedSliders={pinnedSliders}
                onTogglePin={togglePin}
                getValue={(sIdx, sliderIdx) => favValues[`${sIdx}:${sliderIdx}`] ?? 0}
                onChange={(sIdx, sliderIdx, v) =>
                  setFavValues((prev) => ({ ...prev, [`${sIdx}:${sliderIdx}`]: v }))
                }
              />
            </>
          )}
        </>
      )}

      {showWelcome && <TetherWelcomeModal onClose={() => setShowWelcome(false)} />}
      {showDetect && (
        <TetherDetectModal
          onCancel={() => {
            setShowDetect(false);
            if (onCancelTethering) onCancelTethering();
            else onCancelSetup?.();
          }}
          onDetected={(cameras) => {
            setShowDetect(false);
            if (cameras.length >= 2) {
              setShowCameraSelect(true);
            } else {
              if (cameras[0]) setCameraName(cameras[0]);
              setShowSetup(true);
            }
          }}
        />
      )}
      {showCameraSelect && (
        <TetherCameraSelectModal
          onCancel={() => {
            setShowCameraSelect(false);
            if (onCancelTethering) onCancelTethering();
            else onCancelSetup?.();
          }}
          onSelect={(cam) => {
            setCameraName(cam);
            setShowCameraSelect(false);
            setShowSetup(true);
          }}
        />
      )}
      {showSetup && (
        <TetherSetupModal
          onCancel={() => {
            setShowSetup(false);
            if (!isTethering) {
              if (onCancelTethering) onCancelTethering();
              else onCancelSetup?.();
            }
          }}
          onStart={() => {
            setShowSetup(false);
            if (!isTethering) onStartTethering();
          }}
          currentImageSrc={currentImageSrc}
          mode={isTethering ? "preferences" : "setup"}
          cameraName={cameraName}
          editingProfile={editingProfile}
          onEditingProfileChange={setEditingProfile}
          retouchPreset={retouchPreset}
          onRetouchPresetChange={setRetouchPreset}
          retouchPresetStrength={retouchPresetStrength}
          onRetouchPresetStrengthChange={setRetouchPresetStrength}
          fileFormat={fileFormat}
          onFileFormatChange={setFileFormat}
          namingTemplate={namingTemplate}
          onNamingTemplateChange={setNamingTemplate}
          destination={destination}
          onDestinationChange={setDestination}
        />
      )}
    </div>
  );
};

export default TetheringTab;
