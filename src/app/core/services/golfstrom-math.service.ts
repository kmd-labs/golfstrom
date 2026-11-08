import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { ThemeService } from '@kmd/design-system/services/theme.service';

export interface LutEntry {
  lut: Uint8Array;
  lo: number;
  hi: number;
}

/** Shown range of the water temperature scale (°C). */
export const SST_SCALE_RANGE: [number, number] = [-2, 35];

/** Shown range of the temperature anomaly scale (°C). */
export const ANOM_SCALE_RANGE: [number, number] = [-6, 6];

/** Temperature Anomaly (°C vs normal) scale stops mapped to KMD brand thermal gradient */
export const ANOM_COLOR_TOKENS: [number, string][] = [
  [-6.0, 'sst-m2'],
  [-4.5, 'sst-0'],
  [-3.0, 'sst-5'],
  [-2.0, 'sst-10'],
  [-1.0, 'sst-15'],
  [0.0, 'sst-20'],
  [1.0, 'sst-23'],
  [2.0, 'sst-25-5'],
  [3.0, 'sst-27-5'],
  [4.0, 'sst-29-2'],
  [5.0, 'sst-31'],
  [6.0, 'sst-35']
];

/** Thermal (Sea Surface Temperature, °C) scale stops mapped to SCSS design tokens */
export const THERMAL_COLOR_TOKENS: [number, string][] = [
  [-2.0, 'sst-m2'],
  [0.0, 'sst-0'],
  [5.0, 'sst-5'],
  [10.0, 'sst-10'],
  [15.0, 'sst-15'],
  [20.0, 'sst-20'],
  [23.0, 'sst-23'],
  [25.5, 'sst-25-5'],
  [27.5, 'sst-27-5'],
  [29.2, 'sst-29-2'],
  [31.0, 'sst-31'],
  [35.0, 'sst-35']
];

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

  // Pre-built LUTs for SST, Anomaly and Land Air Temperature
  lutSst!: LutEntry;
  lutAnom!: LutEntry;
  lutAir!: LutEntry;

  constructor(private theme: ThemeService) {
    this.refreshLutsFromTokens();
  }

  /**
   * Rebuilds the thermal and anomaly LUTs directly from `:root` SCSS design token CSS variables,
   * ensuring 100% color consistency between the WebGL/Canvas visualizers and the dock legends.
   */
  refreshLutsFromTokens(): void {
    const thermalFallbacks: Record<string, string> = {
      'sst-m2': '#829c9e',
      'sst-0': '#7f98a2',
      'sst-5': '#7b8ead',
      'sst-10': '#839dbd',
      'sst-15': '#93b1ce',
      'sst-20': '#c1d1de',
      'sst-23': '#dcdbc2',
      'sst-25-5': '#edd685',
      'sst-27-5': '#eab81f',
      'sst-29-2': '#d37400',
      'sst-31': '#cc3e1c',
      'sst-35': '#a40d19'
    };

    this.lutSst = this.buildLUT(THERMAL_COLOR_TOKENS, thermalFallbacks);
    this.lutAnom = this.buildLUT(ANOM_COLOR_TOKENS, thermalFallbacks);
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
   * Evaluates SST anomaly (°C relative to zonal mean) clamped to official design system scale range [-6, 6]
   */
  getAnomaly(lon: number, lat: number, month: number): number {
    const sst = this.getSst(lon, lat, month);
    // Base zonal mean with seasonal insolation cycle
    const solarMonth = (month - 2.8) * (2 * Math.PI / 12);
    const declination = 23.44 * Math.sin(solarMonth);
    const effLat = lat - declination * 0.75;
    let baseZonal = 29.5 * Math.cos(this.clamp(Math.abs(effLat), 0, 90) * (Math.PI / 150)) - 2.5;
    const seasonAmp = 4.5 * Math.sin(Math.abs(lat) * (Math.PI / 90));
    baseZonal += seasonAmp * Math.sin(solarMonth);
    return this.clamp(sst - baseZonal, -6.0, 6.0);
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

  private hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
      return [
        parseInt(clean[0] + clean[0], 16) || 0,
        parseInt(clean[1] + clean[1], 16) || 0,
        parseInt(clean[2] + clean[2], 16) || 0
      ];
    }
    const num = parseInt(clean, 16) || 0;
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  /**
   * Builds a continuous 256-step lookup table dynamically reading SCSS design tokens
   * via ThemeService (`--color-*`).
   */
  buildLUT(tokens: [number, string][], fallbacks: Record<string, string>): LutEntry {
    const lo = tokens[0][0];
    const hi = tokens[tokens.length - 1][0];
    const lut = new Uint8Array(256 * 3);

    const stops = tokens.map(([val, token]) => {
      const hex = this.theme.getTokenColor(token, fallbacks[token] || '#000000');
      return { val, rgb: this.hexToRgb(hex) };
    });

    for (let i = 0; i < 256; i++) {
      const v = lo + (i / 255) * (hi - lo);
      let k = 1;
      while (k < stops.length - 1 && v > stops[k].val) {
        k++;
      }
      const a = stops[k - 1];
      const b = stops[k];
      const t = this.clamp((v - a.val) / (b.val - a.val || 1), 0, 1);
      lut[i * 3] = Math.round(this.lerp(a.rgb[0], b.rgb[0], t));
      lut[i * 3 + 1] = Math.round(this.lerp(a.rgb[1], b.rgb[1], t));
      lut[i * 3 + 2] = Math.round(this.lerp(a.rgb[2], b.rgb[2], t));
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
