/**
 * Reads 0001_zip_code_inserter.sql and replaces 'ZIP nnnnn' with city/town name from zipcodes package.
 * Run: node scripts/update-zip-names-in-migration.js
 * Requires: pnpm add -D zipcodes
 */
const fs = require('fs');
const path = require('path');

const zipcodes = require('zipcodes');
const migrationPath = path.join(__dirname, '..', 'migrations', '0001_zip_code_inserter.sql');

const content = fs.readFileSync(migrationPath, 'utf8');

// Replace every , 'ZIP nnnnn', with , 'CityName', using zipcodes lookup
const newContent = content.replace(/, 'ZIP (\d+)',/g, (_, zip) => {
  const rec = zipcodes.lookup(zip);
  const name = (rec && rec.city) ? rec.city.replace(/'/g, "''") : `ZIP ${zip}`;
  return `, '${name}',`;
});

fs.writeFileSync(migrationPath, newContent, 'utf8');
console.log('Updated ZIP names in 0001_zip_code_inserter.sql');
