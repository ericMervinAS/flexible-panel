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

const queryClient = new QueryClient();

type Screen = "pending" | "home" | "import" | "sample" | "tethering" | ImportFolder;

const AppContent = () => {
  const [screen, setScreen] = useState<Screen>("pending");
  const [currentAlbumId, setCurrentAlbumId] = useState<string | undefined>();
  const { addAlbum } = useAlbums();

  const handleImportReady = (folder: ImportFolder) => {
    const id = `upload-${Date.now()}`;
    addAlbum({
      id,
      name: folder.name,
      imageCount: folder.images.length,
      coverSrc: folder.images[0]?.src,
      source: folder,
    });
    setCurrentAlbumId(id);
    setScreen(folder);
  };

  const handleTetheringStart = () => {
    const id = `tether-${Date.now()}`;
    const now = new Date();
    const date = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    addAlbum({
      id,
      name: `Tethered Shoot · ${date} · ${time}`,
      imageCount: 0,
      source: "tethering",
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
        <ImportGate onReady={(src) => src === "tethering" ? setScreen("home") : setScreen(src)} />
      ) : screen === "home" ? (
        <HomePage onReady={handleHomeReady} onOpenAlbum={handleOpenAlbum} onCreateAlbum={() => setScreen("import")} />
      ) : screen === "import" ? (
        <ImportScreen
          onReady={handleImportReady}
          onBack={() => setScreen("home")}
          onStartTethering={handleTetheringStart}
        />
      ) : (
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index importSource={screen} onGoHome={() => setScreen("home")} onCancelTethering={() => setScreen("import")} albumId={currentAlbumId} />} />
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
