const { useState, useEffect } = React;


// ── Statistik (Tauchbuch) ────────────────────────────────────────────────────
// Platzhalter-Seite im gleichen Design wie das Flugbuch-Pendant (statistik.jsx).
// Absichtlich noch ohne Logik/Inhalt gefüllt — dient als angelegte Kategorie,
// die später (z.B. Auswertung nach Tauchspot, Buddy, Land, Tiefe) ausgebaut
// werden kann.

function StatistikApp() {
  return (
    <div style={{minHeight:"100vh",background:"#210710",color:"#e8f4fd",fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif",paddingBottom:40}}>
      <div style={{background:"rgba(255,255,255,0.03)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"calc(28px + env(safe-area-inset-top, 0px)) 16px 12px",display:"flex",alignItems:"center",position:"sticky",top:0,zIndex:10,backdropFilter:"blur(10px)"}}>
        <button onClick={()=>{window.location.href="index.html";}} title="Zur Startseite"
          style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:"rgba(232,244,253,0.8)",cursor:"pointer",flexShrink:0}}>
          ←
        </button>
        <span style={{fontWeight:900,fontSize:18,letterSpacing:-0.5,flex:1,textAlign:"center",marginLeft:-32}}>
          📊 Tauch-Statistik
        </span>
      </div>

      <div style={{padding:"60px 24px",textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:14}}>📊</div>
        <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Noch nicht eingerichtet</div>
        <div style={{fontSize:13,color:"rgba(232,244,253,0.5)",lineHeight:1.6,maxWidth:320,margin:"0 auto"}}>
          Diese Kategorie ist angelegt, aber noch nicht mit Inhalt gefüllt.
          Hier sollen später Auswertungen erscheinen — z.B. nach Tauchspot,
          Land, Buddy oder Ausrüstung, analog zur Statistik-Ansicht im Flugbuch.
        </div>
      </div>
    </div>
  );
}
