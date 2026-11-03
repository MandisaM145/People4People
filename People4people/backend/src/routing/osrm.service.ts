import { Injectable } from '@nestjs/common';

@Injectable()
export class OsrmService {
  async calculateRoadDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): Promise<{ distance: number; duration: number }> {
    // Stub implementation for now
    console.log(`Calculating route from (${lat1}, ${lon1}) to (${lat2}, ${lon2})`);
    return {
      distance: 15.5,
      duration: 1200,
    };
  }
}
