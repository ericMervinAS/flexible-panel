import { useState, useEffect, useMemo } from "react";
import TopBar from "@/components/TopBar";
import Toast from "@/components/Toast";
import FilterBar from "@/components/FilterBar";
import ImageGrid from "@/components/ImageGrid";
import type { ImageData } from "@/components/ImageGrid";
import RightPanel from "@/components/RightPanel";
import BottomBar from "@/components/BottomBar";
import LoupeView from "@/components/LoupeView";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { useDistractionDetection } from "@/hooks/useDistractionDetection";
import { MODEL_TO_UI } from "@/lib/distractionDetection";

interface IndexProps {
  importSource: "sample" | ImageData[];
}

const Index = ({ importSource }: IndexProps) => {
  const [columns, setColumns] = useState(4);
  const [isScanning, setIsScanning] = useState(true);
  const [view, setView] = useState<"grid" | "loupe">("grid");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [images, setImages] = useState<ImageData[]>([]);
  const [loupeActiveTab, setLoupeActiveTab] = useState("subject");
  const [canvasHasStrokes, setCanvasHasStrokes] = useState(false);
  const [clearCanvasSignal, setClearCanvasSignal] = useState(0);
  const [autoRemoveAfterStroke, setAutoRemoveAfterStroke] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState<number[]>([]);
  const [highlightedLabels, setHighlightedLabels] = useState<Set<string>>(new Set());
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [removeToast, setRemoveToast] = useState<{ message: string; key: number; ctaLabel?: string } | null>(null);

  const handleRemoveSuccess = (count: number, brushOnly: boolean) => {
    const message = brushOnly
      ? "Object Removed Successfully"
      : `${count} Object${count === 1 ? "" : "s"} Removed Successfully`;
    setRemoveToast({ message, key: Date.now(), ctaLabel: "Undo" });
  };

  const handleSuggestObject = (_suggestion: string) => {
    setRemoveToast({ message: "Suggestion submitted", key: Date.now() });
  };

  // Hardcoded manual set — swap for real detection output when ready
  const retouchOpportunities = new Set([0, 2, 4]);

  const { modelSubjects, modelImageMap, isDetecting, isLoadingModel, statusMessage, detectionProgress } =
    useFaceDetection(images);

  const {
    distractionMap,
    isDetecting: isDistractionDetecting,
    isLoadingModel: isDistractionModelLoading,
    rerun: rerunDistractionDetection,
    rerunSingle: rerunDistractionDetectionForImage,
  } = useDistractionDetection(images);

  const filteredImages = useMemo(() => {
    const mapped = images.map((img, i) => ({ ...img, originalIndex: i }));
    if (!subjectFilter.length) return mapped;
    return mapped.filter(({ originalIndex }) => {
      const clusters = modelImageMap.get(originalIndex);
      if (!clusters) return false;
      return subjectFilter.some((id) => clusters.includes(id));
    });
  }, [images, subjectFilter, modelImageMap]);

  const highlightedDetections = useMemo(() => {
    if (!highlightedLabels.size) return [];
    const imageDets = distractionMap?.get(selectedIndex) ?? [];
    return imageDets.filter((det) => highlightedLabels.has(MODEL_TO_UI[det.label]));
  }, [distractionMap, selectedIndex, highlightedLabels]);

  const hoveredDetections = useMemo(() => {
    if (!hoveredLabel || highlightedLabels.has(hoveredLabel)) return [];
    const imageDets = distractionMap?.get(selectedIndex) ?? [];
    return imageDets.filter((det) => MODEL_TO_UI[det.label] === hoveredLabel);
  }, [distractionMap, selectedIndex, hoveredLabel, highlightedLabels]);

  const visibleSubjectIndices = null;

  useEffect(() => {
    const timer = setTimeout(() => setIsScanning(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleOpenLoupe = (index: number) => {
    if (!images[index]) return;
    setSelectedIndex(index);
    setView("loupe");
  };

  const handleViewChange = (v: "grid" | "loupe") => {
    setView(v);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <TopBar activeTab="RETOUCH" view={view} onViewChange={handleViewChange} filterOpen={filterOpen} onFilterToggle={() => setFilterOpen((v) => !v)} />
      <div className="flex flex-1 overflow-hidden">
        {/* Left: content area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div style={{ display: "grid", gridTemplateRows: filterOpen ? "1fr" : "0fr", transition: "grid-template-rows 120ms cubic-bezier(0.25, 0, 0.25, 1)", willChange: "grid-template-rows" }}>
            <div style={{ overflow: "hidden" }}>
              <FilterBar
                onPeopleFilter={setSubjectFilter}
                modelSubjects={modelSubjects}
                isModelDetecting={isDetecting || isLoadingModel}
                detectionProgress={detectionProgress}
              />
            </div>
          </div>
          {view === "grid" ? (
            <>
              <ImageGrid columns={columns} isScanning={isScanning} onImageDoubleClick={handleOpenLoupe} onImagesChange={setImages} subjectFilter={subjectFilter} modelImageMap={modelImageMap} initialSelectedIndex={selectedIndex} importSource={importSource} />
              <BottomBar
                mode="grid"
                columns={columns}
                onColumnsChange={setColumns}
                totalPhotos={1562}
                visiblePhotos={232}
                albumName="Juliana Wedding"
              />
            </>
          ) : (
            images[selectedIndex]
              ? <LoupeView
                image={images[selectedIndex]}
                images={images}
                filteredImages={filteredImages}
                currentIndex={selectedIndex}
                totalImages={images.length}
                onSelectImage={setSelectedIndex}
                onGoToGrid={() => setView("grid")}
                isPatchActive={loupeActiveTab === "patch"}
                onHasStrokesChange={setCanvasHasStrokes}
                clearCanvasSignal={clearCanvasSignal}
                autoRemoveAfterStroke={autoRemoveAfterStroke}
                isExternallyRemoving={isRemoving}
                highlightedDetections={highlightedDetections}
                hoveredDetections={hoveredDetections}
                onCanvasRemoveSuccess={() => handleRemoveSuccess(1, true)}
              />
              : null
          )}
        </div>
        <RightPanel isScanning={isScanning} isLoupeView={view === "loupe"} currentImageIndex={selectedIndex} onTabChange={setLoupeActiveTab} canvasHasStrokes={canvasHasStrokes} onClearCanvas={() => setClearCanvasSignal((s) => s + 1)} onRemoveAfterStrokeChange={setAutoRemoveAfterStroke} onRemovingChange={setIsRemoving} visibleSubjectIndices={visibleSubjectIndices} modelSubjects={modelSubjects} modelImageMap={modelImageMap} isModelDetecting={isDetecting || isLoadingModel} modelStatusMessage={statusMessage} modelSubjectFilter={subjectFilter} tabOverride={null} hasRetouchingOpportunity={retouchOpportunities.has(selectedIndex)} distractionMap={distractionMap} isDistractionScanning={isDistractionModelLoading || isDistractionDetecting} onDistractionRerun={rerunDistractionDetection} onDistractionRerunCurrent={() => rerunDistractionDetectionForImage(selectedIndex)} onDistractionSelectionChange={setHighlightedLabels} onDistractionHoverChange={setHoveredLabel} onDistractionRemoveSuccess={handleRemoveSuccess} onSuggestObject={handleSuggestObject} />
      </div>
      {removeToast && (
        <Toast
          key={removeToast.key}
          message={removeToast.message}
          ctaLabel={removeToast.ctaLabel}
          onDismiss={() => setRemoveToast(null)}
        />
      )}
    </div>
  );
};

export default Index;
