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
  Gauge
} from 'lucide-angular';
import {
  ButtonComponent,
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
import { ViewMode } from './core/models/golfstrom.model';
import { PLAYBACK_SPEEDS } from './core/constants/golfstrom-data';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
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

  readonly globeIcon = Globe;
  readonly activityIcon = Activity;
  readonly bookOpenIcon = BookOpen;
  readonly playIcon = Play;
  readonly pauseIcon = Pause;
  readonly thermoIcon = Thermometer;
  readonly speedIcon = Gauge;

  readonly isPopupOpen = computed(() => this.popup.config() !== null);

  readonly currentMonthName = computed(() => {
    const t = this.i18n.t();
    const idx = this.state.currentMonthIndex();
    return t.monthNames[idx] || '';
  });

  readonly langOptions = computed<DropdownOption<Lang>[]>(() =>
    this.i18n.langs.map(l => ({
      value: l,
      label: this.i18n.dicts[l].langName,
      shortLabel: l.toUpperCase(),
      badge: l.toUpperCase()
    }))
  );

  readonly viewOptions = computed<DropdownOption<ViewMode>[]>(() => {
    const t = this.i18n.t();
    return [
      { value: 'globe', label: t.viewPrimary, icon: Globe },
      { value: 'cross-section', label: t.viewSecondary, icon: Activity }
    ];
  });

  readonly currentViewIcon = computed(
    () => this.viewOptions().find(o => o.value === this.state.viewMode())?.icon ?? Globe
  );

  /** Current day and month for the top-left date pill (e.g. "15 Jan" or "15 Sty") */
  readonly currentDateLabel = computed(() => {
    const m = this.state.month();
    const startMs = Date.UTC(2025, 0, 1);
    const yearMs = 365 * 24 * 60 * 60 * 1000;
    const currentMs = startMs + (m / 12) * yearMs;
    const d = new Date(currentMs);
    const day = d.getUTCDate();
    const t = this.i18n.t();
    const month = t.shortMonthNames[d.getUTCMonth()] || '';
    return `${day} ${month}`;
  });

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
}
