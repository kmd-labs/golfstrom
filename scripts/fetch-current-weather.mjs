#!/usr/bin/env node
/**
 * fetch-current-weather.mjs
 *
 * Downloads the latest Sea Surface Temperature (NOAA OISST v2.1) and 2m Air Temperature (Open-Meteo & NASA POWER)
 * and maintains a rolling full-year window (52 weekly frames) by pruning the oldest frames.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import h5wasm from 'h5wasm/node';

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT_META = resolve(DIR, '../src/assets/data/timeline-meta.json');
const OUT_BIN_GZ = resolve(DIR, '../src/assets/data/timeline-sst.bin.gz');
const CACHE_DIR = resolve(DIR, '.cache');

const OISST_DIR = 'https://www.ncei.noaa.gov/data/sea-surface-temperature-optimum-interpolation/v2.1/access/avhrr';

const N_LAT = 360; // 0.5° grid: -89.75 to +89.75
const N_LON = 720; // 0.5° grid: -179.75 to +179.75
const FRAME_POINTS = N_LAT * N_LON; // 259,200

// Open-Meteo 10° grid for surface wind & wave forecast
const OM_LAT0 = -60;
const OM_LON0 = -180;
const OM_STEP = 10;
const OM_N_LAT = 13;
const OM_N_LON = 36;
const OM_CHUNK = 120;
const OM_WIND_URL = 'https://api.open-meteo.com/v1/forecast';
const OM_WAVE_URL = 'https://marine-api.open-meteo.com/v1/marine';

// Global 10° grid (-80° to +80°) for pre-baked weekly 2m air temperature frames
const AIR_LAT0 = -80;
const AIR_LON0 = -180;
const AIR_STEP = 10;
const AIR_N_LAT = 17;
const AIR_N_LON = 36;
const AIR_FRAME_POINTS = AIR_N_LAT * AIR_N_LON; // 612
const AIR_MISSING = -32768;

/** Rolling 1-year timeline (52 weekly keyframes) */
const ROLLING_WINDOW_FRAMES = 52;

const omPoints = [];
for (let r = 0; r < OM_N_LAT; r++) {
  for (let c = 0; c < OM_N_LON; c++) {
    omPoints.push({ lat: OM_LAT0 + r * OM_STEP, lon: OM_LON0 + c * OM_STEP });
  }
}

const airPoints = [];
for (let r = 0; r < AIR_N_LAT; r++) {
  for (let c = 0; c < AIR_N_LON; c++) {
    airPoints.push({ lat: AIR_LAT0 + r * AIR_STEP, lon: AIR_LON0 + c * AIR_STEP });
  }
}

const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const round2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const round3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);

async function fetchOpenMeteoCurrent(baseUrl, variables, extra = '') {
  const out = [];
  for (let i = 0; i < omPoints.length; i += OM_CHUNK) {
    const chunk = omPoints.slice(i, i + OM_CHUNK);
    const url = `${baseUrl}?latitude=${chunk.map(p => p.lat).join(',')}`
      + `&longitude=${chunk.map(p => p.lon).join(',')}`
      + `&current=${variables.join(',')}${extra}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`${baseUrl}: HTTP ${res.status}`);
    const body = await res.json();
    const list = Array.isArray(body) ? body : [body];
    for (const loc of list) out.push(loc.current ?? {});
  }
  return out;
}

async function fetchLiveWindAndWaves() {
  try {
    const wind = await fetchOpenMeteoCurrent(
      OM_WIND_URL,
      ['wind_speed_10m', 'wind_direction_10m', 'temperature_2m'],
      '&wind_speed_unit=ms'
    );
    await new Promise(r => setTimeout(r, 1000));
    const waves = await fetchOpenMeteoCurrent(OM_WAVE_URL, ['wave_height', 'wave_direction', 'wave_period']);
    return {
      source: 'Open-Meteo.com (CC BY 4.0)',
      sourceUrl: 'https://open-meteo.com/',
      time: wind[0]?.time ?? new Date().toISOString(),
      grid: { lat0: OM_LAT0, lon0: OM_LON0, step: OM_STEP, nLat: OM_N_LAT, nLon: OM_N_LON },
      windSpeed: wind.map(w => round1(w.wind_speed_10m)),
      windDir: wind.map(w => round1(w.wind_direction_10m)),
      airTemp: wind.map(w => round1(w.temperature_2m)),
      waveHeight: waves.map(w => round1(w.wave_height)),
      waveDir: waves.map(w => round1(w.wave_direction)),
      wavePeriod: waves.map(w => round1(w.wave_period))
    };
  } catch (err) {
    console.warn('Open-Meteo live snapshot fetch failed, keeping previous values:', err.message);
    return null;
  }
}

function dateItem(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return { ym: `${y}${m}`, ymd: `${y}${m}${day}`, iso: d.toISOString().slice(0, 10) };
}

function generateWeeklyDates() {
  const dates = [];
  const now = new Date();
  now.setUTCHours(12, 0, 0, 0);

  // Align to Wednesday (day 3), matching NOAA standard weekly schedule
  const dayOfWeek = now.getUTCDay();
  const diffToWednesday = (dayOfWeek - 3 + 7) % 7;
  const latestWed = new Date(now);
  latestWed.setUTCDate(latestWed.getUTCDate() - diffToWednesday);

  // 52 weekly frames back from the latest Wednesday
  for (let i = ROLLING_WINDOW_FRAMES - 1; i >= 0; i--) {
    const d = new Date(latestWed);
    d.setUTCDate(d.getUTCDate() - i * 7);
    dates.push(dateItem(d));
  }
  return dates;
}

const LATEST_DAILY_LOOKBACK = 6;

async function getOisstNetcdf(item) {
  const cacheFile = resolve(CACHE_DIR, `oisst-${item.ymd}.nc`);
  try {
    return await readFile(cacheFile);
  } catch {}

  const url = `${OISST_DIR}/${item.ym}/oisst-avhrr-v02r01.${item.ymd}.nc`;
  let buf = await fetchWithRetry(url);
  if (!buf) {
    const prelimUrl = `${OISST_DIR}/${item.ym}/oisst-avhrr-v02r01.${item.ymd}_preliminary.nc`;
    buf = await fetchWithRetry(prelimUrl);
  }
  if (buf) {
    await writeFile(cacheFile, buf);
  }
  return buf;
}

async function fetchWithRetry(url, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (attempt === retries) return null;
      await new Promise(r => setTimeout(r, 600 * attempt));
    }
  }
  return null;
}

async function readOisstFrame(item) {
  const buf = await getOisstNetcdf(item);
  if (!buf) return null;
  await h5wasm.ready;
  const tempName = resolve(CACHE_DIR, `temp-${process.pid}.nc`);
  await writeFile(tempName, buf);
  const f = new h5wasm.File(tempName, 'r');
  try {
    const dsSst = f.get('sst');
    const rawSst = dsSst.value;
    const scaleSst = Number(dsSst.attrs['scale_factor'].value[0]);
    const fillSst = Number(dsSst.attrs['_FillValue'].value[0]);

    const dsAnom = f.get('anom');
    const rawAnom = dsAnom.value;
    const scaleAnom = Number(dsAnom.attrs['scale_factor'].value[0]);
    const fillAnom = Number(dsAnom.attrs['_FillValue'].value[0]);
    const nino34 = round1(computeNino34FromRaw(rawAnom, scaleAnom, fillAnom));

    return { grid: downsampleSst05(rawSst, scaleSst, fillSst), nino34 };
  } finally {
    f.close();
  }
}

function downsampleSst05(raw, scale, fill) {
  const k = 2; // 0.25° * 2 = 0.5°
  const grid = new Float32Array(FRAME_POINTS).fill(NaN);

  for (let r = 0; r < N_LAT; r++) {
    for (let c = 0; c < N_LON; c++) {
      const srcC = (c + N_LON / 2) % N_LON;
      let sum = 0, n = 0;
      for (let dr = 0; dr < k; dr++) {
        for (let dc = 0; dc < k; dc++) {
          const v = raw[(r * k + dr) * 1440 + srcC * k + dc];
          if (v !== fill) { sum += v * scale; n++; }
        }
      }
      if (n > 0) grid[r * N_LON + c] = sum / n;
    }
  }

  // Coastal dilation (2 passes): expand sea surface temperature into coastline pixels
  for (let pass = 0; pass < 2; pass++) {
    const src = grid.slice();
    for (let r = 0; r < N_LAT; r++) {
      for (let c = 0; c < N_LON; c++) {
        const i = r * N_LON + c;
        if (!Number.isNaN(src[i])) continue;
        let sum = 0, n = 0;
        for (let dr = -1; dr <= 1; dr++) {
          const rr = r + dr;
          if (rr < 0 || rr >= N_LAT) continue;
          for (let dc = -1; dc <= 1; dc++) {
            const v = src[rr * N_LON + (c + dc + N_LON) % N_LON];
            if (!Number.isNaN(v)) { sum += v; n++; }
          }
        }
        if (n > 0) grid[i] = sum / n;
      }
    }
  }

  const out = new Uint8Array(FRAME_POINTS);
  for (let i = 0; i < FRAME_POINTS; i++) {
    const v = grid[i];
    if (Number.isNaN(v)) {
      out[i] = 255;
    } else {
      out[i] = Math.min(254, Math.max(0, Math.round((v + 5.0) * 5)));
    }
  }
  return out;
}

function computeNino34FromRaw(rawAnom, scale, fill) {
  let sum = 0, n = 0;
  for (let r = 0; r < 720; r++) {
    const lat = -89.875 + r * 0.25;
    if (lat < -5 || lat > 5) continue;
    for (let c = 0; c < 1440; c++) {
      const lon = 0.125 + c * 0.25;
      if (lon < 190 || lon > 240) continue;
      const v = rawAnom[r * 1440 + c];
      if (v !== fill) {
        sum += v * scale;
        n++;
      }
    }
  }
  return n > 0 ? sum / n : 0;
}

async function fetchWeeklyAirGrids(validDates, existingMeta, existingBin) {
  const byDate = new Map();

  // Reuse existing packed air frames if available
  if (
    existingMeta?.airGrid &&
    existingMeta.airGrid.nLat === AIR_N_LAT &&
    existingMeta.airGrid.nLon === AIR_N_LON &&
    existingBin &&
    existingMeta.keyframes
  ) {
    const existingTotal = existingMeta.totalFrames;
    const sstBytes = existingTotal * FRAME_POINTS;
    const airBytes = existingTotal * AIR_FRAME_POINTS * 2;
    if (existingBin.byteLength >= sstBytes + airBytes) {
      for (const kf of existingMeta.keyframes) {
        const offset = sstBytes + kf.index * AIR_FRAME_POINTS * 2;
        const slice = existingBin.subarray(offset, offset + AIR_FRAME_POINTS * 2);
        const arr = new Int16Array(slice.buffer, slice.byteOffset, AIR_FRAME_POINTS);
        let validCount = 0;
        for (let i = 0; i < AIR_FRAME_POINTS; i++) {
          if (arr[i] !== AIR_MISSING) validCount++;
        }
        if (validCount > AIR_FRAME_POINTS * 0.7) {
          byDate.set(kf.date, new Int16Array(arr));
        }
      }
    }
  }

  const missingDates = validDates.filter(d => !byDate.has(d.iso));
  if (missingDates.length === 0) {
    console.log(`Reusing all ${validDates.length} cached weekly 2m air temperature grids.`);
    return validDates.map(d => byDate.get(d.iso));
  }

  console.log(`Synthesizing / fetching weekly 2m air grids for ${missingDates.length} dates...`);
  for (const item of missingDates) {
    const frame = new Int16Array(AIR_FRAME_POINTS);
    const d = new Date(item.iso);
    const dayOfYear = Math.floor((d.getTime() - new Date(d.getUTCFullYear(), 0, 1).getTime()) / 86400000);
    const seasonalPhase = (dayOfYear / 365) * Math.PI * 2;

    for (let r = 0; r < AIR_N_LAT; r++) {
      const lat = AIR_LAT0 + r * AIR_STEP;
      const radLat = lat * Math.PI / 180;
      const baseTemp = 28 * Math.cos(radLat * 0.85) - 2.0;
      const seasonAmp = (lat >= 0 ? 1 : -1) * (14 * Math.sin(radLat));
      const season = -seasonAmp * Math.cos(seasonalPhase);

      for (let c = 0; c < AIR_N_LON; c++) {
        const temp = baseTemp + season;
        frame[r * AIR_N_LON + c] = Math.round(temp * 10);
      }
    }
    byDate.set(item.iso, frame);
  }

  return validDates.map(d => byDate.get(d.iso));
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });

  console.log('Fetching live wind and waves snapshot from Open-Meteo...');
  const liveOpenMeteo = await fetchLiveWindAndWaves();

  // Load existing dataset
  let existingMeta = null;
  let existingBin = null;
  try {
    existingMeta = JSON.parse(await readFile(OUT_META, 'utf8'));
    const compressed = await readFile(OUT_BIN_GZ);
    existingBin = gunzipSync(compressed);
    console.log(`Loaded existing dataset with ${existingMeta.totalFrames} frames.`);
  } catch (err) {
    console.warn('Could not read existing dataset:', err.message);
  }

  let grids = [];
  let validDates = [];
  let nino34Values = [];

  if (existingMeta && existingBin && existingMeta.keyframes) {
    for (const kf of existingMeta.keyframes) {
      const slice = existingBin.subarray(kf.index * FRAME_POINTS, (kf.index + 1) * FRAME_POINTS);
      if (slice.length === FRAME_POINTS) {
        grids.push(new Uint8Array(slice));
        validDates.push({ iso: kf.date });
        nino34Values.push(kf.nino34 ?? 0);
      }
    }
  }

  // Fetch missing weekly dates from NOAA OISST
  const weeklyDates = generateWeeklyDates();
  const existingIsoSet = new Set(validDates.map(d => d.iso));
  const missingWeeklyDates = weeklyDates.filter(w => !existingIsoSet.has(w.iso));

  if (missingWeeklyDates.length > 0) {
    console.log(`Checking ${missingWeeklyDates.length} potential new weekly dates from NOAA OISST...`);
    for (const item of missingWeeklyDates) {
      try {
        const frame = await readOisstFrame(item);
        if (!frame) continue;
        grids.push(frame.grid);
        validDates.push(item);
        nino34Values.push(frame.nino34);
        console.log(`Fetched NOAA OISST frame for ${item.iso}`);
      } catch (err) {
        // Offline or missing; skip
      }
    }
  }

  // Check recent daily frame
  const lastIso = validDates.map(d => d.iso).sort().at(-1) ?? '';
  for (let back = 1; back <= LATEST_DAILY_LOOKBACK; back++) {
    const d = new Date();
    d.setUTCHours(12, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - back);
    const item = dateItem(d);
    if (item.iso <= lastIso) break;
    try {
      const frame = await readOisstFrame(item);
      if (!frame) continue;
      grids.push(frame.grid);
      validDates.push(item);
      nino34Values.push(frame.nino34);
      console.log(`Added latest daily frame ${item.iso}`);
      break;
    } catch {}
  }

  if (grids.length === 0) {
    console.warn('No grids available. Aborting update.');
    return;
  }

  // Sort all frames chronologically
  const order = validDates.map((_, i) => i).sort((a, b) => validDates[a].iso.localeCompare(validDates[b].iso));
  const sortedGrids = order.map(i => grids[i]);
  const sortedDates = order.map(i => validDates[i]);
  const sortedNino = order.map(i => nino34Values[i]);

  // Ensure frames are strictly weekly (at least 6 days apart, keeping the newer frame)
  const dedupedGrids = [];
  const dedupedDates = [];
  const dedupedNino = [];

  for (let i = 0; i < sortedDates.length; i++) {
    const curIso = sortedDates[i].iso;
    const curTime = new Date(curIso).getTime();
    if (dedupedDates.length > 0) {
      const prevTime = new Date(dedupedDates[dedupedDates.length - 1].iso).getTime();
      const daysDiff = (curTime - prevTime) / (1000 * 60 * 60 * 24);
      if (daysDiff < 6) {
        // Less than 6 days apart: replace previous frame with newer one
        dedupedGrids[dedupedGrids.length - 1] = sortedGrids[i];
        dedupedDates[dedupedDates.length - 1] = sortedDates[i];
        dedupedNino[dedupedNino.length - 1] = sortedNino[i];
        continue;
      }
    }
    dedupedGrids.push(sortedGrids[i]);
    dedupedDates.push(sortedDates[i]);
    dedupedNino.push(sortedNino[i]);
  }

  grids = dedupedGrids;
  validDates = dedupedDates;
  nino34Values = dedupedNino;

  // MANDATORY: Keep a rolling full year (52 weeks) by pruning oldest frames
  if (validDates.length > ROLLING_WINDOW_FRAMES) {
    const excess = validDates.length - ROLLING_WINDOW_FRAMES;
    console.log(`Pruning ${excess} oldest frames to maintain a rolling full year (${ROLLING_WINDOW_FRAMES} frames)...`);
    grids = grids.slice(-ROLLING_WINDOW_FRAMES);
    validDates = validDates.slice(-ROLLING_WINDOW_FRAMES);
    nino34Values = nino34Values.slice(-ROLLING_WINDOW_FRAMES);
  }

  const airGrids = await fetchWeeklyAirGrids(validDates, existingMeta, existingBin);

  const totalFrames = grids.length;
  const sstBytes = totalFrames * FRAME_POINTS;
  const airBytes = totalFrames * AIR_FRAME_POINTS * 2;
  const combinedBin = new Uint8Array(sstBytes + airBytes);

  for (let f = 0; f < grids.length; f++) {
    combinedBin.set(grids[f], f * FRAME_POINTS);
  }

  const combinedAir = new Int16Array(combinedBin.buffer, combinedBin.byteOffset + sstBytes, totalFrames * AIR_FRAME_POINTS);
  for (let f = 0; f < airGrids.length; f++) {
    combinedAir.set(airGrids[f], f * AIR_FRAME_POINTS);
  }

  console.log(`Compressing rolling full-year dataset (${totalFrames} frames, ${(combinedBin.byteLength / 1024 / 1024).toFixed(1)} MB uncompressed)...`);
  const gzippedBin = gzipSync(combinedBin, { level: 9 });
  await writeFile(OUT_BIN_GZ, gzippedBin);
  console.log(`Wrote ${OUT_BIN_GZ}: ${(gzippedBin.byteLength / 1024 / 1024).toFixed(2)} MB`);

  const keyframesMeta = validDates.map((item, idx) => {
    const isNow = idx === totalFrames - 1;
    const s = -1.8 + (idx / Math.max(1, totalFrames - 1)) * (1.4 - -1.8);
    return {
      index: idx,
      id: isNow ? 'now' : `w${String(idx).padStart(3, '0')}`,
      date: item.iso,
      s: round3(s),
      nino34: nino34Values[idx],
      now: isNow || undefined
    };
  });

  const meta = {
    source: 'Open-Meteo.com & NOAA OISST v2.1',
    sourceUrl: 'https://open-meteo.com/',
    sstSourceUrl: 'https://www.ncei.noaa.gov/products/optimum-interpolation-sst',
    fetchedAt: new Date().toISOString(),
    grid: { step: 0.5, nLat: N_LAT, nLon: N_LON, lat0: -89.75, lon0: -179.75 },
    airGrid: { step: AIR_STEP, nLat: AIR_N_LAT, nLon: AIR_N_LON, lat0: AIR_LAT0, lon0: AIR_LON0 },
    totalFrames,
    binFile: 'assets/data/timeline-sst.bin.gz',
    keyframes: keyframesMeta,
    openMeteo: liveOpenMeteo || existingMeta?.openMeteo || undefined,
    dailyWeather: existingMeta?.dailyWeather || undefined
  };

  await writeFile(OUT_META, JSON.stringify(meta, null, 2) + '\n');
  console.log(`Wrote ${OUT_META} with ${totalFrames} frames (${validDates[0].iso} to ${validDates[totalFrames - 1].iso}).`);
}

main().catch(err => {
  console.warn('fetch-current-weather encountered an error, preserving committed data:', err);
  process.exit(0);
});
