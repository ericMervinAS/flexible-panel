import { useState, useEffect, useRef } from 'react';
import { FaceDetectionService, FaceCluster, SubjectCategory } from '@/lib/faceDetection';
import type { ImageData } from '@/components/ImageGrid';

export interface ModelSubject {
  id: number;
  keyFaceDataUrl: string;
  photoCount: number;
  appearances: Array<{ imageIndex: number; score: number }>;
  gender?: 'Female' | 'Male';
  age?: number;
  category?: SubjectCategory;
}

export interface UseFaceDetectionResult {
  modelSubjects: ModelSubject[];
  /** Maps imageIndex → array of cluster ids visible in that image */
  modelImageMap: Map<number, number[]>;
  isDetecting: boolean;
  isLoadingModel: boolean;
  statusMessage: string;
  /** 0–100 progress through the current detection run; 0 while loading models */
  detectionProgress: number;
}

export function useFaceDetection(images: ImageData[], enabled: boolean = true): UseFaceDetectionResult {
  const [modelSubjects, setModelSubjects] = useState<ModelSubject[]>([]);
  const [modelImageMap, setModelImageMap] = useState<Map<number, number[]>>(new Map());
  const [isDetecting, setIsDetecting] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [detectionProgress, setDetectionProgress] = useState(0);

  const serviceRef = useRef<FaceDetectionService | null>(null);
  const abortRef = useRef(false);
  const lastLengthRef = useRef(0);

  // Create service once
  useEffect(() => {
    serviceRef.current = new FaceDetectionService();
    return () => {
      abortRef.current = true;
      serviceRef.current?.dispose();
      serviceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (!images.length) return;
    // Only re-run when images are actually added
    if (images.length === lastLengthRef.current) return;
    lastLengthRef.current = images.length;

    const svc = serviceRef.current;
    if (!svc) return;

    abortRef.current = false;

    const run = async () => {
      try {
        if (!svc.isDetectionReady) {
          setIsLoadingModel(true);
          await svc.loadDetectionModel(undefined, setStatusMessage);
          if (abortRef.current) return;
          await svc.loadRecognitionModel(undefined, setStatusMessage);
          if (abortRef.current) return;
          try {
            await svc.loadGenderAgeModel(undefined, setStatusMessage);
          } catch (e) {
            console.warn('GenderAge model failed to load, skipping:', e);
          }
          if (abortRef.current) return;
          setIsLoadingModel(false);
        }

        setIsDetecting(true);
        setDetectionProgress(0);
        const srcs = images.map((img) => img.src);
        const totalImages = srcs.length;
        const MIN_PRESENCE_RATIO = 0.03;

        const raw: FaceCluster[] = await svc.processImages(
          srcs,
          (msg, idx, total) => {
            if (!abortRef.current) {
              setStatusMessage(msg);
              if (total > 0) setDetectionProgress(Math.round((idx + 1) / total * 100));
            }
          },
        );

        if (abortRef.current) return;

        // Only keep clusters appearing in ≥5% of album images
        const clusters = raw.filter(
          (cl) => totalImages === 0 || cl.photoCount / totalImages >= MIN_PRESENCE_RATIO,
        );

        setModelSubjects(clusters);

        // Build reverse map: imageIndex → [clusterId, ...]
        const imageMap = new Map<number, number[]>();
        clusters.forEach((cl) => {
          const seen = new Set<number>();
          cl.appearances.forEach(({ imageIndex }) => {
            if (seen.has(imageIndex)) return;
            seen.add(imageIndex);
            if (!imageMap.has(imageIndex)) imageMap.set(imageIndex, []);
            imageMap.get(imageIndex)!.push(cl.id);
          });
        });
        setModelImageMap(imageMap);
        setStatusMessage(`Model: ${clusters.length} people detected`);
      } catch (e) {
        if (!abortRef.current) {
          console.error('Face detection failed:', e);
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
  }, [images.length, enabled]);

  return { modelSubjects, modelImageMap, isDetecting, isLoadingModel, statusMessage, detectionProgress };
}
