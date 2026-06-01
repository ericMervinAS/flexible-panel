import { createPortal } from "react-dom";
import {
  X,
  Stack,
  Monitor,
  Keyboard,
  LockSimple,
  ShieldCheck,
  ArrowRight,
} from "@phosphor-icons/react";

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

export const TetherWelcomeModal = ({ onClose }: TetherWelcomeModalProps) => {
  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#1c1c1c] border border-[#303030] rounded-[16px] p-6 flex flex-col gap-5 w-[480px]">
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
