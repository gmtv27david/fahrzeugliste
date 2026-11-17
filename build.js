// Baut cars.json aus [civ]-Ordner + jg-vehiclestudio index.json
// Aufruf: node build.js
const fs = require('fs');
const path = require('path');

const RES = path.join(__dirname, '..', '..', 'ESXLegacy_A05CA4.base', 'resources');
const CIV = path.join(RES, '[vehicles]', '[civ]');
const STUDIO = path.join(RES, '[scripts]', '[jg]', 'jg-vehiclestudio', 'local_data', 'index.json');

const studio = JSON.parse(fs.readFileSync(STUDIO, 'utf8'));
const studioLower = {};
for (const [k, v] of Object.entries(studio)) studioLower[k.toLowerCase()] = v;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(CIV);
const cars = new Map();
const tag = (block, t) => { const m = block.match(new RegExp(`<${t}>\\s*([^<]*?)\\s*</${t}>`, 'i')); return m ? m[1] : ''; };

// 1) vehicles.meta = Quelle der Wahrheit
for (const f of files.filter(f => /vehicles\.meta$/i.test(f))) {
  const txt = fs.readFileSync(f, 'utf8');
  const rel = path.relative(CIV, f).split(path.sep);
  const category = rel[0].replace(/[\[\]]/g, '');
  const resource = rel.find(p => /^civ_/i.test(p)) || rel[1];
  for (const block of txt.split(/<Item>/i).slice(1)) {
    const model = tag(block, 'modelName');
    if (!model) continue;
    const key = model.toLowerCase();
    if (cars.has(key)) continue;
    cars.set(key, {
      spawn: model,
      name: tag(block, 'gameName'),
      make: tag(block, 'vehicleMakeName'),
      cls: tag(block, 'vehicleClass').replace(/^VC_/, ''),
      type: tag(block, 'type').replace(/^VEHICLE_TYPE_/, ''),
      category,
      resource: resource.replace(/[\[\]]/g, ''),
    });
  }
}

// 2) fahrzeuge.txt = Anzeigename, Preis, Link, ID
for (const f of files.filter(f => /fahrzeuge\.txt$/i.test(f))) {
  const category = path.relative(CIV, f).split(path.sep)[0].replace(/[\[\]]/g, '');
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const parts = line.split('|').map(s => s.trim());
    if (parts.length < 4 || !/^\d+$/.test(parts[0])) continue;
    const [id, brand, modelRaw, spawn, price = ''] = parts;
    const link = (modelRaw.match(/\((https?:[^)]+)\)/) || [])[1] || '';
    const title = modelRaw.replace(/\s*\(https?:[^)]+\)/, '').trim();
    for (const sp of spawn.split(/[,\s/]+/).filter(x => /^[a-z0-9_]+$/i.test(x))) {
      const key = sp.toLowerCase();
      if (!cars.has(key)) continue; // nur echte Fahrzeuge aus vehicles.meta
      Object.assign(cars.get(key), { id: +id, brand, title, link, price });
    }
  }
}

// 3) Bilder aus jg-vehiclestudio
let withImg = 0;
const list = [...cars.values()].map(c => {
  const s = studioLower[c.spawn.toLowerCase()];
  const img = s && s.images && (s.images.default || Object.values(s.images)[0]);
  if (img && img.url) withImg++;
  return {
    id: c.id ?? null,
    spawn: c.spawn,
    brand: c.brand || titleCase(c.make || '') || titleCase((c.resource || '').replace(/^civ_/, '').replace(/_?(boats|sonstige)/g, ' ').trim()) || 'Sonstige',
    title: c.title || c.name || c.spawn,
    price: c.price || '',
    link: c.link || '',
    cls: c.cls || '',
    type: c.type || '',
    category: c.category,
    resource: c.resource,
    img: img ? img.url : '',
    desc: '',
  };
}).sort((a, b) => a.brand.localeCompare(b.brand) || a.title.localeCompare(b.title));

function titleCase(s) { return s.toLowerCase().replace(/\b\w/g, m => m.toUpperCase()); }

// 4) Name sauber trennen: "Name (Jahr)" + Beschreibung
const YEAR = /^(19|20)\d{2}(\s*-\s*(19|20)\d{2})?$/;
function splitTitle(t) {
  let year = '', desc = [];
  let base = t.replace(/\s*\(([^)]*)\)/g, (_, inner) => {
    for (const part of inner.split(',').map(s => s.trim()).filter(Boolean)) {
      if (!year && YEAR.test(part)) year = part.replace(/\s+/g, '');
      else desc.push(part);
    }
    return ' ';
  }).replace(/\s+/g, ' ').trim();
  if (!year) {
    const m = base.match(/^(.*?)\s+((?:19|20)\d{2})(?:\s+(.*))?$/);
    if (m && m[1]) { base = m[1]; year = m[2]; if (m[3]) desc.unshift(m[3]); }
  }
  return { title: year ? `${base} (${year})` : base, desc: desc.join(', ') };
}

const fix = JSON.parse(fs.readFileSync(path.join(__dirname, 'korrekturen.json'), 'utf8'));
const fixLower = {};
for (const [k, v] of Object.entries(fix.fahrzeuge || {})) fixLower[k.toLowerCase()] = v;

for (const c of list) {
  Object.assign(c, splitTitle(c.title));
  const o = fixLower[c.spawn.toLowerCase()];
  if (o) {
    if (o.brand) c.brand = o.brand;
    if (o.title) c.title = o.title;
    if (o.desc !== undefined) c.desc = o.desc;
  }
  c.brand = (fix.marken || {})[c.brand] || c.brand;
}

// 5) Gleiche Namen innerhalb eines Packs durchnummerieren
const groups = {};
for (const c of list) (groups[`${c.brand}|${c.title}|${c.desc}`] = groups[`${c.brand}|${c.title}|${c.desc}`] || []).push(c);
for (const g of Object.values(groups)) if (g.length > 1) g.forEach((c, i) => { if (i > 0) c.desc = [c.desc, `Variante ${i + 1}`].filter(Boolean).join(', '); });

list.sort((a, b) => a.brand.localeCompare(b.brand) || a.title.localeCompare(b.title));

fs.writeFileSync(path.join(__dirname, 'cars.json'), JSON.stringify(list, null, 1));
fs.writeFileSync(path.join(__dirname, 'data.js'), 'window.CARS = ' + JSON.stringify(list) + ';\n');
console.log(`Fahrzeuge: ${list.length}, mit Bild: ${withImg}, ohne Bild: ${list.length - withImg}`);
