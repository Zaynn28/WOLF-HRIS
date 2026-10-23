import type { OfficeLocation } from '../types';

export const OFFICE_PUNCH_RADIUS_METERS = 1000;

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export function formatMeters(meters: number): string {
  return `${Math.round(meters).toLocaleString('en-US')} m`;
}

export function readyOfficePin(office: OfficeLocation | null): OfficeLocation | null {
  if (!office) return null;
  const name = office.name.trim();
  if (!name) return null;
  if (!Number.isFinite(office.latitude) || office.latitude < -90 || office.latitude > 90) return null;
  if (!Number.isFinite(office.longitude) || office.longitude < -180 || office.longitude > 180) return null;
  return { name, latitude: office.latitude, longitude: office.longitude };
}

export function officePunchCheck(
  latitude: number,
  longitude: number,
  office: OfficeLocation | null,
): { allowed: boolean; distanceMeters: number | null; message: string } {
  const pin = readyOfficePin(office);
  if (!pin) {
    return {
      allowed: false,
      distanceMeters: null,
      message: 'Office location is not set. HR must set the office pin before a punch can be saved.',
    };
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      allowed: false,
      distanceMeters: null,
      message: 'A GPS fix is required.',
    };
  }
  const distanceMeters = haversineMeters(latitude, longitude, pin.latitude, pin.longitude);
  if (distanceMeters > OFFICE_PUNCH_RADIUS_METERS) {
    return {
      allowed: false,
      distanceMeters,
      message: `You are ${formatMeters(distanceMeters)} from ${pin.name}. You must be within ${formatMeters(OFFICE_PUNCH_RADIUS_METERS)} of the office.`,
    };
  }
  return {
    allowed: true,
    distanceMeters,
    message: `${formatMeters(distanceMeters)} from ${pin.name}. Within ${formatMeters(OFFICE_PUNCH_RADIUS_METERS)} of the office.`,
  };
}

export function punchRejection(
  photo: string | null | undefined,
  latitude: number,
  longitude: number,
  office: OfficeLocation | null,
): string | null {
  if (!photo) return 'A photo is required before this punch can be saved.';
  const check = officePunchCheck(latitude, longitude, office);
  return check.allowed ? null : check.message;
}
