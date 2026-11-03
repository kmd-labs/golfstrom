import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { TempUnit } from '../i18n/i18n.types';

@Pipe({
  name: 'localeTemp',
  standalone: true,
  pure: false
})
export class LocaleTempPipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(
    valueCelsius: number | null | undefined,
    mode: 'temp' | 'delta' = 'temp',
    showSign = mode === 'delta',
    unitOverride?: TempUnit
  ): string {
    return this.i18n.formatTemp(valueCelsius, mode, showSign, unitOverride);
  }
}
