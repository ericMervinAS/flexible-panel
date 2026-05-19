import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { MOCK_DETECTED_CAMERAS } from "../constants";

interface TetherDetectModalProps {
  onCancel: () => void;
  onDetected: (cameras: string[]) => void;
}

export const TetherDetectModal = ({ onCancel, onDetected }: TetherDetectModalProps) => {
  const [phase, setPhase] = useState<"detecting" | "not-found">("detecting");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (phase !== "detecting") return;
    const t = setTimeout(() => {
      const shouldFail = attempt === 0 && Math.random() < 2 / 3;
      if (shouldFail) setPhase("not-found");
      else {
        onDetected(MOCK_DETECTED_CAMERAS);
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [phase, attempt, onDetected]);

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-[#1c1c1c] border border-[#303030] rounded-[16px] p-6 flex flex-col gap-6 w-[480px]">
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
