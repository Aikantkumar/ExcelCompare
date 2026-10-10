/**
 * Main-thread worker wrapper for diff computation.
 * Handles worker lifecycle, message passing, and promise-based API.
 */

let workerInstance = null;
let workerReady = false;
let initPromise = null;
let messageId = 0;
const pendingRequests = new Map();

function initWorker() {
  if (initPromise) return initPromise;
  if (workerInstance && workerReady) return Promise.resolve(workerInstance);

  initPromise = (async () => {
    workerInstance = createWorker();

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker initialization timeout'));
      }, 5000);

      workerInstance.addEventListener('message', function handler(e) {
        if (e.data.type === 'PONG') {
          clearTimeout(timeout);
          workerInstance.removeEventListener('message', handler);
          workerReady = true;
          resolve(true);
        }
      });

      workerInstance.postMessage({ id: 0, type: 'PING' });
    });

    return workerInstance;
  })();

  return initPromise;
}

function createWorker() {
  if (typeof Worker === 'undefined') {
    throw new Error('Web Workers not supported in this environment');
  }

  const worker = new Worker(
    new URL('./diff.worker.js', import.meta.url),
    { type: 'module' }
  );

  worker.onmessage = (e) => {
    const { id, type, payload } = e.data;
    const pending = pendingRequests.get(id);
    if (!pending) return;

    pendingRequests.delete(id);

    if (type === 'RESULT') {
      pending.resolve(payload);
    } else if (type === 'ERROR') {
      pending.reject(new Error(payload.message || 'Worker error'));
    } else if (type === 'PONG') {
      pending.resolve(true);
    }
  };

  worker.onerror = (err) => {
    console.error('Diff worker error:', err);
    workerReady = false;
    workerInstance = null;
    initPromise = null;
    pendingRequests.forEach(({ reject }) => {
      reject(new Error('Worker crashed'));
    });
    pendingRequests.clear();
  };

  return worker;
}

async function ensureWorker() {
  if (workerInstance && workerReady) {
    return workerInstance;
  }
  await initWorker();
  return workerInstance;
}

export async function compareSheetsWorker(sheetA, sheetB, options = {}) {
  const worker = await ensureWorker();

  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pendingRequests.set(id, { resolve, reject });

    worker.postMessage({
      id,
      type: 'COMPARE',
      payload: { sheetA, sheetB, options },
    });

    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Worker comparison timeout'));
      }
    }, 120000);
  });
}

export function terminateWorker() {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
    workerReady = false;
    initPromise = null;
    pendingRequests.forEach(({ reject }) => {
      reject(new Error('Worker terminated'));
    });
    pendingRequests.clear();
  }
}

export function isWorkerReady() {
  return workerReady && workerInstance !== null;
}

export function getWorkerStatus() {
  return {
    ready: workerReady,
    hasInstance: workerInstance !== null,
    pendingRequests: pendingRequests.size,
  };
}

export function isWorkerSupported() {
  return typeof Worker !== 'undefined';
}

export { initWorker };