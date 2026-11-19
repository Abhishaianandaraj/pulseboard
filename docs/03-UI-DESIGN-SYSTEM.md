# UI Design System & Component Specification — PulseBoard

**Document Version:** 2.0.0  
**Design Philosophy:** Linear Minimalism meets Microsoft Planner Ergonomics  
**Zero External Dependencies:** Built 100% with pure Modern CSS Variables, Flexbox/Grid, and `@angular/cdk`.  

---

## 1. Visual Design Philosophy & Aesthetics

PulseBoard is designed for engineers and engineering leaders who demand speed, dense information hierarchy, and zero visual clutter. It draws inspiration from:
- **Linear:** High-contrast obsidian dark palette, subtle border borders (`1px solid var(--border-subtle)`), 150ms micro-animations, and keyboard-first layout paradigms.
- **Microsoft Planner:** Intuitive drag-and-drop bucket ergonomics, accessible task cards, collaborative checklists, and immediate project-wide status clarity.

---

## 2. Semantic Color System & Design Tokens

All colors, shadows, and surfaces are defined through semantic CSS custom properties. Component stylesheets MUST reference these variables rather than hardcoded hex values.

### 2.1 CSS Variable Specification

```css
:root {
  /* Canvas & Surfaces (Light Mode) */
  --bg-canvas: #f8fafc;
  --bg-surface: #ffffff;
  --bg-elevated: #ffffff;
  --bg-hover: #f1f5f9;
  --bg-active: #e2e8f0;

  /* Typography */
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --text-inverse: #ffffff;

  /* Borders & Dividers */
  --border-subtle: #e2e8f0;
  --border-focus: #3b82f6;

  /* Status Colors */
  --status-todo: #64748b;
  --status-inprogress: #3b82f6;
  --status-deployed: #8b5cf6;
  --status-done: #10b981;
  --status-blocked: #ef4444;

  /* Priorities */
  --priority-critical: #ef4444;
  --priority-high: #f97316;
  --priority-medium: #eab308;
  --priority-low: #64748b;

  /* Accents */
  --accent-primary: #2563eb;
  --accent-primary-hover: #1d4ed8;

  /* Elevation Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-drawer: -4px 0 24px rgba(0, 0, 0, 0.12);
}

[data-theme="dark"] {
  /* Canvas & Surfaces (Obsidian Dark Mode) */
  --bg-canvas: #0b0e14;
  --bg-surface: #11151f;
  --bg-elevated: #181d2a;
  --bg-hover: #1e2436;
  --bg-active: #283046;

  /* Typography */
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --text-inverse: #0b0e14;

  /* Borders & Dividers */
  --border-subtle: #1e2433;
  --border-focus: #60a5fa;

  /* Elevation Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.5);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.4);
  --shadow-lg: 0 10px 20px -3px rgb(0 0 0 / 0.5);
  --shadow-drawer: -6px 0 30px rgba(0, 0, 0, 0.6);
}
```

---

## 3. Role Badge Visual Coding

To instantly convey technical specialization across Kanban cards, sprint tables, and member allocation lists, PulseBoard defines a standardized badge taxonomy:

| Role Category | Badge Label | Background (Light) | Background (Dark) | Text Color |
|---|:---:|---|---|---|
| **DEV** | `DEV` | `#eff6ff` | `rgba(59, 130, 246, 0.15)` | `#2563eb` / `#60a5fa` |
| **QA / TEST** | `QA/TEST` | `#fdf4ff` | `rgba(217, 70, 239, 0.15)` | `#c026d3` / `#f0abfc` |
| **AI** | `AI` | `#f5f3ff` | `rgba(139, 92, 246, 0.15)` | `#7c3aed` / `#a78bfa` |
| **LEAD** | `LEAD` | `#ecfdf5` | `rgba(16, 185, 129, 0.15)` | `#059669` / `#34d399` |
| **DM** | `DM` | `#fffbeb` | `rgba(245, 158, 11, 0.15)` | `#d97706` / `#fbbf24` |

---

## 4. Multi-Screen Architecture & Dedicated Page Routes

PulseBoard features an Angular routing architecture (`provideRouter(routes, withHashLocation())`) with a minimalist global shell (slim left navigation rail + compact top bar with active project selector and user profile pill):

| Route | Standalone Component | Purpose & View Structure |
|---|---|---|
| `/login` | `LoginComponent` | Minimalist Linear-style authentication screen with Corporate SSO action and 1-click Quick Workspace Role Entry demo cards. |
| `/my-day` | `MyDayComponent` | Focused daily personal landing hub featuring greeting, personal workload health bar, My Active Tasks with 1-click progression, and Needs Attention review queue. |
| `/workspace` | `WorkspaceComponent` | Decluttered execution workspace with generous whitespace housing Kanban Board, Agile Sprint Table, and Key Path Gantt. |
| `/projects` | `ProjectsComponent` | Visual directory of all project workspaces (`RAG-CORE`, `EVAL-GW`, `PULSE-V1`) with completion health, bottleneck indicators, squad members, and 1-click workspace opening. |
| `/governance` | `GovernanceComponent` | Dedicated full-page governance console with 3 clean horizontal tabs (`Team & Access`, `Delivery Bottlenecks`, `Audit Log`) with CSV/JSON export. |

---

## 5. Plain-Language Translations & Approachable Microcopy

PulseBoard replaces technical jargon and raw mathematical formulas with calm, human-friendly status labels and helpful state badges:

| Domain / Concept | Raw Technical Jargon | Plain-Language Humanized Label | Microcopy & Tooltip Behavior |
|---|---|---|---|
| **Capacity (Optimal)** | `OPTIMAL (<= 75% load)` | **"Comfortable Pace"** | Green status dot; tooltip shows `Active Pts + 3pt Recovery Buffer`. |
| **Capacity (Near Limit)** | `NEAR_CAPACITY (> 75%)` | **"Near Capacity"** | Amber status dot; encourages team balancing. |
| **Capacity (Rework Penalty)**| `OVER_BUDGET (Rework > 0)` | **"Overloaded · Fixing Failed Build"** | Red alert indicator with breakdown of recovery penalty points. |
| **Gantt CPM Sequence** | `Critical Path (Zero Slack)` | **"Key Path"** | Marked with `🔥 Key Path` pill and distinct orange glow. |
| **Baseline Schedule Drift** | `Slippage Variance (+N days)` | **"Schedule Shift"** | Translucent baseline shadow bar displaying original committed date. |
| **Permission Barrier** | `403 Forbidden / Not Lead` | **"Awaiting Lead Sign-Off"** | Calm state badge indicating deliverable is staged on server awaiting verification. |
