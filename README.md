# Fahrzeugliste

Durchsuchbare Galerie aller Fahrzeuge aus `[vehicles]/[civ]` mit Bildern aus dem JG Vehicle Studio.

- Suche (Marke, Modell, Spawnname, Notiz), Filter nach Kategorie / Marke / Klasse, Sortierung
- Klick auf Spawnname = kopieren, Klick auf Bild = groß anzeigen
- Notiz-Button pro Fahrzeug (im Browser gespeichert, Export/Import als JSON)

## Aktualisieren
```
node build.js
```
Liest `vehicles.meta` + `fahrzeuge.txt` aus dem civ-Ordner und `jg-vehiclestudio/local_data/index.json` und schreibt `data.js` / `cars.json`.

## Korrekturen
Falsche Marken oder Namen in `korrekturen.json` eintragen (pro Spawnname `brand`, `title`, `desc`), dann `node build.js`.
