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

## 4. Specification of the 5 Core V2 Screens

### Screen 1: "My Day" Focus Hub
- **Purpose:** Personalized, high-velocity view tailored to the active logged-in engineer.
- **Key Elements:**
  - Tasks assigned to the active user partitioned into *Urgent / Blocked*, *In Progress*, and *Ready for Server Verification*.
  - Daily personal capacity indicator (`Active Story Points / 15 pt Budget`).
  - Quick action buttons: *Log Progress*, *Flag Blocker*, *Deploy to Staging*.

### Screen 2: Multi-Methodology Delivery Workspace
- **Purpose:** Primary engineering hub offering fluid switching between 3 delivery views:
  1. **Kanban Board:** 4 columns (`To Do`, `In Progress`, `Deployed to Server`, `Done`) with smooth `@angular/cdk` drag-and-drop. Dragging into `DEPLOYED` triggers a staging toast.
  2. **Agile Sprint View:** Compact, tabular view grouped by sprint or priority with inline status dropdowns, story point counters, and assignee badges.
  3. **Waterfall Gantt:** Sequential timeline mapping start dates to due dates with interactive dependency connectors and Critical Path highlights.

### Screen 3: Deep Deployment Cycle Drawer
- **Purpose:** Slide-over modal for thorough task inspection, subtask tracking, and Lead/QA server sign-off.
- **Key Elements:**
  - Task metadata header (Project code chip, editable title, priority badge).
  - Subtask interactive checklist with progress bar.
  - Blocker toggle with reason input.
  - **Server Review & Verification Panel:** Appends lead sign-off notes, records deployment commit hashes, and displays staging verification logs.

### Screen 4: Squad & RBAC Console
- **Purpose:** Lead and Admin command center for team allocation and permission oversight.
- **Key Elements:**
  - Squad member roster with real-time capacity budget dials (`Optimal`, `Near Capacity`, `Over Budget`).
  - Inline `+ Add Member` form with instant role and squad assignment.
  - Multi-tenancy Project Switcher with project status badges and quick creation modal.
  - Active RBAC role simulator toggle for staging validation.

### Screen 5: Cycle-Time Analytics
- **Purpose:** Zero-spam engineering intelligence replacing noisy email notifications.
- **Key Elements:**
  - Lead time and cycle time distributions across projects.
  - Rework penalty trends (frequency of tasks moved back from `DEPLOYED` to `IN_PROGRESS`).
  - Grace buffer slippage analytics categorized by reason (`Dependency Blocked`, `Scope Expanded`, etc.).
