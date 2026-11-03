# Golfstrom — Performance, UI & Thermal Cross-Section Plan

This plan covers all requested fixes and architectural changes in minimal, targeted steps aligned with `kmd-labs/el-nino` and `AGENTS.md`.

---

## 1. Fix Map Lag During Playback & Orbiting

### Root Causes vs. `el-nino`
1. **Angular Zone Churn (`60 Hz` Change Detection):**
   - `GlobeComponent.animate()` runs inside `runOutsideAngular`, but calls `this.state.advanceTime(dt)` on every animation frame, mutating the `month` signal 60 times/sec and triggering Angular template re-renders (`app.component.html`, `globe.component.html`).
   - Additionally, `GlobeComponent.updatePins()` mutates template-bound `pin.screenX`, `pin.screenY`, `pin.visible`, and `pin.opacity` on every frame instead of applying direct DOM `style.transform` updates outside Angular when the camera actually moves.
2. **Heavy Per-Pixel Land Bilinear Interpolation in `recolorSstTexture`:**
   - While `el-nino` runs a flat loop over `259,200` pixels with a single byte lookup (`va + (vb - va) * t`), `golfstrom` performs 2D bilinear interpolation of the ERA5 air temperature grid (`Math.floor`, modulo, 8 array lookups, and 7 lerps) for every land pixel ~10 times/sec inside an Angular `effect()`.

### Fix
- **Decouple Texture & DOM Updates from Angular Change Detection:**
  - Trigger `recolorSstTexture()` directly inside the `animate()` loop only when `Math.abs(month - this.lastRecolorMonth) > 0.08` (~6–8 updates/sec) or when `sstMode` changes, matching `el-nino`'s `Math.abs(s - this.lastS) > 0.012` pattern.
  - Throttle the `month` signal write for UI slider/month display or keep `month` updated smoothly while updating pin label DOM nodes via `@ViewChildren` direct `el.style.transform = translate3d(...)` only when `camera.position.distanceToSquared(lastCamPos) > 1e-5` (exact `el-nino` pattern).
- **Precompute Land Grid Lookup Tables Once on Startup:**
  - Precompute `r0, r1, tr` (per latitude row `0..359`) and `c0, c1, tc, isLandPixel` (per longitude col `0..719`) once when `SstDataService` finishes loading.
  - Inside `recolorSstTexture`, pre-interpolate the small `17 × 36` (`612`-point) ERA5 air frame once per `recolorSstTexture` call, turning the `259,200`-pixel loop into a fast flat array lookup with zero `Math.floor` or modulo operations per pixel.

---

## 2. Fix the "2nd Grey Sphere Behind the Globe" (Atmosphere Halo & Bokeh)

### Root Cause
- `GlobeComponent.initAtmosphericGlow()` uses `R * 1.12` with `rim = 1.0 - max(0.0, dot(n, v))` on a `THREE.BackSide` sphere. Because `dot(n, v)` is negative on a `BackSide` mesh, `max(0.0, dot(n, v))` clamps the entire rear hemisphere to `0.0`, making `rim = 1.0` Everywhere behind the globe and painting a solid translucent grey disc (`uOpacity = 0.18`) behind the planet.

### Fix (Ported from `el-nino`'s `initGlowAndBokeh()`)
- Replace `initAtmosphericGlow()` with `el-nino`'s exact limb-normalized `BackSide` shader on `SphereGeometry(R * 1.15, 64, 32)`:
  ```glsl
  float d = clamp(-dot(vN, vV), 0.0, 1.0);
  float t = clamp(d / 0.4938, 0.0, 1.0);
  float a = pow(t, uPower) * uOpacity;
  gl_FragColor = vec4(c, a);
  ```
  At the globe's limb (`r = R`), `-dot(vN, vV) = 0.4938`, so the shadow peaks right at the edge of the planet and fades smoothly to `0` at the outer rim of the `1.15R` sphere—eliminating the flat grey sphere behind the globe.
- Also port `initBokeh()` from `el-nino` so the background matches `el-nino`.

---

## 3. Default to Anomaly View, Always-On City Pairs & Land Temp, Delete Current Flow

### State & Code Deletions (`golfstrom-state.service.ts`, `globe.component.ts`, `app.component.*`, `i18n/*`)
1. **Default to Thermal Anomaly:**
   - Set `readonly sstMode = signal<SstMode>('anomaly')` as the initial default in `GolfstromStateService`.
2. **Always-On City Pairs & Land Temperature:**
   - Remove `showPins`, `togglePins()`, `showLandTemp`, and `toggleLandTemp()` from `GolfstromStateService`.
   - Remove the City Pairs toggle button and Land Temp toggle button from the bottom dock.
   - Always render city pair pins/labels on the globe and always render ERA5 land temperature in `recolorSstTexture()` and `drawLand()`.
3. **Delete Current Flow (`streamlines`) & Associated Code:**
   - Delete `showStreamlines` and `toggleStreamlines()` from `GolfstromStateService`.
   - Delete `StreamParticle` interface, `streamPoints`, `streamGeo`, `particles`, `particlePositions`, `particleColors`, `initStreamlines()`, and `updateStreamlines()` from `GlobeComponent`.
   - Delete `samplePath()` from `GolfstromMathService` (and unused `Waves` / `MapPin` / `ThermometerSun` icons and i18n keys).

---

## 4. Timeline & Playback Component Matching `el-nino` (Months at the Top)

### Design Alignment (`app.component.html`, `app.component.scss`, `app.component.ts`)
- Restructure `.dock` to match `el-nino`'s `map-dock` layout and show it on **both** the Globe view and the Cross-Section view:
  - **Top Row (`.dock__top`):**
    - Left (`.dock__status-group`): Current month pill/badge and active city-pair or mode status.
    - Right (`.dock__readout-group`): Compact temperature scale legend (`-3°C` to `+3°C` anomaly / `-20°C` to `35°C` SST), SST/Anomaly mode toggle button, and Glossary icon button (`app-button` with `bookOpenIcon`).
  - **Timeline Row (`.dock__row`):**
    - `app-timeline-slider` (`[min]="0"`, `[max]="12"`, `[step]="0.02"`) with **12 month markers (`Jan`–`Dec`) along the top** of the playback component (or clickable month labels at the top of the slider track) instead of the 4 seasonal text buttons, plus playback speed dropdown (`0.5x`, `1x`, `1.5x`, `2x`) and Play/Pause button in `[timelineAction]`.
    - Delete `SEASON_PRESETS` from `golfstrom-data.ts`.

---

## 5. Replace AMOC View with Thermal Cross-Section Between City Pairs

### Delete AMOC View
- Delete `src/app/components/amoc-view/` (`amoc-view.component.{ts,html,scss}`) and remove all AMOC step strings from `i18n`.

### New Component: `src/app/components/cross-section-view/` (`app-cross-section-view`)
- Update `ViewMode` in `golfstrom.model.ts` to `'globe' | 'cross-section'`.
- Adapted from `el-nino`'s `walker-view` 2D `<canvas>` cross-section renderer, slicing west-to-east across the North Atlantic between a selected **City Pair** (`LATITUDE_PAIRS`: e.g., **New York ↔ Porto (41°N)**, **St. John's ↔ Brest (48°N)**, **Baffin Island ↔ Bodø (67°N)**, or **Cape Hatteras ↔ Gulf Stream Core (35°N)**):
  1. **Top Floating Header Bar (`.cross-section__bar.glass-panel`):**
     - Selector pills/buttons to switch between the city pairs (defaulting to **New York ↔ Porto** or whichever pair the user clicked on the globe).
     - Live readout of West City temp, **Gulf Stream Peak** temp, and East City temp for the current timeline month.
  2. **Cross-Section Canvas Rendering (Driven by `state.month()` and `state.sstMode()`):**
     - **Atmospheric Band (Top 55% of canvas):**
       - Displays the **Air & Surface Temperature Curve** across the Atlantic from the West Coast city to the East Coast city, showing the sharp **Gulf Stream thermal peak** in the middle/western basin and the warmer eastern coastal air over Europe.
       - Rising warm heat plumes above the Gulf Stream core and prevailing westerly wind arrows carrying that heat toward the European coast.
       - **Floating Callout Card / Badge on the Peak:** A small info window/card anchored to the thermal peak describing the **Golfstrom / North Atlantic Current** core (temperature, anomaly boost, and heat release), plus callout badges for the ocean basin, islands, and coastal cities.
     - **Ocean & Bathymetry Cross-Section (Bottom 45% of canvas, `0–4000m`):**
       - Realistically colored thermal ocean cross-section sampled along the pair's latitude across the 12-month timeline (`sstData` + depth thermocline decay), clearly showing the deep warm Gulf Stream core in the upper `0–800m`.
       - **Continental Shelves, Mid-Atlantic Ridge & Islands Profile:** Draws the western continental shelf (North America / Grand Banks), abyssal plain, **Mid-Atlantic Ridge / Azores / Iceland / Rockall islands** rising toward the surface, and the eastern European shelf (Porto / Brest / Bodø).
  3. **Shared Bottom Playback Dock:**
     - The bottom dock (with months at the top of the timeline slider and Play/Pause button) remains visible and active on the Cross-Section view so scrubbing or playing the timeline animates the thermal cross-section, peak window values, and ocean temperatures in real time.

---

## 6. Verification
1. Run `npm run build` and verify zero TypeScript, Angular template, or SCSS budget warnings/errors.
2. Verify smooth `60fps` globe orbiting while the timeline is playing.
3. Verify bilingual (`EN` / `PL`) completeness across all new cross-section labels, month markers, and callout windows.
