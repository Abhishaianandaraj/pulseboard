# PulseBoard Agent Engineering & Documentation Rules

> **Status:** Active & Enforced  
> **Target Project:** PulseBoard (Commercial-Grade Delivery & Task Management System)  
> **Applies to:** All Autonomous AI Agents, Human Contributors, and Code Reviewers  

---

## 1. Core Engineering Directives

### Rule 1: Living Documentation Sync (Strict Gate)
Whenever any feature, data model, calculation metric, UI screen, or workflow is added, updated, or deprecated in `src/`, the agent **MUST** update the corresponding documentation files in `/docs` within the exact same pull request/task:
1. **Requirements & Scope Changes:** Update `docs/01-PRD.md` with new/updated functional requirement IDs (`FR-xx`), status badges, and acceptance criteria.
2. **Architecture, RBAC & Security Changes:** Update `docs/02-ARCHITECTURE-SECURITY.md` if any endpoint, proxy middleware, or RBAC permission matrix changes.
3. **Design System & CSS Tokens:** Update `docs/03-UI-DESIGN-SYSTEM.md` if UI color tokens, layout specifications, or screen definitions are updated.
4. **Data Models & Contracts:** Update `docs/04-API-DATA-CONTRACT.md` immediately whenever a TypeScript interface, DTO, JSON Smart Import schema, or future REST route changes.
5. **QA Test Checklist & Changelog:** Record changes in `docs/05-QA-AND-CHANGELOG.md` under the active version release log and append corresponding regression verification test cases.

> [!CAUTION]
> **No Code Without Docs:** An agent task that modifies application logic without synchronizing the living docs in the same commit is considered incomplete and failed.

---

### Rule 2: Modular Architecture & Dependency Discipline
1. **Directory Boundaries:**
   - `src/app/models/`: Pure TypeScript interfaces, DTOs, and enum types. Structure them 1-to-1 with database entities. No business logic.
   - `src/app/data/`: Static seed datasets (`seed-data.ts`) isolated for rapid prototyping, demo data resets, and future backend replacement.
   - `src/app/services/`: Pure Angular Signals state store (`signal`, `computed`, `effect`) managing state transitions, localStorage sync, and REST API mirror methods. No DOM manipulation.
   - `src/app/components/`: Self-contained standalone UI subcomponents (inline templates + scoped styles where appropriate).
   - `src/app/app.component.*`: Top-level application shell, navigation, global drawers, and view coordinators.
2. **Zero External UI Bloat:**
   - **Prohibited:** Material UI, Bootstrap, Tailwind CSS, PrimeNG, Ant Design, or unvetted npm icon packages.
   - **Allowed:** Pure modern CSS custom properties (variables), native HTML5, and `@angular/cdk` (drag-and-drop, overlays, portals, clipboard).
3. **Portability:**
   - Every feature must be executable in air-gapped or corporate enterprise networks without external CDN dependencies.

---

### Rule 3: Corporate Security, RBAC & Verification
1. **Zero-Trust Client Boundary:**
   - Client-side role checks (e.g., simulating `DEV`, `QA`, `LEAD`, `ADMIN`) are for UI gating and user experience only. Architectural blueprints must document and enforce server-side RBAC validation.
   - Never commit API keys, service tokens, or internal corporate domain secrets into source code or seed data.
2. **Input Sanitization:**
   - All JSON imports and user input strings must be strictly validated and sanitized before ingestion into Signals or local storage to prevent stored Cross-Site Scripting (XSS).
3. **Design System Parity:**
   - Every newly created component or layout MUST support both Light Mode (`:root`) and Dark Mode (`[data-theme="dark"]`) using semantic CSS custom properties. Hardcoded hex colors in component styles are strictly forbidden.
4. **Mandatory Production Build Verification:**
   - After any modification in `src/`, the agent MUST run:
     ```powershell
     npx ng build --configuration production --base-href=/pulseboard/
     ```
   - The build must exit with code `0` and **zero** budget warnings or TypeScript compilation errors before handing off the task.

---

## 2. Code Conventions & Standards

| Layer | Standard |
|---|---|
| **Framework** | Angular v18+ Standalone Components (No `NgModule`) |
| **Reactivity** | Angular Signals (`signal`, `computed`, `effect`), RxJS only for complex async streams |
| **Typing** | Strict TypeScript (`noImplicitAny: true`, strict null checks). No `any` without documented architectural exceptions |
| **Styling** | Semantic CSS Variables, BEM-like class naming, responsive flex/grid layouts |
| **Typography** | `Inter`, system-ui, with `tabular-nums` for timestamps, IDs, story points, and metrics |

---

## 3. Pull Request & Commit Checklist

- [ ] Code strictly follows directory boundaries (`models`, `data`, `services`, `components`).
- [ ] No external UI component libraries introduced.
- [ ] Light mode and Dark mode tokens tested and verified.
- [ ] Living documentation synchronized (`01-PRD.md`, `04-API-DATA-CONTRACT.md`, `05-QA-AND-CHANGELOG.md`).
- [ ] `npx ng build --configuration production --base-href=/pulseboard/` executed with 0 errors.
