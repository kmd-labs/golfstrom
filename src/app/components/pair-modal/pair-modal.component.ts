import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LatitudePairPin } from '../../core/models/golfstrom.model';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-pair-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pair-modal.component.html',
  styleUrl: './pair-modal.component.scss'
})
export class PairModalComponent {
  @Input() pair!: LatitudePairPin;

  readonly i18n = inject(I18nService);
  readonly Math = Math;

  getCityName(key: string): string {
    const t = this.i18n.t();
    return (t as any)[key] || key;
  }

  getPairDescription(): string {
    if (!this.pair) return '';
    const t = this.i18n.t();
    return (t as any)[this.pair.descKey] || '';
  }
}
