import {
  Component,
  ElementRef,
  ViewChild,
  ViewChildren,
  QueryList,
  AfterViewInit,
  OnDestroy,
  NgZone,
  inject,
  effect,
  untracked,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as d3Geo from 'd3-geo';
import * as topojson from 'topojson-client';
import { GolfstromStateService } from '../../core/services/golfstrom-state.service';
import { GolfstromMathService } from '../../core/services/golfstrom-math.service';
import { SstDataService } from '../../core/services/sst-data.service';
import { BreakpointService } from '@kmd/design-system';
import { ThemeService } from '@kmd/design-system/services/theme.service';
import { PopupService } from '@kmd/design-system/ui/popup/popup.service';
import { TooltipService } from '@kmd/design-system/ui/tooltip/tooltip.service';
import { isAtMost, isMobileLandscape } from '@kmd/design-system/utils/breakpoints';
import { I18nService } from '../../core/i18n/i18n.service';
import { LATITUDE_PAIRS } from '../../core/constants/golfstrom-data';
import { LatitudePairPin } from '../../core/models/golfstrom.model';

interface PinDisplay {
  data: LatitudePairPin;
  spriteA?: THREE.Sprite;
  spriteB?: THREE.Sprite;
  posA: THREE.Vector3;
  posB: THREE.Vector3;
  worldPos: THREE.Vector3;
  screenX: number;
  screenY: number;
  visible?: boolean;
  opacity?: number;
  lastVisible?: boolean;
}

@Component({
  selector: 'app-globe',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './globe.component.html',
  styleUrl: './globe.component.scss'
})
export class GlobeComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasRef') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChildren('pinLabel') pinLabelRefs!: QueryList<ElementRef<HTMLDivElement>>;

  readonly state = inject(GolfstromStateService);
  readonly math = inject(GolfstromMathService);
  readonly sstData = inject(SstDataService);
  readonly theme = inject(ThemeService);
  readonly popup = inject(PopupService);
  readonly tooltip = inject(TooltipService);
  readonly i18n = inject(I18nService);
  readonly bp = inject(BreakpointService);
  private readonly ngZone = inject(NgZone);

  readonly Math = Math;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;

  private globeMesh?: THREE.Mesh;
  private sstTex!: THREE.DataTexture;
  private texData!: Uint8Array;
  private readonly GW = 720;
  private readonly GH = 360;
  private readonly NG = 720 * 360;

  private landCanvas!: HTMLCanvasElement;
  private landTex!: THREE.CanvasTexture;
  private landMat?: THREE.MeshLambertMaterial;
  private loadedLandFeature: any = null;
  private landMask: Uint8Array | null = null;
  private relief: { data: Uint8Array; w: number; h: number; base: number } | null = null;
  private reliefCanvas: HTMLCanvasElement | null = null;

  // Latitude comparison pins - pre-populated on declaration to prevent ExpressionChangedAfterItHasBeenCheckedError
  pins: PinDisplay[] = LATITUDE_PAIRS.map(data => {
    const posA = this.math.pos(data.lonA, data.lat, this.math.R * 1.025, new THREE.Vector3());
    const posB = this.math.pos(data.lonB, data.lat, this.math.R * 1.025, new THREE.Vector3());
    const midLon = (data.lonA + data.lonB) / 2;
    const midPos = this.math.pos(midLon, data.lat, this.math.R * 1.03, new THREE.Vector3());
    return {
      data,
      posA,
      posB,
      worldPos: midPos,
      screenX: -9999,
      screenY: -9999,
      visible: false,
      opacity: 0
    };
  });
  private pinGroup = new THREE.Group();

  // Entrance camera animation: graceful sweep & slight zoom into the North Atlantic
  private introAnimStart = 0;
  private readonly introAnimDuration = 1800;
  private isIntroAnimating = false;
  private readonly introStartPos = new THREE.Vector3();
  private readonly introTargetPos = new THREE.Vector3();

  // Inspect Point Marker & Raycasting
  private inspectPin?: THREE.Sprite;
  private inspectedPoint: { lon: number; lat: number; p: THREE.Vector3 } | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly mouseVec = new THREE.Vector2();
  private downXY: [number, number] | null = null;
  private hoverPin: LatitudePairPin | null = null;
  readonly hoverPair = signal<LatitudePairPin | null>(null);

  private lastTooltipSx = -999;
  private lastTooltipSy = -999;
  private lastTooltipFacing = -999;
  private lastTooltipMonth = -999;

  private animId: number | null = null;
  private lastTime = 0;
  private lastRecolorMonth = -999;
  private lastRecolorMode = '';
  private lastCamPos = new THREE.Vector3();
  private canvasWidth = 1;
  private canvasHeight = 1;
  private pinElements: HTMLElement[] = [];
  private lastLayoutMode: 'portrait' | 'landscape' | 'desktop' | null = null;
  private pinTexDefault?: THREE.CanvasTexture;
  private pinTexActive?: THREE.CanvasTexture;

  private readonly pv = new THREE.Vector3();
  private readonly toCam = new THREE.Vector3();

  constructor() {
    effect(() => {
      // Dynamically highlight active city pair and update pin opacities
      this.state.selectedPair();
      this.updatePinVisuals();
    });

    effect(() => {
      // Re-render SST texture once when dataset finishes loading
      if (this.sstData.isLoaded()) {
        untracked(() => {
          this.recolorSstTexture(this.state.month(), this.state.sstMode());
        });
      }
    });

    effect(() => {
      this.sstData.exactAirLoaded();
      if (this.inspectedPoint) {
        this.updateInspectTooltip(true);
      }
    });

    effect(() => {
      if (this.state.viewMode() === 'globe') {
        requestAnimationFrame(() => this.handleResize());
      } else {
        this.clearInspectedPoint();
      }
    });
  }

  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => {
      this.initThree();
      this.initSstData();
      this.initLandOverlay();
      this.initPins();
      this.initInspectPin();
      window.addEventListener('resize', this.onResize);
      this.updatePinsDom();
      this.animate(0);

      this.sstData.loadData().then(() => {
        this.recolorSstTexture(this.state.month(), this.state.sstMode());
      });
    });
  }

  ngOnDestroy() {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
    }
    window.removeEventListener('resize', this.onResize);
    this.controls?.dispose();
    this.renderer?.dispose();
    this.sstTex?.dispose();
    this.landTex?.dispose();
  }

  private readonly onResize = () => {
    this.handleResize();
  };

  private initThree() {
    const canvas = this.canvasRef.nativeElement;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.canvasWidth = canvas.clientWidth;
    this.canvasHeight = canvas.clientHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(this.canvasWidth, this.canvasHeight, false);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.theme.getTokenColor('globe-bg', '#f5f7fb'));

    this.camera = new THREE.PerspectiveCamera(
      40,
      this.canvasWidth / (this.canvasHeight || 1),
      0.1,
      800
    );

    const isLand = isMobileLandscape();
    const portrait = !isLand && (this.canvasWidth / (this.canvasHeight || 1) < 0.95 || isAtMost('mobile'));
    const initialDist = portrait ? 38 : isLand ? 26 : 33;
    this.lastLayoutMode = isLand ? 'landscape' : portrait ? 'portrait' : 'desktop';

    // Target position: centered on North Atlantic (lon -40°, lat 38°)
    this.math.pos(-40, 38, initialDist, this.introTargetPos);
    // Start position: slightly more west (lon -65°, lat 30°) and slightly zoomed out (1.18x distance)
    this.math.pos(-65, 30, initialDist * 1.18, this.introStartPos);

    this.camera.position.copy(this.introStartPos);
    this.isIntroAnimating = true;
    this.introAnimStart = performance.now();

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 11.0;
    this.controls.maxDistance = 60.0;
    this.controls.enablePan = false;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdbe4f0, 1.3);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 8);
    this.scene.add(dirLight);

    this.initGlowAndBokeh();
  }

  /**
   * Ported from el-nino: limb-normalized BackSide atmospheric halo shader.
   * Completely eliminates the solid grey circle bug caused by dot(n, v) clamping.
   */
  private initGlowAndBokeh() {
    const R = this.math.R;
    const glowMat = new THREE.ShaderMaterial({
      uniforms: {
        c: { value: new THREE.Color(this.theme.getTokenColor('globe-glow', '#0f172a')) },
        uOpacity: { value: 0.22 },
        uPower: { value: 2.2 }
      },
      vertexShader: `
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 c;
        uniform float uOpacity;
        uniform float uPower;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float d = clamp(-dot(vN, vV), 0.0, 1.0);
          float t = clamp(d / 0.4938, 0.0, 1.0);
          float a = pow(t, uPower) * uOpacity;
          gl_FragColor = vec4(c, a);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.NormalBlending,
      transparent: true,
      depthWrite: false
    });

    const haloMesh = new THREE.Mesh(new THREE.SphereGeometry(R * 1.15, 64, 32), glowMat);
    this.scene.add(haloMesh);

    this.initBokeh();
  }

  /**
   * Soft bokeh background discs drifting in world space (matching el-nino).
   * Sit beyond controls.maxDistance (100) so they drift past smoothly and never clip the camera or globe.
   */
  private initBokeh() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;

    const count = 220;
    const pGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const v = new THREE.Vector3();
    const tints = ['primary-200', 'info-200', 'primary-100', 'warning-100'];
    const fallbacks = ['#bfdbfe', '#bae6fd', '#dbeafe', '#fed7aa'];
    const colors = tints.map((t, i) => new THREE.Color(this.theme.getTokenColor(t, fallbacks[i])));

    for (let i = 0; i < count; i++) {
      v.randomDirection().multiplyScalar(125 + Math.random() * 180);
      pos[i * 3] = v.x;
      pos[i * 3 + 1] = v.y;
      pos[i * 3 + 2] = v.z;
      const colEntry = colors[i % colors.length];
      col[i * 3] = colEntry.r;
      col[i * 3 + 1] = colEntry.g;
      col[i * 3 + 2] = colEntry.b;
    }

    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const pMat = new THREE.PointsMaterial({
      map: tex,
      size: 58,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.32,
      depthWrite: false
    });
    const points = new THREE.Points(pGeo, pMat);
    this.scene.add(points);
  }

  private initSstData() {
    this.texData = new Uint8Array(this.NG * 4);
    this.sstTex = new THREE.DataTexture(this.texData, this.GW, this.GH, THREE.RGBAFormat);
    this.sstTex.colorSpace = THREE.SRGBColorSpace;
    this.sstTex.magFilter = THREE.LinearFilter;
    this.sstTex.minFilter = THREE.LinearFilter;
    this.sstTex.wrapS = THREE.RepeatWrapping;

    this.recolorSstTexture(this.state.month(), this.state.sstMode());

    const globeMat = new THREE.MeshBasicMaterial({ map: this.sstTex });
    globeMat.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
          vec2 texel = vec2(1.0 / ${this.GW.toFixed(1)}, 1.0 / ${this.GH.toFixed(1)});
          vec4 sampledDiffuseColor = texture2D(map, vMapUv) * 0.4;
          sampledDiffuseColor += texture2D(map, vMapUv + vec2(texel.x, 0.0)) * 0.15;
          sampledDiffuseColor += texture2D(map, vMapUv - vec2(texel.x, 0.0)) * 0.15;
          sampledDiffuseColor += texture2D(map, vMapUv + vec2(0.0, texel.y)) * 0.15;
          sampledDiffuseColor += texture2D(map, vMapUv - vec2(0.0, texel.y)) * 0.15;
          diffuseColor *= sampledDiffuseColor;
        `
      );
    };

    this.globeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.math.R, 128, 64),
      globeMat
    );
    this.scene.add(this.globeMesh);
  }

  private clamp255(v: number): number {
    return v < 0 ? 0 : v > 255 ? 255 : v;
  }

  /**
   * Fast, optimized texture recolor using precomputed lookup tables.
   * Runs in ~3ms without freezing frame rate during animation.
   */
  private recolorSstTexture(month: number, mode: 'sst' | 'anomaly') {
    if (!this.texData) return;
    const bin = this.sstData.sstBin;

    // While real dataset is loading, don't re-evaluate analytical fallback on every frame
    if (!bin && this.lastRecolorMonth !== -999 && this.lastRecolorMode === mode) {
      return;
    }

    this.lastRecolorMonth = month;
    this.lastRecolorMode = mode;

    const { lut, lo, hi } = mode === 'sst' ? this.math.lutSst : this.math.lutAnom;
    const sc = 255 / (hi - lo);
    const pair = this.sstData.getKeyframePair(month);

    if (bin && pair) {
      const offsetA = pair.indexA * this.NG;
      const offsetB = pair.indexB * this.NG;
      const t = pair.t;

      const curAir = this.sstData.getInterpolatedAir(pair);
      const isAnomaly = mode === 'anomaly';
      const curZm = isAnomaly ? this.sstData.getInterpolatedZm(pair) : null;
      const tex = this.texData;

      // In Thermal Anomaly mode, land displays clean neutral styling (matching design system globe-no-data)
      const landR = 226;
      const landG = 232;
      const landB = 240;

      const rowR0 = this.sstData.rowR0;
      const rowR1 = this.sstData.rowR1;
      const rowTr = this.sstData.rowTr;

      const colC0 = this.sstData.colC0;
      const colC1 = this.sstData.colC1;
      const colTc = this.sstData.colTc;

      const GW = this.GW;
      const GH = this.GH;

      if (curAir) {
        for (let y = 0; y < GH; y++) {
          const rowOff = y * GW;
          const zm = curZm ? curZm[y] : 0;
          const r0Off = rowR0[y] * 36;
          const r1Off = rowR1[y] * 36;
          const tr = rowTr[y];

          for (let x = 0; x < GW; x++) {
            const i = rowOff + x;
            const va = bin[offsetA + i];
            const vb = bin[offsetB + i];
            const o = i * 4;

            if (va !== 255 && vb !== 255) {
              // Ocean SST
              const vByte = va + (vb - va) * t;
              const sst = vByte * 0.2 - 5.0;
              const val = isAnomaly ? sst - zm : sst;

              let k = ((val - lo) * sc + 0.5) | 0;
              if (k < 0) k = 0; else if (k > 255) k = 255;
              k *= 3;
              tex[o] = lut[k];
              tex[o + 1] = lut[k + 1];
              tex[o + 2] = lut[k + 2];
              tex[o + 3] = 255;
            } else if (isAnomaly) {
              // Land in Thermal Anomaly mode: clean neutral ground so relief overlays cleanly
              tex[o] = landR;
              tex[o + 1] = landG;
              tex[o + 2] = landB;
              tex[o + 3] = 255;
            } else {
              // Land Surface Temperature (ERA5 reanalysis) in Absolute SST mode
              const c0 = colC0[x];
              const c1 = colC1[x];
              const tc = colTc[x];

              const a0 = curAir[r0Off + c0];
              const a1 = curAir[r0Off + c1];
              const b0 = curAir[r1Off + c0];
              const b1 = curAir[r1Off + c1];

              const top = a0 + (a1 - a0) * tc;
              const bot = b0 + (b1 - b0) * tc;
              const airTemp = top + (bot - top) * tr;

              let k = ((airTemp - lo) * sc + 0.5) | 0;
              if (k < 0) k = 0; else if (k > 255) k = 255;
              k *= 3;
              tex[o] = lut[k];
              tex[o + 1] = lut[k + 1];
              tex[o + 2] = lut[k + 2];
              tex[o + 3] = 255;
            }
          }
        }
      } else {
        for (let y = 0; y < GH; y++) {
          const rowOff = y * GW;
          const zm = curZm ? curZm[y] : 0;
          for (let x = 0; x < GW; x++) {
            const i = rowOff + x;
            const va = bin[offsetA + i];
            const vb = bin[offsetB + i];
            const o = i * 4;
            if (va !== 255 && vb !== 255) {
              const vByte = va + (vb - va) * t;
              const sst = vByte * 0.2 - 5.0;
              const val = isAnomaly ? sst - zm : sst;
              let k = ((val - lo) * sc + 0.5) | 0;
              if (k < 0) k = 0; else if (k > 255) k = 255;
              k *= 3;
              tex[o] = lut[k];
              tex[o + 1] = lut[k + 1];
              tex[o + 2] = lut[k + 2];
            } else {
              tex[o] = landR;
              tex[o + 1] = landG;
              tex[o + 2] = landB;
            }
            tex[o + 3] = 255;
          }
        }
      }
    } else {
      // Analytical fallback
      const isAnomaly = mode === 'anomaly';
      for (let y = 0; y < this.GH; y++) {
        const lat = 90 - (y + 0.5) * (180 / this.GH);
        const rowOff = y * this.GW;
        for (let x = 0; x < this.GW; x++) {
          const lon = (x + 0.5) * (360 / this.GW) - 180;
          const o = (rowOff + x) * 4;
          const isLand = this.isLand(lon, lat);

          if (isLand && isAnomaly) {
            this.texData[o] = 226;
            this.texData[o + 1] = 232;
            this.texData[o + 2] = 240;
          } else {
            const val = mode === 'sst'
              ? this.math.getSst(lon, lat, month)
              : this.math.getAnomaly(lon, lat, month);

            let k = ((val - lo) * sc + 0.5) | 0;
            if (k < 0) k = 0; else if (k > 255) k = 255;
            k *= 3;
            this.texData[o] = lut[k];
            this.texData[o + 1] = lut[k + 1];
            this.texData[o + 2] = lut[k + 2];
          }
          this.texData[o + 3] = 255;
        }
      }
    }

    this.sstTex.needsUpdate = true;
  }

  private initLandOverlay() {
    this.landCanvas = document.createElement('canvas');
    this.landCanvas.width = 2048;
    this.landCanvas.height = 1024;

    this.landTex = new THREE.CanvasTexture(this.landCanvas);
    this.landTex.colorSpace = THREE.SRGBColorSpace;

    this.landMat = new THREE.MeshLambertMaterial({
      map: this.landTex,
      transparent: true,
      depthWrite: false
    });

    const landMesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.math.R * 1.003, 192, 96),
      this.landMat
    );
    this.scene.add(landMesh);

    this.drawLand(null);
    this.loadLandAndRelief();
  }

  private async loadLandAndRelief() {
    try {
      let resp = await fetch('assets/data/land-50m.json');
      if (!resp.ok) {
        resp = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json');
      }
      const topology = await resp.json();
      const landFeature = topojson.feature(topology, topology.objects.land as any);
      this.loadedLandFeature = landFeature;
      this.buildLandMask(landFeature);
      this.drawLand(landFeature);

      this.ngZone.run(() => {
        this.state.mapLoaded.set(true);
      });

      await this.loadRelief();
      this.loadElevation();
    } catch (err) {
      console.warn('Could not load land data:', err);
    }
  }

  private buildLandMask(land: any) {
    const mc = document.createElement('canvas');
    mc.width = 360;
    mc.height = 180;
    const mctx = mc.getContext('2d', { willReadFrequently: true });
    if (!mctx) return;
    const proj = d3Geo.geoEquirectangular().scale(360 / (2 * Math.PI)).translate([180, 90]);
    mctx.beginPath();
    d3Geo.geoPath(proj, mctx)(land);
    mctx.fillStyle = '#000';
    mctx.fill();
    const px = mctx.getImageData(0, 0, 360, 180).data;
    const mask = new Uint8Array(360 * 180);
    for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4 + 3] > 64 ? 1 : 0;
    this.landMask = mask;
  }

  isLand(lon: number, lat: number): boolean {
    if (this.landMask) {
      const c = Math.floor(((((lon + 180) % 360) + 360) % 360));
      const r = this.math.clamp(Math.floor(90 - lat), 0, 179);
      return this.landMask[r * 360 + c] === 1;
    }
    return false;
  }

  isLandPrecise(lon: number, lat: number): boolean {
    if (this.loadedLandFeature) {
      try {
        return d3Geo.geoContains(this.loadedLandFeature, [lon, lat]);
      } catch {
        // fallback
      }
    }
    return this.isLand(lon, lat);
  }

  private async loadRelief() {
    try {
      const resp = await fetch('assets/data/relief-2k.bin.gz');
      if (!resp.ok) return;
      let buf = await resp.arrayBuffer();

      const magic = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
      if (magic[0] === 0x1f && magic[1] === 0x8b) {
        if (typeof DecompressionStream !== 'undefined') {
          const stream = new Response(buf).body!.pipeThrough(new DecompressionStream('gzip'));
          buf = await new Response(stream).arrayBuffer();
        }
      }

      const head = new DataView(buf);
      if (buf.byteLength >= 10 && head.getUint32(0, false) === 0x4b4d4452) {
        const w = head.getUint16(4, true);
        const h = head.getUint16(6, true);
        const base = head.getUint8(8);
        if (buf.byteLength >= 10 + w * h) {
          this.relief = { data: new Uint8Array(buf, 10, w * h), w, h, base };
          if (this.loadedLandFeature) {
            this.drawLand(this.loadedLandFeature);
          }
        }
      }
    } catch (err) {
      console.warn('Could not load relief:', err);
    }
  }

  private loadElevation() {
    new THREE.TextureLoader().load('assets/data/elevation-1k.png', tex => {
      if (!this.landMat) return;
      tex.colorSpace = THREE.NoColorSpace;
      this.landMat.displacementMap = tex;
      this.landMat.displacementScale = this.math.R * (9000 / 6371000) * 8;
      this.landMat.needsUpdate = true;
    });
  }

  private drawLand(land: any) {
    const ctx = this.landCanvas.getContext('2d');
    if (!ctx) return;
    const Wc = this.landCanvas.width;
    const Hc = this.landCanvas.height;

    ctx.clearRect(0, 0, Wc, Hc);
    const proj = d3Geo
      .geoEquirectangular()
      .scale(Wc / (2 * Math.PI))
      .translate([Wc / 2, Hc / 2])
      .precision(0.2);
    const path = d3Geo.geoPath(proj, ctx);

    // Graticules
    ctx.beginPath();
    path(d3Geo.geoGraticule().step([30, 30])());
    ctx.strokeStyle = this.theme.getTokenColor('globe-graticule', 'rgba(15, 23, 42, 0.08)');
    ctx.lineWidth = 1;
    ctx.stroke();

    if (land) {
      // 1. Solid continent mask: guarantees that underlying ocean SST colors do not leak or bleed into land
      ctx.beginPath();
      path(land);
      ctx.fillStyle = this.theme.getTokenColor('globe-land-fill', '#e2e8f0');
      ctx.fill();

      // 2. Shaded mountain relief overlay on top of land
      const reliefCanvas = this.buildReliefLayer();
      if (reliefCanvas) {
        ctx.save();
        ctx.beginPath();
        path(land);
        ctx.clip();
        ctx.drawImage(reliefCanvas, 0, 0, Wc, Hc);
        ctx.restore();
      }

      // 3. Coastlines (crisp continent borders)
      ctx.beginPath();
      path(land);
      ctx.strokeStyle = this.theme.getTokenColor('globe-land-stroke', 'rgba(15, 23, 42, 0.35)');
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }

    this.landTex.needsUpdate = true;
  }

  private buildReliefLayer(): HTMLCanvasElement | null {
    if (!this.relief) return null;
    if (!this.reliefCanvas) {
      this.reliefCanvas = document.createElement('canvas');
      this.reliefCanvas.width = this.relief.w;
      this.reliefCanvas.height = this.relief.h;
    }
    const cx = this.reliefCanvas.getContext('2d');
    if (!cx) return null;

    const { data, w, h, base } = this.relief;
    const img = cx.createImageData(w, h);
    const d = img.data;

    for (let i = 0; i < w * h; i++) {
      const raw = data[i];
      const diff = (raw - base) / 46.0;
      const factor = Math.max(0, Math.min(2, 1 + diff * 0.5));
      const o = i * 4;

      if (factor > 1.02) {
        // Sunlit mountain ridge highlight (soft white)
        d[o] = 255;
        d[o + 1] = 255;
        d[o + 2] = 255;
        d[o + 3] = Math.min(140, Math.round((factor - 1.0) * 180));
      } else if (factor < 0.98) {
        // Shadowed mountain valley (soft dark shadow)
        d[o] = 15;
        d[o + 1] = 23;
        d[o + 2] = 42;
        d[o + 3] = Math.min(140, Math.round((1.0 - factor) * 190));
      } else {
        d[o] = 0;
        d[o + 1] = 0;
        d[o + 2] = 0;
        d[o + 3] = 0;
      }
    }

    cx.putImageData(img, 0, 0);
    return this.reliefCanvas;
  }

  private initPins() {
    this.scene.add(this.pinGroup);

    // Inactive pair texture (warm orange accent)
    const pinCanvasD = document.createElement('canvas');
    pinCanvasD.width = pinCanvasD.height = 128;
    const pcD = pinCanvasD.getContext('2d')!;
    pcD.translate(64, 64);
    pcD.strokeStyle = 'rgba(211, 116, 0, 0.4)';
    pcD.lineWidth = 10;
    pcD.beginPath();
    pcD.arc(0, 0, 52, 0, Math.PI * 2);
    pcD.stroke();
    pcD.fillStyle = '#d37400';
    pcD.beginPath();
    pcD.arc(0, 0, 36, 0, Math.PI * 2);
    pcD.fill();
    pcD.fillStyle = '#ffffff';
    pcD.beginPath();
    pcD.arc(0, 0, 16, 0, Math.PI * 2);
    pcD.fill();
    this.pinTexDefault = new THREE.CanvasTexture(pinCanvasD);

    // Active selected pair texture (bold royal blue)
    const pinCanvasA = document.createElement('canvas');
    pinCanvasA.width = pinCanvasA.height = 128;
    const pcA = pinCanvasA.getContext('2d')!;
    pcA.translate(64, 64);
    pcA.strokeStyle = 'rgba(37, 99, 235, 0.45)';
    pcA.lineWidth = 12;
    pcA.beginPath();
    pcA.arc(0, 0, 54, 0, Math.PI * 2);
    pcA.stroke();
    pcA.fillStyle = '#2563eb';
    pcA.beginPath();
    pcA.arc(0, 0, 38, 0, Math.PI * 2);
    pcA.fill();
    pcA.fillStyle = '#ffffff';
    pcA.beginPath();
    pcA.arc(0, 0, 18, 0, Math.PI * 2);
    pcA.fill();
    pcA.fillStyle = '#1d4ed8';
    pcA.beginPath();
    pcA.arc(0, 0, 8, 0, Math.PI * 2);
    pcA.fill();
    this.pinTexActive = new THREE.CanvasTexture(pinCanvasA);

    const activeId = this.state.selectedPair().id;
    const isMobile = this.bp.mobile();

    for (const p of this.pins) {
      const data = p.data;
      const isActive = data.id === activeId;
      const tex = isActive ? this.pinTexActive! : this.pinTexDefault!;
      const baseScale = isMobile ? 1.4 : 0.8;
      const scale = isActive ? baseScale * 1.3 : baseScale;

      const spA = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, opacity: 1.0 })
      );
      spA.scale.set(scale, scale, 1);
      spA.position.copy(p.posA);
      this.pinGroup.add(spA);
      p.spriteA = spA;

      const spB = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, opacity: 1.0 })
      );
      spB.scale.set(scale, scale, 1);
      spB.position.copy(p.posB);
      this.pinGroup.add(spB);
      p.spriteB = spB;
    }
    this.updatePinScales();
  }

  private initInspectPin() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.translate(64, 64);
    ctx.strokeStyle = 'rgba(211, 116, 0, 0.45)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#d37400';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d37400';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.inspectPin = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
        depthWrite: false
      })
    );
    this.inspectPin.renderOrder = 20;
    this.inspectPin.scale.setScalar(0.48);
    this.inspectPin.visible = false;
    this.scene.add(this.inspectPin);
  }

  setInspectedPoint(lon: number, lat: number) {
    const p = this.math.pos(lon, lat, this.math.R * 1.014, new THREE.Vector3());
    if (this.inspectPin) {
      this.inspectPin.position.copy(p);
      this.inspectPin.visible = true;
      if (this.camera) {
        const distInspect = this.camera.position.distanceTo(p);
        this.inspectPin.scale.setScalar((0.48 / 33.0) * distInspect);
      }
    }
    this.inspectedPoint = { lon, lat, p };
    this.sstData.fetchExactPointAirSeries(lon, lat);
    this.updateInspectTooltip(true);
  }

  clearInspectedPoint() {
    if (this.inspectPin) {
      this.inspectPin.visible = false;
    }
    this.inspectedPoint = null;
    this.ngZone.run(() => {
      this.tooltip.hide();
    });
  }

  private updateInspectTooltip(force = false) {
    const pt = this.inspectedPoint;
    if (!pt) return;
    const facing = this.facingOf(pt.p);
    if (facing < 0.08) {
      if (this.inspectPin) this.inspectPin.visible = false;
      if (this.tooltip.visible()) {
        this.ngZone.run(() => this.tooltip.hide());
      }
      return;
    }
    if (this.inspectPin) this.inspectPin.visible = true;

    const [sx, sy] = this.screenOf(pt.p);
    const month = this.state.month();

    const dx = Math.abs(sx - this.lastTooltipSx);
    const dy = Math.abs(sy - this.lastTooltipSy);
    const dm = Math.abs(month - this.lastTooltipMonth);

    if (!force && dx < 0.8 && dy < 0.8 && dm < 0.05 && this.tooltip.visible()) {
      return;
    }

    this.lastTooltipSx = sx;
    this.lastTooltipSy = sy;
    this.lastTooltipFacing = facing;
    this.lastTooltipMonth = month;

    const t = this.i18n.t();
    const isLand = this.isLandPrecise(pt.lon, pt.lat);

    const waterTemp = !isLand ? this.sstData.sampleRealSst(pt.lon, pt.lat, month) : null;
    const airTemp = this.sstData.sampleRealAir(pt.lon, pt.lat, month);

    const isMobile = this.bp.mobile();
    const coordsStr = isMobile ? '' : t.inspectCoords(pt.lat, pt.lon);
    const waterStr = waterTemp !== null ? this.i18n.formatTemp(waterTemp, 'temp', true) : t.inspectNoWater;
    const airStr = airTemp !== null ? this.i18n.formatTemp(airTemp, 'temp', true) : '–';

    const isAnomaly = this.state.sstMode() === 'anomaly';
    const anomVal = (!isLand && waterTemp !== null) ? waterTemp - this.sstData.getZonalMeanAtLat(pt.lat, month) : null;
    const anomStr = anomVal !== null ? this.i18n.formatTemp(anomVal, 'delta', true) : '';

    const anomRow = (!isLand && isAnomaly && anomVal !== null)
      ? `
        <div class="globe-tooltip-col__row">
          <div class="globe-tooltip-col__label-group">
            <span class="globe-tooltip-col__icon globe-tooltip-col__icon--water">★</span>
            <span class="globe-tooltip-col__label">${t.anomLegendTitle}</span>
          </div>
          <span class="globe-tooltip-col__val">${anomStr}</span>
        </div>
      `
      : '';

    const waterRow = !isLand
      ? `
        <div class="globe-tooltip-col__row">
          <div class="globe-tooltip-col__label-group">
            <span class="globe-tooltip-col__icon globe-tooltip-col__icon--water">●</span>
            <span class="globe-tooltip-col__label">${t.inspectWater}</span>
          </div>
          <span class="globe-tooltip-col__val">${waterStr}</span>
        </div>
      `
      : '';

    const html = `
      <div class="globe-tooltip-col">
        <div class="globe-tooltip-col__header">
          ${coordsStr ? `<span class="globe-tooltip-col__coords">${coordsStr}</span>` : ''}
          <span class="globe-tooltip-col__badge">${isLand ? t.inspectLand : t.inspectOcean}</span>
        </div>
        <div class="globe-tooltip-col__divider"></div>
        <div class="globe-tooltip-col__rows">
          ${anomRow}
          ${waterRow}
          <div class="globe-tooltip-col__row">
            <div class="globe-tooltip-col__label-group">
              <span class="globe-tooltip-col__icon globe-tooltip-col__icon--air">●</span>
              <span class="globe-tooltip-col__label">${t.inspectAir}</span>
            </div>
            <span class="globe-tooltip-col__val">${airStr}</span>
          </div>
        </div>
      </div>
    `.trim();

    const textFallback = isLand
      ? `${t.inspectAir}: ${airStr}${coordsStr ? ` · ${coordsStr}` : ''}`
      : `${t.inspectWater}: ${waterStr} · ${t.inspectAir}: ${airStr}${coordsStr ? ` · ${coordsStr}` : ''}`;

    this.ngZone.run(() => {
      this.tooltip.show(textFallback, sx, sy, 'top', 0, {
        html,
        noWrap: true,
        interactive: true,
        closable: true,
        onClose: () => this.clearInspectedPoint()
      });
    });
  }

  private facingOf(pos: THREE.Vector3): number {
    this.toCam.copy(this.camera.position).normalize();
    const len = Math.hypot(pos.x, pos.y, pos.z) || 1;
    return (pos.x * this.toCam.x + pos.y * this.toCam.y + pos.z * this.toCam.z) / len;
  }

  private screenOf(pos: THREE.Vector3): [number, number] {
    this.pv.copy(pos).project(this.camera);
    return [
      ((this.pv.x + 1) * 0.5) * this.canvasWidth,
      ((1 - this.pv.y) * 0.5) * this.canvasHeight
    ];
  }

  private pickPin(clientX: number, clientY: number, maxDistance: number): LatitudePairPin | null {
    let bestPin: LatitudePairPin | null = null;
    let minD = maxDistance;

    for (const p of this.pins) {
      if (this.facingOf(p.posA) > 0.12) {
        const [sx, sy] = this.screenOf(p.posA);
        const d = Math.hypot(sx - clientX, sy - clientY);
        if (d < minD) {
          minD = d;
          bestPin = p.data;
        }
      }

      if (this.facingOf(p.posB) > 0.12) {
        const [sx, sy] = this.screenOf(p.posB);
        const d = Math.hypot(sx - clientX, sy - clientY);
        if (d < minD) {
          minD = d;
          bestPin = p.data;
        }
      }

      if (this.facingOf(p.worldPos) > 0.12) {
        const [sx, sy] = this.screenOf(p.worldPos);
        const d = Math.hypot(sx - clientX, sy - clientY);
        if (d < minD) {
          minD = d;
          bestPin = p.data;
        }
      }
    }

    return bestPin;
  }

  /**
   * Directly updates DOM elements using hardware-accelerated translate3d.
   * Completely avoids running Angular Change Detection at 60fps.
   */
  private updatePinsDom() {
    if (!this.pinElements.length) {
      const labels = this.pinLabelRefs?.toArray();
      if (labels) this.pinElements = labels.map(l => l.nativeElement);
    }
    const elements = this.pinElements;
    const cw = this.canvasWidth;
    const ch = this.canvasHeight;
    const activeId = this.state.selectedPair().id;
    const hoverId = this.hoverPin?.id;

    const opActive = this.theme.getTokenOpacity('pin-active', 0.8);
    const opHover = this.theme.getTokenOpacity('pin-hover', 0.7);
    const opDefault = this.theme.getTokenOpacity('pin-default', 0.5);

    for (let i = 0; i < this.pins.length; i++) {
      const p = this.pins[i];
      const facing = this.facingOf(p.worldPos);
      const isVisible = facing > 0.1;
      const el = elements[i];
      if (!el) continue;

      if (!isVisible) {
        if (p.lastVisible !== false) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          p.lastVisible = false;
        }
      } else {
        const horizonFactor = this.math.clamp((facing - 0.1) / 0.35, 0, 1);
        this.pv.copy(p.worldPos).project(this.camera);
        const sx = Math.round(((this.pv.x + 1) * 0.5) * cw);
        const sy = Math.round(((1 - this.pv.y) * 0.5) * ch);
        el.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -120%)`;

        const isActive = p.data.id === activeId;
        const isHovered = p.data.id === hoverId;
        const baseOp = isActive ? opActive : (isHovered ? opHover : opDefault);
        const finalOp = baseOp * horizonFactor;
        el.style.opacity = finalOp.toFixed(2);

        if (p.lastVisible !== true) {
          el.style.pointerEvents = 'auto';
          p.lastVisible = true;
        }
      }
    }
  }

  private animate = (now: number) => {
    this.animId = requestAnimationFrame(this.animate);

    if (typeof document !== 'undefined' && document.hidden) return;
    if (this.state.viewMode() !== 'globe') return;

    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    // Advance seasonal timeline smoothly
    this.state.advanceTime(dt);

    const curMonth = this.state.month();
    const curMode = this.state.sstMode();
    const dMonth = Math.abs(curMonth - this.lastRecolorMonth);

    // Dynamic texture recolor: updates every ~0.033 month step (~15fps), keeping 95% CPU budget free for smooth 60fps orbit
    if (
      dMonth >= 0.033 ||
      (12 - dMonth) <= 0.033 ||
      curMode !== this.lastRecolorMode
    ) {
      this.recolorSstTexture(curMonth, curMode);
    }

    if (this.isIntroAnimating) {
      const elapsed = now - this.introAnimStart;
      const progress = Math.min(1, Math.max(0, elapsed / this.introAnimDuration));
      const ease = 1 - Math.pow(1 - progress, 3);
      this.camera.position.lerpVectors(this.introStartPos, this.introTargetPos, ease);
      this.controls.update();
      this.updatePinsDom();
      this.updatePinScales();
      if (progress >= 1) {
        this.isIntroAnimating = false;
        this.lastCamPos.copy(this.camera.position);
      }
    } else {
      this.controls.update();

      // Fast check: only recalculate pin screen positions and scales when camera actually moves
      const camMoved = this.camera.position.distanceToSquared(this.lastCamPos) > 1e-5;
      if (camMoved) {
        this.updatePinsDom();
        this.updatePinScales();
        this.lastCamPos.copy(this.camera.position);
      }
    }

    if (this.inspectedPoint) {
      this.updateInspectTooltip();
    }

    this.renderer.render(this.scene, this.camera);
  };

  onPointerDown(e: PointerEvent) {
    this.isIntroAnimating = false;
    this.downXY = [e.clientX, e.clientY];
  }

  onPointerUp(e: PointerEvent) {
    if (!this.downXY) return;
    const moved = Math.hypot(e.clientX - this.downXY[0], e.clientY - this.downXY[1]);
    this.downXY = null;
    if (moved > 6) return;

    const hitRadius = this.bp.mobile() ? 44 : 32;
    const hit = this.pickPin(e.clientX, e.clientY, hitRadius);
    if (hit) {
      this.clearInspectedPoint();
      this.ngZone.run(() => this.onPinClick(hit));
      return;
    }

    // Inspect point on land or ocean
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.mouseVec.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.mouseVec, this.camera);

    const hits = this.globeMesh ? this.raycaster.intersectObject(this.globeMesh) : [];
    if (hits.length > 0) {
      const hitPos = hits[0].point;
      const phi = Math.acos(this.math.clamp(hitPos.y / this.math.R, -1, 1));
      const lat = 90 - phi * (180 / Math.PI);
      const theta = Math.atan2(hitPos.z, -hitPos.x);
      let lon = theta * (180 / Math.PI) - 180;
      lon = ((lon + 180) % 360 + 360) % 360 - 180;

      this.ngZone.run(() => {
        this.setInspectedPoint(lon, lat);
      });
    } else {
      this.ngZone.run(() => {
        this.clearInspectedPoint();
      });
    }
  }

  /**
   * Dynamically rescales pin sprites proportional to camera distance.
   * Keeps pins at a constant, zoom-independent screen pixel size across all zoom levels.
   */
  private updatePinScales() {
    if (!this.camera) return;
    const camPos = this.camera.position;
    const activeId = this.state.selectedPair().id;
    const hoverId = this.hoverPin?.id;
    const isMobile = this.bp.mobile();
    const refDist = 33.0;

    for (const p of this.pins) {
      const isActive = p.data.id === activeId;
      const isHovered = p.data.id === hoverId;
      const baseScale = isMobile ? 1.4 : 0.8;
      const multiplier = isActive ? 1.3 : isHovered ? 1.15 : 1.0;
      const targetScale = baseScale * multiplier;

      if (p.spriteA) {
        const distA = camPos.distanceTo(p.posA);
        const sA = (targetScale / refDist) * distA;
        p.spriteA.scale.set(sA, sA, 1);
      }

      if (p.spriteB) {
        const distB = camPos.distanceTo(p.posB);
        const sB = (targetScale / refDist) * distB;
        p.spriteB.scale.set(sB, sB, 1);
      }
    }

    if (this.inspectPin && this.inspectPin.visible && this.inspectedPoint) {
      const distInspect = camPos.distanceTo(this.inspectedPoint.p);
      const sInspect = (0.48 / refDist) * distInspect;
      this.inspectPin.scale.setScalar(sInspect);
    }
  }

  private updatePinVisuals() {
    if (!this.pinTexActive || !this.pinTexDefault) return;
    const activeId = this.state.selectedPair().id;

    for (const p of this.pins) {
      const isActive = p.data.id === activeId;
      const tex = isActive ? this.pinTexActive : this.pinTexDefault;

      if (p.spriteA) {
        if (p.spriteA.material.map !== tex) {
          p.spriteA.material.map = tex;
          p.spriteA.material.needsUpdate = true;
        }
        p.spriteA.material.opacity = 1.0;
      }

      if (p.spriteB) {
        if (p.spriteB.material.map !== tex) {
          p.spriteB.material.map = tex;
          p.spriteB.material.needsUpdate = true;
        }
        p.spriteB.material.opacity = 1.0;
      }
    }

    this.updatePinScales();
  }

  onPointerMove(e: PointerEvent) {
    if (e.buttons) return;
    const hoverRadius = this.bp.mobile() ? 36 : 24;
    const hit = this.pickPin(e.clientX, e.clientY, hoverRadius);
    if (hit !== this.hoverPin) {
      this.hoverPin = hit;
      this.hoverPair.set(hit);
      this.canvasRef.nativeElement.style.cursor = (hit || this.inspectedPoint) ? 'pointer' : '';
      this.updatePinVisuals();
      this.updatePinsDom();
    }
  }

  onPinHover(pair: LatitudePairPin) {
    if (this.hoverPin !== pair) {
      this.hoverPin = pair;
      this.hoverPair.set(pair);
      this.updatePinVisuals();
      this.updatePinsDom();
    }
  }

  onPinHoverLeave() {
    if (this.hoverPin !== null) {
      this.hoverPin = null;
      this.hoverPair.set(null);
      this.updatePinVisuals();
      this.updatePinsDom();
    }
  }

  onPinClick(pair: LatitudePairPin) {
    this.state.selectPair(pair);
  }

  getPairTitle(pair: LatitudePairPin): string {
    const t = this.i18n.t() as any;
    const cityA = t[pair.cityAKey] || pair.cityAKey;
    const cityB = t[pair.cityBKey] || pair.cityBKey;
    return `${cityA} – ${cityB}`;
  }

  handleResize() {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.canvasWidth = w;
    this.canvasHeight = h;
    this.pinElements = [];

    const isLand = isMobileLandscape();
    const portrait = !isLand && (w / (h || 1) < 0.95 || isAtMost('mobile'));
    const layoutMode: 'portrait' | 'landscape' | 'desktop' = isLand ? 'landscape' : portrait ? 'portrait' : 'desktop';

    if (this.camera && this.renderer) {
      if (this.lastLayoutMode && this.lastLayoutMode !== layoutMode) {
        const targetDist = portrait ? 38 : isLand ? 26 : 33;
        this.camera.position.setLength(targetDist);
      }
      this.lastLayoutMode = layoutMode;

      this.camera.aspect = w / (h || 1);
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
      this.updatePinsDom();
      this.updatePinScales();
    }
  }
}
