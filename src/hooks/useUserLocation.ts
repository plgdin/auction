import { useState, useCallback } from 'react';
import { CITY_COORDINATES, calculateDistanceKm, type GeoPoint } from '../utils/geoCoordinates';

const STORAGE_KEY_LAT = 'lelam_geo_lat';
const STORAGE_KEY_LNG = 'lelam_geo_lng';
const STORAGE_KEY_NAME = 'lelam_geo_name';

export interface UserLocationState {
  lat: number | null;
  lng: number | null;
  locationName: string | null;
  isLoading: boolean;
  error: string | null;
  permissionDenied: boolean;
}

/**
 * Finds the closest known city name to the given coordinates.
 */
function findNearestCityName(lat: number, lng: number): string | null {
  let closestCity: string | null = null;
  let minDistance = Infinity;

  for (const [city, pt] of Object.entries(CITY_COORDINATES)) {
    const dist = calculateDistanceKm(lat, lng, pt.lat, pt.lng);
    if (dist < minDistance && dist <= 80) { // within 80km of a major city
      minDistance = dist;
      closestCity = city;
    }
  }

  if (closestCity) {
    return closestCity.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  return `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
}

export function useUserLocation() {
  const [state, setState] = useState<UserLocationState>(() => {
    // Check if previously stored in sessionStorage
    try {
      const storedLat = sessionStorage.getItem(STORAGE_KEY_LAT);
      const storedLng = sessionStorage.getItem(STORAGE_KEY_LNG);
      const storedName = sessionStorage.getItem(STORAGE_KEY_NAME);
      if (storedLat && storedLng) {
        return {
          lat: parseFloat(storedLat),
          lng: parseFloat(storedLng),
          locationName: storedName || null,
          isLoading: false,
          error: null,
          permissionDenied: false,
        };
      }
    } catch {
      // ignore storage access errors
    }

    return {
      lat: null,
      lng: null,
      locationName: null,
      isLoading: false,
      error: null,
      permissionDenied: false,
    };
  });

  const requestLocation = useCallback(async (enableHighAccuracy = true): Promise<GeoPoint | null> => {
    if (!navigator.geolocation) {
      const errMsg = 'Geolocation is not supported by your browser.';
      setState(prev => ({ ...prev, isLoading: false, error: errMsg }));
      return null;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null, permissionDenied: false }));

    return new Promise<GeoPoint | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const name = findNearestCityName(lat, lng);

          try {
            sessionStorage.setItem(STORAGE_KEY_LAT, lat.toString());
            sessionStorage.setItem(STORAGE_KEY_LNG, lng.toString());
            if (name) sessionStorage.setItem(STORAGE_KEY_NAME, name);
          } catch {
            // ignore storage errors
          }

          setState({
            lat,
            lng,
            locationName: name,
            isLoading: false,
            error: null,
            permissionDenied: false,
          });

          resolve({ lat, lng });
        },
        (err) => {
          let errorMsg = 'Failed to retrieve your location.';
          let denied = false;

          if (err.code === err.PERMISSION_DENIED) {
            errorMsg = 'Location permission was denied. Please enable location in your browser settings.';
            denied = true;
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            errorMsg = 'Location information is currently unavailable.';
          } else if (err.code === err.TIMEOUT) {
            errorMsg = 'Location request timed out. Please try again.';
          }

          setState(prev => ({
            ...prev,
            isLoading: false,
            error: errorMsg,
            permissionDenied: denied,
          }));

          resolve(null);
        },
        {
          enableHighAccuracy,
          timeout: 12000,
          maximumAge: 300000, // cache for 5 mins in browser
        }
      );
    });
  }, []);

  const clearLocation = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY_LAT);
      sessionStorage.removeItem(STORAGE_KEY_LNG);
      sessionStorage.removeItem(STORAGE_KEY_NAME);
    } catch {
      // ignore
    }
    setState({
      lat: null,
      lng: null,
      locationName: null,
      isLoading: false,
      error: null,
      permissionDenied: false,
    });
  }, []);

  return {
    ...state,
    requestLocation,
    clearLocation,
    hasLocation: state.lat !== null && state.lng !== null,
  };
}
