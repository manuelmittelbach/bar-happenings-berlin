

## GPS-Standort als blauer Punkt auf der Karte

### Was passiert
Die Karte zeigt den aktuellen Standort des Nutzers als pulsierenden blauen Punkt an — genau wie bei Google Maps. Beim Öffnen der Kartenansicht wird der Browser nach der Standortberechtigung fragen.

### Technische Umsetzung

**Datei: `src/components/events/MapView.tsx`**

1. Im ersten `useEffect` (Karten-Initialisierung), nach dem Erstellen der Map, die Browser Geolocation API nutzen:
   - `navigator.geolocation.watchPosition()` aufrufen, um den Standort in Echtzeit zu verfolgen
   - Einen blauen `L.circleMarker` erstellen (Radius ~8px, blau gefüllt, weiße Border, leichter Schatten)
   - Einen zweiten, größeren halbtransparenten `L.circle` als Genauigkeitsradius darum legen
   - CSS-Animation `@keyframes pulse` für den blauen Punkt hinzufügen
   - Position bei jedem Update aktualisieren (`setLatLng`)
   - `watchPosition` im Cleanup der useEffect-Funktion mit `clearWatch` aufräumen

2. Styling des blauen Punkts:
   - `L.divIcon` mit einem blauen Kreis (12px), weißer Border (3px), `box-shadow` für Glow
   - Pulsierender Ring-Effekt via CSS-Animation
   - Kein Popup nötig, nur visueller Marker

3. Fehlerbehandlung: Falls der Nutzer die Berechtigung verweigert oder GPS nicht verfügbar ist, passiert einfach nichts (kein Punkt wird angezeigt, kein Fehler).

