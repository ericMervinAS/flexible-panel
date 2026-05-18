import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
} from "@phosphor-icons/react";
import Accordion from "../../Accordion";
import PresetDropdown from "../../PresetDropdown";
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
const QUALITY_OPTIONS = ["NEF", "JPEG", "NEF + JPEG"] as const;

// ─── Editing Profile cards ────────────────────────────────────────────────────

const EDITING_PROFILES = [
  { group: "Custom Profiles", names: ["Editorial Style", "Graicard", "Matcha", "Porta 400"] },
  {
    group: "Aftershoot Profiles",
    names: [
      "Wedding — Natural Light",
      "Wedding — Reception",
      "Portrait — Studio",
      "Portrait — Outdoor",
      "Event",
    ],
  },
];

const PROFILE_CARD_DATA: { name: string; img: string }[] = [
  { name: "Editorial Style", img: editorial_style },
  { name: "Graicard", img: graicard },
  { name: "Matcha", img: matcha },
  { name: "Porta 400", img: porta_400 },
];

interface ProfileDropdownProps {
  value: string | null;
  onChange: (v: string | null) => void;
  currentImageSrc?: string;
  cols?: number;
  maxVisible?: number;
}

const ProfileDropdown = ({
  value,
  onChange,
  currentImageSrc,
  cols = 3,
  maxVisible,
}: ProfileDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
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
    <div ref={containerRef} className="flex flex-col gap-2 w-full">
      <div
        className={`grid gap-3 w-full`}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {(maxVisible != null ? PROFILE_CARD_DATA.slice(0, maxVisible) : PROFILE_CARD_DATA).map(
          (profile) => {
            const selected = value === profile.name;
            return (
              <button
                key={profile.name}
                onClick={() => onChange(selected ? null : profile.name)}
                className="flex flex-col gap-1 items-start w-full shrink-0 text-left"
              >
                <div
                  className={`relative w-full overflow-hidden shrink-0 ${selected ? "rounded-[5px] p-px bg-white" : "rounded-[4px]"}`}
                  style={{ aspectRatio: "69/46" }}
                >
                  <img
                    src={currentImageSrc ?? profile.img}
                    alt={profile.name}
                    className="w-full h-full object-cover rounded-[4px]"
                  />
                  {selected && (
                    <div className="absolute inset-[3px] rounded-[3px] ring-1 ring-[#1c1c1c] pointer-events-none" />
                  )}
                </div>
                <span
                  className={`text-[11px] font-medium leading-[12px] truncate w-full ${selected ? "text-[#e2e2e2]" : "text-[#777]"}`}
                >
                  {profile.name}
                </span>
              </button>
            );
          }
        )}

        {/* View All */}
        <button
          onClick={() => setOpen((p) => !p)}
          className="flex flex-col gap-1 items-start w-full shrink-0 text-left"
        >
          <div
            className="relative w-full rounded-[4px] overflow-hidden bg-[#242424] flex items-center justify-center shrink-0"
            style={{ aspectRatio: "69/46" }}
          >
            <div className="grid grid-cols-2 gap-[3px]">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="w-[14px] h-[14px] rounded-[2px] bg-[#2e2e2e]" />
              ))}
            </div>
          </div>
          <span className="text-[10px] font-medium leading-[12px] text-[#777] truncate w-full">
            View All
          </span>
        </button>
      </div>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="bg-[#242424] border border-[#474747] rounded-lg p-1 flex flex-col gap-0.5 max-h-72 overflow-y-auto"
          >
            {EDITING_PROFILES.map((section, si) => (
              <div key={section.group}>
                {si > 0 && <div className="h-px bg-[#474747] mx-1 my-0.5" />}
                <div className="px-2 py-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#777] leading-4">
                    {section.group}
                  </span>
                </div>
                {section.names.map((name) => (
                  <button
                    key={name}
                    onClick={() => {
                      onChange(name);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-2 py-2.5 rounded text-[13px] font-medium transition-colors ${
                      name === value
                        ? "text-[#e2e2e2] bg-white/5"
                        : "text-[#ababab] hover:bg-white/5"
                    }`}
                  >
                    {name}
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

// ─── Tether Detect Modal ─────────────────────────────────────────────────────

interface TetherDetectModalProps {
  onCancel: () => void;
  onDetected: () => void;
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
      else onDetected();
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
  retouchPreset: string | null;
  onRetouchPresetChange: (v: string | null) => void;
  fileFormat: string[];
  onFileFormatChange: (v: string[]) => void;
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
  editingProfile,
  onEditingProfileChange,
  retouchPreset,
  onRetouchPresetChange,
  fileFormat,
  onFileFormatChange,
  namingTemplate,
  onNamingTemplateChange,
  destination,
  onDestinationChange,
}: TetherSetupModalProps) => {
  const isPreferences = mode === "preferences";
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Extract the user's prefix from a {Prefix}_… template (if present).
  const prefixMatch = namingTemplate.match(/\{Prefix:([^}]*)\}/);
  const userPrefix = prefixMatch?.[1] ?? "";

  // Pattern presets — concrete, named, with their own template strings.
  const NAMING_PATTERNS: Array<{ id: string; label: string; template: string; needsPrefix?: boolean }> = [
    { id: "date-seq", label: "Date + Sequence", template: "{Date}_{Counter:0001}" },
    { id: "prefix-seq", label: "Prefix + Sequence", template: "{Prefix:Smith}_{Counter:0001}", needsPrefix: true },
    { id: "date-prefix-seq", label: "Date + Prefix + Sequence", template: "{Date}_{Prefix:Smith}_{Counter:0001}", needsPrefix: true },
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

  const applyPattern = (p: typeof NAMING_PATTERNS[number]) => {
    if (p.needsPrefix && userPrefix) {
      onNamingTemplateChange(p.template.replace(/\{Prefix:[^}]*\}/, `{Prefix:${userPrefix}}`));
    } else {
      onNamingTemplateChange(p.template);
    }
  };

  const updatePrefix = (next: string) => {
    const sanitized = next.replace(/[/\\:*?"<>|{}]/g, "");
    if (namingTemplate.includes("{Prefix:")) {
      onNamingTemplateChange(namingTemplate.replace(/\{Prefix:[^}]*\}/, `{Prefix:${sanitized || "Smith"}}`));
    }
  };

  const previewFor = (tpl: string) =>
    tpl
      .replace("{Date}", "2026-05-15")
      .replace(/\{Prefix:([^}]*)\}/, (_m, p) => userPrefix || p)
      .replace(/\{Counter(?::[^}]*)?\}/, "0001")
      .replace("{CameraModel}", "NikonZ6III")
      .concat(".NEF");

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
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#4ade80] shrink-0" />
              <span className="text-[14px] font-medium text-[#e2e2e2]">Nikon Z6 III</span>
            </div>
            <span className="text-[13px] text-[#777]">Connected</span>
          </div>
        </div>

        {/* Editing Profile */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#777]">
              Editing Profile
            </span>
            <span className="text-[11px] text-[#555]">Auto applied</span>
          </div>
          <ProfileDropdown
            value={editingProfile}
            onChange={onEditingProfileChange}
            cols={4}
            maxVisible={3}
            currentImageSrc={currentImageSrc}
          />
        </div>

        {/* Retouching Preset */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#777]">
              Retouching Preset
            </span>
            <span className="text-[11px] text-[#555]">Auto applied</span>
          </div>
          <PresetDropdown value={retouchPreset} onChange={onRetouchPresetChange} />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#777]">
              File Format
            </span>
          </div>

          <div className="flex gap-2">
            {(["NEF", "JPEG"] as const).map((fmt) => {
              const selected = fileFormat.includes(fmt);
              return (
                <button
                  key={fmt}
                  onClick={() => {
                    const next = selected
                      ? fileFormat.filter((f) => f !== fmt)
                      : [...fileFormat, fmt];
                    if (next.length > 0) onFileFormatChange(next);
                  }}
                  className={`h-[28px] px-2 rounded-[4px] text-[13px] bg-[#242424] transition-colors border-[0.5px] ${
                    selected
                      ? "border-[#777] text-[#e2e2e2]"
                      : "border-transparent text-[#ababab] hover:border-[#474747]"
                  }`}
                >
                  {fmt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Info banner */}
        {/* <div className="px-2 py-1.5 bg-[#242424] rounded-[8px] border border-[#303030]">
          <span className="text-[13px] text-[#ffffff] opacity-50">Presets auto-apply to every image. Change later in sidebar.</span>
        </div> */}

        {/* Safety badges */}
        {/* <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[#555]">
            <LockSimple size={13} />
            <span className="text-[12px]">Originals are safe.</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#555]">
            <ShieldCheck size={13} />
            <span className="text-[12px]">No edits are destructively applied.</span>
          </div>
        </div> */}

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
                  // className="group flex items-center gap-2 px-3 py-2.5 bg-[#242424] hover:bg-[#2a2a2a] border border-[#303030] hover:border-[#444] rounded-[8px] text-left transition-colors"
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
                          <span className={`text-[12px] font-medium ${active ? "text-[#e2e2e2]" : "text-[#ababab]"}`}>
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
            {/* {!isPreferences && <ArrowRight size={15} weight="bold" />} */}
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
  const [apertureIdx, setApertureIdx] = useState(5); // f/5.6
  const [shutterIdx, setShutterIdx] = useState(4); // 1/300
  const [isoIdx, setIsoIdx] = useState(1); // 200
  const [wb, setWb] = useState("Auto");
  const [destination, setDestination] = useState("/Users/photographer/Desktop/Shoot");
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [retouchPreset, setRetouchPreset] = useState<string | null>(null);
  const [fileFormat, setFileFormat] = useState<string[]>(["NEF", "JPEG"]);

  const qualityLabel =
    fileFormat.includes("NEF") && fileFormat.includes("JPEG")
      ? "NEF + JPEG"
      : (fileFormat[0] ?? "NEF");

  const handleQualityChange = (v: string) => {
    if (v === "NEF + JPEG") setFileFormat(["NEF", "JPEG"]);
    else setFileFormat([v]);
  };
  const [namingTemplate, setNamingTemplate] = useState("{Date}_{Counter:0001}");
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [draggingCard, setDraggingCard] = useState<string | null>(null);
  const [autoAdvanceHovered, setAutoAdvanceHovered] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showDetect, setShowDetect] = useState(!isTethering);
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
            <button
              data-coachmark="capture-btn"
              onClick={() => onCapture?.(autoAdvance)}
              className="w-full py-2 pl-2 pr-3 bg-[#2563eb] hover:bg-[#3b7af5] active:bg-[#1d4ed8] rounded flex items-center justify-center gap-1.5 transition-colors"
            >
              <CameraIcon size={16} />
              <span className="text-[12px] font-medium text-white">Capture</span>
            </button>

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
                  Quality
                </span>
                <InlineSelect
                  value={qualityLabel}
                  options={QUALITY_OPTIONS}
                  onChange={handleQualityChange}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ababab]">
                  Model
                </span>
                <span className="text-[12px] font-medium text-[#ababab]">Nikon Z6 III</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ababab]">
                  Battery
                </span>
                <div className="flex items-center gap-1.5 text-[#ababab]">
                  <BatteryHigh size={16} />
                  <span className="text-[12px] font-medium">78%</span>
                </div>
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
              <ProfileDropdown
                value={editingProfile}
                onChange={setEditingProfile}
                currentImageSrc={currentImageSrc}
              />
            </Accordion>
          </div>

          <div className="h-px bg-[#e2e2e20d]" />

          {/* ── Retouching Preset ── */}
          <div data-coachmark="retouch-preset">
            <Accordion
              title="Retouching Preset"
              actions={
                <span className="text-[11px] font-medium text-[#777]">Auto Applied on next</span>
              }
            >
              <PresetDropdown value={retouchPreset} onChange={setRetouchPreset} />
            </Accordion>
          </div>
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
          onDetected={() => {
            setShowDetect(false);
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
          editingProfile={editingProfile}
          onEditingProfileChange={setEditingProfile}
          retouchPreset={retouchPreset}
          onRetouchPresetChange={setRetouchPreset}
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
