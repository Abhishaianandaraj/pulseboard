# QA Test Matrix & Release Changelog — PulseBoard

**Document Version:** 2.0.0  
**Status:** Living Quality Gate & Release Log  

---

## 1. QA Verification Checklist & Quality Gates

Every release candidate, pull request, and staging deployment must execute and satisfy this verification matrix:

### 1.1 RBAC Enforcement & Security
- [x] **Role Simulator Swapping:** Switching between `VIEWER`, `DEV`, `QA`, `LEAD`, and `ADMIN` immediately updates button visibility and interactive permissions without full-page reloads.
- [x] **Viewer Restrictions:** `VIEWER` role cannot drag cards, edit task titles, open `+ New Task` modal, or append verification notes.
- [x] **Dev Scope:** `DEV` can create tasks, mark blocker flags, and advance tasks to `DEPLOYED`, but cannot move tasks directly to `DONE`.
- [x] **QA Sign-Off:** `QA` can review deployed tasks, reject to `IN_PROGRESS`, or flag staging bugs.
- [x] **Lead Authority:** Only `LEAD` or `ADMIN` can mark tasks `DONE` with an official verification note.
- [x] **XSS Injection Test:** Pasting malicious payload `<script>alert('XSS')</script><img src=x onerror=alert(1)>` in Task Title, Description, or JSON Import correctly sanitizes and renders harmless escaped text.

### 1.2 Developer Capacity Budget & Recovery Score
- [x] **Capacity Formula Verification:** `Effective Load = Active Story Points + (Rework Count * 3)`.
- [x] **Optimal State (<= 10 pts):** Team member shows green capacity indicator.
- [x] **Near Capacity (11 - 15 pts):** Team member shows amber capacity indicator.
- [x] **Over Budget (> 15 pts):** Team member shows red warning indicator; task assignment dropdown flags capacity breach warning.
- [x] **Rework Penalty Calculation:** Flagging `NEEDS_CHANGES` on review increments `reworkCount` by 1 and immediately adds 3 penalty points to the assignee's effective load.

### 1.3 Schedule Drift & Gantt Dependency Protocol
- [x] **Schedule Drift Detection:** If `dueDate` is moved beyond `baselineDueDate`, the UI detects drift (+N days) and renders a translucent baseline shadow bar.
- [x] **Slippage Reason Selector:** Extending `dueDate` provides 1-click taxonomy selection (`DEPENDENCY_BLOCKED`, `SCOPE_EXPANDED`, `PRODUCTION_HOTFIX`, `UNDERESTIMATED`).
- [x] **Audit Log Integration:** Deadline extensions, rework penalties, dependency edits, and date cascade shifts record immutable events in the audit trail.
- [x] **Gantt Dependency Connectors:** Smooth SVG cubic bezier arrows connect predecessor completion coordinates to dependent task start coordinates with directional markers and conflict/critical path styling.
- [x] **Critical Path Method (CPM):** Longest topological delivery chain calculates zero slack and highlights critical tasks with high-visibility orange badges and glowing borders.
- [x] **Circular Dependency Prevention:** Recursive graph traversal prevents circular A -> B -> A loops with immediate inline feedback in the Task Drawer.
- [x] **Domino Delay Detection & Cascade Alignment:** Conflicts between upstream due dates and downstream start dates trigger an advisory banner and 1-click `⚡ Auto-Shift Dependent Dates` alignment.

### 1.4 Smart JSON Import Engine
- [x] **Syntax Error Handling:** Malformed JSON triggers immediate red border and syntax error notification without app crash.
- [x] **Auto-Member Registration:** JSON referencing an unknown assignee name automatically adds the member with the supplied or default role (`Full-Stack Dev`) and displays the new member in the sidebar.
- [x] **Project Mapping:** Tasks with `projectCode: "EVAL-GW"` correctly link to the `EVAL-GW` project ID upon import.
- [x] **Batch Import Performance:** Importing a payload of 20 tasks executes in < 150ms with instantaneous Signal state reactivity.

### 1.5 Theme & UI Parity Gate
- [x] **Light Mode Verification:** All surfaces, cards, modals, and drawers render high-contrast `#f8fafc` canvas with `#ffffff` cards and `#e2e8f0` subtle borders.
- [x] **Dark Mode Verification:** All surfaces, cards, modals, and drawers render obsidian `#0b0e14` canvas with `#11151f` cards and `#1e2433` borders.
- [x] **Zero Hardcoded Colors:** No inline hardcoded hex colors bypass the semantic CSS variable engine.
- [x] **Production Build Check:** `npx ng build --configuration production --base-href=/pulseboard/` completes with 0 errors and 0 budget warnings.

---

## 2. Release Changelog

### `v2.0.0-alpha` (In Development)
- **V2 Milestone 2 Delivered (Interactive Dependency Gantt Chart — `FR-03`):**
  - **Topological Dependency Graph Engine:** Implemented `addDependency(taskId, upstreamTaskId)` and `removeDependency(taskId, upstreamTaskId)` in `TaskStoreService` with recursive DFS circular dependency cycle detection to prevent deadlocks.
  - **Critical Path Method (CPM) Calculation:** Computed signal `ganttScheduleMetrics` calculates longest delivery chains, identifies critical path task IDs (`isCriticalPath`), and highlights bottlenecks across the project schedule.
  - **Interactive Gantt Split Board UI:** Upgraded Timeline view with a 360px left tree column (with CPM tags and prerequisite counts) and a 30-day scrollable calendar timeline grid with dynamic SVG cubic bezier connector curves and directional arrowheads.
  - **Domino Delay Detection & 1-Click Auto-Shift:** Real-time detection of dependency clashes where `upstream.dueDate > downstream.startDate`. Provides a 1-click `⚡ Auto-Shift Dependent Dates` cascade shift tool that propagates dates through all downstream descendants and logs audit entries.
  - **Dual-Track Baseline Drift Bars:** Renders translucent dashed baseline shadow bars beneath live forecast bars whenever a deliverable slips past its initial baseline due date.
  - **Task Drawer Prerequisites Manager:** Added dedicated "Prerequisites & Dependencies" section inside `TaskDrawerComponent` for 1-click upstream deliverable linking/unlinking with real-time cycle prevention alerts.
- **V2 Milestone 1 Delivered:**
  - **RBAC Session Role Context (`FR-01` / `FR-02`):** Added active session switcher pill in the top command bar allowing 1-click simulation between `DEV`, `QA`, `LEAD`, and `VIEWER`. Enforced role gates across card movement, task creation, and server acceptance sign-offs.
  - **Smart Developer Capacity Budget & Recovery Score (`FR-04`):** Implemented effective load formula `Effective Load = Active Story Points + (Rework Count * 3)`. Integrated live capacity indicators (`Optimal`, `Near Capacity`, `Over Budget`) across Assignee selects, New Task modal, and Sidebar Squad roster, accompanied by soft advisory warning banners.
  - **Deadline Slippage Grace Protocol (`FR-05`):** Added `baselineDueDate` tracking, schedule drift detection (+N days), 1-click slip reason taxonomy (`DEPENDENCY_BLOCKED`, `SCOPE_EXPANDED`, `PRODUCTION_HOTFIX`, `UNDERESTIMATED`), and `SLIPPAGE_LOGGED` audit events.
  - **Automated Rework Overhead Penalty:** Submitting a `NEEDS_CHANGES` review verdict automatically increments `task.reworkCount`, adds 3 recovery penalty points to the engineer's workload, reverts staging tasks back to `IN_PROGRESS`, and records `REWORK_PENALTY` in the audit log.
- **Living Documentation Suite:** Established `AGENT_RULES.md`, `docs/01-PRD.md`, `docs/02-ARCHITECTURE-SECURITY.md`, `docs/03-UI-DESIGN-SYSTEM.md`, `docs/04-API-DATA-CONTRACT.md`, and `docs/05-QA-AND-CHANGELOG.md`.

---

### `v1.0.0` (Live GitHub Pages Baseline)
- **Multi-Project Workspaces:** Added project switching (`RAG-CORE`, `EVAL-GW`, `PULSE-V1`) and dynamic `+ Project` modal.
- **Tri-Methodology Views:** Delivered drag-and-drop Kanban Board, Agile Sprint table, and Waterfall Timeline views using `@angular/cdk/drag-drop`.
- **Lead Radar:** Real-time computed strip for Blocked tasks, Deployed tasks awaiting verification, and Available Bandwidth.
- **Smart JSON Import:** AI-ready Gemini prompt template modal with live JSON validation and dynamic team member auto-registration.
- **Task Drawer:** Slide-over inspection drawer for subtask checklists, blocker management, and Lead review note logging.
- **Design System:** Complete Light/Dark mode token engine with zero external UI dependencies.
- **Zero-Error Production Build:** Verified Angular v18 production bundle generation inside `dist/pulse-board/browser/`.
