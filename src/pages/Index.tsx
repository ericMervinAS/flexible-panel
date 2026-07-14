import { useState, useEffect, useMemo, useRef } from "react";
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
  // Read inside async inpaint callbacks (below) to check whether the user is
  // still on the photo an in-flight edit was started against.
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
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
  // Labels to preselect in the grid's Smart Object Removal — set when the user
  // arrives via the loupe's batch-removal offer ("Scan the album") so the object
  // they just removed on one photo is ready to scan for across the rest, rather
  // than showing up as already "removed". Cleared whenever we leave the grid so
  // a later, unrelated visit doesn't reapply a stale selection.
  const [gridPreselectLabels, setGridPreselectLabels] = useState<string[]>([]);
  const [canvasHasStrokes, setCanvasHasStrokes] = useState(false);
  const [clearCanvasSignal, setClearCanvasSignal] = useState(0);
  const [inpaintSignal, setInpaintSignal] = useState(0);
  // Detection boxes captured at "Remove Object" click, fed to LoupeView as a mask.
  const [inpaintBoxes, setInpaintBoxes] = useState<DistractionDetection[]>([]);
  // Queued edited masks (canvas "Edit" -> "Save") captured at the same click.
  const [pendingExtraBrushes, setPendingExtraBrushes] = useState<
    { id: string; canvas: HTMLCanvasElement; det: DistractionDetection }[]
  >([]);
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
  // Per-image set of detection instances the user chose to Skip on canvas —
  // excluded from the *next* batch removal and from dot seeding, but not from
  // distractionMap: the instance is still a real, unresolved distraction, so it
  // reappears as a normal pending box once that removal runs (see
  // handleInpaintCanvas) rather than staying hidden forever.
  const [skippedDetections, setSkippedDetections] = useState<
    Record<number, Set<string>>
  >({});
  // Per-image, per-instance hand-painted masks from canvas "Edit" -> "Save" —
  // queued rather than applied immediately (see onSaveEditedDetection), and
  // merged into the next batch removal for their label.
  const [pendingEditedMasks, setPendingEditedMasks] = useState<
    Record<number, Record<string, { det: DistractionDetection; brushId: string; canvas: HTMLCanvasElement }>>
  >({});
  // Per-image set of detection instances actually inpainted so far — the only
  // permanent record of "this one is done", since a label can be resolved
  // across several partial passes (skip 1 of 3, remove the other 2, come back
  // for the last one later) without ever setting the label-level removedItems
  // flag. Drives the patch panel's remaining count and the removal dots,
  // independent of whether the whole label counts as globally "removed".
  const [appliedDetections, setAppliedDetections] = useState<
    Record<number, Set<string>>
  >({});
  const detKey = (det: DistractionDetection) =>
    `${MODEL_TO_UI[det.label] ?? det.label}:${det.x1}:${det.y1}:${det.x2}:${det.y2}`;
  // Skip, edited-pending, and already-applied all hide their box / reduce the
  // visible "remaining" count — only skip blocks marking the label "removed"
  // (see handleInpaintCanvas).
  const dismissedDetectionKeys = useMemo(() => {
    const combined = new Set(skippedDetections[selectedIndex] ?? []);
    const edited = pendingEditedMasks[selectedIndex];
    if (edited) Object.keys(edited).forEach((k) => combined.add(k));
    const applied = appliedDetections[selectedIndex];
    if (applied) applied.forEach((k) => combined.add(k));
    return combined;
  }, [skippedDetections, pendingEditedMasks, appliedDetections, selectedIndex]);
  // Which instances are actually done, for the current image — lets the panel
  // tell "fully resolved" (show the done tile with the original total) apart
  // from "some left over" (stay a checkbox showing what's left) even when a
  // skip kept the label out of the shared removedItems set.
  const appliedDetectionKeys = useMemo(
    () => appliedDetections[selectedIndex] ?? new Set<string>(),
    [appliedDetections, selectedIndex],
  );
  // UI labels that still have at least one Skipped-and-unresolved instance on
  // this image — the panel keeps these as normal (re-selectable) checkboxes
  // instead of flipping them to "removed" when Remove Object runs.
  const labelsWithSkips = useMemo(() => {
    const skipped = skippedDetections[selectedIndex];
    if (!skipped?.size) return new Set<string>();
    return new Set([...skipped].map((k) => k.split(":")[0]));
  }, [skippedDetections, selectedIndex]);
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
    detectionProgress: distractionScanProgress,
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
    return imageDets.filter(
      (det) =>
        highlightedLabels.has(MODEL_TO_UI[det.label]) &&
        !dismissedDetectionKeys.has(detKey(det)),
    );
  }, [distractionMap, selectedIndex, highlightedLabels, dismissedDetectionKeys]);

  // Per-object geometry for the loupe canvas: detections actually applied on
  // this image — either individually (loupe per-instance review) or because
  // their whole label was removed some other way (grid album-wide batch, or
  // the simple no-skip loupe flow, both of which only set removedItems).
  // Always excludes a currently-Skipped instance, even if its label happens to
  // be removedItems from a different image, since this one was never inpainted.
  const removedDetections = useMemo(() => {
    const imageDets = distractionMap?.get(selectedIndex) ?? [];
    const skipped = skippedDetections[selectedIndex];
    return imageDets.filter((det) => {
      const key = detKey(det);
      if (skipped?.has(key)) return false;
      return appliedDetectionKeys.has(key) || removedItems.has(MODEL_TO_UI[det.label] ?? det.label);
    });
  }, [distractionMap, selectedIndex, appliedDetectionKeys, removedItems, skippedDetections]);

  // Canvas "Skip": exclude this instance from the next batch removal / dot
  // seeding — retained in distractionMap, so it's still a real pending
  // distraction once that removal runs (see handleInpaintCanvas below).
  const handleSkipDetection = (idx: number, det: DistractionDetection) => {
    setSkippedDetections((prev) => {
      const next = new Set(prev[idx] ?? []);
      next.add(detKey(det));
      return { ...prev, [idx]: next };
    });
  };

  // Panel checkbox re-confirmed as "select all occurrences" after a partial
  // skip — undo the skip(s) for this label so every instance goes back into
  // the removal batch instead of leaving the skipped one silently excluded.
  const handleSelectAllOccurrences = (label: string) => {
    setSkippedDetections((prev) => {
      const current = prev[selectedIndex];
      if (!current?.size) return prev;
      const next = new Set(
        [...current].filter((key) => key.split(":")[0] !== label),
      );
      return { ...prev, [selectedIndex]: next };
    });
  };

  // Canvas "Edit" -> "Save": queue the hand-painted mask for this instance
  // rather than inpainting immediately — merged into the next batch removal.
  const handleSaveEditedDetection = (
    idx: number,
    det: DistractionDetection,
    brushId: string,
    canvas: HTMLCanvasElement,
  ) => {
    setPendingEditedMasks((prev) => ({
      ...prev,
      [idx]: { ...(prev[idx] ?? {}), [detKey(det)]: { det, brushId, canvas } },
    }));
  };

  // Panel "Remove Object" / "Remove N Objects": gather any queued edited masks
  // for the currently checked labels alongside the plain boxes, record every
  // instance included in this pass as actually applied (the permanent "done"
  // record — see appliedDetections), then clear the skip/edited state for
  // those labels — either they were just applied, or they were deliberately
  // excluded and should reappear as normal pending boxes the next time the
  // label is checked (rather than staying hidden).
  const handleInpaintCanvas = () => {
    const edited = pendingEditedMasks[selectedIndex] ?? {};
    const extraBrushes = Object.values(edited).filter(({ det }) =>
      highlightedLabels.has(MODEL_TO_UI[det.label] ?? det.label),
    );
    setPendingExtraBrushes(extraBrushes);
    setInpaintBoxes(highlightedDetections);
    setInpaintSignal((s) => s + 1);

    setAppliedDetections((prev) => {
      const next = new Set(prev[selectedIndex] ?? []);
      highlightedDetections.forEach((det) => next.add(detKey(det)));
      extraBrushes.forEach(({ det }) => next.add(detKey(det)));
      return { ...prev, [selectedIndex]: next };
    });
    setSkippedDetections((prev) => {
      const set = prev[selectedIndex];
      if (!set) return prev;
      const filtered = new Set([...set].filter((k) => !highlightedLabels.has(k.split(":")[0])));
      return { ...prev, [selectedIndex]: filtered };
    });
    setPendingEditedMasks((prev) => {
      const obj = prev[selectedIndex];
      if (!obj) return prev;
      const next = Object.fromEntries(
        Object.entries(obj).filter(([key]) => !highlightedLabels.has(key.split(":")[0])),
      );
      return { ...prev, [selectedIndex]: next };
    });
  };

  // Restore one removed object: drop its label from the shared set and re-inpaint
  // from the original with that label's boxes removed from the mask. Also clears
  // any per-instance skips/applied-record for this label so a fresh review shows
  // every box again.
  const handleRestoreObject = (label: string) => {
    resetRemovedItem(label);
    setSkippedDetections((prev) => {
      const set = prev[selectedIndex];
      if (!set) return prev;
      const filtered = new Set([...set].filter((k) => !k.startsWith(`${label}:`)));
      return { ...prev, [selectedIndex]: filtered };
    });
    setAppliedDetections((prev) => {
      const set = prev[selectedIndex];
      if (!set) return prev;
      const filtered = new Set([...set].filter((k) => !k.startsWith(`${label}:`)));
      return { ...prev, [selectedIndex]: filtered };
    });
    void inpaintStore.resetLabel(selectedIndex, label);
  };

  // Full-image reset (R key): clears this image's mask, then drops any label
  // from the shared "removed" set that no longer has an active removal on any
  // other image — otherwise the panel/dots would keep showing it as removed
  // even though this image (the only one it applied to) was just restored.
  // Also clears any per-instance skips/edits/applied-record on this image for
  // a clean re-review.
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
    setSkippedDetections((prev) => {
      if (!(idx in prev)) return prev;
      const next = { ...prev };
      delete next[idx];
      return next;
    });
    setAppliedDetections((prev) => {
      if (!(idx in prev)) return prev;
      const next = { ...prev };
      delete next[idx];
      return next;
    });
    setPendingEditedMasks((prev) => {
      if (!(idx in prev)) return prev;
      const next = { ...prev };
      delete next[idx];
      return next;
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

  useEffect(() => {
    if (view !== "grid") setGridPreselectLabels([]);
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
              pendingExtraBrushes={pendingExtraBrushes}
              patchedSrc={inpaintStore.patchedByIndex[selectedIndex]}
              isInpainting={inpaintStore.busyIndex === selectedIndex}
              onInpaint={(idx, dets, brush, brushId, extraBrushes) => {
                void inpaintStore
                  .inpaintImage(idx, dets, brush, brushId, extraBrushes)
                  .then(() => {
                    // Inference can outlast the user's stay on this photo — a
                    // stale success toast for whatever they're looking at now
                    // would read as this image just got edited.
                    if (selectedIndexRef.current === idx) handleRemoveSuccess(1, true);
                  });
              }}
              onResetImageAll={handleResetImageAll}
              onResetBrush={(id) => {
                void inpaintStore.resetBrush(selectedIndex, id);
              }}
              onConvertObjectMask={(idx, det, brushId, natMask) => {
                void inpaintStore
                  .convertObjectToBrush(idx, MODEL_TO_UI[det.label] ?? det.label, det, brushId, natMask)
                  .then(() => {
                    if (selectedIndexRef.current === idx) handleRemoveSuccess(1, true);
                  });
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
              onSkipDetection={handleSkipDetection}
              onSaveEditedDetection={handleSaveEditedDetection}
            />
          ) : null}
        </div>
        <RightPanel
          isScanning={isScanning}
          isLoupeView={view === "loupe"}
          currentImageIndex={selectedIndex}
          onGoToGrid={(labels) => {
            setGridPreselectLabels(labels);
            setView("grid");
          }}
          initialObjectSelection={gridPreselectLabels}
          onTabChange={setLoupeActiveTab}
          canvasHasStrokes={canvasHasStrokes}
          onClearCanvas={() => setClearCanvasSignal((s) => s + 1)}
          onInpaintCanvas={handleInpaintCanvas}
          dismissedDetectionKeys={dismissedDetectionKeys}
          appliedDetectionKeys={appliedDetectionKeys}
          labelsWithSkips={labelsWithSkips}
          onSelectAllOccurrences={handleSelectAllOccurrences}
          onResetImage={(label) => {
            void inpaintStore.resetLabel(selectedIndex, label);
          }}
          onBatchRemove={(uiLabels) =>
            distractionMap
              ? inpaintStore.inpaintBatch(uiLabels, distractionMap)
              : Promise.resolve()
          }
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
          distractionScanProgress={distractionScanProgress}
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
