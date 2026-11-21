# Product Requirements Document (PRD) — PulseBoard

**Product Name:** PulseBoard  
**Document Version:** 2.0.0  
**Status:** Living Document  
**Authors:** AI Engineering Architecture Team & Product Delivery Lead  
**Target Audience:** Engineering Leads, Full-Stack Developers, QA Engineers, DevOps, Product Managers  

---

## 1. Executive Summary & Vision

**PulseBoard** is an AI-ready, commercial-grade task and delivery management platform inspired by Microsoft Planner and Linear, engineered specifically for fast-moving engineering teams. It bridges the critical gap between high-level project tracking, developer sprint execution, automated QA testing, and technical lead server verification.

PulseBoard eliminates the "license-wall" friction and bloat of legacy enterprise suites by providing a lightweight, ultra-responsive, zero-external-UI-library Angular SPA that runs seamlessly in internal corporate networks or air-gapped staging environments.

---

## 2. V1: Completed Baseline Specification

The following capabilities constitute the live, production-verified **PulseBoard V1** baseline:

### 2.1 Multi-Project Workspaces
- Project isolation with dedicated project codes:
  - `RAG-CORE`: **Enterprise RAG Copilot** (Core AI Squad)
  - `EVAL-GW`: **LLM Guardrails & Eval Gateway** (Platform & QA Squad)
  - `PULSE-V1`: **PulseBoard Internal Tooling** (Core AI Squad)
- Global `All Projects` aggregation view alongside discrete single-project scoping.
- 1-click `+ Project` creation modal with code generation and team squad assignment.

### 2.2 4-Stage Delivery Pipeline
- **`TODO` (To Do):** Backlog and planned tasks ready for pickup.
- **`IN_PROGRESS` (In Progress):** Active engineering implementation.
- **`DEPLOYED` (Deployed to Server):** High-visibility staging state signaling to QA Testers and Tech Leads that code is live on staging servers and awaiting verification.
- **`DONE` (Done):** Verified, tested, and accepted tasks.

### 2.3 Adaptive Tri-Methodology Views
- **Kanban Board:** High-velocity drag-and-drop workflow powered by `@angular/cdk/drag-drop` with column task counts, priority badges (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), blocker chips, and subtask progress indicators.
- **Agile Sprint View:** Tabular sprint view with inline status selection, story points tally, and assignee badges.
- **Waterfall Timeline:** Phase-grouped sequential view displaying start-to-due date spans and delivery roadmaps.

### 2.4 Lead Radar Strip & Activity Drawer
- **Lead Radar:** Real-time computed strip reporting:
  - Count of Blocked tasks (1-click board filter).
  - Count of tasks Deployed to Server awaiting lead/QA verification.
  - Available Bandwidth indicators (identifying engineers with zero active tasks).
- **Activity Audit Drawer:** Reverse-chronological audit trail of task state transitions, deployment events, and verification notes.

### 2.5 Smart JSON Import & Dynamic Auto-Registration
- Paste raw meeting notes or AI-generated JSON (using the embedded Gemini Prompt Template).
- Dynamic auto-registration of new team members if the payload introduces an unseeded engineer, auto-assigning default roles (`Full-Stack Dev`, `AI Engineer`, `QA / Test Engineer`).
- JSON syntax validation with inline error messaging.

### 2.6 Server Verification Notes & Inspection Drawer
- Slide-over inspection drawer for deep task editing, interactive subtask checklists, and Tech Lead review log appending.

### 2.7 Linear-Inspired Design System & Theme Engine
- Dual theme support: Crisp Light Mode (`#f8fafc`) and Linear Obsidian Dark Mode (`#0b0e14`).
- Persistent theme state synchronized across user sessions via `localStorage`.

---

## 3. V2: Approved Roadmap Requirements

The following requirements (`FR-01` through `FR-06`) constitute the V2 architecture roadmap.

---

### FR-01: Corporate SSO Authentication & Session Context
- **Status:** ✅ Implemented (V2 Milestone 1)
- **Description:** Provide seamless enterprise single sign-on integration capability (Microsoft Entra ID / OpenID Connect / SAML 2.0) with a local Developer Role Simulation Switcher for instant offline testing and executive demos.
- **Rationale:** Enterprise deployments require identity-backed audit logs and corporate credential compliance, while local staging environments require rapid role swapping without bouncing through real OAuth redirects.
- **Acceptance Criteria:**
  1. Header features an active User Profile avatar displaying current user name, email, technical role, and assigned squad.
  2. A "Role Simulation Switcher" dropdown in demo/staging mode allows immediate persona switching between `VIEWER`, `DEV`, `QA`, `LEAD`, and `ADMIN`.
  3. Persona switching updates the active session signal immediately without full-page reloads.
  4. Authentication state exposes a standardized JWT-like session contract ready to wire into enterprise MSAL (Microsoft Authentication Library).

---

### FR-02: Role-Based Access Control (RBAC) & Project Multi-Tenancy
- **Status:** ✅ Implemented (V2 Milestone 1)
- **Description:** Implement a strict RBAC policy engine controlling read, write, deploy, verify, and administrative capabilities across workspace projects.
- **Roles:**
  - `VIEWER`: Read-only access to boards, timelines, and audit logs.
  - `DEV` (Full-Stack Dev / AI Engineer): Create tasks, edit own assigned tasks, move `TODO` -> `IN_PROGRESS` -> `DEPLOYED`.
  - `QA` (QA / Test Engineer): Run verification suites, flag blockers, append QA test notes, approve/reject deployments.
  - `LEAD` (Tech Lead / Delivery Manager): Move tasks to `DONE`, sign off on Server Verification notes, adjust sprint scope, manage capacity budgets.
  - `ADMIN`: Full system permissions, add/archive projects, configure squads, purge logs.
- **Acceptance Criteria:**
  1. UI action buttons (e.g., `+ New Task`, `Verify & Move to Done`, `Delete Project`) are disabled or hidden when the active role lacks permissions.
  2. Attempted unauthorized actions trigger a non-blocking toast warning citing the required privilege.
  3. Task and member queries strictly respect the selected project scope and squad boundaries.

---

### FR-03: Interactive Dependency Gantt Chart
- **Status:** ✅ Implemented (V2 Milestone 2)
- **Description:** Elevate the Waterfall view into a full interactive dependency Gantt chart with task-to-task relationship connectors, Critical Path highlighting, circular dependency cycle prevention, and schedule drift indicators.
- **Acceptance Criteria & Implemented Features:**
  1. Tasks support a `dependencies: string[]` array (pointing to predecessor task IDs), with live linking/unlinking in the Task Drawer and auto-linking in JSON Smart Import.
  2. Visual SVG connector lines and directional bezier arrows connect predecessor task finish dates to dependent successor start dates.
  3. **Critical Path Method (CPM):** Topological sorting identifies the zero-slack longest delivery sequence determining project completion; highlighted with glowing orange borders and CPM badges.
  4. **Schedule Drift Bars:** Dual-layer visualization renders a dashed baseline shadow underneath the forecast bar whenever `dueDate > baselineDueDate`.
  5. **Domino Delay Detection & 1-Click Cascade Alignment:** Live banner detects whenever an upstream deliverable completes after a downstream task's start date, offering a 1-click `⚡ Auto-Shift Dependent Dates` cascade shift tool.

---

### FR-04: Smart Developer Capacity Budget & Recovery Score
- **Status:** ✅ Implemented (V2 Milestone 1)
- **Description:** Prevent burnout and unrealistic sprint commitments by calculating developer capacity taking into account active task load, build failures, and rework penalties.
- **Capacity Formula:**
  $$\text{Effective Load} = \text{Active Story Points} + (\text{Reopened or Failed Builds} \times 3)$$
- **Acceptance Criteria:**
  1. Default Sprint Capacity Budget is configured per engineer (baseline: 15 Story Points).
  2. When assigning a task or viewing the sidebar workload list, engineers display live capacity status indicators:
     - **Optimal (`<= 10 pts`):** Green badge / indicator.
     - **Near Capacity (`11 - 15 pts`):** Amber badge / indicator.
     - **Over Budget / In Rework (`> 15 pts`):** Red warning badge with active penalty breakdown.
  3. The task assignment dropdown warns the user if assigning the task will breach the engineer's sprint budget.

---

### FR-05: Deadline Slippage & Grace Buffer Protocol
- **Status:** ✅ Implemented (V2 Milestone 1)
- **Description:** When an in-progress or deployed task cannot meet its original due date, team members can log a structured, 1-click slippage justification rather than silently editing dates.
- **Slip Reason Taxonomy:**
  - `DEPENDENCY_BLOCKED` (Waiting on external API, backend service, or upstream PR).
  - `SCOPE_EXPANDED` (Unforeseen edge cases or security requirements introduced).
  - `PRODUCTION_HOTFIX` (Diverted to resolve a high-severity live incident).
  - `UNDERESTIMATED` (Complex legacy code or model convergence delays).
- **Acceptance Criteria:**
  1. When extending a task's `dueDate` past its `baselineDueDate`, the drawer prompts for a mandatory **Slip Reason Tag** and an optional explanation.
  2. The slippage event is logged to the task history and project audit trail.
  3. The system adjusts next-sprint intake recommendations without applying punitive metrics.

---

### FR-06: Governance Console, Cycle-Time Analytics & Tamper-Proof Audit Trail
- **Status:** ✅ Implemented (V2 Milestone 3)
- **Description:** Maintain an enterprise-grade governance control center featuring live Squad RBAC policy calibration, cycle-time & bottleneck telemetry, and an append-only, filterable security audit trail with compliance export.
- **Acceptance Criteria & Implemented Features:**
  1. **Squad & RBAC Matrix View:** Interactive roster displaying all team members, Squads, Technical Roles, System Permission Tiers (`VIEWER`, `DEV`, `QA`, `LEAD`, `ADMIN`), and live Capacity Budget bars with rework penalty breakdowns. Allows `LEAD` / `ADMIN` sessions to modify system roles and sprint capacity allocations live with instant audit trail logging (`MEMBER_ROLE_UPDATED`), while `DEV` and `VIEWER` sessions operate in read-only mode.
  2. **Cycle-Time & Bottleneck Telemetry:** Executive metrics cards displaying Average Lead Sign-Off Wait Time (hours staged in `DEPLOYED` awaiting review), Rework Recovery Overhead points (+3 points per rejected build), and Total Drifted Deliverables. Includes comparative project failure rate bars (`RAG-CORE`, `EVAL-GW`, `PULSE-V1`) and visual root cause distribution of deadline slippage.
  3. **Immutable Security Audit Trail Ledger:** Chronological tamper-proof ledger with `"LOCKED · APPEND-ONLY"` compliance seal, real-time multi-dimensional filtering (by Actor, Action Type, or keyword), and 1-click **Export CSV** and **Export JSON** buttons for corporate compliance and SOC2 auditing.

---

### FR-07: Minimalist Multi-Screen Architecture & Approachable Microcopy
- **Status:** ✅ Implemented (V2 Milestone 4)
- **Description:** Refactor PulseBoard from a single-screen prototype into a clean, minimalist multi-screen Angular application using `@angular/router` with hash routing (`provideRouter(routes, withHashLocation())`) compatible with GitHub Pages `/pulseboard/` and dedicated standalone page components.
- **Dedicated Screen Routes:**
  1. `/login` -> `LoginComponent`: Centered Linear-style corporate entry with SSO and 1-click demo persona cards.
  2. `/my-day` -> `MyDayComponent`: Focused daily personal queue with greeting, workload pace bar, 1-click task progression, and review queues.
  3. `/workspace` -> `WorkspaceComponent`: Decluttered delivery space housing Kanban Board, Agile Sprint, and Key Path Gantt.
  4. `/projects` -> `ProjectsComponent`: Visual directory of all project workspaces, squad allocations, and completion health.
  5. `/governance` -> `GovernanceComponent`: Full-page governance suite with Team & Access, Delivery Bottlenecks, and Audit Trail tabs.
- **Approachable Microcopy Translations:**
  - `"Comfortable Pace"` (Optimal), `"Near Capacity"` (Near Limit), `"Overloaded · Fixing Failed Build"` (Over Budget with Rework penalties).
  - Critical Path rebranded as `"Key Path"`.
  - Baseline Drift rebranded as `"Schedule Shift"`.
  - Permission states rendered as calm status badges (e.g. `"Awaiting Lead Sign-Off"`).

---

### FR-08: Project-Scoped Visibility, Task Ownership Locks & Multi-Assignee Capacity Split
- **Status:** ✅ Implemented (V2 Milestone 5)
- **Description:** Enforce strict organizational data boundaries, preventing cross-project information leakage and accidental editing of peer deliverables, while enabling paired-programming and cross-functional squad ownership through multi-assignee story point distribution.
- **Key Capabilities:**
  1. **Project Scoped Visibility:**
     - `Project.memberIds: string[]` specifies assigned squad engineers for each project.
     - `DEV` and `QA` sessions strictly only see projects where they are explicit members (e.g., Abhishai sees `RAG-CORE` and `PULSE-V1`, but never `EVAL-GW`).
     - `LEAD`, `ADMIN`, and `VIEWER` (e.g., Sanjay Patel DM) retain portfolio-wide visibility (`canViewAllProjects`).
     - Workspace views, project tabs, My Day queues, and task searches automatically filter to `visibleProjects`.
  2. **Task Ownership Locks:**
     - `canEditTask(task)` rules:
       - `LEAD` / `ADMIN`: Unrestricted edit access.
       - `VIEWER`: Strictly read-only across all deliverables.
       - `DEV` / `QA`: Editable only if the active engineer is an explicit assignee in `task.assigneeIds` (or if unassigned).
       - If locked, title/priority/status/points/dates inputs and drag-and-drop actions are disabled, and a subtle badge (`🔒 Read-only · Teammate task`) is displayed. Teammates can still view details and append collaborative review/blocker notes.
  3. **Multi-Assignee (Co-Assignee) Support & Capacity Splitting:**
     - Tasks support `assigneeIds: string[]` for collaborative engineering deliverables.
     - Point allocation formula: For each co-assignee, points count toward `effectiveLoad` as $\lceil \text{effortPoints} / \text{assigneeCount} \rceil$.
     - Interactive multi-select pill selector in drawer with live capacity status dots.
     - Backwards compatibility with single `assigneeId` and JSON Smart Import (`assigneeNames: string[]` or `assigneeName: string`).

---

### FR-09: Jira + Linear Enterprise UI/UX Overhaul
- **Status:** ✅ Implemented (V2 Milestone 5)
- **Description:** Eliminate generic AI aesthetics (neon glow boxes, gradient headers, decorative sparkle emojis) in favor of a crisp, authoritative Jira + Linear product aesthetic.
- **Key Enhancements:**
  1. **Typography & Hairline Surfaces:** System font stack (`Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`), crisp 13px base body, 11px uppercase tracked labels, `tabular-nums`. Hairline 1px borders (`#dfe1e6` Light, `#262932` Dark).
  2. **Jira-Style Issue Cards:** Issue key chip (`PB-101`), subtle priority indicators, subtask completion fraction (`☑ 2/4`), and story point badges (`5p`).
  3. **Overlapping Stacked Avatars:** `.avatar-stack` and `.avatar-stack-item` pattern for multi-assignee task cards, sprint rows, and detail drawer.
  4. **Minimalist SVG Icon System:** Zero decorative emojis in core navigation and buttons; pure inline geometric SVG icons across navigation rail, view switchers, search bars, and action modals.

---

### FR-10: Kanso + Spartan UI + Phosphor Light Design System
- **Status:** ✅ Implemented (v3.0)
- **Description:** Transform PulseBoard into a timeless, calm editorial delivery system inspired by Japanese minimalism (Kanso), Spartan restraint, and tactile stationery ergonomics across all 8 screens.
- **Key Capabilities & Aesthetics:**
  1. **Dual-Theme Token Parity:**
     - Light Mode ("Alabaster & Sage"): Warm stationery paper `#F9F8F6`, elevated white card `#FFFFFF`, hairline divider `#EBE8E2`, and muted sage green `#5C7362`.
     - Dark Mode ("Sumi Ink & Moss"): Warm espresso-charcoal sumi ink `#141312`, elevated dark stone `#1C1B19`, hairline `#2A2825`, and soft moss-sage `#6E8B74`.
  2. **Editorial Typography Pairing:** Google Font `Newsreader` (weights 300–500, italic) for page greetings, headings, project titles, and the `PulseBoard.` brand wordmark, paired with `Plus Jakarta Sans` for controls and `JetBrains Mono` for tabular figures.
  3. **Phosphor Light Iconography:** Thin `1.5px`-equivalent `ph-light` hairline icons integrated across navigation, status indicators, action buttons, and drawers.
  4. **Pill-First Geometry & Open-Air Row Lists:** All buttons, filters, switchers, and role tags adopt pill geometry (`border-radius: var(--radius-pill)`). Multi-column and multi-row lists utilize open-air rows separated by hairline dividers rather than nested box frames.
  5. **Tactile Physics & Micro-Interactions (`cubic-bezier(0.22, 1, 0.36, 1)`):** Smooth `-1px` button hover lifts, border highlight shifting toward sage green on cards/rows, and stacked avatars that fan out on group hover.
  6. **Frosted Backdrops:** Task Drawer and Modals use translucent scrims with `backdrop-filter: blur(6px)` and tactile slide-in/scale-in animations.


---

### FR-11: Dedicated "Prompt with AI" Voice & NLP Task Composer
- **Status:** ✅ Implemented (v3.1)
- **Description:** A standalone voice dictation and natural language task composer dialog (`app-ai-prompt-modal`) triggered from the Delivery Workspace and My Day landing screen, preserving the existing JSON Smart Importer untouched while enabling fluid, hands-free task composition during standups and sprint planning.
- **Key Capabilities:**
  1. **Live Voice Dictation (Web Speech API):**
     - Continuous streaming speech recognition with interim transcript readout (`interimTranscript` signal).
     - Pulsing Terracotta recording pill button (`Start Voice Prompt` / `Stop Listening`).
     - Graceful, non-throwing degradation on unsupported browsers or denied microphone permissions.
  2. **Dual-Mode NLP Extraction Engine:**
     - **Mode 1: Local Deterministic NLP (Default):** Zero-backend offline regex and heuristics engine that extracts project codes, squad co-assignees, priority, story points, due dates, subtasks, and upstream dependencies.
     - **Mode 2: Corporate LLM Proxy:** Configurable internal corporate endpoint persisted in `localStorage` with automatic, resilient failover to the local deterministic NLP engine if offline.
  3. **Interactive Staging & Provenance Audit:**
     - Review & edit staged deliverables prior to committing to workspace.
     - Co-assignee toggles with real-time capacity budget comfort dots (`OPTIMAL`, `NEAR_CAPACITY`, `OVER_BUDGET`).
     - Ingested tasks automatically record an `[AI_EXTRACTED]` entry under `ActivityActionType = 'AI_PROMPT_EXTRACTION'` in the immutable compliance audit ledger.
  4. **Compound Multi-Task NLP Parsing & Title Cleaning (v3.1.1):**
     - Splits compound spoken/typed prompts on mid-sentence task boundaries (`,\s*(?:and\s+)?(?:also\s+)?(?:create\s+|add\s+)?(?:a|an|another)\s+...`) as well as sequential conjunctions.
     - Supports hyphenated and spaced story point formats (`/\b(\d+)\s*-?\s*(?:points?|pts?)\b/i`, e.g. "5-point" and "3 points").
     - Strips conversational boilerplate prefixes and trailing metadata/dependency clauses, outputting concise, actionable deliverable titles with proper capitalization (e.g., "Implement RBAC route guards and role middleware").
