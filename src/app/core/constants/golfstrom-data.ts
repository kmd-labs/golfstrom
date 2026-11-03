import { LatitudePairPin } from '../models/golfstrom.model';

export const LATITUDE_PAIRS: LatitudePairPin[] = [
  {
    id: 'ny-porto',
    lat: 41.0,
    lonA: -74.0,
    cityAKey: 'cityNewYork',
    janTempA: 1,
    julTempA: 25,
    lonB: -8.6,
    cityBKey: 'cityPorto',
    janTempB: 10,
    julTempB: 20,
    gsLon: -66.5,
    gsJanTemp: 22,
    gsJulTemp: 27,
    islands: [
      { nameKey: 'midAtlanticRidge', lon: -35.0, elevM: -1800, depthM: 1800 },
      { nameKey: 'azoresIslands', lon: -28.2, elevM: 2351, depthM: 0 }
    ],
    titleKey: 'pairPortoTitle',
    descKey: 'pairPortoDesc'
  },
  {
    id: 'stjohns-brest',
    lat: 48.0,
    lonA: -52.7,
    cityAKey: 'cityStJohns',
    janTempA: -5,
    julTempA: 16,
    lonB: -4.5,
    cityBKey: 'cityBrest',
    janTempB: 7,
    julTempB: 17,
    gsLon: -44.0,
    gsJanTemp: 16,
    gsJulTemp: 22,
    islands: [
      { nameKey: 'flemishCap', lon: -45.0, elevM: -150, depthM: 150 },
      { nameKey: 'midAtlanticRidge', lon: -29.0, elevM: -1400, depthM: 1400 }
    ],
    titleKey: 'pairBrestTitle',
    descKey: 'pairBrestDesc'
  },
  {
    id: 'bodo-baffin',
    lat: 67.3,
    lonA: -68.5,
    cityAKey: 'cityBaffin',
    janTempA: -27,
    julTempA: 8,
    lonB: 14.4,
    cityBKey: 'cityBodo',
    janTempB: -1,
    julTempB: 14,
    gsLon: 4.5,
    gsJanTemp: 7,
    gsJulTemp: 13,
    islands: [
      { nameKey: 'greenland', lon: -40.0, elevM: 2500, depthM: 0 },
      { nameKey: 'janMayen', lon: -8.5, elevM: 2277, depthM: 0 }
    ],
    titleKey: 'pairBodoTitle',
    descKey: 'pairBodoDesc'
  },
  {
    id: 'hatteras',
    lat: 35.2,
    lonA: -75.5,
    cityAKey: 'pointHatteras',
    janTempA: 9,
    julTempA: 26,
    lonB: -9.0,
    cityBKey: 'cityLisbon',
    janTempB: 12,
    julTempB: 23,
    gsLon: -73.5,
    gsJanTemp: 23,
    gsJulTemp: 28,
    islands: [
      { nameKey: 'bermuda', lon: -64.8, elevM: 76, depthM: 0 },
      { nameKey: 'midAtlanticRidge', lon: -38.0, elevM: -2100, depthM: 2100 }
    ],
    titleKey: 'pairHatterasTitle',
    descKey: 'pairHatterasDesc'
  }
];

export const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];
