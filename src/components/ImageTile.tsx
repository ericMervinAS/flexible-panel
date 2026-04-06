interface ImageTileProps {
  src: string;
  filename: string;
  isScanning?: boolean;
}

const ImageTile = ({ src, filename, isScanning = false }: ImageTileProps) => {
  return (
    <div className="flex flex-col gap-2 p-4 bg-[#1c1c1c]">
      <div className="relative rounded border-2 border-[#15803d] overflow-hidden bg-[#1c1c1c]" style={{ aspectRatio: "332/232" }}>
        <div className="absolute inset-[2px] rounded-[2px] overflow-hidden bg-white/5">
          <img
            src={src}
            alt={filename}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        </div>
        {isScanning && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-[#ababab] border-t-transparent animate-spin" />
          </div>
        )}
      </div>
      <span className="text-[12px] text-[#ababab] truncate leading-4">{filename}</span>
    </div>
  );
};

export default ImageTile;
