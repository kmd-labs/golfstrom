import { Dict } from './i18n.types';

export const EN: Dict = {
  htmlLang: 'en',
  docTitle: 'KMD · Golfstrom',
  langName: 'English',

  // Top HUD & Navigation
  changeLanguage: 'Language',
  chooseView: 'View',
  viewPrimary: "Europe's Heat Pump (3D Globe)",
  viewSecondary: 'Thermal Cross-Section (City Pairs)',
  stageAriaLabel: 'Golfstrom Visualization',
  aboutUs: 'About us',
  openAbout: 'About KMD',

  // Bottom Dock & Controls
  timelineLabel: 'Seasonal Month Timeline',
  play: 'Play seasonal cycle',
  pause: 'Pause seasonal cycle',
  playbackSpeed: 'Speed',
  monthNames: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ],
  shortMonthNames: [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ],
  currentMonthLabel: (monthName: string) => `Month: ${monthName}`,

  // Legends & Status
  toggleSstMode: 'Mode',
  sstAbsolute: 'Absolute SST (°C)',
  sstAnomaly: 'Thermal Anomaly (°C)',
  sstLegendTitle: 'Sea Surface Temperature',
  anomLegendTitle: 'Zonal Temperature Anomaly',

  // Same-latitude comparison pairs
  seasonWinter: 'Winter',
  seasonJanWinter: 'Winter (Jan)',
  seasonJulSummer: 'Summer (Jul)',
  warmerInEurope: (deg: number) => `+${deg}°C warmer in Europe!`,
  regionNorthAmerica: 'North America',
  regionEurope: 'Europe',
  cityBodo: 'Bodø, Norway (67.3°N)',
  cityBaffin: 'Baffin Island, Canada (67.5°N)',
  pairBodoTitle: 'Bodø vs. Baffin Island (67°N)',
  pairBodoDesc:
    'At 67°N above the Arctic Circle, Bodø’s harbor never freezes (winter mean -1°C) thanks to the warm Norwegian Current. At the exact same latitude in Canada, Baffin Island experiences brutal arctic winters (-27°C) surrounded by pack ice.',

  cityStJohns: "St. John's, Canada (47.5°N)",
  cityBrest: 'Brest, France (48.4°N)',
  pairBrestTitle: "Brest vs. St. John's (48°N)",
  pairBrestDesc:
    'Brest enjoys lush coastal greenery and mild winters (+7°C), while St. John’s at the same latitude is battered by freezing Labrador Current waters, sea ice, and icebergs (winter mean -5°C).',

  cityNewYork: 'New York, USA (40.7°N)',
  cityPorto: 'Porto, Portugal (41.1°N)',
  pairPortoTitle: 'Porto vs. New York (41°N)',
  pairPortoDesc:
    'Both cities lie at ~41°N. New York faces severe blizzards and sub-zero cold waves from continental air masses, whereas Porto’s winter temperature averages a mild 10°C due to Atlantic ocean thermal moderation.',

  pointHatteras: 'Cape Hatteras (35.2°N)',
  pointGulfStreamCore: 'Gulf Stream Core',
  pairHatterasTitle: 'Cape Hatteras Separation Zone',
  pairHatterasDesc:
    'Here the Gulf Stream leaves the continental shelf break, accelerating up to 2 m/s (~9 km/h) and transporting roughly 100 million m³/s of warm water into the open North Atlantic, spawning giant warm and cold rings.',
  cityLisbon: 'Lisbon, Portugal (38.7°N)',

  winterDifference: 'Winter temperature difference',
  summerDifference: 'Summer temperature difference',
  viewPairDetails: 'Inspect Latitude Comparison',
  viewCrossSection: 'View Thermal Cross-Section',

  // Thermal Cross-Section View
  crossSectionAria: 'North Atlantic Thermal Cross-Section',
  crossSectionTitle: 'Transatlantic Temperature Profile',
  crossSectionSubtitle: 'Vertical ocean & atmospheric slice between same-latitude city pairs',
  gulfStreamPeak: 'Gulf Stream (Golfstrom)',
  gulfStreamPeakBadge: 'Thermal Peak / Heat Pump Core',
  gulfStreamPeakDesc:
    'Intense western boundary current releasing up to 1 petawatt of thermal energy to eastward westerlies, warming Europe.',
  midAtlanticRidge: 'Mid-Atlantic Ridge',
  azoresIslands: 'Azores Islands',
  greenland: 'Greenland',
  janMayen: 'Jan Mayen Ridge',
  flemishCap: 'Flemish Cap Shelf',
  bermuda: 'Bermuda Rise',
  oceanDepthLabel: 'Depth (0–4000 m)',
  surfaceTempLabel: 'Surface & Air Temperature (°C)',
  westerliesLabel: 'Prevailing Westerly Winds ➔',
  heatReleaseLabel: 'Latent & Sensible Heat Flux ⬆',
  crossSectionPairSelect: 'Select Latitude Transect:',
  selectTransect: 'Select Transect',
  prevTransect: 'Previous Transect',
  nextTransect: 'Next Transect',

  // Globe Inspection Tooltip
  inspectWater: 'Sea Temp (SST)',
  inspectAir: 'Air Temp (2m)',
  inspectNoWater: 'Land / Ice',
  inspectCoords: (lat: number, lon: number) =>
    `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`,
  inspectLand: 'Land (ERA5)',
  inspectOcean: 'Ocean (NOAA OISST)',

  // Glossary
  glossary: 'Glossary',
  glTitle: 'Oceanographic Glossary & Key Concepts',
  glSubtitle: 'The physical mechanisms driving the Gulf Stream & AMOC',
  glSearch: 'Search terms, e.g. AMOC, meander, eddy…',
  glSearchAria: 'Search oceanographic terms',
  glEmpty: (q: string) => `No terms match “${q}”.`,
  wikiIn: { en: '', pl: ' (PL)' },
  close: 'Close',
  glossaryGroups: [
    {
      title: 'The Gulf Stream System',
      terms: [
        {
          term: 'The Gulf Stream',
          text: 'A swift, warm western boundary current flowing along the eastern coast of North America from Florida to Cape Hatteras before detaching into the open North Atlantic. It transports ~30 Sv in the Florida Straits and over 100 Sv after detachment.',
          wiki: 'https://en.wikipedia.org/wiki/Gulf_Stream',
          wikiLang: 'en'
        },
        {
          term: 'Florida Current',
          text: 'The initial thermal jet of the Gulf Stream emerging from the Gulf of Mexico through the Florida Straits, reaching surface speeds up to 2 m/s (~7 km/h).',
          wiki: 'https://en.wikipedia.org/wiki/Florida_Current',
          wikiLang: 'en'
        },
        {
          term: 'Cape Hatteras Detachment',
          text: 'The dynamic coastal separation point at 35°N where the current leaves the shallow continental shelf break and transitions into large-amplitude open-ocean meanders.',
          wiki: 'https://en.wikipedia.org/wiki/Cape_Hatteras',
          wikiLang: 'en'
        },
        {
          term: 'North Atlantic Drift (Current)',
          text: 'The northeastward extension of the Gulf Stream across the Atlantic toward Western Europe and the Norwegian Sea, directly responsible for keeping European winter climates significantly milder than North America at the same latitude.',
          wiki: 'https://en.wikipedia.org/wiki/North_Atlantic_Current',
          wikiLang: 'en'
        },
        {
          term: 'Warm-Core & Cold-Core Rings',
          text: 'Mesoscale ocean eddies 100–300 km in diameter that pinch off from sharp Gulf Stream meanders. Warm rings spin clockwise north of the current; cold rings spin counterclockwise into the Sargasso Sea.',
          wiki: 'https://en.wikipedia.org/wiki/Eddy_(fluid_dynamics)#Ocean_eddies',
          wikiLang: 'en'
        }
      ]
    },
    {
      title: 'AMOC & Thermohaline Dynamics',
      terms: [
        {
          term: 'AMOC (Atlantic Meridional Overturning Circulation)',
          text: 'A planetary-scale oceanic conveyor belt carrying warm, saline upper water northward and cold, dense deep water southward along the ocean floor, driving global ocean heat redistribution.',
          wiki: 'https://en.wikipedia.org/wiki/Atlantic_meridional_overturning_circulation',
          wikiLang: 'en'
        },
        {
          term: 'North Atlantic Deep Water (NADW)',
          text: 'A massive body of cold, dense water formed in the subpolar North Atlantic that fills depths between 1,500 and 4,000 meters and flows south into the global abyss.',
          wiki: 'https://en.wikipedia.org/wiki/North_Atlantic_Deep_Water',
          wikiLang: 'en'
        },
        {
          term: 'Deep Convection Chimneys',
          text: 'Localized vertical sinking plumes in the Labrador and Greenland-Norwegian seas where intense winter atmospheric cooling and brine rejection cause dense surface water to plunge kilometers down.',
          wiki: 'https://en.wikipedia.org/wiki/Convection_(oceanography)',
          wikiLang: 'en'
        },
        {
          term: 'Greenland-Scotland Ridge Sill',
          text: 'A submarine mountain ridge (~800 m depth) that acts as a physical barrier over which dense subpolar overflow water cascades into the deep North Atlantic abyss.',
          wiki: 'https://en.wikipedia.org/wiki/Greenland-Scotland_Ridge',
          wikiLang: 'en'
        },
        {
          term: "Europe's Heat Pump Effect",
          text: 'The process whereby the North Atlantic Current transfers ~1 petawatt of sensible and latent heat into prevailing eastward storm tracks, moderating European winters.',
          wiki: 'https://en.wikipedia.org/wiki/Climate_of_Europe',
          wikiLang: 'en'
        }
      ]
    },
    {
      title: 'Ocean & Climate Properties',
      terms: [
        {
          term: 'Sea Surface Temperature (SST)',
          text: 'The temperature of the topmost ocean layer, governing evaporation, latent heat release, and weather patterns across adjacent continents.',
          wiki: 'https://en.wikipedia.org/wiki/Sea_surface_temperature',
          wikiLang: 'en'
        },
        {
          term: 'Thermal Anomaly',
          text: 'The deviation between local water temperature and the long-term zonal average for that latitude and season.',
          wiki: 'https://en.wikipedia.org/wiki/Temperature_anomaly',
          wikiLang: 'en'
        },
        {
          term: 'Sverdrup (Sv)',
          text: 'A standard oceanographic unit of volumetric flow rate equal to 1,000,000 m³/s. The Gulf Stream transports 30 Sv off Florida and peaks over 100–150 Sv in the open ocean.',
          wiki: 'https://en.wikipedia.org/wiki/Sverdrup',
          wikiLang: 'en'
        }
      ]
    }
  ]
};
