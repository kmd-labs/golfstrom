import { Injectable, NgZone, computed, effect, inject, signal } from '@angular/core';
import { ThemeMode, ThemeService } from '@kmd/design-system/services/theme.service';

export type ThemePref = 'auto' | 'light' | 'dark';

const THEME_KEY = 'golfstrom.theme';
export const DEFAULT_THEME_PREF: ThemePref = 'auto';

/**
 * Manages user appearance preference (`auto` | `light` | `dark`) persisted in `localStorage`
 * and synchronizes the resolved mode onto `ThemeService`.
 */
@Injectable({ providedIn: 'root' })
export class ThemePrefService {
  private readonly theme = inject(ThemeService);
  private readonly ngZone = inject(NgZone);

  readonly pref = signal<ThemePref>(this.resolveInitial());
  private readonly systemDark = signal(false);

  readonly resolved = computed<ThemeMode>(() =>
    this.pref() === 'auto' ? (this.systemDark() ? 'dark' : 'light') : (this.pref() as ThemeMode)
  );

  constructor() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemDark.set(mql.matches);
      mql.addEventListener('change', (event) =>
        this.ngZone.run(() => this.systemDark.set(event.matches))
      );
    }

    effect(() => {
      this.theme.setMode(this.resolved());
    });
  }

  setPref(pref: ThemePref): void {
    this.pref.set(pref);
    try {
      localStorage.setItem(THEME_KEY, pref);
    } catch {
      // localStorage unavailable
    }
  }

  private resolveInitial(): ThemePref {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === 'auto' || stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch {
      // localStorage unavailable
    }
    return DEFAULT_THEME_PREF;
  }
}
