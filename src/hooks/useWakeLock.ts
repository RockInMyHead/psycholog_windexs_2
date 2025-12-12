import { useEffect, useRef } from "react";

/**
 * Keeps the screen awake while `enabled` is true (where supported).
 * Uses the Screen Wake Lock API; silently fails on unsupported browsers.
 */
export const useWakeLock = (enabled: boolean) => {
  const wakeLockRef = useRef<any>(null);
  const shouldHoldRef = useRef(enabled);

  useEffect(() => {
    shouldHoldRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    let cancelled = false;

    const requestWakeLock = async () => {
      if (!enabled) return;
      if (!("wakeLock" in navigator)) return;
      try {
        // @ts-ignore - wakeLock is experimental
        const sentinel = await (navigator as any).wakeLock.request("screen");
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        wakeLockRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          wakeLockRef.current = null;
          // Re-acquire if still needed and tab visible
          if (shouldHoldRef.current && document.visibilityState === "visible") {
            requestWakeLock().catch(() => {});
          }
        });
      } catch (err) {
        // Ignore errors (e.g., user denied, not allowed on background tab)
        console.warn("[WakeLock] request failed:", err);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && shouldHoldRef.current) {
        requestWakeLock().catch(() => {});
      } else {
        if (wakeLockRef.current) {
          wakeLockRef.current.release().catch(() => {});
          wakeLockRef.current = null;
        }
      }
    };

    if (enabled) {
      requestWakeLock().catch(() => {});
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
};
