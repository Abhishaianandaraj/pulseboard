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
- **Status:** ⏳ Scheduled (V2 Milestone 2)
- **Description:** Elevate the Waterfall view into a full interactive dependency Gantt chart with task-to-task relationship connectors, Critical Path highlighting, and schedule drift indicators.
- **Acceptance Criteria:**
  1. Tasks support a `dependencies: string[]` array (pointing to predecessor task IDs).
  2. Visual connector lines/arrows connect predecessor tasks to dependent successor tasks.
  3. **Critical Path Calculation:** Tasks on the longest dependent chain determining the project release deadline are highlighted with a distinct high-visibility border/glow.
  4. **Schedule Drift Bars:** If a task's `dueDate` exceeds its `baselineDueDate`, the UI renders a dual-layer bar showing the original baseline schedule versus the drifted actual forecast.

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

### FR-06: Tamper-Proof Activity & Security Audit Trail
- **Status:** 🔄 Active Baseline / Enhanced in Milestone 2
- **Description:** Maintain an append-only, structured audit log of all critical workspace activities for compliance, security reviews, and retrospective analysis.
- **Acceptance Criteria:**
  1. Every task status shift, server deployment, verification note, project creation, and member role update records an immutable `ActivityLog` entry.
  2. Log entries record timestamp (ISO 8601), actor ID, actor role, IP/session simulator token, action type, and JSON change delta.
  3. Audit log drawer provides real-time search, filter by project, filter by actor, and 1-click JSON export for compliance archives.
