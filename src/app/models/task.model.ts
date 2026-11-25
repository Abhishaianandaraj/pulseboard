export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DEPLOYED' | 'DONE';

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'Yet to Start',
  IN_PROGRESS: 'In Progress',
  DEPLOYED: 'Under Review',
  DONE: 'Completed'
};

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type MethodologyView = 'BOARD' | 'SPRINT' | 'TIMELINE' | 'GOVERNANCE';

export type ThemeMode = 'light' | 'dark';

export type SystemRole = 'VIEWER' | 'DEV' | 'QA' | 'LEAD' | 'ADMIN';

export type MemberAccessRole = 'Member' | 'Lead' | 'Manager';

export type SlipReason =
  | 'DEPENDENCY_BLOCKED'
  | 'SCOPE_EXPANDED'
  | 'PRODUCTION_HOTFIX'
  | 'UNDERESTIMATED'
  | null;

export type TechnicalRole =
  | 'AI Engineer'
  | 'Full-Stack Dev'
  | 'QA / Test Engineer'
  | 'Tech Lead'
  | 'Delivery Manager';

export type RoleCategory = 'AI' | 'DEV' | 'QA/TEST' | 'LEAD' | 'DM';

export interface MemberLoadMetric {
  memberId: string;
  activePoints: number;
  reworkCount: number;
  effectiveLoad: number;
  capacityBudget: number;
  status: 'OPTIMAL' | 'NEAR_CAPACITY' | 'OVER_BUDGET';
  label: string;
}

export interface Project {
  id: string;
  name: string;
  code: string; // e.g. "RAG-CORE", "EVAL-GW", "PULSE-V1"
  description: string;
  teamName: string;
  status: 'ACTIVE' | 'STAGING' | 'COMPLETED';
  color: string;
  memberIds: string[]; // Explicit list of squad members assigned to this project
}

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

export interface TeamMember {
  id: string;
  name: string;
  role: TechnicalRole;
  systemRole: SystemRole;
  squad: string;
  avatar: string;
  email: string;
  color: string;
  department: string;
  capacityBudget: number; // Sprint budget in points (default: 15)
}

export interface GanttConflict {
  upstreamTaskId: string;
  upstreamTitle: string;
  downstreamTaskId: string;
  downstreamTitle: string;
  upstreamDueDate: string;
  downstreamStartDate: string;
  overlapDays: number;
}

export interface GanttScheduleMetrics {
  criticalPathTaskIds: Set<string>;
  conflicts: GanttConflict[];
  hasConflicts: boolean;
  totalSlackDays: Map<string, number>;
}

export interface DeliverableTask {
  id: string;
  projectId: string; // foreign key to Project.id
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  phase: string;
  sprint: string;
  effortPoints: number; // Decoupled story/effort points (1, 2, 3, 5, 8...)
  storyPoints?: number; // Alias synchronized with effortPoints
  progress: number; // Completion percentage (0 to 100)
  assigneeIds: string[]; // Primary & co-assignee member IDs
  assigneeId?: string; // Optional alias for backward compatibility
  startDate: string; // YYYY-MM-DD (independent of effortPoints; driven by prerequisites if any)
  dueDate: string; // YYYY-MM-DD
  baselineDueDate?: string; // Original committed due date for drift calculation
  reworkCount: number; // Frequency of 'NEEDS_CHANGES' rejections (+3 penalty each)
  slipReason?: SlipReason;
  slipJustification?: string;
  blocked: boolean;
  blockerReason?: string;
  deployedUrl?: string;
  dependencies: string[]; // Upstream prerequisite task IDs (1 to 5+ supported)
  isCriticalPath?: boolean; // Evaluated dynamically by Gantt engine
  subtasks: Subtask[];
  reviewNotes: ReviewNote[];
  createdAt: string;
  updatedAt: string;
}

export type Task = DeliverableTask;

export type ActivityActionType =
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_DELETED'
  | 'TASKS_CLEARED'
  | 'STATUS_CHANGED'
  | 'DEPLOYED_TO_SERVER'
  | 'REVIEW_NOTE_ADDED'
  | 'BLOCKER_TOGGLED'
  | 'SMART_IMPORT_BATCH'
  | 'AI_PROMPT_EXTRACTION'
  | 'AI_EXTRACTED'
  | 'SHARING_UPDATED'
  | 'PERMISSION_POLICY_UPDATED'
  | 'PROJECT_CREATED'
  | 'MEMBER_ADDED'
  | 'MEMBER_UPDATED'
  | 'MEMBER_REMOVED'
  | 'WORKSPACE_RENAMED'
  | 'WORKSPACE_RESET'
  | 'REWORK_PENALTY'
  | 'SLIPPAGE_LOGGED'
  | 'DEPENDENCY_UPDATED'
  | 'CASCADE_SHIFT_DATES'
  | 'MEMBER_ROLE_UPDATED';

export interface ProjectBottleneckMetric {
  projectId: string;
  projectName: string;
  projectCode: string;
  color: string;
  totalTasks: number;
  deployedTasks: number;
  reworkTasks: number;
  totalReworkCount: number;
  reworkRate: number; // percentage (0-100)
  reworkOverheadPoints: number; // reworkCount * 3
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

export interface RolePermissionPolicy {
  role: SystemRole;
  canCreateTasks: boolean;
  canViewAllLogs: boolean;
  canApproveSignOff: boolean;
  canManageSharing: boolean;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  actor: string;
  actorAvatar: string;
  actorId?: string;
  action: ActivityActionType;
  taskId: string;
  taskTitle: string;
  details: string;
  statusTransition?: {
    from: TaskStatus;
    to: TaskStatus;
  };
}

export interface SmartImportTaskItem {
  title: string;
  description?: string;
  projectCode?: string; // Optional: "RAG-CORE" | "EVAL-GW" | "PULSE-V1"
  assigneeName?: string;
  assigneeNames?: string[]; // Multi-assignee support
  assigneeRole?: TechnicalRole;
  squad?: string;
  priority?: TaskPriority;
  phase?: string;
  sprint?: string;
  effortPoints?: number;
  storyPoints?: number;
  progress?: number;
  startDate?: string;
  dueDate?: string;
  deployedUrl?: string;
  dependencies?: string[];
  dependsOnTitles?: string[];
  subtasks?: string[];
}

export interface SmartImportPayload {
  tasks: SmartImportTaskItem[];
}

export type AssigneeWarning =
  | {
      type: 'AMBIGUOUS';
      queryName: string;
      candidateIds: string[];
    }
  | {
      type: 'NOT_IN_PROJECT';
      memberId: string;
      memberName: string;
      projectCode: string;
    }
  | {
      type: 'UNKNOWN';
      queryName: string;
    };

export interface ExtractedTaskDraft {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  projectCode: string;
  assigneeIds: string[];
  assigneeWarning?: AssigneeWarning | null;
  priority: TaskPriority;
  effortPoints: number;
  startDate?: string;
  dueDate: string;
  dependencies: string[];
  subtasks: string[];
  confidence?: number;
}
