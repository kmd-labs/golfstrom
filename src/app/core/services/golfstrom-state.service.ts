import { Injectable, computed, signal } from '@angular/core';
import { LatitudePairPin, SstMode, ViewMode } from '../models/golfstrom.model';
import { LATITUDE_PAIRS, PLAYBACK_SPEEDS } from '../constants/golfstrom-data';

@Injectable({
  providedIn: 'root'
})
export class GolfstromStateService {
  /** Continuous month (0.00 to 11.99) driving smooth seasonal progression */
  readonly month = signal<number>(0);
  readonly currentMonthIndex = computed(() => Math.floor(this.month()) % 12);

  readonly isPlaying = signal<boolean>(true);
  readonly playbackSpeed = signal<number>(1);
  readonly viewMode = signal<ViewMode>('globe');

  /** Default view mode is Thermal Anomaly as requested */
  readonly sstMode = signal<SstMode>('anomaly');

  /** Active selected latitude pair (defaults to New York - Porto) */
  readonly selectedPair = signal<LatitudePairPin>(LATITUDE_PAIRS[0]);

  readonly mapLoaded = signal<boolean>(false);

  setMonth(m: number) {
    let normalized = m % 12;
    if (normalized < 0) normalized += 12;
    this.month.set(normalized);
  }

  advanceTime(deltaSeconds: number, cycleDurationSeconds = 24) {
    if (!this.isPlaying()) return;
    const increment = (deltaSeconds / cycleDurationSeconds) * 12 * this.playbackSpeed();
    this.setMonth(this.month() + increment);
  }

  togglePlay() {
    this.isPlaying.update(p => !p);
  }

  setPlaybackSpeed(speed: number) {
    if (PLAYBACK_SPEEDS.includes(speed)) {
      this.playbackSpeed.set(speed);
    }
  }

  setViewMode(mode: ViewMode) {
    this.viewMode.set(mode);
  }

  toggleSstMode() {
    this.sstMode.update(m => (m === 'sst' ? 'anomaly' : 'sst'));
  }

  selectPair(pair: LatitudePairPin) {
    this.selectedPair.set(pair);
  }
}
