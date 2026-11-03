import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  Globe,
  Activity,
  BookOpen,
  Play,
  Pause,
  Thermometer,
  Gauge,
  Database,
  FileText,
  Layers,
  Settings
} from 'lucide-angular';
import {
  ButtonComponent,
  BrandComponent,
  DropdownComponent,
  DropdownOption,
  PopupComponent,
  PopupService,
  TimelineSliderComponent,
  TooltipComponent,
  TooltipDirective,
  BreakpointService,
  SplashComponent,
  SplashService,
  AboutService
} from '@kmd/design-system';
import { I18nService } from './core/i18n/i18n.service';
import { Lang } from './core/i18n/i18n.types';
import { GolfstromStateService } from './core/services/golfstrom-state.service';
import { GlobeComponent } from './components/globe/globe.component';
import { CrossSectionViewComponent } from './components/cross-section-view/cross-section-view.component';
import { GlossaryComponent } from './components/glossary/glossary.component';
import { SourcesPopupComponent } from './components/sources-popup/sources-popup.component';
import { PairModalComponent } from './components/pair-modal/pair-modal.component';
import { SettingsPopupComponent } from './components/settings-popup/settings-popup.component';
import { ViewMode } from './core/models/golfstrom.model';
import { LATITUDE_PAIRS, PLAYBACK_SPEEDS } from './core/constants/golfstrom-data';
import { SstDataService } from './core/services/sst-data.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    BrandComponent,
    ButtonComponent,
    DropdownComponent,
    PopupComponent,
    TimelineSliderComponent,
    TooltipComponent,
    TooltipDirective,
    SplashComponent,
    GlobeComponent,
    CrossSectionViewComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  readonly i18n = inject(I18nService);
  readonly bp = inject(BreakpointService);
  readonly popup = inject(PopupService);
  readonly about = inject(AboutService);
  readonly splash = inject(SplashService);
  readonly state = inject(GolfstromStateService);
  readonly sstData = inject(SstDataService);

  readonly globeIcon = Globe;
  readonly activityIcon = Activity;
  readonly bookOpenIcon = BookOpen;
  readonly playIcon = Play;
  readonly pauseIcon = Pause;
  readonly thermoIcon = Thermometer;
  readonly speedIcon = Gauge;
  readonly databaseIcon = Database;
  readonly summaryIcon = FileText;
  readonly layersIcon = Layers;
  readonly settingsIcon = Settings;
  readonly thermometerIcon = Thermometer;

  readonly latitudePairs = LATITUDE_PAIRS;

  readonly isPopupOpen = computed(() => this.popup.config() !== null);

  /** Continuous Date object computed from keyframe timeline or calendar year */
  readonly currentDate = computed<Date>(() => {
    const m = this.state.month();
    const meta = this.sstData.meta();
    const kfs = meta?.keyframes;
    if (kfs && kfs.length > 0) {
      const pair = this.sstData.getKeyframePair(m);
      if (pair && kfs[pair.indexA] && kfs[pair.indexB]) {
        const dateA = new Date(kfs[pair.indexA].date).getTime();
        const dateB = new Date(kfs[pair.indexB].date).getTime();
        const curMs = dateA + (dateB - dateA) * pair.t;
        return new Date(curMs);
      }
    }
    const startMs = Date.UTC(2025, 0, 1);
    const yearMs = 365 * 24 * 60 * 60 * 1000;
    return new Date(startMs + (m / 12) * yearMs);
  });

  readonly currentMonthName = computed(() => {
    const d = this.currentDate();
    const t = this.i18n.t();
    return t.monthNames[d.getUTCMonth()] || '';
  });

  /**
   * Formats current date with year and locale support (e.g. "15 Jan 2025" or "15 Sty 2025").
   * Day padded to 2 digits, month 3 letters, year 4 digits => constant 11 chars to prevent jumping.
   */
  readonly currentDateLabel = computed(() => {
    const d = this.currentDate();
    const day = String(d.getUTCDate()).padStart(2, '0');
    const t = this.i18n.t();
    const month = t.shortMonthNames[d.getUTCMonth()] || '';
    const year = d.getUTCFullYear();
    return `${day} ${month} ${year}`;
  });

  readonly activePair = computed(() => this.state.selectedPair());
  readonly activePairDelta = computed(() => {
    const p = this.state.selectedPair();
    return Math.abs(p.janTempB - p.janTempA);
  });

  readonly activeCity1Name = computed(() => {
    const p = this.state.selectedPair();
    const t = this.i18n.t() as any;
    if (this.bp.mobile() && p.countryAKey) {
      return t[p.countryAKey] || t[p.cityAKey] || p.cityAKey;
    }
    return t[p.cityAKey] || p.cityAKey;
  });

  readonly activeCity2Name = computed(() => {
    const p = this.state.selectedPair();
    const t = this.i18n.t() as any;
    if (this.bp.mobile() && p.countryBKey) {
      return t[p.countryBKey] || t[p.cityBKey] || p.cityBKey;
    }
    return t[p.cityBKey] || p.cityBKey;
  });

  /** Monospace tabular real air temperature for City 1 (North America) */
  readonly activeCity1TempFormatted = computed(() => {
    const p = this.state.selectedPair();
    const m = this.state.month();
    const val = this.sstData.sampleRealAir(p.lonA, p.lat, m);
    return this.i18n.formatTemp(val, 'temp', true);
  });

  /** Monospace tabular real air temperature for City 2 (Europe) */
  readonly activeCity2TempFormatted = computed(() => {
    const p = this.state.selectedPair();
    const m = this.state.month();
    const val = this.sstData.sampleRealAir(p.lonB, p.lat, m);
    return this.i18n.formatTemp(val, 'temp', true);
  });

  readonly activePairName = computed(() => {
    const p = this.state.selectedPair();
    const t = this.i18n.t() as any;
    const a = t[p.cityAKey] || p.cityAKey;
    const b = t[p.cityBKey] || p.cityBKey;
    return `${a} ↔ ${b}`;
  });

  readonly activePairContrast = computed(() => {
    const p = this.state.selectedPair();
    const diff = Math.abs(p.janTempB - p.janTempA);
    const t = this.i18n.t();
    return `${this.i18n.formatTemp(diff, 'delta', true)} (${t.seasonWinter})`;
  });

  // Official Design System Anomaly Scale Ticks (-3.0 °C to +3.0 °C)
  readonly anomTickM3 = computed(() => this.i18n.formatTemp(-3.0, 'delta', true));
  readonly anomTickM15 = computed(() => this.i18n.formatTemp(-1.5, 'delta', true));
  readonly anomTick0 = computed(() => this.i18n.formatTemp(0.0, 'delta', false));
  readonly anomTickP15 = computed(() => this.i18n.formatTemp(1.5, 'delta', true));
  readonly anomTickP3 = computed(() => this.i18n.formatTemp(3.0, 'delta', true));

  // Official Design System Thermal SST Scale Ticks (-2.0 °C to +35.0 °C)
  readonly sstTickMin = computed(() => this.i18n.formatTemp(-2.0, 'temp', false));
  readonly sstTickMid = computed(() => this.i18n.formatTemp(16.5, 'temp', false));
  readonly sstTickMax = computed(() => this.i18n.formatTemp(35.0, 'temp', false));

  /**
   * Dynamically calculates the timeline slider rail gradient based on real weather data.
   * Samples thermal data across the 1-year timeline (keyframes) so that the warmest
   * color peak dynamically tracks the real temperature maximum even as daily data rolls forward.
   */
  readonly dynamicTimelineGradient = computed<string>(() => {
    const isLoaded = this.sstData.isLoaded();
    const pair = this.state.selectedPair();

    const N = 24;
    const temps: { pct: number; temp: number }[] = [];

    for (let i = 0; i <= N; i++) {
      const pct = Math.round((i / N) * 100);
      const m = (i / N) * 12;
      let temp: number;

      if (isLoaded) {
        // Sample real Gulf Stream peak and regional air temperature
        const sst = this.sstData.sampleRealSst(pair.gsLon, pair.lat, m);
        const air = this.sstData.sampleRealAir(pair.lonB, pair.lat, m);
        temp = sst !== null ? sst : (air !== null ? air : 15);
      } else {
        // Analytical fallback before binary data loads
        const gsT = Math.sin((m - 3) * (Math.PI / 6));
        temp = 12 + 10 * gsT;
      }

      temps.push({ pct, temp });
    }

    const minT = Math.min(...temps.map(t => t.temp));
    const maxT = Math.max(...temps.map(t => t.temp));
    const span = Math.max(0.1, maxT - minT);

    const stops = temps.map(t => {
      const norm = (t.temp - minT) / span;
      const color = this.interpolateThermalColor(norm);
      return `${color} ${t.pct}%`;
    });

    return `linear-gradient(90deg, ${stops.join(', ')})`;
  });

  private interpolateThermalColor(norm: number): string {
    const clamped = Math.max(0, Math.min(1, norm));
    const STOPS: [number, [number, number, number]][] = [
      [0.0, [130, 156, 158]],  // sst-m2 (#829c9e, coldest blue/teal)
      [0.15, [123, 142, 173]], // sst-5 (#7b8ead)
      [0.30, [131, 157, 189]], // sst-10 (#839dbd)
      [0.45, [147, 177, 206]], // sst-15 (#93b1ce)
      [0.60, [193, 209, 222]], // sst-20 (#c1d1de)
      [0.72, [237, 214, 133]], // sst-25-5 (#edd685)
      [0.85, [211, 116, 0]],   // sst-29-2 (#d37400, accent orange)
      [0.93, [204, 62, 28]],   // sst-31 (#cc3e1c)
      [1.0, [164, 13, 25]]     // sst-35 (#a40d19, warmest crimson peak)
    ];

    let i = 0;
    while (i < STOPS.length - 1 && clamped > STOPS[i + 1][0]) {
      i++;
    }
    const s0 = STOPS[i];
    const s1 = STOPS[Math.min(i + 1, STOPS.length - 1)];
    const range = s1[0] - s0[0];
    const t = range > 0 ? (clamped - s0[0]) / range : 0;

    const r = Math.round(s0[1][0] + (s1[1][0] - s0[1][0]) * t);
    const g = Math.round(s0[1][1] + (s1[1][1] - s0[1][1]) * t);
    const b = Math.round(s0[1][2] + (s1[1][2] - s0[1][2]) * t);

    return `rgb(${r}, ${g}, ${b})`;
  }

  readonly langOptions = computed<DropdownOption<Lang>[]>(() =>
    this.i18n.langs.map(l => ({
      value: l,
      label: this.i18n.dicts[l].langName,
      shortLabel: l.toUpperCase(),
      badge: l.toUpperCase()
    }))
  );

  readonly currentViewValue = computed<string>(() => {
    if (this.state.viewMode() === 'globe') return 'globe';
    return `cross-section:${this.state.selectedPair().id}`;
  });

  readonly viewOptions = computed<DropdownOption<string>[]>(() => {
    const t = this.i18n.t();
    const options: DropdownOption<string>[] = [
      { value: 'globe', label: t.viewPrimary, icon: Globe }
    ];
    for (const p of LATITUDE_PAIRS) {
      const cityA = (t as any)[p.cityAKey] || p.cityAKey;
      const cityB = (t as any)[p.cityBKey] || p.cityBKey;
      options.push({
        value: `cross-section:${p.id}`,
        label: `${p.lat.toFixed(0)}°N: ${cityA} ↔ ${cityB}`,
        icon: Activity,
        badge: `${p.lat.toFixed(0)}°N`
      });
    }
    return options;
  });

  readonly currentViewIcon = computed(
    () => this.viewOptions().find(o => o.value === this.currentViewValue())?.icon ?? Globe
  );

  onViewChange(value: string) {
    if (value === 'globe') {
      this.state.setViewMode('globe');
    } else if (value.startsWith('cross-section:')) {
      const id = value.split(':')[1];
      this.state.selectPairById(id);
      this.state.setViewMode('cross-section');
    }
  }


  readonly speedOptions = computed<DropdownOption<number>[]>(() =>
    PLAYBACK_SPEEDS.map(s => ({
      value: s,
      label: `${s}x`,
      shortLabel: `${s}x`
    }))
  );

  ngOnInit() {
    // Reveal visualization stage after loading
    setTimeout(() => {
      this.splash.setProgress(100);
      this.splash.finish();
    }, 700);
  }

  openAbout() {
    this.about.open({ lang: this.i18n.lang() });
  }

  openSettings() {
    this.popup.open({
      id: 'settings',
      title: computed(() => this.i18n.t().settingsTitle),
      subtitle: computed(() => this.i18n.t().settingsSubtitle),
      component: SettingsPopupComponent
    });
  }

  openGlossary() {
    this.popup.open({
      id: 'glossary',
      title: computed(() => this.i18n.t().glTitle),
      subtitle: computed(() => this.i18n.t().glSubtitle),
      component: GlossaryComponent,
      size: 'lg',
      actions: [
        {
          label: computed(() => this.i18n.t().close),
          variant: 'default'
        }
      ]
    });
  }

  openSummary() {
    this.popup.open({
      id: 'summary',
      title: computed(() => {
        const t = this.i18n.t() as any;
        const p = this.state.selectedPair();
        const cityA = t[p.cityAKey] || p.cityAKey;
        const cityB = t[p.cityBKey] || p.cityBKey;
        return `${p.lat.toFixed(0)}°N: ${cityA} ↔ ${cityB}`;
      }),
      subtitle: computed(() => this.i18n.t().summarySubtitle),
      component: PairModalComponent,
      size: 'md',
      actions: [
        {
          label: computed(() => this.i18n.t().viewCrossSection),
          variant: 'default',
          hot: true,
          onClick: () => {
            this.state.setViewMode('cross-section');
          }
        },
        {
          label: computed(() => this.i18n.t().close),
          variant: 'default'
        }
      ]
    });
  }

  openSources() {
    this.popup.open({
      id: 'sources',
      title: computed(() => this.i18n.t().dataSourcesTitle),
      subtitle: computed(() => this.i18n.t().dataSourcesSubtitle),
      component: SourcesPopupComponent,
      size: 'lg',
      actions: [
        {
          label: computed(() => this.i18n.t().close),
          variant: 'default'
        }
      ]
    });
  }
}
