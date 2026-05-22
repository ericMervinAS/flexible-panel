import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AccessGate from "./components/AccessGate";
import ImportGate, { type ImportFolder } from "./components/ImportGate";
import HomePage from "./components/HomePage";
import ImportScreen from "./components/screens/ImportScreen";
import { AlbumsProvider, useAlbums } from "@/context/AlbumsContext";
import type { Album } from "@/types/album";
import editorial_style from "@/assets/profile/editorial_style.webp";
import graicard from "@/assets/profile/graicard.jpg";
import matcha from "@/assets/profile/matcha.jpg";
import porta_400 from "@/assets/profile/porta_400.webp";

const PRESET_COVERS = [editorial_style, graicard, matcha, porta_400];
let presetCoverIndex = 0;

const queryClient = new QueryClient();

type Screen = "pending" | "home" | "import" | "sample" | "tethering" | ImportFolder;

const AppContent = () => {
  const [screen, setScreen] = useState<Screen>("pending");
  const [currentAlbumId, setCurrentAlbumId] = useState<string | undefined>();
  const [initialTopTab, setInitialTopTab] = useState<string | undefined>();
  const [skipTetheringDetect, setSkipTetheringDetect] = useState(false);
  const [directPanel, setDirectPanel] = useState(false);
  const [pendingDirectPanel, setPendingDirectPanel] = useState(false);
  const { addAlbum } = useAlbums();

  const handleImportReady = (folder: ImportFolder, topTab?: string) => {
    const id = `upload-${Date.now()}`;
    addAlbum({
      id,
      name: folder.name,
      imageCount: folder.images.length,
      coverSrc: folder.images[0]?.src,
      source: folder,
    });
    setCurrentAlbumId(id);
    setInitialTopTab(topTab);
    setScreen(folder);
  };

  const handleTetheringStart = (skipDetect = false) => {
    const isDirectPanel = pendingDirectPanel;
    setSkipTetheringDetect(isDirectPanel ? false : skipDetect);
    setDirectPanel(isDirectPanel);
    const id = `tether-${Date.now()}`;
    const now = new Date();
    const date = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const defaultCover = PRESET_COVERS[presetCoverIndex % PRESET_COVERS.length];
    presetCoverIndex++;
    addAlbum({
      id,
      name: `Tethered Shoot · ${date} · ${time}`,
      imageCount: 0,
      coverSrc: defaultCover,
      source: "tethering",
      tetheringStarted: isDirectPanel,
    });
    setCurrentAlbumId(id);
    setScreen("tethering");
  };

  const handleHomeReady = (source: "sample" | "tethering" | ImportFolder) => {
    if (source === "tethering") {
      handleTetheringStart();
      return;
    }
    setScreen(source);
  };

  const handleOpenAlbum = (album: Album) => {
    setCurrentAlbumId(album.id);
    setScreen(album.source === "tethering" ? "tethering" : album.source);
  };

  return (
    <>
      {screen === "pending" ? (
        <ImportGate onReady={(src) => {
          if (src === "tethering") { setPendingDirectPanel(false); setScreen("home"); }
          else if (src === "tethering-direct") { setPendingDirectPanel(true); setScreen("home"); }
          else setScreen(src as Screen);
        }} />
      ) : screen === "home" ? (
        <HomePage onReady={handleHomeReady} onOpenAlbum={handleOpenAlbum} onCreateAlbum={() => setScreen("import")} onTryTethering={() => handleTetheringStart(true)} />
      ) : screen === "import" ? (
        <ImportScreen
          onReady={handleImportReady}
          onBack={() => setScreen("home")}
          onStartTethering={handleTetheringStart}
        />
      ) : (
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index importSource={screen} onGoHome={() => { setScreen("home"); setSkipTetheringDetect(false); setDirectPanel(false); }} onCancelTethering={() => setScreen("import")} albumId={currentAlbumId} initialTopTab={initialTopTab} skipTetheringDetect={skipTetheringDetect} directPanel={directPanel} />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      )}
    </>
  );
};

const App = () => {
  return (
    <AccessGate>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AlbumsProvider>
            <AppContent />
          </AlbumsProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </AccessGate>
  );
};

export default App;
