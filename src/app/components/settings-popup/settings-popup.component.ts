import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Monitor, Sun, Moon } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { Lang, TempUnit } from '../../core/i18n/i18n.types';
import { ThemePref, ThemePrefService } from '../../core/services/theme-pref.service';

@Component({
  selector: 'app-settings-popup',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './settings-popup.component.html',
  styleUrl: './settings-popup.component.scss'
})
export class SettingsPopupComponent {
  readonly i18n = inject(I18nService);
  readonly themePref = inject(ThemePrefService);

  readonly themes = computed<{ id: ThemePref; icon: typeof Monitor; label: string }[]>(() => {
    const t = this.i18n.t();
    return [
      { id: 'auto', icon: Monitor, label: t.themeAuto },
      { id: 'light', icon: Sun, label: t.themeLight },
      { id: 'dark', icon: Moon, label: t.themeDark }
    ];
  });

  readonly languages: { id: Lang; label: string }[] = [
    { id: 'en', label: 'English' },
    { id: 'pl', label: 'Polski' }
  ];

  readonly tempUnits: { id: TempUnit; labelKey: 'unitCelsius' | 'unitFahrenheit' }[] = [
    { id: 'C', labelKey: 'unitCelsius' },
    { id: 'F', labelKey: 'unitFahrenheit' }
  ];

  selectTheme(pref: ThemePref): void {
    this.themePref.setPref(pref);
  }

  selectLang(lang: Lang) {
    this.i18n.setLang(lang);
  }

  selectTempUnit(unit: TempUnit) {
    this.i18n.setTempUnit(unit);
  }
}
