import { ScissorsIcon, LightningIcon, CaretRightIcon, BandaidsIcon } from "@phosphor-icons/react";

interface PreCullRightPanelProps {
  onCull: () => void;
  onEdit: () => void;
  onRetouch: () => void;
  onOneClickCullEdit: () => void;
}

const PreCullRightPanel = ({
  onCull,
  onRetouch,
  onEdit,
  onOneClickCullEdit,
}: PreCullRightPanelProps) => {
  return (
    <aside className="w-[344px] min-w-[344px] bg-[#1c1c1c] flex flex-col border-l border-background p-3 gap-4">
      {/* Culling */}
      <button
        onClick={onCull}
        className="bg-[#242424] hover:bg-[#2a2a2a] transition-colors rounded-lg p-3 flex items-center justify-between gap-3 text-left w-full"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <ScissorsIcon size={20} className="text-[#e2e2e2] shrink-0" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="text-[14px] font-semibold leading-5 text-[#e2e2e2]">AI Culling</p>
            <p className="text-[12px] leading-4 text-[#ababab]">
              Let AI pick your best shots and set aside the rest for quick review
            </p>
          </div>
        </div>
        <CaretRightIcon size={12} className="text-[#ababab] shrink-0" />
      </button>

      <button
        onClick={onEdit}
        className="bg-[#242424] hover:bg-[#2a2a2a] transition-colors rounded-lg p-3 flex items-center justify-between gap-3 text-left w-full"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <BandaidsIcon size={20} className="text-[#e2e2e2] shrink-0" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="text-[14px] font-semibold leading-5 text-[#e2e2e2]">AI Editing</p>
            <p className="text-[12px] leading-4 text-[#ababab]">
              Automate your editing with AI Profiles built for you
            </p>
          </div>
        </div>
        <CaretRightIcon size={12} className="text-[#ababab] shrink-0" />
      </button>

      <button
        onClick={onRetouch}
        className="bg-[#242424] hover:bg-[#2a2a2a] transition-colors rounded-lg p-3 flex items-center justify-between gap-3 text-left w-full"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <BandaidsIcon size={20} className="text-[#e2e2e2] shrink-0" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="text-[14px] font-semibold leading-5 text-[#e2e2e2]">Retouching</p>
            <p className="text-[12px] leading-4 text-[#ababab]">
              Clean up and perfect your images fast with AI retouching
            </p>
          </div>
        </div>
        <CaretRightIcon size={12} className="text-[#ababab] shrink-0" />
      </button>

      {/* Divider */}
      <div className="h-px w-full bg-[#2a2a2a]" />

      {/* One Click Cull & Edit */}
      <button
        onClick={onOneClickCullEdit}
        className="bg-[#242424] hover:bg-[#2a2a2a] transition-colors rounded-lg p-3 flex items-center justify-between gap-3 text-left w-full"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <LightningIcon size={20} weight="fill" className="text-[#ffa15a] shrink-0" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <p
              className="text-[14px] font-semibold leading-5 bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(0deg, #FFD141 -10%, #FF7272 111.78%)",
              }}
            >
              One Click Cull &amp; Edit
            </p>
            <p className="text-[12px] leading-4 text-[#ababab]">
              Start once and let Aftershoot AI take care of both culling and editing
            </p>
          </div>
        </div>
        <CaretRightIcon size={12} className="text-[#ababab] shrink-0" />
      </button>
    </aside>
  );
};

export default PreCullRightPanel;
