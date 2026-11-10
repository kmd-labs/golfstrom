import { Injectable } from '@angular/core';

type UmamiEventData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: UmamiEventData) => void;
    };
  }
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  track(eventName: string, eventData?: UmamiEventData): void {
    window.umami?.track(eventName, eventData);
  }
}
