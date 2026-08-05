const { useState, useEffect, useRef } = React;

// Verkleinert/komprimiert ein bereits fertiges Canvas (z.B. nach dem
// Zuschnitt) auf dieselbe Weise wie resizeImage() für Dateien.
function canvasToCompressed(canvas, maxDim, quality) {
  maxDim = maxDim || 1600;
  quality = quality || 0.85;
  let w = canvas.width, h = canvas.height;
  if (w > maxDim || h > maxDim) {
    if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
    else { w = Math.round(w * maxDim / h); h = maxDim; }
    const small = document.createElement("canvas");
    small.width = w; small.height = h;
    small.getContext("2d").drawImage(canvas, 0, 0, w, h);
    return small.toDataURL("image/jpeg", quality);
  }
  return canvas.toDataURL("image/jpeg", quality);
}

// ── Perspektivische Entzerrung ──────────────────────────────────────────
// Canvas 2D kennt keine echte 4-Punkt- (projektive) Transformation, nur
// affine (Dreiecks-)Transformationen. Deshalb wird die Zielfläche in ein
// feines Gitter unterteilt und jede Gitterzelle einzeln affin entzerrt
// ("Dreiecks-Mesh-Warp") — Standardtechnik für Dokumenten-Scanner-Apps.
function invert3x3(m) {
  const a=m[0][0],b=m[0][1],c=m[0][2], d=m[1][0],e=m[1][1],f=m[1][2], g=m[2][0],h=m[2][1],i=m[2][2];
  const det = a*(e*i-f*h) - b*(d*i-f*g) + c*(d*h-e*g);
  if (Math.abs(det) < 1e-10) return null;
  const id = 1/det;
  return [
    [ (e*i-f*h)*id, (c*h-b*i)*id, (b*f-c*e)*id ],
    [ (f*g-d*i)*id, (a*i-c*g)*id, (c*d-a*f)*id ],
    [ (d*h-e*g)*id, (b*g-a*h)*id, (a*e-b*d)*id ],
  ];
}
function affineFromTriangles(s0,s1,s2,d0,d1,d2) {
  const S = [[s0.x,s1.x,s2.x],[s0.y,s1.y,s2.y],[1,1,1]];
  const inv = invert3x3(S);
  if (!inv) return null;
  const mulRow = (row) => [0,1,2].map(j => row[0]*inv[0][j]+row[1]*inv[1][j]+row[2]*inv[2][j]);
  const [a,c,e] = mulRow([d0.x,d1.x,d2.x]);
  const [b,d,f] = mulRow([d0.y,d1.y,d2.y]);
  return {a,b,c,d,e,f};
}
function drawWarpedTriangle(ctx, img, s0,s1,s2, d0,d1,d2) {
  const t = affineFromTriangles(s0,s1,s2,d0,d1,d2);
  if (!t) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x,d0.y); ctx.lineTo(d1.x,d1.y); ctx.lineTo(d2.x,d2.y); ctx.closePath();
  ctx.clip();
  ctx.setTransform(t.a,t.b,t.c,t.d,t.e,t.f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}
// quad = {tl,tr,br,bl} in Quellbild-Pixelkoordinaten. Liefert ein neues
// Canvas der Grösse outW×outH mit dem entzerrten Bildausschnitt.
function warpQuadToCanvas(img, quad, outW, outH, gridN) {
  gridN = gridN || 20;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(outW); canvas.height = Math.round(outH);
  const ctx = canvas.getContext("2d");
  const lerp = (a,b,t) => ({ x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t });
  const srcAt = (u,v) => lerp(lerp(quad.tl,quad.tr,u), lerp(quad.bl,quad.br,u), v);
  for (let j=0;j<gridN;j++) {
    for (let i=0;i<gridN;i++) {
      const u0=i/gridN, u1=(i+1)/gridN, v0=j/gridN, v1=(j+1)/gridN;
      const dx0=u0*outW, dx1=u1*outW, dy0=v0*outH, dy1=v1*outH;
      const s00=srcAt(u0,v0), s10=srcAt(u1,v0), s01=srcAt(u0,v1), s11=srcAt(u1,v1);
      drawWarpedTriangle(ctx, img, s00,s10,s01, {x:dx0,y:dy0},{x:dx1,y:dy0},{x:dx0,y:dy1});
      drawWarpedTriangle(ctx, img, s10,s11,s01, {x:dx1,y:dy0},{x:dx1,y:dy1},{x:dx0,y:dy1});
    }
  }
  return canvas;
}

// ── Zuschnitt-Dialog mit 4 verschiebbaren Eckpunkten ────────────────────
// Startposition der Ecken ist automatisch leicht eingerückt (6% Rand) —
// passt oft schon gut; wenn nicht, lassen sich alle 4 Ecken frei auf die
// tatsächlichen Kanten des Ausweises/Dokuments ziehen.
function PerspectiveCropModal({ src, onDone, onCancel }) {
  const imgRef = useRef(null);
  const boxRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [natural, setNatural] = useState({ w: 1, h: 1 });
  const [corners, setCorners] = useState({
    tl: { x: 0.06, y: 0.06 }, tr: { x: 0.94, y: 0.06 },
    br: { x: 0.94, y: 0.94 }, bl: { x: 0.06, y: 0.94 },
  });
  const dragKey = useRef(null);
  const [busy, setBusy] = useState(false);

  const onImgLoad = () => {
    setNatural({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
    setReady(true);
  };

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const posFromEvent = (e) => {
    const rect = boxRef.current.getBoundingClientRect();
    const pt = e.touches ? e.touches[0] : e;
    return { x: clamp01((pt.clientX - rect.left) / rect.width), y: clamp01((pt.clientY - rect.top) / rect.height) };
  };
  const startDrag = (key) => (e) => { e.preventDefault(); dragKey.current = key; };
  useEffect(() => {
    const move = (e) => {
      if (!dragKey.current) return;
      const p = posFromEvent(e);
      setCorners(c => ({ ...c, [dragKey.current]: p }));
    };
    const up = () => { dragKey.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
  }, []);

  const applyCrop = () => {
    setBusy(true);
    setTimeout(() => {
      const q = {
        tl: { x: corners.tl.x*natural.w, y: corners.tl.y*natural.h },
        tr: { x: corners.tr.x*natural.w, y: corners.tr.y*natural.h },
        br: { x: corners.br.x*natural.w, y: corners.br.y*natural.h },
        bl: { x: corners.bl.x*natural.w, y: corners.bl.y*natural.h },
      };
      const edgeLen = (a,b) => Math.hypot(b.x-a.x, b.y-a.y);
      const outW = Math.round((edgeLen(q.tl,q.tr) + edgeLen(q.bl,q.br)) / 2);
      const outH = Math.round((edgeLen(q.tl,q.bl) + edgeLen(q.tr,q.br)) / 2);
      const canvas = warpQuadToCanvas(imgRef.current, q, Math.max(outW,50), Math.max(outH,50));
      const dataUrl = canvasToCompressed(canvas, 1600, 0.88);
      setBusy(false);
      onDone(dataUrl);
    }, 30);
  };

  const useWholeImage = () => {
    const canvas = document.createElement("canvas");
    canvas.width = natural.w; canvas.height = natural.h;
    canvas.getContext("2d").drawImage(imgRef.current, 0, 0);
    onDone(canvasToCompressed(canvas, 1600, 0.88));
  };

  const handles = [
    ["tl","Oben links"], ["tr","Oben rechts"], ["br","Unten rechts"], ["bl","Unten links"],
  ];
  const poly = `${corners.tl.x*100},${corners.tl.y*100} ${corners.tr.x*100},${corners.tr.y*100} ${corners.br.x*100},${corners.br.y*100} ${corners.bl.x*100},${corners.bl.y*100}`;

  return (
    <div style={{position:"fixed",inset:0,background:"#000",zIndex:500,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"calc(14px + env(safe-area-inset-top, 0px)) 16px 10px",color:"#fff",fontSize:13,textAlign:"center",background:"rgba(0,0,0,0.6)"}}>
        Ecken auf die Kanten des Dokuments ziehen
      </div>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflow:"hidden"}}>
        <div ref={boxRef} style={{position:"relative",maxWidth:"100%",maxHeight:"100%",touchAction:"none"}}>
          <img ref={imgRef} src={src} onLoad={onImgLoad} alt="Zuschnitt-Vorschau"
            style={{display:"block",maxWidth:"100%",maxHeight:"70vh",width:"auto",height:"auto"}} />
          {ready && (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none"
              style={{position:"absolute",inset:0,width:"100%",height:"100%"}}>
              <polygon points={poly} fill="rgba(56,189,248,0.2)" stroke="#38bdf8" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
            </svg>
          )}
          {ready && handles.map(([key]) => (
            <div key={key}
              onMouseDown={startDrag(key)} onTouchStart={startDrag(key)}
              style={{position:"absolute",left:`${corners[key].x*100}%`,top:`${corners[key].y*100}%`,
                width:28,height:28,marginLeft:-14,marginTop:-14,borderRadius:"50%",
                background:"rgba(56,189,248,0.9)",border:"3px solid #fff",boxShadow:"0 2px 6px rgba(0,0,0,0.4)",
                cursor:"grab",touchAction:"none"}} />
          ))}
        </div>
      </div>
      <div style={{padding:"12px 16px calc(16px + env(safe-area-inset-bottom, 0px))",background:"rgba(0,0,0,0.6)",display:"flex",flexDirection:"column",gap:8}}>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onCancel}
            style={{flex:1,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"11px",color:"#fff",fontSize:14,cursor:"pointer"}}>
            Abbrechen
          </button>
          <button onClick={applyCrop} disabled={busy || !ready}
            style={{flex:2,background:"linear-gradient(135deg,#0ea5e9,#0284c7)",color:"#fff",border:"none",borderRadius:10,padding:11,fontSize:14,fontWeight:800,cursor:busy?"default":"pointer",opacity:busy?0.6:1}}>
            {busy ? "⏳ Wird zugeschnitten…" : "✓ Zuschneiden & übernehmen"}
          </button>
        </div>
        <button onClick={useWholeImage}
          style={{background:"none",border:"none",color:"rgba(255,255,255,0.5)",fontSize:12,cursor:"pointer",padding:4}}>
          Ohne Zuschnitt: ganzes Bild übernehmen
        </button>
      </div>
    </div>
  );
}

function BrevetCard({ entry, onUpdate, onDelete, onOpenFullscreen }) {
  const cameraRef = useRef(null);
  const libraryRef = useRef(null);
  const [nameEditing, setNameEditing] = useState(false);
  const [nameVal, setNameVal] = useState(entry.name || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [cropSrc, setCropSrc] = useState(null); // rohes Bild, wartet auf Zuschnitt

  const commitName = () => { setNameEditing(false); if (nameVal !== (entry.name||"")) onUpdate({...entry, name: nameVal}); };

  // Datei wird zuerst nur eingelesen (nicht sofort verkleinert) und dem
  // Zuschnitt-Dialog übergeben — die eigentliche Verkleinerung/Kompression
  // passiert danach auf dem bereits zugeschnittenen Ausschnitt.
  const onPickFile = (file) => {
    if (!file) return;
    setErr("");
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result);
    reader.onerror = () => setErr("Datei konnte nicht gelesen werden.");
    reader.readAsDataURL(file);
  };

  const onCropDone = (dataUrl) => {
    setCropSrc(null);
    onUpdate({ ...entry, photo: dataUrl });
  };

  return (
    <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,overflow:"hidden",marginBottom:16}}>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{display:"none"}}
        onChange={e=>{ onPickFile(e.target.files[0]); e.target.value=""; }} />
      <input ref={libraryRef} type="file" accept="image/*" style={{display:"none"}}
        onChange={e=>{ onPickFile(e.target.files[0]); e.target.value=""; }} />

      {cropSrc && <PerspectiveCropModal src={cropSrc} onDone={onCropDone} onCancel={()=>setCropSrc(null)} />}

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

      <div onClick={()=>{ if (busy || entry.photo) return; }}
        style={{position:"relative",width:"100%",aspectRatio:"3/2",background:"#0a0714",display:"flex",alignItems:"center",justifyContent:"center"}}>
        {busy ? (
          <div style={{color:"rgba(232,244,253,0.5)",fontSize:12}}>⏳ Foto wird verarbeitet…</div>
        ) : entry.photo ? (
          <img onClick={()=>onOpenFullscreen(entry.photo)} src={entry.photo} alt="Ausweis" style={{width:"100%",height:"100%",objectFit:"cover",display:"block",cursor:"pointer"}} />
        ) : (
          <div style={{textAlign:"center",color:"rgba(232,244,253,0.35)"}}>
            <div style={{fontSize:28,marginBottom:10}}>📷</div>
            <div style={{fontSize:12,marginBottom:12}}>Foto des Ausweises hinzufügen</div>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <button onClick={()=>cameraRef.current?.click()}
                style={{background:"rgba(167,139,250,0.18)",border:"1px solid rgba(167,139,250,0.4)",borderRadius:10,padding:"8px 12px",color:"#c4b5fd",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                📷 Aufnehmen
              </button>
              <button onClick={()=>libraryRef.current?.click()}
                style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:10,padding:"8px 12px",color:"rgba(232,244,253,0.7)",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                🖼 Auswählen
              </button>
            </div>
          </div>
        )}
        {entry.photo && !busy && (
          <div style={{position:"absolute",bottom:8,right:8,display:"flex",gap:6}}>
            <button onClick={e=>{e.stopPropagation(); cameraRef.current?.click();}} title="Neu aufnehmen"
              style={{background:"rgba(0,0,0,0.55)",border:"none",borderRadius:16,padding:"5px 9px",color:"#fff",fontSize:12,cursor:"pointer"}}>
              📷
            </button>
            <button onClick={e=>{e.stopPropagation(); libraryRef.current?.click();}} title="Aus Fotos wählen"
              style={{background:"rgba(0,0,0,0.55)",border:"none",borderRadius:16,padding:"5px 9px",color:"#fff",fontSize:12,cursor:"pointer"}}>
              🖼
            </button>
          </div>
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
        <span style={{fontWeight:900,fontSize:18,letterSpacing:-0.5,flex:1,textAlign:"center"}}>
          🎓 Brevet
        </span>
        <button onClick={()=>{window.location.href="hilfe.html";}} title="Hilfe"
          style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:"rgba(232,244,253,0.8)",cursor:"pointer",flexShrink:0}}>❓</button>
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
