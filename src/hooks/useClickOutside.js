import { useEffect, useRef } from 'react';

export function useClickOutside(ref, onOutside, enabled = true) {
  const callbackRef = useRef(onOutside);
  callbackRef.current = onOutside;

  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        callbackRef.current();
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') callbackRef.current();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, ref]);
}