const { useState, useEffect, useRef } = React;

const APP_VERSION = "1.4";

// ── Startseite ───────────────────────────────────────────────────────────
// Editierbares Titelbild (per Tap austauschbar, als Data-URL in Storage
// gesichert) + vier Kapitel-Kacheln zu den Unterseiten.
const CHAPTERS = [
  { key: "tauchgaenge", label: "Tauchgänge", icon: "🤿", href: "tauchbuch.html", color: "#38bdf8", bg: "rgba(56,189,248,0.1)", border: "rgba(56,189,248,0.25)" },
  { key: "reisen", label: "Reisen", icon: "🧭", href: "reisen.html", color: "#f5a623", bg: "rgba(245,166,35,0.1)", border: "rgba(245,166,35,0.25)" },
  { key: "material", label: "Material", icon: "🎒", href: "material.html", color: "#4ade80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.25)" },
  { key: "statistik", label: "Statistik", icon: "📊", href: "statistik.html", color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
];

// Änderungsverlauf — neuste zuerst. Wird beim Erhöhen der Version jeweils
// von Hand ergänzt.
const CHANGELOG = [
  { version: "1.4", changes: [
    "Tauchgang-Detail: Tauchspot steht jetzt in Rot neben dem Titel (gleiche Grösse wie Reise/Nr.-Badge)",
  ]},
  { version: "1.3", changes: [
    "Titel auf der Startseite: „meintauchbuch“ in Kleinbuchstaben, „tauch“ in Orange",
  ]},
  { version: "1.2", changes: [
    "Settings-Panel (Zahnrad-Button) mit Fehler-Log und Notizen",
    "Fehler-Protokollierung jetzt seitenübergreifend",
  ]},
  { version: "1.1", changes: [
    "Neue Startseite mit editierbarem Titelbild und 4 Kapiteln",
    "Neues Kapitel „Material“ (Regulator, BCD, Anzug, Maske, Finns, Uhr/Computer)",
    "Tauchbuch-Liste: Gruppierung wahlweise nach Jahr oder Reise",
    "Reisen: manuelle Sortierung der Verwaltungsliste per Pfeilen; Kartenreihenfolge weiterhin automatisch nach Datum",
    "Material: aufklappbare Revisionsdaten bei Regulator, BCD, Anzug, Uhr/Computer",
    "Gesamtzahl Tauchgänge/Reisen auf Startseite, im Tauchbuch und bei den Reisen sichtbar",
  ]},
  { version: "0.2.0", changes: [
    "Mehrfachauswahl: Kopieren, Sammel-Bearbeiten, Löschen, Tauchreise zuordnen",
    "Suche erweitert auf alle Felder inkl. mehrzeiliger Abfragen (UND/ODER)",
    "Sortierung um alle Tauchgangsfelder erweitert",
    "Drei frei editierbare Info-Badges, Nitrox/Air-Auswahl, Wischgeste zwischen Tauchgängen",
    "Neuer Tauchgang übernimmt Ausrüstung des vorherigen",
  ]},
  { version: "0.1.1", changes: [
    "App-Icon aus eigenem Foto",
    "Bewertung vor Zeit verschoben",
  ]},
  { version: "0.1", changes: [
    "Erste Version: Tauchbuch mit CSV-Import, Liste/Detail, Reisen/Statistik als Platzhalter, Backup",
  ]},
];

function SettingsPanel({ onClose }) {
  const [tab, setTab] = useState("logs"); // logs | notes | changelog
  const [logs, setLogs] = useState([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("settings:logs");
        if (r) setLogs(JSON.parse(r.value) || []);
      } catch {}
      setLogsLoaded(true);
      try {
        const r2 = await window.storage.get("settings:notes");
        if (r2) setNotes(r2.value || "");
      } catch {}
      setNotesLoaded(true);
    })();
  }, []);

  const clearLogs = async () => {
    setLogs([]);
    try { await window.storage.set("settings:logs", JSON.stringify([])); } catch {}
  };

  const copyLogs = async () => {
    const text = logs.map(l => `[${l.ts}] (${l.page}) ${l.message}`).join("\n");
    try { await navigator.clipboard.writeText(text || "Keine Log-Einträge."); setMsg("✓ Kopiert."); }
    catch (e) { setMsg("Fehler: " + e.message); }
  };

  const commitNotes = async () => {
    try { await window.storage.set("settings:notes", notes); } catch (e) { console.error("Notizen-Speicherfehler:", e); }
  };

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:"#0a1628",borderTopLeftRadius:18,borderTopRightRadius:18,padding:"16px 16px calc(20px + env(safe-area-inset-bottom, 0px))",maxWidth:480,width:"100%",maxHeight:"80vh",display:"flex",flexDirection:"column",border:"1px solid rgba(255,255,255,0.1)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <span style={{fontSize:15,fontWeight:800}}>⚙️ Einstellungen</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(232,244,253,0.5)",fontSize:20,cursor:"pointer"}}>✕</button>
        </div>

        <div style={{display:"flex",gap:6,marginBottom:12}}>
          <button onClick={()=>setTab("logs")}
            style={{flex:1,background:tab==="logs"?"rgba(56,189,248,0.15)":"rgba(255,255,255,0.05)",border:`1px solid ${tab==="logs"?"rgba(56,189,248,0.35)":"rgba(255,255,255,0.1)"}`,borderRadius:10,padding:"9px 6px",color:tab==="logs"?"#7dd3fc":"rgba(232,244,253,0.6)",fontSize:13,fontWeight:700,cursor:"pointer"}}>
            📋 Log-Dateien
          </button>
          <button onClick={()=>setTab("notes")}
            style={{flex:1,background:tab==="notes"?"rgba(56,189,248,0.15)":"rgba(255,255,255,0.05)",border:`1px solid ${tab==="notes"?"rgba(56,189,248,0.35)":"rgba(255,255,255,0.1)"}`,borderRadius:10,padding:"9px 6px",color:tab==="notes"?"#7dd3fc":"rgba(232,244,253,0.6)",fontSize:13,fontWeight:700,cursor:"pointer"}}>
            📝 Notizen
          </button>
          <button onClick={()=>setTab("changelog")}
            style={{flex:1,background:tab==="changelog"?"rgba(56,189,248,0.15)":"rgba(255,255,255,0.05)",border:`1px solid ${tab==="changelog"?"rgba(56,189,248,0.35)":"rgba(255,255,255,0.1)"}`,borderRadius:10,padding:"9px 6px",color:tab==="changelog"?"#7dd3fc":"rgba(232,244,253,0.6)",fontSize:13,fontWeight:700,cursor:"pointer"}}>
            📜 Änderungen
          </button>
        </div>

        {tab==="logs" && logsLoaded && (
          <>
            <div style={{flex:1,overflowY:"auto",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:10,border:"1px solid rgba(255,255,255,0.06)",minHeight:120}}>
              {logs.length === 0 ? (
                <div style={{fontSize:12,color:"rgba(232,244,253,0.3)",textAlign:"center",padding:"20px 0"}}>Keine Einträge — bisher lief alles fehlerfrei.</div>
              ) : (
                [...logs].reverse().map((l, i) => (
                  <div key={i} style={{fontSize:11,fontFamily:"monospace",color:"#f87171",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",whiteSpace:"pre-wrap"}}>
                    <div style={{color:"rgba(232,244,253,0.4)",marginBottom:2}}>{l.ts} · {l.page}</div>
                    {l.message}
                  </div>
                ))
              )}
            </div>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button onClick={copyLogs} style={{flex:1,background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:10,padding:"9px",color:"#4ade80",fontSize:13,fontWeight:700,cursor:"pointer"}}>📋 Kopieren</button>
              <button onClick={clearLogs} style={{flex:1,background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,padding:"9px",color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer"}}>🗑 Leeren</button>
            </div>
            {msg && <div style={{fontSize:11,color:"#4ade80",marginTop:6,textAlign:"center"}}>{msg}</div>}
          </>
        )}

        {tab==="notes" && notesLoaded && (
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} onBlur={commitNotes}
            placeholder="Allgemeine Notizen…"
            style={{flex:1,minHeight:200,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:12,color:"#e8f4fd",fontSize:14,resize:"vertical",boxSizing:"border-box"}} />
        )}

        {tab==="changelog" && (
          <div style={{flex:1,overflowY:"auto",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"4px 14px",border:"1px solid rgba(255,255,255,0.06)"}}>
            {CHANGELOG.map((entry, i) => (
              <div key={i} style={{padding:"12px 0",borderBottom:i<CHANGELOG.length-1?"1px solid rgba(255,255,255,0.06)":"none"}}>
                <div style={{fontSize:13,fontWeight:800,color:"#7dd3fc",marginBottom:6}}>v{entry.version}</div>
                <ul style={{margin:0,paddingLeft:18,display:"flex",flexDirection:"column",gap:4}}>
                  {entry.changes.map((c, j) => (
                    <li key={j} style={{fontSize:12,color:"rgba(232,244,253,0.7)",lineHeight:1.5}}>{c}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HomeApp() {
  const [coverSrc, setCoverSrc] = useState("cover.jpg");
  const [loaded, setLoaded] = useState(false);
  const [diveCount, setDiveCount] = useState(0);
  const [reiseCount, setReiseCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("home:coverImage");
        if (r && r.value) setCoverSrc(r.value);
      } catch {}
      try {
        const keys = await window.storage.list("dive:");
        const ids = keys?.keys || [];
        setDiveCount(ids.length);
        const raw = await Promise.all(ids.map(async k => {
          try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } catch { return null; }
        }));
        const reiseSet = new Set(raw.filter(Boolean).map(d => d.customFields?.reise).filter(Boolean));
        setReiseCount(reiseSet.size);
      } catch (e) { console.error("Count load error:", e); }
      setLoaded(true);
    })();
  }, []);

  const onPickImage = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      setCoverSrc(dataUrl);
      try { await window.storage.set("home:coverImage", dataUrl); } catch (e) { console.error("Cover-Speicherfehler:", e); }
    };
    reader.readAsDataURL(file);
  };

  if (!loaded) return null;

  const subtitleFor = (key) => {
    if (key === "tauchgaenge") return diveCount ? `${diveCount} Tauchgänge` : null;
    if (key === "reisen") return reiseCount ? `${reiseCount} Reisen` : null;
    return null;
  };

  return (
    <div style={{minHeight:"100vh",background:"#040e20",color:"#e8f4fd",fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif",paddingBottom:40}}>
      <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}}
        onChange={e=>{ onPickImage(e.target.files[0]); e.target.value=""; }} />

      {/* Titelbild */}
      <div onClick={()=>fileRef.current?.click()}
        style={{position:"relative",width:"100%",aspectRatio:"16/7",overflow:"hidden",cursor:"pointer",background:"#0a1628"}}>
        <img src={coverSrc} alt="Titelbild" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}
          onError={e=>{ e.target.style.display="none"; }} />
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom, rgba(4,14,32,0) 55%, rgba(4,14,32,0.85) 100%)"}} />
        <div style={{position:"absolute",top:"calc(12px + env(safe-area-inset-top, 0px))",right:12,background:"rgba(0,0,0,0.45)",borderRadius:20,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>
          ✎
        </div>
        <div style={{position:"absolute",bottom:16,left:20,right:20}}>
          <div style={{fontSize:26,fontWeight:900,letterSpacing:-0.5,textShadow:"0 2px 8px rgba(0,0,0,0.5)"}}>
            🤿 <span style={{color:"#fff"}}>mein</span><span style={{color:"#f5a623"}}>tauch</span><span style={{color:"#fff"}}>buch</span>
          </div>
        </div>
      </div>

      {/* Kapitel */}
      <div style={{padding:"20px 16px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {CHAPTERS.map(ch => {
          const subtitle = subtitleFor(ch.key);
          return (
            <div key={ch.key} onClick={()=>{window.location.href=ch.href;}}
              style={{background:ch.bg,border:`1px solid ${ch.border}`,borderRadius:16,padding:"22px 16px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,cursor:"pointer",minHeight:110}}>
              <span style={{fontSize:30}}>{ch.icon}</span>
              <span style={{fontSize:14,fontWeight:700,color:ch.color}}>{ch.label}</span>
              {subtitle && <span style={{fontSize:11,color:"rgba(232,244,253,0.4)"}}>{subtitle}</span>}
            </div>
          );
        })}
      </div>

      <div style={{display:"flex",justifyContent:"center",padding:"4px 16px 0"}}>
        <button onClick={()=>setShowSettings(true)}
          style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"7px 16px",color:"rgba(232,244,253,0.5)",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          ⚙️ Einstellungen
        </button>
      </div>

      <div style={{textAlign:"center",padding:"12px 16px 8px",fontSize:10,color:"rgba(232,244,253,0.25)"}}>Tauchbuch v{APP_VERSION}</div>

      {showSettings && <SettingsPanel onClose={()=>setShowSettings(false)} />}
    </div>
  );
}
