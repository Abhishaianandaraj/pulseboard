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

### 1.4 Governance, Bottleneck Telemetry & Audit Checklist
- [x] **Squad & RBAC Matrix Gate:** `LEAD` / `ADMIN` sessions can edit `systemRole` and `capacityBudget` live; edits record immutable `MEMBER_ROLE_UPDATED` entries in the audit trail.
- [x] **Read-Only Lock for Non-Leads:** `DEV` and `VIEWER` personas see a read-only governance table with disabled/badge controls.
- [x] **Cycle-Time Telemetry:** Computes average Lead sign-off wait hours staged in `DEPLOYED`, cumulative rework recovery penalty overhead, and project-by-project bottleneck breakdowns.
- [x] **Audit Trail Search & Multi-Filter:** Filters chronological ledger by Actor, Action Type, or free text keywords without page reload.
- [x] **Compliance Export:** 1-click CSV (`pulseboard_audit_trail_YYYY-MM-DD.csv`) and JSON exports generate sanitized provenance files for compliance archives.

### 1.5 Multi-Screen Routing & Auth Guard Verification
- [x] **Route Protection Gate:** Unauthenticated direct access to `/my-day`, `/workspace`, `/projects`, or `/governance` redirects reliably to `/login`.
- [x] **Corporate SSO & Quick Persona Entry:** 1-click login as `Abhishai [DEV]`, `Vikram Rao [LEAD]`, `Karthik R [QA]`, or `Sanjay Patel [VIEWER]` authenticates session and lands on `/my-day`.
- [x] **Sign Out Session Invalidation:** Clicking `Sign Out` invalidates `sessionStorage` and returns the user to the centered login screen.
- [x] **GitHub Pages Hash Routing:** Direct deep-link refreshes on `/#/workspace` or `/#/projects` resolve with zero 404 HTTP errors via `withHashLocation()`.
- [x] **Approachable Microcopy Parity:** All views render humanized labels (`"Comfortable Pace"`, `"Near Capacity"`, `"Overloaded · Fixing Failed Build"`, `"Key Path"`, `"Schedule Shift"`, `"Awaiting Lead Sign-Off"`).

### 1.6 Smart JSON Import Engine
- [x] **Syntax Error Handling:** Malformed JSON triggers immediate red border and syntax error notification without app crash.
- [x] **Auto-Member Registration:** JSON referencing an unknown assignee name automatically adds the member with the supplied or default role (`Full-Stack Dev`) and displays the new member in the sidebar.
- [x] **Project Mapping:** Tasks with `projectCode: "EVAL-GW"` correctly link to the `EVAL-GW` project ID upon import.
- [x] **Batch Import Performance:** Importing a payload of 20 tasks executes in < 150ms with instantaneous Signal state reactivity.

### 1.7 Theme & UI Parity Gate
- [x] **Light Mode Verification:** All surfaces, cards, modals, and drawers render high-contrast `#f8fafc` canvas with `#ffffff` cards and `#e2e8f0` subtle borders across all 5 pages.
- [x] **Dark Mode Verification:** All surfaces, cards, modals, and drawers render obsidian `#0b0e14` canvas with `#11151f` cards and `#1e2433` borders across all 5 pages.
- [x] **Zero Hardcoded Colors:** No inline hardcoded hex colors bypass the semantic CSS variable engine.
- [x] **Production Build Check:** `npx ng build --configuration production --base-href=/pulseboard/` completes with 0 errors and 0 budget warnings.

### 1.8 Project Scoped Visibility, Task Ownership Locks & Multi-Assignee Gate
- [x] **Project-Scoped Visibility:** Logging in as `Abhishai [DEV]` scopes project selector and project directory exclusively to `RAG-CORE` and `PULSE-V1`; `EVAL-GW` is completely hidden. Logging in as `Vikram Rao [LEAD]` or `Sanjay Patel [VIEWER]` restores portfolio-wide visibility (`canViewAllProjects`).
- [x] **Task Ownership Locks:** Tasks assigned to peer squad members display a `🔒 Read-only · Teammate task` badge in Kanban cards and Drawer. Drag-and-drop movement in Kanban and status modification in Drawer are locked for peer tasks, while collaborative review/verification note appending remains open.
- [x] **Supervisory Override:** `LEAD` and `ADMIN` sessions bypass ownership locks, retaining full authority to edit, reassign, or drag-and-drop any task across projects.
- [x] **Multi-Assignee Point Splitting:** Active tasks with multiple co-assignees (e.g. `PB-102` with Abhishai + Priya) distribute story points via ceiling arithmetic `ceil(effortPoints / N)` across all assignees' `effectiveLoad` metrics.
- [x] **Multi-Assignee Pill Selector:** Task Drawer and New Task modal provide interactive co-assignee toggling with member avatars, technical role tags, and live capacity status dots.
- [x] **Jira/Linear Visual Aesthetic:** All glowing neon borders, gradient text headers, and decorative emojis eliminated in favor of crisp hairline surfaces (`#f4f5f7` canvas / `#ffffff` card / `#dfe1e6` border in Light; `#0f1115` canvas / `#16181d` card / `#262932` border in Dark), issue key chips (`PB-101`), subtask fractions (`☑ 2/4`), and overlapping stacked avatars (`.avatar-stack`).

---

## 2. Release Changelog

### `v2.0.0-alpha` (In Development)
- **V2 Milestone 5 Delivered (Project Scoped Visibility, Task Ownership Locks, Multi-Assignee & Jira/Linear Overhaul — `FR-08`, `FR-09`):**
  - **Project-Scoped Visibility (`Project.memberIds`, `visibleProjects()`):** Implemented strict squad-based project isolation. Non-lead roles (`DEV`, `QA`) can only access and view deliverables belonging to projects where their member ID is explicitly listed in `Project.memberIds`. Portfolio leads (`LEAD`, `ADMIN`) and executive delivery managers (`VIEWER`) retain portfolio-wide visibility (`canViewAllProjects`).
  - **Task Ownership Locks (`canEditTask()`):** Enforced deliverable edit protection. `DEV` and `QA` engineers can only edit, rename, move, or change status on tasks assigned to them (or unassigned tasks). Peer tasks display a `🔒 Read-only · Teammate task` badge and disable card dragging and form inputs, while still permitting teammates to append collaborative review and blocker notes.
  - **Multi-Assignee Support & Capacity Point Splitting (`Task.assigneeIds`):** Upgraded tasks to support multiple co-assignees (`assigneeIds: string[]`) while retaining `assigneeId` backward compatibility. Enhanced `memberLoadMetrics` signal to divide story points equally using ceiling arithmetic: `ceil(effortPoints / max(1, count))`. Upgraded Task Drawer and New Task modal with an interactive co-assignee pill selector.
  - **Jira + Linear Enterprise UI Overhaul:** Completely purged generic AI styling (neon glow borders, gradient title text, decorative emojis). Adopted crisp hairline styling, 13px system typography with 11px uppercase tracked labels (`letter-spacing: 0.04em`), tabular numbers, issue key chips (`PB-101`), story point lozenges (`5p`), subtask fraction counters (`☑ 2/4`), overlapping circular stacked avatars (`.avatar-stack`), and clean inline SVG icons across all navigation rails, view tabs, search inputs, and modal headers.
- **V2 Milestone 4 Delivered (Multi-Screen Architecture & Approachable Microcopy — `FR-07`):**
  - **Modular Standalone Pages:** Refactored single-screen application into 5 dedicated screen components: `LoginComponent` (`/login`), `MyDayComponent` (`/my-day`), `WorkspaceComponent` (`/workspace`), `ProjectsComponent` (`/projects`), and `GovernanceComponent` (`/governance`).
  - **Angular Router & Auth Guard:** Configured `provideRouter(routes, withHashLocation())` for GitHub Pages static hosting parity and implemented functional `authGuard` backed by `sessionStorage` persistence.
  - **Minimalist Global Shell:** Decluttered `AppComponent` into a slim 210px left navigation rail (`My Day`, `Workspace`, `Projects`, `Governance`) and a compact 48px top bar with active project selector, theme toggle, user profile pill, and `Sign Out` button.
  - **Approachable Microcopy Translations:** Replaced raw formulas with humanized status labels (`"Comfortable Pace"`, `"Near Capacity"`, `"Overloaded · Fixing Failed Build"`, `"Key Path"`, `"Schedule Shift"`, `"Awaiting Lead Sign-Off"`).
  - **Personal Focus Hub (`MyDayComponent`):** Delivered focused daily landing screen with warm greeting, personal workload health bar, 1-click active task progression (`Start Working` -> `Deploy to Server` -> `Verify & Close`), and attention queues.
  - **Project Directory Hub (`ProjectsComponent`):** Delivered visual project cards featuring completion percentage, deliverable metrics, squad avatars, and 1-click workspace opening.
- **V2 Milestone 3 Delivered (Governance Console, Cycle-Time Analytics & Audit Trail — `FR-06`):**
  - **Quad-Methodology View Navigation:** Added `Governance & Audit` navigation to both the Collapsible Sidebar and the Top Command Bar pill switcher, enabling seamless navigation across `Board`, `Sprint`, `Gantt`, and `Governance`.
  - **Squad & RBAC Matrix View:** Interactive roster featuring live Squad assignment, Technical Role tags, System Permission Tier dropdowns (`VIEWER`, `DEV`, `QA`, `LEAD`, `ADMIN`), and live Capacity Budget bars displaying active story points vs. rework penalties. Restricted editing to `LEAD` / `ADMIN` with automated `MEMBER_ROLE_UPDATED` audit events.
  - **Cycle-Time & Bottleneck Telemetry:** Executive metric cards displaying Avg Lead Sign-Off Wait Time, Rework Recovery Overhead (+3 pts/penalty), and Slipped Deliverables count, paired with horizontal project bottleneck comparison bars and root-cause slippage taxonomy distributions.
  - **Immutable Security Audit Trail Ledger:** Chronological tamper-proof ledger with `"LOCKED · APPEND-ONLY"` compliance seal, real-time filtering (by Actor, Action Type, or keyword search), and 1-click **Export CSV** and **Export JSON** compliance reporting.
  - **Store Governance API:** Added `updateMemberGovernance()`, `exportAuditLogCsv()`, and `exportAuditLogJson()` to `TaskStoreService`.
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
