import ImageTile from "./ImageTile";
import wedding1 from "@/assets/wedding-1.jpg";
import wedding2 from "@/assets/wedding-2.jpg";
import wedding3 from "@/assets/wedding-3.jpg";
import wedding4 from "@/assets/wedding-4.jpg";
import wedding5 from "@/assets/wedding-5.jpg";
import wedding6 from "@/assets/wedding-6.jpg";
import wedding7 from "@/assets/wedding-7.jpg";
import wedding8 from "@/assets/wedding-8.jpg";
import wedding9 from "@/assets/wedding-9.jpg";

const images = [
  { src: wedding1, filename: "IMG00310.jpg" },
  { src: wedding2, filename: "IMG00310.jpg" },
  { src: wedding3, filename: "IMG00310.jpg" },
  { src: wedding4, filename: "IMG00310.jpg" },
  { src: wedding5, filename: "IMG00310.jpg" },
  { src: wedding6, filename: "IMG00310.jpg" },
  { src: wedding7, filename: "IMG00310.jpg" },
  { src: wedding8, filename: "IMG00310.jpg" },
  { src: wedding9, filename: "IMG00310.jpg" },
];

interface ImageGridProps {
  columns: number;
  isScanning: boolean;
}

const ImageGrid = ({ columns, isScanning }: ImageGridProps) => {
  return (
    <div
      className="grid gap-4 p-4 overflow-y-auto flex-1"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {images.map((img, i) => (
        <ImageTile
          key={i}
          src={img.src}
          filename={img.filename}
          isScanning={isScanning}
        />
      ))}
    </div>
  );
};

export default ImageGrid;
