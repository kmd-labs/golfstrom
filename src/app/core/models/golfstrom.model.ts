export type ViewMode = 'globe' | 'cross-section';

export type SstMode = 'sst' | 'anomaly';

export interface IslandFeature {
  nameKey: string;
  lon: number;
  elevM: number;
  depthM: number;
}

export interface BathymetryPoint {
  lon: number;
  depthM: number;
  elevM: number;
  labelKey?: string;
}

export interface LatitudePairPin {
  id: string;
  lat: number;
  // West Atlantic location
  lonA: number;
  cityAKey: string;
  janTempA: number;
  julTempA: number;
  // East Atlantic location
  lonB: number;
  cityBKey: string;
  janTempB: number;
  julTempB: number;
  // Gulf Stream peak longitude & baseline temps
  gsLon: number;
  gsJanTemp: number;
  gsJulTemp: number;
  // Islands & submarine ridge features along the transect
  islands: IslandFeature[];
  bathymetry?: BathymetryPoint[];
  // Educational narrative
  titleKey: string;
  descKey: string;
}
