import { compareSheetsCore, compressResult } from './diffWorkerCore.js';

let pendingId = 0;
const pendingCallbacks = new Map();

self.onmessage = (e) => {
  const { id, type, payload } = e.data;

  if (type === 'COMPARE') {
    try {
      const { sheetA, sheetB, options } = payload;
      const result = compareSheetsCore(sheetA, sheetB, options);
      const compressed = compressResult(result);

      self.postMessage({
        id,
        type: 'RESULT',
        payload: compressed,
      });
    } catch (err) {
      self.postMessage({
        id,
        type: 'ERROR',
        payload: { message: err.message, stack: err.stack },
      });
    }
  } else if (type === 'PING') {
    self.postMessage({ id, type: 'PONG' });
  }
};

self.addEventListener('error', (err) => {
  console.error('Worker error:', err);
});

self.addEventListener('unhandledrejection', (err) => {
  console.error('Worker unhandled rejection:', err);
});