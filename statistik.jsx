const { useState, useEffect } = React;

function parseDateToTs(d) {
  if (!d) return 0;
  const m = String(d).match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (!m) return 0;
  let [_, dd, mm, yy] = m;
  yy = yy.length === 2 ? (+yy >= 30 ? "19" + yy : "20" + yy) : yy;
  return new Date(+yy, +mm - 1, +dd).getTime();
}

function fmtDuration(min) {
  if (!min) return "—";
  if (min >= 60) return `${Math.floor(min/60)}h ${String(min%60).padStart(2,"0")}m`;
  return `${min} min`;
}

function fmtDateShort(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getFullYear()).slice(2)}`;
}

// ── Statistik-Berechnung ─────────────────────────────────────────────────
function computeStats(dives) {
  const n = dives.length;
  if (!n) return null;

  const totalMin = dives.reduce((s,d) => s + (d.durationMin||0), 0);
  const depths = dives.map(d => d.maxDepth).filter(v => v != null);
  const temps = dives.map(d => d.waterTemp).filter(v => v != null);
  const ratings = dives.map(d => d.rating).filter(v => v > 0);

  const avgDepth = depths.length ? depths.reduce((s,v)=>s+v,0)/depths.length : null;
  const maxDepthDive = depths.length ? dives.filter(d=>d.maxDepth!=null).sort((a,b)=>b.maxDepth-a.maxDepth)[0] : null;
  const avgTemp = temps.length ? temps.reduce((s,v)=>s+v,0)/temps.length : null;
  const avgRating = ratings.length ? ratings.reduce((s,v)=>s+v,0)/ratings.length : null;

  const nitroxCount = dives.filter(d => d.nitrox === "Nitrox").length;
  const reisenSet = new Set(dives.map(d=>d.customFields?.reise).filter(Boolean));
  const laenderSet = new Set(dives.map(d=>d.land).filter(Boolean));
  const ortSet = new Set(dives.map(d=>d.ort).filter(Boolean));

  // Jahres-Verlauf
  const byYear = new Map();
  dives.forEach(d => {
    if (!d.year) return;
    const cur = byYear.get(d.year) || { count: 0, min: 0 };
    cur.count++; cur.min += (d.durationMin||0);
    byYear.set(d.year, cur);
  });
  const years = [...byYear.entries()].sort((a,b) => b[0]-a[0]);
  const maxYearCount = Math.max(1, ...years.map(([,v])=>v.count));

  // Rankings
  const topDepth = [...dives].filter(d=>d.maxDepth!=null).sort((a,b)=>b.maxDepth-a.maxDepth).slice(0,5);
  const topDuration = [...dives].filter(d=>d.durationMin).sort((a,b)=>b.durationMin-a.durationMin).slice(0,5);

  const countBy = (getKey) => {
    const m = new Map();
    dives.forEach(d => { const k = getKey(d); if (!k) return; m.set(k, (m.get(k)||0)+1); });
    return [...m.entries()].sort((a,b)=>b[1]-a[1]);
  };
  const topSpots = countBy(d => d.tauchspot).slice(0,6);
  const topBuddies = countBy(d => d.buddy).slice(0,6);
  const byLand = countBy(d => d.land);
  const maxLandCount = Math.max(1, ...byLand.map(([,c])=>c));
  const maxSpotCount = Math.max(1, ...topSpots.map(([,c])=>c));
  const maxBuddyCount = Math.max(1, ...topBuddies.map(([,c])=>c));

  // Bewertungsverteilung
  const ratingDist = [5,4,3,2,1].map(s => ({ stars: s, count: dives.filter(d=>d.rating===s).length }));
  const maxRatingCount = Math.max(1, ...ratingDist.map(r=>r.count));

  // Ausrüstung
  const anzugCounts = countBy(d => d.anzug).slice(0,5);
  const flascheCounts = countBy(d => d.flasche);

  return {
    n, totalMin, avgDurationMin: Math.round(totalMin/n),
    avgDepth, maxDepthDive, avgTemp, avgRating,
    nitroxCount, nitroxPct: Math.round(nitroxCount/n*100),
    reisenCount: reisenSet.size, laenderCount: laenderSet.size, ortCount: ortSet.size,
    years, maxYearCount,
    topDepth, topDuration,
    topSpots, maxSpotCount, topBuddies, maxBuddyCount,
    byLand, maxLandCount,
    ratingDist, maxRatingCount,
    anzugCounts, flascheCounts,
    firstDate: Math.min(...dives.map(d=>parseDateToTs(d.date)).filter(Boolean)),
    lastDate: Math.max(...dives.map(d=>parseDateToTs(d.date)).filter(Boolean)),
  };
}

// ── UI-Bausteine ─────────────────────────────────────────────────────────
function StatTile({ label, value, sub }) {
  return (
    <div style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"14px 12px",textAlign:"center"}}>
      <div style={{fontSize:20,fontWeight:800,color:"#f87171"}}>{value}</div>
      <div style={{fontSize:10,color:"rgba(232,244,253,0.5)",textTransform:"uppercase",letterSpacing:0.4,marginTop:4}}>{label}</div>
      {sub && <div style={{fontSize:10,color:"rgba(232,244,253,0.3)",marginTop:2}}>{sub}</div>}
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"14px 16px",marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:700,color:"rgba(232,244,253,0.4)",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>{title}</div>
      {children}
    </div>
  );
}

function BarRow({ label, count, max, color, suffix }) {
  const pct = Math.max(4, Math.round(count/max*100));
  return (
    <div style={{marginBottom:9}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
        <span style={{color:"#e8f4fd",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"70%"}}>{label}</span>
        <span style={{color:"rgba(232,244,253,0.5)",flexShrink:0}}>{count}{suffix||""}</span>
      </div>
      <div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:6,overflow:"hidden"}}>
        <div style={{width:pct+"%",height:"100%",background:color||"#f87171",borderRadius:6}} />
      </div>
    </div>
  );
}

function RankRow({ rank, primary, secondary, value }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
      <span style={{width:20,fontSize:12,fontWeight:700,color:"rgba(232,244,253,0.35)",flexShrink:0}}>{rank}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,color:"#e8f4fd",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{primary}</div>
        <div style={{fontSize:11,color:"rgba(232,244,253,0.4)"}}>{secondary}</div>
      </div>
      <span style={{fontSize:14,fontWeight:700,color:"#f87171",flexShrink:0}}>{value}</span>
    </div>
  );
}

function StatistikApp() {
  const [dives, setDives] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const keys = await window.storage.list("dive:");
        const raw = await Promise.all((keys?.keys||[]).map(async k => {
          try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } catch { return null; }
        }));
        setDives(raw.filter(Boolean));
      } catch (e) { console.error("Load error:", e); }
      setLoaded(true);
    })();
  }, []);

  if (!loaded) return null;
  const stats = computeStats(dives);

  return (
    <div style={{minHeight:"100vh",background:"#210710",color:"#e8f4fd",fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif",paddingBottom:40}}>
      <div style={{background:"rgba(255,255,255,0.03)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"calc(28px + env(safe-area-inset-top, 0px)) 16px 12px",display:"flex",alignItems:"center",position:"sticky",top:0,zIndex:10,backdropFilter:"blur(10px)"}}>
        <button onClick={()=>{window.location.href="index.html";}} title="Zur Startseite"
          style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:"rgba(232,244,253,0.8)",cursor:"pointer",flexShrink:0}}>
          🏠
        </button>
        <span style={{fontWeight:900,fontSize:18,letterSpacing:-0.5,flex:1,textAlign:"center",marginLeft:-32}}>
          📊 Tauch-Statistik
        </span>
      </div>

      {!stats ? (
        <div style={{padding:"60px 24px",textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:14}}>📊</div>
          <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Noch keine Daten</div>
          <div style={{fontSize:13,color:"rgba(232,244,253,0.5)",lineHeight:1.6,maxWidth:320,margin:"0 auto"}}>
            Sobald Tauchgänge im Tauchbuch erfasst sind, erscheinen hier Auswertungen.
          </div>
        </div>
      ) : (
        <div style={{padding:"16px"}}>

          <div style={{fontSize:12,color:"rgba(232,244,253,0.4)",marginBottom:12,textAlign:"center"}}>
            {fmtDateShort(stats.firstDate)} – {fmtDateShort(stats.lastDate)}
          </div>

          {/* Kennzahlen */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
            <StatTile label="Tauchgänge" value={stats.n} />
            <StatTile label="Gesamtzeit" value={fmtDuration(stats.totalMin)} />
            <StatTile label="Ø Dauer" value={fmtDuration(stats.avgDurationMin)} />
            <StatTile label="Ø Tiefe" value={stats.avgDepth!=null?stats.avgDepth.toFixed(1)+" m":"—"} />
            <StatTile label="Max. Tiefe" value={stats.maxDepthDive?stats.maxDepthDive.maxDepth+" m":"—"} sub={stats.maxDepthDive?"TG "+stats.maxDepthDive.name:null} />
            <StatTile label="Ø Wassertemp." value={stats.avgTemp!=null?stats.avgTemp.toFixed(1)+"°":"—"} />
            <StatTile label="Reisen" value={stats.reisenCount} />
            <StatTile label="Länder" value={stats.laenderCount} />
            <StatTile label="Orte" value={stats.ortCount} />
            <StatTile label="Nitrox-Anteil" value={stats.nitroxPct+"%"} />
            <StatTile label="Ø Bewertung" value={stats.avgRating!=null?stats.avgRating.toFixed(1)+"★":"—"} />
          </div>

          {/* Jahres-Verlauf */}
          {stats.years.length > 0 && (
            <SectionCard title="Tauchgänge pro Jahr">
              {stats.years.map(([yr, v]) => (
                <BarRow key={yr} label={yr} count={v.count} max={stats.maxYearCount} color="#f87171" suffix=" TG" />
              ))}
            </SectionCard>
          )}

          {/* Tiefste Tauchgänge */}
          {stats.topDepth.length > 0 && (
            <SectionCard title="Tiefste Tauchgänge">
              {stats.topDepth.map((d,i) => (
                <RankRow key={d.id} rank={i+1} primary={d.tauchspot||d.ort||"—"} secondary={`TG ${d.name} · ${d.date}`} value={d.maxDepth+" m"} />
              ))}
            </SectionCard>
          )}

          {/* Längste Tauchgänge */}
          {stats.topDuration.length > 0 && (
            <SectionCard title="Längste Tauchgänge">
              {stats.topDuration.map((d,i) => (
                <RankRow key={d.id} rank={i+1} primary={d.tauchspot||d.ort||"—"} secondary={`TG ${d.name} · ${d.date}`} value={fmtDuration(d.durationMin)} />
              ))}
            </SectionCard>
          )}

          {/* Beliebteste Tauchspots */}
          {stats.topSpots.length > 0 && (
            <SectionCard title="Häufigste Tauchspots">
              {stats.topSpots.map(([spot, count]) => (
                <BarRow key={spot} label={spot} count={count} max={stats.maxSpotCount} color="#fb923c" suffix=" TG" />
              ))}
            </SectionCard>
          )}

          {/* Länder-Verteilung */}
          {stats.byLand.length > 0 && (
            <SectionCard title="Länder">
              {stats.byLand.map(([land, count]) => (
                <BarRow key={land} label={land} count={count} max={stats.maxLandCount} color="#38bdf8" suffix=" TG" />
              ))}
            </SectionCard>
          )}

          {/* Buddys */}
          {stats.topBuddies.length > 0 && (
            <SectionCard title="Häufigste Buddys">
              {stats.topBuddies.map(([buddy, count]) => (
                <BarRow key={buddy} label={"👤 "+buddy} count={count} max={stats.maxBuddyCount} color="#4ade80" suffix=" TG" />
              ))}
            </SectionCard>
          )}

          {/* Bewertungsverteilung */}
          <SectionCard title="Bewertungsverteilung">
            {stats.ratingDist.map(r => (
              <BarRow key={r.stars} label={"★".repeat(r.stars)} count={r.count} max={stats.maxRatingCount} color="#f59e0b" suffix=" TG" />
            ))}
          </SectionCard>

          {/* Ausrüstung */}
          {stats.anzugCounts.length > 0 && (
            <SectionCard title="Anzüge im Einsatz">
              {stats.anzugCounts.map(([anzug, count]) => (
                <BarRow key={anzug} label={anzug} count={count} max={Math.max(...stats.anzugCounts.map(a=>a[1]))} color="#a78bfa" suffix=" TG" />
              ))}
            </SectionCard>
          )}

          {stats.flascheCounts.length > 0 && (
            <SectionCard title="Flaschentyp">
              <div style={{display:"flex",gap:8}}>
                {stats.flascheCounts.map(([flasche, count]) => (
                  <div key={flasche} style={{flex:1,background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                    <div style={{fontSize:18,fontWeight:800,color:"#f87171"}}>{count}</div>
                    <div style={{fontSize:11,color:"rgba(232,244,253,0.5)",marginTop:2}}>{flasche}</div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

        </div>
      )}
    </div>
  );
}
