import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  label: string;
  visible: boolean;
  prefix?: string;
  position?: "top" | "bottom";
}

const Tooltip = ({ label, visible, prefix, position = "bottom" }: TooltipProps) => {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!visible || !anchorRef.current) return;
    const update = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      setCoords({ left: rect.left + rect.width / 2, top: position === "bottom" ? rect.bottom : rect.top });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [visible, position]);

  const slideHiddenPx = position === "bottom" ? -4 : 4;
  const translateY = visible ? 0 : slideHiddenPx;

  return (
    <>
      <span
        ref={anchorRef}
        aria-hidden
        className={`absolute left-1/2 w-0 h-0 pointer-events-none ${position === "bottom" ? "top-full" : "bottom-full"}`}
      />
      {coords && createPortal(
        <div
          className="fixed z-[1000] pointer-events-none transition-all duration-150"
          style={{
            left: coords.left,
            top: coords.top,
            transform: `translateX(-50%) translateY(calc(${position === "bottom" ? "4px" : "calc(-100% - 4px)"} + ${translateY}px))`,
            opacity: visible ? 1 : 0,
            transitionDelay: visible ? "300ms" : "0ms",
          }}
        >
          <span className="flex items-center gap-[6px] whitespace-nowrap px-[6px] py-[4px] bg-[#f6f6f6] rounded-[4px]">
            {prefix && <span className="text-[11px] font-medium leading-[12px] text-[#474747]">{prefix}</span>}
            <span className="text-[11px] font-medium leading-[12px] text-[#474747]">{label}</span>
          </span>
        </div>,
        document.body,
      )}
    </>
  );
};

export default Tooltip;
