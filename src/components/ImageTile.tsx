interface ImageTileProps {
  src: string;
  filename: string;
  isScanning?: boolean;
}

const ImageTile = ({ src, filename, isScanning = false }: ImageTileProps) => {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative aspect-[4/3] rounded border-2 border-thumbnail-border overflow-hidden bg-card">
        <img
          src={src}
          alt={filename}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        {isScanning && (
          <div className="absolute inset-0 bg-background/40 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <span className="text-xs text-muted-foreground truncate">{filename}</span>
    </div>
  );
};

export default ImageTile;
