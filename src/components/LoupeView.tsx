import { useRef, useEffect, useState } from "react";
import type { ImageData } from "./ImageGrid";
import BrushToolbar from "./BrushToolbar";
import FilmstripBar from "./FilmstripBar";
import BottomBar from "./BottomBar";
import type { DistractionDetection } from "@/lib/distractionDetection";
import { MODEL_TO_UI } from "@/lib/distractionDetection";


interface LoupeViewProps {
  image: ImageData;
  images: ImageData[];
  filteredImages?: Array<ImageData & { originalIndex: number }>;
  currentIndex: number;
  totalImages: number;
  onSelectImage: (index: number) => void;
  onGoToGrid?: () => void;
  isPatchActive?: boolean;
  onHasStrokesChange?: (has: boolean) => void;
  clearCanvasSignal?: number;
  autoRemoveAfterStroke?: boolean;
  isExternallyRemoving?: boolean;
  highlightedDetections?: DistractionDetection[];
}

const LoupeView = ({
  image,
  images,
  filteredImages,
  currentIndex,
  totalImages,
  onSelectImage,
  onGoToGrid,
  isPatchActive = false,
  onHasStrokesChange,
  clearCanvasSignal = 0,
  autoRemoveAfterStroke = false,
  isExternallyRemoving = false,
  highlightedDetections = [],
}: LoupeViewProps) => {
  const stripImages = filteredImages ?? images.map((img, i) => ({ ...img, originalIndex: i }));
  const stripRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const zoomDropdownRef = useRef<HTMLDivElement>(null);

  // ── Zoom / pan ───────────────────────────────────────────────────────────────
  // Refs hold the live values (safe inside event listeners).
  // State drives re-renders.
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // CSS zoom factor that corresponds to 1 image-pixel = 1 screen-pixel.
  // Computed after the image loads; null until then.
  const trueHundredZoomRef = useRef<number | null>(null);

  // Last non-fit zoom state, for spacebar toggle.
  const prevZoomStateRef = useRef<{ zoom: number; pan: { x: number; y: number } } | null>(null);

  // ── Pan-drag state ───────────────────────────────────────────────────────────
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });
  const [isPanning, setIsPanning] = useState(false);

  // ── Zoom dropdown ────────────────────────────────────────────────────────────
  const [showZoomDropdown, setShowZoomDropdown] = useState(false);

  // ── Shift key — enables grab-to-pan while in patch mode ──────────────────────
  const isShiftHeldRef = useRef(false);
  const [isShiftHeld, setIsShiftHeld] = useState(false);

  // ── Rendered image bounds in canvas space — used to constrain drawing ────────
  const imageBoundsRef = useRef<{ left: number; top: number; right: number; bottom: number } | null>(null);
  const [imageBounds, setImageBounds] = useState<{ left: number; top: number; right: number; bottom: number } | null>(null);

  // ── Brush cursor (raw container coords) ─────────────────────────────────────
  const [brushPos, setBrushPos] = useState<{ x: number; y: number } | null>(null);

  // ── Drawing refs ─────────────────────────────────────────────────────────────
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasStrokesRef = useRef(false);
  const committedHasStrokesRef = useRef(false);
  const committedSnapshotRef = useRef<globalThis.ImageData | null>(null);
  const currentStrokeRef = useRef<{ x: number; y: number }[]>([]);
  const autoRemoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isAutoRemoving, setIsAutoRemoving] = useState(false);
  const [showStrokeHint, setShowStrokeHint] = useState(false);
  const [hintPos, setHintPos] = useState<{ x: number; y: number } | null>(null);

  // ── Brush size (controlled by BrushToolbar) ──────────────────────────────────
  const [brushSize, setBrushSize] = useState(50);
  const brushSizeRef = useRef(brushSize);
  brushSizeRef.current = brushSize;

  // Prop refs — keep global listeners free from stale closures
  const autoRemoveAfterStrokeRef = useRef(autoRemoveAfterStroke);
  autoRemoveAfterStrokeRef.current = autoRemoveAfterStroke;
  const onHasStrokesChangeRef = useRef(onHasStrokesChange);
  onHasStrokesChangeRef.current = onHasStrokesChange;

  // ── Zoom helpers ─────────────────────────────────────────────────────────────
  const applyZoomAndPan = (newZoom: number, newPan: { x: number; y: number }) => {
    zoomRef.current = newZoom;
    panRef.current = newPan;
    setZoom(newZoom);
    setPan(newPan);
  };

  const goToFit = () => {
    const cur = { zoom: zoomRef.current, pan: panRef.current };
    if (cur.zoom !== 1 || cur.pan.x !== 0 || cur.pan.y !== 0) {
      prevZoomStateRef.current = cur;
    }
    applyZoomAndPan(1, { x: 0, y: 0 });
  };

  const goToTrueHundred = () => {
    const t100 = trueHundredZoomRef.current;
    if (t100 === null) return;
    prevZoomStateRef.current = { zoom: zoomRef.current, pan: panRef.current };
    applyZoomAndPan(t100, { x: 0, y: 0 });
  };

  // Percentage of true image size at current CSS zoom
  const displayPct = (): number => {
    const t100 = trueHundredZoomRef.current;
    return Math.round((t100 !== null ? zoom / t100 : zoom) * 100);
  };

  const isFit = zoom === 1 && pan.x === 0 && pan.y === 0;

  // Compute the CSS zoom that gives 1 image-pixel = 1 screen-pixel
  const computeTrueHundredZoom = () => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;
    const cW = container.clientWidth, cH = container.clientHeight;
    const nW = img.naturalWidth, nH = img.naturalHeight;
    if (!nW || !nH) return;
    // At CSS zoom=1 the image fills the container via object-contain
    const renderedW = (cW / cH) >= (nW / nH) ? cH * (nW / nH) : cW;
    trueHundredZoomRef.current = nW / renderedW;
  };

  // Compute the image's rendered bounds in canvas space (px).
  // The canvas is the same size as the container; the image is object-contain centered.
  const computeImageBounds = () => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;
    const cW = container.clientWidth, cH = container.clientHeight;
    const nW = img.naturalWidth, nH = img.naturalHeight;
    if (!nW || !nH) return;
    const renderedW = (cW / cH) >= (nW / nH) ? cH * (nW / nH) : cW;
    const renderedH = (cW / cH) >= (nW / nH) ? cH : cW * (nH / nW);
    const bounds = {
      left: (cW - renderedW) / 2,
      top: (cH - renderedH) / 2,
      right: (cW + renderedW) / 2,
      bottom: (cH + renderedH) / 2,
    };
    imageBoundsRef.current = bounds;
    setImageBounds(bounds);
  };

  const isInsideImage = (pos: { x: number; y: number }): boolean => {
    const b = imageBoundsRef.current;
    if (!b) return true; // bounds unknown — allow
    return pos.x >= b.left && pos.x <= b.right && pos.y >= b.top && pos.y <= b.bottom;
  };

  // Handle a preset string from the dropdown
  const handleZoomPreset = (pct: number | "fit") => {
    if (pct === "fit") { goToFit(); return; }
    const t100 = trueHundredZoomRef.current;
    const newZoom = Math.max(0.5, Math.min(4, t100 !== null ? (pct / 100) * t100 : pct / 100));
    prevZoomStateRef.current = { zoom: zoomRef.current, pan: panRef.current };
    applyZoomAndPan(newZoom, { x: 0, y: 0 });
  };

  // Computes hint position (container px) from the current stroke bounding box
  const computeHintPos = (): { x: number; y: number } | null => {
    const points = currentStrokeRef.current;
    const container = containerRef.current;
    if (!points.length || !container) return null;
    const cW = container.clientWidth, cH = container.clientHeight;
    let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const midX = (minX + maxX) / 2;
    const z = zoomRef.current, pan = panRef.current;
    const cx = (midX - cW / 2) * z + cW / 2 + pan.x;
    const cy = (maxY - cH / 2) * z + cH / 2 + pan.y + (brushSizeRef.current * z) / 2 + 10;
    return {
      x: Math.max(52, Math.min(cW - 52, cx)),
      y: Math.min(cH - 40, Math.max(10, cy)),
    };
  };

  // ── Auto-remove timer ────────────────────────────────────────────────────────
  const clearAutoRemove = () => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    maskCanvas?.getContext("2d")?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    hasStrokesRef.current = false;
    committedHasStrokesRef.current = false;
    committedSnapshotRef.current = null;
    onHasStrokesChangeRef.current?.(false);
    setIsAutoRemoving(false);
    setShowStrokeHint(false);
    setHintPos(null);
    autoRemoveTimerRef.current = null;
  };

  const startAutoRemoveTimer = () => {
    if (autoRemoveTimerRef.current) clearTimeout(autoRemoveTimerRef.current);
    setIsAutoRemoving(true);
    autoRemoveTimerRef.current = setTimeout(clearAutoRemove, 2000);
  };

  // ── Filmstrip auto-scroll ────────────────────────────────────────────────────
  useEffect(() => {
    const strip = stripRef.current;
    const displayPos = stripImages.findIndex((img) => img.originalIndex === currentIndex);
    const tile = tileRefs.current[displayPos];
    if (!strip || !tile) return;
    strip.scrollTo({
      left: tile.offsetLeft - strip.offsetWidth / 2 + tile.offsetWidth / 2,
      behavior: "smooth",
    });
  }, [currentIndex, stripImages]);

  // ── Shift key tracking — enables grab-to-pan in patch mode ─────────────────
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") { isShiftHeldRef.current = true; setIsShiftHeld(true); }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") { isShiftHeldRef.current = false; setIsShiftHeld(false); }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  // ── Keyboard navigation + spacebar zoom toggle ───────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "g" || e.key === "G") && !e.metaKey && !e.ctrlKey) { onGoToGrid?.(); return; }
      if (e.key === "ArrowLeft") onSelectImage(Math.max(0, currentIndex - 1));
      if (e.key === "ArrowRight") onSelectImage(Math.min(totalImages - 1, currentIndex + 1));

      if (e.key === " ") {
        e.preventDefault();
        if (zoomRef.current === 1 && panRef.current.x === 0 && panRef.current.y === 0) {
          // At fit — jump to previous zoom if any
          if (prevZoomStateRef.current) {
            const { zoom: pz, pan: pp } = prevZoomStateRef.current;
            applyZoomAndPan(pz, pp);
          }
        } else {
          // Save current, go to fit
          prevZoomStateRef.current = { zoom: zoomRef.current, pan: { ...panRef.current } };
          applyZoomAndPan(1, { x: 0, y: 0 });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentIndex, totalImages, onSelectImage, onGoToGrid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keep canvas pixel dimensions in sync with container ─────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    maskCanvasRef.current = document.createElement("canvas");

    const sync = () => {
      // Preserve visible canvas content
      const tmp = document.createElement("canvas");
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      tmp.getContext("2d")?.drawImage(canvas, 0, 0);
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      canvas.getContext("2d")?.drawImage(tmp, 0, 0);

      // Preserve mask canvas content
      const maskCanvas = maskCanvasRef.current;
      if (maskCanvas) {
        const maskTmp = document.createElement("canvas");
        maskTmp.width = maskCanvas.width;
        maskTmp.height = maskCanvas.height;
        maskTmp.getContext("2d")?.drawImage(maskCanvas, 0, 0);
        maskCanvas.width = container.clientWidth;
        maskCanvas.height = container.clientHeight;
        maskCanvas.getContext("2d")?.drawImage(maskTmp, 0, 0);
        // Invalidate snapshot — dimensions changed, stored ImageData no longer matches
        committedSnapshotRef.current = null;
        committedHasStrokesRef.current = false;
        hasStrokesRef.current = false;
      }

      computeImageBounds();
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ── Reset everything when navigating to a different image ────────────────────
  useEffect(() => {
    if (autoRemoveTimerRef.current) {
      clearTimeout(autoRemoveTimerRef.current);
      autoRemoveTimerRef.current = null;
    }
    setIsAutoRemoving(false);
    setShowStrokeHint(false);
    setHintPos(null);
    // Reset zoom / pan / true-100 / image bounds (recomputed on image load)
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    trueHundredZoomRef.current = null;
    prevZoomStateRef.current = null;
    imageBoundsRef.current = null;
    setZoom(1);
    setPan({ x: 0, y: 0 });
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    maskCanvas?.getContext("2d")?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    hasStrokesRef.current = false;
    committedHasStrokesRef.current = false;
    committedSnapshotRef.current = null;
    onHasStrokesChange?.(false);
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Wheel zoom (passive:false so we can preventDefault) ─────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newZoom = Math.max(0.5, Math.min(4, zoomRef.current * factor));
      const rect = container.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      const newPan = {
        x: cx - (cx - panRef.current.x) * newZoom / zoomRef.current,
        y: cy - (cy - panRef.current.y) * newZoom / zoomRef.current,
      };
      // Save pre-zoom state for spacebar toggle before each wheel change
      if (zoomRef.current === 1 && panRef.current.x === 0 && panRef.current.y === 0) {
        prevZoomStateRef.current = { zoom: zoomRef.current, pan: { ...panRef.current } };
      }
      zoomRef.current = newZoom;
      panRef.current = newPan;
      setZoom(newZoom);
      setPan(newPan);
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Clear canvas on demand (e.g. after patch removal) ────────────────────────
  useEffect(() => {
    if (!clearCanvasSignal) return;
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    maskCanvas?.getContext("2d")?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    hasStrokesRef.current = false;
    committedHasStrokesRef.current = false;
    committedSnapshotRef.current = null;
    onHasStrokesChange?.(false);
    setShowStrokeHint(false);
    setHintPos(null);
  }, [clearCanvasSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Close zoom dropdown on outside click ─────────────────────────────────────
  useEffect(() => {
    if (!showZoomDropdown) return;
    const handler = (e: MouseEvent) => {
      if (!zoomDropdownRef.current?.contains(e.target as Node)) {
        setShowZoomDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showZoomDropdown]);

  // ── Global mouseup / checkBounds ─────────────────────────────────────────────
  useEffect(() => {
    const snapshotMask = () => {
      const maskCanvas = maskCanvasRef.current;
      const maskCtx = maskCanvas?.getContext("2d");
      if (maskCtx && maskCanvas) {
        committedSnapshotRef.current = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        committedHasStrokesRef.current = true;
      }
    };

    const restoreMask = () => {
      const maskCanvas = maskCanvasRef.current;
      const maskCtx = maskCanvas?.getContext("2d");
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (maskCtx && maskCanvas) {
        if (committedSnapshotRef.current) maskCtx.putImageData(committedSnapshotRef.current, 0, 0);
        else maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      }
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (committedSnapshotRef.current && maskCanvas) {
          ctx.globalAlpha = 0.35;
          ctx.drawImage(maskCanvas, 0, 0);
          ctx.globalAlpha = 1;
        }
      }
    };

    const showHint = () => {
      // Compute bounding box of current stroke in canvas space → container space
      const points = currentStrokeRef.current;
      const container = containerRef.current;
      if (points.length && container) {
        const cW = container.clientWidth, cH = container.clientHeight;
        let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of points) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
        const midX = (minX + maxX) / 2;
        const z = zoomRef.current, pan = panRef.current;
        const cx = (midX - cW / 2) * z + cW / 2 + pan.x;
        const cy = (maxY - cH / 2) * z + cH / 2 + pan.y + (brushSizeRef.current * z) / 2 + 10;
        setHintPos({
          x: Math.max(52, Math.min(cW - 52, cx)),
          y: Math.min(cH - 40, Math.max(10, cy)),
        });
      }
      setShowStrokeHint(true);
    };

    const stop = (e: MouseEvent) => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setIsPanning(false);
        void e;
      }
      if (!isDrawingRef.current) return;
      snapshotMask();
      showHint();
      currentStrokeRef.current = [];
      isDrawingRef.current = false;
      lastPosRef.current = null;
    };

    const checkBounds = (e: MouseEvent) => {
      if (!isDrawingRef.current) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const outside =
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom;
      if (!outside) return;

      setBrushPos(null);
      if (autoRemoveAfterStrokeRef.current) {
        restoreMask();
        if (!committedHasStrokesRef.current) {
          hasStrokesRef.current = false;
          onHasStrokesChangeRef.current?.(false);
        }
      } else {
        snapshotMask();
        showHint();
      }
      currentStrokeRef.current = [];
      isDrawingRef.current = false;
      lastPosRef.current = null;
    };

    window.addEventListener("mouseup", stop);
    window.addEventListener("mousemove", checkBounds);
    return () => {
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("mousemove", checkBounds);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drawing ──────────────────────────────────────────────────────────────────
  const redrawCurrentStroke = () => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    const maskCtx = maskCanvas?.getContext("2d");
    if (!ctx || !canvas || !maskCtx || !maskCanvas) return;

    const points = currentStrokeRef.current;
    if (points.length === 0) return;

    // Restore committed strokes to mask canvas (full opacity)
    if (committedSnapshotRef.current) {
      maskCtx.putImageData(committedSnapshotRef.current, 0, 0);
    } else {
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    }

    // Clip drawing to the rendered image rect so strokes can't bleed onto the
    // black canvas surrounding the image.
    const b = imageBoundsRef.current;
    maskCtx.save();
    if (b) {
      maskCtx.beginPath();
      maskCtx.rect(b.left, b.top, b.right - b.left, b.bottom - b.top);
      maskCtx.clip();
    }

    // Draw current stroke at full opacity on mask canvas
    maskCtx.beginPath();
    maskCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const mx = (points[i].x + points[i + 1].x) / 2;
      const my = (points[i].y + points[i + 1].y) / 2;
      maskCtx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
    }
    maskCtx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    maskCtx.strokeStyle = "rgb(59, 130, 246)";
    maskCtx.lineWidth = brushSize;
    maskCtx.lineCap = "round";
    maskCtx.lineJoin = "round";
    maskCtx.globalAlpha = 1;
    maskCtx.stroke();
    maskCtx.restore();

    // Blit mask → visible canvas at uniform 0.35 opacity
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 0.35;
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.globalAlpha = 1;
  };

  // Maps a React mouse event in container space → canvas pixel space
  const posFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cW = rect.width, cH = rect.height;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const z = zoomRef.current, p = panRef.current;
    return {
      x: (cx - cW / 2 - p.x) / z + cW / 2,
      y: (cy - cH / 2 - p.y) / z + cH / 2,
    };
  };

  const commitStroke = () => {
    const maskCanvas = maskCanvasRef.current;
    const maskCtx = maskCanvas?.getContext("2d");
    if (maskCtx && maskCanvas) {
      committedSnapshotRef.current = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      committedHasStrokesRef.current = true;
    }
    currentStrokeRef.current = [];
    isDrawingRef.current = false;
    lastPosRef.current = null;
  };

  const discardStroke = () => {
    const maskCanvas = maskCanvasRef.current;
    const maskCtx = maskCanvas?.getContext("2d");
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (maskCtx && maskCanvas) {
      if (committedSnapshotRef.current) maskCtx.putImageData(committedSnapshotRef.current, 0, 0);
      else maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    }
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (committedSnapshotRef.current && maskCanvas) {
        ctx.globalAlpha = 0.35;
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.globalAlpha = 1;
      }
    }
    if (!committedHasStrokesRef.current) {
      hasStrokesRef.current = false;
      onHasStrokesChange?.(false);
    }
    currentStrokeRef.current = [];
    isDrawingRef.current = false;
    lastPosRef.current = null;
  };

  // ── Stroke hint handlers ─────────────────────────────────────────────────────
  const handleHintRemove = () => {
    setShowStrokeHint(false);
    setHintPos(null);
    startAutoRemoveTimer();
  };

  const handleHintCancel = () => {
    setShowStrokeHint(false);
    clearAutoRemove();
  };

  // ── Mouse handlers ───────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Pan: either not in patch mode, or Shift held in patch mode
    if (!isPatchActive || e.shiftKey) {
      isPanningRef.current = true;
      setIsPanning(true);
      panStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
      return;
    }

    // Drawing mode — only start if cursor is over the image
    const canvasPos = posFromEvent(e);
    if (!isInsideImage(canvasPos)) return;

    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    const maskCtx = maskCanvas?.getContext("2d");
    if (!canvas || !ctx || !maskCanvas || !maskCtx) return;

    if (autoRemoveTimerRef.current) {
      clearTimeout(autoRemoveTimerRef.current);
      autoRemoveTimerRef.current = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      hasStrokesRef.current = false;
      committedHasStrokesRef.current = false;
      committedSnapshotRef.current = null;
      onHasStrokesChangeRef.current?.(false);
      setIsAutoRemoving(false);
    }

    setShowStrokeHint(false);
    setHintPos(null);

    committedSnapshotRef.current = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    currentStrokeRef.current = [canvasPos];
    isDrawingRef.current = true;
    lastPosRef.current = canvasPos;
    redrawCurrentStroke();

    if (!hasStrokesRef.current) {
      hasStrokesRef.current = true;
      onHasStrokesChange?.(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Handle pan drag
    if (isPanningRef.current) {
      const dx = e.clientX - panStartRef.current.mouseX;
      const dy = e.clientY - panStartRef.current.mouseY;
      const newPan = {
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      };
      panRef.current = newPan;
      setPan(newPan);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const rawPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const canvasPos = posFromEvent(e);
    const inside = isInsideImage(canvasPos);

    // Show brush cursor anywhere inside the canvas area (not just over the image),
    // except in shift-pan mode
    if (isPatchActive && !isShiftHeldRef.current) {
      setBrushPos(rawPos);
    } else {
      setBrushPos(null);
    }

    if (isPatchActive && isDrawingRef.current) {
      if (!inside) {
        // Cursor exited the image — commit the stroke and stop
        commitStroke();
        if (autoRemoveAfterStrokeRef.current) startAutoRemoveTimer();
      } else {
        currentStrokeRef.current.push(canvasPos);
        lastPosRef.current = canvasPos;
        redrawCurrentStroke();
      }
    }
  };

  const handleMouseUp = () => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
      return;
    }
    if (!isDrawingRef.current) return;
    const pos = computeHintPos();
    commitStroke();
    if (pos) setHintPos(pos);
    setShowStrokeHint(true);
  };

  const handleMouseLeave = () => {
    setBrushPos(null);
    // Keep panning across boundary (global mouseup stops it)
    if (isPanningRef.current) return;
    if (isDrawingRef.current) {
      if (autoRemoveAfterStrokeRef.current) {
        discardStroke();
      } else {
        const pos = computeHintPos();
        commitStroke();
        if (pos) setHintPos(pos);
        setShowStrokeHint(true);
      }
    }
  };

  // ── Cursor class ─────────────────────────────────────────────────────────────
  const cursorClass = isPatchActive && !isShiftHeld
    ? "cursor-none"
    : isPanning
      ? "cursor-grabbing"
      : "cursor-grab";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── Image area ──────────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className={`flex-1 bg-[#141414] overflow-hidden relative select-none ${cursorClass}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Zoom + pan wrapper — image and canvas scale together */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          <img
            ref={imgRef}
            src={image.src}
            alt={image.filename}
            className="max-w-full max-h-full object-contain"
            draggable={false}
            onLoad={() => { computeTrueHundredZoom(); computeImageBounds(); }}
          />

          {/* Drawing canvas — always in DOM to preserve strokes across tab switches */}
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 pointer-events-none transition-opacity duration-150 ${isPatchActive ? "opacity-100" : "opacity-0"}`}
          />

          {/* Bounding box overlay for selected distraction objects */}
          {isPatchActive && imageBounds && highlightedDetections.length > 0 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
              {highlightedDetections.map((det, i) => {
                const imgW = imgRef.current?.naturalWidth ?? 1;
                const imgH = imgRef.current?.naturalHeight ?? 1;
                const rW = imageBounds.right - imageBounds.left;
                const rH = imageBounds.bottom - imageBounds.top;
                const PAD = 14;
                const x = imageBounds.left + (det.x1 / imgW) * rW - PAD;
                const y = imageBounds.top + (det.y1 / imgH) * rH - PAD;
                const w = ((det.x2 - det.x1) / imgW) * rW + PAD * 2;
                const h = ((det.y2 - det.y1) / imgH) * rH + PAD * 2;

                const uiLabel = MODEL_TO_UI[det.label] ?? det.label;
                const sz = 11 / zoom;
                const chipPad = 5 / zoom;
                const chipH = 18 / zoom;
                const chipW = (uiLabel.length * 6.2 / zoom) + chipPad * 2;
                const chipR = 3 / zoom;
                const chipX = x + chipW * 0.25;
                const chipY = y - chipH * 0.5;

                return (
                  <g key={i}>
                    <rect
                      x={x} y={y} width={w} height={h}
                      fill="rgba(59,130,246,0.08)"
                      stroke="#3b82f6"
                      strokeWidth={3 / zoom}
                      rx={3 / zoom}
                    />
                    <rect
                      x={chipX} y={chipY}
                      width={chipW} height={chipH}
                      fill="#3b82f6"
                      rx={chipR}
                    />
                    <text
                      x={chipX + chipPad}
                      y={chipY + chipH / 2}
                      fontSize={sz}
                      fill="white"
                      dominantBaseline="central"
                      fontFamily="system-ui, -apple-system, sans-serif"
                      fontWeight="500"
                    >
                      {uiLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Brush cursor ring — container space, sized to match visual brush */}
        {isPatchActive && brushPos && (
          <div
            className="absolute pointer-events-none rounded-full border border-white/80"
            style={{
              left: brushPos.x,
              top: brushPos.y,
              width: brushSize * zoom,
              height: brushSize * zoom,
              transform: "translate(-50%, -50%)",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
            }}
          />
        )}

        {/* Stroke action hint — positioned just below the drawn mask area */}
        {showStrokeHint && !isAutoRemoving && !isExternallyRemoving && hintPos && (
          <div
            className="absolute flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-1 py-1 z-10"
            style={{ left: hintPos.x, top: hintPos.y, transform: "translateX(-50%)" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleHintCancel}
              className="text-[12px] text-[#ababab] hover:text-white px-2.5 py-1 rounded-full hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleHintRemove}
              className="text-[12px] text-white font-medium px-2.5 py-1 rounded-full bg-blue-500/80 hover:bg-blue-500 transition-colors"
            >
              Remove
            </button>
          </div>
        )}

        {/* Canvas removal loader */}
        {(isAutoRemoving || isExternallyRemoving) && (
          <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5 pointer-events-none">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-[#ababab] border-t-transparent animate-spin shrink-0" />
            <span className="text-[12px] text-[#e2e2e2]">Removing…</span>
          </div>
        )}

        {/* ── Brush toolbar ────────────────────────────────────────────────── */}
        {isPatchActive && <BrushToolbar onBrushSizeChange={setBrushSize} />}
      </div>

      {/* ── Filmstrip ───────────────────────────────────────────────────────── */}
      <FilmstripBar
        stripImages={stripImages}
        currentIndex={currentIndex}
        onSelectImage={onSelectImage}
        stripRef={stripRef}
        tileRefs={tileRefs}
      />

      {/* ── Bottom bar ──────────────────────────────────────────────────────── */}
      <BottomBar
        mode="loupe"
        image={image}
        currentIndex={currentIndex}
        totalImages={totalImages}
        isFit={isFit}
        displayPct={displayPct}
        goToFit={goToFit}
        goToTrueHundred={goToTrueHundred}
        handleZoomPreset={handleZoomPreset}
        showZoomDropdown={showZoomDropdown}
        setShowZoomDropdown={setShowZoomDropdown}
        zoomDropdownRef={zoomDropdownRef}
      />
    </div>
  );
};

export default LoupeView;