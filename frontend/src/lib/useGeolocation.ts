import { useCallback, useEffect, useRef, useState } from "react";

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy?: number;
}

export type GeolocationPermission = "pending" | "granted" | "denied" | "unavailable";

export interface GeolocationState {
  /** Latest known position, or null before the first fix. */
  position: GeoPosition | null;
  /** Whether the browser granted access. */
  permission: GeolocationPermission;
  /** Human-readable reason when permission is denied/unavailable. */
  error: string | null;
  /** True while we're waiting for the browser to answer. */
  locating: boolean;
  /** Re-request location access (used by the "Enable location" button). */
  request: () => void;
}

function messageFor(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location access was denied.";
    case error.POSITION_UNAVAILABLE:
      return "Your location could not be determined.";
    case error.TIMEOUT:
      return "Timed out while finding your location.";
    default:
      return error.message || "Geolocation failed.";
  }
}

/**
 * Requests geolocation on mount and keeps watching for live fixes so the map
 * avatar follows the user. Exposes a `request()` to re-prompt after a denial.
 */
export function useGeolocation(): GeolocationState {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [permission, setPermission] = useState<GeolocationPermission>("pending");
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(true);
  const watchIdRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setPermission("unavailable");
      setError("Geolocation is not supported by this browser.");
      setLocating(false);
      return;
    }

    stop();
    setLocating(true);
    setError(null);

    // watchPosition also surfaces the initial permission prompt. Live fixes keep
    // the avatar glued to the real position like the dedicated map page does.
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
        });
        setPermission("granted");
        setError(null);
        setLocating(false);
      },
      (err) => {
        setPermission(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
        setError(messageFor(err));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
    );
  }, [stop]);

  useEffect(() => {
    request();
    return () => stop();
  }, [request, stop]);

  return { position, permission, error, locating, request };
}
