const { useState, useEffect, useCallback } = React;

const APP_VERSION = "0.1.1";

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

function fmtDuration(min) {
  if (!min) return "—";
  if (min >= 60) return `${Math.floor(min/60)}h ${String(min%60).padStart(2,"0")}m`;
  return `${min} min`;
}

// Jede Reise = alle Tauchgänge mit demselben customFields.reise-Wert. Beim
// ersten Laden im Tauchbuch wird jeder vorkommende "Ort" automatisch als
// eigene Reise angelegt (siehe ensureReisen in tauchbuch.jsx) — hier wird
// nur aggregiert und verwaltet (umbenennen, neu anlegen, Reihenfolge).
function aggregateReisen(dives) {
  const groups = new Map();
  dives.forEach(d => {
    const name = d.customFields?.reise;
    if (!name) return;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(d);
  });
  const trips = [...groups.entries()].map(([name, dl]) => {
    const sorted = [...dl].sort((a,b) => parseDateToTs(a.date) - parseDateToTs(b.date));
    const totalMin = sorted.reduce((s,d) => s + (d.durationMin||0), 0);
    const maxDepth = sorted.reduce((m,d) => Math.max(m, d.maxDepth||0), 0);
    const nums = sorted.map(d => parseInt(d.name||"0",10)).filter(Boolean);
    const first = sorted.length ? parseDateToTs(sorted[0].date) : 0;
    const last = sorted.length ? parseDateToTs(sorted[sorted.length-1].date) : 0;
    return {
      name,
      dives: sorted,
      count: sorted.length,
      totalMin,
      timePerDive: sorted.length ? Math.round(totalMin/sorted.length) : 0,
      maxDepth,
      numMin: nums.length ? Math.min(...nums) : null,
      numMax: nums.length ? Math.max(...nums) : null,
      firstDate: first,
      lastDate: last,
    };
  });
  return trips;
}

function SummaryChip({ label, value }) {
  return (
    <span style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"5px 10px",whiteSpace:"nowrap",flexShrink:0}}>
      <span style={{fontSize:9,color:"rgba(232,244,253,0.4)",textTransform:"uppercase",letterSpacing:0.3}}>{label}</span>
      <span style={{fontSize:13,fontWeight:700,color:"rgba(232,244,253,0.9)"}}>{value}</span>
    </span>
  );
}

function ReisenApp() {
  const [dives, setDives] = useState([]);
  const [names, setNames] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState("");
  const [manageOpen, setManageOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const keys = await window.storage.list("dive:");
        const raw = await Promise.all((keys?.keys||[]).map(async k => {
          try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } catch { return null; }
        }));
        setDives(raw.filter(Boolean));
      } catch (e) { console.error("Load error (dives):", e); }
      try {
        const r = await window.storage.get("tauchreisen:names");
        if (r) setNames(JSON.parse(r.value) || []);
      } catch (e) { console.error("Load error (names):", e); }
      setLoaded(true);
    })();
  }, []);

  const saveNames = useCallback(async (next) => {
    setNames(next);
    try { await window.storage.set("tauchreisen:names", JSON.stringify(next)); } catch (e) { console.error("Save error:", e); }
  }, []);

  const addName = () => {
    const n = newName.trim();
    if (!n || names.includes(n)) return;
    saveNames([n, ...names]);
    setNewName("");
  };

  const renameManagedTrip = async (oldName, newName) => {
    if (!newName.trim()) return;
    saveNames(names.map(n => n === oldName ? newName : n));
    for (const d of dives) {
      if (d.customFields?.reise === oldName) {
        const updated = { ...d, customFields: { ...d.customFields, reise: newName } };
        try { await window.storage.set(`dive:${d.id}`, JSON.stringify(updated)); } catch {}
      }
    }
    setDives(prev => prev.map(d => d.customFields?.reise === oldName
      ? { ...d, customFields: { ...d.customFields, reise: newName } } : d));
  };

  if (!loaded) return null;

  // Reisen automatisch nach dem Datum des letzten Tauchgangs sortiert —
  // die neuste Reise erscheint zuerst (ganz links).
  const trips = aggregateReisen(dives).sort((a, b) => b.lastDate - a.lastDate);

  return (
    <div style={{minHeight:"100vh",background:"#241805",color:"#e8f4fd",fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif",paddingBottom:40}}>
      <div style={{background:"rgba(255,255,255,0.03)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"calc(28px + env(safe-area-inset-top, 0px)) 16px 12px",display:"flex",alignItems:"center",position:"sticky",top:0,zIndex:10,backdropFilter:"blur(10px)"}}>
        <button onClick={()=>{window.location.href="index.html";}} title="Zum Tauchbuch"
          style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:"rgba(232,244,253,0.8)",cursor:"pointer",flexShrink:0}}>
          🏠
        </button>
        <span style={{fontWeight:900,fontSize:18,letterSpacing:-0.5,flex:1,textAlign:"center",marginLeft:-32}}>
          🧭 Tauch-Reisen {trips.length > 0 && <span style={{fontSize:12,fontWeight:600,color:"rgba(232,244,253,0.4)"}}>({trips.length})</span>}
        </span>
      </div>

      <div style={{padding:"14px 16px 0"}}>
        <div onClick={()=>setManageOpen(o=>!o)}
          style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",marginBottom:manageOpen?8:0}}>
          <span style={{fontSize:11,color:"rgba(232,244,253,0.4)",textTransform:"uppercase",letterSpacing:0.5}}>Reisen verwalten</span>
          <span style={{color:"rgba(232,244,253,0.4)",fontSize:12}}>{manageOpen?"▾":"▸"}</span>
        </div>
        {manageOpen && (<>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {names.map((n) => (
            <div key={n} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"6px 8px"}}>
              <input value={n} onChange={e=>renameManagedTrip(n, e.target.value)}
                style={{flex:1,background:"transparent",border:"none",color:"#e8f4fd",fontSize:14,padding:"4px 6px",minWidth:0}} />
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <input value={newName} onChange={e=>setNewName(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter") addName(); }}
            placeholder="Name der neuen Reise (z.B. Rotes Meer 2026)"
            style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"9px 12px",color:"#e8f4fd",fontSize:14,boxSizing:"border-box"}} />
          <button onClick={addName}
            style={{background:"rgba(245,166,35,0.18)",border:"1px solid rgba(245,166,35,0.4)",borderRadius:10,padding:"9px 16px",color:"#f5a623",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
            + Anlegen
          </button>
        </div>
        <div style={{fontSize:11,color:"rgba(232,244,253,0.35)",marginTop:8,lineHeight:1.5}}>
          Jeder Ort aus deinen Tauchgängen wird beim Import automatisch als eigene Reise angelegt. Die Reihenfolge der Reisen-Karten unten richtet sich automatisch nach dem Datum des letzten Tauchgangs (neuste zuerst). Hier kannst du Reisen nur umbenennen oder neue anlegen.
        </div>
        </>)}
      </div>

      <div style={{padding:"16px 0 0 16px",display:"flex",gap:10,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        {trips.length === 0 && (
          <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"20px 16px",textAlign:"center",color:"rgba(232,244,253,0.4)",fontSize:13,minWidth:280,marginRight:16}}>
            Noch keine Tauchgänge einer Reise zugeordnet. Tauchgänge im Tauchbuch importieren — die Zuordnung erfolgt dann automatisch nach Ort.
          </div>
        )}
        {trips.map((trip, tripIdx) => (
          <div key={trip.name} style={{flexShrink:0,width:340,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,overflow:"hidden"}}>
            <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:10,background:"rgba(245,166,35,0.08)",borderBottom:"1px solid rgba(245,166,35,0.15)"}}>
              <span style={{fontSize:12,fontWeight:700,color:"#f5a623",background:"rgba(245,166,35,0.18)",borderRadius:20,width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {trips.length - tripIdx}
              </span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,color:"#e8f4fd",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{trip.name}</div>
                <div style={{fontSize:11,color:"rgba(232,244,253,0.4)",marginTop:1,whiteSpace:"nowrap"}}>
                  {fmtDateShort(trip.firstDate)} – {fmtDateShort(trip.lastDate)}
                </div>
              </div>
            </div>

            <div style={{padding:"12px 16px 16px"}}>
              <div style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 12px",marginBottom:12}}>
                <div style={{fontSize:10,color:"rgba(232,244,253,0.4)",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>
                  Tauchgänge
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {trip.dives.map((d, idx) => {
                    const ts = parseDateToTs(d.date);
                    const dateLabel = ts ? fmtDateShort(ts) : (d.date || "—");
                    return (
                    <div key={d.id}
                      onClick={()=>{
                        window.location.href = `index.html?openDiveId=${encodeURIComponent(d.id)}&returnTo=${encodeURIComponent("reisen.html")}`;
                      }}
                      style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,cursor:"pointer",gap:6}}>
                      <span style={{color:"rgba(232,244,253,0.5)",width:20,flexShrink:0}}>{idx+1}</span>
                      <span style={{color:"rgba(232,244,253,0.6)",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {d.name} · {dateLabel} · {d.tauchspot||"—"}
                        {d.rating>0 && <span style={{color:"#fde047",fontSize:10,fontWeight:700,marginLeft:4}}>{d.rating}⭐️</span>}
                      </span>
                      {d.maxDepth!=null && <span style={{color:"rgba(232,244,253,0.35)",fontSize:11,flexShrink:0}}>{d.maxDepth}m</span>}
                      <span style={{color:"#f5a623",fontWeight:700,flexShrink:0}}>{fmtDuration(d.durationMin)}</span>
                    </div>
                    );
                  })}
                </div>
              </div>

              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                <SummaryChip label="Tauchgänge" value={trip.count} />
                <SummaryChip label="Gesamtzeit" value={fmtDuration(trip.totalMin)} />
                <SummaryChip label="Zeit/TG" value={fmtDuration(trip.timePerDive)} />
                <SummaryChip label="max. Tiefe" value={trip.maxDepth?trip.maxDepth+" m":"—"} />
                <SummaryChip label="Nr." value={trip.numMin && trip.numMax ? `${trip.numMin} – ${trip.numMax}` : "—"} />
              </div>
            </div>
          </div>
        ))}
        <div style={{flexShrink:0,width:8}} />
      </div>
      <div style={{textAlign:"center",padding:"18px 16px 8px",fontSize:10,color:"rgba(232,244,253,0.25)"}}>Tauchbuch v{APP_VERSION}</div>
    </div>
  );
}
