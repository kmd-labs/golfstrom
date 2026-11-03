import { Injectable } from '@angular/core';
import * as THREE from 'three';

export interface LutEntry {
  lut: Uint8Array;
  lo: number;
  hi: number;
}

@Injectable({
  providedIn: 'root'
})
export class GolfstromMathService {
  readonly R = 10;

  // Gulf Stream spine path (lon, lat)
  readonly gsPath: [number, number][] = [
    [-82.0, 24.5], // Florida Straits
    [-80.0, 27.0], // Florida Coast
    [-76.5, 32.5], // Carolinas
    [-75.2, 35.2], // Cape Hatteras detachment
    [-70.0, 37.5], // Western meander zone
    [-63.0, 39.5], // Mid-Atlantic meander
    [-52.0, 42.0], // Grand Banks
    [-40.0, 46.0], // North Atlantic Current
    [-25.0, 51.0], // Mid-ocean drift
    [-12.0, 56.5], // West of Ireland / Hebrides
    [2.0, 62.0],   // Norwegian Sea entrance
    [12.0, 67.5],  // Lofoten / Bodø
    [22.0, 71.5]   // Barents Sea opening
  ];

  // Pre-built LUTs for SST and Anomaly
  readonly lutSst: LutEntry;
  readonly lutAnom: LutEntry;
  readonly lutAir: LutEntry;

  constructor() {
    this.lutSst = this.buildSstLut();
    this.lutAnom = this.buildAnomLut();
    this.lutAir = this.buildAirLut();
  }

  pos(lon: number, lat: number, r: number, out: THREE.Vector3): THREE.Vector3 {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    out.set(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
    return out;
  }

  clamp(v: number, min: number, max: number): number {
    return v < min ? min : v > max ? max : v;
  }

  lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Sample the Gulf Stream spine path at normalized parameter u [0, 1]
   */
  samplePath(u: number, meanderOffset = 0): [number, number] {
    const clampedU = this.clamp(u, 0, 1);
    const segs = this.gsPath.length - 1;
    const fIndex = clampedU * segs;
    const idx = Math.min(Math.floor(fIndex), segs - 1);
    const t = fIndex - idx;

    const p0 = this.gsPath[idx];
    const p1 = this.gsPath[idx + 1];

    let lon = this.lerp(p0[0], p1[0], t);
    let lat = this.lerp(p0[1], p1[1], t);

    // Apply meander perpendicular to segment past Cape Hatteras (u > 0.25)
    if (u > 0.25 && meanderOffset !== 0) {
      const dx = p1[0] - p0[0];
      const dy = p1[1] - p0[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const ampFactor = Math.sin((u - 0.25) / 0.75 * Math.PI);
      lon += nx * meanderOffset * ampFactor;
      lat += ny * meanderOffset * ampFactor;
    }

    return [lon, lat];
  }

  /**
   * Evaluates SST (°C) at a given (lon, lat) and month (0..11.99).
   */
  getSst(lon: number, lat: number, month: number): number {
    // Solar declination cycle: peaks in late June (~5.8)
    const solarMonth = (month - 2.8) * (2 * Math.PI / 12);
    const declination = 23.44 * Math.sin(solarMonth);

    // Base zonal temperature based on effective solar latitude
    const effLat = lat - declination * 0.75;
    const absLat = Math.abs(effLat);
    let baseSst = 29.5 * Math.cos(this.clamp(absLat, 0, 90) * (Math.PI / 150)) - 2.5;

    // Seasonal amplitude is higher in mid-to-high latitudes
    const seasonAmp = 4.5 * Math.sin(Math.abs(lat) * (Math.PI / 90));
    baseSst += seasonAmp * Math.sin(solarMonth);

    // Gulf Stream thermal anomaly (prominent in North Atlantic: lon -90 to +30, lat 15 to 75)
    let anomaly = 0;
    if (lon >= -95 && lon <= 40 && lat >= 15 && lat <= 75) {
      const gsDist = this.distanceToPath(lon, lat);
      if (gsDist.dist < 8.0) {
        const u = gsDist.u;
        // Thermal intensity is highest in Florida Straits/Hatteras, extending into Europe
        const alongDecay = this.lerp(9.5, 5.0, u);
        const crossDecay = Math.exp(-Math.pow(gsDist.dist / 3.2, 2));
        anomaly += alongDecay * crossDecay;

        // In winter (months 11, 0, 1), the warm anomaly contrast is strongest
        const winterBoost = 0.5 + 0.5 * Math.cos((month - 0.5) * (2 * Math.PI / 12));
        anomaly += 2.0 * winterBoost * crossDecay;
      }

      // Cold Labrador Current south of Greenland/Newfoundland
      if (lon >= -65 && lon <= -45 && lat >= 43 && lat <= 62) {
        const labDist = Math.hypot((lon - -55) * 0.7, lat - 53);
        if (labDist < 8.0) {
          anomaly -= 6.0 * (1 - labDist / 8.0);
        }
      }
    }

    return this.clamp(baseSst + anomaly, -2.5, 33.0);
  }

  /**
   * Evaluates SST anomaly (°C relative to zonal mean)
   */
  getAnomaly(lon: number, lat: number, month: number): number {
    const sst = this.getSst(lon, lat, month);
    // Approximate zonal mean
    const solarMonth = (month - 2.8) * (2 * Math.PI / 12);
    const declination = 23.44 * Math.sin(solarMonth);
    const effLat = lat - declination * 0.75;
    const baseZonal = 29.5 * Math.cos(this.clamp(Math.abs(effLat), 0, 90) * (Math.PI / 150)) - 2.5;
    return this.clamp(sst - baseZonal, -4.0, 5.0);
  }

  private distanceToPath(lon: number, lat: number): { dist: number; u: number } {
    let minDist = 999;
    let bestU = 0;
    const totalSegs = this.gsPath.length - 1;

    for (let i = 0; i < totalSegs; i++) {
      const p0 = this.gsPath[i];
      const p1 = this.gsPath[i + 1];

      // Segment vector
      const dx = p1[0] - p0[0];
      const dy = p1[1] - p0[1];
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;

      // Project point onto segment
      const t = this.clamp(((lon - p0[0]) * dx + (lat - p0[1]) * dy) / lenSq, 0, 1);
      const projX = p0[0] + t * dx;
      const projY = p0[1] + t * dy;

      // Distance approximation in degrees (lat weighted)
      const cosLat = Math.cos(lat * (Math.PI / 180));
      const dist = Math.hypot((lon - projX) * cosLat, lat - projY);

      if (dist < minDist) {
        minDist = dist;
        bestU = (i + t) / totalSegs;
      }
    }

    return { dist: minDist, u: bestU };
  }

  private buildSstLut(): LutEntry {
    // Continuous thermal range spanning full global ocean and land seasons (-20°C to +35°C)
    const lo = -20.0;
    const hi = 35.0;
    const lut = new Uint8Array(256 * 3);

    const stops: [number, [number, number, number]][] = [
      [-20.0, [79, 70, 229]],  // deep indigo / purple-600
      [-12.0, [37, 99, 235]],  // cold blue / primary-600
      [-4.0, [56, 189, 248]],  // frosty cyan / info-400
      [0.0, [130, 156, 158]],  // cool slate / sst-m2
      [5.0, [123, 142, 173]],  // sst-5
      [10.0, [131, 157, 189]], // sst-10
      [15.0, [147, 177, 206]], // sst-15
      [20.0, [193, 209, 222]], // sst-20
      [23.0, [220, 219, 194]], // sst-23
      [25.5, [237, 214, 133]], // sst-25-5
      [27.5, [234, 184, 31]],  // sst-27-5
      [29.2, [211, 116, 0]],   // warning-500 (#d37400)
      [31.0, [204, 62, 28]],   // sst-31
      [35.0, [164, 13, 25]]    // sst-35
    ];

    for (let i = 0; i < 256; i++) {
      const val = lo + (i / 255) * (hi - lo);
      const rgb = this.interpolateStops(val, stops);
      lut[i * 3] = rgb[0];
      lut[i * 3 + 1] = rgb[1];
      lut[i * 3 + 2] = rgb[2];
    }

    return { lut, lo, hi };
  }

  private buildAnomLut(): LutEntry {
    const lo = -3.0;
    const hi = 3.0;
    const lut = new Uint8Array(256 * 3);

    const stops: [number, [number, number, number]][] = [
      [-3.0, [37, 99, 235]],   // primary-600
      [-1.5, [96, 165, 250]],  // primary-400
      [0.0, [245, 247, 251]],  // neutral-50
      [1.5, [230, 146, 46]],   // warning-400
      [3.0, [220, 38, 38]]     // danger-600
    ];

    for (let i = 0; i < 256; i++) {
      const val = lo + (i / 255) * (hi - lo);
      const rgb = this.interpolateStops(val, stops);
      lut[i * 3] = rgb[0];
      lut[i * 3 + 1] = rgb[1];
      lut[i * 3 + 2] = rgb[2];
    }

    return { lut, lo, hi };
  }

  private buildAirLut(): LutEntry {
    const lo = -25.0;
    const hi = 35.0;
    const lut = new Uint8Array(256 * 3);

    // Thermal spectrum for land air temperatures
    const stops: [number, [number, number, number]][] = [
      [-25.0, [99, 102, 241]], // deep indigo / purple-500
      [-15.0, [37, 99, 235]],  // cold blue / primary-600
      [-5.0, [14, 165, 233]],  // crisp frosty cyan / info-500
      [2.0, [147, 197, 253]],  // pale ice blue / primary-300
      [8.0, [52, 211, 153]],   // mild temperate green / success-400
      [14.0, [253, 224, 71]],  // sunny pale yellow
      [20.0, [247, 178, 99]],  // warm amber / warning-300
      [27.0, [211, 116, 0]],   // brand orange (#D37400) / warning-500
      [35.0, [220, 38, 38]]    // hot red / danger-600
    ];

    for (let i = 0; i < 256; i++) {
      const val = lo + (i / 255) * (hi - lo);
      const rgb = this.interpolateStops(val, stops);
      lut[i * 3] = rgb[0];
      lut[i * 3 + 1] = rgb[1];
      lut[i * 3 + 2] = rgb[2];
    }

    return { lut, lo, hi };
  }

  private interpolateStops(val: number, stops: [number, [number, number, number]][]): [number, number, number] {
    if (val <= stops[0][0]) return stops[0][1];
    if (val >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];

    for (let i = 0; i < stops.length - 1; i++) {
      const s0 = stops[i];
      const s1 = stops[i + 1];
      if (val >= s0[0] && val <= s1[0]) {
        const t = (val - s0[0]) / (s1[0] - s0[0]);
        return [
          Math.round(this.lerp(s0[1][0], s1[1][0], t)),
          Math.round(this.lerp(s0[1][1], s1[1][1], t)),
          Math.round(this.lerp(s0[1][2], s1[1][2], t))
        ];
      }
    }

    return stops[0][1];
  }
}
