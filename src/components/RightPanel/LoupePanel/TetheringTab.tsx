import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { FolderOpen, CaretDown } from "@phosphor-icons/react";
import Accordion from "../../Accordion";
import PresetDropdown from "../../PresetDropdown";

// ─── Mock camera data ──────────────────────────────────────────────────────────
// Will be replaced by live tethering values once the connection layer is wired up.

const CAMERA_STATS = [
  { label: "Aperture",      value: "f/2.8"   },
  { label: "Shutter",       value: "1/250s"  },
  { label: "ISO",           value: "400"     },
  { label: "White Balance", value: "Auto"    },
] as const;

const IMAGE_TYPE_OPTIONS = ["RAW", "JPEG", "RAW + JPEG"] as const;
type ImageType = typeof IMAGE_TYPE_OPTIONS[number];

const EDITING_PROFILES = [
  { group: "Custom Profiles",     names: ["My Wedding Profile", "Studio Portraits"] },
  { group: "Aftershoot Profiles", names: ["Wedding — Natural Light", "Wedding — Reception", "Portrait — Studio", "Portrait — Outdoor", "Event"] },
];

// ─── Editing Profile Dropdown ─────────────────────────────────────────────────

interface ProfileDropdownProps {
  value: string | null;
  onChange: (v: string) => void;
}

const ProfileDropdown = ({ value, onChange }: ProfileDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef   = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuStyle({ position: "fixed", top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handleClickOutside = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <div className="relative flex-1">
      <button
        ref={triggerRef}
        onClick={() => setOpen((p) => !p)}
        className={`flex w-full items-center justify-between px-2.5 py-2 bg-[#242424] rounded text-[12px] transition-colors ${value ? "text-[#e2e2e2]" : "text-[#777] hover:text-[#ababab]"}`}
      >
        <span>{value ?? "Select Profile"}</span>
        <CaretDown className="w-4 h-4 shrink-0" />
      </button>

      {open && createPortal(
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
                  onClick={() => { onChange(name); setOpen(false); }}
                  className="w-full text-left px-2 py-2.5 rounded text-[13px] font-medium text-[#ababab] hover:bg-white/5 transition-colors"
                >
                  {name}
                </button>
              ))}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
};

// ─── TetheringTab ─────────────────────────────────────────────────────────────

const TetheringTab = () => {
  const [imageType,      setImageType]      = useState<ImageType>("RAW");
  const [destination,    setDestination]    = useState("/Users/photographer/Desktop/Shoot");
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [retouchPreset,  setRetouchPreset]  = useState<string | null>(null);

  return (
    <div
      className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4"
      style={{ scrollbarWidth: "none" }}
    >
      {/* ── Camera Info ── */}
      <Accordion title="Camera">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3.5">
          {CAMERA_STATS.map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-[0.5px] text-[#777]">{label}</span>
              <span className="text-[13px] font-medium text-[#e2e2e2]">{value}</span>
            </div>
          ))}

          {/* Image Type — full-width row */}
          <div className="col-span-2 flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.5px] text-[#777]">Image Type</span>
            <div className="flex gap-1.5">
              {IMAGE_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setImageType(opt)}
                  className={`flex-1 py-1.5 rounded text-[11px] font-medium transition-colors ${
                    imageType === opt
                      ? "bg-[#303030] text-[#e2e2e2]"
                      : "bg-[#1e1e1e] text-[#777] hover:text-[#ababab]"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Accordion>

      <div className="h-px bg-[#e2e2e20d]" />

      {/* ── Destination Folder ── */}
      <Accordion title="Destination">
        <div className="flex items-center gap-2 px-2.5 py-2 bg-[#242424] rounded">
          <span className="flex-1 text-[12px] text-[#ababab] truncate leading-4">
            {destination || "No folder selected"}
          </span>
          <button className="shrink-0 text-[#777] hover:text-[#e2e2e2] transition-colors">
            <FolderOpen size={16} />
          </button>
        </div>
      </Accordion>

      <div className="h-px bg-[#e2e2e20d]" />

      {/* ── Editing Profile ── */}
      <Accordion title="Editing Profile">
        <ProfileDropdown value={editingProfile} onChange={setEditingProfile} />
      </Accordion>

      <div className="h-px bg-[#e2e2e20d]" />

      {/* ── Retouching Preset ── */}
      <Accordion title="Retouching Preset">
        <PresetDropdown value={retouchPreset} onChange={setRetouchPreset} />
      </Accordion>
    </div>
  );
};

export default TetheringTab;
