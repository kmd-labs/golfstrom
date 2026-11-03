export type Lang = 'en' | 'pl';
export type TempUnit = 'C' | 'F';

export interface GlossaryTerm {
  term: string;
  text: string;
  wiki: string;
  wikiLang: Lang;
}

export interface GlossaryGroup {
  title: string;
  terms: GlossaryTerm[];
}

export interface SourceProduct {
  name: string;
  url: string;
}

export interface SourceItem {
  name: string;
  url: string;
  license: string;
  desc: string;
  products?: SourceProduct[];
}

export interface MethodologyItem {
  label: string;
  area: string;
  text: string;
}

export interface BuiltRow {
  label: string;
  text: string;
}

export interface BuiltSection {
  title: string;
  rows: BuiltRow[];
  teamLink: string;
}

/**
 * Every user-facing text of the application in one language.
 * Add new translation keys here first so TypeScript enforces parity across en.ts and pl.ts.
 */
export interface Dict {
  htmlLang: string;
  docTitle: string;
  langName: string;

  // Settings & Language
  settingsTitle: string;
  settingsSubtitle: string;
  settingsAria: string;
  temperatureUnit: string;
  unitCelsius: string;
  unitFahrenheit: string;

  // Top HUD & Navigation
  changeLanguage: string;
  chooseView: string;
  viewPrimary: string;
  viewSecondary: string;
  stageAriaLabel: string;
  aboutUs: string;
  openAbout: string;

  // Bottom Dock & Controls
  timelineLabel: string;
  play: string;
  pause: string;
  playbackSpeed: string;
  monthNames: string[];
  shortMonthNames: string[];
  currentMonthLabel: (monthName: string) => string;

  // Legends & Status
  toggleSstMode: string;
  thermalAnomaly: string;
  sstModeAnomaly: string;
  sstModeAbsolute: string;
  sstAbsolute: string;
  sstAnomaly: string;
  sstLegendTitle: string;
  anomLegendTitle: string;
  summary: string;
  summaryTooltip: string;
  summarySubtitle: string;
  layers: string;
  layersTooltip: string;
  layerThermalScale: string;
  scaleSstShort: string;
  scaleAnomShort: string;
  layersPinsTitle: string;
  layersPinsSubtitle: string;
  legendActivePin: string;
  legendInactivePin: string;
  activePinLabel: string;
  anomalyScaleTitle: string;
  anomalyScaleDesc: string;
  sstScaleTitle: string;
  sstScaleDesc: string;

  // Countries (for concise mobile display)
  countryUSA: string;
  countryCanada: string;
  countryPortugal: string;
  countryFrance: string;
  countryNorway: string;

  // Same-latitude comparison pairs
  seasonWinter: string;
  seasonJanWinter: string;
  seasonJulSummer: string;
  warmerInEurope: (deg: number) => string;
  regionNorthAmerica: string;
  regionEurope: string;
  cityBodo: string;
  cityBaffin: string;
  pairBodoTitle: string;
  pairBodoDesc: string;

  cityStJohns: string;
  cityBrest: string;
  pairBrestTitle: string;
  pairBrestDesc: string;

  cityNewYork: string;
  cityPorto: string;
  pairPortoTitle: string;
  pairPortoDesc: string;

  pointHatteras: string;
  pointGulfStreamCore: string;
  pairHatterasTitle: string;
  pairHatterasDesc: string;
  cityLisbon: string;

  winterDifference: string;
  summerDifference: string;
  viewPairDetails: string;
  viewCrossSection: string;

  // Thermal Cross-Section View
  crossSectionAria: string;
  crossSectionTitle: string;
  crossSectionSubtitle: string;
  gulfStreamPeak: string;
  gulfStreamPeakBadge: string;
  gulfStreamPeakDesc: string;
  midAtlanticRidge: string;
  azoresIslands: string;
  greenland: string;
  janMayen: string;
  flemishCap: string;
  bermuda: string;
  oceanDepthLabel: string;
  surfaceTempLabel: string;
  westerliesLabel: string;
  heatReleaseLabel: string;
  crossSectionPairSelect: string;
  selectTransect: string;
  prevTransect: string;
  nextTransect: string;

  // Globe Inspection Tooltip
  inspectWater: string;
  inspectAir: string;
  inspectNoWater: string;
  inspectCoords: (lat: number, lon: number) => string;
  inspectLand: string;
  inspectOcean: string;

  // Glossary
  glossary: string;
  glTitle: string;
  glSubtitle: string;
  glSearch: string;
  glSearchAria: string;
  glEmpty: (q: string) => string;
  wikiIn: Record<Lang, string>;
  glossaryGroups: GlossaryGroup[];
  close: string;

  // Data Sources & Attribution
  dataSources: string;
  dataSourcesTitle: string;
  dataSourcesSubtitle: string;
  sourcesTitle: string;
  sourcesList: SourceItem[];
  methodology: {
    title: string;
    subtitle: string;
    items: MethodologyItem[];
  };
  built: BuiltSection;
}
