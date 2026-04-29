import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Check } from "@phosphor-icons/react";

// ─── Toast ────────────────────────────────────────────────────────────────────
// Floating success/info toast.
// Layout & motion: based on the Index.tsx design (rounded green check badge,
//   px-4 py-2.5 pill, slide-in-from-bottom).
// Palette: matches Figma node 6814:16156 — light surface (#fafafa),
//   dark inverse text (#474747), accent CTA (#2563eb).
//
// Usage:
//   {toast && (
//     <Toast
//       key={toast.id}
//       message={toast.message}
//       ctaLabel="Undo"
//       onCtaClick={handleUndo}
//       onDismiss={() => setToast(null)}
//     />
//   )}
// Re-mount with a fresh `key` to retrigger the slide-in animation.

export interface ToastProps {
  message: string;
  /** Optional accent CTA shown on the right (e.g. "Undo"). */
  ctaLabel?: string;
  onCtaClick?: () => void;
  /** Auto-dismiss after this many ms. Set to 0 to disable. Default 3000. */
  duration?: number;
  /** Called when the toast should unmount (auto-dismiss or CTA click). */
  onDismiss?: () => void;
  /** Tailwind class for vertical offset from the bottom. Default `bottom-16`. */
  bottomClassName?: string;
}

const Toast = ({
  message,
  ctaLabel,
  onCtaClick,
  duration = 3000,
  onDismiss,
  bottomClassName = "bottom-16",
}: ToastProps) => {
  useEffect(() => {
    if (!duration || !onDismiss) return;
    const t = window.setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);

  return createPortal(
    // Outer wrapper handles horizontal centering. Inner wrapper owns the
    // animation transform so the two don't collide on the `transform` property.
    <div className={`fixed ${bottomClassName} left-1/2 -translate-x-1/2 z-[100] pointer-events-none`}>
      <div
        className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#fafafa] animate-in fade-in slide-in-from-bottom-8 duration-300 ease-out"
        style={{ boxShadow: "0px 8px 24px rgba(0,0,0,0.24), 0px 1px 2px rgba(0,0,0,0.12)" }}
      >
        <div className="w-5 h-5 rounded-full bg-[#16a34a] flex items-center justify-center shrink-0">
          <Check className="w-3 h-3 text-white" weight="bold" />
        </div>
        <span className="text-[13px] font-medium text-[#474747] leading-5">
          {message}
        </span>
        {ctaLabel && (
          <button
            onClick={() => {
              onCtaClick?.();
              onDismiss?.();
            }}
            className="text-[13px] font-medium leading-5 text-[#2563eb] hover:opacity-80 transition-opacity"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Toast;
