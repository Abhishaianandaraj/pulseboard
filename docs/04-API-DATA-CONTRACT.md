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
  assigneeId: string;              // Foreign key -> TeamMember.id
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
  | 'CASCADE_SHIFT_DATES';

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
```

---

## 3. Smart JSON Import Schema

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
