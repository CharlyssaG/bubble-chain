# Chain Reaction

A one-click bubble chain-reaction game. 1000 levels across 10 themed realms, 10 bubble types, 100 bosses. Built with React + Vite.

## The journey

You are a pilot trying to reach home. You must traverse ten realms:

1. **Deep Space** (Lv 1–100)
2. **Candy Cosmos** (Lv 101–200)
3. **Theme Park** (Lv 201–300)
4. **Horror Land** (Lv 301–400)
5. **Ocean Deep** (Lv 401–500)
6. **Volcanic Core** (Lv 501–600)
7. **Crystal Caverns** (Lv 601–700)
8. **Clockwork City** (Lv 701–800)
9. **Dream Realm** (Lv 801–900)
10. **Final Destination** (Lv 901–1000)

## Rules

- Click one bubble per level. It expands and ignites any bubble it touches.
- Clear enough bubbles to advance.
- **Boss every 10 levels** — themed to the realm.
- Fail a level? You return to the start of the current 10-level round.
- Progress saves automatically.
- Each bubble type has a distinct ASMR-adjacent pop sound, stereo-panned by position. Toggle with the ♪ button.

## Bubble types

| Type | Intro | Mechanic |
|---|---|---|
| Normal | Lv 1 | Standard chain bubble |
| Ghost | Lv 5 | Scores on hit but doesn't chain onward |
| Heavy | Lv 9 | Needs two taps. Moves slowly. |
| Splitter | Lv 14 | Explodes twice — waves of small bubbles |
| Fast | Lv 20 | Blazes across the screen |
| Anchor | Lv 27 | Stationary |
| Magnet | Lv 35 | Pulls all types. Repels other magnets. |
| Shield | Lv 44 | Absorbs first hit |
| Teleporter | Lv 55 | Blinks to random spots, changes direction |
| Bomb | Lv 68 | Huge radius, collapses twice as fast |

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Deploy to Vercel

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → Add New → Project
3. Import your repo, click Deploy
4. Vercel auto-detects Vite
