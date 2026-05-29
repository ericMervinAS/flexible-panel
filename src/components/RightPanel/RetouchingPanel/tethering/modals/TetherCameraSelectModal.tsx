import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import canonCover from "../../../../../assets/camerCover/canon.png";
import fujifilmCover from "../../../../../assets/camerCover/fujifilm.png";
import hasselbladCover from "../../../../../assets/camerCover/hasselblad.png";
import nikonCover from "../../../../../assets/camerCover/nilkon.png";
import sonyCover from "../../../../../assets/camerCover/sony.png";

const brandCoverMap: Record<string, string> = {
  canon: canonCover,
  fujifilm: fujifilmCover,
  hasselblad: hasselbladCover,
  nikon: nikonCover,
  sony: sonyCover,
};

function getCoverForCamera(name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const brand of Object.keys(brandCoverMap)) {
    if (lower.includes(brand)) return brandCoverMap[brand];
  }
  return undefined;
}

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
              className="group relative flex flex-col items-center justify-center flex-1 h-40 px-4 rounded-xl border border-[#161616] overflow-hidden hover:border-[#212121] transition-colors cursor-pointer"
            >
              {getCoverForCamera(cam.name) ? (
                <img
                  src={getCoverForCamera(cam.name)}
                  alt={cam.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 bg-[#161616]" />
              )}
              <div
                className="absolute inset-0 transition-opacity duration-200 opacity-100 group-hover:opacity-85 "
                style={{
                  background:
                    "linear-gradient(-47.18deg, rgba(17,17,17,0.922) 13.554%, rgba(0,0,0,0.712) 85.165%)",
                }}
              />
              <div className="relative z-10 flex flex-col gap-1 text-center">
                <span className="text-[14px] font-medium text-[#d8d8d8]">{cam.name}</span>
              </div>
            </button>
          ))}
        </div>

        {/* <div className="flex items-center justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-[8px] bg-[#2a2a2a] text-[14px] font-medium text-[#e2e2e2] hover:bg-[#333] transition-colors"
          >
            Cancel
          </button>
        </div> */}
      </div>
    </div>,
    document.body
  );
};
