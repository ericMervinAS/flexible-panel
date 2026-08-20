import { useState, useEffect, useRef, useCallback } from 'react';
import { DistractionDetectionService, DistractionDetection } from '@/lib/distractionDetection';
import type { ImageData } from '@/components/ImageGrid';

export interface UseDistractionDetectionResult {
  /** imageIndex → detections in that image; undefined = scan not yet completed */
  distractionMap: Map<number, DistractionDetection[]> | undefined;
  /** True once a full album-wide scan has completed — distinct from
   *  distractionMap being defined, since rerunSingle() also populates
   *  distractionMap for just one image. */
  hasScannedAlbum: boolean;
  isDetecting: boolean;
  isLoadingModel: boolean;
  statusMessage: string;
  detectionProgress: number;
  rerun: () => void;
  rerunSingle: (index: number) => void;
  /** Scan just these indices (e.g. a filmstrip multi-selection) — merges
   *  results into distractionMap without touching any other image's entry. */
  rerunMany: (indices: number[]) => void;
}

export function useDistractionDetection(images: ImageData[], enabled: boolean = true): UseDistractionDetectionResult {
  const [distractionMap, setDistractionMap] = useState<Map<number, DistractionDetection[]> | undefined>(undefined);
  const [hasScannedAlbum, setHasScannedAlbum] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [detectionProgress, setDetectionProgress] = useState(0);
  const [rerunKey, setRerunKey] = useState(0);

  const serviceRef = useRef<DistractionDetectionService | null>(null);
  const abortRef = useRef(false);
  const lastLengthRef = useRef(0);

  const rerun = useCallback(() => {
    lastLengthRef.current = 0;
    setDistractionMap(undefined);
    setHasScannedAlbum(false);
    setRerunKey((k) => k + 1);
    console.log('[DistractionDetection] Rerun requested');
  }, []);

  const rerunSingle = useCallback(async (index: number) => {
    const svc = serviceRef.current;
    const img = images[index];
    if (!svc || !img) return;

    try {
      if (!svc.isReady) {
        setIsLoadingModel(true);
        await svc.loadModel(undefined, (msg) => setStatusMessage(msg));
        setIsLoadingModel(false);
      }
      setIsDetecting(true);
      console.log(`[DistractionDetection] Rerunning image ${index}`);
      const result = await svc.processImages([img.src]);
      const dets = result.get(0) ?? [];
      setDistractionMap((prev) => {
        const next = new Map(prev ?? []);
        if (dets.length > 0) next.set(index, dets);
        else next.delete(index);
        return next;
      });
    } catch (e) {
      console.error('[DistractionDetection] Single-image rerun failed:', e);
    } finally {
      setIsDetecting(false);
      setIsLoadingModel(false);
    }
  }, [images]);

  const rerunMany = useCallback(async (indices: number[]) => {
    const svc = serviceRef.current;
    if (!svc || indices.length === 0) return;

    try {
      if (!svc.isReady) {
        setIsLoadingModel(true);
        await svc.loadModel(undefined, (msg) => setStatusMessage(msg));
        setIsLoadingModel(false);
      }
      setIsDetecting(true);
      setDetectionProgress(0);
      console.log(`[DistractionDetection] Rerunning ${indices.length} selected image(s)`);
      for (let i = 0; i < indices.length; i++) {
        const idx = indices[i];
        const img = images[idx];
        if (!img) continue;
        const result = await svc.processImages([img.src]);
        const dets = result.get(0) ?? [];
        setDistractionMap((prev) => {
          const next = new Map(prev ?? []);
          if (dets.length > 0) next.set(idx, dets);
          else next.delete(idx);
          return next;
        });
        setDetectionProgress(Math.round(((i + 1) / indices.length) * 100));
      }
    } catch (e) {
      console.error('[DistractionDetection] Multi-image rerun failed:', e);
    } finally {
      setIsDetecting(false);
      setIsLoadingModel(false);
    }
  }, [images]);

  useEffect(() => {
    serviceRef.current = new DistractionDetectionService();
    return () => {
      abortRef.current = true;
      serviceRef.current?.dispose();
      serviceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (!images.length) return;
    if (images.length === lastLengthRef.current) return;
    lastLengthRef.current = images.length;

    const svc = serviceRef.current;
    if (!svc) return;

    abortRef.current = false;

    const run = async () => {
      try {
        if (!svc.isReady) {
          setIsLoadingModel(true);
          console.log('[DistractionDetection] Loading model…');
          await svc.loadModel(undefined, (msg) => {
            setStatusMessage(msg);
            console.log('[DistractionDetection]', msg);
          });
          if (abortRef.current) return;
          setIsLoadingModel(false);
          console.log('[DistractionDetection] Model ready');
        }

        setIsDetecting(true);
        setDetectionProgress(0);
        console.log(`[DistractionDetection] Scanning ${images.length} image${images.length === 1 ? '' : 's'}…`);

        const result = await svc.processImages(
          images.map((img) => img.src),
          (msg, idx, total) => {
            if (!abortRef.current) {
              setStatusMessage(msg);
              if (total > 0) setDetectionProgress(Math.round(((idx + 1) / total) * 100));
            }
          },
        );

        if (abortRef.current) return;

        setDistractionMap(result);
        setHasScannedAlbum(true);

        const totalDets = Array.from(result.values()).reduce((s, d) => s + d.length, 0);
        const summary = `Found ${totalDets} distraction${totalDets === 1 ? '' : 's'} across ${result.size} image${result.size === 1 ? '' : 's'}`;
        setStatusMessage(summary);
        console.log(`[DistractionDetection] ${summary}`);
        if (result.size > 0) {
          const perClass: Record<string, number> = {};
          for (const dets of result.values()) {
            const seen = new Set<string>();
            for (const d of dets) {
              if (!seen.has(d.label)) { seen.add(d.label); perClass[d.label] = (perClass[d.label] ?? 0) + 1; }
            }
          }
          console.log('[DistractionDetection] Per-class image counts:', perClass);
        }
      } catch (e) {
        if (!abortRef.current) {
          console.error('[DistractionDetection] Failed:', e);
          setStatusMessage(`Detection error: ${(e as Error).message}`);
        }
      } finally {
        if (!abortRef.current) {
          setIsDetecting(false);
          setIsLoadingModel(false);
        }
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length, rerunKey, enabled]);

  return { distractionMap, hasScannedAlbum, isDetecting, isLoadingModel, statusMessage, detectionProgress, rerun, rerunSingle, rerunMany };
}
