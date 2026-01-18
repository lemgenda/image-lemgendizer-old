import { useEffect, useRef } from 'react';


import { MAXIM_MODEL_URLS } from '../constants/sharedConstants';
import { preloadMaximInWorker, preloadUpscalerInWorker, detectObjectsInWorker, warmupAIModels } from '../utils/aiWorkerUtils';

// Priority: Enhancement (most generic) -> Deblur -> 2x -> Coco
// [Antigravity] Optimized queue for v3.7.0:
// - Preload essential models only (Enhancement, Deblur, 2x, Coco)
// - Lazy load 3x/4x and specialized MAXIM models (Denoising, Deraining, etc.)
const PRELOAD_QUEUE = [
    { name: 'Enhancement', url: MAXIM_MODEL_URLS.ENHANCEMENT, type: 'maxim' },
    { name: 'Deblur', url: MAXIM_MODEL_URLS.DEBLUR, type: 'maxim' },
    { name: 'Smart Resizer 2x', url: '2x', type: 'upscaler' },
    // Note: 'coco-ssd' type in worker triggers loading of Coco-SSD, Body Segmentation, and Face Landmarks if configured.
    { name: 'Smart Crop (Object/Face/Body)', url: 'coco-ssd', type: 'coco' }
];

const INITIAL_DELAY_MS = 1000; // Wait 1s after mount before starting
const IDLE_TIMEOUT_MS = 10000; // Max time to wait for idle before forcing

/**
 * Hook to intelligently preload Maxim AI models during browser idle time.
 * This prevents blocking the main thread during startup while ensuring models
 * are ready when the user likely needs them.
 */
const createDummyBitmap = async (): Promise<ImageData> => {
    return new ImageData(1, 1);
};

export const useMaximPreloader = (isProcessing: boolean) => {
    const queueIndexRef = useRef(0);
    const isPreloadingRef = useRef(false);
    const hasStartedRef = useRef(false);
    const idleCallbackIdRef = useRef<number | null>(null);
    const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Don't start if already processing user images or already started
        if (isProcessing || hasStartedRef.current) return;

        const processNext = async () => {
            if (isProcessing) {
                // User is busy, pause preloading
                isPreloadingRef.current = false;
                return;
            }

            if (queueIndexRef.current >= PRELOAD_QUEUE.length) {
                // All models preloaded, trigger warmup
                if (!hasStartedRef.current) { // Ensure we only warmup once per session
                    console.log('🔥 [Antigravity] Preloader: Queue complete. Warming up models...');
                    warmupAIModels().then(() => {
                        console.log('✅ [Antigravity] Preloader: Warmup complete. System ready.');
                    });
                    hasStartedRef.current = true; // Mark as fully started/complete
                }
                return;
            }

            const item = PRELOAD_QUEUE[queueIndexRef.current];
            isPreloadingRef.current = true;
            // hasStartedRef.current is set to true on initial start, but we use strict queue index check above.


            try {
                // Use Idle Callback if available to schedule the actual load
                if ('requestIdleCallback' in window) {
                    idleCallbackIdRef.current = (window as any).requestIdleCallback(async (deadline: any) => {
                        // If we have enough time or timed out, load.
                        // For heavy models like Maxim, we can't really "pause" the load once started,
                        // but starting it during idle helps.
                        if (deadline.timeRemaining() > 10 || deadline.didTimeout) {
                            // showToast(`Background optimizing: ${item.name}...`, 'info', 2000);

                            try {
                                if (item.type === 'upscaler') {
                                    await preloadUpscalerInWorker(Number(item.url.replace('x', '')));
                                } else if (item.type === 'coco') {
                                    await detectObjectsInWorker(await createDummyBitmap());
                                } else {
                                    await preloadMaximInWorker(item.url);
                                }
                            } catch (e) {
                                console.warn(`[Antigravity] [Preloader] Failed to preload ${item.name}:`, e);
                            }

                            queueIndexRef.current++;
                            isPreloadingRef.current = false;
                            processNext();
                        } else {
                            processNext();
                        }
                    }, { timeout: IDLE_TIMEOUT_MS });
                } else {
                    try {
                        if (item.type === 'upscaler') {
                            await preloadUpscalerInWorker(Number(item.url.replace('x', '')));
                        } else {
                            await preloadMaximInWorker(item.url);
                        }
                    } catch (e) {
                        console.warn(`[Antigravity] [Preloader] Failed to preload ${item.name}:`, e);
                    }
                    queueIndexRef.current++;
                    isPreloadingRef.current = false;
                    setTimeout(processNext, 1000);
                }
            } catch (e) {
                console.warn('[Antigravity Debug] [Preloader] Error in loop', e);
                queueIndexRef.current++; // Skip failed
                isPreloadingRef.current = false;
                processNext();
            }
        };

        // Initial start delay
        timeoutIdRef.current = setTimeout(() => {
            console.log('🧘 [Antigravity] Preloader Zen: Starting background optimization...');
            hasStartedRef.current = true;
            processNext();
        }, INITIAL_DELAY_MS);

        return () => {
            if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
            if (idleCallbackIdRef.current && 'cancelIdleCallback' in window) {
                (window as any).cancelIdleCallback(idleCallbackIdRef.current);
            }
        };

    }, [isProcessing]); // Re-eval if processing state changes (pause/resume logic handled in processNext check)
};
