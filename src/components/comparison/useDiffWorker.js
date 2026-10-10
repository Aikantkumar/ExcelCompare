import { useState, useCallback, useRef, useEffect } from 'react';
import { compareSheetsWorker, terminateWorker, isWorkerReady } from './workerClient.js';
import { compareSheetsCore, compressResult } from './diffWorkerCore.js';

const FALLBACK_THRESHOLD = 5000;

function estimateCellCount(sheetA, sheetB) {
  const rowsA = sheetA?.rows?.length || 0;
  const rowsB = sheetB?.rows?.length || 0;
  const colsA = sheetA?.rows?.[0]?.length || 0;
  const colsB = sheetB?.rows?.[0]?.length || 0;
  return Math.max(rowsA * colsA, rowsB * colsB);
}

export function useDiffWorker(options = {}) {
  const {
    fallbackToMainThread = true,
    onProgress,
    onError,
  } = options;

  const [diffData, setDiffData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workerStatus, setWorkerStatus] = useState({ ready: false, pending: 0 });

  const abortRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const checkStatus = setInterval(() => {
      if (mountedRef.current) {
        setWorkerStatus({
          ready: isWorkerReady(),
          pending: 0,
        });
      }
    }, 1000);
    return () => {
      mountedRef.current = false;
      clearInterval(checkStatus);
    };
  }, []);

  const computeDiff = useCallback(async (sheetA, sheetB, diffOptions = {}) => {
    if (!sheetA || !sheetB) {
      setDiffData(null);
      return null;
    }

    abortRef.current = false;
    setIsLoading(true);
    setError(null);
    onProgress?.(0, 'starting');

    try {
      const cellCount = estimateCellCount(sheetA, sheetB);
      const useWorker = fallbackToMainThread && cellCount > FALLBACK_THRESHOLD && isWorkerReady();

      onProgress?.(10, useWorker ? 'worker' : 'main');

      let result;
      if (useWorker) {
        result = await compareSheetsWorker(sheetA, sheetB, diffOptions);
      } else {
        result = compareSheetsCore(sheetA, sheetB, diffOptions);
      }

      if (abortRef.current) return null;

      onProgress?.(90, 'finalizing');

      const compressed = compressResult(result);

      onProgress?.(100, 'done');

      if (mountedRef.current) {
        setDiffData(compressed);
        setIsLoading(false);
      }

      return compressed;
    } catch (err) {
      if (abortRef.current) return null;

      const errMsg = err.message || 'Failed to compute diff';
      setError(errMsg);
      onError?.(err);

      if (fallbackToMainThread && err.message?.includes('Worker')) {
        try {
          onProgress?.(50, 'fallback');
          const result = compareSheetsCore(sheetA, sheetB, diffOptions);
          const compressed = compressResult(result);
          if (mountedRef.current) {
            setDiffData(compressed);
            setIsLoading(false);
          }
          return compressed;
        } catch (fallbackErr) {
          setError(fallbackErr.message || 'Fallback also failed');
          if (mountedRef.current) setIsLoading(false);
          return null;
        }
      }

      if (mountedRef.current) setIsLoading(false);
      return null;
    }
  }, [fallbackToMainThread, onProgress, onError]);

  const abort = useCallback(() => {
    abortRef.current = true;
    setIsLoading(false);
  }, []);

  const clear = useCallback(() => {
    setDiffData(null);
    setError(null);
  }, []);

  return {
    diffData,
    isLoading,
    error,
    workerStatus,
    computeDiff,
    abort,
    clear,
  };
}