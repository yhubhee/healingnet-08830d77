export interface LatLng { lat: number; lng: number }

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

export interface RankedHospital {
  id: string;
  name: string;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  distanceKm: number | null;
  hasSpecialty: boolean;
}

export function rankHospitals(
  user: LatLng | null,
  hospitals: { id: string; name: string; city?: string | null; lat?: number | null; lng?: number | null }[],
  hospitalsWithSpecialty: Set<string>,
): RankedHospital[] {
  return hospitals
    .map((h) => ({
      id: h.id,
      name: h.name,
      city: h.city,
      lat: h.lat,
      lng: h.lng,
      hasSpecialty: hospitalsWithSpecialty.has(h.id),
      distanceKm:
        user && h.lat != null && h.lng != null
          ? haversineKm(user, { lat: h.lat, lng: h.lng })
          : null,
    }))
    .sort((a, b) => {
      if (a.hasSpecialty !== b.hasSpecialty) return a.hasSpecialty ? -1 : 1;
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    })
    .slice(0, 5);
}
