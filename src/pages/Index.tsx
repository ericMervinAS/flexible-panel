import { useState, useEffect, useMemo } from "react";
import TopBar from "@/components/TopBar";
import Toast from "@/components/Toast";
import FilterBar from "@/components/FilterBar";
import ImageGrid, { resolveInitialImages } from "@/components/ImageGrid";
import type { ImageData } from "@/components/ImageGrid";
import type { ImportFolder } from "@/components/ImportGate";
import RightPanel from "@/components/RightPanel";
import BottomBar from "@/components/BottomBar";
import LoupeView from "@/components/LoupeView";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { useDistractionDetection } from "@/hooks/useDistractionDetection";
import { MODEL_TO_UI } from "@/lib/distractionDetection";
import type { DistractionDetection } from "@/lib/distractionDetection";
import { useInpaintStore } from "@/hooks/useInpaintStore";

interface IndexProps {
  importSource: "sample" | ImportFolder;
}

const Index = ({ importSource }: IndexProps) => {
  const [columns, setColumns] = useState(4);
  const [isScanning, setIsScanning] = useState(true);
  const [view, setView] = useState<"grid" | "loupe">("loupe");
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Seed from the import source so loupe view (the default) has images even
  // before the grid mounts; the grid takes over via onImagesChange once opened.
  const [images, setImages] = useState<ImageData[]>(() =>
    resolveInitialImages(importSource),
  );
  const [loupeActiveTab, setLoupeActiveTab] = useState("subject");
  // Distraction detection is opt-in — the model only runs once the user triggers
  // a scan ("Scan this image" / "Scan this album").
  const [distractionEnabled, setDistractionEnabled] = useState(false);
  // UI labels the user chose to scan the album for; empty = no album filter.
  const [scanLabelFilter, setScanLabelFilter] = useState<string[]>([]);
  // Which image indices have actually been scanned — a single "Scan this image"
  // only covers one index, so this can't be derived from distractionMap alone.
  const [scannedIndices, setScannedIndices] = useState<Set<number>>(new Set());
  // One-time coachmark pointing at "Smart Object Removal" in the grid, shown
  // after the user clicks "Scan this album" from the loupe patch tab.
  const [showObjectCoachmark, setShowObjectCoachmark] = useState(false);
  const [canvasHasStrokes, setCanvasHasStrokes] = useState(false);
  const [clearCanvasSignal, setClearCanvasSignal] = useState(0);
  const [inpaintSignal, setInpaintSignal] = useState(0);
  // Detection boxes captured at "Remove Object" click, fed to LoupeView as a mask.
  const [inpaintBoxes, setInpaintBoxes] = useState<DistractionDetection[]>([]);
  // Shared inpaint store — single source of truth for patched images (grid + loupe).
  const inpaintStore = useInpaintStore((i) => images[i]?.src);
  const [autoRemoveAfterStroke, setAutoRemoveAfterStroke] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState<number[]>([]);
  const [highlightedLabels, setHighlightedLabels] = useState<Set<string>>(
    new Set(),
  );
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [removeToast, setRemoveToast] = useState<{
    message: string;
    key: number;
    ctaLabel?: string;
  } | null>(null);
  // Shared removed-items state — single source of truth for the patch panel and
  // the loupe canvas view (a Set of removed object UI labels).
  const [removedItems, setRemovedItems] = useState<Set<string>>(new Set());
  const addRemovedItems = (labels: Set<string>) =>
    setRemovedItems((prev) => {
      const next = new Set(prev);
      labels.forEach((l) => next.add(l));
      return next;
    });
  const resetRemovedItem = (label: string) =>
    setRemovedItems((prev) => {
      const next = new Set(prev);
      next.delete(label);
      return next;
    });
  const replaceRemovedItems = (labels: Set<string>) =>
    setRemovedItems(new Set(labels));

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
  const retouchOpportunities = new Set([]);

  // Subject sync / face detection is hidden for now — don't run the model.
  const {
    modelSubjects,
    modelImageMap,
    isDetecting,
    isLoadingModel,
    statusMessage,
    detectionProgress,
  } = useFaceDetection(images, false);

  const {
    distractionMap: rawDistractionMap,
    hasScannedAlbum,
    isDetecting: isDistractionDetecting,
    isLoadingModel: isDistractionModelLoading,
    rerun: rerunDistractionDetection,
    rerunSingle: rerunDistractionDetectionForImage,
  } = useDistractionDetection(images, distractionEnabled);

  // When the user picks specific objects to scan the album for, restrict the
  // detections surfaced everywhere to just those UI labels.
  const distractionMap = useMemo(() => {
    if (!rawDistractionMap || !scanLabelFilter.length) return rawDistractionMap;
    const allowed = new Set(scanLabelFilter);
    const next = new Map<number, DistractionDetection[]>();
    for (const [i, dets] of rawDistractionMap) {
      const filtered = dets.filter((d) => allowed.has(MODEL_TO_UI[d.label]));
      if (filtered.length) next.set(i, filtered);
    }
    return next;
  }, [rawDistractionMap, scanLabelFilter]);

  // "Scan this image" — run detection on just the current photo (no album filter).
  const handleScanImage = () => {
    setScanLabelFilter([]);
    setScannedIndices((prev) => new Set(prev).add(selectedIndex));
    void rerunDistractionDetectionForImage(selectedIndex);
  };

  // "Scan this album" — hop to the grid where the user picks which objects to
  // detect across every photo, with a coachmark pointing at where to do that.
  const handleScanAlbum = () => {
    setView("grid");
    setShowObjectCoachmark(false);
  };

  // Triggered from the grid once the user has selected which objects to scan for.
  const handleRunAlbumScan = (labels: string[]) => {
    setScanLabelFilter(labels);
    setDistractionEnabled(true);
    setScannedIndices(new Set(images.map((_, i) => i)));
    rerunDistractionDetection();
  };

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
    return imageDets.filter((det) =>
      highlightedLabels.has(MODEL_TO_UI[det.label]),
    );
  }, [distractionMap, selectedIndex, highlightedLabels]);

  // Per-object geometry for the loupe canvas: detections on the current image
  // whose UI label is in the shared removed set. Drives the on-image removal dots.
  const removedDetections = useMemo(() => {
    const imageDets = distractionMap?.get(selectedIndex) ?? [];
    return imageDets.filter((det) => removedItems.has(MODEL_TO_UI[det.label]));
  }, [distractionMap, selectedIndex, removedItems]);

  // Restore one removed object: drop its label from the shared set and re-inpaint
  // from the original with that label's boxes removed from the mask.
  const handleRestoreObject = (label: string) => {
    resetRemovedItem(label);
    void inpaintStore.resetLabel(selectedIndex, label);
  };

  // Full-image reset (R key): clears this image's mask, then drops any label
  // from the shared "removed" set that no longer has an active removal on any
  // other image — otherwise the panel/dots would keep showing it as removed
  // even though this image (the only one it applied to) was just restored.
  const handleResetImageAll = (idx: number) => {
    const labelsOnImage = new Set(
      (distractionMap?.get(idx) ?? [])
        .map((d) => MODEL_TO_UI[d.label])
        .filter((label): label is string => !!label && removedItems.has(label)),
    );
    void inpaintStore.resetImage(idx).then(() => {
      labelsOnImage.forEach((label) => {
        if (!inpaintStore.hasActiveLabel(label)) resetRemovedItem(label);
      });
    });
  };

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

  // Coachmark only makes sense in the grid — clear it whenever we leave, no
  // matter which path triggered the view change.
  useEffect(() => {
    if (view !== "grid") setShowObjectCoachmark(false);
  }, [view]);

  return (
    <div className="flex flex-col h-screen bg-background">
      <TopBar
        activeTab="RETOUCH"
        view={view}
        onViewChange={handleViewChange}
        filterOpen={filterOpen}
        onFilterToggle={() => setFilterOpen((v) => !v)}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Left: content area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div
            style={{
              display: "grid",
              gridTemplateRows: filterOpen ? "1fr" : "0fr",
              transition:
                "grid-template-rows 120ms cubic-bezier(0.25, 0, 0.25, 1)",
              willChange: "grid-template-rows",
            }}
          >
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
              <ImageGrid
                columns={columns}
                isScanning={isScanning}
                onImageDoubleClick={handleOpenLoupe}
                onImagesChange={setImages}
                subjectFilter={subjectFilter}
                modelImageMap={modelImageMap}
                initialSelectedIndex={selectedIndex}
                importSource={importSource}
                patchedByIndex={inpaintStore.patchedByIndex}
              />
              <BottomBar
                mode="grid"
                columns={columns}
                onColumnsChange={setColumns}
                totalPhotos={images.length}
                visiblePhotos={filteredImages.length}
                albumName={
                  importSource === "sample"
                    ? "Juliana Wedding"
                    : importSource.name
                }
              />
            </>
          ) : images[selectedIndex] ? (
            <LoupeView
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
              inpaintSignal={inpaintSignal}
              pendingInpaintDetections={inpaintBoxes}
              patchedSrc={inpaintStore.patchedByIndex[selectedIndex]}
              isInpainting={inpaintStore.isBusy}
              onInpaint={(idx, dets, brush, brushId) => {
                void inpaintStore
                  .inpaintImage(idx, dets, brush, brushId)
                  .then(() => handleRemoveSuccess(1, true));
              }}
              onResetImageAll={handleResetImageAll}
              onResetBrush={(id) => {
                void inpaintStore.resetBrush(selectedIndex, id);
              }}
              autoRemoveAfterStroke={autoRemoveAfterStroke}
              isExternallyRemoving={isRemoving}
              disableBrush={highlightedLabels.size > 0}
              highlightedDetections={highlightedDetections}
              hoveredDetections={hoveredDetections}
              removedItems={removedItems}
              onAddRemovedItems={addRemovedItems}
              onResetRemovedItem={resetRemovedItem}
              onSetRemovedItems={replaceRemovedItems}
              removedDetections={removedDetections}
              onRestoreObject={handleRestoreObject}
            />
          ) : null}
        </div>
        <RightPanel
          isScanning={isScanning}
          isLoupeView={view === "loupe"}
          currentImageIndex={selectedIndex}
          onGoToGrid={() => setView("grid")}
          onTabChange={setLoupeActiveTab}
          canvasHasStrokes={canvasHasStrokes}
          onClearCanvas={() => setClearCanvasSignal((s) => s + 1)}
          onInpaintCanvas={() => {
            setInpaintBoxes(highlightedDetections);
            setInpaintSignal((s) => s + 1);
          }}
          onResetImage={(label) => {
            void inpaintStore.resetLabel(selectedIndex, label);
          }}
          onBatchRemove={(uiLabels) => {
            if (distractionMap)
              void inpaintStore.inpaintBatch(uiLabels, distractionMap);
          }}
          onRemoveAfterStrokeChange={setAutoRemoveAfterStroke}
          onRemovingChange={setIsRemoving}
          visibleSubjectIndices={visibleSubjectIndices}
          modelSubjects={modelSubjects}
          modelImageMap={modelImageMap}
          isModelDetecting={isDetecting || isLoadingModel}
          modelStatusMessage={statusMessage}
          modelSubjectFilter={subjectFilter}
          tabOverride={null}
          hasRetouchingOpportunity={retouchOpportunities.has(selectedIndex)}
          distractionMap={distractionMap}
          hasScannedAlbum={hasScannedAlbum}
          currentImageScanned={scannedIndices.has(selectedIndex)}
          isDistractionScanning={
            isDistractionModelLoading || isDistractionDetecting
          }
          onScanImage={handleScanImage}
          onScanAlbum={handleScanAlbum}
          onScanAlbumRun={handleRunAlbumScan}
          showObjectCoachmark={showObjectCoachmark}
          onDismissObjectCoachmark={() => setShowObjectCoachmark(false)}
          onDistractionRerun={rerunDistractionDetection}
          onDistractionRerunCurrent={() =>
            rerunDistractionDetectionForImage(selectedIndex)
          }
          onDistractionSelectionChange={setHighlightedLabels}
          onDistractionHoverChange={setHoveredLabel}
          onDistractionRemoveSuccess={handleRemoveSuccess}
          onSuggestObject={handleSuggestObject}
          removedItems={removedItems}
          onAddRemovedItems={addRemovedItems}
          onResetRemovedItem={resetRemovedItem}
          onSetRemovedItems={replaceRemovedItems}
        />
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
