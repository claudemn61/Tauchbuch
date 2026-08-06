const { useState, useEffect, useRef } = React;

const APP_VERSION = "2.6.1";

// ── Startseite ───────────────────────────────────────────────────────────
// Editierbares Titelbild (per Tap austauschbar, als Data-URL in Storage
// gesichert) + Kapitel-Kacheln zu den Unterseiten. Tauchgänge steht als
// breite Kachel oben, die übrigen folgen darunter zu je zweit.
const CHAPTERS = [
  { key: "tauchgaenge", label: "Tauchgänge", icon: "🤿", href: "tauchbuch.html", color: "#38bdf8", bg: "rgba(56,189,248,0.1)", border: "rgba(56,189,248,0.25)", wide: true },
  { key: "reisen", label: "Reisen", icon: "🧭", href: "reisen.html", color: "#f5a623", bg: "rgba(245,166,35,0.1)", border: "rgba(245,166,35,0.25)" },
  { key: "material", label: "Material", icon: "🎒", href: "material.html", color: "#4ade80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.25)" },
  { key: "statistik", label: "Statistik", icon: "📊", href: "statistik.html", color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
  { key: "brevet", label: "Brevet", icon: "🎓", href: "brevet.html", color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.25)" },
];

// Änderungsverlauf — neuste zuerst. Wird beim Erhöhen der Version jeweils
// von Hand ergänzt.
const CHANGELOG = [
  { version: "2.6.1", changes: [
    "Brevet: automatische Kantenerkennung deutlich verbessert — statt grober Zeilen-/Spalten-Schätzung wird jetzt der tatsächlich umschlossene Bereich per Flutfüllung von den Bildrändern gefunden (Otsu-Schwelle, mit Fallback-Kette bei schwierigen Fotos)",
  ]},
  { version: "2.6", changes: [
    "Brevet: Zuschnitt-Ecken werden jetzt automatisch per Kantenerkennung (Gradienten-Analyse) an den tatsächlichen Bildinhalt angepasst statt an einen festen Rand — funktioniert unabhängig davon, wie/wo genau fotografiert wurde; manuelles Nachjustieren bleibt weiterhin möglich",
  ]},
  { version: "2.5", changes: [
    "Brevet: Foto direkt per Kamera aufnehmen (📷) oder aus der Bibliothek wählen (🖼), danach Zuschnitt-Dialog mit 4 frei verschiebbaren Eckpunkten inkl. automatischer Startposition und echter perspektivischer Entzerrung",
  ]},
  { version: "2.4.2", changes: [
    "Startseite: Fusszeile zeigt jetzt die Hosting-URL statt \"Tauchbuch\" vor der Versionsnummer",
  ]},
  { version: "2.4.1", changes: [
    "Startseite: Copyright-Hinweis \"© Claude Mair-Noack\" unter der Versionsnummer ergänzt",
  ]},
  { version: "2.4", changes: [
    "Startseite: Titeltext jetzt editierbar (Text, Schriftart, Schriftgrösse, Farbe per Tipp auf den Titel; Zurücksetzen stellt die Standard-Optik wieder her)",
    "Tauchgänge-Kapitel: Seitentitel von \"Tauchbuch\" zu \"Logbuch\" umbenannt",
    "Beide Gebrauchsanweisungen (ausführlich/kurz) sowie die In-App-Hilfe entsprechend angepasst",
  ]},
  { version: "2.3.2", changes: [
    "Material: Revisionsdatum bleibt konstant aufgeklappt sichtbar, sobald eines eingetragen ist (kein Ein-/Ausklappen mehr nötig); der Pfeil zum Aufklappen erscheint nur noch, solange noch kein Datum eingetragen ist",
  ]},
  { version: "2.3.1", changes: [
    "Tauchbuch/Liste, Reisen-Gruppenkopf: \"Tauchgänge\" zu \"TG\" abgekürzt, dafür Datumsspanne der Reise ergänzt (z.B. \"1.-9.12.26\", weiss, gleiche Grösse wie die Gesamtzeit)",
  ]},
  { version: "2.3", changes: [
    "Neue Hilfeseite mit der kompletten ausführlichen Gebrauchsanweisung direkt in der App (Inhaltsverzeichnis mit Sprungmarken, alle Kapitel als durchsuchbarer Text)",
    "❓ Hilfe-Button neu auf jeder Seite: Startseite (neben ⚙️ Einstellungen), Tauchbuch-Liste (neben + Tauchgang), Tauchgang-Detail (neben 🗑), sowie oben rechts bei Reisen, Statistik, Material und Brevet",
  ]},
  { version: "2.2.3", changes: [
    "Reisen verwalten: dritter Sortier-Modus \"A–Z\" (alphabetisch) neben Manuell und Nach Datum TG",
  ]},
  { version: "2.2.2", changes: [
    "Reisen verwalten: neuer Löschen-Button pro Reise (zugeordnete Tauchgänge bleiben erhalten, verlieren nur die Reise-Zuordnung), plus Sortier-Umschalter Manuell / Nach Anzahl TG mit Anzeige der zugeordneten Tauchgänge",
  ]},
  { version: "2.2.1", changes: [
    "Bugfix: Reise blieb in der Verwaltungsliste/im Dropdown bestehen, auch nachdem alle zugehörigen Tauchgänge gelöscht wurden — wird jetzt beim Löschen automatisch entfernt, falls kein Tauchgang mehr darauf verweist",
  ]},
  { version: "2.2", changes: [
    "Mehrfachauswahl → Bearbeiten: jetzt Vollbild-Seite im 1:1-Design der Tauchgang-Detailseite (Header, Datum, Bewertung/Nitrox, Bemerkungen, Feldliste), Titelzeile zeigt die ausgewählten Nummern (fortlaufende als Bereich, z.B. \"123 - 129\"), Felder mit unterschiedlichen Werten zeigen \"variabel\", Reise als Auswahlliste statt Freitext",
    "Separater \"Reise anpassen\"-Button in der Auswahlleiste entfernt (jetzt Teil von \"Bearbeiten\")",
    "Startseite: Stift-Icon auf dem Titelbild entfernt, Tippen aufs Foto öffnet weiterhin die Bildauswahl",
  ]},
  { version: "2.1.1", changes: [
    "Bugfix: Aktualisierungen wurden nicht immer zuverlässig angezeigt — Service Worker holt eigene Dateien jetzt garantiert frisch vom Server statt aus einem zwischengeschalteten Cache",
  ]},
  { version: "2.1", changes: [
    "Neues Kapitel „Brevet“: beliebig viele Einträge mit Name und Foto des Ausweises (Vollbild-Ansicht per Tap), Fotos werden automatisch komprimiert",
    "Startseite: Tauchgänge als breite Kachel oben, restliche Kapitel darunter zu zweit",
    "Startseite: Titelbild füllt jetzt die gesamte verfügbare Höhe, sodass alles ohne Scrollen auf den Bildschirm passt",
  ]},
  { version: "2.0", changes: [
    "App jetzt offlinefähig (ab dem zweiten erfolgreichen Online-Start) — Service Worker cached App und Bibliotheken automatisch",
    "Kleiner Offline-Hinweis unten, wenn keine Verbindung besteht",
    "Statistik-Kapitel vollständig eingerichtet: Kennzahlen, Jahres-Verlauf, Tiefen-/Zeit-Rekorde, häufigste Tauchspots/Buddys, Länder-Verteilung, Bewertungsverteilung, Ausrüstungsauswertung",
  ]},
  { version: "1.5.1", changes: [
    "Startseiten-Titelbild: Tauchbrillen-Icon entfernt, Titel-Text zentriert (Tauchbuch-Header bleibt unverändert)",
  ]},
  { version: "1.5", changes: [
    "Tauchgang-Detail: Ort und Reise zusammengelegt zu einem Feld „Ort, Reise“ (Auswahlliste bleibt erhalten)",
  ]},
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

const TITLE_FONTS = [
  { label: "Standard", value: "-apple-system,BlinkMacSystemFont,sans-serif" },
  { label: "Serifenschrift", value: "Georgia, 'Times New Roman', serif" },
  { label: "Rund (Verdana)", value: "Verdana, Geneva, sans-serif" },
  { label: "Schreibmaschine", value: "'Courier New', monospace" },
  { label: "Handschrift", value: "'Comic Sans MS', 'Comic Sans', cursive" },
  { label: "Elegant", value: "Didot, Georgia, serif" },
];
const TITLE_SWATCHES = ["#ffffff", "#f5a623", "#38bdf8", "#4ade80", "#f87171", "#a78bfa"];
const DEFAULT_TITLE_CFG = {
  segments: [
    { text: "mein", color: "#ffffff" },
    { text: "tauch", color: "#f5a623" },
    { text: "buch", color: "#ffffff" },
  ],
  fontFamily: "-apple-system,BlinkMacSystemFont,sans-serif",
  fontSize: 26,
};
let segIdCounter = 0;
const newSegId = () => `seg${Date.now()}_${segIdCounter++}`;

// Jeder Textteil (nicht zwingend jeder einzelne Buchstabe, aber beliebig
// fein aufteilbar bis hinunter zu einzelnen Zeichen) bekommt eine eigene
// Farbe. Schriftart/-grösse gelten einheitlich für den ganzen Titel.
function TitleEditor({ current, onSave, onReset, onClose }) {
  const [segments, setSegments] = useState(
    current.segments.map(s => ({ ...s, _id: newSegId() }))
  );
  const [fontFamily, setFontFamily] = useState(current.fontFamily);
  const [fontSize, setFontSize] = useState(current.fontSize);

  const updateSeg = (id, patch) => setSegments(segs => segs.map(s => s._id===id ? {...s, ...patch} : s));
  const addSeg = () => setSegments(segs => [...segs, { _id: newSegId(), text: "neu", color: "#ffffff" }]);
  const removeSeg = (id) => setSegments(segs => segs.length>1 ? segs.filter(s=>s._id!==id) : segs);

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:"#0a1628",borderRadius:16,padding:"18px 20px",maxWidth:380,width:"100%",border:"1px solid rgba(255,255,255,0.1)",maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{fontSize:15,fontWeight:800,marginBottom:14}}>Titel bearbeiten</div>

        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:"rgba(232,244,253,0.5)",marginBottom:6}}>Textteile (je mit eigener Farbe)</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {segments.map(seg => (
              <div key={seg._id} style={{display:"flex",alignItems:"center",gap:8}}>
                <input value={seg.text} onChange={e=>updateSeg(seg._id,{text:e.target.value})}
                  style={{flex:1,minWidth:0,boxSizing:"border-box",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(56,189,248,0.4)",borderRadius:8,padding:"6px 9px",color:"#e8f4fd",fontSize:13}} />
                <input type="color" value={seg.color} onChange={e=>updateSeg(seg._id,{color:e.target.value})}
                  style={{width:28,height:26,border:"none",background:"none",cursor:"pointer",padding:0,flexShrink:0}} />
                <button onClick={()=>removeSeg(seg._id)} disabled={segments.length<=1}
                  style={{background:"none",border:"none",color:segments.length<=1?"rgba(232,244,253,0.15)":"#f87171",fontSize:15,cursor:segments.length<=1?"default":"pointer",flexShrink:0,padding:"2px 4px"}}>✕</button>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
            {segments.map(seg => (
              <div key={seg._id} onClick={()=>{}} style={{display:"flex",gap:4}}>
                {TITLE_SWATCHES.map(c => (
                  <div key={c} onClick={()=>updateSeg(seg._id,{color:c})}
                    title={`"${seg.text}" einfärben`}
                    style={{width:16,height:16,borderRadius:"50%",background:c,cursor:"pointer",border:seg.color===c?"2px solid #7dd3fc":"1px solid rgba(255,255,255,0.25)"}} />
                ))}
              </div>
            ))}
          </div>
          <button onClick={addSeg}
            style={{marginTop:8,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,padding:"5px 10px",color:"rgba(232,244,253,0.7)",fontSize:12,cursor:"pointer"}}>
            + Textteil
          </button>
        </div>

        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:"rgba(232,244,253,0.5)",marginBottom:4}}>Schriftart (für den ganzen Titel)</div>
          <select value={fontFamily} onChange={e=>setFontFamily(e.target.value)}
            style={{width:"100%",boxSizing:"border-box",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,padding:"7px 10px",color:"#e8f4fd",fontSize:14}}>
            {TITLE_FONTS.map(f => <option key={f.value} value={f.value} style={{background:"#0a1628"}}>{f.label}</option>)}
          </select>
        </div>

        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,color:"rgba(232,244,253,0.5)",marginBottom:4}}>Schriftgrösse: {fontSize}px</div>
          <input type="range" min="16" max="40" value={fontSize} onChange={e=>setFontSize(+e.target.value)}
            style={{width:"100%"}} />
        </div>

        <div style={{textAlign:"center",marginBottom:16,padding:"14px 0",background:"rgba(255,255,255,0.03)",borderRadius:10,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
          <span style={{fontFamily,fontSize,fontWeight:900,letterSpacing:-0.5}}>
            {segments.map(seg => <span key={seg._id} style={{color:seg.color}}>{seg.text}</span>)}
          </span>
        </div>

        <div style={{display:"flex",gap:8}}>
          <button onClick={onReset}
            style={{flex:1,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"9px",color:"rgba(232,244,253,0.7)",fontSize:13,cursor:"pointer"}}>
            Zurücksetzen
          </button>
          <button onClick={()=>onSave({ segments: segments.map(({_id,...s})=>s), fontFamily, fontSize })}
            style={{flex:1,background:"linear-gradient(135deg,#0ea5e9,#0284c7)",color:"#fff",border:"none",borderRadius:10,padding:9,fontSize:13,fontWeight:800,cursor:"pointer"}}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

function HomeApp() {
  const [coverSrc, setCoverSrc] = useState("cover.jpg");
  const [loaded, setLoaded] = useState(false);
  const [diveCount, setDiveCount] = useState(0);
  const [reiseCount, setReiseCount] = useState(0);
  const [brevetCount, setBrevetCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [titleCfg, setTitleCfg] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("home:coverImage");
        if (r && r.value) setCoverSrc(r.value);
      } catch {}
      try {
        const rt = await window.storage.get("home:titleConfig");
        if (rt && rt.value) {
          const parsed = JSON.parse(rt.value);
          // Migration: alte Version hatte ein einzelnes {text,color} statt
          // mehrerer Textteile — wird beim Laden einmalig in ein Segment
          // umgewandelt, damit bestehende individuelle Titel erhalten bleiben.
          if (parsed && !parsed.segments && parsed.text) {
            setTitleCfg({ segments: [{ text: parsed.text, color: parsed.color || "#ffffff" }], fontFamily: parsed.fontFamily, fontSize: parsed.fontSize });
          } else if (parsed && parsed.segments) {
            setTitleCfg(parsed);
          }
        }
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
      try {
        const r = await window.storage.get("brevet:list");
        if (r) setBrevetCount((JSON.parse(r.value) || []).length);
      } catch {}
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

  const saveTitleCfg = async (cfg) => {
    setTitleCfg(cfg);
    setEditingTitle(false);
    try { await window.storage.set("home:titleConfig", JSON.stringify(cfg)); } catch (e) { console.error("Titel-Speicherfehler:", e); }
  };
  const resetTitleCfg = async () => {
    setTitleCfg(null);
    setEditingTitle(false);
    try { await window.storage.delete("home:titleConfig"); } catch {}
  };

  if (!loaded) return null;

  const subtitleFor = (key) => {
    if (key === "tauchgaenge") return diveCount ? `${diveCount} Tauchgänge` : null;
    if (key === "reisen") return reiseCount ? `${reiseCount} Reisen` : null;
    if (key === "brevet") return brevetCount ? `${brevetCount} Brevet${brevetCount!==1?"s":""}` : null;
    return null;
  };

  return (
    <div className="tb-home-shell" style={{display:"flex",flexDirection:"column",background:"#040e20",color:"#e8f4fd",fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif",overflow:"hidden"}}>
      <style>{`.tb-home-shell{height:100vh;height:100dvh;}`}</style>
      <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}}
        onChange={e=>{ onPickImage(e.target.files[0]); e.target.value=""; }} />

      {/* Titelbild — nimmt die gesamte übrige Höhe ein, damit Kacheln und
          Einstellungen darunter gerade noch ohne Scrollen Platz haben */}
      <div onClick={()=>fileRef.current?.click()}
        style={{position:"relative",flex:"1 1 auto",minHeight:0,overflow:"hidden",cursor:"pointer",background:"#0a1628"}}>
        <img src={coverSrc} alt="Titelbild" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}
          onError={e=>{ e.target.style.display="none"; }} />
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom, rgba(4,14,32,0) 55%, rgba(4,14,32,0.85) 100%)"}} />
        <div style={{position:"absolute",bottom:16,left:20,right:20,textAlign:"center"}}>
          <div onClick={e=>{e.stopPropagation();setEditingTitle(true);}}
            style={{display:"inline-block",fontWeight:900,letterSpacing:-0.5,textShadow:"0 2px 8px rgba(0,0,0,0.5)",whiteSpace:"nowrap",cursor:"pointer",
              fontSize:titleCfg?titleCfg.fontSize:DEFAULT_TITLE_CFG.fontSize, fontFamily:titleCfg?titleCfg.fontFamily:undefined}}>
            {(titleCfg||DEFAULT_TITLE_CFG).segments.map((seg,i) => <span key={i} style={{color:seg.color}}>{seg.text}</span>)}
          </div>
        </div>
      </div>

      {editingTitle && (
        <TitleEditor
          current={titleCfg || DEFAULT_TITLE_CFG}
          onSave={saveTitleCfg}
          onReset={resetTitleCfg}
          onClose={()=>setEditingTitle(false)}
        />
      )}

      {/* Kapitel: Tauchgänge als breite Kachel oben, Rest darunter zu zweit */}
      <div style={{flex:"0 0 auto",padding:"12px 16px 0"}}>
        {CHAPTERS.filter(ch => ch.wide).map(ch => {
          const subtitle = subtitleFor(ch.key);
          return (
            <div key={ch.key} onClick={()=>{window.location.href=ch.href;}}
              style={{background:ch.bg,border:`1px solid ${ch.border}`,borderRadius:14,padding:"10px 10px",display:"flex",alignItems:"center",justifyContent:"center",gap:10,cursor:"pointer",marginBottom:8,height:"calc((100vw - 40px) * 0.375)",boxSizing:"border-box"}}>
              <span style={{fontSize:26}}>{ch.icon}</span>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:ch.color}}>{ch.label}</div>
                {subtitle && <div style={{fontSize:10,color:"rgba(232,244,253,0.4)"}}>{subtitle}</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{flex:"0 0 auto",padding:"0 16px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {CHAPTERS.filter(ch => !ch.wide).map(ch => {
          const subtitle = subtitleFor(ch.key);
          return (
            <div key={ch.key} onClick={()=>{window.location.href=ch.href;}}
              style={{background:ch.bg,border:`1px solid ${ch.border}`,borderRadius:14,padding:"10px 10px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,cursor:"pointer",aspectRatio:"1 / 0.75"}}>
              <span style={{fontSize:26}}>{ch.icon}</span>
              <span style={{fontSize:13,fontWeight:700,color:ch.color}}>{ch.label}</span>
              {subtitle && <span style={{fontSize:10,color:"rgba(232,244,253,0.4)"}}>{subtitle}</span>}
            </div>
          );
        })}
      </div>

      <div style={{flex:"0 0 auto",display:"flex",justifyContent:"center",gap:8,padding:"8px 16px 0"}}>
        <button onClick={()=>{window.location.href="hilfe.html";}}
          style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"6px 14px",color:"rgba(232,244,253,0.5)",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          ❓ Hilfe
        </button>
        <button onClick={()=>setShowSettings(true)}
          style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"6px 14px",color:"rgba(232,244,253,0.5)",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          ⚙️ Einstellungen
        </button>
      </div>

      <div style={{flex:"0 0 auto",textAlign:"center",padding:"6px 16px 2px",fontSize:9,color:"rgba(232,244,253,0.25)"}}>claudemn61.github.io/Tauchbuch v{APP_VERSION}</div>
      <div style={{flex:"0 0 auto",textAlign:"center",padding:"0 16px calc(6px + env(safe-area-inset-bottom, 0px))",fontSize:9,color:"rgba(232,244,253,0.2)"}}>© Claude Mair-Noack</div>

      {showSettings && <SettingsPanel onClose={()=>setShowSettings(false)} />}
    </div>
  );
}
