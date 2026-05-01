const fs = require("fs");
const path = require("path");

const ROWS_PER_INSERT = 900;
const migrationPath = path.join(__dirname, "..", "migrations", "0001_zip_code_inserter.sql");

const content = fs.readFileSync(migrationPath, "utf8");
const lines = content.split(/\r?\n/);

// Header: from start through "DROP INDEX IF EXISTS idx_location_areas_bbox;" (line index 63)
// We need to stop before "INSERT OR IGNORE INTO location_areas" for the ZIP section (line 64)
const zipInsertPrefix = "INSERT OR IGNORE INTO location_areas (location_type, code_int, parent_id, name, min_lat, max_lat, min_lng, max_lng, center_lat, center_lng) VALUES";
let headerEnd = -1;
let valueStart = -1;
let valueEnd = -1;
let footerStart = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes("DROP INDEX IF EXISTS idx_location_areas_bbox")) {
    headerEnd = i;
  }
  if (valueStart === -1 && line.includes("INSERT OR IGNORE INTO location_areas") && i > 60) {
    valueStart = i + 1; // first value line is next
    continue;
  }
  if (valueStart !== -1 && valueEnd === -1 && (line === ";" || line === "")) {
    valueEnd = i - 1;
    if (lines[i] === ";") footerStart = i + 1;
    else footerStart = i;
    break;
  }
}

// If we didn't find footer by ";", find CREATE INDEX
if (footerStart === -1) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("CREATE INDEX IF NOT EXISTS idx_location_areas_type_code")) {
      footerStart = i;
      break;
    }
  }
}
if (valueEnd === -1) {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].match(/^\s*\(2,\s*\d+/)) {
      valueEnd = i;
      break;
    }
  }
}

const headerLines = lines.slice(0, headerEnd + 1);
const valueLines = lines.slice(valueStart, valueEnd + 1).map((l) => l.replace(/,\s*$/, ""));
const footerLines = lines.slice(footerStart);

const chunks = [];
for (let i = 0; i < valueLines.length; i += ROWS_PER_INSERT) {
  chunks.push(valueLines.slice(i, i + ROWS_PER_INSERT));
}

const out = [];
out.push(headerLines.join("\n"));
out.push("");

for (let c = 0; c < chunks.length; c++) {
  const chunk = chunks[c];
  out.push(zipInsertPrefix);
  for (let r = 0; r < chunk.length; r++) {
    const suffix = r < chunk.length - 1 ? "," : ";";
    out.push("  " + chunk[r].trim() + suffix);
  }
  out.push("");
}

out.push(footerLines.join("\n"));

fs.writeFileSync(migrationPath, out.join("\n") + "\n", "utf8");
console.log(`Split ${valueLines.length} rows into ${chunks.length} INSERTs of up to ${ROWS_PER_INSERT} rows each.`);
console.log(`Chunk sizes: ${chunks.map((ch) => ch.length).join(", ")}`);
