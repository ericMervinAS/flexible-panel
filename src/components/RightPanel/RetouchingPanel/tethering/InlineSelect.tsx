import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CaretDown } from "@phosphor-icons/react";

export interface InlineSelectProps {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}

export const InlineSelect = ({ value, options, onChange }: InlineSelectProps) => {
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
