import SubjectSync from "./SubjectSync";
import SmartObjectRemoval from "./SmartObjectRemoval";

interface RightPanelProps {
  isScanning: boolean;
}

const RightPanel = ({ isScanning }: RightPanelProps) => {
  return (
    <aside className="w-[320px] min-w-[320px] bg-surface-overlay border-l border-border flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <SubjectSync isScanning={isScanning} />
        <div className="h-px bg-border mx-5" />
        <SmartObjectRemoval isScanning={isScanning} />
      </div>
      <div className="p-4 border-t border-border">
        <button className="w-full py-2.5 rounded-lg text-sm font-medium text-foreground bg-gradient-to-r from-info to-success hover:opacity-90 transition-opacity">
          Start AI Retouching
        </button>
      </div>
    </aside>
  );
};

export default RightPanel;
