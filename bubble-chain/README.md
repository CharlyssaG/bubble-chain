# Chain Reaction

A one-click bubble chain-reaction game. 100 levels, 10 bubble types. Built with React + Vite.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## Build for production

```bash
npm run build
```

The built site lives in `dist/`.

## Deploy to Vercel

### Option A — via GitHub (recommended)

1. Push this folder to a GitHub repo.
2. Go to [vercel.com](https://vercel.com) and sign in.
3. Click **Add New… → Project**.
4. Import your repo.
5. Vercel auto-detects Vite — just click **Deploy**.

That's it. You'll get a `*.vercel.app` URL in under a minute.

### Option B — via Vercel CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts. Vercel will detect the Vite framework automatically.

## How to play

- Click any bubble. It expands to a huge size.
- While expanded, it ignites any bubble it touches — those expand too.
- Chain reaction! You get ONE click per level.
- Clear enough bubbles to advance through 100 levels.

## Bubble types

| Type | Introduced | Mechanic |
|---|---|---|
| Normal | Lv 1 | Standard chain |
| Ghost | Lv 5 | Scores on hit but doesn't chain onward |
| Heavy | Lv 9 | Needs two separate hits to ignite |
| Splitter | Lv 14 | Spawns small chain bubbles when popped |
| Fast | Lv 20 | Moves much quicker |
| Anchor | Lv 27 | Stationary |
| Magnet | Lv 35 | Pulls nearby bubbles toward it |
| Shield | Lv 44 | Absorbs first hit |
| Teleporter | Lv 55 | Warps to random spot when chain-hit |
| Bomb | Lv 68 | Huge radius but collapses twice as fast |
