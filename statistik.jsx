const { useState, useEffect } = React;

function useIsWide() {
  const [isWide, setIsWide] = useState(typeof window !== "undefined" ? window.innerWidth >= 768 : false);
  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth >= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isWide;
}

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

  // Rankings — volle, sortierte Listen; die Anzeige zeigt standardmässig nur
  // die Top-N (siehe TOP_LIMITS unten) und blendet den Rest über den Titel
  // der jeweiligen Kachel ein/aus.
  const topDepth = [...dives].filter(d=>d.maxDepth!=null).sort((a,b)=>b.maxDepth-a.maxDepth);
  const topDuration = [...dives].filter(d=>d.durationMin).sort((a,b)=>b.durationMin-a.durationMin);

  const countBy = (getKey) => {
    const m = new Map();
    dives.forEach(d => { const k = getKey(d); if (!k) return; m.set(k, (m.get(k)||0)+1); });
    return [...m.entries()].sort((a,b)=>b[1]-a[1]);
  };
  const topSpots = countBy(d => d.tauchspot);
  const topBuddies = countBy(d => d.buddy);
  const byLand = countBy(d => d.land);
  const maxLandCount = Math.max(1, ...byLand.map(([,c])=>c));
  const maxSpotCount = Math.max(1, ...topSpots.map(([,c])=>c));
  const maxBuddyCount = Math.max(1, ...topBuddies.map(([,c])=>c));

  // Bewertungsverteilung
  const ratingDist = [5,4,3,2,1].map(s => ({ stars: s, count: dives.filter(d=>d.rating===s).length }));
  const maxRatingCount = Math.max(1, ...ratingDist.map(r=>r.count));

  // Ausrüstung
  const anzugCounts = countBy(d => d.anzug);
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

// ── Verlinkung ins Tauchbuch ─────────────────────────────────────────────
// Jede Kachel/Balken/Zeile führt gefiltert (bzw. bei einem konkreten
// Tauchgang direkt in dessen Detailansicht) ins Tauchbuch; "Zurück" dort
// führt an genau diese Stelle in der Statistik zurück (Scroll-Position wird
// in der returnTo-URL mitgeschickt, da es sich um echte Seitenwechsel ohne
// eigenen Router handelt).
function statistikReturnUrl() {
  return "statistik.html?scrollY=" + Math.round(window.scrollY || window.pageYOffset || 0);
}
function diveListUrl({ openDiveId, filterField, filterValue, filterLabel, groupField } = {}) {
  const p = new URLSearchParams();
  if (openDiveId != null) p.set("openDiveId", String(openDiveId));
  if (filterField && filterValue != null) {
    p.set("filterField", filterField);
    p.set("filterValue", String(filterValue));
    if (filterLabel != null) p.set("filterLabel", String(filterLabel));
  }
  if (groupField) p.set("groupField", groupField);
  p.set("returnTo", statistikReturnUrl());
  return "tauchbuch.html?" + p.toString();
}
function goDiveList(opts) { window.location.href = diveListUrl(opts); }

// Standard-Anzahl für die "Top-N"-Kacheln, bevor man auf den Titel tippt, um
// alle Ergebnisse zu sehen (Pfeil zeigt den Zustand, Tipp erneut = wieder
// einklappen).
const TOP_LIMITS = { topDepth: 5, topDuration: 5, topSpots: 6, topBuddies: 6, anzug: 5 };

// ── UI-Bausteine ─────────────────────────────────────────────────────────
function StatTile({ label, value, sub, onClick }) {
  return (
    <div onClick={onClick} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"14px 12px",textAlign:"center",cursor:onClick?"pointer":"default"}}>
      <div style={{fontSize:20,fontWeight:800,color:"#f87171"}}>{value}</div>
      <div style={{fontSize:10,color:"rgba(232,244,253,0.5)",textTransform:"uppercase",letterSpacing:0.4,marginTop:4}}>{label}</div>
      {sub && <div style={{fontSize:10,color:"rgba(232,244,253,0.3)",marginTop:2}}>{sub}</div>}
    </div>
  );
}

// expandable+onToggle machen den Titel selbst antippbar (mehr Trefffläche
// als nur ein kleiner Pfeil) — zeigt/verbirgt die Ergebnisse jenseits der
// Standard-Top-N (siehe TOP_LIMITS). expanded steuert nur den Pfeil (▴/▾);
// welche Zeilen tatsächlich angezeigt werden, entscheidet der Aufrufer.
function SectionCard({ title, children, expandable, expanded, onToggle }) {
  return (
    <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"14px 16px",marginBottom:14}}>
      <div onClick={expandable?onToggle:undefined}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:11,fontWeight:700,color:"rgba(232,244,253,0.4)",textTransform:"uppercase",letterSpacing:1,marginBottom:12,cursor:expandable?"pointer":"default"}}>
        <span>{title}</span>
        {expandable && <span style={{fontSize:12,color:"rgba(232,244,253,0.5)"}}>{expanded?"▴":"▾"}</span>}
      </div>
      {children}
    </div>
  );
}

function BarRow({ label, count, max, color, suffix, onClick }) {
  const pct = Math.max(4, Math.round(count/max*100));
  return (
    <div onClick={onClick} style={{marginBottom:9,cursor:onClick?"pointer":"default"}}>
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

function RankRow({ rank, primary, secondary, value, onClick }) {
  return (
    <div onClick={onClick} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",cursor:onClick?"pointer":"default"}}>
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
  const isWide = useIsWide();
  const [dives, setDives] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState({}); // { [TOP_LIMITS-Schlüssel]: true } = alle Ergebnisse statt Top-N
  const toggleExpand = (key) => setExpanded(e => ({ ...e, [key]: !e[key] }));

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

  // Scroll-Position wiederherstellen, wenn wir per "Zurück" aus dem
  // Tauchbuch hierher zurückkommen (siehe statistikReturnUrl) — kein SPA-
  // Router hier, daher ein echter Seitenwechsel und die Position kommt als
  // URL-Parameter mit statt aus einem State.
  useEffect(() => {
    if (!loaded) return;
    try {
      const y = new URLSearchParams(window.location.search).get("scrollY");
      if (y != null) {
        requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, parseInt(y, 10) || 0)));
        window.history.replaceState(null, "", "statistik.html");
      }
    } catch {}
  }, [loaded]);

  if (!loaded) return null;
  const stats = computeStats(dives);

  return (
    <div style={{minHeight:"100vh",background:"#210710",color:"#e8f4fd",fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif",paddingBottom:40}}>
      <div style={{background:"rgba(255,255,255,0.03)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"calc(28px + env(safe-area-inset-top, 0px)) 16px 12px",display:"flex",alignItems:"center",position:"sticky",top:0,zIndex:10,backdropFilter:"blur(10px)"}}>
        <button onClick={()=>{window.location.href="index.html";}} title="Zur Startseite"
          style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:"rgba(232,244,253,0.8)",cursor:"pointer",flexShrink:0}}>
          🏠
        </button>
        <span style={{fontWeight:900,fontSize:18,letterSpacing:-0.5,flex:1,textAlign:"center"}}>
          📊 Tauch-Statistik
        </span>
        <button onClick={()=>{window.location.href="hilfe.html";}} title="Hilfe"
          style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:"rgba(232,244,253,0.8)",cursor:"pointer",flexShrink:0}}>❓</button>
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
        <div style={{padding:16,maxWidth:isWide?900:undefined,margin:isWide?"0 auto":undefined}}>

          <div style={{fontSize:12,color:"rgba(232,244,253,0.4)",marginBottom:12,textAlign:"center"}}>
            {fmtDateShort(stats.firstDate)} – {fmtDateShort(stats.lastDate)}
          </div>

          {/* Kennzahlen — auf breiten Bildschirmen mehr Spalten, damit die
              Kacheln nebeneinander statt gestapelt Platz finden */}
          <div style={{display:"grid",gridTemplateColumns:isWide?"repeat(5,1fr)":"1fr 1fr 1fr",gap:8,marginBottom:14}}>
            <StatTile label="Tauchgänge" value={stats.n} onClick={()=>goDiveList()} />
            <StatTile label="Gesamtzeit" value={fmtDuration(stats.totalMin)} onClick={()=>goDiveList()} />
            <StatTile label="Ø Dauer" value={fmtDuration(stats.avgDurationMin)} onClick={()=>goDiveList()} />
            <StatTile label="Ø Tiefe" value={stats.avgDepth!=null?stats.avgDepth.toFixed(1)+" m":"—"} onClick={()=>goDiveList()} />
            <StatTile label="Max. Tiefe" value={stats.maxDepthDive?stats.maxDepthDive.maxDepth+" m":"—"} sub={stats.maxDepthDive?"TG "+stats.maxDepthDive.name:null}
              onClick={stats.maxDepthDive?()=>goDiveList({openDiveId:stats.maxDepthDive.id}):undefined} />
            <StatTile label="Ø Wassertemp." value={stats.avgTemp!=null?stats.avgTemp.toFixed(1)+"°":"—"} onClick={()=>goDiveList()} />
            <StatTile label="Reisen" value={stats.reisenCount} onClick={stats.reisenCount?()=>goDiveList({groupField:"reise"}):undefined} />
            <StatTile label="Länder" value={stats.laenderCount} onClick={stats.laenderCount?()=>goDiveList({groupField:"land"}):undefined} />
            <StatTile label="Orte" value={stats.ortCount} onClick={stats.ortCount?()=>goDiveList({groupField:"ort"}):undefined} />
            <StatTile label="Nitrox-Anteil" value={stats.nitroxPct+"%"} onClick={stats.nitroxCount?()=>goDiveList({filterField:"nitrox",filterValue:"Nitrox"}):undefined} />
            <StatTile label="Ø Bewertung" value={stats.avgRating!=null?stats.avgRating.toFixed(1)+"★":"—"} onClick={()=>goDiveList()} />
          </div>

          {/* Jahres-Verlauf */}
          {stats.years.length > 0 && (
            <SectionCard title="Tauchgänge pro Jahr">
              {stats.years.map(([yr, v]) => (
                <BarRow key={yr} label={yr} count={v.count} max={stats.maxYearCount} color="#f87171" suffix=" TG"
                  onClick={()=>goDiveList({filterField:"year",filterValue:yr})} />
              ))}
            </SectionCard>
          )}

          {/* Tiefste Tauchgänge */}
          {stats.topDepth.length > 0 && (
            <SectionCard title="Tiefste Tauchgänge" expandable expanded={!!expanded.topDepth} onToggle={()=>toggleExpand("topDepth")}>
              {(expanded.topDepth ? stats.topDepth : stats.topDepth.slice(0,TOP_LIMITS.topDepth)).map((d,i) => (
                <RankRow key={d.id} rank={i+1} primary={d.tauchspot||d.ort||"—"} secondary={`TG ${d.name} · ${d.date}`} value={d.maxDepth+" m"}
                  onClick={()=>goDiveList({openDiveId:d.id})} />
              ))}
            </SectionCard>
          )}

          {/* Längste Tauchgänge */}
          {stats.topDuration.length > 0 && (
            <SectionCard title="Längste Tauchgänge" expandable expanded={!!expanded.topDuration} onToggle={()=>toggleExpand("topDuration")}>
              {(expanded.topDuration ? stats.topDuration : stats.topDuration.slice(0,TOP_LIMITS.topDuration)).map((d,i) => (
                <RankRow key={d.id} rank={i+1} primary={d.tauchspot||d.ort||"—"} secondary={`TG ${d.name} · ${d.date}`} value={fmtDuration(d.durationMin)}
                  onClick={()=>goDiveList({openDiveId:d.id})} />
              ))}
            </SectionCard>
          )}

          {/* Beliebteste Tauchspots */}
          {stats.topSpots.length > 0 && (
            <SectionCard title="Häufigste Tauchspots" expandable expanded={!!expanded.topSpots} onToggle={()=>toggleExpand("topSpots")}>
              {(expanded.topSpots ? stats.topSpots : stats.topSpots.slice(0,TOP_LIMITS.topSpots)).map(([spot, count]) => (
                <BarRow key={spot} label={spot} count={count} max={stats.maxSpotCount} color="#fb923c" suffix=" TG"
                  onClick={()=>goDiveList({filterField:"tauchspot",filterValue:spot})} />
              ))}
            </SectionCard>
          )}

          {/* Länder-Verteilung */}
          {stats.byLand.length > 0 && (
            <SectionCard title="Länder">
              {stats.byLand.map(([land, count]) => (
                <BarRow key={land} label={land} count={count} max={stats.maxLandCount} color="#38bdf8" suffix=" TG"
                  onClick={()=>goDiveList({filterField:"land",filterValue:land})} />
              ))}
            </SectionCard>
          )}

          {/* Buddys */}
          {stats.topBuddies.length > 0 && (
            <SectionCard title="Häufigste Buddys" expandable expanded={!!expanded.topBuddies} onToggle={()=>toggleExpand("topBuddies")}>
              {(expanded.topBuddies ? stats.topBuddies : stats.topBuddies.slice(0,TOP_LIMITS.topBuddies)).map(([buddy, count]) => (
                <BarRow key={buddy} label={"👤 "+buddy} count={count} max={stats.maxBuddyCount} color="#4ade80" suffix=" TG"
                  onClick={()=>goDiveList({filterField:"buddy",filterValue:buddy})} />
              ))}
            </SectionCard>
          )}

          {/* Bewertungsverteilung */}
          <SectionCard title="Bewertungsverteilung">
            {stats.ratingDist.map(r => (
              <BarRow key={r.stars} label={"★".repeat(r.stars)} count={r.count} max={stats.maxRatingCount} color="#f59e0b" suffix=" TG"
                onClick={r.count?()=>goDiveList({filterField:"rating",filterValue:r.stars,filterLabel:"★".repeat(r.stars)}):undefined} />
            ))}
          </SectionCard>

          {/* Ausrüstung */}
          {stats.anzugCounts.length > 0 && (
            <SectionCard title="Anzüge im Einsatz" expandable expanded={!!expanded.anzug} onToggle={()=>toggleExpand("anzug")}>
              {(expanded.anzug ? stats.anzugCounts : stats.anzugCounts.slice(0,TOP_LIMITS.anzug)).map(([anzug, count]) => (
                <BarRow key={anzug} label={anzug} count={count} max={Math.max(...stats.anzugCounts.map(a=>a[1]))} color="#a78bfa" suffix=" TG"
                  onClick={()=>goDiveList({filterField:"anzug",filterValue:anzug})} />
              ))}
            </SectionCard>
          )}

          {stats.flascheCounts.length > 0 && (
            <SectionCard title="Flaschentyp">
              <div style={{display:"flex",gap:8}}>
                {stats.flascheCounts.map(([flasche, count]) => (
                  <div key={flasche} onClick={()=>goDiveList({filterField:"flasche",filterValue:flasche})}
                    style={{flex:1,background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 8px",textAlign:"center",cursor:"pointer"}}>
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
