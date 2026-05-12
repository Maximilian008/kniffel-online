# Kniffel Online

Ein professionelles Online-Kniffel-Spiel für zwei Spieler mit **ML-gestützten Zugempfehlungen** und AAA-Game-Quality UX.

## Architektur

- **Frontend**: React + TypeScript + Vite (Port 5173)
- **Backend**: Node.js + Express + Socket.IO (Port 3000) 
- **ML-Engine**: TypeScript-native Empfehlungssystem
- **Database**: SQLite (für Spielstand-Persistierung)
- **Packages**: Monorepo mit 6 interdependenten Modulen
- **Deployment**: Produktionsreif für Remote-Zugriff

## Entwicklung

```bash
# Alle Dependencies installieren
pnpm install

# Entwicklungsserver starten (beide Services)
pnpm dev

# Oder einzeln:
pnpm dev:server  # Server auf Port 3000
pnpm dev:web     # Frontend auf Port 5173

# Produktions-Build
pnpm build

# Produktionsstart
pnpm start
```

## Umgebungsvariablen

Erstelle eine `.env` Datei basierend auf `.env.example`:

```bash
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

## Features

✅ **Core Game:**
- Vollständiges Kniffel-Spiel mit korrekten Regeln
- Echtzeit-Multiplayer über WebSockets  
- Spieler-Identität mit automatischem Wiedereintreten
- Persistente Spielstände (SQLite)
- Spiel-Historie mit detaillierter Auswertung

✅ **ML-System:**
- **Top-3 Zugempfehlungen** mit Confidence-Scores
- Heuristik-Engine: Monte-Carlo + Opportunity Cost + Bonus-Optimierung
- **19-Feature State-Encoding** für intelligente Analyse
- Sub-100ms Response-Time für Echtzeit-Empfehlungen

✅ **Professional UX:**
- **3D-Würfel-Animationen** mit realistischer Physik
- **Sound-System** mit satisfying Click-Feedback
- **Deutsche Lokalisierung** komplett
- **Responsive Design** für Desktop & Mobile
- **Keyboard-Shortcuts** für Power-User

## ML-API

### Ideen für Zuküfntige Ai impelentation

Intelligente Zugempfehlungen basierend auf aktuellem Spielstand:

```bash
curl -X POST http://localhost:3000/api/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "state": {
      "dice": [1,2,3,4,5],
      "rollsLeft": 2,
      "scoreSheets": [{}, {}],
      "usedCategories": [[], []],
      "currentPlayer": 1,
      "playerNames": ["Player1", "Player2"],
      "phase": "playing"
    },
    "playerIndex": 0
  }'
```

**Response:**
```json
{
  "recommendations": [
    {
      "category": "largeStraight",
      "score": 47.5,
      "confidence": 0.85,
      "reasoning": "Seltene Gelegenheit, Hoher garantierter Score"
    }
  ],
  "timestamp": 1696518000000,
  "playerIndex": 0
}
```
- CORS-Konfiguration für Production
- Health-Monitoring (`/healthz`)
- Graceful Shutdown

**In Entwicklung:**
- Deployment-Konfiguration für Remote-Zugriff
- SSL/HTTPS-Setup
- Erweiterte Sicherheitsfeatures
