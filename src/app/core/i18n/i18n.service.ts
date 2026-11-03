import { Injectable, computed, effect, signal } from '@angular/core';
import { Dict, Lang, TempUnit } from './i18n.types';
import { EN } from './en';
import { PL } from './pl';

const DICTS: Record<Lang, Dict> = { en: EN, pl: PL };
const STORAGE_KEY = 'golfstrom.lang';
const TEMP_UNIT_KEY = 'golfstrom.temp-unit';
const UNITS_KEY = 'golfstrom.units';
const TEMP_UNIT_MANUAL_KEY = 'golfstrom.temp-unit.manual';

/**
 * Manages UI language, localized texts, and temperature units.
 * Resolves initial language and units from localStorage or Navigator API,
 * and persists settings to localStorage ('golfstrom.lang', 'golfstrom.units').
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly dicts = DICTS;
  readonly langs: Lang[] = ['en', 'pl'];

  private readonly initialLang = this.resolveInitialLang();
  readonly lang = signal<Lang>(this.initialLang);
  readonly tempUnit = signal<TempUnit>(this.resolveInitialTempUnit(this.initialLang));
  readonly t = computed(() => DICTS[this.lang()]);

  constructor() {
    effect(() => {
      const currentLang = this.lang();
      const d = this.t();
      if (typeof document !== 'undefined') {
        document.documentElement.lang = d.htmlLang;
        document.title = d.docTitle;
      }
      this.persistLang(currentLang);
    });
  }

  setLang(lang: Lang) {
    this.lang.set(lang);
    if (!this.hasManualTempUnit()) {
      const autoUnit: TempUnit = lang === 'en' ? 'F' : 'C';
      this.tempUnit.set(autoUnit);
      this.persistTempUnit(autoUnit, false);
    }
  }

  setTempUnit(unit: TempUnit) {
    this.tempUnit.set(unit);
    this.persistTempUnit(unit, true);
  }

  /**
   * Formats a temperature value in the active TempUnit (°C or °F).
   * Supports 'temp' (absolute) and 'delta' (difference) modes.
   */
  formatTemp(
    valueCelsius: number | null | undefined,
    mode: 'temp' | 'delta' = 'temp',
    showSign = mode === 'delta',
    unitOverride?: TempUnit
  ): string {
    if (valueCelsius == null || !Number.isFinite(valueCelsius)) return '—';
    const unit = unitOverride ?? this.tempUnit();
    const locale = this.t().htmlLang === 'pl' ? 'pl-PL' : 'en-US';

    const converted = unit === 'F'
      ? (mode === 'delta' ? valueCelsius * 1.8 : valueCelsius * 1.8 + 32)
      : valueCelsius;

    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(Math.abs(converted));

    let sign = '';
    if (converted < -0.04) {
      sign = '−';
    } else if (showSign && converted > 0.04) {
      sign = '+';
    }

    return `${sign}${formatted} °${unit}`;
  }

  private hasManualTempUnit(): boolean {
    try {
      return localStorage.getItem(TEMP_UNIT_MANUAL_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private resolveInitialTempUnit(initialLang: Lang): TempUnit {
    try {
      const stored = localStorage.getItem(TEMP_UNIT_KEY) || localStorage.getItem(UNITS_KEY);
      if (stored === 'C' || stored === 'F') {
        return stored;
      }
    } catch {
      // localStorage unavailable
    }
    return initialLang === 'en' ? 'F' : 'C';
  }

  private persistTempUnit(unit: TempUnit, manual: boolean) {
    try {
      localStorage.setItem(TEMP_UNIT_KEY, unit);
      localStorage.setItem(UNITS_KEY, unit);
      if (manual) {
        localStorage.setItem(TEMP_UNIT_MANUAL_KEY, 'true');
      }
    } catch {
      // localStorage unavailable
    }
  }

  private resolveInitialLang(): Lang {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (this.isSupportedLang(stored)) {
        return stored;
      }
    } catch {
      // localStorage unavailable
    }

    if (typeof navigator !== 'undefined') {
      const candidates = [
        ...(Array.isArray(navigator.languages) ? navigator.languages : []),
        navigator.language
      ].filter(Boolean);

      for (const candidate of candidates) {
        const prefix = candidate.slice(0, 2).toLowerCase();
        if (this.isSupportedLang(prefix)) {
          return prefix;
        }
      }
    }

    return 'en';
  }

  private isSupportedLang(val: string | null | undefined): val is Lang {
    return val === 'en' || val === 'pl';
  }

  private persistLang(lang: Lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // localStorage unavailable
    }
  }
}
