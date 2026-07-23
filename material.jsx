const { useState, useEffect } = React;

const APP_VERSION = "0.2.0";

const MATERIAL_FIELDS = [
  { key: "regulator", label: "Regulator", icon: "🫁" },
  { key: "bcd", label: "BCD", icon: "🦺" },
  { key: "anzug", label: "Anzug", icon: "🤿" },
  { key: "maske", label: "Maske", icon: "🥽" },
  { key: "finns", label: "Finns", icon: "🩴" },
  { key: "uhrComputer", label: "Uhr/Computer", icon: "⌚" },
];

function MaterialField({ label, icon, value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  const commit = () => { setEditing(false); if (val !== (value||"")) onSave(val); };
  return (
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
      <span style={{fontSize:18,width:26,textAlign:"center",flexShrink:0}}>{icon}</span>
      <span style={{fontSize:13,color:"rgba(232,244,253,0.5)",minWidth:100,flexShrink:0}}>{label}</span>
      {editing ? (
        <input value={val} onChange={e=>setVal(e.target.value)} onBlur={commit} autoFocus
          onKeyDown={e=>{ if(e.key==="Enter"){e.preventDefault();commit();} }}
          style={{flex:1,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(74,222,128,0.4)",borderRadius:8,padding:"6px 10px",color:"#e8f4fd",fontSize:14}} />
      ) : (
        <span onClick={()=>{setVal(value||"");setEditing(true);}}
          style={{flex:1,fontSize:14,fontWeight:500,color:value?"#e8f4fd":"rgba(232,244,253,0.25)",cursor:"pointer"}}>
          {value || "Tippen zum Hinzufügen…"}
        </span>
      )}
    </div>
  );
}

function MaterialApp() {
  const [data, setData] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("material:main");
        if (r) setData(JSON.parse(r.value) || {});
      } catch (e) { console.error("Load error:", e); }
      setLoaded(true);
    })();
  }, []);

  const saveField = async (key, value) => {
    const next = { ...data, [key]: value };
    setData(next);
    try { await window.storage.set("material:main", JSON.stringify(next)); } catch (e) { console.error("Save error:", e); }
  };

  if (!loaded) return null;

  return (
    <div style={{minHeight:"100vh",background:"#0f2a2e",color:"#e8f4fd",fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif",paddingBottom:40}}>
      <div style={{background:"rgba(255,255,255,0.03)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"calc(28px + env(safe-area-inset-top, 0px)) 16px 12px",display:"flex",alignItems:"center",position:"sticky",top:0,zIndex:10,backdropFilter:"blur(10px)"}}>
        <button onClick={()=>{window.location.href="index.html";}} title="Zur Startseite"
          style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:"rgba(232,244,253,0.8)",cursor:"pointer",flexShrink:0}}>
          🏠
        </button>
        <span style={{fontWeight:900,fontSize:18,letterSpacing:-0.5,flex:1,textAlign:"center",marginLeft:-32}}>
          🎒 Material
        </span>
      </div>

      <div style={{padding:"20px 16px"}}>
        <div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,padding:"4px 16px",border:"1px solid rgba(255,255,255,0.06)"}}>
          {MATERIAL_FIELDS.map(f => (
            <MaterialField key={f.key} label={f.label} icon={f.icon} value={data[f.key]}
              onSave={v=>saveField(f.key, v)} />
          ))}
        </div>
      </div>

      <div style={{textAlign:"center",padding:"18px 16px 8px",fontSize:10,color:"rgba(232,244,253,0.25)"}}>Tauchbuch v{APP_VERSION}</div>
    </div>
  );
}
