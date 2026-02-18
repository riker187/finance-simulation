# Finanz-Szenario-Simulator

A web-based **"what-if" financial planning tool** — not accounting software, not a spreadsheet. Model different life situations, place them on a timeline, and watch how alternative futures play out in your account balance over months and years.

> Built to think in *scenarios*, not in rows.

---

## Features

- **Financial Situations** — reusable building blocks (recurring income/expenses, one-time events)
- **Visual Timeline Editor** — paint months like a Gantt chart; drag rows to reorder
- **Scenario Management** — create, duplicate, edit, and delete independent futures
- **Live Balance Chart** — updates instantly as you paint the timeline
- **Overlay Mode** — compare multiple scenario lines directly in the editor chart
- **Full Comparison View** — all scenarios overlaid in one chart with a summary table
- **Persistent State** — everything saved to `localStorage`; no account needed
- **Docker-ready** — single `docker compose up --build` to run anywhere

---

## Preview

```
┌──────────────────────────────────────────────────────────────┐
│ Finanz-Simulator                              ⇄ Vergleich    │
├─────────────────┬────────────────────────────────────────────┤
│  SITUATIONEN    │  [Status Quo] [Jobwechsel] [Auszeit] [+]   │
│                 ├────────────────────────────────────────────┤
│  ● Vollzeitjob  │  Zeitplan                                  │
│  ● Miete        │  Situation       Feb  Mär  Apr  Mai  ...   │
│  ● Lebenshalt.  │  Vollzeitjob     ████ ████ ████ ████       │
│  ● Teilzeitjob  │  Miete           ████ ████ ████ ████       │
│  ● Autokauf     │  Lebenshaltung   ████ ████ ████ ████       │
│  ● Steuererst.  ├────────────────────────────────────────────┤
│                 │  Kontostandverlauf                         │
│  + Neue Sit.    │  ╭────────────────────────────────╮        │
│                 │  │          ╭───                   │        │
│                 │  │    ─────╯                       │        │
└─────────────────┴──╰────────────────────────────────╯────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript |
| Build | Vite |
| State | Zustand (localStorage persistence) |
| Charts | Recharts |
| Styling | Tailwind CSS v3 (dark theme) |
| Container | Docker + nginx (multi-stage) |
| Sync Service | Node.js (SSE + REST) |

No central account required. A lightweight sync service shares scenario data across active clients.

---

## Getting Started

### Configuration

Copy `.env.example` to `.env` and adjust the ports if the defaults conflict with other services:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `DEV_PORT` | `5173` | Vite dev server port (`npm run dev`) |
| `HOST_PORT` | `3000` | Docker host port (`docker compose up`) |

### Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) (or your custom `DEV_PORT`). The app loads with sample data so you can explore immediately.

### Docker

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000) (or your custom `HOST_PORT`).

### Production Build

```bash
npm run build   # outputs to dist/
```

---

## How It Works

### 1 — Define Situations

A **Situation** is a reusable financial building block:

- *Vollzeitjob* → recurring income of +3,200 €/month
- *Miete* → recurring expense of −900 €/month
- *Autokauf* → one-time expense of −12,000 €
- Any combination of recurring and one-time effects in a single situation

### 2 — Build Scenarios

A **Scenario** is a possible future: a starting balance, a time range, and a set of situations placed on a timeline.

Paint months in the timeline grid to activate a situation for that period. Drag rows to reorder. Every change updates the balance chart instantly.

### 3 — Compare

Use the **overlay toggles** above the chart to render other scenarios' lines alongside the active one — or switch to full **Comparison Mode** for an overview of all scenarios side by side.

---

## Simulation Model

- Time resolution: **monthly**
- **Recurring effects**: applied every month the scenario entry is active
- **One-time effects**: applied only in the entry's first month
- Scenarios are computed **independently** — no shared state between them
- Balance at month end = previous balance + Σ(income) − Σ(expenses)

---

## Project Structure

```
src/
├── types.ts              # All TypeScript interfaces
├── simulation.ts         # Pure simulation engine
├── store.ts              # Zustand store + sample data
├── utils/
│   └── months.ts         # YYYY-MM string utilities (no date-fns)
└── components/
    ├── SituationsSidebar.tsx
    ├── SituationForm.tsx
    ├── ScenarioTabs.tsx
    ├── ScenarioSettings.tsx
    ├── TimelineEditor.tsx    # Gantt-style paint grid
    ├── BalanceChart.tsx      # Single/overlay scenario chart
    └── ComparisonChart.tsx   # Full multi-scenario chart
```

---

## License

[MIT](LICENSE)
