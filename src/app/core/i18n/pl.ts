import { Dict } from './i18n.types';

export const PL: Dict = {
  htmlLang: 'pl',
  docTitle: 'KMD · Golfstrom',
  langName: 'Polski',

  // Top HUD & Navigation
  changeLanguage: 'Język',
  chooseView: 'Widok',
  viewPrimary: 'Pompa ciepła Europy (Globus 3D)',
  viewSecondary: 'Przekrój termiczny (Pary miast)',
  stageAriaLabel: 'Wizualizacja Golfstrom',
  aboutUs: 'O nas',
  openAbout: 'O KMD',

  // Bottom Dock & Controls
  timelineLabel: 'Oś czasu miesięcy pór roku',
  play: 'Odtwórz cykl sezonowy',
  pause: 'Zatrzymaj cykl sezonowy',
  playbackSpeed: 'Prędkość',
  monthNames: [
    'Styczeń',
    'Luty',
    'Marzec',
    'Kwiecień',
    'Maj',
    'Czerwiec',
    'Lipiec',
    'Sierpień',
    'Wrzesień',
    'Październik',
    'Listopad',
    'Grudzień'
  ],
  shortMonthNames: [
    'Sty',
    'Lut',
    'Mar',
    'Kwi',
    'Maj',
    'Cze',
    'Lip',
    'Sie',
    'Wrz',
    'Paź',
    'Lis',
    'Gru'
  ],
  currentMonthLabel: (monthName: string) => `Miesiąc: ${monthName}`,

  // Legends & Status
  toggleSstMode: 'Tryb',
  sstAbsolute: 'Bezwzględna SST (°C)',
  sstAnomaly: 'Anomalia termiczna (°C)',
  sstLegendTitle: 'Temperatura powierzchni morza',
  anomLegendTitle: 'Zonalna anomalia temperatury',

  // Same-latitude comparison pairs
  seasonWinter: 'Zima',
  seasonJanWinter: 'Zima (Sty)',
  seasonJulSummer: 'Lato (Lip)',
  warmerInEurope: (deg: number) => `+${deg}°C cieplej w Europie!`,
  regionNorthAmerica: 'Ameryka Północna',
  regionEurope: 'Europa',
  cityBodo: 'Bodø, Norwegia (67,3°N)',
  cityBaffin: 'Ziemia Baffina, Kanada (67,5°N)',
  pairBodoTitle: 'Bodø vs. Ziemia Baffina (67°N)',
  pairBodoDesc:
    'Na 67°N powyżej koła podbiegunowego port w Bodø nigdy nie zamarza (zimą średnio -1°C) dzięki ciepłemu Prądowi Norweskiemu. Na tej samej szerokości geograficznej w Kanadzie Ziemia Baffina doświadcza surowej arktycznej zimy (-27°C) w uścisku lodu morskiego.',

  cityStJohns: "St. John's, Kanada (47,5°N)",
  cityBrest: 'Brest, Francja (48,4°N)',
  pairBrestTitle: "Brest vs. St. John's (48°N)",
  pairBrestDesc:
    'Brest cieszy się łagodnym klimatem morskim i zielenią (+7°C zimą), podczas gdy leżące na tej samej szerokości St. John’s jest omiatane lodowatym Prądem Labradorskim, krami i górami lodowymi (-5°C zimą).',

  cityNewYork: 'Nowy Jork, USA (40,7°N)',
  cityPorto: 'Porto, Portugalia (41,1°N)',
  pairPortoTitle: 'Porto vs. Nowy Jork (41°N)',
  pairPortoDesc:
    'Oba miasta leżą na ~41°N. Nowy Jork mierzy się z częstymi burzami śnieżnymi i mrozami z głębi kontynentu, podczas gdy średnia zimowa temperatura w Porto wynosi łagodne 10°C dzięki łagodzącemu wpływowi Atlantyku.',

  pointHatteras: 'Przylądek Hatteras (35,2°N)',
  pointGulfStreamCore: 'Rdzeń Golfsztromu',
  pairHatterasTitle: 'Strefa oderwania przy Przylądku Hatteras',
  pairHatterasDesc:
    'Tutaj Golfsztrom opuszcza szelf kontynentalny, osiągając prędkość do 2 m/s (~9 km/h) i transportując około 100 milionów m³/s ciepłej wody na Północny Atlantyk, rodząc gigantyczne wiry pierścieniowe.',
  cityLisbon: 'Lizbona, Portugalia (38,7°N)',

  winterDifference: 'Różnica temperatur zimą',
  summerDifference: 'Różnica temperatur latem',
  viewPairDetails: 'Zobacz porównanie szerokości',
  viewCrossSection: 'Zobacz przekrój termiczny',

  // Thermal Cross-Section View
  crossSectionAria: 'Północnoatlantycki przekrój termiczny',
  crossSectionTitle: 'Transatlantycki profil temperatur',
  crossSectionSubtitle: 'Pionowy przekrój oceanu i atmosfery wzdłuż równoleżnika par miast',
  gulfStreamPeak: 'Golfsztrom (Prąd Zatokowy)',
  gulfStreamPeakBadge: 'Szczyt termiczny / Rdzeń pompy ciepła',
  gulfStreamPeakDesc:
    'Intensywny zachodni prąd brzegowy oddający do 1 petawata energii wiatrom wiejącym ku Europie.',
  midAtlanticRidge: 'Grzbiet Śródatlantycki',
  azoresIslands: 'Wyspy Azorskie',
  greenland: 'Grenlandia',
  janMayen: 'Grzbiet Jan Mayen',
  flemishCap: 'Płycizna Flemish Cap',
  bermuda: 'Wyniesienie Bermudów',
  oceanDepthLabel: 'Głębokość (0–4000 m)',
  surfaceTempLabel: 'Temperatura powierzchni i powietrza (°C)',
  westerliesLabel: 'Dominujące wiatry zachodnie ➔',
  heatReleaseLabel: 'Strumień ciepła jawnego i utajonego ⬆',
  crossSectionPairSelect: 'Wybierz profil szerokości:',

  // Globe Inspection Tooltip
  inspectWater: 'Temp. wody (SST)',
  inspectAir: 'Temp. powietrza (2m)',
  inspectNoWater: 'Ląd / Lód',
  inspectCoords: (lat: number, lon: number) =>
    `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`,
  inspectLand: 'Ląd (ERA5)',
  inspectOcean: 'Ocean (NOAA OISST)',

  // Glossary
  glossary: 'Słowniczek',
  glTitle: 'Słowniczek oceanograficzny i pojęcia',
  glSubtitle: 'Fizyczne mechanizmy napędzające Golfsztrom i cyrkulację AMOC',
  glSearch: 'Szukaj pojęć, np. AMOC, meander, wiry…',
  glSearchAria: 'Szukaj pojęć oceanograficznych',
  glEmpty: (q: string) => `Brak pojęć pasujących do „${q}”.`,
  wikiIn: { en: ' (EN)', pl: '' },
  close: 'Zamknij',
  glossaryGroups: [
    {
      title: 'System Golfsztromu',
      terms: [
        {
          term: 'Golfsztrom (Prąd Zatokowy)',
          text: 'Szybki, ciepły zachodni prąd brzegowy płynący wzdłuż wschodnich wybrzeży Ameryki Północnej od Florydy po Przylądek Hatteras, po czym odrywający się w otwarty Atlantyk. Niesie ~30 Sv w Cieśninie Florydzkiej i ponad 100 Sv po oderwaniu.',
          wiki: 'https://pl.wikipedia.org/wiki/Golfsztrom',
          wikiLang: 'pl'
        },
        {
          term: 'Prąd Florydzki',
          text: 'Początkowy silny strumień termiczny Golfsztromu wypływający z Zatoki Meksykańskiej przez Cieśninę Florydzką, osiągający prędkości do 2 m/s (~7 km/h).',
          wiki: 'https://pl.wikipedia.org/wiki/Pr%C4%85d_Florydzki',
          wikiLang: 'pl'
        },
        {
          term: 'Oderwanie przy Przylądku Hatteras',
          text: 'Strefa separacji przy 35°N, gdzie prąd opuszcza płytki szelf kontynentalny i przechodzi w swobodne meandry w otwartym oceanie.',
          wiki: 'https://pl.wikipedia.org/wiki/Hatteras_(przyl%C4%85dek)',
          wikiLang: 'pl'
        },
        {
          term: 'Prąd Północnoatlantycki',
          text: 'Północno-wschodnie przedłużenie Golfsztromu ku Europie Zachodniej i Morzu Norweskiemu, bezpośrednio odpowiedzialne za znacznie łagodniejszy klimat europejskich zim.',
          wiki: 'https://pl.wikipedia.org/wiki/Pr%C4%85d_P%C3%B3%C5%82nocnoatlantycki',
          wikiLang: 'pl'
        },
        {
          term: 'Pierścienie ciepło- i zimnordzeniowe',
          text: 'Wiry oceaniczne o średnicy 100–300 km odrywające się od meandrów prądu. Pierścienie ciepłordzeniowe wirują zgodnie z ruchem wskazówek zegara na północ od prądu, a zimnordzeniowe przeciwnie do wskazówek w Morzu Sargassowym.',
          wiki: 'https://pl.wikipedia.org/wiki/Wiry_oceaniczne',
          wikiLang: 'pl'
        }
      ]
    },
    {
      title: 'AMOC i dynamika termohalinowa',
      terms: [
        {
          term: 'AMOC (Atlantycka Południkowa Cyrkulacja Wymienna)',
          text: 'Planetarny pas transmisyjny transportujący ciepłą, zasoloną wodę na północ w warstwie przypowierzchniowej oraz odprowadzający gęstą, zimną wodę na południe dnem oceanicznym.',
          wiki: 'https://pl.wikipedia.org/wiki/Cyrkulacja_termohalinowa',
          wikiLang: 'pl'
        },
        {
          term: 'Północnoatlantycka Woda Głębinowa (NADW)',
          text: 'Masy zimnej, gęstej wody powstające w subpolarnym Północnym Atlantyku, wypełniające głębokości 1500–4000 m i płynące na południe ku oceanom globalnym.',
          wiki: 'https://en.wikipedia.org/wiki/North_Atlantic_Deep_Water',
          wikiLang: 'en'
        },
        {
          term: 'Kominy głębokiej konwekcji',
          text: 'Wąskie pionowe strefy tonięcia w Morzach Labradorskim i Grenlandzko-Norweskim, gdzie intensywne zimowe wychładzanie i wytrącanie soli powodują opadanie wód w otchłań.',
          wiki: 'https://pl.wikipedia.org/wiki/Konwekcja',
          wikiLang: 'pl'
        },
        {
          term: 'Próg Grenlandzko-Szkocki',
          text: 'Podmorski grzbiet górski (głębokość ok. 800 m) stanowiący barierę, przez którą gęste wody przelewowe kaskadowo spadają w głębię Atlantyku.',
          wiki: 'https://pl.wikipedia.org/wiki/Grzbiet_Grenlandzko-Islandzki',
          wikiLang: 'pl'
        },
        {
          term: 'Efekt pompy ciepła Europy',
          text: 'Zjawisko, w którym Prąd Północnoatlantycki oddaje ~1 petawat ciepła wiatrom zachodnim, sprawiając, że zimy w Europie są o 5–10°C cieplejsze niż na tych samych szerokościach w Ameryce Północnej.',
          wiki: 'https://pl.wikipedia.org/wiki/Klimat_Europy',
          wikiLang: 'pl'
        }
      ]
    },
    {
      title: 'Wskaźniki oceaniczne i klimatyczne',
      terms: [
        {
          term: 'Temperatura powierzchni morza (SST)',
          text: 'Temperatura wierzchniej warstwy wody morskiej, decydująca o parowaniu, oddawaniu ciepła utajonego oraz układach barycznych nad sąsiednimi lądami.',
          wiki: 'https://pl.wikipedia.org/wiki/Temperatura_powierzchni_morza',
          wikiLang: 'pl'
        },
        {
          term: 'Anomalia termiczna',
          text: 'Odchylenie lokalnej temperatury wody od wieloletniej średniej zonalnej dla danej szerokości geograficznej i pory roku.',
          wiki: 'https://pl.wikipedia.org/wiki/Anomalia_temperatury',
          wikiLang: 'pl'
        },
        {
          term: 'Swierdrup (Sv)',
          text: 'Oceanograficzna jednostka wydatku objętościowego równa 1 000 000 m³/s. Golfsztrom transportuje 30 Sv przy Florydzie i ponad 100–150 Sv na otwartym oceanie.',
          wiki: 'https://pl.wikipedia.org/wiki/Swierdrup',
          wikiLang: 'pl'
        }
      ]
    }
  ]
};
