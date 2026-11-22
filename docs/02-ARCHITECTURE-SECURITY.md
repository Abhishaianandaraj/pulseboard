# System Architecture & Security Blueprint — PulseBoard

**Document Version:** 2.0.0  
**Status:** Approved Architectural Standard  
**Classification:** Internal Engineering & SecOps Blueprint  

---

## 1. High-Level System Architecture

PulseBoard follows a decoupled, secure client-to-backend model engineered for enterprise intranet deployment, virtual private clouds (VPC), or air-gapped staging servers.

```
+-----------------------------------------------------------------------------------------+
|                                    CLIENT TIER                                          |
|                                                                                         |
|   +---------------------------------------------------------------------------------+   |
|   |                       Angular v18+ Standalone SPA                               |   |
|   |  - Signal State Store (task-store.service.ts)                                   |   |
|   |  - Tri-Methodology Views (Kanban CDK, Agile Sprint, Waterfall Gantt)            |   |
|   |  - Client RBAC Guard & Role Simulator                                          |   |
|   |  - Pure Modern CSS Variable Design System (Light/Dark Engine)                   |   |
|   +---------------------------------------------------------------------------------+   |
+--------------------------------------------|--------------------------------------------+
                                             | HTTPS / WSS (Bearer JWT / Session Token)
                                             v
+-----------------------------------------------------------------------------------------+
|                                  SECURITY & EDGE TIER                                   |
|                                                                                         |
|   +---------------------------------------------------------------------------------+   |
|   |                           Internal Reverse Proxy                                |   |
|   |  - TLS 1.3 Termination, Host Header Validation, HSTS                            |   |
|   |  - Rate Limiting (120 req/min per IP, 30 req/min for AI ingestion)              |   |
|   |  - WAF / Payload Inspection (Max 2MB per JSON payload)                          |   |
|   +---------------------------------------------------------------------------------+   |
|                                            |
|                                            v
|   +---------------------------------------------------------------------------------+   |
|   |                       RBAC Policy Enforcement Middleware                        |   |
|   |  - Microsoft Entra ID / Corporate IdP JWT Signature Verification                |   |
|   |  - Claims Extraction: user_id, tenant_id, squad, corporate_role                 |   |
|   |  - Project-Level Multi-Tenancy Scoping Enforcement                              |   |
|   +---------------------------------------------------------------------------------+   |
+--------------------------------------------|--------------------------------------------+
                                             | Authorized Context
                                             v
+-----------------------------------------------------------------------------------------+
|                                   APPLICATION SERVICES                                  |
|                                                                                         |
|   +-----------------------------------+     +---------------------------------------+   |
|   |          Core Task API            |     |        Safe AI Ingestion Service      |   |
|   |  - Task CRUD & State Machines     |     |  - JSON Schema Validator (Ajv/Zod)    |   |
|   |  - Sprint Capacity & Penalties    |     |  - Stored-XSS Sanitizer (DOMPurify)   |   |
|   |  - Gantt & Critical Path Engine   |     |  - Dynamic Member Auto-Registrar      |   |
|   |  - Server Deployment Verifier     |     |  - LLM Prompt Template Orchestrator   |   |
|   +-----------------------------------+     +---------------------------------------+   |
|                     |                                           |                       |
|                     +---------------------+---------------------+                       |
|                                           | Append-Only Audit Stream                    |
|                                           v                                             |
|                     +-------------------------------------------+                       |
|                     |       Immutable Security Audit Service    |                       |
|                     +-------------------------------------------+                       |
+-------------------------------------------|---------------------------------------------+
                                            | Connection Pool (TLS encrypted)
                                            v
+-----------------------------------------------------------------------------------------+
|                                    PERSISTENCE TIER                                     |
|                                                                                         |
|   +---------------------------------------------------------------------------------+   |
|   |                     Relational SQL Database (PostgreSQL 16+)                    |   |
|   |  - Normalized Schemas: projects, team_members, tasks, subtasks, review_notes    |   |
|   |  - Row-Level Security (RLS) on project_id                                       |   |
|   |  - Soft-delete retention (is_archived = true)                                   |   |
|   |  - Append-only partitioned table: activity_logs_partitioned                     |   |
|   +---------------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Zero-Trust Internal Network Posture

A common fallacy in enterprise engineering is that applications hosted on private company networks or VPNs do not need rigorous application-layer security. PulseBoard operates strictly under the **Zero-Trust Model** ("Never Trust, Always Verify"):

### 2.1 Server-Side RBAC Enforcement
- While the Angular frontend hides or disables controls for unauthorized roles to maintain a clean UI, the API tier independently validates every incoming request against the user's authenticated role and project membership.
- Client-supplied IDs (`userId`, `role`) cannot override verified JWT claims.

### 2.2 Mandatory Project-ID Query Scoping
- All database queries, mutation mutations, and cache lookups must strictly append `WHERE project_id = :active_project_id` (or utilize PostgreSQL Row-Level Security).
- Cross-project data leakage via ID parameter tampering (`IDOR` — Insecure Direct Object References) is strictly prevented.

### 2.3 Stored-XSS Sanitization on JSON Imports
- Smart JSON Import accepts large unstructured markdown and task descriptions generated by external LLMs (e.g., Google Gemini, Anthropic Claude, OpenAI).
- All input strings must pass through strict schema validation and HTML entity escaping/sanitization (`DOMPurify` or server-equivalent sanitizer) before being rendered or persisted. Raw HTML injection inside task descriptions or subtasks is blocked.

### 2.4 Soft Deletes with Audit Integrity
- Tasks, projects, and comments are never physically deleted (`DROP` / `DELETE FROM`) in production.
- Deletions update `is_archived = true` with a corresponding `archived_at` and `archived_by_id` entry, preserving the historical integrity of sprint metrics and timeline calculations.

### 2.5 Append-Only Audit Logging
- Audit logs are written to an immutable, append-only log store.
- No user role (including `ADMIN`) possesses the API privilege to edit or retroactively delete historical audit log rows.

---

## 3. RBAC Permission Matrix

PulseBoard implements a granular role-based authorization model across 5 enterprise roles:

| Capability / Action | VIEWER | DEV | QA | LEAD | ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|
| **View Boards, Sprints & Timelines** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **View Lead Radar KPIs & Workload** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Export Tasks (JSON/CSV)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Create New Tasks** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Edit Assigned Task Details** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Edit Unassigned / Peer Tasks** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Move Tasks to `IN_PROGRESS`** | ❌ | ✅ | ❌ | ✅ | ✅ |
| **Move Tasks to `DEPLOYED` (Staging)** | ❌ | ✅ | ❌ | ✅ | ✅ |
| **Flag / Unflag Task Blocker** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Append QA Verification Note** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Move Tasks to `DONE` (Acceptance)** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Reopen Tasks (`DEPLOYED` -> `IN_PROGRESS`)** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Log Deadline Slippage Justification** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Batch Smart JSON Import** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Manage Sprint Capacity Budgets** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Add / Edit Team Members & Roles** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Create / Archive Projects** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **System Settings & Log Archival** | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 4. Authentication & Identity Flow

1. **Enterprise Mode (Production):**
   - The user navigates to PulseBoard.
   - SPA checks session token via MSAL Angular wrapper against Microsoft Entra ID.
   - Upon successful corporate login, Entra returns an ID token containing corporate claims (`oid`, `email`, `roles`, `groups`).
   - PulseBoard maps corporate group claims to one of the 5 internal roles (`VIEWER`, `DEV`, `QA`, `LEAD`, `ADMIN`).

2. **Simulation / Demo Mode (Staging & Offline Workspaces):**
   - In environments where corporate IdP connectivity is unavailable (e.g., local developer laptops or air-gapped demo sandboxes), the `RoleSimulatorService` provides an in-memory session profile switcher.
   - Switching the role triggers an instant Signal emission, updating all UI action states dynamically without requiring a mock OAuth callback.


---

## 5. AI Copilot, Web Speech API & NLP Security Architecture

### 5.1 Client-Side Web Speech Dictation
- Uses the standard browser `Web Speech API` (`window.SpeechRecognition` / `window.webkitSpeechRecognition`).
- Operates with `continuous = true` and `interimResults = true` in streaming mode.
- Does not transmit continuous raw audio streams to untrusted remote third parties; audio transcription is performed locally by the browser engine or corporate speech proxy.
- Permission states (`not-allowed`, `service-not-allowed`) fail gracefully without throwing unhandled exceptions, alerting the user through a non-intrusive alert pill.

### 5.2 Dual-Mode NLP Engine & Corporate LLM Fallback
- **Mode 1 (Local Deterministic NLP):** Operates 100% in-browser using compiled regular expressions, token boundary matching, and dictionary lookups against active project codes (`RAG-CORE`, `EVAL-GW`, `PULSE-V1`) and squad members. Zero external HTTP requests are made.
- **Mode 2 (Corporate LLM Proxy):** When configured, requests are sent via standard HTTPS `fetch` with an abort controller timeout (6000ms). If the corporate endpoint returns a non-200 code or network failure occurs, the copilot automatically falls back to Local Deterministic NLP without interrupting the user.

### 5.3 Text Sanitization & Injection Defense
- All natural language prompt inputs (voice transcript or typed text) pass through strict input sanitization:
  - Strips HTML `<script>` and malicious DOM elements: `text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<[^>]+>/g, '')`.
  - Strips invisible Unicode control characters (`\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F`).
- Extracted deliverables undergo user staging validation before being committed to the reactive state store.
- Deliverables created via the AI Copilot are tagged with `AI_PROMPT_EXTRACTION` in the append-only `ActivityLog`.


---

## 6. Granular Capability Policies & Scoped Audit Log Visibility (FR-12)

### 6.1 Role Capability Policy Matrix (`RolePermissionPolicy`)
PulseBoard features a dynamic capability policy engine defined in `task.model.ts` and managed in `TaskStoreService`:

```ts
export interface RolePermissionPolicy {
  role: SystemRole;
  canCreateTasks: boolean;
  canViewAllLogs: boolean;
  canApproveSignOff: boolean;
  canManageSharing: boolean;
}
```

Default capability policies persisted in `localStorage` under `pulseboard_permissions_v1`:
| System Role | Create Tasks | View All Logs | Approve Sign-Off | Manage Sharing & Squads |
|---|---|---|---|---|
| **ADMIN** | ✅ `true` | ✅ `true` | ✅ `true` | ✅ `true` |
| **LEAD** | ✅ `true` | ✅ `true` | ✅ `true` | ✅ `true` |
| **VIEWER** (Delivery Manager) | ❌ `false` | ✅ `true` | ❌ `false` | ✅ `true` |
| **DEV** | ✅ `true` | ❌ `false` | ❌ `false` | ❌ `false` |
| **QA** | ✅ `true` | ❌ `false` | ❌ `false` | ❌ `false` |

### 6.2 Scoped Audit Visibility Architecture
1. **Computed Signal Isolation (`visibleActivityLogs`):**
   - When `canCurrentUserViewAllLogs()` is `true` (Lead, Delivery Manager, Admin): Returns all logs belonging to projects within `visibleProjects()` or workspace-wide system logs.
   - When `canCurrentUserViewAllLogs()` is `false` (Dev, QA): Strictly isolates the activity stream:
     - `entry.actorId === currentUserId()`
     - `entry.actor === currentUser().name`
     - Referenced `taskId` has current user listed in its `assigneeIds`.
2. **Audit Export Security:**
   - Both CSV (`exportAuditLogCsv()`) and JSON (`exportAuditLogJson()`) compliance exports evaluate `visibleActivityLogs()` directly, preventing unauthorized data exfiltration of team-wide activity logs by non-lead personas.
3. **Audit Ledger Events:**
   - Any project membership modification emits `SHARING_UPDATED`.
   - Any capability policy modification emits `PERMISSION_POLICY_UPDATED`.
   - Both actions record actor ID and user name attribution.
