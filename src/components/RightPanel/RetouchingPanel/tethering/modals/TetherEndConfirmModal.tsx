import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";

interface TetherEndConfirmModalProps {
  ejectMode?: "end" | "eject-end" | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const TetherEndConfirmModal = ({
  ejectMode,
  onCancel,
  onConfirm,
}: TetherEndConfirmModalProps) => {
  const isEject = ejectMode === "eject-end";
  const title = isEject ? "Eject and End Tethering?" : "End Tethering Session?";
  const description = isEject
    ? "The camera will be safely ejected and the current session will close."
    : "The camera will be disconnected and the current session will close.";
  const confirmLabel = isEject ? "Eject and End" : "End Session";

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-[#1c1c1c] border border-[#303030] rounded-[16px] p-6 flex flex-col gap-6 w-[400px]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-[20px] font-semibold text-[#e2e2e2] leading-6">{title}</h3>
            <p className="text-[14px] text-[#777] leading-5">{description}</p>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4 text-[#777]" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-[8px] bg-[#2a2a2a] text-[14px] font-medium text-[#e2e2e2] hover:bg-[#333] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2.5 bg-[#ef4444] hover:bg-[#f87171] active:bg-[#dc2626] rounded-[8px] text-[14px] font-medium text-white transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
