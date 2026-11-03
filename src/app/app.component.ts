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
    return t[p.cityAKey] || p.cityAKey;
  });

  readonly activeCity2Name = computed(() => {
    const p = this.state.selectedPair();
    const t = this.i18n.t() as any;
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

  readonly anomTickMin = computed(() => this.i18n.formatTemp(-3, 'delta', true));
  readonly anomTickMid = computed(() => this.i18n.formatTemp(0, 'delta', false));
  readonly anomTickMax = computed(() => this.i18n.formatTemp(3, 'delta', true));

  readonly sstTickMin = computed(() => this.i18n.formatTemp(-20, 'temp', false));
  readonly sstTickMid = computed(() => this.i18n.formatTemp(7.5, 'temp', true));
  readonly sstTickMax = computed(() => this.i18n.formatTemp(35, 'temp', true));

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
