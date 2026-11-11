<<<<<<< HEAD
export interface RoadRoute {
  distance: number;
  duration: number;
}

export class OsrmService {
  private readonly baseUrl = (process.env.OSRM_URL || 'http://localhost:5000').replace(/\/$/, '');

=======
import { Injectable } from '@nestjs/common';

@Injectable()
export class OsrmService {
>>>>>>> fd97a80cb2fd24b1c20bc0898a0bcd57512d0ac2
  async calculateRoadDistance(
    lat1: number,
    lon1: number,
    lat2: number,
<<<<<<< HEAD
    lon2: number,
  ): Promise<RoadRoute> {
    for (const value of [lat1, lon1, lat2, lon2]) {
      if (!Number.isFinite(value)) throw new Error('Coordinates must be finite numbers');
    }
    if (Math.abs(lat1) > 90 || Math.abs(lat2) > 90 || Math.abs(lon1) > 180 || Math.abs(lon2) > 180) {
      throw new Error('Coordinates are out of range');
    }

    const url = `${this.baseUrl}/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`OSRM request failed with HTTP ${response.status}`);
    const data = await response.json() as { code?: string; routes?: Array<{ distance: number; duration: number }> };
    const route = data.routes?.[0];
    if (data.code !== 'Ok' || !route) throw new Error('OSRM could not find a route');
    return { distance: route.distance / 1000, duration: route.duration };
=======
    lon2: number
  ): Promise<{ distance: number; duration: number }> {
    // Stub implementation for now
    console.log(`Calculating route from (${lat1}, ${lon1}) to (${lat2}, ${lon2})`);
    return {
      distance: 15.5,
      duration: 1200,
    };
>>>>>>> fd97a80cb2fd24b1c20bc0898a0bcd57512d0ac2
  }
}
