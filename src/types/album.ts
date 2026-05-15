import type { ImportFolder } from "@/components/ImportGate";
import type { ImageData } from "@/components/ImageGrid";

export interface Album {
  id: string;
  name: string;
  imageCount: number;
  coverSrc?: string;
  source: ImportFolder | "sample" | "tethering";
  capturedImages?: ImageData[];
  tetheringStarted?: boolean;
}
