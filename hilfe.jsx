const { useState, useEffect } = React;

// ── Hilfe-Seite ──────────────────────────────────────────────────────────
// Enthält den kompletten Inhalt der ausführlichen Gebrauchsanweisung direkt
// in der App (dunkles Design analog zu den übrigen Kapiteln). Ein Tipp auf
// einen Eintrag im Inhaltsverzeichnis springt zum jeweiligen Abschnitt.
// Die normale Browser-/Betriebssystem-Suchfunktion (z.B. Cmd/Strg+F, oder
// „Auf Seite suchen“ im Teilen-Menü auf iOS) funktioniert hier wie auf jeder
// anderen Webseite auch, da der komplette Text als echter, durchsuchbarer
// Text vorliegt.

function Section({ id, title, children }) {
  return (
    <div id={id} style={{marginBottom:22,scrollMarginTop:70}}>
      <div style={{fontSize:15,fontWeight:800,color:"#7dd3fc",borderBottom:"2px solid rgba(125,211,252,0.3)",paddingBottom:6,marginBottom:10}}>{title}</div>
      {children}
    </div>
  );
}
function Sub({ id, title, children }) {
  return (
    <div id={id} style={{marginBottom:14,scrollMarginTop:70}}>
      <div style={{fontSize:12.5,fontWeight:700,color:"#4ade80",borderLeft:"3px solid #4ade80",paddingLeft:8,marginBottom:6}}>{title}</div>
      <div style={{fontSize:12.5,color:"rgba(232,244,253,0.85)",lineHeight:1.6}}>{children}</div>
    </div>
  );
}
function T({ children }) {
  return <table style={{borderCollapse:"collapse",width:"100%",margin:"6px 0 10px 0",fontSize:11.5}}>{children}</table>;
}
function Tr({ children }) { return <tr>{children}</tr>; }
function Th({ children }) { return <th style={{border:"1px solid rgba(255,255,255,0.12)",background:"rgba(125,211,252,0.1)",color:"#7dd3fc",padding:"5px 8px",textAlign:"left"}}>{children}</th>; }
function Td({ children }) { return <td style={{border:"1px solid rgba(255,255,255,0.08)",padding:"5px 8px",textAlign:"left",verticalAlign:"top",color:"rgba(232,244,253,0.85)"}}>{children}</td>; }
function Callout({ kind, children }) {
  const colors = { tip: ["#4ade80","rgba(74,222,128,0.08)"], warn: ["#f5a623","rgba(245,166,35,0.08)"], info: ["#38bdf8","rgba(56,189,248,0.08)"] };
  const [c, bg] = colors[kind||"info"];
  return <div style={{borderLeft:`3px solid ${c}`,background:bg,borderRadius:6,padding:"7px 11px",margin:"8px 0",fontSize:11.5,color:"rgba(232,244,253,0.85)"}}>{children}</div>;
}
function Field({ children }) { return <b style={{color:"#7dd3fc"}}>{children}</b>; }
function Badge({ children }) { return <span style={{background:"rgba(125,211,252,0.15)",color:"#7dd3fc",borderRadius:8,padding:"1px 7px",fontSize:11}}>{children}</span>; }

const TOC = [
  { id:"h-ueberblick", label:"1. Überblick", subs:[
    ["h-ueberblick-was","1.1 Was ist meintauchbuch?"],
    ["h-ueberblick-aufbau","1.2 Aufbau der App"],
    ["h-ueberblick-install","1.3 Installation & Offline-Nutzung"],
    ["h-ueberblick-daten","1.4 Wo werden die Daten gespeichert?"],
    ["h-ueberblick-ipad","1.5 iPad/Desktop"],
  ]},
  { id:"h-start", label:"2. Startseite", subs:[
    ["h-start-titelbild","2.1 Titelbild ändern"],
    ["h-start-titel","2.2 Titel bearbeiten"],
    ["h-start-kacheln","2.3 Kapitel-Kacheln"],
    ["h-start-einstellungen","2.4 Einstellungen (Zahnrad)"],
    ["h-start-hilfe","2.5 Hilfe (❓)"],
  ]},
  { id:"h-tauchbuch", label:"3. Logbuch (Tauchgänge)", subs:[
    ["h-tb-liste","3.1 Die Liste: Aufbau einer Zeile"],
    ["h-tb-gruppierung","3.2 Gruppierung: Jahr oder Reise"],
    ["h-tb-sortierung","3.3 Sortierung"],
    ["h-tb-such-einfach","3.4 Suche: einfache Volltextsuche"],
    ["h-tb-such-erweitert","3.5 Suche: erweiterte Suche"],
    ["h-tb-such-syntax","3.6 Suche: Freitext-Syntax für Profis"],
    ["h-tb-karte","3.7 Karte aller angezeigten Spots"],
    ["h-tb-neu","3.8 Neuen Tauchgang anlegen"],
    ["h-tb-import","3.9 CSV-Import"],
    ["h-tb-backup","3.10 Backup: Sichern & Wiederherstellen"],
    ["h-tb-auswahl","3.11 Mehrfachauswahl"],
  ]},
  { id:"h-detail", label:"4. Tauchgang-Detailseite", subs:[
    ["h-detail-kopf","4.1 Kopfzeile"],
    ["h-detail-titel","4.2 Titel, Reise/TG-Nr., Tauchspot"],
    ["h-detail-bewertung","4.3 Bewertung & Nitrox/Air"],
    ["h-detail-karte","4.4 Koordinaten & Karte"],
    ["h-detail-bemerkungen","4.5 Bemerkungen"],
    ["h-detail-kacheln","4.6 Die vier Daten-Kacheln"],
    ["h-detail-felder","4.7 Die vollständige Feldliste"],
    ["h-detail-wischen","4.8 Zwischen Tauchgängen wischen"],
  ]},
  { id:"h-bulk", label:"5. Mehrfachauswahl bearbeiten", subs:[] },
  { id:"h-reisen", label:"6. Reisen", subs:[
    ["h-reisen-karten","6.1 Reisen-Karten"],
    ["h-reisen-verwalten","6.2 Reisen verwalten"],
  ]},
  { id:"h-material", label:"7. Material", subs:[] },
  { id:"h-statistik", label:"8. Statistik", subs:[] },
  { id:"h-brevet", label:"9. Brevet", subs:[] },
  { id:"h-einstellungen", label:"10. Einstellungen im Detail", subs:[] },
  { id:"h-tipps", label:"11. Tipps, Grenzen & häufige Fragen", subs:[] },
  { id:"h-glossar", label:"12. Glossar der Felder", subs:[] },
];

function HilfeApp() {
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "index.html";
  };

  return (
    <div style={{minHeight:"100vh",background:"#0a1628",color:"#e8f4fd",fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif",paddingBottom:60}}>
      <div style={{background:"rgba(255,255,255,0.03)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"calc(28px + env(safe-area-inset-top, 0px)) 16px 12px",display:"flex",alignItems:"center",position:"sticky",top:0,zIndex:10,backdropFilter:"blur(10px)"}}>
        <button onClick={goBack} title="Zurück"
          style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:"rgba(232,244,253,0.8)",cursor:"pointer",flexShrink:0}}>
          ←
        </button>
        <span style={{fontWeight:900,fontSize:18,letterSpacing:-0.5,flex:1,textAlign:"center",marginLeft:-32}}>
          ❓ Hilfe
        </span>
      </div>

      <div style={{padding:"18px 16px",maxWidth:640,margin:"0 auto"}}>

        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:20,fontWeight:900}}><span>mein</span><span style={{color:"#f5a623"}}>tauch</span><span>buch</span></div>
          <div style={{fontSize:11,color:"rgba(232,244,253,0.4)",marginTop:4}}>Gebrauchsanweisung — ausführliche Version</div>
        </div>

        {/* Inhaltsverzeichnis */}
        <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"14px 16px",marginBottom:24}}>
          <div style={{fontSize:11,fontWeight:700,color:"rgba(232,244,253,0.4)",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Inhaltsverzeichnis</div>
          {TOC.map(item => (
            <div key={item.id} style={{marginBottom:6}}>
              <a href={"#"+item.id} style={{color:"#7dd3fc",fontWeight:700,fontSize:12.5,textDecoration:"none"}}>{item.label}</a>
              {item.subs.length > 0 && (
                <div style={{paddingLeft:14,marginTop:2}}>
                  {item.subs.map(([sid,slabel]) => (
                    <div key={sid}><a href={"#"+sid} style={{color:"rgba(232,244,253,0.6)",fontSize:11.5,textDecoration:"none"}}>{slabel}</a></div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 1. Überblick */}
        <Section id="h-ueberblick" title="1. Überblick">
          <Sub id="h-ueberblick-was" title="1.1 Was ist meintauchbuch?">
            meintauchbuch ist ein digitales Tauchlogbuch für den Browser. Es läuft direkt im Browser
            von Handy, Tablet oder Computer, benötigt keinen Account und speichert alle Daten lokal
            in der App selbst. Neben der reinen Tauchgang-Erfassung bietet die App eine automatische
            Reisen-Übersicht, eine Ausrüstungs-Verwaltung, eine Statistik-Auswertung und eine
            Übersicht der eigenen Brevets (Tauchscheine).
          </Sub>
          <Sub id="h-ueberblick-aufbau" title="1.2 Aufbau der App (die 5 Kapitel)">
            Von der Startseite aus gelangt man in fünf Kapitel:
            <T><Tr><Th>Kapitel</Th><Th>Symbol</Th><Th>Inhalt</Th></Tr>
              <Tr><Td>Tauchgänge</Td><Td>🤿</Td><Td>Liste aller Tauchgänge, Suche, Import, Backup, Detailansicht</Td></Tr>
              <Tr><Td>Reisen</Td><Td>🧭</Td><Td>Automatisch gebildete Reise-Übersichten mit Kennzahlen</Td></Tr>
              <Tr><Td>Material</Td><Td>🎒</Td><Td>Verwaltung der eigenen Tauchausrüstung</Td></Tr>
              <Tr><Td>Statistik</Td><Td>📊</Td><Td>Automatische Auswertungen und Rekorde</Td></Tr>
              <Tr><Td>Brevet</Td><Td>🎓</Td><Td>Sammlung der eigenen Tauchscheine als Fotos</Td></Tr>
            </T>
          </Sub>
          <Sub id="h-ueberblick-install" title="1.3 Installation & Offline-Nutzung">
            meintauchbuch lässt sich wie eine normale App auf dem Homescreen ablegen: auf dem
            iPhone/iPad über Safari-Teilen-Symbol → „Zum Home-Bildschirm“, auf Android über das
            Chrome-Menü (⋮) → „App installieren“. Nach dem ersten erfolgreichen Online-Aufruf
            funktioniert die App danach auch ohne Internetverbindung; fehlt die Verbindung,
            erscheint unten ein kleiner Offline-Hinweis.
            <Callout kind="tip">Nach einem App-Update lohnt sich ein Neuladen der Seite, damit die
            neuste Version sicher geladen wird.</Callout>
          </Sub>
          <Sub id="h-ueberblick-daten" title="1.4 Wo werden die Daten gespeichert?">
            Alle Einträge werden in einem app-eigenen Speicher abgelegt, der an das jeweilige
            Gerät bzw. den jeweiligen Browser gebunden ist. Es gibt keine Cloud-Synchronisation
            zwischen mehreren Geräten — dafür dient die Backup-Funktion (Kapitel 3.9).
            <Callout kind="warn">Werden Browser-Cache/Website-Daten des Geräts geleert, gehen die
            gespeicherten Tauchgänge ohne vorheriges Backup verloren.</Callout>
          </Sub>
          <Sub id="h-ueberblick-ipad" title="1.5 iPad/Desktop">
            Ab ca. 768px Bildschirmbreite (iPad, Mac-Browserfenster) wechseln mehrere Seiten
            automatisch auf ein breiteres Layout: Home zeigt Foto und Kacheln nebeneinander,
            Tauchgänge eine Liste-plus-Detail-Ansicht (wie in Mail-Apps) sobald ein Tauchgang
            ausgewählt ist, Statistik alle Kennzahlen in einer breiteren Reihe, Material alle
            Felder gleichzeitig als Karten-Raster statt einer langen Liste, Brevet mehrspaltig.
            Auf dem iPhone bleibt alles wie gewohnt.
          </Sub>
        </Section>

        {/* 2. Startseite */}
        <Section id="h-start" title="2. Startseite">
          <Sub id="h-start-titelbild" title="2.1 Titelbild ändern">
            Ein Tipp auf das Titelbild öffnet die Bildauswahl des Geräts; das gewählte Foto wird
            direkt übernommen und gespeichert.
          </Sub>
          <Sub id="h-start-titel" title="2.2 Titel bearbeiten">
            Ein Tipp auf den Titeltext selbst (nicht auf das Foto daneben) öffnet einen Editor für
            Text, Schriftart, Schriftgrösse und Farbe des Titels. Über einen Regler lässt sich die
            Grösse stufenlos einstellen, die Farbe entweder über sechs vorgegebene Farbpunkte oder
            frei über den eigenen Farbwähler bestimmen. <b>Zurücksetzen</b> stellt wieder den
            ursprünglichen Titel „meintauchbuch“ in der Standard-Optik her.
          </Sub>
          <Sub id="h-start-kacheln" title="2.3 Kapitel-Kacheln">
            Ein Tipp auf eine Kachel öffnet das jeweilige Kapitel. „Tauchgänge“ ist breit und steht
            oben, die übrigen vier folgen darunter zu je zweit. Unter jeder Kachel steht — sobald
            Daten vorhanden sind — die jeweilige Anzahl.
          </Sub>
          <Sub id="h-start-einstellungen" title="2.4 Einstellungen (Zahnrad)">
            Unten auf der Startseite befinden sich die Buttons ⚙️ Einstellungen und ❓ Hilfe.
            Einstellungen öffnet ein Panel mit drei Reitern (Kapitel 10). Ganz unten steht die
            aktuell installierte App-Version.
          </Sub>
          <Sub id="h-start-hilfe" title="2.5 Hilfe (❓)">
            Das ❓-Badge öffnet auf jeder Seite der App genau diese Hilfeseite — mit
            Inhaltsverzeichnis und Sprungmarken, komplett als durchsuchbarer Text, auch offline
            nutzbar. Der Zurück-Pfeil oben links führt wieder zurück zu der Seite, von der aus sie
            geöffnet wurde. Fundorte:
            <T><Tr><Th>Seite</Th><Th>Position</Th></Tr>
              <Tr><Td>Startseite</Td><Td>Unten, neben ⚙️ Einstellungen</Td></Tr>
              <Tr><Td>Logbuch — Liste</Td><Td>Oben rechts, neben + Tauchgang (schmäler)</Td></Tr>
              <Tr><Td>Logbuch — Detailseite</Td><Td>Oben rechts, neben 🗑</Td></Tr>
              <Tr><Td>Reisen, Statistik, Material, Brevet</Td><Td>Oben rechts auf Titel-Höhe</Td></Tr>
            </T>
          </Sub>
        </Section>

        {/* 3. Logbuch */}
        <Section id="h-tauchbuch" title="3. Logbuch (Tauchgänge)">
          <p style={{fontSize:12.5,color:"rgba(232,244,253,0.85)"}}>Die Kopfzeile zeigt links 🏠
          zurück zur Startseite, mittig den Titel mit der Gesamtzahl aller Tauchgänge, rechts
          <Badge>+ Tauchgang</Badge> und <Badge>❓</Badge>. Darunter folgt eine Reihe Symbol-Buttons:</p>
          <T><Tr><Th>Symbol</Th><Th>Funktion</Th></Tr>
            <Tr><Td>📥</Td><Td>CSV-Import öffnen/schliessen</Td></Tr>
            <Tr><Td>💾</Td><Td>Backup-Menü öffnen/schliessen</Td></Tr>
            <Tr><Td>☑ / ✕</Td><Td>Mehrfachauswahl-Modus ein-/ausschalten</Td></Tr>
            <Tr><Td>🌐</Td><Td>Karte aller angezeigten Spots öffnen (Kapitel 3.7)</Td></Tr>
            <Tr><Td>📅 / 🧭</Td><Td>Gruppierung: nach Jahr (📅) oder nach Reise (🧭)</Td></Tr>
            <Tr><Td>🔍</Td><Td>Suche, Sortierung, Sortierrichtung sowie Alle-reduzieren/erweitern öffnen/schliessen</Td></Tr>
          </T>

          <Sub id="h-tb-liste" title="3.1 Die Liste: Aufbau einer Zeile">
            Jede Zeile zeigt Nummer, ggf. Uhrzeit, ggf. Buddy-Name (rot, mit 👤), rechts oben die
            Sterne-Bewertung, darunter Datum · Tauchspot (oder Ort) · Land, und rechts unten je
            nach Sortierung Dauer + max. Tiefe oder den Wert des gewählten Sortierfelds. Ein Tipp
            öffnet die Detailseite.
            <Callout kind="tip">Der Tauchspot-Name erscheint hellgrün statt grau, sobald für diesen
            Tauchgang gültige Koordinaten hinterlegt sind (siehe <a href="#h-detail-karte">Kapitel 4.4</a>)
            — so ist auf einen Blick erkennbar, welche Tauchgänge sich auf der Karte anzeigen lassen.</Callout>
          </Sub>
          <Sub id="h-tb-gruppierung" title="3.2 Gruppierung: Jahr oder Reise">
            Über 📅/🧭 wird umgeschaltet: <Field>Nach Jahr</Field> zeigt einen blauen Gruppenkopf pro
            Jahr; <Field>Nach Reise</Field> einen gelben Gruppenkopf pro Reise (Reihenfolge wie unter
            Reisen). Ein Tipp auf den Gruppenkopf klappt die Gruppe ein/aus — im Auswahl-Modus
            markiert er stattdessen alle Tauchgänge der Gruppe.
          </Sub>
          <Sub id="h-tb-sortierung" title="3.3 Sortierung">
            Über 🔍 öffnet/schliesst sich das Such- und Sortier-Panel. Darin öffnet der
            Sortier-Button (⇅) eine Liste aller sortierbaren Felder (Nr., Datum, Zeit, Land, Ort,
            Tauchspot, TG-Nr., Dauer, max. Tiefe, Wassertemp., Anzug, Blei, Flasche, Volumen,
            Nitrox, Buddy, Reise, Bewertung); darunter schalten zwei weitere Buttons die
            Sortierrichtung (↑/↓) sowie „Alle reduzieren/erweitern" (−/+) für die aktuell
            gewählte Gruppierung (Jahr oder Reise, siehe Kapitel 3.2) um.
          </Sub>
          <Sub id="h-tb-such-einfach" title="3.4 Suche: einfache Volltextsuche">
            Das Suchfeld im 🔍-Panel durchsucht standardmässig alle Felder eines Tauchgangs
            gleichzeitig. Ein Tipp auf ✕ im Suchfeld leert die Suche.
          </Sub>
          <Sub id="h-tb-such-erweitert" title="3.5 Suche: erweiterte Suche">
            Ein Tipp ins Suchfeld öffnet einen Baukasten: pro Zeile ein Feld, ein Operator und ein
            Wert. Über <Badge>+ Zeile</Badge> lassen sich beliebig viele Bedingungen hinzufügen; die
            Kombination (UND/ODER) wird über zwei Buttons oben rechts gewählt. Für Zahlen/Datum/Zeit
            steht zusätzlich der Operator „zw.“ (zwischen) mit zwei Eingabefeldern zur Verfügung.
          </Sub>
          <Sub id="h-tb-such-syntax" title="3.6 Suche: Freitext-Syntax für Profis">
            Dieselbe Logik lässt sich auch direkt eintippen:
            <T><Tr><Th>Syntax</Th><Th>Bedeutung</Th><Th>Beispiel</Th></Tr>
              <Tr><Td>feld:wert</Td><Td>enthält (Text) / gleich (Zahl)</Td><Td>ort:Malediven</Td></Tr>
              <Tr><Td>feld=wert</Td><Td>exakt gleich</Td><Td>land=Aegypten</Td></Tr>
              <Tr><Td>feld&gt;wert / &lt; / &gt;= / &lt;=</Td><Td>Vergleich</Td><Td>tiefe&gt;30</Td></Tr>
              <Tr><Td>feld!=wert</Td><Td>ungleich / enthält nicht</Td><Td>nitrox!=Nitrox</Td></Tr>
              <Tr><Td>UND / &amp;&amp;</Td><Td>beide Bedingungen</Td><Td>land:Aegypten UND tiefe&gt;25</Td></Tr>
              <Tr><Td>ODER / ||</Td><Td>eine der Bedingungen</Td><Td>buddy:Claude ODER buddy:Mel</Td></Tr>
              <Tr><Td>+wort</Td><Td>muss enthalten sein</Td><Td>+Muräne</Td></Tr>
              <Tr><Td>-wort</Td><Td>darf nicht enthalten sein</Td><Td>-Nachttauchgang</Td></Tr>
              <Tr><Td>"mehrere wörter"</Td><Td>zusammenhängender Suchbegriff</Td><Td>"grosser Hai"</Td></Tr>
            </T>
            Gültige Feldnamen (auch Aliasse, z.B. nr/nummer, spot, vol): nr, datum, zeit, land,
            ort, tauchspot, koordinaten, tg-nr, dauer, tiefe, temp, anzug, blei, flasche, volumen,
            nitrox, buddy, reise, rating, bemerkung.
            <Callout>Beispiel: <code>land:Aegypten UND tiefe&gt;=30 UND -Nachttauchgang</code> findet
            alle Tauchgänge in Ägypten ab 30 m, die keine Nachttauchgänge sind.</Callout>
          </Sub>
          <Sub id="h-tb-karte" title="3.7 Karte aller angezeigten Spots">
            Der 🌐-Button in der Symbolleiste (4. Symbol, neben ☑ Auswahl) öffnet eine Karte mit allen aktuell
            angezeigten Tauchgängen (also nach Suche/Filter), die im Feld „Koordinaten“ einen
            gültigen Wert hinterlegt haben — die Karte passt sich automatisch so ein, dass alle
            Punkte sichtbar sind. Jeder Marker zeigt dauerhaft seine Tauchgang-Nummer über dem Pin;
            ein Tipp auf den Marker öffnet zusätzlich ein Sprechblasen-Popup mit dem Tauchspot-Namen.
            Hat kein angezeigter Tauchgang Koordinaten, erscheint stattdessen ein Hinweis. Siehe
            auch <a href="#h-detail-karte">Kapitel 4.4</a> für die Karte eines einzelnen Tauchgangs.
          </Sub>
          <Sub id="h-tb-neu" title="3.8 Neuen Tauchgang anlegen">
            <Badge>+ Tauchgang</Badge> legt sofort einen neuen, weitgehend leeren Tauchgang an und
            öffnet dessen Detailseite. Die Nummer wird automatisch auf die nächsthöhere freie
            Nummer gesetzt; Ausrüstungsfelder übernehmen die Werte des zuletzt angelegten
            Tauchgangs.
          </Sub>
          <Sub id="h-tb-import" title="3.9 CSV-Import">
            Über 📥 öffnet sich eine Import-Fläche: CSV-Datei per Klick auswählen oder per Drag &amp;
            Drop hineinziehen. Ein Fortschrittsbalken zeigt den Import-Status.
            Erkannt werden sowohl der bekannte Logbuch-Export als auch andere CSV-Strukturen
            (z.B. aus Subsurface, MacDive oder selbst in Excel/Numbers vorbereitet) — dafür
            genügt eine Kopfzeile mit erkennbaren Spaltennamen (Datum, Ort, Tiefe, Dauer, …
            auf Deutsch oder Englisch) sowie Komma, Semikolon oder Tab als Trennzeichen.
            <Callout>Jeder in der CSV vorkommende Ort wird automatisch als eigene Reise angelegt,
            sofern er noch nicht existiert.</Callout>
          </Sub>
          <Sub id="h-tb-backup" title="3.10 Backup: Sichern & Wiederherstellen">
            Über 💾 öffnet sich das Backup-Menü: <b>☁️ Backup sichern</b> erstellt eine
            Sicherungsdatei (JSON) zum Speichern an einem beliebigen Ort; <b>⬆ Backup importieren</b>
            spielt eine zuvor erstellte Sicherungsdatei zurück ein. Die Sicherung umfasst alle
            Tauchgänge, Reisen-Namen, Material-Angaben, alle Brevet-Einträge samt Fotos sowie
            Startseiten-Titelbild und -Titel.
            <Callout kind="warn">Vor grösseren Aktionen (Mehrfachlöschung, neuer CSV-Import) lohnt
            sich vorab ein frisches Backup.</Callout>
          </Sub>
          <Sub id="h-tb-auswahl" title="3.11 Mehrfachauswahl">
            ☑ aktiviert den Auswahl-Modus. Danach lassen sich einzelne Zeilen oder ganze
            Gruppenköpfe markieren:
            <T><Tr><Th>Button</Th><Th>Funktion</Th></Tr>
              <Tr><Td>📋 Kopieren</Td><Td>Kopiert die Auswahl tabellarisch in die Zwischenablage</Td></Tr>
              <Tr><Td>✏️ Bearbeiten</Td><Td>Öffnet die Sammel-Bearbeiten-Seite (Kapitel 5)</Td></Tr>
              <Tr><Td>🗑 Löschen</Td><Td>Löscht die Auswahl nach Bestätigung unwiderruflich</Td></Tr>
            </T>
          </Sub>
        </Section>

        {/* 4. Detailseite */}
        <Section id="h-detail" title="4. Tauchgang-Detailseite">
          <p style={{fontSize:12.5,color:"rgba(232,244,253,0.85)"}}>Alle Felder sind direkt
          antippbar und werden beim Verlassen automatisch gespeichert.</p>
          <Sub id="h-detail-kopf" title="4.1 Kopfzeile">
            <T><Tr><Th>Element</Th><Th>Funktion</Th></Tr>
              <Tr><Td>←</Td><Td>Zurück zur Liste bzw. Ursprungsseite</Td></Tr>
              <Tr><Td>◀ / ▶</Td><Td>Nächster/vorheriger Tauchgang in aktueller Sortierung</Td></Tr>
              <Tr><Td>🗑</Td><Td>Diesen Tauchgang löschen (mit Sicherheitsabfrage)</Td></Tr>
              <Tr><Td>❓</Td><Td>Diese Hilfeseite öffnen</Td></Tr>
            </T>
          </Sub>
          <Sub id="h-detail-titel" title="4.2 Titel, Reise/TG-Nr., Tauchspot">
            Oben klein/blau das Datum, darunter gross die Tauchgang-Nummer (antippbar). Ein gelbes
            Badge zeigt bei Reise-Zuordnung das Verhältnis „Reise-Nr./Gesamtzahl“ (z.B. „31/2“).
            Rechts daneben steht in Rot der Tauchspot.
          </Sub>
          <Sub id="h-detail-bewertung" title="4.3 Bewertung & Nitrox/Air">
            Fünf antippbare Sterne (1–5); erneutes Tippen auf den aktiven Stern setzt auf 0 zurück.
            Bei gesetztem Nitrox/Air-Wert erscheint ein farbiges Badge daneben. Ganz rechts in
            dieser Zeile befindet sich der 🌐-Button für die Karte (siehe nächster Abschnitt).
          </Sub>
          <Sub id="h-detail-karte" title="4.4 Koordinaten & Karte">
            Im Feld <Field>Koordinaten</Field> (siehe Feldliste weiter unten) lassen sich die
            GPS-Koordinaten des Tauchspots eintragen. Erkannt werden mehrere gängige Schreibweisen:
            <T><Tr><Th>Format</Th><Th>Beispiel</Th></Tr>
              <Tr><Td>Dezimalgrad</Td><Td>27.2578, 33.8116</Td></Tr>
              <Tr><Td>Dezimalgrad mit Himmelsrichtung</Td><Td>27.2578N, 33.8116E</Td></Tr>
              <Tr><Td>Grad + Dezimalminuten (übliches GPS-Format)</Td><Td>27°15.468'N 33°48.696'E</Td></Tr>
              <Tr><Td>Grad/Minuten/Sekunden</Td><Td>27°15'28.1"N, 33°48'41.8"E</Td></Tr>
            </T>
            Der 🌐-Button auf der Bewertungszeile öffnet bzw. schliesst eine Karte direkt unter den
            Bemerkungen, die den Spot anhand der eingetragenen Koordinaten anzeigt — der Marker
            zeigt dauerhaft die Tauchgang-Nummer über dem Pin. Sind keine (gültigen) Koordinaten
            hinterlegt, erscheint stattdessen ein Hinweis mit Format-Beispiel.
          </Sub>
          <Sub id="h-detail-bemerkungen" title="4.5 Bemerkungen">
            Mehrzeiliges Freitextfeld für Beobachtungen — antippen öffnet die Bearbeitung.
          </Sub>
          <Sub id="h-detail-kacheln" title="4.6 Die vier Daten-Kacheln">
            Vier frei wählbare Kacheln, standardmässig Dauer, max. Tiefe, Wassertemp., Zeit. Ein
            Tipp auf Beschriftung + ⚙ öffnet die Feldauswahl (14 Optionen); ein Tipp auf den Wert
            öffnet direkt dessen Bearbeitung.
            <Callout kind="tip">Die gewählte Belegung gilt geräteweit für alle Tauchgänge.</Callout>
          </Sub>
          <Sub id="h-detail-felder" title="4.7 Die vollständige Feldliste">
            <T><Tr><Th>Feld</Th><Th>Beschreibung</Th></Tr>
              <Tr><Td>Datum</Td><Td>Tauchdatum (TT.MM.JJJJ)</Td></Tr>
              <Tr><Td>Land</Td><Td>Freitext</Td></Tr>
              <Tr><Td>Ort, Reise</Td><Td>Auswahlliste aller Reisen — setzt Ort und Reise-Zuordnung gleichzeitig</Td></Tr>
              <Tr><Td>TG-Nr.</Td><Td>Nummer innerhalb der Reise</Td></Tr>
              <Tr><Td>Tauchspot</Td><Td>Konkreter Tauchplatz</Td></Tr>
              <Tr><Td>Koordinaten</Td><Td>GPS-Position des Spots (mehrere Formate erkannt, siehe 4.4)</Td></Tr>
              <Tr><Td>Anzug</Td><Td>Freitext, z.B. „5mm“</Td></Tr>
              <Tr><Td>Blei</Td><Td>Auswahl 3–8 kg</Td></Tr>
              <Tr><Td>Flasche</Td><Td>Alu / Stahl</Td></Tr>
              <Tr><Td>Volumen</Td><Td>15 L / 12 L</Td></Tr>
              <Tr><Td>Nitrox</Td><Td>Air / Nitrox</Td></Tr>
              <Tr><Td>Buddy</Td><Td>Name des Tauchpartners</Td></Tr>
            </T>
          </Sub>
          <Sub id="h-detail-wischen" title="4.8 Zwischen Tauchgängen wischen">
            Auf Touch-Geräten: nach links wischen = nächster (neuerer) Tauchgang, nach rechts =
            vorheriger (älterer) — analog zu ◀/▶.
          </Sub>
        </Section>

        {/* 5. Bulk Edit */}
        <Section id="h-bulk" title="5. Mehrfachauswahl bearbeiten">
          <p style={{fontSize:12.5,color:"rgba(232,244,253,0.85)"}}>
          Öffnet sich über ✏️ Auswahl bearbeiten und ist optisch identisch zur normalen
          Detailseite — nur zeigt die Titelzeile die Nummern aller ausgewählten Tauchgänge.
          Aufeinanderfolgende Nummern werden zu einem Bereich zusammengefasst
          (<Badge>123 - 129</Badge>), nicht fortlaufende bleiben einzeln
          (<Badge>141, 145, 150</Badge>).</p>
          <Callout><b>„variabel“:</b> Felder mit unterschiedlichen Werten in der Auswahl zeigen
          „variabel“. Leer gelassen bleiben die individuellen Werte unangetastet; ein eingetragener
          Wert überschreibt ihn bei allen ausgewählten Tauchgängen.</Callout>
          <p style={{fontSize:12.5,color:"rgba(232,244,253,0.85)"}}>Am Ende: <Badge>Abbrechen</Badge>
          (verwirft Änderungen) und <Badge>Speichern</Badge> (übernimmt sie für alle Ausgewählten).</p>
        </Section>

        {/* 6. Reisen */}
        <Section id="h-reisen" title="6. Reisen">
          <Sub id="h-reisen-karten" title="6.1 Reisen-Karten">
            Horizontal wischbare Karten, fest sortiert nach dem Datum des letzten Tauchgangs jeder
            Reise (neuste links). Jede Karte zeigt Name, Zeitraum, alle zugehörigen Tauchgänge
            sowie Kennzahlen (Anzahl, Gesamtzeit, max. Tiefe, Nummernspanne).
          </Sub>
          <Sub id="h-reisen-verwalten" title="6.2 Reisen verwalten">
            <T><Tr><Th>Element</Th><Th>Funktion</Th></Tr>
              <Tr><Td>Manuell / Nach Datum TG / A–Z</Td><Td>Sortier-Modus dieser Verwaltungsliste (nicht der Karten)</Td></Tr>
              <Tr><Td>Namensfeld</Td><Td>Direkt umbenennbar, überträgt sich auf alle zugeordneten Tauchgänge</Td></Tr>
              <Tr><Td>Zahl rechts</Td><Td>Anzahl aktuell zugeordneter Tauchgänge</Td></Tr>
              <Tr><Td>🗑</Td><Td>Reise löschen — Tauchgänge bleiben, verlieren nur die Zuordnung</Td></Tr>
              <Tr><Td>+ Anlegen</Td><Td>Neue, leere Reise als Platzhalter anlegen</Td></Tr>
            </T>
            <Callout kind="tip">Löscht man den letzten einer automatisch entstandenen Reise
            zugeordneten Tauchgang, verschwindet die Reise von selbst aus dieser Liste.</Callout>
          </Sub>
        </Section>

        {/* 7. Material */}
        <Section id="h-material" title="7. Material">
          <p style={{fontSize:12.5,color:"rgba(232,244,253,0.85)"}}>Sechs Felder: 🫁 Regulator,
          🦺 BCD, 🤿 Anzug, 🥽 Maske, 🩴 Finns, ⌚ Uhr/Computer — je per Tipp editierbar. Bei
          Regulator, BCD, Anzug und Uhr/Computer lässt sich über den Pfeil (▸/▾) zusätzlich ein
          Revisionsdatum aufklappen und eintragen.</p>
        </Section>

        {/* 8. Statistik */}
        <Section id="h-statistik" title="8. Statistik">
          <p style={{fontSize:12.5,color:"rgba(232,244,253,0.85)"}}>Wertet automatisch alle
          erfassten Tauchgänge aus, keine eigene Eingabe nötig.</p>
          <T><Tr><Th>Abschnitt</Th><Th>Inhalt</Th></Tr>
            <Tr><Td>Kennzahlen</Td><Td>Tauchgänge, Gesamtzeit, Ø Dauer, Ø/Max. Tiefe, Ø Wassertemp., Reisen, Länder, Orte, Nitrox-Anteil, Ø Bewertung</Td></Tr>
            <Tr><Td>Tauchgänge pro Jahr</Td><Td>Balkendiagramm</Td></Tr>
            <Tr><Td>Tiefste / Längste Tauchgänge</Td><Td>Top 5</Td></Tr>
            <Tr><Td>Häufigste Tauchspots / Buddys</Td><Td>Top 6</Td></Tr>
            <Tr><Td>Länder</Td><Td>Verteilung</Td></Tr>
            <Tr><Td>Bewertungsverteilung</Td><Td>Anzahl je Sterne-Stufe</Td></Tr>
            <Tr><Td>Anzüge / Flaschentyp</Td><Td>Verteilung der Ausrüstung</Td></Tr>
          </T>
          <p style={{fontSize:12.5,color:"rgba(232,244,253,0.85)"}}>Abschnitte erscheinen nur bei
          vorhandenen Daten.</p>
        </Section>

        {/* 9. Brevet */}
        <Section id="h-brevet" title="9. Brevet">
          <p style={{fontSize:12.5,color:"rgba(232,244,253,0.85)"}}>Ablage für Fotos der eigenen
          Tauchscheine. <Badge>+ Weiteres Brevet hinzufügen</Badge> legt eine neue Karte an; Name
          direkt editierbar; leere Bildfläche antippen = Foto hochladen, vorhandenes Foto antippen
          = Vollbildansicht (✕ schliesst sie); <b>✎ Ändern</b> ersetzt das Foto; 🗑 löscht den
          ganzen Eintrag.</p>
          <Callout kind="tip">Fotos werden automatisch verkleinert (max. 1600 px, JPEG 85%), damit
          auch grosse Handyfotos platzsparend gespeichert werden.</Callout>
        </Section>

        {/* 10. Einstellungen */}
        <Section id="h-einstellungen" title="10. Einstellungen im Detail">
          <p style={{fontSize:12.5,color:"rgba(232,244,253,0.85)"}}>Öffnet sich über ⚙️
          Einstellungen auf der Startseite, drei Reiter:</p>
          <T><Tr><Th>Reiter</Th><Th>Inhalt</Th></Tr>
            <Tr><Td>📋 Log-Dateien</Td><Td>Seitenübergreifendes Fehlerprotokoll mit Zeitstempel; Kopieren/Leeren möglich</Td></Tr>
            <Tr><Td>📝 Notizen</Td><Td>Freies, app-weites Notizfeld</Td></Tr>
            <Tr><Td>Änderungsverlauf</Td><Td>Komplette Versionshistorie, neuste zuerst</Td></Tr>
          </T>
        </Section>

        {/* 11. Tipps */}
        <Section id="h-tipps" title="11. Tipps, Grenzen & häufige Fragen">
          <Sub title="Wie bekomme ich Papier-Logbuch-Einträge in die App?">
            Über den CSV-Import (Kapitel 3.8), z.B. vorbereitet in Excel/Numbers/Google Sheets.
          </Sub>
          <Sub title="Mehrere Geräte synchron nutzen?">
            Nicht automatisch — jedes Gerät speichert eigenständig. Für den Abgleich: Backup-Export
            auf dem einen, Backup-Import auf dem anderen Gerät.
          </Sub>
          <Sub title="Was passiert beim Leeren des Browser-Caches?">
            Ohne vorheriges Backup gehen alle lokal gespeicherten Daten der App verloren.
          </Sub>
          <Sub title="TG-Nr. vs. die grosse Tauchgang-Nummer?">
            Die grosse Nummer zählt fortlaufend über das gesamte Logbuch; TG-Nr. zählt optional nur
            innerhalb einer Reise (gelbes Badge auf der Detailseite).
          </Sub>
          <Sub title="Warum verschwindet eine Reise plötzlich?">
            Wird der letzte ihr zugeordnete Tauchgang gelöscht, wird eine automatisch entstandene
            Reise aus der Verwaltungsliste entfernt (Kapitel 6.2).
          </Sub>
        </Section>

        {/* 12. Glossar */}
        <Section id="h-glossar" title="12. Glossar der Felder">
          <T><Tr><Th>Feld</Th><Th>Erklärung</Th></Tr>
            <Tr><Td>Nr.</Td><Td>Fortlaufende Tauchgang-Nummer über das gesamte Logbuch</Td></Tr>
            <Tr><Td>Datum / Zeit</Td><Td>Tauchdatum bzw. Einstiegszeit</Td></Tr>
            <Tr><Td>Land / Ort</Td><Td>Reiseland bzw. Region/Resort/Boot</Td></Tr>
            <Tr><Td>Reise</Td><Td>Gruppierung für „Reisen“; standardmässig = Ort, aber änderbar</Td></Tr>
            <Tr><Td>TG-Nr.</Td><Td>Tauchgang-Nummer innerhalb der Reise</Td></Tr>
            <Tr><Td>Tauchspot</Td><Td>Konkreter Tauchplatz/Riffname</Td></Tr>
            <Tr><Td>Dauer</Td><Td>Tauchzeit</Td></Tr>
            <Tr><Td>max. Tiefe</Td><Td>Maximal erreichte Tiefe in Metern</Td></Tr>
            <Tr><Td>Wassertemp.</Td><Td>Wassertemperatur in °C</Td></Tr>
            <Tr><Td>Anzug</Td><Td>Verwendeter Neoprenanzug</Td></Tr>
            <Tr><Td>Blei</Td><Td>Bleigewicht in kg</Td></Tr>
            <Tr><Td>Flasche</Td><Td>Alu oder Stahl</Td></Tr>
            <Tr><Td>Volumen</Td><Td>15 L oder 12 L</Td></Tr>
            <Tr><Td>Nitrox</Td><Td>Air oder Nitrox</Td></Tr>
            <Tr><Td>Buddy</Td><Td>Name des Tauchpartners</Td></Tr>
            <Tr><Td>Bewertung</Td><Td>Persönliche Sterne-Bewertung, 1–5</Td></Tr>
            <Tr><Td>Bemerkungen</Td><Td>Freitext für Beobachtungen und Notizen</Td></Tr>
          </T>
        </Section>

        <div style={{textAlign:"center",fontSize:10,color:"rgba(232,244,253,0.3)",marginTop:10}}>
          Ende der Hilfe. Zurück über ← oben oder 🏠 auf der Startseite.
        </div>
      </div>
    </div>
  );
}
