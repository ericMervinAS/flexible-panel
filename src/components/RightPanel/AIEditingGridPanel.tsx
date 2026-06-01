import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CaretDown } from "@phosphor-icons/react";

const AI_PROFILES = [
  "Natural & Bright",
  "Moody & Dark",
  "Film Emulation",
  "High Contrast",
  "Soft & Airy",
];

const Toggle = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative w-8 h-[18px] rounded-full transition-colors shrink-0 ${
      checked ? "bg-[#2563eb]" : "bg-[#383838]"
    }`}
  >
    <span
      className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${
        checked ? "translate-x-[18px]" : "translate-x-[2px]"
      }`}
    />
  </button>
);

const AIEditingGridPanel = () => {
  const [profile, setProfile] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [aiCropping, setAiCropping] = useState(false);
  const [aiStraighten, setAiStraighten] = useState(false);
  const [aiMask, setAiMask] = useState(false);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
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
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-5 flex flex-col gap-0">
          {/* AI Profile Dropdown */}
          <div className="mb-5">
            <button
              ref={triggerRef}
              onClick={() => setOpen((v) => !v)}
              className={`flex w-full items-center justify-between px-2.5 py-2 bg-[#242424] rounded text-[12px] transition-colors ${
                profile ? "text-[#e2e2e2]" : "text-[#777] hover:text-[#ababab]"
              }`}
            >
              <span>{profile ?? "Select AI Profile"}</span>
              <CaretDown className="w-4 h-4 shrink-0" />
            </button>

            {open &&
              createPortal(
                <div
                  ref={menuRef}
                  style={menuStyle}
                  className="bg-[#242424] border border-[#474747] rounded-lg p-1 flex flex-col gap-0.5"
                >
                  {AI_PROFILES.map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setProfile(p);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-2 py-2.5 rounded text-[13px] font-medium transition-colors hover:bg-white/5 ${
                        profile === p ? "text-[#e2e2e2]" : "text-[#ababab]"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>,
                document.body
              )}
          </div>

          {/* Toggle rows */}
          <div className="flex flex-col">
            <div className="h-px bg-[#e2e2e20d]" />
            <button
              onClick={() => setAiCropping((v) => !v)}
              className="flex items-center justify-between py-3.5"
            >
              <span className="text-[13px] font-medium text-[#ababab]">AI Cropping</span>
              <Toggle checked={aiCropping} onChange={setAiCropping} />
            </button>
            <div className="h-px bg-[#e2e2e20d]" />
            <button
              onClick={() => setAiStraighten((v) => !v)}
              className="flex items-center justify-between py-3.5"
            >
              <span className="text-[13px] font-medium text-[#ababab]">AI Straighten</span>
              <Toggle checked={aiStraighten} onChange={setAiStraighten} />
            </button>
            <div className="h-px bg-[#e2e2e20d]" />
            <button
              onClick={() => setAiMask((v) => !v)}
              className="flex items-center justify-between py-3.5"
            >
              <span className="text-[13px] font-medium text-[#ababab]">AI Mask</span>
              <Toggle checked={aiMask} onChange={setAiMask} />
            </button>
            <div className="h-px bg-[#e2e2e20d]" />
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="p-4">
        <button className="w-full py-2 rounded text-[12px] font-medium transition-colors bg-[#2563eb] text-white hover:bg-[#1d56d1]">
          Start AI Editing
        </button>
      </div>
    </div>
  );
};

export default AIEditingGridPanel;
