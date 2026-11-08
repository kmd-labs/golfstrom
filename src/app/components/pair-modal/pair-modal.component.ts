import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LatitudePairPin } from '../../core/models/golfstrom.model';
import { I18nService } from '../../core/i18n/i18n.service';
import { GolfstromStateService } from '../../core/services/golfstrom-state.service';

@Component({
  selector: 'app-pair-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pair-modal.component.html',
  styleUrl: './pair-modal.component.scss'
})
export class PairModalComponent {
  private readonly state = inject(GolfstromStateService);
  readonly i18n = inject(I18nService);
  readonly Math = Math;

  @Input() pair?: LatitudePairPin;

  get currentPair(): LatitudePairPin {
    return this.pair ?? this.state.selectedPair();
  }

  getCityName(key: string): string {
    const t = this.i18n.t();
    return (t as any)[key] || key;
  }

  getPairDescription(): string {
    const p = this.currentPair;
    if (!p) return '';
    const t = this.i18n.t();
    return (t as any)[p.descKey] || '';
  }
}
