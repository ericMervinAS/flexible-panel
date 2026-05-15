import { createContext, useContext, useState } from "react";
import type { Album } from "@/types/album";
import sampleCover from "@/assets/samples/187170.webp";

const SAMPLE_ALBUM: Album = {
  id: "sample",
  name: "Juliana Wedding",
  imageCount: 24,
  coverSrc: sampleCover,
  source: "sample",
};

interface AlbumsContextValue {
  albums: Album[];
  addAlbum: (album: Album) => void;
  updateAlbum: (id: string, patch: Partial<Album>) => void;
}

const AlbumsContext = createContext<AlbumsContextValue | null>(null);

export const AlbumsProvider = ({ children }: { children: React.ReactNode }) => {
  const [albums, setAlbums] = useState<Album[]>([SAMPLE_ALBUM]);

  const addAlbum = (album: Album) => {
    setAlbums((prev) => [album, ...prev]);
  };

  const updateAlbum = (id: string, patch: Partial<Album>) => {
    setAlbums((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  return (
    <AlbumsContext.Provider value={{ albums, addAlbum, updateAlbum }}>
      {children}
    </AlbumsContext.Provider>
  );
};

export const useAlbums = () => {
  const ctx = useContext(AlbumsContext);
  if (!ctx) throw new Error("useAlbums must be used within AlbumsProvider");
  return ctx;
};
