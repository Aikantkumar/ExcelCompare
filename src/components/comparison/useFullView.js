import { useState, useEffect, useRef, useCallback } from 'react';

function canFullscreen() {
  return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
}

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function enterBrowserFullscreen() {
  const el = document.documentElement;
  const request = el.requestFullscreen || el.webkitRequestFullscreen;
  if (request) {
    Promise.resolve(request.call(el)).catch(() => {});
  }
}

function exitBrowserFullscreen() {
  if (!getFullscreenElement()) return;
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (exit) {
    Promise.resolve(exit.call(document)).catch(() => {});
  }
}

export function useFullView(options = {}) {
  const {
    isDesktop = true,
    onExitFullscreen,
  } = options;

  const [isFullView, setIsFullView] = useState(false);
  const prevOverflowRef = useRef('');
  const prevScrollYRef = useRef(0);
  const isExitingRef = useRef(false);

  const exitFullView = useCallback(() => {
    isExitingRef.current = true;
    setIsFullView(false);
    exitBrowserFullscreen();
    if (onExitFullscreen) onExitFullscreen();
  }, [onExitFullscreen]);

  const toggleFullView = useCallback(() => {
    setIsFullView((prev) => {
      const next = !prev;
      if (next) {
        prevOverflowRef.current = document.body.style.overflow;
        prevScrollYRef.current = window.scrollY;
        if (isDesktop) {
          document.body.style.overflow = 'hidden';
        }
        if (canFullscreen()) {
          enterBrowserFullscreen();
        }
      } else {
        exitBrowserFullscreen();
      }
      return next;
    });
  }, [isDesktop]);

  // Keep React state in sync with browser fullscreen (Esc in browser fullscreen)
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!getFullscreenElement() && !isExitingRef.current) {
        setIsFullView((prev) => (getFullscreenElement() ? prev : false));
      }
      isExitingRef.current = false;
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Full view: Esc to exit, lock body scroll
  useEffect(() => {
    if (!isFullView) return;

    let prevOverflow = '';
    if (isDesktop) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        exitFullView();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      if (isDesktop) {
        document.body.style.overflow = prevOverflow || prevOverflowRef.current;
      }
      window.removeEventListener('keydown', handleKeyDown);
      if (getFullscreenElement()) {
        exitBrowserFullscreen();
      }
    };
  }, [isFullView, isDesktop, exitFullView]);

  // Restore page scroll position on exit
  useEffect(() => {
    if (!isFullView && prevScrollYRef.current !== 0) {
      const y = prevScrollYRef.current;
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
    }
  }, [isFullView]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (getFullscreenElement()) {
        exitBrowserFullscreen();
      }
      if (isDesktop && prevOverflowRef.current !== undefined) {
        document.body.style.overflow = prevOverflowRef.current;
      }
    };
  }, [isDesktop]);

  return { isFullView, toggleFullView, exitFullView };
}