import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";

interface SuggestObjectModalProps {
  onClose: () => void;
  onSubmit: (suggestion: string) => void;
}

const SuggestObjectModal = ({ onClose, onSubmit }: SuggestObjectModalProps) => {
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(trimmed);
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-[#1c1c1c] border border-[#303030] rounded-[12px] p-5 flex flex-col gap-4 w-[448px]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1 pt-0.5">
            <h3 className="text-[16px] font-semibold text-[#e2e2e2] leading-5">
              Suggest a New Object Type
            </h3>
            <p className="text-[14px] font-normal text-[#ababab] leading-5">
              Tell us what other objects you'd like us to detect and remove.
              We'll consider it for a future update.
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4 text-[#777]" />
          </button>
        </div>

        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            else if (e.key === "Escape") onClose();
          }}
          placeholder="e.g., Power lines, Trash bins, Microphones…"
          className="w-full h-10 px-3 rounded-[6px] bg-[#111] border border-[#2563eb] text-[13px] text-[#e2e2e2] placeholder:text-[#555] outline-none shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
        />

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-[#303030] text-[14px] font-medium text-[#e2e2e2] hover:bg-[#3a3a3a] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`px-4 py-2 rounded text-[14px] font-medium transition-colors ${
              canSubmit
                ? "bg-[#2563eb] text-white hover:bg-[#1d56d1] cursor-pointer"
                : "bg-[#1e2a45] text-[#474747] cursor-not-allowed"
            }`}
          >
            Submit
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SuggestObjectModal;
