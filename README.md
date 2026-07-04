# 通鉴 · Tongjian — a comparative world-history atlas

A personal, growing repository of world history laid out as parallel **streams** (civilizations
or regions) that you can compare side by side, connect across, and enrich over time with the help
of a built-in LLM research agent. Named after the *Zizhi Tongjian* (資治通鑑), "a comprehensive
mirror in aid of governance."

Everything is bilingual (中文 / English): every stream, event and connection holds both languages,
and a display toggle switches between **EN**, **中**, and **双** (both) at any time.

![two views: a semantic-zoom scroll and a column list]

---

## What it does

- **Two views of the same data**
  - **长卷 Scroll** — an exploratory canvas where time flows downward and each stream is a lane.
    Zoom with **⌘/Ctrl + scroll**: zoom out and only the era-defining events remain as dots; zoom in
    and events unfold into cards with full bilingual titles. This "semantic zoom" is what keeps a
    large repository legible.
  - **列表 Columns** — a calm, scholarly column per civilization with century dividers, for reading
    and comparing straight down.
- **Cross-stream connections** — link an event in one stream to an event in another (e.g. Zhang
  Qian's Silk Road missions ⟡ Rome's craze for Chinese silk). Connections are drawn as vermilion
  "silk threads" in the scroll view and solidify when you hover or select them.
- **Tags & importance** — every event carries tags (politics, war, religion, culture, technology,
  science, economics, art, exploration) and an importance 1–5 that drives what shows at each zoom
  level. Filter by tag or stream from the top bar.
- **A research agent** (your choice of Anthropic, OpenAI, or Google model)
  - **Chat**: ask it to compare civilizations or explain an event; it can propose new events and
    connections.
  - **✦ Enrich**: point it at a stream and a period and it drafts a batch of candidate events.
  - Everything the agent proposes lands in a **Review** queue. Nothing is written to your
    repository until you approve it.

## Requirements

- **Node.js 18+** (Node 20 or 22 recommended)
- macOS, Linux, or Windows. `better-sqlite3` compiles a small native module on install, which needs
  the usual build tools (Xcode Command Line Tools on a Mac — you almost certainly already have them).

## Setup

```bash
# from the project root
npm install          # installs both the server and client workspaces
npm run seed         # creates a local SQLite DB seeded with China / Rome / India
npm run dev          # starts the API (:3001) and the web app (:5173)
```

Then open **http://localhost:5173**.

`npm run seed` is optional — you can start empty and build everything yourself — but it gives you
three streams, 23 events and a few cross-stream connections to explore the interface with. To reseed
from scratch, delete `server/data/tongjian.db` and run it again.

## Setting up the agent

The agent is off until you add an API key.

1. Click **⚙ Settings**.
2. Choose a provider (Anthropic / OpenAI / Google), set the model string if you want a specific one,
   and paste your API key.
3. Save.

Keys are stored **locally**, in your own SQLite database (`server/data/tongjian.db`), and are sent
only to the provider you chose. The API masks them (`••••abcd`) when the settings are read back, so
re-saving the form never wipes a stored key.

## Using it

- **Add an event** — **+ Event** in the top bar. Years are integers; **negative = BCE** (so −221 is
  221 BCE). Give an optional end year for spans like dynasties or wars.
- **Connect two events** — open an event → **Connect ⟡** → click a second event in either view. Add
  a description to the connection from its panel.
- **Enrich a stream** — **✦ Enrich** on any stream header, give an optional focus and period, and
  review what the agent drafts.
- **Manage streams** — **Streams** to add, rename, recolor or delete a stream (deleting a stream
  removes its events and their connections).

## Push it to GitHub

```bash
git init
git add .
git commit -m "Tongjian: comparative history atlas"
git branch -M main
git remote add origin git@github.com:<you>/tongjian.git
git push -u origin main
```

`node_modules/`, `server/data/` (your database, including API keys) and build output are already
git-ignored.

## Architecture

```
tongjian/
├── server/                 Node + Express + better-sqlite3 (SQLite, WAL)
│   └── src/
│       ├── db.js           schema + helpers
│       ├── routes/         streams · events · connections · proposals · settings · llm
│       ├── llm/
│       │   ├── providers.js  one uniform call over Anthropic / OpenAI / Gemini REST
│       │   └── agent.js      prompts, strict-JSON protocol, proposal storage
│       ├── seed.js         optional starter data
│       └── index.js        server entry; also serves the built client in production
└── client/                 Vite + React + TypeScript + Zustand
    └── src/
        ├── components/     TopBar · ColumnView · ExploreView · SidePanel · modals
        ├── store.ts        app state
        ├── api.ts          fetch wrapper + bilingual field helpers
        └── styles.css      the parchment-and-ink design system
```

**Scalability.** The scroll view fetches only the events inside (a buffer around) the current
viewport and above a minimum-importance threshold derived from the zoom level — so the repository can
grow large while the client only ever loads what's on screen. Events are indexed by `(stream_id,
year_start)`, `year_start` and `importance`.

**The agent's contract.** Rather than provider-specific tool-calling, the agent is asked to return a
single JSON object — a `reply` plus `proposed_events` and `proposed_connections`. The server
validates every proposal (real stream ids, real event ids) before storing it in the review queue, so
a malformed or hallucinated reference is dropped rather than written. You approve before anything
enters the repository.

## Production build

```bash
npm run build        # builds the client into client/dist
npm start            # serves API + built client on :3001
```

## Known limitations & next steps

- The **Columns** view loads the first 3,000 matching events per query (fine for a personal
  repository; the Scroll view is the one built for scale).
- Connection **proposals** are only drawn between events that already exist, so the agent connects to
  what's in the repository rather than inventing endpoints.
- At extreme event density the greedy sub-column packer can push lower-importance nodes slightly past
  their exact year to avoid overlap; the duration bars at each lane's left edge always mark the true
  position.
- Natural next steps: full-text search across the whole repository, import/export (JSON or CSV),
  a "sources" table with citations per event, and letting the agent draft whole new streams.

---

Built for a Mac; runs anywhere Node does.
