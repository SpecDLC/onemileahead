import { useState, useEffect, useRef } from 'react';
import { isWasmEngineEnabled } from '../engine/flag';

export interface GeoPosition {
  lat: number;
  lng: number;
  /** Degrees clockwise from north, when the device reports one (used by the Ahead tab). */
  heading?: number | null;
  /** Metres per second, when the device reports one. */
  speed?: number | null;
  /** Fix time in milliseconds. */
  timestamp?: number;
}

interface GeolocationState {
  position: GeoPosition | null;
  error: string | null;
}

export function useGeolocation(): GeolocationState {
  // Unsupported is known at first render, so it is initial state rather than set in the effect.
  const [state, setState] = useState<GeolocationState>(() => ({
    position: null,
    error: navigator.geolocation ? null : 'Geolocation not supported',
  }));
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    // Read once per mount: the flag comes from the page URL.
    const withMotion = isWasmEngineEnabled();

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          position: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            // Only the ?engine=wasm Ahead tab uses these; the default shape stays unchanged.
            ...(withMotion && {
              heading: pos.coords.heading,
              speed: pos.coords.speed,
              timestamp: pos.timestamp,
            }),
          },
          error: null,
        });
      },
      (err) => {
        setState((prev) => ({ ...prev, error: err.message }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  return state;
}
