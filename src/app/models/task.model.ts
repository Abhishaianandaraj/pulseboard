export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DEPLOYED' | 'DONE';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type MethodologyView = 'BOARD' | 'SPRINT' | 'TIMELINE';

export type ThemeMode = 'light' | 'dark';

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
  role: string;
  avatar: string;
  email: string;
  color: string;
  department: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  phase: string;
  sprint: string;
  effortPoints: number;
  assigneeId: string;
  startDate: string;
  dueDate: string;
  blocked: boolean;
  blockerReason?: string;
  deployedUrl?: string;
  dependencies?: string[];
  subtasks: Subtask[];
  reviewNotes: ReviewNote[];
  createdAt: string;
  updatedAt: string;
}

export type ActivityActionType =
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_DELETED'
  | 'STATUS_CHANGED'
  | 'DEPLOYED_TO_SERVER'
  | 'REVIEW_NOTE_ADDED'
  | 'BLOCKER_TOGGLED'
  | 'SMART_IMPORT_BATCH'
  | 'WORKSPACE_RESET';

export interface ActivityLog {
  id: string;
  timestamp: string;
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

export interface SmartImportTaskItem {
  title: string;
  description?: string;
  assigneeName?: string;
  priority?: TaskPriority;
  phase?: string;
  sprint?: string;
  effortPoints?: number;
  startDate?: string;
  dueDate?: string;
  deployedUrl?: string;
  subtasks?: string[];
}

export interface SmartImportPayload {
  tasks: SmartImportTaskItem[];
}
