import { useState, useEffect } from "react";
import TopBar from "@/components/TopBar";
import ImageGrid from "@/components/ImageGrid";
import RightPanel from "@/components/RightPanel";
import BottomBar from "@/components/BottomBar";

const Index = () => {
  const [columns, setColumns] = useState(3);
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsScanning(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background">
      <TopBar activeTab="RETOUCH" />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden">
          <ImageGrid columns={columns} isScanning={isScanning} />
        </div>
        <RightPanel isScanning={isScanning} />
      </div>
      <BottomBar
        columns={columns}
        onColumnsChange={setColumns}
        totalPhotos={1562}
        visiblePhotos={232}
        albumName="Juliana Wedding"
      />
    </div>
  );
};

export default Index;
