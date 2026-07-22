const { useState, useEffect, useRef, useCallback, useMemo } = React;

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

function fmtDateShort(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getFullYear()).slice(2)}`;
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
      nitrox: clean(cols[19]),
      buddy: clean(cols[20]),
      bemerkungen: clean(cols[21]),
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

// ── Sorting / Search ────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { id: "number", label: "Nr." },
  { id: "date", label: "Datum" },
  { id: "depth", label: "Tiefe" },
  { id: "duration", label: "Dauer" },
  { id: "temp", label: "Wassertemp." },
];

function sortFieldValue(d, sortId) {
  switch (sortId) {
    case "date": return parseDateToTs(d.date);
    case "depth": return d.maxDepth || 0;
    case "duration": return d.durationMin || 0;
    case "temp": return d.waterTemp != null ? d.waterTemp : -999;
    case "number":
    default: return parseInt(d.name || "0", 10);
  }
}

function formatSortValue(d, sortId) {
  switch (sortId) {
    case "date": return d.date || "—";
    case "depth": return d.maxDepth != null ? `${d.maxDepth} m` : "—";
    case "duration": return fmtDuration(d.durationMin);
    case "temp": return d.waterTemp != null ? `${d.waterTemp}°` : "—";
    default: return d.name;
  }
}

function sortDives(dives, sortId, dir) {
  const sorted = [...dives].sort((a, b) => sortFieldValue(a, sortId) - sortFieldValue(b, sortId));
  return dir === "asc" ? sorted : sorted.reverse();
}

function matchDives(dives, q) {
  if (!q || !q.trim()) return dives;
  const s = q.trim().toLowerCase();
  return dives.filter(d => {
    const haystack = [
      d.name, d.date, d.ort, d.land, d.tauchspot, d.buddy,
      d.anzug, d.flasche, d.nitrox, d.bemerkungen,
    ].join(" ").toLowerCase();
    return haystack.includes(s);
  });
}

// ── Small shared field components (same pattern as Flugbuch) ───────────────
function EditableTitle({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  const commit = () => { setEditing(false); if (val.trim() !== (value || "") && val.trim() !== "") onSave(val.trim()); };
  if (editing) {
    return (
      <input value={val} onChange={e=>setVal(e.target.value)} onBlur={commit} autoFocus
        onKeyDown={e=>{ if(e.key==="Enter"){e.preventDefault();commit();} }}
        style={{fontSize:22,fontWeight:800,marginBottom:4,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(56,189,248,0.4)",borderRadius:8,padding:"2px 8px",color:"#e8f4fd",width:"100%",boxSizing:"border-box"}} />
    );
  }
  return (
    <div onClick={()=>{setVal(value||"");setEditing(true);}} style={{fontSize:22,fontWeight:800,marginBottom:4,cursor:"pointer"}}>
      Tauchgang {value||"—"}
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

// ── List row ─────────────────────────────────────────────────────────────
function DiveRow({ d, onClick, sortId }) {
  const showSortValue = sortId && sortId !== "date" && sortId !== "number";
  return (
    <div onClick={onClick}
      style={{padding:"11px 16px",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}
      onMouseEnter={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.03)"; }}
      onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; }}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
          <span style={{fontWeight:700,fontSize:15}}>{d.name}</span>
          <span style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            {d.nitrox==="Ja" && <span style={{background:"rgba(34,197,94,0.18)",color:"#4ade80",borderRadius:20,padding:"1px 7px",fontSize:9,fontWeight:700}}>NITROX</span>}
            {d.buddy && <span style={{border:"1px solid rgba(232,244,253,0.15)",borderRadius:20,padding:"1px 7px",fontSize:9,color:"rgba(232,244,253,0.5)"}}>👤 {d.buddy}</span>}
          </span>
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

// ── Search bar (simplified, text-only) ──────────────────────────────────
function SearchBar({ filterText, setFilterText }) {
  return (
    <div style={{position:"relative"}}>
      <input value={filterText} onChange={e=>setFilterText(e.target.value)} placeholder="🔍 Suchen…"
        style={{width:"100%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 34px 8px 12px",color:"#e8f4fd",fontSize:13,boxSizing:"border-box"}} />
      {filterText && (
        <button onClick={()=>setFilterText("")}
          style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"rgba(232,244,253,0.4)",cursor:"pointer",fontSize:14}}>✕</button>
      )}
    </div>
  );
}

// ── Detail view ──────────────────────────────────────────────────────────
function DetailContent({ d, dives, setDives, setSelected, setView, saveDive, confirmDelete, setConfirmDelete }) {
  const dIdx = dives.findIndex(x => x.id === d.id);
  const [bemerkungenEditing, setBemerkungenEditing] = useState(false);
  const [bemerkungenVal, setBemerkungenVal] = useState(d.bemerkungen || "");
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

  const goToDive = (delta) => {
    const next = dives[dIdx + delta];
    if (!next) return;
    setSelected(next);
    setBemerkungenVal(next.bemerkungen || "");
  };

  return (
    <div style={{maxWidth:480,margin:"0 auto",padding:"0 0 32px",background:"#040e20",minHeight:"100vh",color:"#e8f4fd",fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"calc(16px + env(safe-area-inset-top, 0px)) 16px 10px"}}>
        <button onClick={()=>setView("list")} style={{background:"none",border:"none",color:"#38bdf8",fontSize:22,cursor:"pointer"}}>←</button>
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
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:2}}>
          <span style={{fontSize:11,color:"#38bdf8"}}>{d.date} {d.time?"· "+d.time:""}</span>
          {d.nitrox==="Ja" && <span style={{background:"rgba(34,197,94,0.2)",color:"#4ade80",borderRadius:20,padding:"2px 10px",fontSize:10,fontWeight:700}}>NITROX</span>}
        </div>
        <EditableTitle value={d.name} onSave={v=>saveField({name:v})} />
        <div style={{fontSize:13,color:"rgba(232,244,253,0.5)",marginBottom:14}}>
          {d.tauchspot||"—"}{d.ort?" · "+d.ort:""}
        </div>

        {/* Kennzahlen */}
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          <div style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"10px 12px",textAlign:"center"}}>
            <div style={{fontSize:10,color:"rgba(232,244,253,0.4)",textTransform:"uppercase",letterSpacing:0.5}}>Dauer</div>
            <div style={{fontSize:16,fontWeight:700,color:"#38bdf8",marginTop:2}}>{fmtDuration(d.durationMin)}</div>
          </div>
          <div style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"10px 12px",textAlign:"center"}}>
            <div style={{fontSize:10,color:"rgba(232,244,253,0.4)",textTransform:"uppercase",letterSpacing:0.5}}>max. Tiefe</div>
            <div style={{fontSize:16,fontWeight:700,color:"#38bdf8",marginTop:2}}>{d.maxDepth!=null?d.maxDepth+" m":"—"}</div>
          </div>
          <div style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"10px 12px",textAlign:"center"}}>
            <div style={{fontSize:10,color:"rgba(232,244,253,0.4)",textTransform:"uppercase",letterSpacing:0.5}}>Wasser</div>
            <div style={{fontSize:16,fontWeight:700,color:"#38bdf8",marginTop:2}}>{d.waterTemp!=null?d.waterTemp+"°":"—"}</div>
          </div>
        </div>

        {/* Felder */}
        <div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,padding:"4px 15px",marginBottom:14,border:"1px solid rgba(255,255,255,0.06)"}}>
          <InlineField label="Datum" value={d.date} onSave={v=>saveField({date:v, year: parseDateToTs(v)?String(new Date(parseDateToTs(v)).getFullYear()):d.year})} />
          <InlineField label="Zeit" value={d.time} onSave={v=>saveField({time:v})} />
          <InlineField label="Land" value={d.land} onSave={v=>saveField({land:v})} />
          <InlineField label="Ort" value={d.ort} onSave={v=>saveField({ort:v})} />
          <InlineField label="TG-Nr." value={d.tgNr} onSave={v=>saveField({tgNr:v})} />
          <InlineField label="Tauchspot" value={d.tauchspot} onSave={v=>saveField({tauchspot:v})} />
          <InlineField label="Dauer" value={d.durationStr} onSave={v=>saveField({durationStr:v, durationMin:parseDurationToMin(v)})} />
          <InlineField label="max. Tiefe" value={d.maxDepth!=null?String(d.maxDepth):""} unit="m" onSave={v=>saveField({maxDepth: v===""?null:parseFloat(v.replace(",","."))})} />
          <InlineField label="Wassertemp." value={d.waterTemp!=null?String(d.waterTemp):""} unit="°C" onSave={v=>saveField({waterTemp: v===""?null:parseFloat(v.replace(",","."))})} />
          <InlineField label="Anzug" value={d.anzug} onSave={v=>saveField({anzug:v})} />
          <InlineField label="Blei" value={d.blei} unit="kg" onSave={v=>saveField({blei:v})} />
          <InlineField label="Flasche" value={d.flasche} onSave={v=>saveField({flasche:v})} />
          <InlineField label="Volumen" value={d.volumen} onSave={v=>saveField({volumen:v})} />
          <InlineField label="Nitrox" value={d.nitrox} onSave={v=>saveField({nitrox:v})} />
          <InlineField label="Buddy" value={d.buddy} onSave={v=>saveField({buddy:v})} />
        </div>

        {/* Bemerkungen */}
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
  const [filterText, setFilterText] = useState("");
  const [sortId, setSortId] = useState("number");
  const [sortDir, setSortDir] = useState("desc");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [collapsedYears, setCollapsedYears] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [importMsg, setImportMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      let loaded = [];
      try {
        const keys = await window.storage.list("dive:");
        const raw = await Promise.all((keys?.keys||[]).map(async k => {
          try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } catch { return null; }
        }));
        loaded = raw.filter(Boolean);
      } catch (e) { console.error("Storage load error:", e); }
      setDives(sortByNumber(loaded));
      setLoaded(true);
      try {
        const params = new URLSearchParams(window.location.search);
        const openId = params.get("openDiveId");
        if (openId) {
          const target = loaded.find(d => String(d.id) === openId);
          if (target) { setSelected(target); setView("detail"); }
        }
      } catch {}
    })();
  }, []);

  const saveDive = useCallback(async (d) => {
    try { await window.storage.set(`dive:${d.id}`, JSON.stringify(d)); } catch (e) { console.error("Save error:", e); }
  }, []);

  const addNewDive = useCallback(async () => {
    const maxNr = dives.reduce((m,d)=>Math.max(m, parseInt(d.name||"0",10)), 0);
    const newNr = maxNr + 1;
    const now = new Date();
    const dd = String(now.getDate()).padStart(2,"0");
    const mm = String(now.getMonth()+1).padStart(2,"0");
    const yyyy = String(now.getFullYear());
    const newDive = {
      id: `dive_${newNr}`,
      name: String(newNr),
      date: `${dd}.${mm}.${yyyy}`,
      year: yyyy,
      time: "", land: "", ort: "", tgNr: "", tauchspot: "",
      durationStr: "", durationMin: 0, maxDepth: null, waterTemp: null,
      anzug: "", blei: "", flasche: "", volumen: "", nitrox: "", buddy: "", bemerkungen: "",
      customFields: { reise: "" },
    };
    await saveDive(newDive);
    setDives(prev => sortByNumber([newDive, ...prev]));
    setSelected(newDive);
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
        ? { ...existing, ...p, id: existing.id, customFields: { ...(existing.customFields||{}), ...(p.customFields||{}) } }
        : p;
      if (existing) updated++; else created++;
      await saveDive(merged);
      const idx = updatedList.findIndex(d => d.id === merged.id);
      if (idx >= 0) updatedList[idx] = merged; else updatedList.push(merged);
      setImportProgress({ done: i+1, total: parsed.length });
    }
    setDives(sortByNumber(updatedList));
    setImportProgress(null);
    setImporting(false);
    setShowImportMenu(false);
    setImportMsg(`✓ ${created} neu, ${updated} aktualisiert (${parsed.length} erkannt)`);
  }, [dives, saveDive]);

  const importCsvFile = useCallback(async (file) => {
    try {
      const text = await file.text();
      await importCsvText(text);
    } catch (e) {
      setImportMsg("Fehler beim Import: " + e.message);
      setImporting(false);
    }
  }, [importCsvText]);

  if (!loaded) return null;

  if (view === "detail" && selected) {
    return (
      <DetailContent d={selected} dives={sortByNumber(dives)} setDives={setDives} setSelected={setSelected}
        setView={setView} saveDive={saveDive} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} />
    );
  }

  const filtered = matchDives(dives, filterText);
  const years = [...new Set(filtered.map(d => d.year).filter(Boolean))].sort((a,b)=>b-a);
  const noYear = filtered.filter(d => !d.year);

  return (
    <div style={{maxWidth:480,margin:"0 auto",minHeight:"100vh",background:"#040e20",color:"#e8f4fd",fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif"}}>
      <input ref={fileRef} type="file" accept=".csv" style={{display:"none"}} onChange={e=>e.target.files[0]&&importCsvFile(e.target.files[0])} />

      {/* Header */}
      <div style={{position:"sticky",top:0,zIndex:10,background:"#040e20"}}>
        <div style={{background:"rgba(255,255,255,0.03)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"calc(28px + env(safe-area-inset-top, 0px)) 16px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",backdropFilter:"blur(10px)"}}>
          <button onClick={()=>{window.location.href="index.html";}} title="Nach oben"
            style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:"rgba(232,244,253,0.8)",cursor:"pointer",flexShrink:0}}>
            🏠
          </button>
          <span style={{fontWeight:900,fontSize:18,letterSpacing:-0.5,flex:1,textAlign:"center",marginLeft:-8}}>
            🤿 Tauchbuch
          </span>
          <div style={{display:"flex",gap:8,flexShrink:0}}>
            <button onClick={addNewDive} style={{background:"rgba(34,197,94,0.15)",color:"#4ade80",border:"1px solid rgba(34,197,94,0.25)",borderRadius:20,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>+ Tauchgang</button>
          </div>
        </div>

        {/* Icon-Buttons: Import / Reisen / Statistik / Richtung / Jahr */}
        <div style={{padding:"10px 16px 0",display:"flex",gap:8}}>
          <button onClick={()=>setShowImportMenu(m=>!m)} title="CSV Import"
            style={{flex:"1 1 0",minWidth:0,aspectRatio:"1",boxSizing:"border-box",display:"flex",alignItems:"center",justifyContent:"center",background:showImportMenu?"rgba(56,189,248,0.15)":"rgba(255,255,255,0.05)",border:`1px solid ${showImportMenu?"rgba(56,189,248,0.35)":"rgba(255,255,255,0.1)"}`,borderRadius:10,color:"#fff",fontSize:19,cursor:"pointer"}}>
            📥
          </button>
          <button onClick={()=>{window.location.href="reisen.html";}} title="Reisen"
            style={{flex:"1 1 0",minWidth:0,aspectRatio:"1",boxSizing:"border-box",display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(245,166,35,0.15)",border:"1px solid rgba(245,166,35,0.25)",borderRadius:10,color:"#fff",fontSize:19,cursor:"pointer"}}>
            🧭
          </button>
          <button onClick={()=>{window.location.href="statistik.html";}} title="Statistik"
            style={{flex:"1 1 0",minWidth:0,aspectRatio:"1",boxSizing:"border-box",display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(245,158,11,0.15)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:10,color:"#fff",fontSize:19,cursor:"pointer"}}>
            📊
          </button>
          <button onClick={()=>setSortDir(d=>d==="asc"?"desc":"asc")} title={sortDir==="asc"?"Aufsteigend":"Absteigend"}
            style={{flex:"1 1 0",minWidth:0,aspectRatio:"1",boxSizing:"border-box",display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"#fff",fontSize:19,cursor:"pointer"}}>
            {sortDir==="asc"?"↑":"↓"}
          </button>
          <button onClick={()=>setCollapsedYears(s=>s.size===0?new Set(years):new Set())} title={collapsedYears.size===0?"Alle reduzieren":"Alle erweitern"}
            style={{flex:"1 1 0",minWidth:0,aspectRatio:"1",boxSizing:"border-box",display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"#fff",fontSize:15,fontWeight:700,letterSpacing:1,cursor:"pointer"}}>
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
        {importMsg && (
          <div style={{padding:"6px 16px 0",fontSize:11,color:importMsg.startsWith("✓")?"#4ade80":"#f87171"}}>
            {importMsg}
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

        {/* Suche / Sortierung */}
        <div style={{padding:"12px 16px 6px",position:"relative"}}>
          <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
            <div style={{flex:"1 1 0",minWidth:0,position:"relative"}}>
              <SearchBar filterText={filterText} setFilterText={setFilterText} />
            </div>
            <button onClick={()=>setShowSortMenu(s=>!s)}
              style={{flex:"1 1 0",minWidth:0,boxSizing:"border-box",display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 8px",color:"#fff",fontSize:12,cursor:"pointer"}}>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>⇅ {SORT_OPTIONS.find(o=>o.id===sortId)?.label||"—"}</span>
              <span style={{flexShrink:0,marginLeft:4}}>{showSortMenu?"▾":"▸"}</span>
            </button>
          </div>
          {showSortMenu && (
            <div style={{marginTop:6,background:"#14253a",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,padding:6,maxHeight:280,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,0.4)",position:"absolute",right:16,zIndex:50,width:160}}>
              {SORT_OPTIONS.map(o=>(
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
          Noch keine Tauchgänge. Über 📥 eine CSV-Datei importieren oder mit „+ Tauchgang“ manuell anlegen.
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
                <div onClick={()=>setCollapsedYears(s=>{const n=new Set(s);n.has(yr)?n.delete(yr):n.add(yr);return n;})}
                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 16px",cursor:"pointer",background:"rgba(255,255,255,0.02)",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <span style={{fontWeight:700,color:"#38bdf8",fontSize:14}}>{yr} · {yDives.length} Tauchgänge</span>
                  <span style={{fontSize:12,color:"rgba(232,244,253,0.35)"}}>{fmtDuration(totalMin)} {collapsed?"▸":"▾"}</span>
                </div>
                {!collapsed && yDives.map(d => (
                  <DiveRow key={d.id} d={d} sortId={sortId}
                    onClick={()=>{setSelected(d);setView("detail");}} />
                ))}
              </div>
            );
          })}
          {noYear.length > 0 && sortDives(noYear, sortId, sortDir).map(d => (
            <DiveRow key={d.id} d={d} sortId={sortId} onClick={()=>{setSelected(d);setView("detail");}} />
          ))}
        </div>
      )}
    </div>
  );
}
