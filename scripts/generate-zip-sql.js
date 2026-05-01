/**
 * Generates SQL INSERT statements for all US ZIP codes.
 * Run: node scripts/generate-zip-sql.js
 * Requires: pnpm add -D zipcodes
 *
 * State order in location_areas: AL, AK, AZ, AR, CA, CO, CT, DE, DC, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY
 * So parent_id: AL=2, AK=3, ..., WY=52
 */
const stateToParentId = {
  AL: 2, AK: 3, AZ: 4, AR: 5, CA: 6, CO: 7, CT: 8, DE: 9, DC: 10,
  FL: 11, GA: 12, HI: 13, ID: 14, IL: 15, IN: 16, IA: 17, KS: 18, KY: 19,
  LA: 20, ME: 21, MD: 22, MA: 23, MI: 24, MN: 25, MS: 26, MO: 27, MT: 28,
  NE: 29, NV: 30, NH: 31, NJ: 32, NM: 33, NY: 34, NC: 35, ND: 36,
  OH: 37, OK: 38, OR: 39, PA: 40, RI: 41, SC: 42, SD: 43, TN: 44,
  TX: 45, UT: 46, VT: 47, VA: 48, WA: 49, WV: 50, WI: 51, WY: 52
};

const zipcodes = require('zipcodes');
const codes = zipcodes.codes || {};

const DELTA = 0.05; // bbox half-width in degrees

function row(zipStr, parentId, lat, lng, name) {
  const codeInt = parseInt(zipStr, 10);
  const min_lat = (lat - DELTA).toFixed(2);
  const max_lat = (lat + DELTA).toFixed(2);
  const min_lng = (lng - DELTA).toFixed(2);
  const max_lng = (lng + DELTA).toFixed(2);
  const center_lat = lat.toFixed(2);
  const center_lng = lng.toFixed(2);
  const nameEsc = name.replace(/'/g, "''");
  return `  (2, ${codeInt}, ${parentId}, '${nameEsc}', ${min_lat}, ${max_lat}, ${min_lng}, ${max_lng}, ${center_lat}, ${center_lng})`;
}

const lines = [];
for (const zipStr of Object.keys(codes)) {
  const rec = codes[zipStr];
  if (!rec || rec.country !== 'US') continue;
  const state = rec.state;
  const parentId = stateToParentId[state];
  if (parentId == null) continue;
  const lat = rec.latitude;
  const lng = rec.longitude;
  const name = (rec.city ? `${rec.city} ${zipStr}` : `ZIP ${zipStr}`).trim();
  lines.push(row(zipStr, parentId, lat, lng, name));
}

console.log('-- Local (ZIP): code_int = 5-digit zip. parent_id = state row id (2=AL, 3=AK, ..., 52=WY).');
console.log('INSERT OR IGNORE INTO location_areas (location_type, code_int, parent_id, name, min_lat, max_lat, min_lng, max_lng, center_lat, center_lng) VALUES');
console.log(lines.join(',\n') + ';');
