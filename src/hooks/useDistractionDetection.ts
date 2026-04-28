import { useState, useEffect, useRef, useCallback } from 'react';
import { DistractionDetectionService, DistractionDetection } from '@/lib/distractionDetection';
import type { ImageData } from '@/components/ImageGrid';

export interface UseDistractionDetectionResult {
  /** imageIndex → detections in that image; undefined = scan not yet completed */
  distractionMap: Map<number, DistractionDetection[]> | undefined;
  isDetecting: boolean;
  isLoadingModel: boolean;
  statusMessage: string;
  detectionProgress: number;
  rerun: () => void;
}

export function useDistractionDetection(images: ImageData[]): UseDistractionDetectionResult {
  const [distractionMap, setDistractionMap] = useState<Map<number, DistractionDetection[]> | undefined>(undefined);
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
    setRerunKey((k) => k + 1);
    console.log('[DistractionDetection] Rerun requested');
  }, []);

  useEffect(() => {
    serviceRef.current = new DistractionDetectionService();
    return () => {
      abortRef.current = true;
      serviceRef.current?.dispose();
      serviceRef.current = null;
    };
  }, []);

  useEffect(() => {
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
  }, [images.length, rerunKey]);

  return { distractionMap, isDetecting, isLoadingModel, statusMessage, detectionProgress, rerun };
}
