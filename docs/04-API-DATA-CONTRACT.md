# API & Data Contract Specification — PulseBoard

**Document Version:** 2.0.0  
**Status:** Canonical Data Contract  
**Purpose:** Maps Angular TypeScript interfaces 1-to-1 with future REST APIs and PostgreSQL schemas.  

---

## 1. Core TypeScript Domain Interfaces (Current Baseline)

### 1.1 Project Model
```typescript
export interface Project {
  id: string;                      // e.g. "proj-1"
  name: string;                    // e.g. "Enterprise RAG Copilot"
  code: string;                    // e.g. "RAG-CORE"
  description: string;
  teamName: string;                // e.g. "Core AI Squad"
  status: 'ACTIVE' | 'STAGING' | 'COMPLETED';
  color?: string;
  memberIds: string[];             // Explicit list of assigned squad member IDs (governs project isolation)
}
```

### 1.2 Team Member Model & RBAC Context
```typescript
export type SystemRole = 'VIEWER' | 'DEV' | 'QA' | 'LEAD' | 'ADMIN';

export type TechnicalRole =
  | 'AI Engineer'
  | 'Full-Stack Dev'
  | 'QA / Test Engineer'
  | 'Tech Lead'
  | 'Delivery Manager';

export type RoleCategory = 'DEV' | 'QA/TEST' | 'AI' | 'LEAD' | 'DM';

export interface MemberLoadMetric {
  memberId: string;
  activePoints: number;
  reworkCount: number;
  effectiveLoad: number;
  capacityBudget: number;
  status: 'OPTIMAL' | 'NEAR_CAPACITY' | 'OVER_BUDGET';
  label: string;
}

export interface TeamMember {
  id: string;                      // e.g. "tm-1"
  name: string;                    // e.g. "Abhishai"
  role: TechnicalRole;
  systemRole: SystemRole;          // RBAC permission tier
  squad: string;                   // e.g. "Core AI Squad"
  avatar: string;                  // e.g. "AB"
  email: string;
  color: string;
  department: string;
  capacityBudget: number;          // Default 15 story points per sprint
}
```

### 1.3 Task, Subtask & Review Note Models
```typescript
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DEPLOYED' | 'DONE';
export type TaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type SlipReason =
  | 'DEPENDENCY_BLOCKED'
  | 'SCOPE_EXPANDED'
  | 'PRODUCTION_HOTFIX'
  | 'UNDERESTIMATED'
  | null;

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export type ReviewVerdict = 'APPROVED' | 'NEEDS_CHANGES' | 'OBSERVATION';

export interface ReviewNote {
  id: string;
  taskId: string;
  author: string;
  authorAvatar: string;
  authorRole: 'LEAD' | 'DM' | 'REVIEWER';
  verdict: ReviewVerdict;
  content: string;
  timestamp: string;
}

export interface Task {
  id: string;                      // e.g. "PB-101"
  projectId: string;               // Foreign key -> Project.id
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  phase: string;
  sprint: string;
  effortPoints: number;            // Story points (1, 2, 3, 5, 8, 13)
  assigneeIds: string[];           // Foreign keys -> TeamMember.id (multi-assignee support)
  assigneeId?: string;             // Legacy single assignee backward compatibility
  startDate: string;               // e.g. "2026-11-18"
  dueDate: string;                 // e.g. "2026-11-25"
  baselineDueDate?: string;        // Committed schedule baseline for drift tracking
  reworkCount: number;             // Count of 'NEEDS_CHANGES' reviews (+3 penalty each)
  slipReason?: SlipReason;         // Grace buffer taxonomy justification
  slipJustification?: string;      // Detailed context
  blocked: boolean;
  blockerReason?: string;
  deployedUrl?: string;
  dependencies?: string[];
  subtasks: Subtask[];
  reviewNotes: ReviewNote[];
  createdAt: string;               // ISO 8601
  updatedAt: string;               // ISO 8601
}
```

### 1.4 Activity Log Model
```typescript
export type ActivityActionType =
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_DELETED'
  | 'STATUS_CHANGED'
  | 'DEPLOYED_TO_SERVER'
  | 'REVIEW_NOTE_ADDED'
  | 'BLOCKER_TOGGLED'
  | 'SMART_IMPORT_BATCH'
  | 'PROJECT_CREATED'
  | 'MEMBER_ADDED'
  | 'WORKSPACE_RESET'
  | 'REWORK_PENALTY'
  | 'SLIPPAGE_LOGGED'
  | 'DEPENDENCY_UPDATED'
  | 'CASCADE_SHIFT_DATES'
  | 'MEMBER_ROLE_UPDATED';

export interface ActivityLog {
  id: string;
  timestamp: string;               // ISO 8601 or display timestamp
  actor: string;
  actorAvatar: string;
  action: ActivityActionType;
  taskId: string;
  taskTitle: string;
  details: string;
  statusTransition?: {
    from: TaskStatus;
    to: TaskStatus;
  };
}
```

---

## 2. V2 Schema Extensions & Roadmap Fields

To support V2 requirements (`FR-03` Gantt dependencies, `FR-04` Capacity budget & recovery score, and `FR-05` Deadline slippage protocol), the `Task` and `TeamMember` interfaces are extended as follows:

```typescript
// Extended TeamMember with V2 Capacity Fields
export interface TeamMemberV2 extends TeamMember {
  capacityBudget: number;          // Default 15 story points per sprint
  effectiveLoad?: number;          // Calculated: active points + (reworkCount * 3)
}

// Slip reason taxonomy for FR-05
export type SlipReason =
  | 'Dependency Blocked'
  | 'Scope Expanded'
  | 'Production Hotfix'
  | 'Underestimated Effort';

// Extended Task with V2 Dependency, Gantt, and Slippage Fields
export interface TaskV2 extends Task {
  dependencies: string[];          // Array of predecessor Task IDs (e.g. ["task-1"])
  baselineDueDate: string;         // Original committed due date (ISO date)
  slipReason?: SlipReason;         // Reason if dueDate > baselineDueDate
  slipJustification?: string;      // Detailed context for slippage
  reworkCount: number;             // Count of moves from DEPLOYED back to IN_PROGRESS
  isCriticalPath?: boolean;        // Calculated by Gantt engine
}

// Gantt Dependency Conflict Data Model (FR-03)
export interface GanttConflict {
  upstreamTaskId: string;
  upstreamTaskTitle: string;
  upstreamDueDate: string;
  downstreamTaskId: string;
  downstreamTaskTitle: string;
  downstreamStartDate: string;
  delayDays: number;
}

// Gantt Schedule Metrics Signal Model (FR-03)
export interface GanttScheduleMetrics {
  conflicts: GanttConflict[];
  hasConflicts: boolean;
  criticalPathTaskIds: Set<string>;
  maxProjectDurationDays: number;
  scheduleSlackSummary: string;
}

// Cycle-Time & Bottleneck Telemetry Models (FR-06)
export interface ProjectBottleneckMetric {
  projectId: string;
  projectName: string;
  projectCode: string;
  color: string;
  totalTasks: number;
  deployedTasks: number;
  reworkTasks: number;
  totalReworkCount: number;
  reworkRate: number;              // percentage (0-100)
  reworkOverheadPoints: number;    // totalReworkCount * 3
  avgSignOffWaitHours: number;
}

export interface SlippageReasonBreakdown {
  reason: NonNullable<SlipReason>;
  label: string;
  count: number;
  percentage: number;
}

export interface CycleTimeMetrics {
  avgLeadSignOffHours: number;
  totalReworkOverheadPoints: number;
  totalDriftedTasks: number;
  projectBreakdowns: ProjectBottleneckMetric[];
  slippageBreakdowns: SlippageReasonBreakdown[];
}

// Authentication & Session State Contract (FR-01 / FR-07)
export interface AuthSessionState {
  isAuthenticated: boolean;
  currentUserId: string;
  currentUser: TeamMember;
  currentUserRole: SystemRole;
  loginWithPersona(memberId: string): void;
  logout(): void;
}
```

---

## 3. Router Contract & Page Hierarchy

The application routing configuration is defined using `@angular/router` with hash-based location strategy (`withHashLocation()`):

| Route Path | Target Component | Guard | Description |
|---|---|---|---|
| `/login` | `LoginComponent` | None | Public entry with Corporate SSO action and persona cards |
| `/my-day` | `MyDayComponent` | `authGuard` | Default post-login focus hub with workload health |
| `/workspace` | `WorkspaceComponent` | `authGuard` | Delivery view for Board, Sprint, and Key Path Gantt |
| `/projects` | `ProjectsComponent` | `authGuard` | Project directory with completion health and squad allocations |
| `/governance` | `GovernanceComponent` | `authGuard` | Enterprise governance suite (Team, Bottlenecks, Audit) |
| `**` | Redirect | `authGuard` | Redirects to `/my-day` if logged in, else `/login` |

---

## 4. Smart JSON Import Schema

The Smart JSON Import endpoint/parser accepts structured payloads directly generated by LLMs (e.g., Google Gemini) from meeting notes or requirements specifications:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SmartImportPayload",
  "type": "object",
  "required": ["tasks"],
  "properties": {
    "tasks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["title", "assigneeName"],
        "properties": {
          "title": { "type": "string", "minLength": 3, "maxLength": 160 },
          "description": { "type": "string", "default": "" },
          "priority": { "type": "string", "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW"], "default": "MEDIUM" },
          "phase": { "type": "string", "default": "Sprint Backlog" },
          "dueDate": { "type": "string", "format": "date" },
          "startDate": { "type": "string", "format": "date" },
          "points": { "type": "integer", "minimum": 1, "maximum": 21, "default": 3 },
          "assigneeName": { "type": "string" },
          "assigneeRole": {
            "type": "string",
            "enum": ["AI Engineer", "Full-Stack Dev", "QA / Test Engineer", "Tech Lead", "Delivery Manager"]
          },
          "squad": { "type": "string" },
          "projectCode": { "type": "string" },
          "subtasks": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    }
  }
}
```

### 3.1 Sample Smart Import Payload
```json
{
  "tasks": [
    {
      "title": "Implement Semantic Cache with Redis Vector Search",
      "description": "Cache repeated prompt embeddings to reduce LLM API latency by 45%.",
      "priority": "HIGH",
      "phase": "Sprint 2 - Retrieval",
      "dueDate": "2026-11-28",
      "startDate": "2026-11-20",
      "points": 5,
      "assigneeName": "Abhishai",
      "assigneeRole": "Full-Stack Dev",
      "squad": "Core AI Squad",
      "projectCode": "RAG-CORE",
      "subtasks": [
        "Provision Redis vector index",
        "Implement cosine similarity lookup (<0.08 distance threshold)",
        "Write integration tests with pytest"
      ]
    }
  ]
}
```

---

## 4. Future REST API Specification (1-to-1 Mapping)

| Method | Endpoint | Description | RBAC Requirement |
|---|---|---|---|
| `GET` | `/api/projects` | List all projects for authenticated user | `VIEWER` or higher |
| `POST` | `/api/projects` | Create a new project workspace | `ADMIN` only |
| `GET` | `/api/projects/:id/tasks` | Get all tasks for project (with query filters) | `VIEWER` or higher |
| `POST` | `/api/tasks` | Create a single task | `DEV`, `QA`, `LEAD`, `ADMIN` |
| `PATCH` | `/api/tasks/:id` | Update task fields (status, points, dates, blocker) | `DEV` (own), `LEAD`, `ADMIN` |
| `POST` | `/api/tasks/:id/verify` | Append Lead/QA verification note & complete | `QA`, `LEAD`, `ADMIN` |
| `POST` | `/api/import/json` | Ingest batch JSON with auto-member registration | `DEV`, `QA`, `LEAD`, `ADMIN` |
| `GET` | `/api/audit-logs` | Retrieve immutable activity audit records | `VIEWER` or higher |
| `GET` | `/api/members/capacity` | Fetch sprint capacity budgets & effective loads | `VIEWER` or higher |

---

## 5. Multi-Assignee Capacity Splitting & Authorization Contract

### 5.1 Multi-Assignee Load Splitting Formula
For deliverables assigned to multiple engineers (`assigneeIds.length > 1`), story points are divided equally among co-assignees using ceiling arithmetic:
$$\text{Assigned Load Points} = \left\lceil \frac{\text{effortPoints}}{\max(1, |\text{task.assigneeIds}|)} \right\rceil$$

Total Effective Load per engineer across all assigned deliverables is calculated as:
$$\text{Effective Load} = \sum_{t \in \text{ActiveTasks}} \left\lceil \frac{t.\text{effortPoints}}{\max(1, |t.\text{assigneeIds}|)} \right\rceil + (t.\text{reworkCount} \times 3)$$

### 5.2 Project Isolation Query Rule
- For `DEV` and `QA` sessions:
  $$\text{Visible Projects} = \{ p \in \text{Projects} \mid \text{currentUserId} \in p.\text{memberIds} \}$$
- For `LEAD`, `ADMIN`, `VIEWER` sessions:
  $$\text{Visible Projects} = \text{Projects} \quad (\text{portfolio-wide access})$$

### 5.3 Task Ownership Mutability Contract
```typescript
function canEditTask(task: Task, user: TeamMember): boolean {
  if (['LEAD', 'ADMIN'].includes(user.systemRole)) return true;
  if (user.systemRole === 'VIEWER') return false;
  const assignees = task.assigneeIds && task.assigneeIds.length > 0
    ? task.assigneeIds
    : (task.assigneeId ? [task.assigneeId] : []);
  return assignees.length === 0 || assignees.includes(user.id);
}
```


---

## 6. AI Prompt Composer & Extracted Draft Contract

### 6.1 ExtractedTaskDraft & AssigneeWarning Interfaces
```typescript
export type AssigneeWarning =
  | {
      type: 'AMBIGUOUS';
      queryName: string;           // Spoken/typed query that matched 2+ members
      candidateIds: string[];      // Candidate TeamMember IDs for 1-click disambiguation
    }
  | {
      type: 'NOT_IN_PROJECT';
      memberId: string;            // Single matched TeamMember ID outside target project
      memberName: string;          // Display name of matched member
      projectCode: string;         // Target Project Code (e.g. "EVAL-GW")
    }
  | {
      type: 'UNKNOWN';
      queryName: string;           // Spoken/typed name with 0 workspace matches
    };

export interface ExtractedTaskDraft {
  id: string;                      // Temporary draft ID (e.g. "draft-1700000000-0")
  title: string;                   // Clean deliverable title
  description?: string;            // Contextual extraction notes
  projectId: string;               // Matched Project ID
  projectCode: string;             // Matched Project Code (e.g. "RAG-CORE")
  assigneeIds: string[];           // Matched in-project TeamMember IDs (may be [] until resolved or if left unassigned)
  assigneeWarning?: AssigneeWarning | null; // Unresolved disambiguation/membership/unknown warning
  priority: TaskPriority;          // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  effortPoints: number;            // Story points (1 - 21)
  dueDate: string;                 // ISO date YYYY-MM-DD
  dependencies: string[];          // Matched upstream task IDs (e.g. ["PB-103"])
  subtasks: string[];              // Extracted checklist step strings
  confidence?: number;             // Parser confidence score (0.0 - 1.0)
}
```

### 6.2 ActivityActionType Extension
```typescript
export type ActivityActionType =
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_DELETED'
  | 'STATUS_CHANGED'
  | 'DEPLOYED_TO_SERVER'
  | 'REVIEW_NOTE_ADDED'
  | 'BLOCKER_TOGGLED'
  | 'SMART_IMPORT_BATCH'
  | 'AI_PROMPT_EXTRACTION'        // Deliverables created via Voice & NLP Copilot
  | 'AI_EXTRACTED'                // Secondary provenance tag
  | 'PROJECT_CREATED'
  | 'MEMBER_ADDED'
  | 'WORKSPACE_RESET'
  | 'REWORK_PENALTY'
  | 'SLIPPAGE_LOGGED'
  | 'DEPENDENCY_UPDATED'
  | 'CASCADE_SHIFT_DATES'
  | 'MEMBER_ROLE_UPDATED';
```

### 6.3 Corporate LLM Extraction Request / Response Schema
```json
// POST /v1/chat/completions (Corporate Proxy)
// Request Body:
{
  "prompt": "Assign Abhishai and Priya to build Postgres audit schema for Pulse V1...",
  "systemPrompt": "You are the PulseBoard Corporate Task Extractor...",
  "stream": false
}

// Response Body:
[
  {
    "title": "Build Postgres audit log schema",
    "projectCode": "PULSE-V1",
    "assigneeNames": ["Abhishai", "Priya"],
    "priority": "HIGH",
    "effortPoints": 5,
    "dueDate": "2026-11-26",
    "dependencies": ["PB-103"],
    "subtasks": ["Define migration", "Add indexing"]
  }
]
```


### 6.4 Compound Multi-Task NLP Parsing Contract (v3.1.1 / Hardened v3.3.1)
- **Line-first splitting with subtask protection**:
  Splits on `\r?\n+`, skips pure meeting headers (`Meeting Notes`, `Attendees:`, `Action Items:`), protects checklist spans from mid-sentence splitting, supports comma-less Web Speech API dictations, and merges continuation clauses (`This task depends on PB-101`).
- **Hyphenated and spaced story points regex**:
  `\b(\d+)\s*-?\s*(?:points?|pts?)\b`
- **Context-aware layered title sanitizer**:
  Iteratively peels conjunctions, project scopes, task-creation phrases, speaker labels, assignment verbs (including fuzzy/unknown spoken name tokens), parenthetical metadata, due dates, and trailing scopes while preserving technical phrases (e.g., `"low latency"`).

### 6.5 Smart Name Matching & Assignee Disambiguation Contract (v3.4.0)
- **Tiered Workspace Matching (`AiCopilotService.findMatchingMembers`)**:
  - Tier 0: Exact full-name match (`"Abhishek J"` -> single exact match).
  - Tier 1: Multi-word first+last/initial fuzzy match (`"Karthick R"` -> `"Karthik R"`).
  - Tier 2: Exact first-name match (`"Abhishek"` -> `["Abhishek J", "Abhishek K"]` -> `AMBIGUOUS`).
  - Tier 3: 4+ char prefix match (`"Abhi"` -> matches all members starting with `"abhi"`).
  - Tier 4: Fuzzy Levenshtein edit distance $\le 2$ (`"Abisha"` -> `"Abhishai"`, `"Karthick"` -> `"Karthik R"`).
- **Project Membership Validation (`AiCopilotService.resolveAssigneesForProject`)**:
  - Single matched member outside `targetProj.memberIds` triggers `NOT_IN_PROJECT` without silent assignment.
  - 2+ matched members triggers `AMBIGUOUS` with `candidateIds` and empty `assigneeIds`.
  - 0 matched members for an explicitly spoken assignee slot triggers `UNKNOWN` with `queryName`.
- **Store Guard (`TaskStoreService.createTasksFromAiDrafts`)**:
  - Rejects batches containing any unresolved `assigneeWarning`.
  - Preserves intentionally empty `assigneeIds: []` (`assigneeId: ''`) when the user chooses **`Leave Unassigned`**.


---

## 7. Role Capability Policies & Scoped Activity Logs Data Contract (FR-12)

### 7.1 Role Permission Policy Interface
```typescript
export interface RolePermissionPolicy {
  role: SystemRole;
  canCreateTasks: boolean;
  canViewAllLogs: boolean;
  canApproveSignOff: boolean;
  canManageSharing: boolean;
}
```

### 7.2 Activity Log & Action Types Extension
```typescript
export type ActivityActionType =
  | 'STATUS_CHANGED'
  | 'BLOCKER_TOGGLED'
  | 'DEPLOYED_TO_SERVER'
  | 'REVIEW_NOTE_ADDED'
  | 'SMART_IMPORT'
  | 'AI_PROMPT_EXTRACTION'
  | 'WORKSPACE_RESET'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_DELETED'
  | 'REWORK_PENALTY'
  | 'SLIPPAGE_LOGGED'
  | 'DEPENDENCY_UPDATED'
  | 'CASCADE_SHIFT_DATES'
  | 'MEMBER_ROLE_UPDATED'
  | 'SHARING_UPDATED'
  | 'PERMISSION_POLICY_UPDATED';

export interface ActivityLog {
  id: string;
  timestamp: string;
  actor: string;
  actorId?: string;
  actorAvatar: string;
  action: ActivityActionType;
  taskId: string;
  taskTitle: string;
  details: string;
  statusTransition?: {
    from: TaskStatus;
    to: TaskStatus;
  };
}
```

### 7.3 Store Mutation & Signal Contracts
```typescript
// Signals
readonly rolePolicies: Signal<Record<SystemRole, RolePermissionPolicy>>;
readonly canCurrentUserCreateTasks: Signal<boolean>;
readonly canCurrentUserViewAllLogs: Signal<boolean>;
readonly canCurrentUserManageSharing: Signal<boolean>;
readonly canCurrentUserApproveSignOff: Signal<boolean>;
readonly visibleActivityLogs: Signal<ActivityLog[]>;

// Store Mutations
toggleProjectMember(projectId: string, memberId: string): boolean;
updateRolePermissionPolicy(role: SystemRole, patch: Partial<RolePermissionPolicy>): boolean;
```
