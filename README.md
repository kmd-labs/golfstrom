# Golfstrom — 3D Globe & Transatlantic Ocean Simulation

[![Deploy to GitHub Pages](https://github.com/kmd-labs/golfstrom/actions/workflows/deploy.yml/badge.svg)](https://github.com/kmd-labs/golfstrom/actions/workflows/deploy.yml)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-kmd--labs.github.io%2Fgolfstrom-ff6a2e?style=for-the-badge&logo=google-chrome&logoColor=white)](https://kmd-labs.github.io/golfstrom/)
[![Angular](https://img.shields.io/badge/Angular-21-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r187-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

An interactive 3D WebGL climatological and oceanographic simulation visualizing the **Gulf Stream (Golfstrom) & North Atlantic Current system**, transatlantic thermal asymmetry, bathymetry, and seasonal sea temperature anomalies. Built with **Angular 21**, **Three.js**, and modern KMD design system tokens.

🔗 **Explore Live Demo:** [https://kmd-labs.github.io/golfstrom/](https://kmd-labs.github.io/golfstrom/)

---

## 🌍 Key Features

- **Interactive 3D WebGL Globe**:
  - Real-time procedural and observational Sea Surface Temperature (SST) & Thermal Anomaly texture ($720 \times 360$ grid, 259,200 points) powered by NOAA OISST v2.1 AVHRR daily satellite radiometer data.
  - Graded $[-6.0^\circ\text{C}, +6.0^\circ\text{C}]$ thermal anomaly color scheme with clean integer ticks (`-6°C`, `-3°C`, `0°C`, `+3°C`, `+6°C`), preventing summer saturation while reserving intense crimson red for the Gulf Stream core.
  - Natural Earth continent landmask, elevation bump map, and topographic relief overlay.
  - Atmospheric rim glow shader with additive blending and starfield point cloud.
  - Smooth OrbitControls with momentum damping, touch gesture support, and responsive basin framing.

- **Transatlantic Bathymetry & Thermal Cross-Section View**:
  - Complete transatlantic vertical ocean profile ($0$ to $4\,000\text{ m}$ depth) along 5 active latitude transects.
  - Smooth Hermite cubic interpolation through realistic transatlantic bathymetry anchors (continental shelves, Mid-Atlantic Ridge, abyssal plains, and island volcanic bedrock).
  - Dynamically calculated isotherms ($20^\circ\text{C}$, $15^\circ\text{C}$, $10^\circ\text{C}$, $5^\circ\text{C}$) modeling the western boundary "Cold Wall" and deep warm subtropical lens.
  - Upward sensible and latent heat release vectors demonstrating atmospheric warming over Western and Northern Europe.
  - Interactive crosshair measuring depth (m), elevation (m), longitude, and temperature (°C / °F).

- **5 Transatlantic Latitude Comparison Pairs**:
  - **Cape Hatteras** ($35.2^\circ\text{N}$) ↔ **Gibraltar** ($36.1^\circ\text{N}$)
  - **New York** ($40.7^\circ\text{N}$) ↔ **Porto** ($41.1^\circ\text{N}$)
  - **Halifax** ($44.6^\circ\text{N}$) ↔ **Bordeaux** ($44.8^\circ\text{N}$)
  - **St. John's** ($47.6^\circ\text{N}$) ↔ **Brest** ($48.4^\circ\text{N}$)
  - **Iqaluit** ($63.7^\circ\text{N}$) ↔ **Bodø** ($67.3^\circ\text{N}$)
  - Interactive 3D pin selection with live air and sea temperatures, distance, and seasonal contrast metrics.

- **Daily NOAA OISST & Open-Meteo Pipeline**:
  - Rolling 52-week satellite timeline meta and compressed binary grids (`timeline-meta.json`, `timeline-sst.bin.gz`).
  - Daily automated GitHub Action workflow (`update-weather.yml`) fetching the latest sea surface temperatures and Open-Meteo city weather.

- **Simulation & Time Controls**:
  - Continuous 52-week seasonal timeline slider with month ticks and dynamic temperature-gradient rail.
  - Play/pause controls with variable playback speeds (`0.5x`, `1x`, `1.5x`, `2x`).
  - Instant SST vs. Thermal Anomaly view toggle.
  - Fully bilingual internationalization (English & Polish) with zero hardcoded strings and automatic `localStorage` persistence.

---

## 🏗️ Architecture & Component Design

The codebase follows modern Angular standalone component architecture with reactive state management powered by **Angular Signals**:

```
src/
├── styles.scss                   # Global tokens, resets, typography and root overrides
├── index.html                    # HTML entry point configured for GitHub Pages
├── main.ts                       # Application bootstrap
├── design-system/                # Git submodule for KMD Design System (@kmd/design-system)
│   ├── _variables.scss           # Design system tokens (colors, radii, mixins, glass panels)
│   ├── ui/                       # Standalone UI components (button, dropdown, popup, slider)
│   └── services/                 # Core services (BreakpointService, ThemeService)
├── app/
│   ├── app.component.ts|html|scss# Root application shell & three-level bottom dock
│   ├── core/
│   │   ├── constants/
│   │   │   └── golfstrom-data.ts # Latitude pairs, bathymetric transects, and GS spine path
│   │   ├── i18n/
│   │   │   ├── en.ts             # English dictionary
│   │   │   ├── pl.ts             # Polish dictionary
│   │   │   ├── i18n.service.ts   # Reactive I18nService with localStorage persistence
│   │   │   └── i18n.types.ts     # Type-safe Dict interface
│   │   ├── models/
│   │   │   └── golfstrom.model.ts# TypeScript interfaces and domain types
│   │   └── services/
│   │       ├── golfstrom-math.service.ts # LUT generator, spine math, and analytical fallback
│   │       ├── golfstrom-state.service.ts# Centralized reactive state using Angular Signals
│   │       └── sst-data.service.ts       # NOAA OISST binary decoder and zonal mean cache
│   └── components/
│       ├── globe/                # Three.js 3D viewport, shaders, pins, and raycasting
│       ├── cross-section-view/   # High-resolution transatlantic bathymetry & isotherms
│       ├── pair-modal/           # City comparison detail dialog
│       ├── settings-popup/       # Units and projection settings
│       ├── sources-popup/        # Data provenance and scientific references
│       └── glossary/             # Scientific glossary popup
└── assets/
    └── data/
        ├── land-50m.json         # Bundled Natural Earth land topology
        ├── timeline-meta.json    # Weekly keyframes and Open-Meteo city snapshot
        └── timeline-sst.bin.gz   # Packed 0.5° weekly SST binary frames
```

---

## 🎨 Design System & SCSS Tokens

All UI styling follows the **KMD Design System** conventions defined in `src/design-system/_variables.scss`:

- **Single Light Theme:** Clean `neutral-50` (`#f5f7fb`) background with frosted glass panels (`backdrop-filter: blur(14px)`).
- **Unified Typography:** `Inter` font family for all UI elements and Canvas text labels, and `JetBrains Mono` for numeric metrics.
- **Color Scales:**
  - **SST Scale:** Continuous range from `sst-m2` ($-2^\circ\text{C}$) to `sst-35` ($+35^\circ\text{C}$).
  - **Thermal Anomaly Scale:** 7-stop graded palette from `anom-m6` ($-6^\circ\text{C}$, `primary-700`) through `anom-0` ($0^\circ\text{C}$, `neutral-50`) to `anom-p6` ($+6^\circ\text{C}$, `danger-600`), highlighting the Gulf Stream core with `warning-500` (`#d37400`).
- **Responsive Breakpoints:** Mobile (`≤ 640px`), Tablet (`≤ 960px`), and Desktop (`≤ 1280px`).

---

## 🔬 Scientific Foundations

1. **Gulf Stream Trajectory & Meanders**:
   The Gulf Stream spine path is modeled across 13 anchor nodes from the Florida Straits ($-82^\circ\text{W}, 24.5^\circ\text{N}$) past Cape Hatteras detachment ($-75.2^\circ\text{W}, 35.2^\circ\text{N}$), decaying along the North Atlantic Current into the Norwegian Sea ($22^\circ\text{E}, 71.5^\circ\text{N}$). Downstream meanders are evaluated using perpendicular normal displacement:
   $$P(u) = P_0(u) + \mathbf{n}(u) \cdot A_{\text{meander}} \sin\left(\frac{u - 0.25}{0.75} \pi\right)$$

2. **Observational Zonal Anomaly**:
   Thermal anomaly represents departure from the observational zonal ocean mean at latitude $\phi$:
   $$\Delta T(\lambda, \phi, t) = T_{\text{SST}}(\lambda, \phi, t) - \overline{T}_{\text{ocean}}(\phi, t)$$
   Averaged dynamically across real ocean pixels along each latitude row, eliminating hemispheric seasonal distortion.

3. **Subsurface Thermal Structure & Thermocline**:
   Ocean temperatures decline with depth following a double-exponential profile coupled to the western boundary thermocline deepening:
   $$T(z) = T_{\text{abyssal}} + \left(T_{\text{SST}} - T_{\text{abyssal}}\right) \left[0.68 \exp\left(-\frac{z}{z_{\text{th}}}\right) + 0.32 \exp\left(-\frac{z}{1250}\right)\right]$$
   where $z_{\text{th}}$ expands from $240\text{ m}$ in the eastern Atlantic to $580\text{ m}$ in the Gulf Stream core.

---

## 💻 Local Development

### Prerequisites
- Node.js version 20+ (Node 22 LTS recommended)
- npm 10+

### Setup & Run
```bash
# Clone the repository with submodules
git clone --recurse-submodules https://github.com/kmd-labs/golfstrom.git
cd golfstrom

# Install dependencies
npm install

# Start local development server (runs on http://localhost:4200/)
npm start

# Production build
npm run build

# Production build with GitHub Pages base-href
npm run build:gh-pages
```

---

## 🚀 Continuous Deployment (GitHub Actions)

Deployments to GitHub Pages are automated via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

1. **Trigger:** Pushes to `main`, repository dispatch, or manual `workflow_dispatch`.
2. **Build Stage:** Runs on `ubuntu-latest`, compiles the application with `npm run build:gh-pages` (`--base-href /golfstrom/`), and uploads static assets via `actions/upload-pages-artifact@v3`.
3. **Deploy Stage:** Publishes to GitHub Pages with `actions/deploy-pages@v4`.

[`.github/workflows/update-weather.yml`](.github/workflows/update-weather.yml) runs daily at 11:30 UTC. It fetches the latest daily NOAA OISST v2.1 AVHRR satellite dataset and Open-Meteo city weather data, updates `timeline-meta.json` and `timeline-sst.bin.gz`, commits the updated dataset to `main`, and triggers deployment.
