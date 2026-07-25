const { useState, useEffect, useRef } = React;

// Fotos werden vor dem Speichern verkleinert/komprimiert (max. 1600px lange
// Kante, JPEG 85%) — sonst wären Handyfotos schnell mehrere MB gross und
// würden das Speicherlimit pro Eintrag sprengen.
function resizeImage(file, maxDim, quality) {
  maxDim = maxDim || 1600;
  quality = quality || 0.85;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
          else { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

function BrevetCard({ entry, onUpdate, onDelete, onOpenFullscreen }) {
  const fileRef = useRef(null);
  const [nameEditing, setNameEditing] = useState(false);
  const [nameVal, setNameVal] = useState(entry.name || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const commitName = () => { setNameEditing(false); if (nameVal !== (entry.name||"")) onUpdate({...entry, name: nameVal}); };

  const onPickPhoto = async (file) => {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const dataUrl = await resizeImage(file);
      onUpdate({ ...entry, photo: dataUrl });
    } catch (e) {
      setErr("Foto konnte nicht gespeichert werden: " + e.message);
    }
    setBusy(false);
  };

  return (
    <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,overflow:"hidden",marginBottom:16}}>
      <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}}
        onChange={e=>{ onPickPhoto(e.target.files[0]); e.target.value=""; }} />

      <div style={{padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
        {nameEditing ? (
          <input value={nameVal} onChange={e=>setNameVal(e.target.value)} onBlur={commitName} autoFocus
            onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();commitName();}}}
            placeholder="z.B. PADI Open Water Diver"
            style={{flex:1,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(167,139,250,0.4)",borderRadius:8,padding:"6px 10px",color:"#e8f4fd",fontSize:15,fontWeight:700,minWidth:0}} />
        ) : (
          <span onClick={()=>{setNameVal(entry.name||"");setNameEditing(true);}}
            style={{flex:1,fontSize:15,fontWeight:700,color:entry.name?"#e8f4fd":"rgba(232,244,253,0.3)",cursor:"pointer",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {entry.name || "Brevet-Name eintragen…"}
          </span>
        )}
        <button onClick={()=>onDelete(entry.id)} style={{background:"none",border:"none",color:"rgba(248,113,113,0.6)",fontSize:16,cursor:"pointer",flexShrink:0}}>🗑</button>
      </div>

      <div onClick={()=>{ if (busy) return; entry.photo ? onOpenFullscreen(entry.photo) : fileRef.current?.click(); }}
        style={{position:"relative",width:"100%",aspectRatio:"3/2",background:"#0a0714",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
        {busy ? (
          <div style={{color:"rgba(232,244,253,0.5)",fontSize:12}}>⏳ Foto wird verarbeitet…</div>
        ) : entry.photo ? (
          <img src={entry.photo} alt="Ausweis" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} />
        ) : (
          <div style={{textAlign:"center",color:"rgba(232,244,253,0.35)"}}>
            <div style={{fontSize:28,marginBottom:6}}>📷</div>
            <div style={{fontSize:12}}>Foto des Ausweises hinzufügen</div>
          </div>
        )}
        {entry.photo && !busy && (
          <button onClick={e=>{e.stopPropagation(); fileRef.current?.click();}}
            style={{position:"absolute",bottom:8,right:8,background:"rgba(0,0,0,0.55)",border:"none",borderRadius:16,padding:"5px 10px",color:"#fff",fontSize:11,cursor:"pointer"}}>
            ✎ Ändern
          </button>
        )}
      </div>
      {err && <div style={{padding:"6px 14px 10px",fontSize:11,color:"#f87171"}}>{err}</div>}
    </div>
  );
}

function BrevetApp() {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("brevet:list");
        if (r) setEntries(JSON.parse(r.value) || []);
      } catch (e) { console.error("Load error:", e); }
      setLoaded(true);
    })();
  }, []);

  const persist = async (next) => {
    setEntries(next);
    try { await window.storage.set("brevet:list", JSON.stringify(next)); } catch (e) { console.error("Save error:", e); }
  };

  const addEntry = () => {
    const entry = { id: `brevet_${Date.now()}`, name: "", photo: null };
    persist([...entries, entry]);
  };
  const updateEntry = (updated) => persist(entries.map(e => e.id === updated.id ? updated : e));
  const deleteEntry = (id) => persist(entries.filter(e => e.id !== id));

  if (!loaded) return null;

  return (
    <div style={{minHeight:"100vh",background:"#1a0f2e",color:"#e8f4fd",fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif",paddingBottom:40}}>
      <div style={{background:"rgba(255,255,255,0.03)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"calc(28px + env(safe-area-inset-top, 0px)) 16px 12px",display:"flex",alignItems:"center",position:"sticky",top:0,zIndex:10,backdropFilter:"blur(10px)"}}>
        <button onClick={()=>{window.location.href="index.html";}} title="Zur Startseite"
          style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:"rgba(232,244,253,0.8)",cursor:"pointer",flexShrink:0}}>
          🏠
        </button>
        <span style={{fontWeight:900,fontSize:18,letterSpacing:-0.5,flex:1,textAlign:"center",marginLeft:-32}}>
          🎓 Brevet
        </span>
      </div>

      <div style={{padding:"16px"}}>
        {entries.length === 0 && (
          <div style={{textAlign:"center",padding:"30px 16px",color:"rgba(232,244,253,0.4)",fontSize:13}}>
            Noch kein Brevet erfasst. Tippe unten, um eines hinzuzufügen.
          </div>
        )}
        {entries.map(entry => (
          <BrevetCard key={entry.id} entry={entry} onUpdate={updateEntry} onDelete={deleteEntry} onOpenFullscreen={setFullscreenPhoto} />
        ))}

        <button onClick={addEntry}
          style={{width:"100%",background:"rgba(167,139,250,0.12)",border:"1px dashed rgba(167,139,250,0.4)",borderRadius:14,padding:"14px",color:"#c4b5fd",fontSize:14,fontWeight:700,cursor:"pointer"}}>
          + Weiteres Brevet hinzufügen
        </button>
      </div>

      {fullscreenPhoto && (
        <div onClick={()=>setFullscreenPhoto(null)}
          style={{position:"fixed",inset:0,background:"#000",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <img src={fullscreenPhoto} alt="Ausweis Vollbild" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}} />
          <button onClick={()=>setFullscreenPhoto(null)}
            style={{position:"absolute",top:"calc(16px + env(safe-area-inset-top, 0px))",right:16,background:"rgba(255,255,255,0.15)",border:"none",borderRadius:20,width:36,height:36,color:"#fff",fontSize:18,cursor:"pointer"}}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
