import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";

interface TetherCameraSelectModalProps {
  onCancel: () => void;
  onSelect: (camera: string) => void;
}

export const TetherCameraSelectModal = ({ onCancel, onSelect }: TetherCameraSelectModalProps) => {
  const cameras = [
    { name: "Nikon Z6 III", subtitle: "Connected via USB" },
    { name: "Canon EOS R6 Mark II", subtitle: "Connected via USB" },
  ];

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-[#1c1c1c] border border-[#303030] rounded-[16px] p-6 flex flex-col gap-6 w-[480px]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-[20px] font-semibold text-[#e2e2e2] leading-6">
              Two cameras detected
            </h3>
            <p className="text-[14px] text-[#777] leading-5">
              Choose which one to use for this session.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4 text-[#777]" />
          </button>
        </div>

        <div className="flex gap-3">
          {cameras.map((cam) => (
            <button
              key={cam.name}
              onClick={() => onSelect(cam.name)}
              className="group flex flex-col items-center gap-4 flex-1 py-8 px-4 rounded-xl border border-[#161616] bg-[#161616] hover:border-[#212121] hover:bg-[#1e1e1e] transition-colors cursor-pointer"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#666"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="group-hover:stroke-[#ababab] transition-colors"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <div className="flex flex-col gap-1 text-center">
                <span className="text-[14px] font-medium text-[#d8d8d8]">{cam.name}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-[8px] bg-[#2a2a2a] text-[14px] font-medium text-[#e2e2e2] hover:bg-[#333] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
