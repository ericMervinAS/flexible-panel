import { useState, useEffect, useMemo } from "react";
import TopBar from "@/components/TopBar";
import FilterBar from "@/components/FilterBar";
import ImageGrid from "@/components/ImageGrid";
import type { ImageData } from "@/components/ImageGrid";
import RightPanel from "@/components/RightPanel";
import BottomBar from "@/components/BottomBar";
import LoupeView from "@/components/LoupeView";
import { getSubjectIndices } from "@/data/subjectMapping";

const Index = () => {
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

  const filteredImages = useMemo(() => {
    const mapped = images.map((img, i) => ({ ...img, originalIndex: i }));
    if (!subjectFilter.length) return mapped;
    return mapped.filter(({ originalIndex }) => {
      const subjects = getSubjectIndices(originalIndex);
      if (!subjects) return false;
      return subjectFilter.some((si) => subjects.includes(si));
    });
  }, [images, subjectFilter]);

  const visibleSubjectIndices = useMemo(() => {
    if (!subjectFilter.length) return null; // no filter → show all subjects
    const set = new Set<number>();
    filteredImages.forEach(({ originalIndex }) => {
      getSubjectIndices(originalIndex)?.forEach((si) => set.add(si));
    });
    return set;
  }, [filteredImages, subjectFilter]);

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
              <FilterBar onPeopleFilter={setSubjectFilter} />
            </div>
          </div>
          {view === "grid" ? (
            <>
              <ImageGrid columns={columns} isScanning={isScanning} onImageDoubleClick={handleOpenLoupe} onImagesChange={setImages} subjectFilter={subjectFilter} initialSelectedIndex={selectedIndex} />
              <BottomBar
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
                />
              : null
          )}
        </div>
        <RightPanel isScanning={isScanning} isLoupeView={view === "loupe"} currentImageIndex={selectedIndex} onTabChange={setLoupeActiveTab} canvasHasStrokes={canvasHasStrokes} onClearCanvas={() => setClearCanvasSignal((s) => s + 1)} onRemoveAfterStrokeChange={setAutoRemoveAfterStroke} onRemovingChange={setIsRemoving} visibleSubjectIndices={visibleSubjectIndices} />
      </div>
    </div>
  );
};

export default Index;
