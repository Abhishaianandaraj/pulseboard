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

---

## 6. Jira + Linear Visual Overhaul & Enterprise Patterns

PulseBoard adopts Jira and Linear's enterprise product aesthetic, eliminating artificial neon gradients, heavy card drop shadows, and decorative emojis in favor of crisp typography and structural clarity:

### 6.1 Design Tokens & Surface Parity
- **Light Theme:** Canvas `#f4f5f7`, Card Surface `#ffffff`, Hairline Border `#dfe1e6`, Hover `#ebecf0`.
- **Dark Theme:** Canvas `#0f1115`, Card Surface `#16181d`, Hairline Border `#262932`, Hover `#1e222b`.
- **System Typography:** `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`, 13px base body, 11px uppercase tracked labels (`letter-spacing: 0.04em`), `tabular-nums` for points and dates.

### 6.2 Overlapping Stacked Avatars (`.avatar-stack`)
For tasks with co-assignees, PulseBoard renders Jira-style overlapping circular avatars:
```css
.avatar-stack {
  display: inline-flex;
  align-items: center;
  flex-direction: row-reverse;
}
.avatar-stack-item {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--bg-surface);
  margin-left: -6px;
  font-size: 8.5px;
  font-weight: 700;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### 6.3 Task Ownership Lock Indicator
Deliverables assigned to teammates render a quiet lock indicator:
- Card chip: `🔒 Read-only · Teammate task`
- Detail Drawer: Header alert strip clarifying view-only rights with permission to append collaborative review notes.
- Interaction: Drag-and-drop and property inputs are disabled to prevent accidental modifications.

### 6.4 Minimalist Inline SVG Icons
All core navigation items, view tabs, search bars, and action modals use clean, geometric 14–18px inline SVG icons rather than decorative emojis.

---

## 7. Kanso + Spartan UI + Phosphor Light Design System (v3.0)

PulseBoard v3.0 introduces a comprehensive aesthetic and tactile interaction overhaul inspired by Japanese minimalism (**Kanso**), Spartan restraint, and editorial stationery design:

### 7.1 Dual-Theme Semantic Tokens: Alabaster Light & Sumi Ink Dark

| Design Token | Light Theme ("Alabaster & Sage") | Dark Theme ("Sumi Ink & Moss") | Role & Semantic Intent |
|---|---|---|---|
| `--bg-canvas` | `#F9F8F6` | `#141312` | Warm stationery alabaster paper / Sumi espresso charcoal canvas |
| `--bg-surface` | `#FFFFFF` | `#1C1B19` | Elevated pure card paper / Sumi dark stone card surface |
| `--bg-subtle` | `#F2EFE9` | `#252320` | Soft pill fill, table rows, and secondary wash |
| `--border-hairline` | `#EBE8E2` | `#2A2825` | 1px warm stationery divider & crisp perimeter hairline |
| `--text-primary` | `#1F1E1C` | `#F2EFE9` | Warm charcoal ink / warm ivory typography |
| `--text-secondary`| `#6E6A63` | `#9E9990` | Muted stone descriptive prose |
| `--text-muted` | `#8A857D` | `#78736B` | Low-priority metadata and timestamps |
| `--accent-primary`| `#5C7362` (tint `#EEF2EF`)| `#6E8B74` (tint `rgba(110,139,116,0.14)`)| Muted sage green / soft moss-sage primary action |
| `--accent-warn` | `#C59B4E` | `#D4A857` | Ochre warning & Key Path highlights |
| `--accent-danger`| `#C86D51` (tint `#F9EFEA`)| `#D97B5E` (tint `rgba(217,123,94,0.14)`)| Terracotta error, blocker, and recovery overhead alerts |
| `--shadow-soft` | `0 4px 20px -2px rgba(31,30,28,0.04)` | `0 4px 20px -2px rgba(0,0,0,0.25)` | Natural organic elevation |
| `--shadow-float` | `0 12px 32px -4px rgba(31,30,28,0.08)` | `0 12px 32px -4px rgba(0,0,0,0.45)` | Floating modals and drawer elevation |

### 7.2 Typography & Editorial Pairing
- **Editorial Headings:** Google Font `Newsreader` (weights 300–500, italic) for page greetings, project titles, modal titles, and the `PulseBoard.` wordmark with a sage period.
- **Controls & Metadata:** `Plus Jakarta Sans` (weights 400–600) for controls, status badges, buttons, and navigation labels.
- **Figures:** `JetBrains Mono` with `tabular-nums` for story points, timestamps, and IDs.

### 7.3 Phosphor Light Icons
Integrated `@phosphor-icons/web` (`ph-light` 1.5px-equivalent hairline icons) across every navigation item, button, status badge, lock chip, and drawer control.

### 7.4 Pill-First Geometry & Open-Air Surfaces
- **Pill-First Geometry (`border-radius: var(--radius-pill)`):** Action buttons, filter chips, view switchers (`Board` / `Sprint` / `Gantt`), role tags, and sidebar items adopt rounded pill geometry.
- **Open-Air Row Lists:** Card lists and data tables render inside unified soft paper containers (`border-radius: var(--radius-card); border: 1px solid var(--border-hairline)`) with 1px hairline dividers rather than nested box-in-box cards.
- **Frosted Glass Backdrops:** Modals and the Task Drawer utilize `backdrop-filter: blur(6px)` and translucent scrims (`rgba(20, 19, 18, 0.45)`).

### 7.5 Tactile Hover Micro-Interactions (`cubic-bezier(0.22, 1, 0.36, 1)`)
- **Buttons & Pills:** Smooth `-1px` lift on hover (`transform: translateY(-1px)`), gentle color transitions, and `scale(0.98)` press feedback.
- **Task Cards & Rows:** Elevation lift with soft border highlight shifting toward sage green (`border-color: rgba(92, 115, 98, 0.4)`).
- **Interactive Avatar Stack Fan-Out:** Stacked overlapping avatars (`margin-left: -6px`) smoothly fan out (`margin-left: 2px`) on group hover so co-assignees are effortless to inspect.
- **Sidebar Nav Items:** Smooth sliding background pill highlight with subtle icon scaling on hover.

### 7.6 Smart Import Modal Ergonomics & Visual Alignment
- **Strict Badge & Pill Geometry:** `STEP 1` and `STEP 2` badges adopt identical horizontal pill geometry (`display: inline-flex; align-items: center; white-space: nowrap; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; flex-shrink: 0;`), completely eliminating text-wrapping artifacts.
- **Footer Metadata Badge:** The `Auto-Squad Onboarding` pill enforces `white-space: nowrap; flex-shrink: 0; display: inline-flex;` with subtle hairline border styling on `var(--bg-surface)`.
- **Primary Action CTA (`btn-import`):** Enforces single-line flex alignment (`display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; padding: 8px 18px;`) with crisp disabled styling (`background: var(--bg-surface); color: var(--text-muted); border: 1px solid var(--border-hairline)`) when JSON is absent or invalid, transitioning to high-contrast sage green (`var(--accent-primary)`) when valid JSON is provided.
- **Clean Phosphor Light Icons:** Decorative emojis and sparkles replaced with semantic Phosphor Light glyphs (`<i class="ph-light ph-file-code"></i>` for sample JSON loading and `<i class="ph-light ph-tray-arrow-down"></i>` for workspace ingestion).


### 7.7 Share & Permissions Modal & Dynamic Audit Scope Indicators
- **Frosted Glass Scrim & Modal Container:** Centered dialog with `backdrop-filter: blur(8px)`, `max-width: 740px`, `border-radius: 16px`, and `Newsreader` editorial header `"Share & Permissions."` with brand period.
- **Dynamic Scope Banners:**
  - Full Portfolio View: Muted sage green tint (`rgba(138, 158, 126, 0.08)`), `1px solid rgba(138, 158, 126, 0.25)`, and `<i class="ph-light ph-shield-check"></i>`.
  - Personal Activity View: Warm amber tint (`rgba(200, 160, 60, 0.08)`), `1px solid rgba(200, 160, 60, 0.25)`, and `<i class="ph-light ph-lock-simple"></i>`.
- **Project Squad Membership Controls:**
  - Target project selection pills with project color dots and member count tags.
  - "Copy Workspace Link" pill button with clipboard transition to `"Link Copied!"` for 2.2s.
  - Squad members table with technical role avatars, system role tags, and interactive 1-click toggle switches (`Active` vs `Off`).
- **Role Capabilities & Visibility Matrix:**
  - Visual matrix covering `DEV`, `QA`, `LEAD`, `VIEWER`, and `ADMIN`.
  - Checkbox toggle controls for `Create Deliverables`, `View All Logs`, and `Approve Sign-Off`.
  - Graceful read-only state for non-management personas with lock indicator.
- **Top Header Bar & Project Card Triggers:**
  - Header bar: `<button class="btn-top-share"><i class="ph-light ph-users-three"></i> <span>Share</span></button>`.
  - Project directory cards: `<button class="btn-proj-share"><i class="ph-light ph-users-three"></i> <span>Share</span></button>`.


### 7.8 Global App Shell & Log Container Scroll Architecture
- **Sticky Sidebar & Unclipped Main Viewport:**
  - Sidebar rail (`.nav-rail`) uses `position: sticky; top: 0; height: 100vh; flex-shrink: 0;` to remain anchored across all vertical scrolling.
  - The right-hand shell content pane (`.shell-content`) uses `height: 100vh; min-height: 0; overflow-y: auto; overflow-x: hidden;` with smooth custom thin scrollbars (`custom-scroll`), eliminating clipped pages caused by nested `overflow: hidden` containers.
  - Top header bar (`.shell-top-bar`) pins firmly at `top: 0; position: sticky; z-index: 20; flex-shrink: 0;`.
- **Card-Bounded Activity Feeds & Audit Tables (`max-height: 62vh`):**
  - My Day Recent Project Pulse feed (`.activity-feed-list`) and Governance Audit Ledger (`.gov-table-container`) are bounded by `max-height: 62vh; overflow-y: auto; padding-right: 4px;` with Kanso thin scrollbars (`scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent`).
  - Audit table headers (`thead th`) use `position: sticky; top: 0; z-index: 5; background: var(--bg-subtle)` to keep column headers pinned while records scroll beneath.
- **Bottom Breathing Room (`padding-bottom: 48px`):**
  - Page wrappers (`.my-day-wrapper`, `.gov-page-wrapper`, `.projects-page-wrapper`, `.workspace-viewport`) enforce `padding-bottom: 48px` ensuring the final activity events, table rows, and project cards are never cropped against the bottom edge of the display.


### 7.9 Simplified Delivery Roadmap (Timeline) & Hover-Only Dependency Connectors
- **Unified Split Layout:**
  - Container (`.timeline-split-card`): `border: 1px solid var(--border-hairline); border-radius: var(--radius-card); background: var(--bg-surface); box-shadow: var(--shadow-soft); overflow: hidden; display: flex;`.
  - Left pane (`.timeline-left-column`): Fixed 340px column with `border-right: 1px solid var(--border-hairline)`.
  - Right pane (`.timeline-right-column`): Horizontally scrollable track canvas (`min-width: 600px`).
- **Scannable Legend & Control Strip (`.timeline-sub-toolbar`):**
  - Status color indicators: Sage green (`#5C7362`) for `Completed / Deployed`, Ochre (`#C59B4E`) for `In Progress`, and Terracotta (`#C86D51`) for `Blocked / Delayed`.
  - `Blocked Only` toggle pill (`.btn-blocked-toggle`): Pill geometry with interactive active indicator pill (`.filter-active-indicator`).
  - Auto-shift trigger (`.btn-conflict-autoshift`): Amber-tinted action pill for resolving prerequisite overlaps.
- **Breathable 4-Week Columns & Vertical Today Marker:**
  - Header (`.timeline-weeks-header`): 4 equal weekly sprint columns (`Week 1 · Nov 10 - Nov 16` to `Week 4 · Dec 01 - Dec 07`) with `border-right: 1px solid var(--border-hairline)` and `padding-top: 10px;`.
  - Vertical Today Line (`.timeline-today-v-line`): Absolute 2px dashed line in Sage green (`var(--accent-primary)`) at Day 12 (42.86%) with anchored `Today` tag pill (`.today-tag-text`: `top: 2px; font-size: 9px; padding: 1px 6px; line-height: 1.2;`) eliminating overlap with week label text.
- **Synchronized 88px Row Height & Pill Deliverable Bars:**
  - Left row (`.timeline-deliverable-item`) and right track lane (`.timeline-lane-row`): Synchronized `height: 88px; min-height: 88px; padding: 12px 16px;` providing generous vertical breathing room for 2-line deliverable titles and the `After PB-101` dependency pill without border collisions.
  - Duration Pill (`.timeline-duration-pill`): Smooth rounded pill (`border-radius: var(--radius-pill); height: 36px; top: 26px;`) perfectly centered at `44px` with soft tactile hover lift (`transform: translateY(-1px)`).
  - Stacked overlapping circular co-assignee avatars (`.bar-avatar-dot`, 18px diameter).
  - Status + effort text (`.timeline-bar-label-text`, `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`).
- **Zero-Clutter Hover-Only SVG Connector Layer (`.timeline-hover-svg`):**
  - Absolute SVG overlay with `viewBox="0 0 1000 H"` and `preserveAspectRatio="none"`.
  - Computes active connectors only when `hoveredTaskId` is set, completely eliminating idle line clutter.
  - Draws cubic bezier curves (`M x1 y1 C ... x2 y2`) centered at `idx * 88 + 44` with directional SVG marker arrowheads (`#timeline-arrow-normal` in Sage or `#timeline-arrow-danger` in Terracotta when blocked/conflict).
  - Upstream and downstream connected rows highlight with subtle sage background tint (`var(--accent-primary-tint)`).
