# Kniffel online („Herbstwürfel“)

Kniffel für 2–6 Spieler im Browser, in Echtzeit, für Freunde und Familie.
Alle öffnen denselben Link, wählen einen Platz und spielen gemeinsam am selben Tisch.

Website und Spielserver laufen zusammen kostenlos auf Cloudflare (Workers Free Plan, ohne Kreditkarte).
Der Server schläft nicht ein, und der Spielverlauf bleibt dauerhaft gespeichert.

## So wird gespielt

1. Link öffnen. Wer als Erstes kommt, stellt die Spielerzahl (2–6) ein.
2. Namen eingeben und **Mitspielen** drücken – man bekommt den nächsten freien Platz.
   Mit **Mitspieler einladen** den Link per WhatsApp & Co. teilen.
3. Wenn alle **„Spiel starten“** gedrückt haben, geht es los („Doch nicht bereit“ nimmt das zurück).
   Pro Zug bis zu drei Würfe; Würfel antippen hält sie fest, dann ein Feld im Block wählen.
   Wer dran ist, hört einen kurzen Ton, das Handy vibriert und der Tab-Titel zeigt „Du bist dran!“.
4. Wer neu lädt oder kurz die Verbindung verliert, landet automatisch wieder auf seinem Platz.
   Auf einem anderen Gerät reicht derselbe Name. Ist jemand länger als 2 Minuten weg, kann sein
   Platz in der Lobby freigegeben oder (im Spiel, samt Punkten) übernommen werden.
5. Ist der Tisch voll, kann man zuschauen und über das Menü einsteigen, sobald ein Platz frei wird.

Wertung: Oberer Block mit 35 Bonuspunkten ab 63 Punkten; Full House 25, kleine Straße 30,
große Straße 40, Kniffel 50. Ein zusätzlicher Kniffel-Bonus bzw. Joker-Regeln gibt es nicht.

Tastatur: Leertaste/Enter würfeln, 1–5 Würfel halten, H Verlauf, M Ton an/aus.

## Projektaufbau

| Ordner | Inhalt |
| --- | --- |
| `packages/game` | Spielregeln: Typen, Wertung, Spiel-Engine (prüft jeden Zug) und das Nachrichtenformat. Wird von Website und Server gemeinsam genutzt. |
| `apps/worker` | Spielserver: Cloudflare Worker + Durable Object (`KniffelRoom`). Sitzplätze, Verbindungen, Spielverlauf. |
| `apps/web` | Website (React + Vite). Design aus Figma, umgesetzt in `src/autumn`. |
| `design/figma-export` | Original-Export aus Figma als Design-Referenz. Wird nicht gebaut. |
| `scripts/smoke.mjs` | End-to-End-Test: spielt eine komplette Partie mit 3 Spielern gegen einen laufenden Server. |
| `wrangler.jsonc` | Cloudflare-Konfiguration für Server und Website. |

## Lokal entwickeln

Voraussetzungen: Node.js 20+ (für `pnpm smoke` Node 22+) und pnpm 9 (`corepack enable`).

```bash
pnpm install
pnpm dev
```

Danach <http://localhost:5173> in mehreren Tabs öffnen. Jeder Tab ist ein eigener Spieler. `pnpm dev` startet die Website (Vite) und den Spielserver
(`wrangler dev` auf Port 8787) zusammen. Lokale Spielstände liegen in `.wrangler/`.

Prüfen:

```bash
pnpm check   # Typprüfung, Unit-Tests, Build
pnpm smoke   # komplette Partie gegen den laufenden lokalen Server (pnpm dev oder pnpm preview)
```

`pnpm preview` baut die Website und startet alles so, wie es später auf Cloudflare läuft
(<http://localhost:8787>).

## Kostenlos online stellen (Cloudflare)

Einmalig:

1. Kostenloses Konto auf <https://dash.cloudflare.com/sign-up> anlegen (keine Kreditkarte nötig).
2. Im Dashboard **Workers & Pages → Create → Import a repository** wählen, GitHub verbinden und
   dieses Repository auswählen.
3. Einstellungen:
   - **Root directory:** `/` (leer lassen)
   - **Build command:** `pnpm build`
   - **Deploy command:** `npx wrangler deploy` (Standard)
4. **Deploy** klicken. Nach ein bis zwei Minuten ist das Spiel unter
   `https://kniffel-online.<dein-name>.workers.dev` erreichbar. Diesen Link an alle schicken.

Danach wird bei jedem Push auf `main` automatisch neu veröffentlicht. Spielstand und Verlauf bleiben dabei erhalten.

Alternativ ohne GitHub-Verbindung, direkt vom eigenen Rechner:

```bash
pnpm wrangler login
pnpm release
```

### Kosten und Grenzen

Alles läuft im kostenlosen Workers-Plan. Pro Tag sind dort 100.000 Anfragen enthalten. Eine
komplette Partie mit sechs Spielern braucht nur einige hundert, und die Website-Dateien selbst
zählen nicht mit. Die Grenze ist für Familienrunden praktisch unerreichbar. Sollte sie doch
einmal erreicht werden, kostet das nichts: Das Spiel ist dann bis Mitternacht (UTC) nicht
erreichbar.

## Bekannte Einschränkungen

- Es gibt genau einen Spieltisch. Zwei Gruppen können nicht gleichzeitig getrennte Partien spielen.
- Ist der Spieler am Zug nicht mehr da, wartet das Spiel, bis er zurückkommt oder jemand nach
  2 Minuten seinen Platz übernimmt.
- Tailwind ist nicht installiert. Die Oberfläche nutzt die fertig erzeugte CSS-Datei aus dem
  Figma-Export (`apps/web/src/autumn/styles/figma-utilities.css`). Klassen, die dort fehlen,
  wirken nicht.
