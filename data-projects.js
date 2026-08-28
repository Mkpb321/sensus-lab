/* Sensus Lab – Beziehungskatalog, Konstanten, DOM-Referenzen, globaler Zustand und Projektverwaltung. */
"use strict";

const RELATIONSHIPS = Object.freeze({"reihe":{"label":"Reihe","biblearcLabel":"Series","uiCode":"R","category":"koordination","min":2,"max":null,"definition":"Jeder Teil trägt einen selbstständigen Punkt zu einem gemeinsamen Ganzen bei; keiner stützt den anderen.","test":"Lassen sich die Teile natürlich mit „und außerdem“ verbinden?","signals":["und","auch","außerdem","zudem","ferner","ebenso","weder … noch","noch"],"roles":[],"primary":"all","allowRoleSwap":false,"extended":false,"reversal":"Keine Richtungsumkehr; die Reihenfolge des Textes bleibt erhalten.","note":"„Und“ allein beweist keine Reihe; es kann fast jede Beziehung verdecken."},"steigerung":{"label":"Abfolge","biblearcLabel":"Progression","uiCode":"Abf","category":"koordination","min":2,"max":null,"definition":"Jeder Teil ist ein weiterer Schritt hin zu einem Höhepunkt oder einer stärkeren Aussage.","test":"Bildet die Reihenfolge echte Schritte oder eine Zuspitzung?","signals":["zuerst … dann … schließlich","und dann","dann","mehr noch","darüber hinaus","schließlich"],"roles":[],"primary":"all","allowRoleSwap":false,"extended":false,"reversal":"Nicht umkehren; die Abfolge folgt der Textreihenfolge.","note":"Eine bloße Liste ist eine Reihe, keine Abfolge."},"alternative":{"label":"Alternative","biblearcLabel":"Alternative","uiCode":"A","category":"koordination","min":2,"max":null,"definition":"Die Teile nennen verschiedene Möglichkeiten, die aus derselben Situation entstehen.","test":"Sind dies echte Optionen oder nur gegensätzliche Aussagen?","signals":["oder","entweder … oder","andernfalls","andererseits","während","wohingegen"],"roles":[],"primary":"all","allowRoleSwap":false,"extended":false,"reversal":"Keine semantische Haupt-/Nebenrichtung.","note":"Kontrast allein ist häufig Verneinung–Bejahung oder Einräumung."},"begruendung":{"label":"Begründung","biblearcLabel":"Ground","uiCode":"Bg","category":"eigenstaendige_stuetze","min":2,"max":2,"definition":"Eine Aussage wird durch einen nachfolgenden Grund oder ein Argument gestützt.","test":"Kann zwischen den Seiten „denn/weil“ stehen?","signals":["denn","weil","da","zumal","aufgrund dessen","wegen","nämlich"],"roles":["Aussage","Grund"],"primary":0,"allowRoleSwap":true,"extended":false,"reversal":"Die Richtung folgt der Auswahlreihenfolge. Mit „Richtung umkehren“ werden Aussage und Grund so neu zugeordnet, als wären die Einheiten beim Erstellen in umgekehrter Reihenfolge gewählt worden.","note":"Nicht mit Zweck verwechseln: Begründung blickt auf die Ursache zurück."},"folgerung":{"label":"Folgerung","biblearcLabel":"Inference","uiCode":"Fg","category":"eigenstaendige_stuetze","min":2,"max":2,"definition":"Ein vorausgehender Grund oder ein Argument führt zu einer nachfolgenden Schlussfolgerung.","test":"Kann vor dem zweiten Teil „deshalb/also“ stehen?","signals":["deshalb","daher","darum","folglich","dementsprechend","also","somit","demnach","infolgedessen"],"roles":["Grund","Folgerung"],"primary":1,"allowRoleSwap":true,"extended":false,"reversal":"Die Richtung folgt der Auswahlreihenfolge. Mit „Richtung umkehren“ werden Grund und Folgerung so neu zugeordnet, als wären die Einheiten beim Erstellen in umgekehrter Reihenfolge gewählt worden.","note":"„Dann“ kann zeitlich oder als Abfolge gemeint sein und ist nicht automatisch eine Folgerung."},"beidseitige_begruendung":{"label":"Beidseitige Begründung","biblearcLabel":"Bilateral","uiCode":"BB","category":"eigenstaendige_stuetze","min":3,"max":3,"definition":"Der mittlere Teil liefert den Grund für zwei Aussagen – eine davor und eine danach.","test":"Ergibt das Muster „Schluss – denn Grund – deshalb Schluss“ Sinn?","signals":["denn","weil","da","deshalb","daher","also","so"],"roles":["Schluss","Grund","Schluss"],"primary":[0,2],"allowRoleSwap":false,"extended":false,"reversal":"Keine binäre Umkehr; die mittlere Position ist zwingend der stützende Grund.","note":"Nicht als gewöhnliche Zweierbeziehung modellieren; drei benachbarte Einheiten sind erforderlich."},"handlung_ergebnis":{"label":"Handlung–Ergebnis","biblearcLabel":"Action-Result","uiCode":"H/Erg","category":"eigenstaendige_stuetze","min":2,"max":2,"definition":"Eine Handlung und die tatsächliche Folge oder das Ergebnis, das mit ihr eintritt.","test":"Ist der zweite Sachverhalt eingetreten – im Unterschied zu einer bloßen Absicht?","signals":["sodass","so dass","mit dem Ergebnis, dass","weshalb","dadurch"],"roles":["Handlung","Ergebnis"],"primary":1,"allowRoleSwap":true,"extended":false,"reversal":"Rollen dürfen vertauscht werden, wenn das Ergebnis im Text vor der Handlung steht.","note":"Nicht mit Handlung–Zweck verwechseln: Ergebnis ist tatsächlich, Zweck ist beabsichtigt."},"handlung_zweck":{"label":"Handlung–Zweck","biblearcLabel":"Action-Purpose","uiCode":"H/Z","category":"eigenstaendige_stuetze","min":2,"max":2,"definition":"Eine Handlung und ihr beabsichtigtes Ziel.","test":"Antwortet der zweite Teil auf „wozu?“ oder „mit welcher Absicht?“","signals":["damit","um … zu","auf dass","zum Zweck, dass","damit nicht"],"roles":["Handlung","Zweck"],"primary":1,"allowRoleSwap":true,"extended":false,"reversal":"Rollen dürfen entsprechend der Textreihenfolge vertauscht werden.","note":"Ein Zweck muss nicht eintreten; genau das unterscheidet ihn vom Ergebnis. In Sensus Lab ist der Zweck standardmäßig der Hauptpunkt."},"bedingung_folge":{"label":"Bedingung–Folge","biblearcLabel":"Conditional","uiCode":"B/F","category":"eigenstaendige_stuetze","min":2,"max":2,"definition":"Die mögliche Folge hängt davon ab, dass eine Bedingung erfüllt wird.","test":"Lässt sich „wenn …, dann …“ einsetzen?","signals":["wenn … dann","falls","sofern","vorausgesetzt, dass","außer wenn","es sei denn","wenn nicht"],"roles":["Bedingung","Folge"],"primary":1,"allowRoleSwap":true,"extended":false,"reversal":"Bedingung und Folge dürfen der Textreihenfolge entsprechend vertauscht werden.","note":"Eine tatsächlich eingetretene Folge ist eher Handlung–Ergebnis."},"zeit":{"label":"Zeit","biblearcLabel":"Temporal","uiCode":"Zt","category":"eigenstaendige_stuetze","min":2,"max":2,"definition":"Ein Teil bezeichnet den Zeitpunkt oder Zeitraum, in dem der andere wahr ist oder eintreten kann.","test":"Antwortet ein Teil auf „wann?“","signals":["wenn","als","immer wenn","nachdem","bevor","während","seit","sobald","bis"],"roles":["Zeit","Hauptaussage"],"primary":1,"allowRoleSwap":true,"extended":false,"reversal":"Rollen dürfen vertauscht werden.","note":"„Während“ kann zeitlich oder als Gegensatz („wohingegen“) gebraucht sein."},"ort":{"label":"Ort","biblearcLabel":"Locative","uiCode":"O","category":"eigenstaendige_stuetze","min":2,"max":2,"definition":"Ein Teil bezeichnet den Ort oder Bereich, in dem der andere wahr ist oder eintreten kann.","test":"Antwortet ein Teil auf „wo/wohin/woher?“","signals":["wo","wo immer","überall, wo","wohin","woher","an dem Ort, an dem"],"roles":["Ort","Hauptaussage"],"primary":1,"allowRoleSwap":true,"extended":false,"reversal":"Rollen dürfen vertauscht werden.","note":"Eine bloße kurze Präpositionalgruppe wird nur abgeteilt, wenn sie die Logik sichtbar prägt."},"handlung_art_weise":{"label":"Handlung–Art und Weise","biblearcLabel":"Action-Manner","uiCode":"H/AW","category":"erlaeuternde_stuetze","min":2,"max":2,"definition":"Ein Teil nennt eine Handlung, der andere beschreibt, wie oder wodurch sie ausgeführt wird.","test":"Antwortet der stützende Teil auf „wie?“ oder „wodurch?“","signals":["indem","dadurch, dass","durch","mittels","auf diese Weise","so"],"roles":["Handlung","Art und Weise"],"primary":0,"allowRoleSwap":true,"extended":false,"reversal":"Rollen dürfen der Textreihenfolge entsprechend vertauscht werden.","note":"„Durch“ kann Mittel, Ort/Bereich oder bloße Präposition sein."},"vergleich":{"label":"Vergleich","biblearcLabel":"Comparison","uiCode":"V","category":"erlaeuternde_stuetze","min":2,"max":2,"definition":"Ein Teil verdeutlicht den anderen, indem er zeigt, wie dieser ihm gleicht.","test":"Zeigt ein Teil, wie der andere ist?","signals":["wie","so wie","ebenso wie","genauso wie","auf dieselbe Weise","gleich","ähnlich","so auch","als ob"],"roles":["Hauptaussage","Vergleichsbild"],"primary":0,"allowRoleSwap":true,"extended":false,"reversal":"Rollen dürfen vertauscht werden.","note":"„Als“ kann ebenso eine Zeitbeziehung einleiten."},"verneinung_bejahung":{"label":"Verneinung–Bejahung","biblearcLabel":"Negative-Positive","uiCode":"−/+","category":"erlaeuternde_stuetze","min":2,"max":2,"definition":"Eine Aussage wird verneint, damit die bejahte oder bevorzugte Aussage umso stärker hervortritt.","test":"Passt „nicht …, sondern …“ oder „nicht dies, vielmehr das“?","signals":["nicht … sondern","vielmehr","stattdessen","statt","nicht nur … sondern","wohingegen"],"roles":["Verneinung","Bejahung"],"primary":1,"allowRoleSwap":true,"extended":false,"reversal":"Rollen dürfen der Textreihenfolge entsprechend vertauscht werden.","note":"Nicht jeder Gegensatz ist eine ausdrückliche Verneinung–Bejahung."},"aussage_erklaerung":{"label":"Aussage–Erklärung","biblearcLabel":"Idea-Explanation","uiCode":"Aus/Erk","category":"erlaeuternde_stuetze","min":2,"max":2,"definition":"Eine ursprüngliche Aussage wird durch einen weiteren Teil genauer erklärt oder inhaltlich entfaltet.","test":"Kann „das heißt/mit anderen Worten/nämlich“ eingesetzt werden?","signals":["das heißt","nämlich","mit anderen Worten","und zwar","genauer gesagt","das bedeutet","insofern als"],"roles":["Aussage","Erklärung"],"primary":0,"allowRoleSwap":true,"extended":false,"reversal":"Rollen dürfen der Textreihenfolge entsprechend vertauscht werden.","note":"Dies ist die breite Auffangkategorie; präzisere Beziehungen gehen vor."},"frage_antwort":{"label":"Frage–Antwort","biblearcLabel":"Question-Answer","uiCode":"Q/A","category":"erlaeuternde_stuetze","min":2,"max":2,"definition":"Eine echte Frage eröffnet den Kontext für die darauf gegebene Antwort.","test":"Gibt es außer dem Fragezeichen auch eine tatsächliche Antwort?","signals":["Fragezeichen","wer","was","wie","warum","wo","wann"],"roles":["Frage","Antwort"],"primary":1,"allowRoleSwap":true,"extended":false,"reversal":"Rollen dürfen bei nachgestellter Frage vertauscht werden.","note":"Rhetorische Fragen können als Aussagen paraphrasiert werden und brauchen nicht zwingend Q/A."},"einraeumung":{"label":"Einräumung","biblearcLabel":"Concessive","uiCode":"Einr","category":"gegensaetzliche_stuetze","min":2,"max":2,"definition":"Eine Hauptaussage bleibt trotz eines entgegenstehenden oder erwartungswidrigen Umstands bestehen.","test":"Passt „obwohl X, gilt dennoch Y“?","signals":["obwohl","obgleich","wenngleich","auch wenn","selbst wenn","dennoch","trotzdem","gleichwohl","doch","jedoch","aber"],"roles":["Einräumung","Hauptaussage"],"primary":1,"allowRoleSwap":true,"extended":false,"reversal":"Rollen dürfen der Textreihenfolge entsprechend vertauscht werden.","note":"Alternative und Verneinung–Bejahung haben andere logische Funktionen."},"situation_reaktion":{"label":"Situation–Reaktion","biblearcLabel":"Situation-Response","uiCode":"Sit/Re","category":"gegensaetzliche_stuetze","min":2,"max":2,"definition":"Auf eine Situation folgt eine überraschende, kontraintuitive oder unerwartete Reaktion.","test":"Ist die Reaktion gerade deshalb bemerkenswert, weil man das Gegenteil erwarten würde?","signals":["und","doch","aber","trotzdem"],"roles":["Situation","Reaktion"],"primary":1,"allowRoleSwap":true,"extended":false,"reversal":"Rollen dürfen bei abweichender Textreihenfolge vertauscht werden.","note":"Die Überraschung muss inhaltlich begründet sein; „und“ reicht nicht."},"sowohl_als_auch":{"label":"Sowohl–als-auch","biblearcLabel":"Both-And","uiCode":"S/A","category":"erweitert","min":2,"max":null,"definition":"Zwei oder mehr Teile werden ausdrücklich gemeinsam als wahr oder gemeinsam als falsch hervorgehoben.","test":"Ist die Gemeinsamkeit ausdrücklich betont?","signals":["sowohl … als auch","beide","weder … noch"],"roles":[],"primary":"all","allowRoleSwap":false,"extended":true,"reversal":"Keine Haupt-/Nebenrichtung.","note":"Ohne Betonung genügt meist die Beziehung Reihe."},"allgemein_spezifisch":{"label":"Allgemein–Spezifisch","biblearcLabel":"General-Specific","uiCode":"All/Sp","category":"erweitert","min":2,"max":2,"definition":"Ein Teil nennt das Ganze, der andere einen oder mehrere konkrete Teile davon.","test":"Nennt der zweite Teil Beispiele oder Bestandteile eines Ganzen?","signals":["zum Beispiel","beispielsweise","etwa","insbesondere","wie etwa"],"roles":["Allgemein","Spezifisch"],"primary":0,"allowRoleSwap":true,"extended":true,"reversal":"Rollen dürfen vertauscht werden.","note":"Ohne die erweiterte Liste fällt dies unter Aussage–Erklärung."},"tatsache_deutung":{"label":"Tatsache–Deutung","biblearcLabel":"Fact-Interpretation","uiCode":"Tat/Deu","category":"erweitert","min":2,"max":2,"definition":"Eine Tatsache wird nicht nur ergänzt, sondern ausdrücklich gedeutet.","test":"Sagt der zweite Teil, was die Tatsache bedeutet?","signals":["das heißt","was bedeutet","damit ist gemeint","gedeutet als"],"roles":["Tatsache","Deutung"],"primary":0,"allowRoleSwap":true,"extended":true,"reversal":"Rollen dürfen vertauscht werden.","note":"Bloße Zusatzinformation ist Aussage–Erklärung, nicht Deutung."},"ankuendigung_erfuellung":{"label":"Ankündigung–Erfüllung","biblearcLabel":"Anticipation-Fulfillment","uiCode":"Ank/Erf","category":"erweitert","min":2,"max":2,"definition":"Eine Ankündigung oder Verheißung steht mit ihrer späteren Erfüllung zusammen.","test":"Wird ein zuvor angekündigter Sachverhalt ausdrücklich erfüllt?","signals":["und so","daraufhin erfüllte sich","wie angekündigt","damit erfüllte sich"],"roles":["Ankündigung","Erfüllung"],"primary":1,"allowRoleSwap":true,"extended":true,"reversal":"Rollen dürfen vertauscht werden.","note":"Ein gewöhnliches Ergebnis ohne vorherige Ankündigung ist Handlung–Ergebnis."}});
const EVERYDAY_EXAMPLES = Object.freeze({
  reihe: "Auf der Feier sangen wir Geburtstagslieder, spielten Spiele und aßen Kuchen.",
  steigerung: "Zuerst verbindest du die Augen, dann drehst du dich fünfmal im Kreis und schließlich schlägst du nach der Piñata.",
  alternative: "Möchtest du zuerst deine Geschenke öffnen oder ein Spiel spielen?",
  handlung_art_weise: "Er pustete die Kerzen aus, indem er kräftig über den Kuchen blies.",
  vergleich: "Du willst wieder ein Ninja-Motto, so wie letztes Jahr?",
  verneinung_bejahung: "Die Socken von Oma gefallen mir nicht, aber mein neuer Spielzeuglaster ist großartig.",
  aussage_erklaerung: "Joseph wird heute dreizehn; damit ist er jetzt ein Teenager.",
  frage_antwort: "Wie spät ist es? Zeit für den Kuchen!",
  begruendung: "Können wir ein Video anmachen? Denn 25 Kinder im Haus machen mich wahnsinnig.",
  folgerung: "Du bist mein bester Freund, also musst du zu meiner Feier kommen!",
  beidseitige_begruendung: "Wir sollten alle einladen. Es ist sein zehnter Geburtstag! Deshalb machen wir dieses Jahr etwas Größeres.",
  handlung_ergebnis: "Ich habe sieben Kekse gegessen, und jetzt bereue ich es.",
  handlung_zweck: "Lass uns gemeinsam ein Geschenk kaufen, damit wir etwas Größeres schenken können.",
  bedingung_folge: "Wenn du möchtest, können wir deinen Geburtstag im Park feiern.",
  zeit: "Wenn ich ‚Los‘ sage, heben wir sie achtmal auf dem Stuhl hoch.",
  ort: "Steck dem Esel den Schwanz dorthin, wo ein Esel normalerweise seinen Schwanz hat.",
  einraeumung: "Obwohl heute nicht ihr Geburtstag ist, habe ich deinen Geschwistern auch kleine Geschenke mitgebracht.",
  situation_reaktion: "Ihr Vater sagte, sie dürfe ihre Geschenke öffnen, und sie fing plötzlich an zu weinen.",

  // Die bereitgestellte Beispielsammlung enthält nur die 18 Kernbeziehungen.
  // Für die vier erweiterten Beziehungen ergänzen wir gleichartige deutsche Alltagsbeispiele.
  sowohl_als_auch: "Sowohl Mia als auch Jonas bringen einen Kuchen mit.",
  allgemein_spezifisch: "Wir brauchen noch Partyzubehör, zum Beispiel Becher, Servietten und Luftballons.",
  tatsache_deutung: "Alle Gäste sind schon da; das bedeutet, dass wir anfangen können.",
  ankuendigung_erfuellung: "Er hatte eine Zaubershow angekündigt, und später führte er sie tatsächlich vor."
});

const SIGNAL_WORDS = Object.freeze([["aber","A; −/+; Einr","Option, Korrektur oder Einräumung","Nur Kontext entscheidet."],["als","Zt; V","Zeitpunkt oder Vergleich","„Als er kam“ ≠ „als ein König“."],["also","Fg; R","Schluss oder Fortsetzung","Gesprochene Füllverwendung nicht überbewerten."],["andererseits","A","zweite Möglichkeit/Seite","Oft Teil eines Gegensatzpaares."],["auch","R","zusätzlicher selbstständiger Punkt","Kann bloße Betonung sein."],["auch wenn","Einr","eingeräumter Gegengrund","Test: „dennoch“ im Hauptsatz."],["auf diese Weise / so","H/AW; Aus/Erk","Art und Weise oder Erläuterung","„So“ ist stark mehrdeutig."],["aufgrund / wegen","Bg; Fg","Ursache/Grund","Grammatische Stellung prüfen."],["außerdem / überdies / zudem","R; Abf","Zusatz oder Abfolge","Frage: nur mehr oder wirklich stärker?"],["außer / ausgenommen","−/+; B/F","Ausschluss oder Bedingung","„außer wenn“ ist bedingt."],["beispielsweise / zum Beispiel","All/Sp","Spezifizierung","Nur bei aktivierter erweiterter Liste."],["bevor / vor","Zt; O","Zeit oder Ort","„vor dem Fest“ vs. „vor dem Thron“."],["dadurch, dass / indem","H/AW; Aus/Erk","Mittel/Weise oder Erklärung","Frage: Wie geschieht die Handlung?"],["daher / deshalb / darum","Fg","Schlussfolgerung","Grund steht gewöhnlich davor."],["dass","Aus/Erk; H/Z; H/Erg","Inhalt, Zweck oder Ergebnis","Grammatik und Absicht entscheiden."],["das heißt / mit anderen Worten","Aus/Erk; Tat/Deu","Erklärung oder Deutung","Erweiterte Deutung ist enger."],["damit","H/Z; H/Erg","Zweck oder – seltener – Folge","Absicht gegen tatsächliches Ergebnis testen."],["damit nicht","H/Z","vermeidender Zweck","Entspricht „auf dass nicht“."],["dann","Abf; Fg; B/F","Schritt, Folgerung oder bedingte Folge","Vorangehendes „wenn“ beachten."],["dementsprechend / demnach","Fg","Folgerung","Test: „Aus diesem Grund …“."],["denn","Bg","nachfolgender Grund","Kann stilistisch eine Erläuterung begleiten."],["dennoch / trotzdem / gleichwohl","Einr","Hauptaussage trotz Gegengrund","Signal für gegensätzliche Stütze."],["durch / mittels","H/AW; O","Mittel oder Bereich","Nicht jede Präpositionalgruppe abteilen."],["ebenso / gleichermaßen","R; V","Zusatz oder Vergleich","Vergleich braucht ein Bezugsstück."],["entweder … oder","A","Alternativen","Beide Seiten als Geschwister modellieren."],["es sei denn / außer wenn","B/F","negative Bedingung","Semantisch „wenn nicht“."],["falls / sofern","B/F","Bedingung","Eine Folge kann unausgesprochen sein."],["folglich / infolgedessen","Fg","Schlussfolgerung","Nicht mit bloßer zeitlicher Folge verwechseln."],["genauso wie / so wie","V","Vergleich","Vergleichsrichtung kann umgedreht werden."],["jedoch","−/+; Einr","Korrektur oder Einräumung","Prüfen, ob eine Seite verneint wird."],["mehr noch / darüber hinaus","Abf","Abfolge","Der spätere Teil muss einen Höhepunkt bilden."],["nämlich","Bg; Aus/Erk","Grund oder Erklärung","Test: „weil“ gegenüber „das heißt“."],["nachdem","Zt","vorzeitige Zeitangabe","Der andere Teil ist die Hauptaussage."],["nicht … sondern","−/+","Verneinung–Bejahung","Bejahte Seite standardmäßig primär."],["nicht nur … sondern auch","−/+; S/A","Korrektur plus gemeinsame Betonung","Erweiterte Liste ermöglicht größere Präzision."],["noch / weder … noch","R; A; S/A","Reihe, Optionen oder gemeinsame Verneinung","S/A nur bei ausdrücklicher Betonung."],["obgleich / obwohl / wenngleich","Einr","eingeräumter Gegengrund","Hauptsatz bleibt trotzdem wahr."],["oder","A; R","Möglichkeit oder lockere Reihung","Meist Alternative; Kontext prüfen."],["schließlich","Abf","letzter Schritt/Höhepunkt","Kann auch bloß zeitliche Schlussmarke sein."],["seit","Zt; Bg","Zeitbeginn oder – selten – Grund","„seitdem“ ist normalerweise zeitlich."],["sodass / so dass","H/Erg; H/Z","Ergebnis oder Zweck","Moderne Schreibweise „sodass“."],["sogar","Aus/Erk; Abf","Verdeutlichung oder Zuspitzung","Funktion statt Wortform bewerten."],["statt / stattdessen / vielmehr","−/+","abgelehnte und bejahte Alternative","Bevorzugte Seite primär."],["sowohl … als auch","S/A","gemeinsame Betonung","Erweiterte Beziehung."],["um … zu","H/Z","beabsichtigtes Ziel","Infinitivgruppe kann eine eigene Proposition bilden."],["und","R; Abf; Sit/Re; praktisch alle","unspezifischer Verbinder","Am stärksten mehrdeutig; nie allein entscheiden."],["und dann","Abf","weiterer Schritt","Kann in Erzählungen auch nur zeitlich sein."],["und so","Fg; Ank/Erf","Folgerung oder Erfüllung","Erweiterte Erfüllungsbeziehung braucht Ankündigung."],["und während","Zt","gleichzeitiger Zeitraum","„während/wohingegen“ kann auch Gegensatz sein."],["wenn / als","Zt; B/F","Zeit oder Bedingung","Frage: Zeitpunkt oder Voraussetzung?"],["wenn nicht","B/F","negative Bedingung","Entspricht oft „es sei denn“."],["wer / was / wie / warum / wo","F/A; O","Fragewort oder Ortsbezug","F/A verlangt eine Antwort."],["während / wohingegen","Zt; A; −/+","Zeit oder Kontrast","Bedeutung im Satz prüfen."],["weil / da","Bg","nachfolgender Grund","Häufigster Begründungstest."],["wie / ähnlich","V","Vergleich","„wie“ kann auch Art und Weise einleiten."],["wo / wo immer","O","Ort/Bereich","Bei echter Frage zusätzlich F/A prüfen."],["zuerst … dann … schließlich","Abf","gerichtete Abfolge","Musterbeispiel für Abfolge."]]);

// Deutsche Übertragung der im bereitgestellten Konjunktions-PDF aufgeführten
// englischen Konjunktionen/Konjunktionaladverbien. Die Beziehungszuordnungen
// folgen der PDF-Tabelle; bei deutschen Übersetzungen mit getrennten Bedeutungen
// (z. B. „da“/„seit“) werden die semantisch passenden Zuordnungen getrennt.
const CONJUNCTION_LOOKUP = Object.freeze([
  {label:"aber",relations:["alternative","verneinung_bejahung","einraeumung"]},
  {label:"als",relations:["vergleich","zeit"]},
  {label:"andererseits",relations:["alternative"]},
  {label:"auch",relations:["reihe"]},
  {label:"auf dieselbe Weise",relations:["vergleich"]},
  {label:"auf diese Weise",relations:["handlung_art_weise","aussage_erklaerung"]},
  {label:"aufgrund",relations:["begruendung"]},
  {label:"aufgrund dessen",relations:["begruendung","folgerung"]},
  {label:"außerdem",relations:["aussage_erklaerung","reihe"]},
  {label:"außer",relations:["verneinung_bejahung","bedingung_folge"]},
  {label:"bevor",relations:["zeit"]},
  {label:"da",relations:["begruendung"]},
  {label:"damit",relations:["handlung_zweck"]},
  {label:"damit nicht",relations:["handlung_zweck"]},
  {label:"dann",relations:["steigerung","folgerung"]},
  {label:"das heißt",relations:["aussage_erklaerung"]},
  {label:"dass",relations:["aussage_erklaerung","handlung_zweck","handlung_ergebnis"]},
  {label:"dementsprechend",relations:["folgerung"]},
  {label:"denn",relations:["aussage_erklaerung","begruendung","handlung_ergebnis"]},
  {label:"dennoch",relations:["einraeumung"]},
  {label:"deshalb",relations:["folgerung"]},
  {label:"doch",relations:["einraeumung"]},
  {label:"durch",relations:["handlung_art_weise","ort"]},
  {label:"ebenso",relations:["vergleich"]},
  {label:"ebenso wie",relations:["vergleich"]},
  {label:"es sei denn",relations:["bedingung_folge"]},
  {label:"falls",relations:["folgerung","bedingung_folge"]},
  {label:"folglich",relations:["folgerung"]},
  {label:"genauso wie",relations:["vergleich"]},
  {label:"immer wenn",relations:["zeit"]},
  {label:"insofern als",relations:["aussage_erklaerung"]},
  {label:"jedoch",relations:["verneinung_bejahung","einraeumung"]},
  {label:"mehr noch",relations:["steigerung"]},
  {label:"mittels",relations:["handlung_art_weise"]},
  {label:"nachdem",relations:["zeit"]},
  {label:"noch",relations:["reihe","alternative"]},
  {label:"obgleich",relations:["einraeumung"]},
  {label:"obwohl",relations:["einraeumung"]},
  {label:"oder",relations:["reihe","alternative"]},
  {label:"schließlich",relations:["steigerung"]},
  {label:"seit",relations:["zeit"]},
  {label:"so",relations:["reihe","folgerung"]},
  {label:"so auch",relations:["vergleich"]},
  {label:"sodass",relations:["handlung_ergebnis","handlung_zweck"]},
  {label:"sogar",relations:["aussage_erklaerung"]},
  {label:"stattdessen",relations:["verneinung_bejahung"]},
  {label:"um … zu",relations:["handlung_zweck"]},
  {label:"und",relations:["reihe","steigerung","situation_reaktion"],note:"Im PDF ist „and“ besonders mehrdeutig: Die Tabelle nennt Reihe, Abfolge und Situation–Reaktion; die Fußnote weist darauf hin, dass „und“ grundsätzlich auch andere Beziehungen ausdrücken kann."},
  {label:"und dann",relations:["steigerung"]},
  {label:"und während",relations:["zeit"]},
  {label:"vielmehr",relations:["verneinung_bejahung"]},
  {label:"vor",relations:["zeit","ort"]},
  {label:"während",relations:["alternative","zeit"]},
  {label:"weil",relations:["begruendung"]},
  {label:"wenn",relations:["folgerung","bedingung_folge","zeit"]},
  {label:"wie",relations:["vergleich"]},
  {label:"wo",relations:["frage_antwort","ort"]},
  {label:"wo immer",relations:["ort"]},
  {label:"wohingegen",relations:["verneinung_bejahung"]},
  {label:"weder",relations:["reihe"]},
  {label:"zudem",relations:["reihe"]}
].sort((a,b)=>a.label.localeCompare(b.label,"de",{sensitivity:"base"})));
let selectedConjunctionLookup="";
let selectedPrimaryRoleChoice=null;

const CATEGORY_LABELS = Object.freeze({
  koordination:"Beiordnend",
  eigenstaendige_stuetze:"Unterordnend (eigenständige Stütze)",
  erlaeuternde_stuetze:"Unterordnend (erläuternde Stütze)",
  gegensaetzliche_stuetze:"Unterordnend (gegensätzliche Stütze)",
  erweitert:"Erweiterte Beziehungen"
});
const CATEGORY_HEADING_PARTS = Object.freeze({
  koordination:["Beiordnend",null],
  eigenstaendige_stuetze:["Unterordnend","eigenständige Stütze"],
  erlaeuternde_stuetze:["Unterordnend","erläuternde Stütze"],
  gegensaetzliche_stuetze:["Unterordnend","gegensätzliche Stütze"],
  erweitert:["Erweiterte Beziehungen",null]
});
// Biblearc-Farblogik: Coordinate = grün, Restatement = blau,
// Distinct Statement = rot, Contrary Statement = orange.
const CATEGORY_COLORS = Object.freeze({
  koordination:"#9ab889",
  eigenstaendige_stuetze:"#cc5045",
  erlaeuternde_stuetze:"#638ea4",
  gegensaetzliche_stuetze:"#df903f",
  erweitert:"#667085"
});
// Kräftigere Töne derselben Biblearc-Gruppenfarben für UI-Hierarchie
// (z. B. Gruppenüberschriften und Beziehungskürzel im Auswahlfenster).
const CATEGORY_STRONG_COLORS = Object.freeze({
  koordination:"#527348",
  eigenstaendige_stuetze:"#963a33",
  erlaeuternde_stuetze:"#426879",
  gegensaetzliche_stuetze:"#9b5c24",
  erweitert:"#475467"
});
// Biblearc führt die optionalen Beziehungen nicht als eigene Farbkategorie:
// Both-And gehört zu Coordinate; die übrigen drei zu Subordinate—Restatement.
const EXTENDED_BIBLEARC_COLOR_CATEGORY = Object.freeze({
  sowohl_als_auch:"koordination",
  allgemein_spezifisch:"erlaeuternde_stuetze",
  tatsache_deutung:"erlaeuternde_stuetze",
  ankuendigung_erfuellung:"erlaeuternde_stuetze"
});
function relationshipColor(rel,relationshipId=null){
  const category=(relationshipId&&EXTENDED_BIBLEARC_COLOR_CATEGORY[relationshipId]) || rel?.category;
  return CATEGORY_COLORS[category]||"#475467";
}
function relationshipStrongColor(rel,relationshipId=null){
  const category=(relationshipId&&EXTENDED_BIBLEARC_COLOR_CATEGORY[relationshipId]) || rel?.category;
  return CATEGORY_STRONG_COLORS[category]||"#344054";
}
const STORAGE_KEY = "sensusLab.v1"; // alte Einzelanalyse, nur noch für Migration
const LEGACY_STORAGE_KEY = "bracketingArcingMvp.v1"; // ältere Einzelanalyse, nur noch für Migration
const PROJECTS_STORAGE_KEY = "sensusLab.projects.v1";
const ACTIVE_PROJECT_STORAGE_KEY = "sensusLab.activeProject.v1";
const PROJECTS_SCHEMA_VERSION = 1;
const MAX_HISTORY = 100;
const UI_SETTINGS_STORAGE_KEY = "sensusLab.uiSettings.v1";

const $ = (sel,root=document)=>root.querySelector(sel);
const $$ = (sel,root=document)=>Array.from(root.querySelectorAll(sel));
const els = {
  textButton:$("#textButton"), editModeButton:$("#editModeButton"), viewModeButton:$("#viewModeButton"),
  splitToolButton:$("#splitToolButton"), connectToolButton:$("#connectToolButton"), autoSplitButton:$("#autoSplitButton"), toolGroup:$("#toolGroup"),
  undoButton:$("#undoButton"), redoButton:$("#redoButton"), helpButton:$("#helpButton"), resetButton:$("#resetButton"),
  extendedToggle:$("#extendedToggle"), finishPill:$("#finishPill"), propStatus:$("#propStatus"), openStatus:$("#openStatus"),
  rootStatus:$("#rootStatus"), errorStatus:$("#errorStatus"), saveStatus:$("#saveStatus"), selectionStatus:$("#selectionStatus"), validationStrip:$("#validationStrip"),
  statusDetailsButton:$("#statusDetailsButton"), exportButton:$("#exportButton"), jsonExportButton:$("#jsonExportButton"), importButton:$("#importButton"), importInput:$("#importInput"),
  projectMenuWrap:$("#projectMenuWrap"), projectMenuButton:$("#projectMenuButton"), projectMenu:$("#projectMenu"),
  projectManagerButton:$("#projectManagerButton"), settingsMenuButton:$("#settingsMenuButton"), projectsDialog:$("#projectsDialog"),
  settingsDialog:$("#settingsDialog"), lineAttachmentToggle:$("#lineAttachmentToggle"), primaryLineWeightToggle:$("#primaryLineWeightToggle"),
  projectMenuCurrent:$("#projectMenuCurrent"), newProjectButton:$("#newProjectButton"), projectList:$("#projectList"),
  unitBar:$("#unitBar"), unitButtons:$("#unitButtons"),
  unitHint:$("#unitHint"), propList:$("#propList"), documentHeading:$("#documentHeading"), centerModeLabel:$("#centerModeLabel"), bracketSvg:$("#bracketSvg"),
  canvasGrid:$(".canvas-grid"), workspaceDivider:$("#workspaceDivider"),
  bracketEmpty:$("#bracketEmpty"), treeSummary:$("#treeSummary"),
  liveRegion:$("#liveRegion"), textDialog:$("#textDialog"), textForm:$("#textForm"), textDialogTitle:$("#textDialogTitle"),
  textTitleInput:$("#textTitleInput"), mainPointSummaryInput:$("#mainPointSummaryInput"), rawTextInput:$("#rawTextInput"), applyTextButton:$("#applyTextButton"), relationshipDialog:$("#relationshipDialog"),
  relationshipDialogTitle:$("#relationshipDialogTitle"), relationshipSearch:$("#relationshipSearch"), conjunctionLookupSelect:$("#conjunctionLookupSelect"), conjunctionFilterInfo:$("#conjunctionFilterInfo"),
  dialogExtendedToggle:$("#dialogExtendedToggle"), relationshipList:$("#relationshipList"),
  relationshipDetails:$("#relationshipDetails"), directionFlipButton:$("#directionFlipButton"),
  dissolveGroupButton:$("#dissolveGroupButton"),
  deleteSubtreeButton:$("#deleteSubtreeButton"), leaveOpenButton:$("#leaveOpenButton"),
  applyRelationshipButton:$("#applyRelationshipButton"), helpDialog:$("#helpDialog"), signalTableBody:$("#signalTableBody"),
  statusDialog:$("#statusDialog"), statusDialogBody:$("#statusDialogBody")
};

function makeId(prefix){
  if (globalThis.crypto && typeof crypto.randomUUID === "function") return prefix+"_"+crypto.randomUUID();
  return prefix+"_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2);
}
function defaultSettings(){ return {includeExtended:false,mode:"bearbeiten"}; }
function createEmptyState(){
  return {schemaVersion:1,title:"",mainPointSummary:"",rawText:"",tokens:[],cuts:[],propositions:[],rootIds:[],nodesById:{},settings:defaultSettings(),updatedAt:new Date().toISOString()};
}
let state = createEmptyState();
let history = [];
let future = [];
let activeTool = "teilen";
let selectionStartId = null;
let selectedRelationId = null;
let activeRelationId = null;
let chosenRelationshipId = null;
let lastValidation = null;
let saveTimer = null;
let saveStateText = "Nicht gespeichert";
let resizeObserver = null;
let projects = [];
let activeProjectId = null;
// App-weite Darstellungspräferenzen liegen bewusst außerhalb des Analysezustands.
// Dadurch verändern sie weder Analyse-JSON noch die Undo-Historie.
let uiSettings = {lineAttachment:"primary",emphasizePrimaryLines:true};
function loadUiSettings(){
  try{
    const raw=localStorage.getItem(UI_SETTINGS_STORAGE_KEY);
    const parsed=raw?JSON.parse(raw):null;
    uiSettings.lineAttachment=parsed?.lineAttachment==="center"?"center":"primary";
    uiSettings.emphasizePrimaryLines=parsed?.emphasizePrimaryLines!==false;
  }catch(_){ uiSettings.lineAttachment="primary"; uiSettings.emphasizePrimaryLines=true; }
}
function storeUiSettings(){
  try{ localStorage.setItem(UI_SETTINGS_STORAGE_KEY,JSON.stringify({
    lineAttachment:uiSettings.lineAttachment,
    emphasizePrimaryLines:uiSettings.emphasizePrimaryLines!==false
  })); }catch(_){ }
}

function cloneDocument(doc){ return JSON.parse(JSON.stringify(doc)); }
function normalizeProjectTool(tool){ return tool==="verbinden"?"verbinden":"teilen"; }
function normalizeProjectWorkspaceSplit(value){
  const n=Number(value);
  return Number.isFinite(n)?Math.min(.95,Math.max(.05,n)):.42;
}
function createProject(documentState=createEmptyState()){
  const now=new Date().toISOString();
  return {id:makeId("project"),createdAt:now,updatedAt:now,activeTool:"teilen",workspaceSplit:.42,document:cloneDocument(documentState)};
}
function activeProject(){ return projects.find(p=>p.id===activeProjectId)||null; }
function projectDisplayName(project){
  // Projekttitel und Texttitel sind absichtlich ein und dasselbe Feld.
  const title=String(project?.document?.title||"").trim();
  return title || "Unbenanntes Projekt";
}
function projectMeta(project){
  const doc=project?.document||{};
  if(!doc.rawText) return "Noch kein Text";
  const count=Array.isArray(doc.propositions)?doc.propositions.length:0;
  return `${count} ${count===1?"Proposition":"Propositionen"}`;
}
function serializeProjects(){ return JSON.stringify({schemaVersion:PROJECTS_SCHEMA_VERSION,projects}); }
function storeProjectsNow(){
  localStorage.setItem(PROJECTS_STORAGE_KEY,serializeProjects());
  if(activeProjectId) localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY,activeProjectId);
}
function syncStateIntoActiveProject(){
  let project=activeProject();
  if(!project){
    project=createProject(state);
    projects.push(project);
    activeProjectId=project.id;
  }
  project.document=cloneDocument(state);
  project.activeTool=normalizeProjectTool(activeTool);
  project.updatedAt=new Date().toISOString();
  return project;
}
function resetTransientUiForProject(project=activeProject()){
  history=[]; future=[]; selectionStartId=null; selectedRelationId=null; activeRelationId=null; chosenRelationshipId=null;
  activeTool=normalizeProjectTool(project?.activeTool);
  if(els.relationshipDialog?.open) closeRelationshipDialog();
  if(els.textDialog?.open) closeDialog(els.textDialog);
}
function activateProject(projectId,{persistCurrent=true,announceChange=true,keepManagerOpen=false}={}){
  const target=projects.find(p=>p.id===projectId);
  if(!target){ closeProjectMenu(); return false; }
  if(target.id===activeProjectId){
    closeProjectMenu();
    if(!keepManagerOpen && els.projectsDialog?.open) closeDialog(els.projectsDialog);
    return true;
  }
  clearTimeout(saveTimer);
  if(persistCurrent && activeProjectId){
    try{ syncStateIntoActiveProject(); storeProjectsNow(); }catch(err){ console.warn("Aktuelles Projekt konnte vor dem Wechsel nicht gespeichert werden:",err); }
  }
  hydrateState(cloneDocument(target.document));
  activeProjectId=target.id;
  resetTransientUiForProject();
  saveStateText="Lokal gespeichert";
  try{ localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY,activeProjectId); }catch(_){ }
  closeProjectMenu();
  render();
  if(els.projectsDialog?.open) renderProjectManager();
  if(!keepManagerOpen && els.projectsDialog?.open) closeDialog(els.projectsDialog);
  if(announceChange) announce(`Projekt geöffnet: ${projectDisplayName(target)}`);
  return true;
}
function createNewProject(){
  clearTimeout(saveTimer);
  try{
    if(activeProjectId) syncStateIntoActiveProject();
    const project=createProject(createEmptyState());
    projects.push(project);
    activeProjectId=project.id;
    hydrateState(cloneDocument(project.document));
    resetTransientUiForProject();
    saveStateText="Lokal gespeichert";
    storeProjectsNow();
    closeProjectMenu();
    if(els.projectsDialog?.open) closeDialog(els.projectsDialog);
    render();
    announce("Neues, leeres Projekt erstellt");
    requestAnimationFrame(()=>els.textButton.focus());
  }catch(err){ alert(`Neues Projekt konnte nicht erstellt werden: ${err.message||err}`); }
}
function renameProject(projectId){
  const project=projects.find(p=>p.id===projectId);
  if(!project) return;
  const current=String(project.document?.title||"");
  const input=prompt("Projekttitel ändern. Dieser Titel ist zugleich der Texttitel:",current);
  if(input===null) return;
  const title=String(input).trim();
  if(project.id===activeProjectId){
    if(title===(state.title||"")) return;
    performAction("Titel geändert",()=>{ state.title=title; });
    syncStateIntoActiveProject();
  }else{
    project.document={...project.document,title};
    project.updatedAt=new Date().toISOString();
    try{ storeProjectsNow(); }catch(_){ }
  }
  renderProjectManager();
  announce(title?`Projekt umbenannt: ${title}`:"Projekttitel entfernt");
}
function deleteProject(projectId){
  const project=projects.find(p=>p.id===projectId);
  if(!project) return;
  const name=projectDisplayName(project);
  if(!confirm(`Projekt „${name}“ wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
  clearTimeout(saveTimer);
  const wasActive=project.id===activeProjectId;
  projects=projects.filter(p=>p.id!==projectId);
  if(!projects.length) projects.push(createProject(createEmptyState()));
  if(wasActive){
    activeProjectId=projects[0].id;
    hydrateState(cloneDocument(projects[0].document));
    resetTransientUiForProject();
    saveStateText="Lokal gespeichert";
  }
  try{ storeProjectsNow(); }catch(_){ saveStateText="Nur für diese Sitzung gespeichert"; }
  render();
  if(els.projectsDialog?.open) renderProjectManager();
  announce(`Projekt gelöscht: ${name}`);
}
function renderProjectManager(){
  if(!els.projectList) return;
  const current=activeProject();
  els.projectMenuCurrent.textContent=current?`Aktuell: ${projectDisplayName(current)}`:"";
  els.projectList.innerHTML=projects.map(project=>{
    const active=project.id===activeProjectId;
    const id=escapeHtml(project.id);
    return `<div class="project-item${active?" active":""}" data-project-row="${id}">`
      +`<button class="project-item-open" type="button" data-project-open="${id}"${active?' aria-current="true"':''}>`
      +`<span class="project-item-main"><span class="project-item-title">${escapeHtml(projectDisplayName(project))}</span><span class="project-item-meta">${escapeHtml(projectMeta(project))}</span></span></button>`
      +`<span class="project-item-actions">${active?'<span class="project-item-state">Aktiv</span>':''}`
      +`<button class="project-item-action" type="button" data-project-rename="${id}">Umbenennen</button>`
      +`<button class="project-item-action delete" type="button" data-project-delete="${id}">Löschen</button></span></div>`;
  }).join("");
}
function openProjectManager(){
  try{ syncStateIntoActiveProject(); storeProjectsNow(); }catch(_){ }
  closeProjectMenu();
  renderProjectManager();
  showDialog(els.projectsDialog);
}
function positionProjectMenu(){
  if(!els.projectMenu) return;
  // Das Dropdown ist direkt am Burger-Button verankert; keine viewport-/scrollabhängigen Inline-Koordinaten.
  els.projectMenu.style.left="";
  els.projectMenu.style.right="";
  els.projectMenu.style.top="";
  els.projectMenu.style.maxHeight="";
}
function openProjectMenu(){
  els.projectMenu.hidden=false;
  els.projectMenuButton.setAttribute("aria-expanded","true");
  positionProjectMenu();
}
function closeProjectMenu(){
  if(!els.projectMenu) return;
  els.projectMenu.hidden=true;
  els.projectMenuButton.setAttribute("aria-expanded","false");
}
function toggleProjectMenu(){ if(els.projectMenu.hidden) openProjectMenu(); else closeProjectMenu(); }

function loadProjects(){
  try{
    const raw=localStorage.getItem(PROJECTS_STORAGE_KEY);
    if(raw){
      const parsed=JSON.parse(raw);
      if(!parsed || parsed.schemaVersion!==PROJECTS_SCHEMA_VERSION || !Array.isArray(parsed.projects)) throw new Error("Projektdatei hat ein unbekanntes Format.");
      projects=parsed.projects.filter(p=>p && typeof p.id==="string" && p.document && typeof p.document==="object").map(p=>({
        id:p.id,
        createdAt:typeof p.createdAt==="string"?p.createdAt:new Date().toISOString(),
        updatedAt:typeof p.updatedAt==="string"?p.updatedAt:new Date().toISOString(),
        activeTool:normalizeProjectTool(p.activeTool),
        workspaceSplit:normalizeProjectWorkspaceSplit(p.workspaceSplit),
        document:p.document
      }));
    }
    if(!projects.length){
      let legacyRaw=localStorage.getItem(STORAGE_KEY);
      if(!legacyRaw) legacyRaw=localStorage.getItem(LEGACY_STORAGE_KEY);
      if(legacyRaw){
        const legacyDoc=JSON.parse(legacyRaw);
        const empty=createEmptyState();
        hydrateState(legacyDoc);
        const migratedDoc=cloneDocument(state);
        state=empty;
        projects=[createProject(migratedDoc)];
      }
    }
    if(!projects.length) projects=[createProject(createEmptyState())];
    const preferred=localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
    activeProjectId=projects.some(p=>p.id===preferred)?preferred:projects[0].id;
    hydrateState(cloneDocument(activeProject().document));
    resetTransientUiForProject();
    storeProjectsNow();
    try{ localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LEGACY_STORAGE_KEY); }catch(_){ }
    saveStateText="Lokal gespeichert";
    return true;
  }catch(err){
    console.warn("Projekte konnten nicht geladen werden:",err);
    projects=[createProject(createEmptyState())];
    activeProjectId=projects[0].id;
    hydrateState(cloneDocument(projects[0].document));
    saveStateText="Nur für diese Sitzung gespeichert";
    return false;
  }
}
