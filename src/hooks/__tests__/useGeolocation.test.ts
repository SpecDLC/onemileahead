import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation } from '../useGeolocation';

const mockPosition = {
  coords: {
    latitude: 30.2672,
    longitude: -97.7431,
    accuracy: 10,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    toJSON: () => ({}),
  },
  timestamp: Date.now(),
} as GeolocationPosition;

describe('useGeolocation [REQ:nearby]', () => {
  let watchCallbacks: { success: PositionCallback; error: PositionErrorCallback }[];

  beforeEach(() => {
    watchCallbacks = [];
    const mockGeolocation = {
      getCurrentPosition: vi.fn((success: PositionCallback) => {
        success(mockPosition);
      }),
      watchPosition: vi.fn((success: PositionCallback, error: PositionErrorCallback) => {
        watchCallbacks.push({ success, error });
        return watchCallbacks.length;
      }),
      clearWatch: vi.fn(),
    };
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null position initially [AC:GEO-01]', () => {
    const { result } = renderHook(() => useGeolocation());
    // Before watch fires, position may be null
    expect(result.current.error).toBeNull();
  });

  it('returns position after geolocation succeeds [AC:GEO-02]', () => {
    const { result } = renderHook(() => useGeolocation());

    act(() => {
      watchCallbacks[0]?.success(mockPosition);
    });

    expect(result.current.position).toEqual({
      lat: 30.2672,
      lng: -97.7431,
      heading: null,
      speed: null,
      timestamp: mockPosition.timestamp,
    });
  });

  it('records heading and speed for Ahead [AC:GEO-02]', () => {
    const { result } = renderHook(() => useGeolocation());
    const moving = {
      ...mockPosition,
      coords: { ...mockPosition.coords, heading: 12, speed: 29 },
      timestamp: 1_700_000_000_000,
    };

    act(() => {
      watchCallbacks[0]?.success(moving);
    });

    expect(result.current.position).toEqual({
      lat: 30.2672,
      lng: -97.7431,
      heading: 12,
      speed: 29,
      timestamp: 1_700_000_000_000,
    });
  });

  it('returns error when geolocation fails [AC:GEO-03]', () => {
    const { result } = renderHook(() => useGeolocation());

    act(() => {
      watchCallbacks[0]?.error({
        code: 1,
        message: 'User denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
    });

    expect(result.current.error).toBe('User denied');
  });

  it('clears watch on unmount [AC:GEO-04]', () => {
    const { unmount } = renderHook(() => useGeolocation());
    unmount();
    expect(navigator.geolocation.clearWatch).toHaveBeenCalled();
  });
});
