# QA Test Matrix & Release Changelog — PulseBoard

**Document Version:** 2.0.0  
**Status:** Living Quality Gate & Release Log  

---

## 1. QA Verification Checklist & Quality Gates

Every release candidate, pull request, and staging deployment must execute and satisfy this verification matrix:

### 1.1 RBAC Enforcement & Security
- [ ] **Role Simulator Swapping:** Switching between `VIEWER`, `DEV`, `QA`, `LEAD`, and `ADMIN` immediately updates button visibility and interactive permissions without full-page reloads.
- [ ] **Viewer Restrictions:** `VIEWER` role cannot drag cards, edit task titles, open `+ New Task` modal, or append verification notes.
- [ ] **Dev Scope:** `DEV` can create tasks, mark blocker flags, and advance tasks to `DEPLOYED`, but cannot move tasks directly to `DONE`.
- [ ] **QA Sign-Off:** `QA` can review deployed tasks, reject to `IN_PROGRESS`, or flag staging bugs.
- [ ] **Lead Authority:** Only `LEAD` or `ADMIN` can mark tasks `DONE` with an official verification note.
- [ ] **XSS Injection Test:** Pasting malicious payload `<script>alert('XSS')</script><img src=x onerror=alert(1)>` in Task Title, Description, or JSON Import correctly sanitizes and renders harmless escaped text.

### 1.2 Developer Capacity Budget & Recovery Score
- [ ] **Capacity Formula Verification:** `Effective Load = Active Story Points + (Rework Count * 3)`.
- [ ] **Optimal State (<= 10 pts):** Team member shows green capacity indicator.
- [ ] **Near Capacity (11 - 15 pts):** Team member shows amber capacity indicator.
- [ ] **Over Budget (> 15 pts):** Team member shows red warning indicator; task assignment dropdown flags capacity breach warning.
- [ ] **Rework Penalty Calculation:** Moving a task from `DEPLOYED` back to `IN_PROGRESS` increments `reworkCount` by 1 and immediately adds 3 penalty points to the assignee's effective load.

### 1.3 Gantt Dependencies & Schedule Drift
- [ ] **Predecessor Connector Lines:** Visual dependency connectors correctly draw lines from predecessor task cards to successor task cards.
- [ ] **Cycle Detection:** Setting Task A dependent on Task B when Task B is already dependent on Task A is prevented with an inline error.
- [ ] **Critical Path Highlight:** The longest chain of dependent tasks correctly highlights with a glowing border.
- [ ] **Schedule Drift Visualization:** If `dueDate` is moved beyond `baselineDueDate`, the UI renders dual-track baseline vs. actual drifted bars.
- [ ] **Slippage Reason Modal:** Extending `dueDate` prompts for a mandatory slip reason (`Dependency Blocked`, `Scope Expanded`, `Production Hotfix`, `Underestimated Effort`).

### 1.4 Smart JSON Import Engine
- [ ] **Syntax Error Handling:** Malformed JSON triggers immediate red border and syntax error notification without app crash.
- [ ] **Auto-Member Registration:** JSON referencing an unknown assignee name automatically adds the member with the supplied or default role (`Full-Stack Dev`) and displays the new member in the sidebar.
- [ ] **Project Mapping:** Tasks with `projectCode: "EVAL-GW"` correctly link to the `EVAL-GW` project ID upon import.
- [ ] **Batch Import Performance:** Importing a payload of 20 tasks executes in < 150ms with instantaneous Signal state reactivity.

### 1.5 Theme & UI Parity Gate
- [ ] **Light Mode Verification:** All surfaces, cards, modals, and drawers render high-contrast `#f8fafc` canvas with `#ffffff` cards and `#e2e8f0` subtle borders.
- [ ] **Dark Mode Verification:** All surfaces, cards, modals, and drawers render obsidian `#0b0e14` canvas with `#11151f` cards and `#1e2433` borders.
- [ ] **Zero Hardcoded Colors:** No inline hardcoded hex colors bypass the semantic CSS variable engine.
- [ ] **Production Build Check:** `npx ng build --configuration production --base-href=/pulseboard/` completes with 0 errors and 0 budget warnings.

---

## 2. Release Changelog

### `v2.0.0-alpha` (In Development)
- **Living Documentation Suite:** Established `AGENT_RULES.md`, `docs/01-PRD.md`, `docs/02-ARCHITECTURE-SECURITY.md`, `docs/03-UI-DESIGN-SYSTEM.md`, `docs/04-API-DATA-CONTRACT.md`, and `docs/05-QA-AND-CHANGELOG.md`.
- **RBAC Architecture:** Formulated 5-tier role matrix (`VIEWER`, `DEV`, `QA`, `LEAD`, `ADMIN`) with local simulation support.
- **Capacity Budget Protocol:** Designed developer recovery score formula with rework penalties.
- **Dependency Gantt Engine:** Designed interactive connector schema, Critical Path highlight, and baseline vs. actual drift bars.
- **Grace Buffer Protocol:** Formalized slip reason taxonomy for non-punitive schedule extensions.

---

### `v1.0.0` (Live GitHub Pages Baseline)
- **Multi-Project Workspaces:** Added project switching (`RAG-CORE`, `EVAL-GW`, `PULSE-V1`) and dynamic `+ Project` modal.
- **Tri-Methodology Views:** Delivered drag-and-drop Kanban Board, Agile Sprint table, and Waterfall Timeline views using `@angular/cdk/drag-drop`.
- **Lead Radar:** Real-time computed strip for Blocked tasks, Deployed tasks awaiting verification, and Available Bandwidth.
- **Smart JSON Import:** AI-ready Gemini prompt template modal with live JSON validation and dynamic team member auto-registration.
- **Task Drawer:** Slide-over inspection drawer for subtask checklists, blocker management, and Lead review note logging.
- **Design System:** Complete Light/Dark mode token engine with zero external UI dependencies.
- **Zero-Error Production Build:** Verified Angular v18 production bundle generation inside `dist/pulse-board/browser/`.
