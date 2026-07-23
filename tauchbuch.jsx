const { useState, useEffect, useRef, useCallback, useMemo } = React;

const APP_VERSION = "0.2.0";

// ── CSV Parsing (Divers Log / Logbuch Export) ───────────────────────────────
// Column layout of the export (0-indexed):
// 0 Nr. | 1 Datum | 2 Zeit | 3 Nr.(dup) | 4 Datum(dup) | 5 x | 6 Jahr |
// 7 Ort(dup) | 8 Land | 9 Ort | 10 TG-Nr. | 11 Tauchspot | 12 Dauer |
// 13 max. Tiefe | 14 Wassertemp | 15 Anzug | 16 Blei | 17 Alu/Stahl |
// 18 Vol. | 19 Nitrox | 20 Buddy | 21 Bemerkungen | 22 Nr.(dup) | 23 Datum(dup)
// Summary/placeholder rows ("Neu", totals) have no Datum and are skipped.
function splitCsvLine(line) {
  const cols = []; let cur = "", inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === "," && !inQ) { cols.push(cur); cur = ""; }
    else cur += ch;
  }
  cols.push(cur);
  return cols;
}

function parseDateToTs(d) {
  if (!d) return 0;
  const m = String(d).match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (!m) return 0;
  let [_, dd, mm, yy] = m;
  yy = yy.length === 2 ? (+yy >= 30 ? "19" + yy : "20" + yy) : yy;
  return new Date(+yy, +mm - 1, +dd).getTime();
}

function parseDurationToMin(s) {
  if (!s) return 0;
  const hm = String(s).match(/(\d+)\s*h\s*(\d+)\s*m/i);
  if (hm) return (+hm[1]) * 60 + (+hm[2]);
  const m = String(s).match(/(\d+)\s*m/i);
  if (m) return +m[1];
  const plain = String(s).match(/^\d+$/);
  if (plain) return +s;
  return 0;
}

// Alte Exporte/Einträge nutzten "Ja"/"Nein"; das Feld heisst inzwischen
// Air/Nitrox — hier werden bestehende Werte beim Import/Laden mitgezogen.
function normalizeNitroxValue(v) {
  if (v === "Ja") return "Nitrox";
  if (v === "Nein") return "Air";
  return v;
}

function fmtDuration(min) {
  if (!min) return "—";
  if (min >= 60) return `${Math.floor(min/60)}h ${String(min%60).padStart(2,"0")}m`;
  return `${min} min`;
}

function parseDiveCsv(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim().length);
  const dives = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const clean = s => (s || "").trim();
    const nr = clean(cols[0]);
    const datum = clean(cols[1]);
    if (!nr || !/^\d+$/.test(nr) || !datum) continue; // skip placeholder/summary rows
    const numOrNull = s => {
      const v = clean(s).replace("°", "").replace(",", ".");
      if (!v || v === "—" || v === "-") return null;
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    };
    const durationStr = clean(cols[12]);
    const dive = {
      id: `dive_${nr}`,
      name: nr,
      date: datum,
      time: clean(cols[2]),
      land: clean(cols[8]) || clean(cols[7]),
      ort: clean(cols[9]) || clean(cols[7]),
      tgNr: clean(cols[10]),
      tauchspot: clean(cols[11]),
      durationStr,
      durationMin: parseDurationToMin(durationStr),
      maxDepth: numOrNull(cols[13]),
      waterTemp: numOrNull(cols[14]),
      anzug: clean(cols[15]),
      blei: clean(cols[16]),
      flasche: clean(cols[17]),
      volumen: clean(cols[18]),
      nitrox: normalizeNitroxValue(clean(cols[19])),
      buddy: clean(cols[20]),
      bemerkungen: clean(cols[21]),
      rating: 0,
      customFields: { reise: "" },
    };
    const ts = parseDateToTs(dive.date);
    dive.year = ts ? String(new Date(ts).getFullYear()) : "";
    dives.push(dive);
  }
  return dives;
}

function sortByNumber(dives) {
  return [...dives].sort((a, b) => (parseInt(b.name || "0", 10)) - (parseInt(a.name || "0", 10)));
}

// Reise-Nummer je Tauchgang: Reisen chronologisch durchnummeriert (älteste=1,
// neuste=höchste Zahl — konsistent mit der Kartennummerierung auf der
// Reisen-Seite). Kombiniert mit dem TG-Nr.-Feld ergibt sich z.B. "31/2".
function computeReiseNumbers(dives) {
  const groups = new Map();
  dives.forEach(d => {
    const name = d.customFields?.reise;
    if (!name) return;
    const ts = parseDateToTs(d.date);
    const cur = groups.get(name) || 0;
    if (ts > cur) groups.set(name, ts);
  });
  const ordered = [...groups.entries()].sort((a, b) => a[1] - b[1]);
  const numberMap = new Map();
  ordered.forEach(([name], idx) => numberMap.set(name, idx + 1));
  return numberMap;
}

function reiseTgBadge(d, reiseNumbers) {
  const reise = d.customFields?.reise;
  if (!reise) return null;
  const reiseNr = reiseNumbers.get(reise);
  if (!reiseNr) return null;
  return `${reiseNr}/${d.tgNr || "?"}`;
}

// ── Field engine (used by search, sort and the editable tiles) ─────────────
function diveFieldValue(d, id) {
  const cf = d.customFields || {};
  switch (id) {
    case "number": return parseInt(d.name || "0", 10);
    case "date": return parseDateToTs(d.date);
    case "time": return d.time || "";
    case "land": return d.land || "";
    case "ort": return d.ort || "";
    case "tauchspot": return d.tauchspot || "";
    case "tgNr": return parseInt(d.tgNr || "0", 10) || 0;
    case "duration": return d.durationMin || 0;
    case "depth": return d.maxDepth != null ? d.maxDepth : -1;
    case "temp": return d.waterTemp != null ? d.waterTemp : -999;
    case "anzug": return d.anzug || "";
    case "blei": return parseFloat(String(d.blei).replace(",", ".")) || 0;
    case "flasche": return d.flasche || "";
    case "volumen": return d.volumen || "";
    case "nitrox": return d.nitrox || "";
    case "buddy": return d.buddy || "";
    case "reise": return cf.reise || "";
    case "rating": return d.rating || 0;
    case "bemerkung": return d.bemerkungen || "";
    default: return "";
  }
}

const DIVE_SORT_OPTIONS = [
  { id: "number", label: "Nr.", type: "number" },
  { id: "date", label: "Datum", type: "date" },
  { id: "time", label: "Zeit", type: "text" },
  { id: "land", label: "Land", type: "text" },
  { id: "ort", label: "Ort", type: "text" },
  { id: "tauchspot", label: "Tauchspot", type: "text" },
  { id: "tgNr", label: "TG-Nr.", type: "number" },
  { id: "duration", label: "Dauer", type: "number" },
  { id: "depth", label: "max. Tiefe", type: "number" },
  { id: "temp", label: "Wassertemp.", type: "number" },
  { id: "anzug", label: "Anzug", type: "text" },
  { id: "blei", label: "Blei", type: "number" },
  { id: "flasche", label: "Flasche", type: "text" },
  { id: "volumen", label: "Volumen", type: "text" },
  { id: "nitrox", label: "Nitrox", type: "text" },
  { id: "buddy", label: "Buddy", type: "text" },
  { id: "reise", label: "Reise", type: "text" },
  { id: "rating", label: "Bewertung", type: "number" },
];

function formatSortValue(d, sortId) {
  switch (sortId) {
    case "date": return d.date || "—";
    case "duration": return fmtDuration(d.durationMin);
    case "depth": return d.maxDepth != null ? `${d.maxDepth} m` : "—";
    case "temp": return d.waterTemp != null ? `${d.waterTemp}°` : "—";
    case "blei": return d.blei ? `${d.blei} kg` : "—";
    case "rating": return d.rating ? "★".repeat(d.rating) : "—";
    case "number": return d.name;
    default: {
      const v = diveFieldValue(d, sortId);
      return (v || v === 0) ? String(v) : "—";
    }
  }
}

function sortDives(dives, sortId, dir) {
  const opt = DIVE_SORT_OPTIONS.find(o => o.id === sortId) || DIVE_SORT_OPTIONS[0];
  const sorted = [...dives].sort((a, b) => {
    const av = diveFieldValue(a, sortId), bv = diveFieldValue(b, sortId);
    if (opt.type === "text") return String(av).localeCompare(String(bv), "de", { sensitivity: "base" });
    return av - bv;
  });
  return dir === "asc" ? sorted : sorted.reverse();
}

// ── Such-/Filter-Engine (analog Flugbuch) ───────────────────────────────────
// Unterstützt: Freitext, UND/AND/&&, ODER/OR/||, feld:wert, feld>wert,
// feld<wert, feld>=wert, feld<=wert, +wort (muss), -wort (darf nicht).
const FIELD_ALIASES = {
  nr: "number", nummer: "number", number: "number",
  datum: "date", date: "date",
  zeit: "time", time: "time",
  land: "land",
  ort: "ort", platz: "ort", resort: "ort",
  tauchspot: "tauchspot", spot: "tauchspot",
  "tg-nr": "tgNr", tgnr: "tgNr",
  dauer: "duration", duration: "duration",
  tiefe: "depth", depth: "depth",
  temp: "temp", wassertemp: "temp", temperatur: "temp",
  anzug: "anzug",
  blei: "blei",
  flasche: "flasche",
  volumen: "volumen", vol: "volumen",
  nitrox: "nitrox", air: "nitrox", gas: "nitrox",
  buddy: "buddy",
  reise: "reise",
  rating: "rating", bewertung: "rating",
  bemerkung: "bemerkung", bemerkungen: "bemerkung", notiz: "bemerkung",
};
const NUMERIC_QUERY_FIELDS = ["number", "tgNr", "duration", "depth", "temp", "blei", "rating"];
const DATE_QUERY_FIELDS = ["date"];
const TIME_QUERY_FIELDS = ["time"];

function evalDiveToken(d, tok) {
  const m = tok.match(/^([\wäöü\-]+)\s*(>=|<=|!=|≠|>|<|=|:)\s*(.+)$/i);
  if (m) {
    const fieldRaw = m[1].toLowerCase();
    const op = (m[2] === "≠" ? "!=" : m[2]);
    const raw = m[3].trim();
    const field = FIELD_ALIASES[fieldRaw] || fieldRaw;
    let fv = diveFieldValue(d, field);

    if (NUMERIC_QUERY_FIELDS.includes(field)) {
      const cmp = parseFloat(String(raw).replace(",", "."));
      fv = parseFloat(fv) || 0;
      if (isNaN(cmp)) return true;
      if (op === ">") return fv > cmp;
      if (op === "<") return fv < cmp;
      if (op === ">=") return fv >= cmp;
      if (op === "<=") return fv <= cmp;
      if (op === "!=") return Math.abs(fv - cmp) >= 0.0001;
      return Math.abs(fv - cmp) < 0.0001;
    }
    if (DATE_QUERY_FIELDS.includes(field)) {
      const cmp = parseDateToTs(raw);
      const fvTs = fv;
      if (!cmp) return true;
      if (op === ">") return fvTs > cmp;
      if (op === "<") return fvTs < cmp;
      if (op === ">=") return fvTs >= cmp;
      if (op === "<=") return fvTs <= cmp;
      if (op === "!=") return fvTs !== cmp;
      return fvTs === cmp;
    }
    if (TIME_QUERY_FIELDS.includes(field)) {
      const toSec = t => { const m2 = String(t).match(/(\d{1,2}):(\d{2})/); return m2 ? (+m2[1]*3600 + +m2[2]*60) : null; };
      const cmp = toSec(raw), fvSec = toSec(fv);
      if (cmp == null) return true;
      if (fvSec == null) return false;
      if (op === ">") return fvSec > cmp;
      if (op === "<") return fvSec < cmp;
      if (op === ">=") return fvSec >= cmp;
      if (op === "<=") return fvSec <= cmp;
      if (op === "!=") return fvSec !== cmp;
      return fvSec === cmp;
    }
    // Textfelder: ":" (Standard) = enthält; "=" exakt; "!=" enthält nicht;
    // >/</>=/<= alphabetischer Vergleich.
    const fvStr = String(fv), rawStr = raw;
    if (op === ":") return fvStr.toLowerCase().includes(rawStr.toLowerCase());
    if (op === "=") return fvStr.toLowerCase() === rawStr.toLowerCase();
    if (op === "!=") return !fvStr.toLowerCase().includes(rawStr.toLowerCase());
    const cmpAlpha = fvStr.localeCompare(rawStr, "de", { sensitivity: "base" });
    if (op === ">") return cmpAlpha > 0;
    if (op === "<") return cmpAlpha < 0;
    if (op === ">=") return cmpAlpha >= 0;
    if (op === "<=") return cmpAlpha <= 0;
    return fvStr.toLowerCase().includes(rawStr.toLowerCase());
  }
  // Einzelnes Wort ohne Operator => Volltextsuche über alle Felder
  const hay = [
    d.name, d.date, d.time, d.land, d.ort, d.tauchspot, d.tgNr, d.durationStr,
    d.maxDepth, d.waterTemp, d.anzug, d.blei, d.flasche, d.volumen, d.nitrox,
    d.buddy, d.bemerkungen, d.customFields?.reise, d.rating,
  ].join(" ").toLowerCase();
  return hay.includes(tok.toLowerCase());
}

function matchDives(dives, q) {
  if (!q || !q.trim()) return dives;
  const s = q.trim()
    .replace(/\s+(UND|AND)\s+/gi, " && ")
    .replace(/\s+(ODER|OR)\s+/gi, " || ")
    .replace(/&&/g, " && ").replace(/\|\|/g, " || ");
  const orGroups = s.split(/\s*\|\|\s*/);
  return dives.filter(d => {
    return orGroups.some(group => {
      const andTerms = group.split(/\s*&&\s*/).flatMap(t => {
        return t.match(/(?:[\wäöü\-]+(?:>=|<=|!=|≠|>|<|=|:)\S+|\+\S+|-\S+|"[^"]+"|\S+)/gi) || [];
      }).map(t => t.replace(/^"|"$/g, ""));
      if (!andTerms.length) return true;
      return andTerms.every(term => {
        if (term.startsWith("+")) return evalDiveToken(d, term.slice(1));
        if (term.startsWith("-")) return !evalDiveToken(d, term.slice(1));
        return evalDiveToken(d, term);
      });
    });
  });
}

// ── Erweiterte Suche (mehrzeilig, Feld/Operator/Wert, analog Flugbuch) ─────
const DIVE_SEARCH_FIELDS = [
  { id: "number", label: "Nr.", type: "number" },
  { id: "date", label: "Datum", type: "date" },
  { id: "time", label: "Zeit", type: "time" },
  { id: "land", label: "Land", type: "text" },
  { id: "ort", label: "Ort", type: "text" },
  { id: "tauchspot", label: "Tauchspot", type: "text" },
  { id: "tgNr", label: "TG-Nr.", type: "number" },
  { id: "duration", label: "Dauer (min)", type: "number" },
  { id: "depth", label: "max. Tiefe (m)", type: "number" },
  { id: "temp", label: "Wassertemp. (°C)", type: "number" },
  { id: "anzug", label: "Anzug", type: "text" },
  { id: "blei", label: "Blei (kg)", type: "number" },
  { id: "flasche", label: "Flasche", type: "text" },
  { id: "volumen", label: "Volumen", type: "text" },
  { id: "nitrox", label: "Nitrox/Air", type: "text" },
  { id: "buddy", label: "Buddy", type: "text" },
  { id: "reise", label: "Reise", type: "text" },
  { id: "rating", label: "Bewertung", type: "number" },
  { id: "bemerkung", label: "Bemerkung", type: "text" },
];
const DIVE_ADV_OPS_NUM = [">=", "<=", "!=", ">", "<", "=", "between"];
const DIVE_ADV_OPS_TEXT = [":", "=", "!=", ">", "<", ">=", "<="];

function buildAdvancedDiveQuery(rows, combine) {
  const parts = rows
    .filter(r => r.value !== "" && r.value != null)
    .map(r => {
      const fieldDef = DIVE_SEARCH_FIELDS.find(f => f.id === r.field);
      const isNumeric = fieldDef?.type === "number" || fieldDef?.type === "date" || fieldDef?.type === "time";
      const op = r.op || (isNumeric ? "=" : ":");
      if (op === "between") {
        if (r.value2 === "" || r.value2 == null) return `${r.field}>=${String(r.value).trim()}`;
        return `${r.field}>=${String(r.value).trim()} && ${r.field}<=${String(r.value2).trim()}`;
      }
      return `${r.field}${op}${String(r.value).trim()}`;
    });
  if (!parts.length) return "";
  return parts.join(combine === "OR" ? " || " : " && ");
}

function newDiveSearchRow() { return { field: "ort", op: ":", value: "" }; }

// ── Editable summary tiles (3 badges, freely reassignable + editable) ──────
// Feste Auswahlfelder — analog Flugbuch (Ausrüstung wird meist aus einem
// kleinen, wiederkehrenden Set gewählt statt frei getippt).
const NITROX_OPTIONS = ["Air", "Nitrox"];
const VOLUMEN_OPTIONS = ["15 L", "12 L"];
const FLASCHE_OPTIONS = ["Alu", "Stahl"];
const BLEI_OPTIONS = ["3", "4", "5", "6", "7", "8"];
const DEFAULT_ANZUG = "Lang 5/4/3";

const TAUCH_TILE_OPTIONS = [
  { key: "duration", label: "Dauer", icon: "⏱", get: d => fmtDuration(d.durationMin), rawGet: d => d.durationStr || "", save: v => ({ durationStr: v, durationMin: parseDurationToMin(v) }) },
  { key: "maxDepth", label: "max. Tiefe", icon: "⬇", get: d => d.maxDepth != null ? d.maxDepth + " m" : "—", rawGet: d => d.maxDepth != null ? String(d.maxDepth) : "", save: v => ({ maxDepth: v === "" ? null : parseFloat(String(v).replace(",", ".")) }) },
  { key: "waterTemp", label: "Wassertemp.", icon: "🌡", get: d => d.waterTemp != null ? d.waterTemp + "°" : "—", rawGet: d => d.waterTemp != null ? String(d.waterTemp) : "", save: v => ({ waterTemp: v === "" ? null : parseFloat(String(v).replace(",", ".")) }) },
  { key: "blei", label: "Blei", icon: "⚖️", get: d => d.blei ? d.blei + " kg" : "—", rawGet: d => d.blei || "", save: v => ({ blei: v }), selectOptions: BLEI_OPTIONS, unit: "kg" },
  { key: "tgNr", label: "TG-Nr.", icon: "#", get: d => d.tgNr || "—", rawGet: d => d.tgNr || "", save: v => ({ tgNr: v }) },
  { key: "volumen", label: "Volumen", icon: "🛢", get: d => d.volumen || "—", rawGet: d => d.volumen || "", save: v => ({ volumen: v }), selectOptions: VOLUMEN_OPTIONS },
  { key: "flasche", label: "Flasche", icon: "🔩", get: d => d.flasche || "—", rawGet: d => d.flasche || "", save: v => ({ flasche: v }), selectOptions: FLASCHE_OPTIONS },
  { key: "nitrox", label: "Nitrox", icon: "💨", get: d => d.nitrox || "—", rawGet: d => d.nitrox || "", save: v => ({ nitrox: v }), selectOptions: NITROX_OPTIONS },
  { key: "anzug", label: "Anzug", icon: "🤿", get: d => d.anzug || "—", rawGet: d => d.anzug || "", save: v => ({ anzug: v }) },
  { key: "buddy", label: "Buddy", icon: "👤", get: d => d.buddy || "—", rawGet: d => d.buddy || "", save: v => ({ buddy: v }) },
  { key: "land", label: "Land", icon: "🌍", get: d => d.land || "—", rawGet: d => d.land || "", save: v => ({ land: v }) },
  { key: "ort", label: "Ort", icon: "📍", get: d => d.ort || "—", rawGet: d => d.ort || "", save: v => ({ ort: v }) },
  { key: "tauchspot", label: "Tauchspot", icon: "🐠", get: d => d.tauchspot || "—", rawGet: d => d.tauchspot || "", save: v => ({ tauchspot: v }) },
  { key: "time", label: "Zeit", icon: "🕒", get: d => d.time || "—", rawGet: d => d.time || "", save: v => ({ time: v }) },
];
const DEFAULT_TAUCH_TILE_KEYS = ["duration", "maxDepth", "waterTemp", "time"];

function DiveTile({ tileKey, d, onPick, onSave }) {
  const opt = TAUCH_TILE_OPTIONS.find(o => o.key === tileKey) || TAUCH_TILE_OPTIONS[0];
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const startEdit = () => { setVal(opt.rawGet(d)); setEditing(true); };
  const commit = () => { setEditing(false); onSave(opt.save(val)); };
  const commitSelect = (v) => { onSave(opt.save(v)); };
  return (
    <div style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:"8px 6px",textAlign:"center",border:"1px solid rgba(255,255,255,0.06)"}}>
      <div onClick={onPick} style={{fontSize:9,color:"rgba(232,244,253,0.4)",textTransform:"uppercase",letterSpacing:0.4,cursor:"pointer",marginBottom:3,display:"flex",alignItems:"center",justifyContent:"center",gap:3}}>
        <span>{opt.label}</span><span style={{fontSize:8,opacity:0.6}}>⚙</span>
      </div>
      {opt.selectOptions ? (
        <select value={opt.rawGet(d)} onChange={e=>commitSelect(e.target.value)}
          style={{width:"100%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,padding:"2px 2px",color:"#38bdf8",fontSize:13,fontWeight:800,textAlign:"center",boxSizing:"border-box"}}>
          <option value="" style={{background:"#0a1628"}}>—</option>
          {opt.selectOptions.map(o => <option key={o} value={o} style={{background:"#0a1628"}}>{o}{opt.unit?" "+opt.unit:""}</option>)}
        </select>
      ) : editing ? (
        <input value={val} onChange={e=>setVal(e.target.value)} onBlur={commit} autoFocus
          onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();commit();}}}
          style={{width:"100%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(56,189,248,0.4)",borderRadius:6,padding:"2px 4px",color:"#e8f4fd",fontSize:14,fontWeight:700,textAlign:"center",boxSizing:"border-box"}} />
      ) : (
        <div onClick={startEdit} style={{fontSize:16,fontWeight:800,color:"#38bdf8",cursor:"pointer"}}>{opt.get(d)}</div>
      )}
    </div>
  );
}

// ── Small shared field components ───────────────────────────────────────────
function EditableTitle({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  const commit = () => { setEditing(false); if (val.trim() !== (value || "") && val.trim() !== "") onSave(val.trim()); };
  if (editing) {
    return (
      <input value={val} onChange={e=>setVal(e.target.value)} onBlur={commit} autoFocus
        onKeyDown={e=>{ if(e.key==="Enter"){e.preventDefault();commit();} }}
        style={{fontSize:26,fontWeight:800,marginBottom:4,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(56,189,248,0.4)",borderRadius:8,padding:"2px 8px",color:"#e8f4fd",width:"100%",boxSizing:"border-box"}} />
    );
  }
  return (
    <div onClick={()=>{setVal(value||"");setEditing(true);}} style={{fontSize:26,fontWeight:800,marginBottom:4,cursor:"pointer"}}>
      {value||"—"}
    </div>
  );
}

function InlineField({label, value, onSave, multiline, unit}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value||"");
  const commit = () => { setEditing(false); if(val!==(value||"")) onSave(val); };
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
      <span style={{fontSize:13,color:"rgba(232,244,253,0.45)",minWidth:90}}>{label}</span>
      {editing ? (
        multiline
          ? <textarea value={val} onChange={e=>setVal(e.target.value)} onBlur={commit} autoFocus
              style={{flex:1,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(56,189,248,0.4)",borderRadius:8,padding:"4px 8px",color:"#e8f4fd",fontSize:13,resize:"vertical",minHeight:48}} />
          : <input value={val} onChange={e=>setVal(e.target.value)} onBlur={commit} autoFocus
              onKeyDown={e=>{ if(e.key==="Enter"){e.preventDefault();commit();} }}
              style={{flex:1,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(56,189,248,0.4)",borderRadius:8,padding:"4px 8px",color:"#e8f4fd",fontSize:13,textAlign:"right"}} />
      ) : (
        <span onClick={()=>{setVal(value||"");setEditing(true);}}
          style={{fontSize:13,fontWeight:500,color:value?"#e8f4fd":"rgba(232,244,253,0.25)",cursor:"pointer",minWidth:60,textAlign:"right"}}>
          {value?(value+(unit?" "+unit:"")):(unit?"— "+unit:"—")}
        </span>
      )}
    </div>
  );
}

// Reise-Dropdown: Liste stammt aus "tauchreisen:names" — jeder in den
// Tauchgängen vorkommende Ort wird beim Laden automatisch als eigene Reise
// angelegt (siehe ensureReisen), zusätzlich frei erweiter-/umbenennbar auf
// der Reisen-Seite.
function ReiseSelect({ value, onSave }) {
  const [names, setNames] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("tauchreisen:names");
        if (r) setNames(JSON.parse(r.value) || []);
      } catch {}
    })();
  }, []);
  const options = value && !names.includes(value) ? [value, ...names] : names;
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
      <span style={{fontSize:13,color:"rgba(232,244,253,0.45)",minWidth:90}}>Reise</span>
      <select value={value||""} onChange={e=>onSave(e.target.value)}
        style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,padding:"4px 8px",color:value?"#e8f4fd":"rgba(232,244,253,0.4)",fontSize:13,textAlign:"right",maxWidth:180}}>
        <option value="" style={{background:"#0a1628"}}>—</option>
        {options.map(n => <option key={n} value={n} style={{background:"#0a1628"}}>{n}</option>)}
      </select>
    </div>
  );
}

function SelectField({ label, value, options, unit, onSave }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
      <span style={{fontSize:13,color:"rgba(232,244,253,0.45)",minWidth:90}}>{label}</span>
      <select value={value||""} onChange={e=>onSave(e.target.value)}
        style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,padding:"4px 8px",color:value?"#e8f4fd":"rgba(232,244,253,0.4)",fontSize:13,textAlign:"right",maxWidth:160}}>
        <option value="" style={{background:"#0a1628"}}>—</option>
        {options.map(o => <option key={o} value={o} style={{background:"#0a1628"}}>{o}{unit?" "+unit:""}</option>)}
      </select>
    </div>
  );
}

// ── List row ─────────────────────────────────────────────────────────────
function DiveRow({ d, onClick, sortId, selectMode, isSelected, onToggleSelect, reiseNumbers }) {
  const showSortValue = sortId && sortId !== "date" && sortId !== "number";
  const badge = reiseTgBadge(d, reiseNumbers);
  return (
    <div onClick={selectMode ? ()=>onToggleSelect(d.id) : onClick}
      style={{padding:"11px 16px",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",background:isSelected?"rgba(56,189,248,0.1)":"transparent"}}
      onMouseEnter={e=>{ if(!isSelected) e.currentTarget.style.background="rgba(255,255,255,0.03)"; }}
      onMouseLeave={e=>{ if(!isSelected) e.currentTarget.style.background="transparent"; }}>
      {selectMode && (
        <div style={{marginRight:10,flexShrink:0,width:20,height:20,borderRadius:6,border:`2px solid ${isSelected?"#7dd3fc":"rgba(232,244,253,0.3)"}`,background:isSelected?"#7dd3fc":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
          {isSelected && <span style={{color:"#0a1628",fontSize:13,fontWeight:900}}>✓</span>}
        </div>
      )}
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,marginBottom:2}}>
          <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
            <span style={{fontWeight:700,fontSize:15,flexShrink:0}}>{d.name}</span>
            {badge && <span style={{fontSize:11,fontWeight:700,color:"#fbbf24",flexShrink:0}}>{badge}</span>}
            {d.buddy && <span style={{border:"1px solid rgba(232,244,253,0.15)",borderRadius:20,padding:"1px 7px",fontSize:9,color:"rgba(232,244,253,0.5)",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>👤 {d.buddy}</span>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            {d.rating>0 && <span style={{fontSize:10,fontWeight:700,color:"#fde047"}}>{d.rating}⭐️</span>}
            {d.time && <span style={{fontSize:11,fontWeight:600,color:"#38bdf8"}}>{d.time}</span>}
          </div>
        </div>
        <div style={{fontSize:11,color:"rgba(232,244,253,0.4)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {d.date} · {d.tauchspot||d.ort||"—"}{d.land?" · "+d.land:""}
        </div>
      </div>
      <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
        <div style={{fontSize:13,fontWeight:600,color:"#38bdf8"}}>
          {showSortValue ? formatSortValue(d, sortId) : fmtDuration(d.durationMin)}
        </div>
        {!showSortValue && (
          <div style={{fontSize:11,color:"rgba(232,244,253,0.3)"}}>{d.maxDepth!=null?d.maxDepth+" m":""}</div>
        )}
      </div>
    </div>
  );
}

// ── Search bar (simplified, text-only across all fields) ──────────────────
// Eingeklappt: einzeilige Suche (bisheriges Verhalten). Aufklappen zeigt
// einen Zeilen-Baukasten (Feld/Operator/Wert, beliebig viele Zeilen, UND/
// ODER kombinierbar) — live übersetzt in denselben Query-String, den auch
// das einfache Textfeld benutzt, sodass beide Wege identische Treffer liefern.
function SearchBar({ filterText, setFilterText }) {
  const [advOpen, setAdvOpen] = useState(false);
  const [rows, setRows] = useState([newDiveSearchRow()]);
  const [combine, setCombine] = useState("AND");

  const applyRows = (nextRows, nextCombine) => {
    setRows(nextRows);
    const useCombine = nextCombine || combine;
    if (nextCombine) setCombine(nextCombine);
    setFilterText(buildAdvancedDiveQuery(nextRows, useCombine));
  };
  const updateRow = (idx, patch) => applyRows(rows.map((r,i)=> i===idx ? {...r, ...patch} : r));
  const addRow = () => applyRows([...rows, newDiveSearchRow()]);
  const removeRow = (idx) => {
    const next = rows.filter((_,i)=>i!==idx);
    applyRows(next.length ? next : [newDiveSearchRow()]);
  };

  return (
    <div style={{position:"relative"}}>
      <div style={{position:"relative"}}>
        <input value={filterText} onChange={e=>setFilterText(e.target.value)} onFocus={()=>setAdvOpen(true)} placeholder="🔍 Suchen (alle Felder)…"
          style={{width:"100%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 34px 8px 12px",color:"#e8f4fd",fontSize:13,boxSizing:"border-box"}} />
        {filterText && (
          <button onClick={()=>setFilterText("")}
            style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"rgba(232,244,253,0.4)",cursor:"pointer",fontSize:14}}>✕</button>
        )}
      </div>

      {advOpen && (
        <div style={{position:"absolute",top:"calc(100% + 8px)",left:0,width:"min(92vw, 420px)",zIndex:50,background:"#0f1f36",boxShadow:"0 12px 32px rgba(0,0,0,0.5)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:10}}>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {rows.map((row, idx) => {
              const fieldDef = DIVE_SEARCH_FIELDS.find(f=>f.id===row.field);
              return (
                <div key={idx} style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{fontSize:10,fontWeight:700,color:"#7dd3fc",minWidth:34,textAlign:"center",flexShrink:0}}>
                    {idx===0 ? "" : (combine==="OR"?"ODER":"UND")}
                  </span>
                  <select value={row.field}
                    onChange={e=>{
                      const nf = DIVE_SEARCH_FIELDS.find(f=>f.id===e.target.value);
                      const isNum = nf?.type==="number"||nf?.type==="date"||nf?.type==="time";
                      updateRow(idx, { field: e.target.value, op: isNum ? "=" : ":", value2: undefined });
                    }}
                    style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,padding:"5px 4px",color:"#e8f4fd",fontSize:12,minWidth:0}}>
                    {DIVE_SEARCH_FIELDS.map(f=><option key={f.id} value={f.id} style={{background:"#0a1628"}}>{f.label}</option>)}
                  </select>
                  {(() => {
                    const isNumeric = fieldDef?.type === "number" || fieldDef?.type === "date" || fieldDef?.type === "time";
                    const ops = isNumeric ? DIVE_ADV_OPS_NUM : DIVE_ADV_OPS_TEXT;
                    return (
                      <select value={row.op || (isNumeric ? "=" : ":")} onChange={e=>updateRow(idx,{op:e.target.value})}
                        style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,padding:"5px 2px",color:"#e8f4fd",fontSize:12,width:isNumeric?68:44,flexShrink:0}}>
                        {ops.map(o=><option key={o} value={o} style={{background:"#0a1628"}}>{o==="between"?"zw.":o}</option>)}
                      </select>
                    );
                  })()}
                  <input value={row.value||""} onChange={e=>updateRow(idx,{value:e.target.value})}
                    placeholder={row.op==="between" ? "von…" : "Wert…"}
                    style={{flex:1,minWidth:0,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,padding:"5px 8px",color:"#e8f4fd",fontSize:12}} />
                  {row.op==="between" && (
                    <input value={row.value2||""} onChange={e=>updateRow(idx,{value2:e.target.value})} placeholder="bis…"
                      style={{flex:1,minWidth:0,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,padding:"5px 8px",color:"#e8f4fd",fontSize:12}} />
                  )}
                  <button onClick={()=>removeRow(idx)} style={{background:"none",border:"none",color:"rgba(232,244,253,0.35)",cursor:"pointer",fontSize:14,padding:"0 2px",flexShrink:0}}>✕</button>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
            <button onClick={addRow} style={{background:"rgba(125,211,252,0.12)",border:"1px solid rgba(125,211,252,0.3)",borderRadius:8,padding:"5px 10px",color:"#7dd3fc",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Zeile</button>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {rows.length>1 && (
                <div style={{display:"flex",background:"rgba(255,255,255,0.06)",borderRadius:8,padding:2}}>
                  <button onClick={()=>applyRows(rows,"AND")} style={{background:combine==="AND"?"rgba(125,211,252,0.25)":"transparent",border:"none",borderRadius:6,padding:"4px 10px",color:combine==="AND"?"#7dd3fc":"rgba(232,244,253,0.5)",fontSize:11,fontWeight:700,cursor:"pointer"}}>UND</button>
                  <button onClick={()=>applyRows(rows,"OR")} style={{background:combine==="OR"?"rgba(125,211,252,0.25)":"transparent",border:"none",borderRadius:6,padding:"4px 10px",color:combine==="OR"?"#7dd3fc":"rgba(232,244,253,0.5)",fontSize:11,fontWeight:700,cursor:"pointer"}}>ODER</button>
                </div>
              )}
              <button onClick={()=>setAdvOpen(false)} title="Schliessen"
                style={{background:"rgba(34,197,94,0.18)",border:"1px solid rgba(34,197,94,0.4)",borderRadius:8,width:30,height:30,color:"#4ade80",fontSize:14,fontWeight:900,cursor:"pointer",flexShrink:0}}>✓</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CSV row for clipboard copy ──────────────────────────────────────────────
function diveToCsvRow(d) {
  const cf = d.customFields || {};
  return [
    d.name||"", d.date||"", d.time||"", d.land||"", d.ort||"", cf.reise||"",
    d.tgNr||"", d.tauchspot||"", d.durationStr||"", d.maxDepth!=null?String(d.maxDepth):"",
    d.waterTemp!=null?String(d.waterTemp):"", d.anzug||"", d.blei||"", d.flasche||"",
    d.volumen||"", d.nitrox||"", d.buddy||"", d.rating?String(d.rating):"", d.bemerkungen||"",
  ].join("\t");
}
const CSV_COPY_HEADER = ["Nr","Datum","Zeit","Land","Ort","Reise","TG-Nr.","Tauchspot","Dauer","max. Tiefe","Wassertemp.","Anzug","Blei","Flasche","Volumen","Nitrox","Buddy","Bewertung","Bemerkungen"].join("\t");

// ── Detail view ──────────────────────────────────────────────────────────
function DetailContent({ d, dives, setDives, setSelected, setView, saveDive, confirmDelete, setConfirmDelete, returnTo, reiseNumbers }) {
  const dIdx = dives.findIndex(x => x.id === d.id);
  const [bemerkungenEditing, setBemerkungenEditing] = useState(false);
  const [bemerkungenVal, setBemerkungenVal] = useState(d.bemerkungen || "");
  const [tileConfig, setTileConfig] = useState(DEFAULT_TAUCH_TILE_KEYS);
  const [tilePickerIdx, setTilePickerIdx] = useState(null);
  const touchStartRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("settings:diveTileConfig");
        if (r) { const arr = JSON.parse(r.value); if (Array.isArray(arr) && arr.length === 4) setTileConfig(arr); }
      } catch {}
    })();
  }, []);
  const saveTileConfig = async (next) => {
    setTileConfig(next);
    try { await window.storage.set("settings:diveTileConfig", JSON.stringify(next)); } catch {}
  };

  const commitBemerkungen = () => {
    setBemerkungenEditing(false);
    if (bemerkungenVal !== (d.bemerkungen || "")) saveField({ bemerkungen: bemerkungenVal });
  };

  const saveField = async (patch) => {
    const upd = { ...d, ...patch };
    await saveDive(upd);
    setDives(prev => prev.map(x => x.id === upd.id ? upd : x));
    setSelected(upd);
  };
  const saveReiseField = async (v) => {
    const upd = { ...d, customFields: { ...(d.customFields||{}), reise: v } };
    await saveDive(upd);
    setDives(prev => prev.map(x => x.id === upd.id ? upd : x));
    setSelected(upd);
  };

  const goToDive = (delta) => {
    const next = dives[dIdx + delta];
    if (!next) return;
    setSelected(next);
    setBemerkungenVal(next.bemerkungen || "");
  };

  const goBack = () => { if (returnTo) window.location.href = returnTo; else setView("list"); };

  // Wischgeste zwischen Tauchgängen: nach links = nächster (neuerer), nach
  // rechts = vorheriger (älterer) — analog zu den ◀/▶-Buttons oben.
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goToDive(-1); else goToDive(1);
    }
  };

  const badge = reiseTgBadge(d, reiseNumbers || new Map());

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      style={{maxWidth:480,margin:"0 auto",padding:"0 0 32px",background:"#040e20",minHeight:"100vh",color:"#e8f4fd",fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"calc(16px + env(safe-area-inset-top, 0px)) 16px 10px"}}>
        <button onClick={goBack} style={{background:"none",border:"none",color:"#38bdf8",fontSize:22,cursor:"pointer"}}>←</button>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>goToDive(1)} disabled={dIdx>=dives.length-1}
            style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"6px 10px",color:dIdx>=dives.length-1?"rgba(232,244,253,0.2)":"#e8f4fd",fontSize:13,cursor:dIdx>=dives.length-1?"default":"pointer"}}>◀</button>
          <button onClick={()=>goToDive(-1)} disabled={dIdx<=0}
            style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"6px 10px",color:dIdx<=0?"rgba(232,244,253,0.2)":"#e8f4fd",fontSize:13,cursor:dIdx<=0?"default":"pointer"}}>▶</button>
          <button onClick={()=>setConfirmDelete(d.id)}
            style={{background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:20,padding:"6px 12px",color:"#f87171",fontSize:13,cursor:"pointer"}}>🗑</button>
        </div>
      </div>

      <div style={{padding:"0 16px"}}>
        <div style={{marginBottom:2}}>
          <span style={{fontSize:11,color:"#38bdf8"}}>{d.date}</span>
        </div>

        {/* Titel: nur Zahl, daneben gelbe Reise/TG-Nummer (z.B. 31/2) */}
        <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:8}}>
          <EditableTitle value={d.name} onSave={v=>saveField({name:v})} />
          {badge && <span style={{fontSize:15,fontWeight:700,color:"#fbbf24"}}>{badge}</span>}
        </div>

        {/* Bewertung + Nitrox/Air — gross, links, direkt unter der TG-Nummer */}
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
          <span style={{display:"flex",gap:3}}>
            {[1,2,3,4,5].map(s=>(
              <span key={s} onClick={()=>saveField({rating: (d.rating||0)===s ? 0 : s})}
                style={{fontSize:24,cursor:"pointer",color:s<=(d.rating||0)?"#f59e0b":"rgba(232,244,253,0.2)"}}>★</span>
            ))}
          </span>
          <select value={d.nitrox||""} onChange={e=>saveField({nitrox:e.target.value})}
            style={{background:d.nitrox==="Nitrox"?"rgba(34,197,94,0.2)":"rgba(255,255,255,0.08)",border:`1px solid ${d.nitrox==="Nitrox"?"rgba(34,197,94,0.4)":"rgba(255,255,255,0.12)"}`,borderRadius:20,padding:"6px 14px",color:d.nitrox==="Nitrox"?"#4ade80":"#e8f4fd",fontSize:14,fontWeight:700,cursor:"pointer"}}>
            <option value="" style={{background:"#0a1628"}}>—</option>
            {NITROX_OPTIONS.map(o => <option key={o} value={o} style={{background:"#0a1628"}}>{o}</option>)}
          </select>
        </div>

        {/* Bemerkungen — direkt unter Titel/Bewertung */}
        <div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,padding:"13px 15px",marginBottom:14,border:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{fontSize:10,fontWeight:700,color:"rgba(232,244,253,0.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:9}}>Bemerkungen</div>
          {bemerkungenEditing ? (
            <textarea value={bemerkungenVal} onChange={e=>setBemerkungenVal(e.target.value)} onBlur={commitBemerkungen} autoFocus
              style={{width:"100%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(56,189,248,0.4)",borderRadius:8,padding:"8px 10px",color:"#e8f4fd",fontSize:13,resize:"vertical",minHeight:60,boxSizing:"border-box"}} />
          ) : (
            <div onClick={()=>{setBemerkungenVal(d.bemerkungen||"");setBemerkungenEditing(true);}}
              style={{fontSize:13,color:d.bemerkungen?"#e8f4fd":"rgba(232,244,253,0.25)",cursor:"pointer",whiteSpace:"pre-wrap",lineHeight:1.5}}>
              {d.bemerkungen||"Tippen zum Hinzufügen…"}
            </div>
          )}
        </div>

        {/* Drei frei editierbare Daten-Badges */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:14}}>
          {tileConfig.map((key, i) => (
            <DiveTile key={i} tileKey={key} d={d}
              onPick={()=>setTilePickerIdx(i)}
              onSave={patch=>saveField(patch)} />
          ))}
        </div>

        {tilePickerIdx !== null && (
          <div onClick={()=>setTilePickerIdx(null)}
            style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:250,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
            <div onClick={e=>e.stopPropagation()}
              style={{background:"#14253a",borderTopLeftRadius:18,borderTopRightRadius:18,padding:"16px 18px calc(20px + env(safe-area-inset-bottom, 0px))",maxWidth:480,width:"100%",maxHeight:"75vh",overflowY:"auto",border:"1px solid rgba(255,255,255,0.1)"}}>
              <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>Badge {tilePickerIdx+1}: Feld wählen</div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {TAUCH_TILE_OPTIONS.map(opt => (
                  <button key={opt.key}
                    onClick={()=>{
                      const next = [...tileConfig]; next[tilePickerIdx] = opt.key;
                      saveTileConfig(next); setTilePickerIdx(null);
                    }}
                    style={{display:"flex",alignItems:"center",gap:10,textAlign:"left",background:tileConfig[tilePickerIdx]===opt.key?"rgba(56,189,248,0.15)":"transparent",border:"1px solid "+(tileConfig[tilePickerIdx]===opt.key?"rgba(56,189,248,0.35)":"rgba(255,255,255,0.06)"),borderRadius:10,padding:"9px 12px",color:"#e8f4fd",fontSize:13,cursor:"pointer"}}>
                    <span style={{fontSize:15}}>{opt.icon}</span>
                    <span style={{flex:1}}>{opt.label}</span>
                    <span style={{color:"rgba(232,244,253,0.4)",fontSize:12}}>{opt.get(d)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Übrige Felder */}
        <div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,padding:"4px 15px",marginBottom:14,border:"1px solid rgba(255,255,255,0.06)"}}>
          <InlineField label="Datum" value={d.date} onSave={v=>saveField({date:v, year: parseDateToTs(v)?String(new Date(parseDateToTs(v)).getFullYear()):d.year})} />
          <InlineField label="Land" value={d.land} onSave={v=>saveField({land:v})} />
          <InlineField label="Ort" value={d.ort} onSave={v=>saveField({ort:v})} />
          <ReiseSelect value={d.customFields?.reise} onSave={saveReiseField} />
          <InlineField label="TG-Nr." value={d.tgNr} onSave={v=>saveField({tgNr:v})} />
          <InlineField label="Tauchspot" value={d.tauchspot} onSave={v=>saveField({tauchspot:v})} />
          <InlineField label="Anzug" value={d.anzug} onSave={v=>saveField({anzug:v})} />
          <SelectField label="Blei" value={d.blei} options={BLEI_OPTIONS} unit="kg" onSave={v=>saveField({blei:v})} />
          <SelectField label="Flasche" value={d.flasche} options={FLASCHE_OPTIONS} onSave={v=>saveField({flasche:v})} />
          <SelectField label="Volumen" value={d.volumen} options={VOLUMEN_OPTIONS} onSave={v=>saveField({volumen:v})} />
          <InlineField label="Buddy" value={d.buddy} onSave={v=>saveField({buddy:v})} />
        </div>
      </div>

      {confirmDelete === d.id && (
        <div onClick={()=>setConfirmDelete(null)}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:24}}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:"#14253a",borderRadius:16,padding:"20px 22px",maxWidth:320,width:"100%",border:"1px solid rgba(255,255,255,0.1)"}}>
            <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>Tauchgang {d.name} löschen?</div>
            <div style={{fontSize:13,color:"rgba(232,244,253,0.6)",marginBottom:18}}>Diese Aktion kann nicht rückgängig gemacht werden.</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setConfirmDelete(null)}
                style={{flex:1,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"10px",color:"#e8f4fd",fontSize:14,cursor:"pointer"}}>Abbrechen</button>
              <button onClick={async()=>{
                  try { await window.storage.delete(`dive:${d.id}`); } catch {}
                  setDives(prev=>prev.filter(x=>x.id!==d.id));
                  setConfirmDelete(null);
                  setSelected(null);
                  setView("list");
                }}
                style={{flex:1,background:"rgba(239,68,68,0.2)",border:"1px solid rgba(239,68,68,0.4)",borderRadius:10,padding:"10px",color:"#f87171",fontSize:14,fontWeight:700,cursor:"pointer"}}>🗑 Löschen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────
function TauchbuchApp() {
  const [dives, setDives] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("list"); // list | detail
  const [returnTo, setReturnTo] = useState(null);
  const [filterText, setFilterText] = useState("");
  const [sortId, setSortId] = useState("number");
  const [sortDir, setSortDir] = useState("desc");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [collapsedYears, setCollapsedYears] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showBackupMenu, setShowBackupMenu] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [importMsg, setImportMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [copyMsg, setCopyMsg] = useState("");
  const [backupMsg, setBackupMsg] = useState("");
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({});
  const [reisenNames, setReisenNames] = useState([]);
  const fileRef = useRef(null);
  const backupFileRef = useRef(null);

  // Jeder in den Tauchgängen vorkommende Ort bildet automatisch eine eigene
  // Reise (falls noch nicht vorhanden), und Tauchgänge ohne zugeordnete
  // Reise werden defaultmässig auf ihren eigenen Ort gesetzt.
  const ensureReisen = useCallback(async (diveList) => {
    let names = [];
    try {
      const r = await window.storage.get("tauchreisen:names");
      if (r) names = JSON.parse(r.value) || [];
    } catch {}
    const nameSet = new Set(names);
    let namesChanged = false;
    diveList.forEach(d => {
      if (d.ort && !nameSet.has(d.ort)) { names.push(d.ort); nameSet.add(d.ort); namesChanged = true; }
    });
    if (namesChanged) {
      try { await window.storage.set("tauchreisen:names", JSON.stringify(names)); } catch {}
    }
    setReisenNames(names);
    const updated = [];
    for (const d of diveList) {
      const needsReise = !d.customFields?.reise && d.ort;
      const normalizedNitrox = normalizeNitroxValue(d.nitrox);
      const needsNitroxFix = normalizedNitrox !== d.nitrox;
      if (needsReise || needsNitroxFix) {
        const upd = {
          ...d,
          ...(needsNitroxFix ? { nitrox: normalizedNitrox } : {}),
          customFields: needsReise ? { ...(d.customFields||{}), reise: d.ort } : d.customFields,
        };
        try { await window.storage.set(`dive:${upd.id}`, JSON.stringify(upd)); } catch {}
        updated.push(upd);
      } else updated.push(d);
    }
    return updated;
  }, []);

  useEffect(() => {
    (async () => {
      let loadedDives = [];
      try {
        const keys = await window.storage.list("dive:");
        const raw = await Promise.all((keys?.keys||[]).map(async k => {
          try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } catch { return null; }
        }));
        loadedDives = raw.filter(Boolean);
      } catch (e) { console.error("Storage load error:", e); }
      const withReisen = await ensureReisen(loadedDives);
      const sorted = sortByNumber(withReisen);
      setDives(sorted);
      setLoaded(true);
      try {
        const params = new URLSearchParams(window.location.search);
        const openId = params.get("openDiveId");
        const ret = params.get("returnTo");
        if (openId) {
          const target = sorted.find(d => String(d.id) === openId);
          if (target) { setSelected(target); setView("detail"); if (ret) setReturnTo(ret); }
        }
      } catch {}
    })();
  }, [ensureReisen]);

  const saveDive = useCallback(async (d) => {
    try { await window.storage.set(`dive:${d.id}`, JSON.stringify(d)); } catch (e) { console.error("Save error:", e); }
  }, []);

  const addNewDive = useCallback(async () => {
    const maxNr = dives.reduce((m,d)=>Math.max(m, parseInt(d.name||"0",10)), 0);
    const newNr = maxNr + 1;
    const prev = dives.find(d => parseInt(d.name||"0",10) === maxNr) || null;
    const now = new Date();
    const dd = String(now.getDate()).padStart(2,"0");
    const mm = String(now.getMonth()+1).padStart(2,"0");
    const yyyy = String(now.getFullYear());
    const prevTgNr = parseInt(prev?.tgNr || "0", 10);
    const newDive = {
      id: `dive_${newNr}`,
      name: String(newNr),
      date: `${dd}.${mm}.${yyyy}`,
      year: yyyy,
      time: "",
      // Neuer Tauchgang übernimmt Ausrüstung/Ort des vorangehenden TG —
      // nur Datum/Zeit/Dauer/Tiefe/Temp./Bemerkungen/Bewertung starten leer.
      land: prev?.land || "",
      ort: prev?.ort || "",
      tgNr: (prev && prevTgNr) ? String(prevTgNr + 1) : "",
      tauchspot: prev?.tauchspot || "",
      durationStr: "", durationMin: 0, maxDepth: null, waterTemp: null,
      anzug: prev?.anzug || DEFAULT_ANZUG,
      blei: prev?.blei || "",
      flasche: prev?.flasche || "",
      volumen: prev?.volumen || "",
      nitrox: prev?.nitrox || "",
      buddy: prev?.buddy || "",
      bemerkungen: "",
      rating: 0,
      customFields: { reise: prev?.customFields?.reise || "" },
    };
    await saveDive(newDive);
    setDives(list => sortByNumber([newDive, ...list]));
    setSelected(newDive);
    setReturnTo(null);
    setView("detail");
  }, [dives, saveDive]);

  const importCsvText = useCallback(async (text) => {
    setImporting(true);
    const parsed = parseDiveCsv(text);
    if (!parsed.length) {
      setImportMsg("⚠️ Keine Tauchgänge in der Datei gefunden.");
      setImporting(false);
      return;
    }
    setImportProgress({ done: 0, total: parsed.length });
    let created = 0, updated = 0;
    const existingByName = new Map(dives.map(d => [d.name, d]));
    let updatedList = [...dives];
    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i];
      const existing = existingByName.get(p.name);
      const merged = existing
        ? { ...existing, ...p, id: existing.id, rating: existing.rating||0, customFields: { ...(existing.customFields||{}), ...(p.customFields||{}) } }
        : p;
      if (existing) updated++; else created++;
      await saveDive(merged);
      const idx = updatedList.findIndex(d => d.id === merged.id);
      if (idx >= 0) updatedList[idx] = merged; else updatedList.push(merged);
      setImportProgress({ done: i+1, total: parsed.length });
    }
    const withReisen = await ensureReisen(updatedList);
    setDives(sortByNumber(withReisen));
    setImportProgress(null);
    setImporting(false);
    setShowImportMenu(false);
    setImportMsg(`✓ ${created} neu, ${updated} aktualisiert (${parsed.length} erkannt)`);
  }, [dives, saveDive, ensureReisen]);

  const importCsvFile = useCallback(async (file) => {
    try {
      const text = await file.text();
      await importCsvText(text);
    } catch (e) {
      setImportMsg("Fehler beim Import: " + e.message);
      setImporting(false);
    }
  }, [importCsvText]);

  // ── Backup / Restore ─────────────────────────────────────────────────────
  const exportBackup = useCallback(async () => {
    let extra = {};
    try {
      const keys = await window.storage.list("");
      for (const k of (keys?.keys || [])) {
        if (k.startsWith("tauchreisen:") || k.startsWith("settings:")) {
          const r = await window.storage.get(k);
          if (r) { try { extra[k] = JSON.parse(r.value); } catch { extra[k] = r.value; } }
        }
      }
    } catch (e) { console.error("Backup: error collecting extra data:", e); }

    const payload = { exportedAt: new Date().toISOString(), dives, extra };
    const json = JSON.stringify(payload);
    const dateStamp = new Date().toISOString().slice(0,10);
    const filename = `tauchbuch-backup-${dateStamp}.json`;

    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([json], filename, { type: "application/json" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file] });
          setBackupMsg("✓ Backup geteilt.");
          return;
        }
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    const encoded = "data:application/json;charset=utf-8," + encodeURIComponent(json);
    const a = document.createElement("a");
    a.href = encoded; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }, [dives]);

  const importBackup = useCallback(async (file) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.dives)) throw new Error("Ungültiges Backup-Format (kein 'dives'-Array).");
      for (const d of data.dives) await window.storage.set(`dive:${d.id}`, JSON.stringify(d));
      let restoredExtras = 0;
      if (data.extra && typeof data.extra === "object") {
        for (const [k, v] of Object.entries(data.extra)) {
          await window.storage.set(k, JSON.stringify(v));
          restoredExtras++;
        }
      }
      const withReisen = await ensureReisen(data.dives);
      setDives(sortByNumber(withReisen));
      setBackupMsg(`✓ ${data.dives.length} Tauchgänge${restoredExtras?" + Reisen-Daten":""} wiederhergestellt.`);
    } catch (e) {
      setBackupMsg("Fehler beim Import: " + e.message);
    }
  }, [ensureReisen]);

  const reiseNumbers = useMemo(() => computeReiseNumbers(dives), [dives]);

  if (!loaded) return null;

  if (view === "detail" && selected) {
    return (
      <DetailContent d={selected} dives={sortByNumber(dives)} setDives={setDives} setSelected={setSelected}
        setView={setView} saveDive={saveDive} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete}
        returnTo={returnTo} reiseNumbers={reiseNumbers} />
    );
  }

  const filtered = matchDives(dives, filterText);
  const years = [...new Set(filtered.map(d => d.year).filter(Boolean))].sort((a,b)=>b-a);
  const noYear = filtered.filter(d => !d.year);

  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });

  return (
    <div style={{maxWidth:480,margin:"0 auto",minHeight:"100vh",background:"#040e20",color:"#e8f4fd",fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif"}}>
      <input ref={fileRef} type="file" accept=".csv" style={{display:"none"}} onChange={e=>e.target.files[0]&&importCsvFile(e.target.files[0])} />
      <input ref={backupFileRef} type="file" accept=".json" style={{display:"none"}}
        onChange={e=>{ if(e.target.files[0]) importBackup(e.target.files[0]); e.target.value=""; }} />

      {/* Header */}
      <div style={{position:"sticky",top:0,zIndex:10,background:"#040e20"}}>
        <div style={{background:"rgba(255,255,255,0.03)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"calc(28px + env(safe-area-inset-top, 0px)) 16px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",backdropFilter:"blur(10px)"}}>
          <span style={{fontSize:10,color:"rgba(232,244,253,0.3)",flexShrink:0,minWidth:32}}>v{APP_VERSION}</span>
          <span style={{fontWeight:900,fontSize:18,letterSpacing:-0.5,flex:1,textAlign:"center",marginLeft:-8}}>
            🤿 Tauchbuch
          </span>
          <div style={{display:"flex",gap:8,flexShrink:0}}>
            <button onClick={addNewDive} style={{background:"rgba(34,197,94,0.15)",color:"#4ade80",border:"1px solid rgba(34,197,94,0.25)",borderRadius:20,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>+ Tauchgang</button>
          </div>
        </div>

        {/* Icon-Buttons: Import / Backup / Auswahl / Reisen / Statistik / Richtung / Jahr */}
        <div style={{padding:"10px 16px 0",display:"flex",gap:6}}>
          <button onClick={()=>{ setShowImportMenu(m=>!m); setShowBackupMenu(false); }} title="CSV Import"
            style={{flex:"1 1 0",minWidth:0,aspectRatio:"1",boxSizing:"border-box",display:"flex",alignItems:"center",justifyContent:"center",background:showImportMenu?"rgba(56,189,248,0.15)":"rgba(255,255,255,0.05)",border:`1px solid ${showImportMenu?"rgba(56,189,248,0.35)":"rgba(255,255,255,0.1)"}`,borderRadius:10,color:"#fff",fontSize:17,cursor:"pointer"}}>
            📥
          </button>
          <button onClick={()=>{ setShowBackupMenu(m=>!m); setShowImportMenu(false); }} title="Backup"
            style={{flex:"1 1 0",minWidth:0,aspectRatio:"1",boxSizing:"border-box",display:"flex",alignItems:"center",justifyContent:"center",background:showBackupMenu?"rgba(56,189,248,0.15)":"rgba(255,255,255,0.05)",border:`1px solid ${showBackupMenu?"rgba(56,189,248,0.35)":"rgba(255,255,255,0.1)"}`,borderRadius:10,color:"#fff",fontSize:17,cursor:"pointer"}}>
            💾
          </button>
          <button onClick={()=>{ setSelectMode(m=>!m); setSelectedIds(new Set()); setCopyMsg(""); }} title="Auswahl"
            style={{flex:"1 1 0",minWidth:0,aspectRatio:"1",boxSizing:"border-box",display:"flex",alignItems:"center",justifyContent:"center",background:selectMode?"rgba(14,165,233,0.18)":"rgba(255,255,255,0.05)",border:`1px solid ${selectMode?"rgba(14,165,233,0.4)":"rgba(255,255,255,0.1)"}`,borderRadius:10,color:"#fff",fontSize:21,cursor:"pointer"}}>
            {selectMode?"✕":"☑"}
          </button>
          <button onClick={()=>{window.location.href="reisen.html";}} title="Reisen"
            style={{flex:"1 1 0",minWidth:0,aspectRatio:"1",boxSizing:"border-box",display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(245,166,35,0.15)",border:"1px solid rgba(245,166,35,0.25)",borderRadius:10,color:"#fff",fontSize:17,cursor:"pointer"}}>
            🧭
          </button>
          <button onClick={()=>{window.location.href="statistik.html";}} title="Statistik"
            style={{flex:"1 1 0",minWidth:0,aspectRatio:"1",boxSizing:"border-box",display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(245,158,11,0.15)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:10,color:"#fff",fontSize:17,cursor:"pointer"}}>
            📊
          </button>
          <button onClick={()=>setSortDir(d=>d==="asc"?"desc":"asc")} title={sortDir==="asc"?"Aufsteigend":"Absteigend"}
            style={{flex:"1 1 0",minWidth:0,aspectRatio:"1",boxSizing:"border-box",display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"#fff",fontSize:17,cursor:"pointer"}}>
            {sortDir==="asc"?"↑":"↓"}
          </button>
          <button onClick={()=>setCollapsedYears(s=>s.size===0?new Set(years):new Set())} title={collapsedYears.size===0?"Alle reduzieren":"Alle erweitern"}
            style={{flex:"1 1 0",minWidth:0,aspectRatio:"1",boxSizing:"border-box",display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,letterSpacing:1,cursor:"pointer"}}>
            {collapsedYears.size===0?"⊟⊟":"⊞⊞"}
          </button>
        </div>

        {/* Import-Menü */}
        {showImportMenu && (
          <div style={{margin:"8px 16px 0",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:10}}>
            <div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);e.dataTransfer.files[0]&&importCsvFile(e.dataTransfer.files[0]);}}
              onClick={()=>fileRef.current?.click()}
              style={{border:`2px dashed ${dragOver?"#7dd3fc":"rgba(56,189,248,0.25)"}`,borderRadius:10,padding:"14px 8px",textAlign:"center",background:dragOver?"rgba(56,189,248,0.08)":"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4}}>
              <div style={{fontSize:20}}>📋</div>
              <div style={{color:dragOver?"#7dd3fc":"rgba(125,211,252,0.5)",fontSize:11}}>
                {importProgress ? `⏳ ${importProgress.done}/${importProgress.total}` : importing?"⏳ Importiere…":"CSV-Datei hierher ziehen oder tippen"}
              </div>
            </div>
          </div>
        )}
        {showBackupMenu && (
          <div style={{margin:"8px 16px 0",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:10,display:"flex",gap:8}}>
            <button onClick={exportBackup}
              style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 6px",color:"rgba(232,244,253,0.8)",fontSize:12,cursor:"pointer",textAlign:"center"}}>
              ☁️ In iCloud sichern
            </button>
            <button onClick={()=>backupFileRef.current?.click()}
              style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 6px",color:"rgba(232,244,253,0.8)",fontSize:12,cursor:"pointer",textAlign:"center"}}>
              ⬆ Backup importieren
            </button>
          </div>
        )}
        {(importMsg || backupMsg || copyMsg) && (
          <div style={{padding:"6px 16px 0",fontSize:11,color:(importMsg||backupMsg||copyMsg).startsWith("✓")?"#4ade80":"#f87171"}}>
            {importMsg || backupMsg || copyMsg}
          </div>
        )}

        {importProgress && (
          <div style={{position:"fixed",inset:0,background:"rgba(10,22,40,0.92)",zIndex:300,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14}}>
            <div style={{fontSize:36}}>⏳</div>
            <div style={{fontSize:15,fontWeight:700,color:"#e8f4fd"}}>Speichere Tauchgänge…</div>
            <div style={{fontSize:13,color:"rgba(232,244,253,0.6)"}}>{importProgress.done} / {importProgress.total}</div>
            <div style={{width:200,height:6,background:"rgba(255,255,255,0.1)",borderRadius:10,overflow:"hidden"}}>
              <div style={{width:`${importProgress.total?Math.round(importProgress.done/importProgress.total*100):0}%`,height:"100%",background:"#7dd3fc",transition:"width 0.2s"}} />
            </div>
          </div>
        )}

        {/* Auswahl-Aktionsleiste: Kopieren / Bearbeiten / Löschen / Tauchreise */}
        {selectMode && (
          <div style={{padding:"8px 16px 0",display:"flex",gap:6}}>
            <button onClick={async()=>{
                if (!selectedIds.size) { setCopyMsg("Keine Tauchgänge ausgewählt."); return; }
                const chosen = dives.filter(d=>selectedIds.has(d.id));
                const rows = [CSV_COPY_HEADER, ...chosen.map(diveToCsvRow)].join("\r\n");
                try {
                  const escapeHtml = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
                  const cellStyle = "font-family:Helvetica,sans-serif;font-size:10px;font-weight:normal;text-align:left;";
                  const htmlTable = `<table style="${cellStyle}">` +
                    "<tr>" + CSV_COPY_HEADER.split("\t").map(c=>`<th style="${cellStyle}">${escapeHtml(c)}</th>`).join("") + "</tr>" +
                    chosen.map(d => {
                      const cols = diveToCsvRow(d).split("\t");
                      return "<tr>" + cols.map(c => `<td style="${cellStyle}">${escapeHtml(c)}</td>`).join("") + "</tr>";
                    }).join("") + "</table>";
                  if (navigator.clipboard && window.ClipboardItem) {
                    const item = new ClipboardItem({
                      "text/plain": new Blob([rows], {type:"text/plain"}),
                      "text/html": new Blob([htmlTable], {type:"text/html"}),
                    });
                    await navigator.clipboard.write([item]);
                  } else {
                    await navigator.clipboard.writeText(rows);
                  }
                  setCopyMsg(`✓ ${chosen.length} Tauchgang${chosen.length!==1?"gänge":""} kopiert.`);
                } catch (e) { setCopyMsg("Fehler: " + e.message); }
              }}
              title="Auswahl kopieren"
              style={{flex:"1 1 0",minWidth:0,boxSizing:"border-box",background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:10,padding:"9px 4px",color:"#4ade80",fontSize:13,fontWeight:700,cursor:"pointer",textAlign:"center"}}>
              📋 {selectedIds.size}
            </button>
            <button onClick={()=>{
                if (!selectedIds.size) { setCopyMsg("Keine Tauchgänge ausgewählt."); return; }
                setBulkEditOpen(true);
              }}
              title="Auswahl bearbeiten"
              style={{flex:"1 1 0",minWidth:0,boxSizing:"border-box",background:"rgba(14,165,233,0.15)",border:"1px solid rgba(14,165,233,0.3)",borderRadius:10,padding:"9px 4px",color:"#7dd3fc",fontSize:13,fontWeight:700,cursor:"pointer",textAlign:"center"}}>
              ✏️ {selectedIds.size}
            </button>
            <button onClick={()=>{
                if (!selectedIds.size) { setCopyMsg("Keine Tauchgänge ausgewählt."); return; }
                setConfirmBulkDelete(true);
              }}
              title="Auswahl löschen"
              style={{flex:"1 1 0",minWidth:0,boxSizing:"border-box",background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,padding:"9px 4px",color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer",textAlign:"center"}}>
              🗑 {selectedIds.size}
            </button>
            <select
              value=""
              onChange={async e=>{
                const reiseName = e.target.value;
                if (!reiseName) return;
                if (!selectedIds.size) { setCopyMsg("Keine Tauchgänge ausgewählt."); return; }
                const chosen = dives.filter(d=>selectedIds.has(d.id));
                for (const d of chosen) {
                  const updated = { ...d, customFields: { ...(d.customFields||{}), reise: reiseName } };
                  await saveDive(updated);
                }
                setDives(prev => prev.map(d => selectedIds.has(d.id)
                  ? { ...d, customFields: { ...(d.customFields||{}), reise: reiseName } } : d));
                setCopyMsg(`✓ ${chosen.length} Tauchgang${chosen.length!==1?"gänge":""} → "${reiseName}" zugeordnet.`);
                e.target.value = "";
              }}
              title="Auswahl einer Tauchreise zuordnen"
              style={{flex:"1 1 0",minWidth:0,boxSizing:"border-box",background:"rgba(245,166,35,0.15)",border:"1px solid rgba(245,166,35,0.3)",borderRadius:10,padding:"9px 4px",color:"#f5a623",fontSize:13,fontWeight:700,cursor:"pointer",textAlign:"center",appearance:"none",WebkitAppearance:"none"}}>
              <option value="" style={{background:"#040e20"}}>🧭 {selectedIds.size}</option>
              {reisenNames.map(n => <option key={n} value={n} style={{background:"#040e20"}}>{n}</option>)}
            </select>
          </div>
        )}

        {confirmBulkDelete && (
          <div onClick={()=>setConfirmBulkDelete(false)}
            style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:24}}>
            <div onClick={e=>e.stopPropagation()}
              style={{background:"#14253a",borderRadius:16,padding:"20px 22px",maxWidth:320,width:"100%",border:"1px solid rgba(255,255,255,0.1)"}}>
              <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>{selectedIds.size} Tauchgänge löschen?</div>
              <div style={{fontSize:13,color:"rgba(232,244,253,0.6)",marginBottom:18}}>Diese Aktion kann nicht rückgängig gemacht werden.</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <button onClick={async()=>{
                    const ids = [...selectedIds];
                    for (const id of ids) { try { await window.storage.delete(`dive:${id}`); } catch {} }
                    setDives(prev=>prev.filter(d=>!selectedIds.has(d.id)));
                    setCopyMsg(`✓ ${ids.length} Tauchgang${ids.length!==1?"gänge":""} gelöscht.`);
                    setSelectedIds(new Set());
                    setConfirmBulkDelete(false);
                    setSelectMode(false);
                  }}
                  style={{background:"rgba(239,68,68,0.2)",border:"1px solid rgba(239,68,68,0.4)",borderRadius:10,padding:"10px",color:"#f87171",fontSize:14,fontWeight:700,cursor:"pointer"}}>🗑 Löschen</button>
                <button onClick={()=>setConfirmBulkDelete(false)}
                  style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"10px",color:"#e8f4fd",fontSize:14,cursor:"pointer"}}>Abbrechen</button>
              </div>
            </div>
          </div>
        )}

        {bulkEditOpen && (() => {
          const chosenCount = selectedIds.size;
          const applyBulkEdit = async () => {
            const b = bulkEditData;
            const updated = dives.map(d => {
              if (!selectedIds.has(d.id)) return d;
              const patch = {};
              if (b.land) patch.land = b.land;
              if (b.ort) patch.ort = b.ort;
              if (b.tauchspot) patch.tauchspot = b.tauchspot;
              if (b.anzug) patch.anzug = b.anzug;
              if (b.blei) patch.blei = b.blei;
              if (b.flasche) patch.flasche = b.flasche;
              if (b.volumen) patch.volumen = b.volumen;
              if (b.nitrox) patch.nitrox = b.nitrox;
              if (b.buddy) patch.buddy = b.buddy;
              if (b.bemerkungen) patch.bemerkungen = b.bemerkungen;
              if (b.rating) patch.rating = b.rating;
              const cfPatch = {};
              if (b.reise) cfPatch.reise = b.reise;
              return { ...d, ...patch, customFields: { ...(d.customFields||{}), ...cfPatch } };
            });
            await Promise.all(updated.map(d => selectedIds.has(d.id) ? saveDive(d).catch(()=>{}) : null));
            setDives(updated);
            setCopyMsg(`✓ ${chosenCount} Tauchgang${chosenCount!==1?"gänge":""} aktualisiert.`);
            setBulkEditOpen(false);
            setBulkEditData({});
          };
          const field = (label, key, opts) => (
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"rgba(232,244,253,0.4)",marginBottom:4}}>{label}</div>
              <input value={bulkEditData[key]||""} onChange={e=>setBulkEditData(b=>({...b,[key]:e.target.value}))}
                placeholder={opts?.placeholder||"unverändert lassen"}
                style={{width:"100%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"10px 13px",color:"#e8f4fd",fontSize:14,boxSizing:"border-box"}} />
            </div>
          );
          const selectField = (label, key, options, unit) => (
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"rgba(232,244,253,0.4)",marginBottom:4}}>{label}</div>
              <select value={bulkEditData[key]||""} onChange={e=>setBulkEditData(b=>({...b,[key]:e.target.value}))}
                style={{width:"100%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"10px 13px",color:bulkEditData[key]?"#e8f4fd":"rgba(232,244,253,0.4)",fontSize:14,boxSizing:"border-box"}}>
                <option value="" style={{background:"#14253a"}}>unverändert lassen</option>
                {options.map(o => <option key={o} value={o} style={{background:"#14253a"}}>{o}{unit?" "+unit:""}</option>)}
              </select>
            </div>
          );
          return (
            <div onClick={()=>setBulkEditOpen(false)}
              style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:24}}>
              <div onClick={e=>e.stopPropagation()}
                style={{background:"#14253a",borderRadius:16,padding:"20px 22px",maxWidth:380,width:"100%",border:"1px solid rgba(255,255,255,0.1)",maxHeight:"85vh",overflowY:"auto"}}>
                <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>{chosenCount} Tauchgänge bearbeiten</div>
                <div style={{fontSize:12,color:"rgba(232,244,253,0.5)",marginBottom:16}}>Leer gelassene Felder bleiben unverändert. Ausgefüllte Felder werden auf alle {chosenCount} ausgewählten Tauchgänge übertragen.</div>
                {field("Land", "land")}
                {field("Ort", "ort")}
                {field("Tauchspot", "tauchspot")}
                {field("Reise", "reise", { placeholder: reisenNames.length ? reisenNames.join(", ") : "unverändert lassen" })}
                {field("Anzug", "anzug")}
                {selectField("Blei", "blei", BLEI_OPTIONS, "kg")}
                {selectField("Flasche", "flasche", FLASCHE_OPTIONS)}
                {selectField("Volumen", "volumen", VOLUMEN_OPTIONS)}
                {selectField("Nitrox", "nitrox", NITROX_OPTIONS)}
                {field("Buddy", "buddy")}
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:"rgba(232,244,253,0.4)",marginBottom:6}}>Bewertung</div>
                  <div style={{display:"flex",gap:6}}>
                    {[1,2,3,4,5].map(s=>(
                      <button key={s} onClick={()=>setBulkEditData(b=>({...b,rating:(b.rating||0)===s?0:s}))}
                        style={{fontSize:22,background:"none",border:"none",cursor:"pointer",color:s<=(bulkEditData.rating||0)?"#f59e0b":"rgba(232,244,253,0.2)"}}>★</button>
                    ))}
                    {bulkEditData.rating>0 && <span style={{fontSize:11,color:"rgba(232,244,253,0.4)",alignSelf:"center",marginLeft:6}}>wird auf alle übertragen</span>}
                  </div>
                </div>
                <div style={{marginBottom:18}}>
                  <div style={{fontSize:11,color:"rgba(232,244,253,0.4)",marginBottom:4}}>Bemerkungen</div>
                  <textarea value={bulkEditData.bemerkungen||""} onChange={e=>setBulkEditData(b=>({...b,bemerkungen:e.target.value}))} rows={2}
                    placeholder="unverändert lassen"
                    style={{width:"100%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"10px 13px",color:"#e8f4fd",fontSize:13,resize:"vertical",boxSizing:"border-box"}} />
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{setBulkEditOpen(false);setBulkEditData({});}}
                    style={{flex:1,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"10px",color:"#e8f4fd",fontSize:14,cursor:"pointer"}}>Abbrechen</button>
                  <button onClick={applyBulkEdit}
                    style={{flex:1,background:"linear-gradient(135deg,#0ea5e9,#0284c7)",color:"#fff",border:"none",borderRadius:10,padding:10,fontSize:14,fontWeight:800,cursor:"pointer"}}>Speichern</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Suche / Sortierung */}
        <div style={{padding:"12px 16px 6px",position:"relative"}}>
          <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
            <div style={{flex:"1 1 0",minWidth:0,position:"relative"}}>
              <SearchBar filterText={filterText} setFilterText={setFilterText} />
            </div>
            <button onClick={()=>setShowSortMenu(s=>!s)}
              style={{flex:"1 1 0",minWidth:0,boxSizing:"border-box",display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 8px",color:"#fff",fontSize:12,cursor:"pointer"}}>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>⇅ {DIVE_SORT_OPTIONS.find(o=>o.id===sortId)?.label||"—"}</span>
              <span style={{flexShrink:0,marginLeft:4}}>{showSortMenu?"▾":"▸"}</span>
            </button>
          </div>
          {showSortMenu && (
            <div style={{marginTop:6,background:"#14253a",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,padding:6,maxHeight:280,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,0.4)",position:"absolute",right:16,zIndex:50,width:180}}>
              {DIVE_SORT_OPTIONS.map(o=>(
                <div key={o.id} onClick={()=>{setSortId(o.id);setShowSortMenu(false);}}
                  style={{padding:"9px 12px",borderRadius:8,fontSize:13,cursor:"pointer",color:o.id===sortId?"#7dd3fc":"rgba(232,244,253,0.75)",background:o.id===sortId?"rgba(14,165,233,0.15)":"transparent"}}>
                  {o.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Liste */}
      {dives.length === 0 ? (
        <div style={{padding:"40px 16px",textAlign:"center",color:"rgba(232,244,253,0.4)",fontSize:13}}>
          Noch keine Tauchgänge. Über 📥 eine CSV-Datei importieren oder mit „+ Tauchgang" manuell anlegen.
        </div>
      ) : years.length === 0 && noYear.length === 0 ? (
        <div style={{padding:"40px 16px",textAlign:"center",color:"rgba(232,244,253,0.4)",fontSize:13}}>Keine Treffer.</div>
      ) : (
        <div>
          {years.map(yr => {
            const yDives = sortDives(filtered.filter(d => d.year === yr), sortId, sortDir);
            const collapsed = collapsedYears.has(yr);
            const totalMin = yDives.reduce((s,d)=>s+(d.durationMin||0),0);
            return (
              <div key={yr}>
                <div onClick={()=>{
                    if (selectMode) {
                      const yearIds = yDives.map(d=>d.id);
                      const allSelected = yearIds.every(id=>selectedIds.has(id));
                      setSelectedIds(prev => {
                        const n = new Set(prev);
                        yearIds.forEach(id => allSelected ? n.delete(id) : n.add(id));
                        return n;
                      });
                    } else {
                      setCollapsedYears(s=>{const n=new Set(s);n.has(yr)?n.delete(yr):n.add(yr);return n;});
                    }
                  }}
                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 16px",cursor:"pointer",background:"rgba(255,255,255,0.02)",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {selectMode && (() => {
                      const yearIds = yDives.map(d=>d.id);
                      const allSelected = yearIds.length>0 && yearIds.every(id=>selectedIds.has(id));
                      return (
                        <div style={{flexShrink:0,width:18,height:18,borderRadius:5,border:`2px solid ${allSelected?"#7dd3fc":"rgba(232,244,253,0.3)"}`,background:allSelected?"#7dd3fc":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {allSelected && <span style={{color:"#0a1628",fontSize:11,fontWeight:900}}>✓</span>}
                        </div>
                      );
                    })()}
                    <span style={{fontWeight:700,color:"#38bdf8",fontSize:14}}>{yr} · {yDives.length} Tauchgänge</span>
                  </div>
                  <span style={{fontSize:12,color:"rgba(232,244,253,0.35)"}}>{fmtDuration(totalMin)} {collapsed?"▸":"▾"}</span>
                </div>
                {!collapsed && yDives.map(d => (
                  <DiveRow key={d.id} d={d} sortId={sortId} reiseNumbers={reiseNumbers}
                    selectMode={selectMode} isSelected={selectedIds.has(d.id)} onToggleSelect={toggleSelect}
                    onClick={()=>{setSelected(d);setReturnTo(null);setView("detail");}} />
                ))}
              </div>
            );
          })}
          {noYear.length > 0 && sortDives(noYear, sortId, sortDir).map(d => (
            <DiveRow key={d.id} d={d} sortId={sortId} reiseNumbers={reiseNumbers}
              selectMode={selectMode} isSelected={selectedIds.has(d.id)} onToggleSelect={toggleSelect}
              onClick={()=>{setSelected(d);setReturnTo(null);setView("detail");}} />
          ))}
        </div>
      )}
    </div>
  );
}
