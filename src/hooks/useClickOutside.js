import { useRef, useCallback, useEffect } from 'react';

export function useClickOutside(ref, onOutside, enabled = true) {
  const handlePointerDown = useCallback(
    (event) => {
      if (!enabled || !ref.current) return;
      if (ref.current.contains(event.target)) return;
      onOutside();
    },
    [ref, onOutside, enabled]
  );

  useEffect(() => {
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        onOutside();
      }
    });
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          onOutside();
        }
      });
    };
  }, [enabled, ref, onOutside]);
}