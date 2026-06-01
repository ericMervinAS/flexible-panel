import TetheringTab from "./RetouchingPanel/TetheringTab";

interface TetherPanelProps {
  currentImageSrc?: string;
  isTethering: boolean;
  isLoupeView?: boolean;
  onStartTethering: () => void;
  onCancelTethering?: () => void;
  onCapture?: (autoAdvance: boolean, captureInfo: { addRaw: boolean; addJpeg: boolean; rawExt: string }) => void;
  skipTetheringDetect?: boolean;
  directPanel?: boolean;
}

const TetherPanel = ({
  currentImageSrc,
  isTethering,
  isLoupeView = false,
  onStartTethering,
  onCancelTethering,
  onCapture,
  skipTetheringDetect = false,
  directPanel = false,
}: TetherPanelProps) => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TetheringTab
        currentImageSrc={currentImageSrc}
        isTethering={isTethering}
        isLoupeView={isLoupeView}
        onStartTethering={onStartTethering}
        onCancelTethering={onCancelTethering}
        onCapture={onCapture}
        skipDetect={skipTetheringDetect}
        directPanel={directPanel}
      />
    </div>
  );
};

export default TetherPanel;
