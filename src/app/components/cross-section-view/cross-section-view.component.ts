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
import { LucideAngularModule, ChevronLeft, ChevronRight, Wind, Flame } from 'lucide-angular';
import { ThemeService } from '@kmd/design-system/services/theme.service';
import { ButtonComponent } from '@kmd/design-system/ui/button/button.component';
import { BadgeComponent } from '@kmd/design-system/ui/badge/badge.component';
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

@Component({
  selector: 'app-cross-section-view',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, ButtonComponent, BadgeComponent],
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
  readonly Math = Math;
  private readonly ngZone = inject(NgZone);

  readonly pairs = LATITUDE_PAIRS;
  readonly windIcon = Wind;
  readonly flameIcon = Flame;

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

  // Gulf stream thermal anomaly above latitude average
  readonly gulfStreamAnomaly = computed(() => {
    const pair = this.activePair();
    const m = this.state.month();
    const gsT = this.gulfStreamTemp();
    const zonal = 28.5 * Math.cos(Math.abs(pair.lat) * (Math.PI / 150)) - 2.0;
    return Math.max(0, gsT - zonal);
  });

  private ctx!: CanvasRenderingContext2D;
  private animId: number | null = null;
  private lastTime = 0;

  // Westerly wind particles
  private windParticles: WindParticle[] = [];

  // Ocean image buffer
  private oceanCanvas = document.createElement('canvas');
  private oceanImg: ImageData | null = null;
  private lastOceanKey = '';

  // Peak callout screen position
  peakX = signal<number>(0);
  peakY = signal<number>(0);

  ngAfterViewInit() {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
    this.oceanCanvas.width = 160;
    this.oceanCanvas.height = 40;
    this.oceanImg = this.oceanCanvas.getContext('2d')!.createImageData(160, 40);

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

  selectPair(pair: LatitudePairPin) {
    this.state.selectPair(pair);
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

  private animate = (now: number) => {
    this.animId = requestAnimationFrame(this.animate);

    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    // Advance time smoothly if active
    this.state.advanceTime(dt);

    this.draw(dt);
  };

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

    // Layout geometry:
    // Top 52% Atmosphere (0 to 12 km altitude)
    // Sea surface at seaY
    // Bottom 48% Ocean depth (0 to 4000 m depth)
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

    // 2. Draw Ocean Temperature Cross-Section Texture
    this.renderOceanBuffer(pair, month, mode);
    ctx.drawImage(this.oceanCanvas, mLeft, seaY, plotW, oceanH - 25);

    // 3. Bathymetry Bedrock Profile (Continental shelves & Mid-Atlantic Ridge)
    ctx.beginPath();
    ctx.moveTo(mLeft, H);
    // West Shelf
    ctx.lineTo(mLeft, depthToY(120));
    ctx.lineTo(lonToX(lonA + 2.5), depthToY(250));
    ctx.lineTo(lonToX(lonA + 5.5), depthToY(3800));

    // Abyssal plain West
    const ridgeLon = pair.islands.length > 0 ? pair.islands[0].lon : (lonA + lonB) / 2;
    ctx.lineTo(lonToX(ridgeLon - 8), depthToY(4200));

    // Mid-Atlantic Ridge & Island Peaks
    for (const isl of pair.islands) {
      const ix = lonToX(isl.lon);
      ctx.lineTo(ix - 24, depthToY(isl.depthM > 0 ? isl.depthM + 600 : 1200));
      // Peak: if island rises above sea level, draw it above seaY
      const peakY = isl.elevM > 0 ? altToY(Math.min(isl.elevM / 1000, 3.5)) : depthToY(isl.depthM);
      ctx.lineTo(ix, peakY);
      ctx.lineTo(ix + 24, depthToY(isl.depthM > 0 ? isl.depthM + 600 : 1200));
    }

    // Abyssal plain East
    ctx.lineTo(lonToX(lonB - 5.5), depthToY(4000));
    ctx.lineTo(lonToX(lonB - 2.5), depthToY(200));
    ctx.lineTo(lonToX(lonB), depthToY(80));
    ctx.lineTo(mLeft + plotW, H);
    ctx.closePath();

    ctx.fillStyle = '#94a3b8';
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 4. Sea Surface Line
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mLeft, seaY);
    ctx.lineTo(mLeft + plotW, seaY);
    ctx.stroke();

    // 5. Gulf Stream Heat Plume & Rising Heat Flux Vectors
    const gsX = lonToX(pair.gsLon);
    const plumeW = plotW * 0.16;

    // Heat release vectors
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

    // 6. Prevailing Westerlies Streamlines in Atmosphere
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

    // 7. Surface / 2m Air Temperature Curve across Atlantic
    ctx.beginPath();
    const tempCurvePts: [number, number][] = [];
    const nPts = 50;
    let minT = 999;
    let maxT = -999;

    for (let i = 0; i <= nPts; i++) {
      const u = i / nPts;
      const lon = lonA + u * lonSpan;
      const px = mLeft + u * plotW;

      // Sample temperature: combines seasonal baseline with prominent Gulf Stream warm tongue
      const sst = this.sstData.sampleRealSst(lon, pair.lat, month);
      const air = this.sstData.sampleRealAir(lon, pair.lat, month);
      const tVal = sst !== null ? sst : (air !== null ? air : 10);

      // Distance to Gulf Stream core
      const dGs = Math.abs(lon - pair.gsLon);
      const gsBoost = Math.max(0, 1 - dGs / 12) * (pair.lat < 55 ? 6 : 4);
      const finalT = tVal + gsBoost;

      minT = Math.min(minT, finalT);
      maxT = Math.max(maxT, finalT);

      // Map temperature to Y inside upper 30% of atmosphere
      const py = altToY(3.5 + Math.max(-10, Math.min(30, finalT)) * 0.22);
      tempCurvePts.push([px, py]);

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.strokeStyle = '#d37400';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // 8. Grid & Depth Labels
    ctx.font = `500 11px ${font}`;
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';

    const depths = [0, 1000, 2000, 3000, 4000];
    for (const d of depths) {
      const dy = depthToY(d);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
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

    // Islands labels
    for (const isl of pair.islands) {
      const ix = lonToX(isl.lon);
      ctx.fillStyle = '#334155';
      ctx.font = `600 11px ${font}`;
      const islName = (t as any)[isl.nameKey] || isl.nameKey;
      ctx.fillText(islName, ix, seaY + 22);
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
  }

  /**
   * Pre-renders the ocean depth thermal cross-section into a small 2D canvas buffer.
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
      const sst = this.sstData.sampleRealSst(lon, pair.lat, month) ?? this.math.getSst(lon, pair.lat, month);
      const zm = mode === 'anomaly' ? 28.5 * Math.cos(Math.abs(pair.lat) * (Math.PI / 150)) - 2.0 : 0;

      // Gulf stream core deep warm structure
      const dGs = Math.abs(lon - pair.gsLon);
      const isGs = dGs < 6.0;

      for (let py = 0; py < oh; py++) {
        const dNorm = py / (oh - 1); // 0 (surface) to 1 (4000m)
        const depthM = dNorm * 4000;

        // Exponential thermal decay with depth (thermocline)
        const decayZ = isGs ? 550 : 280;
        const decay = Math.exp(-depthM / decayZ);
        const abyssalT = 2.2;
        const localT = abyssalT + (sst - abyssalT) * decay;
        const val = mode === 'anomaly' ? (localT - zm) * decay : localT;

        const k = this.math.clamp(Math.round((val - lo) * sc), 0, 255) * 3;
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
