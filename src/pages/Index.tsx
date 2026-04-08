import { useState, useEffect } from "react";
import TopBar from "@/components/TopBar";
import ImageGrid from "@/components/ImageGrid";
import type { ImageData } from "@/components/ImageGrid";
import RightPanel from "@/components/RightPanel";
import BottomBar from "@/components/BottomBar";
import LoupeView from "@/components/LoupeView";

const Index = () => {
  const [columns, setColumns] = useState(4);
  const [isScanning, setIsScanning] = useState(true);
  const [view, setView] = useState<"grid" | "loupe">("grid");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [images, setImages] = useState<ImageData[]>([]);

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
      <TopBar activeTab="RETOUCH" view={view} onViewChange={handleViewChange} />
      <div className="flex flex-1 overflow-hidden">
        {/* Left: content area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {view === "grid" ? (
            <>
              <ImageGrid columns={columns} isScanning={isScanning} onImageDoubleClick={handleOpenLoupe} onImagesChange={setImages} />
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
                  currentIndex={selectedIndex}
                  totalImages={images.length}
                  onSelectImage={setSelectedIndex}
                />
              : null
          )}
        </div>
        <RightPanel isScanning={isScanning} isLoupeView={view === "loupe"} currentImageIndex={selectedIndex} />
      </div>
    </div>
  );
};

export default Index;
