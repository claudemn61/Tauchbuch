const { useState, useEffect, useRef } = React;

const APP_VERSION = "1.1";

// ── Startseite ───────────────────────────────────────────────────────────
// Editierbares Titelbild (per Tap austauschbar, als Data-URL in Storage
// gesichert) + vier Kapitel-Kacheln zu den Unterseiten.
const CHAPTERS = [
  { key: "tauchgaenge", label: "Tauchgänge", icon: "🤿", href: "tauchbuch.html", color: "#38bdf8", bg: "rgba(56,189,248,0.1)", border: "rgba(56,189,248,0.25)" },
  { key: "reisen", label: "Reisen", icon: "🧭", href: "reisen.html", color: "#f5a623", bg: "rgba(245,166,35,0.1)", border: "rgba(245,166,35,0.25)" },
  { key: "material", label: "Material", icon: "🎒", href: "material.html", color: "#4ade80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.25)" },
  { key: "statistik", label: "Statistik", icon: "📊", href: "statistik.html", color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
];

function HomeApp() {
  const [coverSrc, setCoverSrc] = useState("cover.jpg");
  const [loaded, setLoaded] = useState(false);
  const [diveCount, setDiveCount] = useState(0);
  const [reiseCount, setReiseCount] = useState(0);
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
          <div style={{fontSize:26,fontWeight:900,letterSpacing:-0.5,textShadow:"0 2px 8px rgba(0,0,0,0.5)"}}>🤿 Tauchbuch</div>
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

      <div style={{textAlign:"center",padding:"18px 16px 8px",fontSize:10,color:"rgba(232,244,253,0.25)"}}>Tauchbuch v{APP_VERSION}</div>
    </div>
  );
}
