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
- [x] **Modal Visual Hierarchy & Alignment Gate:** `STEP 1` and `STEP 2` badges render non-wrapping pill geometry (`white-space: nowrap; flex-shrink: 0; padding: 3px 10px; border-radius: 9999px;`). Auto-Squad Onboarding badge and primary CTA button (`Import to Workspace`) stay strictly on single horizontal lines with crisp disabled/enabled contrast. Decorative sparkles replaced with clean Phosphor Light code icon (`ph-file-code`).

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

### 1.9 Kanso + Spartan UI + Phosphor Light Gate (v3.0)
- [x] **Alabaster & Sage (Light Mode) Token Parity:** Canvas renders `#F9F8F6` warm stationery paper with `#FFFFFF` pure card surfaces, `#EBE8E2` hairline stationery dividers, and `#5C7362` muted sage green accents across all 8 screens.
- [x] **Sumi Ink & Moss (Dark Mode) Token Parity:** Canvas renders `#141312` espresso-charcoal sumi ink with `#1C1B19` elevated dark stone cards, `#2A2825` hairline dividers, and `#6E8B74` soft moss-sage accents across all 8 screens.
- [x] **Typography & Editorial Pairing:** Page greetings, titles, and wordmark (`PulseBoard.`) render Google Font `Newsreader` (weights 300–500, italic), paired with `Plus Jakarta Sans` for controls and `JetBrains Mono` with `tabular-nums` for points and dates.
- [x] **Phosphor Light Icon Integration:** All navigation items, buttons, status indicators, lock badges, and drawer actions utilize thin `1.5px`-equivalent `@phosphor-icons/web` (`ph-light`) icons with zero bundle bloat.
- [x] **Pill-First Geometry:** Buttons, filter chips, view switchers (`Board`, `Sprint`, `Gantt`), role tags, and sidebar items render rounded pill geometry (`border-radius: var(--radius-pill)`).
- [x] **Open-Air Surfaces:** Cards and table rows render inside unified soft paper containers with hairline dividers rather than nested box-in-box frames.
- [x] **Tactile Hover Physics:** Buttons lift `-1px` on hover with `scale(0.98)` active press feedback; task cards shift border-color toward sage green; stacked avatars fan out (`margin-left: 2px`) on group hover.
- [x] **Frosted Glass Backdrops:** Modals and Task Drawer utilize `backdrop-filter: blur(6px)` with smooth slide-in/scale-in animations.

---

### 1.10 Prompt with AI & Voice Dictation Quality Gate (v3.1)
- [x] **Live Speech Recognition Integration:** `Web Speech API` starts and stops cleanly via pulsing microphone toggle; interim transcripts display in real time without crashing on unsupported browsers.
- [x] **Dual-Mode NLP Parsing:** Deterministic local parser reliably extracts project codes (`RAG-CORE`, `EVAL-GW`, `PULSE-V1`), co-assignees, priority, story points, due dates, subtasks, and upstream dependencies. Corporate LLM mode handles offline scenarios with seamless automatic fallback to local NLP.
- [x] **Compound Multi-Task Clause Splitting (v3.1.1):** Accurately splits compound sentences with mid-sentence boundaries (`,\s*and\s+(?:also\s+)?(?:create\s+|add\s+)?(?:a|an|another)...`) into distinct task drafts.
- [x] **Hyphenated Points & Clean Title Extraction (v3.1.1):** Parses both `5-point` and `5 points`, extracts clean action titles (stripping conversational boilerplate), and capitalizes deliverable names.
- [x] **Staging & Editing Quality Gate:** Users can edit deliverable titles, projects, co-assignees (with live capacity status indicators), points, and priorities before committing.
- [x] **Immutable Provenance Audit:** Committing deliverables created via the AI prompt composer logs an `AI_PROMPT_EXTRACTION` activity record tagged with `[AI_EXTRACTED]` in the activity ledger.
- [x] **RBAC Gate:** `VIEWER` persona cannot open or commit tasks via `Prompt with AI`.

---

### 1.11 Sharing & Permissions Window & Scoped Activity Logs Gate (v3.2)
- [x] **Modal Trigger Verification:** Clicking `Share` pill in the top header or `Share` on any project card in `/projects` opens `app-share-permissions-modal` with project preselection.
- [x] **Project Squad Access Controls:** 1-click toggle switches grant or revoke squad membership (`Member` vs `No Access`). Non-lead sessions have toggles disabled with tooltip explanation.
- [x] **Link Sharing:** "Copy Workspace Link" copies formatted deep-link with instantaneous `"Link Copied!"` visual feedback.
- [x] **Role Capabilities & Visibility Matrix:** Toggling capabilities across `DEV`, `QA`, `LEAD`, `VIEWER`, and `ADMIN` dynamically updates `store.rolePolicies()`, persisted in `localStorage` (`pulseboard_permissions_v1`).
- [x] **Task Creation Gating:** Restricting task creation immediately disables `+ New Task`, `Prompt with AI`, and `Smart Import` in the Delivery Workspace and My Day landing screen.
- [x] **Personal vs. Full Portfolio Audit Scoping:**
  - `DEV` and `QA` sessions only see events where they are actor or task assignee.
  - `LEAD`, `VIEWER`, and `ADMIN` sessions see all events across visible projects.
  - Both Recent Project Pulse (`MyDayComponent`) and the Governance Audit Ledger (`GovernanceComponent`) render calm Kanso scope pill banners indicating active view mode.
- [x] **Compliance Export Scoping:** CSV and JSON exports evaluate `store.visibleActivityLogs()` directly, preventing unauthorized data exfiltration.
- [x] **Audit Event Provenance:** Membership and capability changes emit `SHARING_UPDATED` and `PERMISSION_POLICY_UPDATED` events with actor ID attribution.

---

### 1.12 Vertical Scrolling & Unclipped Log Lists Gate (v3.2.1)
- [x] **Global Shell Scroll Parity:** The sidebar rail (`.nav-rail`) stays pinned with `position: sticky; top: 0; height: 100vh;` while the main workspace pane (`.shell-content`) scrolls smoothly without trapping child views inside `overflow: hidden`.
- [x] **Sticky Shell Top Bar:** The top bar (`.shell-top-bar`) remains anchored at `top: 0` with proper z-index and border divider as content scrolls beneath.
- [x] **Governance Audit Ledger Scroller:** The audit table container (`.gov-table-container`) scrolls vertically up to `62vh` with thin custom scrollbars (`custom-scroll`) and sticky `thead th` column headers.
- [x] **My Day Recent Project Pulse Feed:** The feed renders all visible activity logs without artificial 8-item cutoffs, bounded at `max-height: 62vh; overflow-y: auto;` with 24px inner item breathing room.
- [x] **Bottom Breathing Room (48px):** All page wrappers (`.my-day-wrapper`, `.gov-page-wrapper`, `.projects-page-wrapper`, `.workspace-viewport`) enforce `padding-bottom: 48px`, guaranteeing that all rows and cards are comfortably visible.

---

### 1.13 Relatable AI Engineering Seed Data & Demo Prompts Gate (v3.2.2)
- [x] **Everyday AI & UI Tasks:** Verified 6-7 clear, relatable engineering tasks (e.g., chat UI green button theming, PDF upload & chunking, feedback thumbs-up/down widget, HR policy QA evaluation, and responsive layout polish) with crystal-clear subtasks.
- [x] **Complex Flagship Governance Tasks:** Retained 2-3 multi-assignee tasks with upstream dependencies, 5-8 effort points, schedule drift, and tech lead verification reviews (e.g., Qdrant vector database setup, SSO authentication bridge, and SQL function calling gateway).
- [x] **Integrity & Referential Consistency:** All task IDs (`PB-101` to `PB-109`), squad assignments, assignee arrays, upstream dependencies, and audit log entries remain strictly valid and synchronized.
- [x] **Live Demo Sample Prompts:** "Try Sample Standup Prompt" in `AiPromptModalComponent` and "Load Sample Delivery JSON" in `ImportModalComponent` parse cleanly into approachable AI deliverables during live walkthroughs.

---

### 1.14 Simplified Delivery Roadmap (Timeline) View Gate (v3.3.0)
- [x] **Timeline Tab Label & Icon:** The workspace view switcher tab has been renamed from `Gantt` to `Timeline` with the crisp Phosphor Light icon `<i class="ph-light ph-chart-line-up"></i>`, keeping internal `store.currentView() === 'TIMELINE'` state intact.
- [x] **Scannable Control & Legend Strip:** The top toolbar features 3 plain-English status legend pills (`Completed / Deployed` in Sage `#5C7362`, `In Progress` in Ochre `#C59B4E`, and `Blocked / Delayed` in Terracotta `#C86D51`), deliverable count pill, and an interactive 1-click **`Blocked Only`** filter toggle pill.
- [x] **Breathable 4-Week Columns:** Dense day-by-day grids are replaced by 4 wide weekly columns (`Week 1 · Nov 10 - Nov 16` through `Week 4 · Dec 01 - Dec 07`) with subtle `1px solid var(--border-hairline)` dividers.
- [x] **Vertical "Today" Line & Tag:** A vertical dashed 2px line in Sage green (`var(--accent-primary)`) is rendered at Day 12 (Nov 22, 42.86%) with a crisp `Today` tag pill in the header.
- [x] **Self-Explanatory Deliverables Left Column (340px):** Rows display issue key (`PB-101`), project badge, status pill, deliverable title, and upstream dependency chip (`After PB-101`) with right-aligned effort points (`5p`).
- [x] **Rounded Pill Duration Bars:** Smooth horizontal pill bars (`border-radius: 9999px`) styled dynamically by status (Sage, Ochre, Terracotta, Neutral Stone) with co-assignee avatar stacks and concise status + effort text (`In Progress · 5 pts`).
- [x] **Zero-Clutter Hover-Only Dependency Connectors:** Resting view displays zero spiderweb lines. On row or bar hover, draws a smooth cubic bezier curve (`M x1 y1 C ... x2 y2`) with directional arrowhead connecting upstream and downstream deliverables, while highlighting connected rows.
- [x] **Theme Parity & Production Build:** Verified across both Light ("Alabaster & Sage") and Dark ("Sumi Ink & Moss") themes; `npx ng build --configuration production --base-href=/pulseboard/` exits with code `0`.

---

## 2. Release Changelog

### `v3.3.0` (Simplified Delivery Roadmap & Hover-Only Dependency Connectors)
- **Delivery Roadmap (`Timeline`) Navigation & Aesthetic Overhaul:**
  - Renamed third workspace view tab from `Gantt` to `Timeline` (`<i class="ph-light ph-chart-line-up"></i>`).
  - Added scannable top control strip with 3 status indicators (`Completed / Deployed` in Sage, `In Progress` in Ochre, and `Blocked / Delayed` in Terracotta).
  - Added interactive **`Blocked Only`** pill toggle with active tag indicator, enabling 1-click executive isolation of delayed or blocked deliverables.
  - Added compact auto-shift trigger (`Auto-Shift Dates`) when prerequisite domino conflicts exist.
- **Breathable 4-Week Columns & Vertical Today Marker:**
  - Replaced dense 30-day day-by-day grid with 4 breathable weekly sprint columns (`Week 1 · Nov 10 - Nov 16` through `Week 4 · Dec 01 - Dec 07`).
  - Added vertical dashed "Today" line at Day 12 (42.86%) with anchored `Today` pill tag in the track header.
- **Self-Explanatory Deliverables & Dependencies Column (340px):**
  - Displays deliverable issue key (`PB-101`), project badge, status badge (`Completed`, `In Progress`, `Blocked`, `To Do`), truncated deliverable title, and upstream dependency chip (`After PB-101`).
- **Rounded Pill Duration Bars:**
  - Smooth horizontal pill bars (`border-radius: 9999px`) colored by delivery status (Sage green, Ochre amber, Terracotta red, Neutral stone).
  - Stacked circular co-assignee avatars on the left followed by status and story points (`In Progress · 5 pts`).
  - Clicking any row or bar opens the deliverable inspection drawer (`TaskDrawerComponent`).
- **Hover-Only Curved SVG Dependency Connectors:**
  - Zero crossing lines at rest for a clean, editorial look.
  - Reactive `hoveredTaskId` signal: hovering over any deliverable isolates connected upstream and downstream tasks, drawing smooth cubic bezier curves (`M x1 y1 C ... x2 y2`) with directional SVG arrowheads, while softly highlighting connected rows.
- **Clear Everyday AI & UI Seed Deliverables:**
  - Updated `INITIAL_TASKS` in `src/app/data/seed-data.ts` with relatable real-world AI engineering tasks:
    * `PB-101`: "Set up vector database index and embedding endpoint" (8 pts, DEPLOYED, Priya Nair)
    * `PB-102`: "Connect RAG retrieval API to internal SSO authentication" (5 pts, IN_PROGRESS, Co-assigned: Abhishai + Priya Nair, BLOCKED, rework=1)
    * `PB-103`: "Build AI function calling gateway for SQL and search tools" (5 pts, DEPLOYED, Co-assigned: Rahul Verma + Karthik R)
    * `PB-104`: "Test RAG answers on 20 sample HR policy questions" (5 pts, IN_PROGRESS, Karthik R)
    * `PB-105`: "Update chat UI button theme from blue to green" (5 pts, DONE, Abhishai)
    * `PB-106`: "Add PDF upload and text chunking for RAG pipeline" (3 pts, TODO, Priya Nair, depends on PB-102)
    * `PB-107`: "Build prompt response feedback thumbs-up/down widget" (5 pts, TODO, Rahul Verma, depends on PB-104)
    * `PB-108`: "Build interactive Gantt timeline with dependency arrows" (5 pts, IN_PROGRESS, Co-assigned: Abhishai + Priya Nair, depends on PB-105)
    * `PB-109`: "Fix sidebar alignment and mobile spacing on My Day" (3 pts, TODO, Vikram Rao, depends on PB-108)
- **Synchronized Activity Audit Trail:** Updated `INITIAL_LOGS` entries with matching deliverable titles and descriptions.
- **Relatable Standup Prompts & Sample Import JSON:**
  - Updated `loadSampleStandupPrompt()` in `AiPromptModalComponent` to natural multi-task clause: *"Assign Abhishai and Priya to connect the RAG search API with SSO login for RAG-CORE, high priority, 5 points. Also assign Karthik to test 20 sample Q&A prompts for EVAL-GW, 2 points."*
  - Updated `SAMPLE_IMPORT_JSON` in `seed-data.ts` and textarea placeholder in `ImportModalComponent` with clear streaming response, prompt injection testing, and Markdown export tasks.
- **Automated Client Schema Hydration:** Bumped local storage keys to `pulseboard_v2_*` to automatically load fresh seed data without requiring a manual workspace reset.

### `v3.2.1` (App Shell Scroll Layout & Unclipped Activity Feeds)
- **Global Shell Vertical Scrolling Architecture:**
  - Updated `.pulse-shell` to `min-height: 100vh; width: 100vw;`.
  - Pinned `.nav-rail` at `position: sticky; top: 0; height: 100vh; flex-shrink: 0;`.
  - Set `.shell-content` to `height: 100vh; min-height: 0; overflow-y: auto; overflow-x: hidden;` with `custom-scroll` class.
  - Pinned `.shell-top-bar` at `position: sticky; top: 0; z-index: 20; flex-shrink: 0;`.
- **Unclipped Governance Audit Ledger & My Day Pulse Feed:**
  - Bounded Governance Audit Ledger table container (`.gov-table-container`) to `max-height: 62vh; overflow-y: auto; overflow-x: auto;` with sticky table headers (`thead th`).
  - Upgraded Recent Project Pulse in `MyDayComponent` (`.activity-feed-list`) to `max-height: 62vh; overflow-y: auto; padding-right: 4px;` and updated `recentLogs` to render all `visibleActivityLogs()` without a premature 8-item cutoff.
  - Enforced `padding-bottom: 48px` across `.my-day-wrapper`, `.gov-page-wrapper`, `.projects-page-wrapper`, and `.workspace-viewport` for bottom breathing room.
- **Scrollbar Styling:** Enhanced `.custom-scroll` in `src/styles.css` with Firefox `scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent;` alongside WebKit rules.

### `v3.2.0` (Sharing & Permissions Window, Granular Role Capabilities & Scoped Activity Logs)
- **Standalone "Share & Permissions" Window (`SharePermissionsModalComponent`):**
  - Designed with frosted backdrop (`backdrop-filter: blur(8px)`), 16px radius, Newsreader header `"Share & Permissions."`, and dual-theme styling.
  - Section 1: Project Squad Access with target project selector, 1-click member toggle switches (`Member` vs `No Access`), and "Copy Workspace Link" pill button with "Link Copied!" feedback.
  - Section 2: Role Capabilities & Audit Visibility Matrix table for `DEV`, `QA`, `LEAD`, `VIEWER`, and `ADMIN` with interactive toggles for Create Deliverables, View All Logs, and Approve Sign-Off (read-only for non-management personas).
- **Dynamic Role Capability Policy Matrix (`TaskStoreService`):**
  - Added `RolePermissionPolicy` interface and `rolePolicies` signal, persisted in `localStorage` (`pulseboard_permissions_v1`).
  - Added computed signals: `canCurrentUserCreateTasks`, `canCurrentUserViewAllLogs`, `canCurrentUserManageSharing`, and `canCurrentUserApproveSignOff`.
  - Added mutations `toggleProjectMember(projectId, memberId)` and `updateRolePermissionPolicy(role, patch)` with immutable audit event logging.
- **Dynamic Audit Log Scoping (Personal vs Full Portfolio):**
  - Implemented `visibleActivityLogs` computed signal: full portfolio view for `LEAD`, `VIEWER`, and `ADMIN`; strictly personal event view for `DEV` and `QA`.
  - Scoped CSV and JSON compliance exports to `visibleActivityLogs()`.
  - Added calm Kanso scope notification pill banners in Recent Project Pulse (`MyDayComponent`) and the Governance Audit Ledger (`GovernanceComponent`).
- **Global Header & Card Integration:**
  - Added `Share` pill button in top header bar (`AppComponent`) alongside project selector pills.
  - Added `Share` button on project cards (`ProjectsComponent`).
  - Enforced creation restriction states across `New Task`, `Prompt with AI`, and `Smart Import` buttons.

### `v3.1.1` (Compound Multi-Task NLP Splitting & Clean Title Extraction)
- **Mid-Sentence Task Boundary Splitting:** Upgraded `AiCopilotService.extractViaLocalNlp` with a multi-clause splitter that detects compound tasks separated by commas, conjunctions, and task creation verbs (`,\s*(?:and\s+)?(?:also\s+)?(?:create\s+|add\s+)?(?:a|an|another)\s+...`).
- **Hyphenated Story Points Parsing:** Enhanced story points matcher to support `/\b(\d+)\s*-?\s*(?:points?|pts?)\b/i`, handling `5-point`, `3-point`, `5 points`, and `3pts` interchangeably.
- **Actionable Deliverable Title Sanitization:** Added `cleanDeliverableTitle` to strip conversational prefixes (e.g., `Create an urgent 5-point task in PULSE-V1 for Abhishai to...`), trailing dependency clauses (`blocked by...`, `depends on...`), and metadata, outputting crisp, capitalized deliverable titles.

### `v3.1.0` (Prompt with AI Voice & NLP Task Composer)
- **Standalone "Prompt with AI" Modal (`AiPromptModalComponent`):**
  - Added dedicated voice & NLP composer dialog accessible via `Prompt with AI` pill button in the Delivery Workspace and My Day landing screen.
  - Leaves the existing `Smart Import` JSON schema importer untouched as an independent tool.
- **AI Copilot Service (`AiCopilotService`):**
  - Integrated `Web Speech API` live dictation with streaming interim transcript banner and pulsating recording indicator.
  - Built zero-backend deterministic NLP parser with multi-assignee detection, project mapping, priority extraction, story points parsing, and upstream dependency linking.
  - Added optional Corporate LLM proxy endpoint support persisted in `localStorage` with resilient offline failover.
- **Interactive Staging & Provenance Logging:**
  - Interactive pre-commit review grid with co-assignee capacity comfort dots (`OPTIMAL`, `NEAR_CAPACITY`, `OVER_BUDGET`).
  - Added `AI_PROMPT_EXTRACTION` action type and `createTasksFromAiDrafts` in `TaskStoreService` tagging all created deliverables with `[AI_EXTRACTED]` in the immutable audit ledger.

### `v3.0.0` (Production Release)
- **Kanso + Spartan UI + Phosphor Light Aesthetic Overhaul:**
  - **Dual-Theme Design System:** Replaced generic SaaS blues and harsh black backgrounds with warm "Alabaster & Sage" Light theme (`#F9F8F6` paper, `#5C7362` sage) and "Sumi Ink & Moss" Dark theme (`#141312` espresso charcoal, `#6E8B74` moss).
  - **Editorial Typography:** Added Google Font `Newsreader` for editorial page headings, greetings, project titles, and the `PulseBoard.` brand wordmark, paired with `Plus Jakarta Sans` for crisp UI controls.
  - **Phosphor Light Iconography:** Deployed `@phosphor-icons/web` across all 8 screens, providing thin `1.5px`-equivalent hairline icons for all navigation, actions, status pills, and drawers.
  - **Pill-First Geometry & Open-Air Surfaces:** Converted action buttons, view switchers, filter chips, and role tags to pill geometry (`border-radius: var(--radius-pill)`). Replaced boxy nested cards with open-air row lists separated by 1px warm stationery dividers.
  - **Tactile Hover Physics (`cubic-bezier(0.22, 1, 0.36, 1)`):** Added smooth `-1px` button hover lifts, subtle border highlights, and interactive avatar fan-out on group hover.
  - **Screen-by-Screen Polishing:** Overhauled all 8 screens: Login (`/login`), My Day (`/my-day`), Delivery Workspace (`/workspace`), Projects & Squads (`/projects`), Governance & Audit (`/governance`), Task Drawer, Smart Import Modal, and Create Modals.
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
