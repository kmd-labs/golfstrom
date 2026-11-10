import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  NgZone,
  inject,
  computed,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Wind, Flame, ChevronLeft, ChevronRight } from 'lucide-angular';
import { ThemeService } from '@kmd/design-system/services/theme.service';

import { BreakpointService } from '@kmd/design-system';
import { I18nService } from '../../core/i18n/i18n.service';
import { GolfstromStateService } from '../../core/services/golfstrom-state.service';
import { GolfstromMathService } from '../../core/services/golfstrom-math.service';
import { SstDataService } from '../../core/services/sst-data.service';
import { LATITUDE_PAIRS } from '../../core/constants/golfstrom-data';
import { LatitudePairPin } from '../../core/models/golfstrom.model';

interface WindParticle {
  xPct: number;
  yNorm: number;
  speed: number;
}

export interface CrossSectionHover {
  x: number;
  y: number;
  lon: number;
  isOcean: boolean;
  depthM: number;
  altKm: number;
  temp: number;
  feature?: string;
}

@Component({
  selector: 'app-cross-section-view',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule
  ],
  templateUrl: './cross-section-view.component.html',
  styleUrl: './cross-section-view.component.scss'
})
export class CrossSectionViewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasRef') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('boxRef') boxRef!: ElementRef<HTMLDivElement>;

  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);
  readonly state = inject(GolfstromStateService);
  readonly math = inject(GolfstromMathService);
  readonly sstData = inject(SstDataService);
  readonly bp = inject(BreakpointService);
  readonly Math = Math;
  private readonly ngZone = inject(NgZone);

  readonly pairs = LATITUDE_PAIRS;
  readonly windIcon = Wind;
  readonly flameIcon = Flame;
  readonly chevronLeftIcon = ChevronLeft;
  readonly chevronRightIcon = ChevronRight;

  prevPair() {
    this.state.prevPair();
  }

  nextPair() {
    this.state.nextPair();
  }

  // Active pair details
  readonly activePair = computed(() => this.state.selectedPair());

  // West city live temperature
  readonly westCityTemp = computed(() => {
    const pair = this.activePair();
    const m = this.state.month();
    const air = this.sstData.sampleRealAir(pair.lonA, pair.lat, m);
    return air !== null ? air : this.math.lerp(pair.janTempA, pair.julTempA, (Math.sin((m - 3) * Math.PI / 6) + 1) / 2);
  });

  // East city live temperature
  readonly eastCityTemp = computed(() => {
    const pair = this.activePair();
    const m = this.state.month();
    const air = this.sstData.sampleRealAir(pair.lonB, pair.lat, m);
    return air !== null ? air : this.math.lerp(pair.janTempB, pair.julTempB, (Math.sin((m - 3) * Math.PI / 6) + 1) / 2);
  });

  // Gulf Stream peak live temperature
  readonly gulfStreamTemp = computed(() => {
    const pair = this.activePair();
    const m = this.state.month();
    const sst = this.sstData.sampleRealSst(pair.gsLon, pair.lat, m);
    return sst !== null ? sst : this.math.lerp(pair.gsJanTemp, pair.gsJulTemp, (Math.sin((m - 3) * Math.PI / 6) + 1) / 2);
  });

  // Gulf stream thermal anomaly above observational latitude average
  readonly gulfStreamAnomaly = computed(() => {
    const pair = this.activePair();
    const gsT = this.gulfStreamTemp();
    const zonal = this.sstData.getZonalMeanAtLat(pair.lat, this.state.month());
    return Math.max(0, gsT - zonal);
  });

  readonly westCityTempFormatted = computed(() => this.i18n.formatTemp(this.westCityTemp(), 'temp', true));
  readonly eastCityTempFormatted = computed(() => this.i18n.formatTemp(this.eastCityTemp(), 'temp', true));
  readonly gulfStreamTempFormatted = computed(() => this.i18n.formatTemp(this.gulfStreamTemp(), 'temp', true));
  readonly gulfStreamAnomalyFormatted = computed(() => this.i18n.formatTemp(this.gulfStreamAnomaly(), 'delta', true));
  readonly tempDifferenceFormatted = computed(() => this.i18n.formatTemp(Math.abs(this.eastCityTemp() - this.westCityTemp()), 'delta', true));

  private ctx!: CanvasRenderingContext2D;
  private animId: number | null = null;
  private lastTime = 0;

  // Westerly wind particles
  private windParticles: WindParticle[] = [];

  // High resolution ocean image buffer (360x90)
  private oceanCanvas = document.createElement('canvas');
  private oceanImg: ImageData | null = null;
  private lastOceanKey = '';

  // Peak callout screen position
  readonly peakX = signal<number>(0);
  readonly peakY = signal<number>(0);

  // Interactive hover inspection crosshair
  readonly hoverInfo = signal<CrossSectionHover | null>(null);

  ngAfterViewInit() {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
    this.oceanCanvas.width = 360;
    this.oceanCanvas.height = 90;
    this.oceanImg = this.oceanCanvas.getContext('2d')!.createImageData(360, 90);

    this.initWindParticles();

    this.ngZone.runOutsideAngular(() => {
      this.handleResize();
      window.addEventListener('resize', this.onResize);
      this.animate(0);
    });
  }

  ngOnDestroy() {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
    }
    window.removeEventListener('resize', this.onResize);
  }

  private readonly onResize = () => {
    this.handleResize();
  };

  private initWindParticles() {
    const count = 45;
    this.windParticles = [];
    for (let i = 0; i < count; i++) {
      this.windParticles.push({
        xPct: Math.random(),
        yNorm: 0.15 + Math.random() * 0.7,
        speed: 0.12 + Math.random() * 0.18
      });
    }
  }


  getPairCityName(key: string): string {
    const t = this.i18n.t();
    return (t as any)[key] || key;
  }

  private handleResize() {
    if (!this.canvasRef || !this.boxRef) return;
    const canvas = this.canvasRef.nativeElement;
    const rect = this.boxRef.nativeElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  onPointerMove(e: PointerEvent) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const W = rect.width;
    const H = rect.height;
    const seaY = H * 0.52;
    const skyH = seaY;
    const oceanH = H - seaY;

    const mLeft = Math.max(50, W * 0.06);
    const mRight = Math.max(50, W * 0.06);
    const plotW = W - mLeft - mRight;

    if (x < mLeft || x > mLeft + plotW) {
      this.hoverInfo.set(null);
      return;
    }

    const pair = this.state.selectedPair();
    const month = this.state.month();
    const lonA = pair.lonA;
    const lonSpan = pair.lonB - pair.lonA;

    const u = (x - mLeft) / plotW;
    const lon = lonA + u * lonSpan;
    const bathy = this.sampleBathymetry(pair, lon);

    let isOcean = y >= seaY;
    let depthM = 0;
    let altKm = 0;
    let temp = 0;

    if (isOcean) {
      const dNorm = Math.min(1, Math.max(0, (y - seaY) / (oceanH - 25)));
      depthM = Math.round(dNorm * 4000);
      temp = this.sampleWaterTemp(pair, lon, depthM, month);
    } else {
      const aNorm = Math.min(1, Math.max(0, (seaY - y) / (skyH - 30)));
      altKm = Math.round(aNorm * 12 * 10) / 10;
      const sst = this.sstData.sampleRealSst(lon, pair.lat, month) ?? this.math.getSst(lon, pair.lat, month);
      // Environmental lapse rate ~6.5°C per km
      temp = Math.round((sst - altKm * 6.5) * 10) / 10;
    }

    let featureName: string | undefined = undefined;
    if (bathy.labelKey) {
      featureName = (this.i18n.t() as any)[bathy.labelKey] || bathy.labelKey;
    }

    this.hoverInfo.set({
      x,
      y,
      lon,
      isOcean,
      depthM,
      altKm,
      temp,
      feature: featureName
    });
  }

  onPointerLeave() {
    this.hoverInfo.set(null);
  }

  private animate = (now: number) => {
    this.animId = requestAnimationFrame(this.animate);

    if (typeof document !== 'undefined' && document.hidden) return;
    if (this.state.viewMode() !== 'cross-section') return;

    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    // Advance time smoothly when cross-section view is active
    this.state.advanceTime(dt);

    this.draw(dt);
  };

  /**
   * Smooth Hermite cubic interpolation through realistic transatlantic bathymetry anchors.
   */
  sampleBathymetry(pair: LatitudePairPin, lon: number): { depthM: number; elevM: number; labelKey?: string } {
    const anchors = pair.bathymetry;
    if (!anchors || anchors.length === 0) {
      return { depthM: 4000, elevM: 0 };
    }
    if (lon <= anchors[0].lon) {
      return { depthM: anchors[0].depthM, elevM: anchors[0].elevM, labelKey: anchors[0].labelKey };
    }
    const last = anchors[anchors.length - 1];
    if (lon >= last.lon) {
      return { depthM: last.depthM, elevM: last.elevM, labelKey: last.labelKey };
    }

    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      if (lon >= a.lon && lon <= b.lon) {
        const u = (lon - a.lon) / (b.lon - a.lon);
        const s = u * u * (3 - 2 * u);
        const depthM = a.depthM + (b.depthM - a.depthM) * s;
        const elevM = a.elevM + (b.elevM - a.elevM) * s;
        const labelKey = u < 0.25 ? a.labelKey : (u > 0.75 ? b.labelKey : undefined);
        return { depthM, elevM, labelKey };
      }
    }
    return { depthM: 4000, elevM: 0 };
  }

  /**
   * Scientifically grounded ocean thermal structure:
   * Models the asymmetric western boundary Gulf Stream "Cold Wall",
   * deep warm subtropical lens, and double-exponential thermocline decay.
   */
  sampleWaterTemp(pair: LatitudePairPin, lon: number, depthM: number, month: number): number {
    const sst = this.sstData.sampleRealSst(lon, pair.lat, month) ?? this.math.getSst(lon, pair.lat, month);
    const dGs = Math.abs(lon - pair.gsLon);
    const isGsCore = dGs < 3.0;
    const isGsFlank = dGs < 8.0;

    let thermoclineZ = 240;
    if (isGsCore) {
      thermoclineZ = 580;
    } else if (isGsFlank) {
      const wFactor = lon > pair.gsLon ? 0.9 : 0.45;
      thermoclineZ = 240 + (580 - 240) * Math.max(0, 1 - dGs / 8.0) * wFactor;
    }

    const decay = 0.68 * Math.exp(-depthM / thermoclineZ) + 0.32 * Math.exp(-depthM / 1250);
    const abyssalT = 2.0;
    return abyssalT + (sst - abyssalT) * decay;
  }

  private draw(dt: number) {
    const rect = this.boxRef?.nativeElement.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    const W = rect.width;
    const H = rect.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);

    const pair = this.state.selectedPair();
    const month = this.state.month();
    const mode = this.state.sstMode();
    const font = this.theme.getFontFamily();
    const t = this.i18n.t();

    // Layout geometry
    const seaY = H * 0.52;
    const skyH = seaY;
    const oceanH = H - seaY;

    const mLeft = Math.max(50, W * 0.06);
    const mRight = Math.max(50, W * 0.06);
    const plotW = W - mLeft - mRight;

    const lonA = pair.lonA;
    const lonB = pair.lonB;
    const lonSpan = lonB - lonA;

    const lonToX = (lon: number) => mLeft + ((lon - lonA) / lonSpan) * plotW;
    const depthToY = (d: number) => seaY + (d / 4000) * (oceanH - 25);
    const altToY = (km: number) => seaY - (km / 12) * (skyH - 30);

    // 1. Atmosphere Gradient Background
    const skyGrad = ctx.createLinearGradient(0, 0, 0, seaY);
    skyGrad.addColorStop(0, '#e0f2fe');
    skyGrad.addColorStop(0.7, '#f5f7fb');
    skyGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, seaY);

    // 2. Draw High-Resolution Ocean Temperature Cross-Section Texture
    this.renderOceanBuffer(pair, month, mode);
    ctx.drawImage(this.oceanCanvas, mLeft, seaY, plotW, oceanH - 25);

    // 3. Precise High-Resolution Bathymetry & Island Bedrock Profile (180 points)
    const nBathyPts = 180;
    const bathyPoints: { x: number; y: number; depthM: number; elevM: number }[] = [];

    for (let i = 0; i <= nBathyPts; i++) {
      const u = i / nBathyPts;
      const lon = lonA + u * lonSpan;
      const bx = mLeft + u * plotW;
      const bathy = this.sampleBathymetry(pair, lon);
      let by: number;
      if (bathy.elevM > 0) {
        by = altToY(Math.min(bathy.elevM / 1000, 3.8));
      } else {
        by = depthToY(bathy.depthM);
      }
      bathyPoints.push({ x: bx, y: by, depthM: bathy.depthM, elevM: bathy.elevM });
    }

    // Fill bedrock with geological lithosphere gradient
    ctx.beginPath();
    ctx.moveTo(mLeft, H);
    for (const pt of bathyPoints) {
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.lineTo(mLeft + plotW, H);
    ctx.closePath();

    const rockGrad = ctx.createLinearGradient(0, seaY, 0, H);
    rockGrad.addColorStop(0, '#334155');
    rockGrad.addColorStop(0.35, '#1e293b');
    rockGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = rockGrad;
    ctx.fill();

    // Top lithosphere stroke
    ctx.beginPath();
    for (let i = 0; i < bathyPoints.length; i++) {
      const pt = bathyPoints[i];
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Subtle geological strata lines inside bedrock
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let sy = seaY + 30; sy < H; sy += 35) {
      ctx.beginPath();
      ctx.moveTo(mLeft, sy);
      ctx.lineTo(mLeft + plotW, sy + 15);
      ctx.stroke();
    }
    ctx.restore();

    // 4. Scientifically Precise Isotherms (20°C, 15°C, 10°C, 5°C)
    const isotherms = [20, 15, 10, 5];
    ctx.font = `600 10px ${font}`;

    for (const isoT of isotherms) {
      ctx.beginPath();
      let started = false;
      let labelPlaced = false;

      for (let i = 0; i <= 60; i++) {
        const u = i / 60;
        const lon = lonA + u * lonSpan;
        const x = mLeft + u * plotW;
        const bathy = this.sampleBathymetry(pair, lon);

        let isoZ = -1;
        const surfaceT = this.sampleWaterTemp(pair, lon, 0, month);
        const bottomT = this.sampleWaterTemp(pair, lon, Math.min(4000, bathy.depthM), month);

        if (surfaceT >= isoT && bottomT <= isoT) {
          let loZ = 0;
          let hiZ = Math.min(4000, bathy.depthM);
          for (let iter = 0; iter < 12; iter++) {
            const midZ = (loZ + hiZ) * 0.5;
            if (this.sampleWaterTemp(pair, lon, midZ, month) >= isoT) {
              loZ = midZ;
            } else {
              hiZ = midZ;
            }
          }
          isoZ = (loZ + hiZ) * 0.5;
        }

        if (isoZ > 0 && isoZ < bathy.depthM) {
          const y = depthToY(isoZ);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }

          if (!labelPlaced && u > 0.45 && u < 0.65) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.fillText(`${isoT}°C`, x, y - 4);
            labelPlaced = true;
          }
        } else {
          started = false;
        }
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 5. Sea Surface Line
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mLeft, seaY);
    ctx.lineTo(mLeft + plotW, seaY);
    ctx.stroke();

    // 6. Gulf Stream Heat Plume & Rising Heat Flux Vectors
    const gsX = lonToX(pair.gsLon);
    const plumeW = plotW * 0.16;

    ctx.save();
    for (let off = -plumeW * 0.4; off <= plumeW * 0.4; off += plumeW * 0.25) {
      const vx = gsX + off;
      ctx.strokeStyle = '#d37400';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(vx, seaY - 2);
      ctx.quadraticCurveTo(vx + 12, seaY - 35, vx + 24, seaY - 65);
      ctx.stroke();

      ctx.fillStyle = '#d37400';
      ctx.beginPath();
      ctx.arc(vx + 24, seaY - 65, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 7. Prevailing Westerlies Streamlines in Atmosphere
    for (const p of this.windParticles) {
      p.xPct = (p.xPct + p.speed * dt * 0.25) % 1.0;
      const wx = mLeft + p.xPct * plotW;
      const wy = altToY(p.yNorm * 8 + 1.5);

      ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(wx - 16, wy);
      ctx.lineTo(wx, wy);
      ctx.stroke();

      ctx.fillStyle = 'rgba(59, 130, 246, 0.55)';
      ctx.beginPath();
      ctx.arc(wx, wy, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 8. Surface / 2m Air Temperature Curve across Atlantic
    ctx.beginPath();
    const tempCurvePts: [number, number][] = [];
    const nPts = 60;

    for (let i = 0; i <= nPts; i++) {
      const u = i / nPts;
      const lon = lonA + u * lonSpan;
      const px = mLeft + u * plotW;

      const sst = this.sstData.sampleRealSst(lon, pair.lat, month);
      const air = this.sstData.sampleRealAir(lon, pair.lat, month);
      const tVal = sst !== null ? sst : (air !== null ? air : 10);

      const dGs = Math.abs(lon - pair.gsLon);
      const gsBoost = Math.max(0, 1 - dGs / 12) * (pair.lat < 55 ? 5.5 : 3.8);
      const finalT = tVal + gsBoost;

      const py = altToY(3.5 + Math.max(-10, Math.min(30, finalT)) * 0.22);
      tempCurvePts.push([px, py]);

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.strokeStyle = '#d37400';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // 9. Grid & Depth Labels
    ctx.font = `500 11px ${font}`;
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';

    const depths = [0, 1000, 2000, 3000, 4000];
    for (const d of depths) {
      const dy = depthToY(d);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mLeft, dy);
      ctx.lineTo(mLeft + plotW, dy);
      ctx.stroke();
      ctx.fillText(`${d} m`, mLeft - 8, dy + 4);
    }

    // Longitude / City labels along bottom
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.abs(lonA).toFixed(0)}°W (${this.getPairCityName(pair.cityAKey)})`, mLeft, H - 8);
    ctx.fillText(
      `${Math.abs(lonB).toFixed(0)}°${lonB < 0 ? 'W' : 'E'} (${this.getPairCityName(pair.cityBKey)})`,
      mLeft + plotW,
      H - 8
    );

    // Bedrock feature badges & labels
    for (const isl of pair.islands) {
      const ix = lonToX(isl.lon);
      const bathy = this.sampleBathymetry(pair, isl.lon);
      const isAbove = bathy.elevM > 0;
      const by = isAbove ? altToY(Math.min(bathy.elevM / 1000, 3.8)) : depthToY(bathy.depthM);

      const islName = (t as any)[isl.nameKey] || isl.nameKey;
      ctx.fillStyle = isAbove ? '#0f172a' : '#cbd5e1';
      ctx.font = `600 11px ${font}`;
      ctx.textAlign = 'center';
      ctx.fillText(islName, ix, isAbove ? by - 8 : by + 16);

      ctx.fillStyle = '#d37400';
      ctx.beginPath();
      ctx.arc(ix, by, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Prevailing Westerlies label in sky
    ctx.fillStyle = '#2563eb';
    ctx.font = `600 12px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText(t.westerliesLabel, mLeft + plotW * 0.5, altToY(9.5));

    // Update Gulf Stream Peak Callout coordinates
    const peakPt = tempCurvePts[Math.round((pair.gsLon - lonA) / lonSpan * nPts)] || [gsX, altToY(7)];
    this.peakX.set(Math.round(peakPt[0]));
    this.peakY.set(Math.round(peakPt[1]));

    // 10. Interactive Cursor Crosshair & Readout
    const hover = this.hoverInfo();
    if (hover) {
      ctx.save();
      ctx.strokeStyle = 'rgba(211, 116, 0, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      // Vertical guideline
      ctx.beginPath();
      ctx.moveTo(hover.x, altToY(11));
      ctx.lineTo(hover.x, H - 20);
      ctx.stroke();

      // Horizontal guideline
      ctx.beginPath();
      ctx.moveTo(mLeft, hover.y);
      ctx.lineTo(mLeft + plotW, hover.y);
      ctx.stroke();

      // Point marker
      ctx.setLineDash([]);
      ctx.fillStyle = '#d37400';
      ctx.beginPath();
      ctx.arc(hover.x, hover.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Pre-renders the high-resolution ocean depth thermal cross-section into a 2D canvas buffer.
   */
  private renderOceanBuffer(pair: LatitudePairPin, month: number, mode: 'sst' | 'anomaly') {
    const key = `${pair.id}_${month.toFixed(2)}_${mode}`;
    if (key === this.lastOceanKey && this.oceanImg) return;
    this.lastOceanKey = key;

    const ow = this.oceanCanvas.width;
    const oh = this.oceanCanvas.height;
    if (!this.oceanImg) return;

    const d = this.oceanImg.data;
    const { lut, lo, hi } = mode === 'sst' ? this.math.lutSst : this.math.lutAnom;
    const sc = 255 / (hi - lo);

    const lonA = pair.lonA;
    const lonSpan = pair.lonB - pair.lonA;

    for (let px = 0; px < ow; px++) {
      const lon = lonA + (px / (ow - 1)) * lonSpan;
      const zm = mode === 'anomaly' ? this.sstData.getZonalMeanAtLat(pair.lat, month) : 0;

      for (let py = 0; py < oh; py++) {
        const dNorm = py / (oh - 1);
        const depthM = dNorm * 4000;

        const temp = this.sampleWaterTemp(pair, lon, depthM, month);
        const val = mode === 'anomaly' ? (temp - zm) * Math.exp(-depthM / 1500) : temp;

        let k = ((val - lo) * sc + 0.5) | 0;
        if (k < 0) k = 0; else if (k > 255) k = 255;
        k *= 3;

        const o = (py * ow + px) * 4;
        d[o] = lut[k];
        d[o + 1] = lut[k + 1];
        d[o + 2] = lut[k + 2];
        d[o + 3] = 255;
      }
    }

    this.oceanCanvas.getContext('2d')!.putImageData(this.oceanImg, 0, 0);
  }
}
