# Statik-Prüfung – Bebenbau

Erstellt: 9.10.2026, 17:51:04 (Berlin) · Löser: `src/statics.js` (Weggrößenverfahren, Stab- und Balkenelemente) · Toleranz 0,1 %

| Fall | Größe | Soll | Berechnet | Ergebnis |
|---|---|---|---|---|
| 1 Einfeldträger, F mittig | Auflager A = F/2 | 5.000 kN | 5.000 kN | ✅ bestanden |
| 1 Einfeldträger, F mittig | Auflager B = F/2 | 5.000 kN | 5.000 kN | ✅ bestanden |
| 1 Einfeldträger, F mittig | Feldmoment = F·L/4 | 10.000 kNm | 10.000 kNm | ✅ bestanden |
| 1 Einfeldträger, F mittig | Durchbiegung = F·L³/(48·EI) | 1.587 mm | 1.587 mm | ✅ bestanden |
| 2 Einfeldträger, F bei a = 2 m | Auflager A = F·b/L | 20.000 kN | 20.000 kN | ✅ bestanden |
| 2 Einfeldträger, F bei a = 2 m | Auflager B = F·a/L | 10.000 kN | 10.000 kN | ✅ bestanden |
| 2 Einfeldträger, F bei a = 2 m | Moment unter Last = F·a·b/L | 40.000 kNm | 40.000 kNm | ✅ bestanden |
| 3 Dreiecksfachwerk | Auflager A = F/2 | 50.000 kN | 50.000 kN | ✅ bestanden |
| 3 Dreiecksfachwerk | Auflager B = F/2 | 50.000 kN | 50.000 kN | ✅ bestanden |
| 3 Dreiecksfachwerk | Diagonale links = −F/√3 (Druck) | -57.735 kN | -57.735 kN | ✅ bestanden |
| 3 Dreiecksfachwerk | Diagonale rechts = −F/√3 (Druck) | -57.735 kN | -57.735 kN | ✅ bestanden |
| 3 Dreiecksfachwerk | Untergurt = +F/(2√3) (Zug) | 28.868 kN | 28.868 kN | ✅ bestanden |
| 4 Kragarm, Einspannung | Auflagerkraft vertikal = F | 10.000 kN | 10.000 kN | ✅ bestanden |
| 4 Kragarm, Einspannung | Einspannmoment = F·L | 30.000 kNm | 30.000 kNm | ✅ bestanden |
| 4 Kragarm, Einspannung | Auflagerkraft horizontal | 0.000 kN | 0.000 kN | ✅ bestanden |
| 4 Kragarm, Einspannung | Endverschiebung = F·L³/(3·EI) | 10.714 mm | 10.714 mm | ✅ bestanden |
| 5 Rechteck ohne Diagonale | Ergebnis | System ist beweglich | System ist beweglich | ✅ bestanden |
| 5 Balken auf zwei Rollenlagern | Ergebnis | System ist beweglich | System ist beweglich | ✅ bestanden |
| 5 Spiel-Hinweis | Meldung enthält „Diagonale“ | ja | ja | ✅ bestanden |
| 5 Gegenprobe: Rechteck mit Diagonale | Ergebnis | stabil | stabil | ✅ bestanden |
| 5 Gegenprobe: Rechteck mit Diagonale | Diagonale = +1 kN·√2 (Zug) | 1.414 kN | 1.414 kN | ✅ bestanden |

**21 von 21 Prüfungen bestanden.**

Vorzeichen: Stabkräfte Zug +, Druck −. Auflagerkräfte nach oben +, Einspannmoment gegen den Uhrzeigersinn +, Feldmoment als Biegemoment (Unterseite gezogen +).
Balken: EA = 2,1·10⁹ N, EI = 8,4·10⁶ N·m² (Durchbiegungen nur als Zusatzprobe).
