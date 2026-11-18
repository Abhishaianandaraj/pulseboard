import { Injectable, signal, computed, effect } from '@angular/core';
import {
  Task,
  TaskStatus,
  TaskPriority,
  TeamMember,
  ActivityLog,
  MethodologyView,
  SmartImportPayload,
  ReviewNote,
  ReviewVerdict,
  ThemeMode
} from '../models/task.model';
import {
  INITIAL_TEAM_MEMBERS,
  INITIAL_TASKS,
  INITIAL_LOGS
} from '../data/seed-data';

const STORAGE_KEY_TASKS = 'pulseboard_v1_tasks';
const STORAGE_KEY_LOGS = 'pulseboard_v1_logs';
const STORAGE_KEY_THEME = 'pulseboard_v1_theme';

@Injectable({
  providedIn: 'root'
})
export class TaskStoreService {
  // --- Core State Signals ---
  readonly tasks = signal<Task[]>(this.loadFromStorage(STORAGE_KEY_TASKS, INITIAL_TASKS));
  readonly teamMembers = signal<TeamMember[]>(INITIAL_TEAM_MEMBERS);
  readonly activityLogs = signal<ActivityLog[]>(this.loadFromStorage(STORAGE_KEY_LOGS, INITIAL_LOGS));
  readonly currentView = signal<MethodologyView>('BOARD');
  readonly theme = signal<ThemeMode>(this.loadTheme());

  // --- Search & Filter Signals ---
  readonly searchQuery = signal<string>('');
  readonly filterAssigneeId = signal<string>('ALL');
  readonly filterPriority = signal<TaskPriority | 'ALL'>('ALL');
  readonly filterBlockedOnly = signal<boolean>(false);
  readonly filterDeployedOnly = signal<boolean>(false);

  // --- Active Selected Task (for Drawer) ---
  readonly selectedTaskId = signal<string | null>(null);

  // --- Computed: Active Selected Task Object ---
  readonly selectedTask = computed(() => {
    const id = this.selectedTaskId();
    if (!id) return null;
    return this.tasks().find((t: Task) => t.id === id) || null;
  });

  // --- Computed: Map of Assignees by ID for 1-to-1 Join ---
  readonly assigneeMap = computed(() => {
    const map = new Map<string, TeamMember>();
    this.teamMembers().forEach((m: TeamMember) => map.set(m.id, m));
    return map;
  });

  // --- Computed: Filtered Tasks List ---
  readonly filteredTasks = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const assignee = this.filterAssigneeId();
    const priority = this.filterPriority();
    const blockedOnly = this.filterBlockedOnly();
    const deployedOnly = this.filterDeployedOnly();
    const map = this.assigneeMap();

    return this.tasks().filter((task: Task) => {
      if (blockedOnly && !task.blocked) return false;
      if (deployedOnly && task.status !== 'DEPLOYED') return false;
      if (assignee !== 'ALL' && task.assigneeId !== assignee) return false;
      if (priority !== 'ALL' && task.priority !== priority) return false;

      if (query) {
        const titleMatch = task.title.toLowerCase().includes(query);
        const descMatch = (task.description || '').toLowerCase().includes(query);
        const idMatch = task.id.toLowerCase().includes(query);
        const phaseMatch = (task.phase || '').toLowerCase().includes(query);
        const assigneeObj = map.get(task.assigneeId);
        const nameMatch = assigneeObj ? assigneeObj.name.toLowerCase().includes(query) : false;

        if (!titleMatch && !descMatch && !idMatch && !phaseMatch && !nameMatch) {
          return false;
        }
      }

      return true;
    });
  });

  // --- Computed: Kanban Workflow Columns ---
  readonly todoTasks = computed(() => this.filteredTasks().filter((t: Task) => t.status === 'TODO'));
  readonly inProgressTasks = computed(() => this.filteredTasks().filter((t: Task) => t.status === 'IN_PROGRESS'));
  readonly deployedTasks = computed(() => this.filteredTasks().filter((t: Task) => t.status === 'DEPLOYED'));
  readonly doneTasks = computed(() => this.filteredTasks().filter((t: Task) => t.status === 'DONE'));

  // --- Computed: Lead Radar KPIs (Zero-Spam Intelligence) ---
  readonly totalTasksCount = computed(() => this.tasks().length);
  readonly doneTasksCount = computed(() => this.tasks().filter((t: Task) => t.status === 'DONE').length);

  readonly completionProgressPercent = computed(() => {
    const total = this.totalTasksCount();
    if (total === 0) return 0;
    return Math.round((this.doneTasksCount() / total) * 100);
  });

  readonly readyForServerCheckCount = computed(() =>
    this.tasks().filter((t: Task) => t.status === 'DEPLOYED').length
  );

  readonly blockedCount = computed(() =>
    this.tasks().filter((t: Task) => t.blocked && t.status !== 'DONE').length
  );

  // Team members with 0 active tasks (TODO or IN_PROGRESS)
  readonly availableBandwidthMembers = computed(() => {
    const all = this.teamMembers();
    const busyIds = new Set(
      this.tasks()
        .filter((t: Task) => t.status === 'TODO' || t.status === 'IN_PROGRESS')
        .map((t: Task) => t.assigneeId)
    );
    return all.filter((m: TeamMember) => !busyIds.has(m.id));
  });

  // Workload counts per team member (for sidebar quick filters)
  readonly memberWorkloadMap = computed(() => {
    const map = new Map<string, number>();
    this.teamMembers().forEach((m: TeamMember) => map.set(m.id, 0));
    this.tasks().forEach((t: Task) => {
      if (t.status !== 'DONE') {
        const current = map.get(t.assigneeId) || 0;
        map.set(t.assigneeId, current + 1);
      }
    });
    return map;
  });

  // Distinct Phases for Waterfall Timeline
  readonly projectPhases = computed(() => {
    const set = new Set<string>();
    this.tasks().forEach((t: Task) => set.add(t.phase || 'Unassigned Phase'));
    return Array.from(set);
  });

  // Distinct Sprints for Agile Sprint View
  readonly sprints = computed(() => {
    const set = new Set<string>();
    this.tasks().forEach((t: Task) => set.add(t.sprint || 'Sprint Backlog'));
    return Array.from(set);
  });

  constructor() {
    // Theme effect: sync data-theme attribute with document root
    effect(() => {
      const mode = this.theme();
      document.documentElement.setAttribute('data-theme', mode);
      try {
        localStorage.setItem(STORAGE_KEY_THEME, mode);
      } catch (e) {
        console.warn('Failed to persist theme to localStorage', e);
      }
    });

    // Auto-persist tasks to storage
    effect(() => {
      this.persistTasks(this.tasks());
    });

    // Auto-persist activity logs to storage
    effect(() => {
      this.persistLogs(this.activityLogs());
    });
  }

  // --- Theme Toggle ---
  toggleTheme(): void {
    this.theme.update((prev: ThemeMode) => (prev === 'light' ? 'dark' : 'light'));
  }

  // --- Task Detail Drawer Helpers ---
  selectTask(taskId: string): void {
    this.selectedTaskId.set(taskId);
  }

  closeTaskDrawer(): void {
    this.selectedTaskId.set(null);
  }

  // --- Async-Ready Repository CRUD Methods (mirrors REST API) ---

  async createTask(newTaskData: Partial<Task>): Promise<Task> {
    const nextNum = Math.max(
      100,
      ...this.tasks().map((t: Task) => {
        const num = parseInt(t.id.replace('PB-', ''), 10);
        return isNaN(num) ? 0 : num;
      })
    ) + 1;

    const defaultMember = this.teamMembers()[0];
    const assigneeId = newTaskData.assigneeId || defaultMember.id;

    const task: Task = {
      id: `PB-${nextNum}`,
      title: newTaskData.title?.trim() || 'Untitled Engineering Task',
      description: newTaskData.description?.trim() || '',
      status: newTaskData.status || 'TODO',
      priority: newTaskData.priority || 'MEDIUM',
      phase: newTaskData.phase?.trim() || 'Phase 1: Knowledge Core',
      sprint: newTaskData.sprint?.trim() || 'Sprint 24.3',
      effortPoints: Number(newTaskData.effortPoints) || 3,
      assigneeId,
      startDate: newTaskData.startDate || new Date().toISOString().split('T')[0],
      dueDate: newTaskData.dueDate || new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      blocked: newTaskData.blocked || false,
      blockerReason: newTaskData.blockerReason || '',
      deployedUrl: newTaskData.deployedUrl?.trim() || '',
      dependencies: newTaskData.dependencies || [],
      subtasks: newTaskData.subtasks || [],
      reviewNotes: newTaskData.reviewNotes || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.tasks.update((prev: Task[]) => [task, ...prev]);

    const member = this.assigneeMap().get(assigneeId);
    this.recordActivity({
      actor: 'Devon Ward',
      actorAvatar: 'DW',
      action: 'TASK_CREATED',
      taskId: task.id,
      taskTitle: task.title,
      details: `Created task [${task.id}] in ${task.phase} assigned to ${member?.name || 'Engineer'}`
    });

    return task;
  }

  async updateTask(updated: Task): Promise<void> {
    const currentList = this.tasks();
    const old = currentList.find((t: Task) => t.id === updated.id);

    this.tasks.update((prev: Task[]) =>
      prev.map((t: Task) => (t.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : t))
    );

    if (old && old.status !== updated.status) {
      const isDeployed = updated.status === 'DEPLOYED';
      const member = this.assigneeMap().get(updated.assigneeId);
      this.recordActivity({
        actor: member?.name || 'Engineer',
        actorAvatar: member?.avatar || 'AI',
        action: isDeployed ? 'DEPLOYED_TO_SERVER' : 'STATUS_CHANGED',
        taskId: updated.id,
        taskTitle: updated.title,
        details: isDeployed
          ? `Pushed container to ${updated.deployedUrl || 'staging endpoint'} awaiting Lead signoff`
          : `Transitioned status from ${old.status} to ${updated.status}`,
        statusTransition: { from: old.status, to: updated.status }
      });
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    const task = this.tasks().find((t: Task) => t.id === taskId);
    this.tasks.update((prev: Task[]) => prev.filter((t: Task) => t.id !== taskId));

    if (this.selectedTaskId() === taskId) {
      this.selectedTaskId.set(null);
    }

    if (task) {
      this.recordActivity({
        actor: 'Devon Ward',
        actorAvatar: 'DW',
        action: 'TASK_DELETED',
        taskId: task.id,
        taskTitle: task.title,
        details: `Deleted task [${task.id}] from project backlog`
      });
    }
  }

  async updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<void> {
    const task = this.tasks().find((t: Task) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    const oldStatus = task.status;
    this.tasks.update((prev: Task[]) =>
      prev.map((t: Task) => (t.id === taskId ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t))
    );

    const member = this.assigneeMap().get(task.assigneeId);
    this.recordActivity({
      actor: member?.name || 'Devon Ward',
      actorAvatar: member?.avatar || 'DW',
      action: newStatus === 'DEPLOYED' ? 'DEPLOYED_TO_SERVER' : 'STATUS_CHANGED',
      taskId: task.id,
      taskTitle: task.title,
      details: newStatus === 'DEPLOYED'
        ? `Task deployed to server! Flagged for Team Lead verification.`
        : `Moved status from ${oldStatus} to ${newStatus}`,
      statusTransition: { from: oldStatus, to: newStatus }
    });
  }

  // Drag and Drop within same column
  reorderTasksInColumn(status: TaskStatus, previousIndex: number, currentIndex: number): void {
    const all = [...this.tasks()];
    const columnTasks = all.filter((t: Task) => t.status === status);
    if (!columnTasks[previousIndex] || !columnTasks[currentIndex]) return;

    const moved = columnTasks.splice(previousIndex, 1)[0];
    columnTasks.splice(currentIndex, 0, moved);

    const otherTasks = all.filter((t: Task) => t.status !== status);
    this.tasks.set([...otherTasks, ...columnTasks]);
  }

  // Drag and Drop across columns
  moveTaskBetweenColumns(taskId: string, targetStatus: TaskStatus, targetIndex: number): void {
    const task = this.tasks().find((t: Task) => t.id === taskId);
    if (!task) return;

    const oldStatus = task.status;
    const updated: Task = {
      ...task,
      status: targetStatus,
      updatedAt: new Date().toISOString()
    };

    const remaining = this.tasks().filter((t: Task) => t.id !== taskId);
    const targetColumn = remaining.filter((t: Task) => t.status === targetStatus);
    const otherColumns = remaining.filter((t: Task) => t.status !== targetStatus);

    targetColumn.splice(targetIndex, 0, updated);
    this.tasks.set([...otherColumns, ...targetColumn]);

    const member = this.assigneeMap().get(task.assigneeId);
    this.recordActivity({
      actor: member?.name || 'Engineer',
      actorAvatar: member?.avatar || 'AI',
      action: targetStatus === 'DEPLOYED' ? 'DEPLOYED_TO_SERVER' : 'STATUS_CHANGED',
      taskId: task.id,
      taskTitle: task.title,
      details: targetStatus === 'DEPLOYED'
        ? `Task deployed to server! Flagged for Lead inspection.`
        : `Drag moved card from ${oldStatus} to ${targetStatus}`,
      statusTransition: { from: oldStatus, to: targetStatus }
    });
  }

  // Toggle Blocker
  toggleBlocked(taskId: string, reason?: string): void {
    const task = this.tasks().find((t: Task) => t.id === taskId);
    if (!task) return;

    const newBlocked = !task.blocked;
    this.tasks.update((prev: Task[]) =>
      prev.map((t: Task) => {
        if (t.id === taskId) {
          return {
            ...t,
            blocked: newBlocked,
            blockerReason: newBlocked ? reason || 'Waiting on infra / license resolution' : '',
            updatedAt: new Date().toISOString()
          };
        }
        return t;
      })
    );

    const member = this.assigneeMap().get(task.assigneeId);
    this.recordActivity({
      actor: member?.name || 'Lead',
      actorAvatar: member?.avatar || 'DW',
      action: 'BLOCKER_TOGGLED',
      taskId: task.id,
      taskTitle: task.title,
      details: newBlocked
        ? `Marked as BLOCKED: ${reason || 'Waiting on resolution'}`
        : 'Blocker cleared and active work resumed'
    });
  }

  // Add Server Review & Verification Note
  addReviewNote(taskId: string, note: { author: string; authorAvatar: string; authorRole: 'LEAD' | 'DM' | 'REVIEWER'; verdict: ReviewVerdict; content: string }): void {
    const task = this.tasks().find((t: Task) => t.id === taskId);
    if (!task) return;

    const newNote: ReviewNote = {
      id: `rn-${Date.now()}`,
      taskId,
      ...note,
      timestamp: 'Just now'
    };

    // If verdict is APPROVED and currently DEPLOYED, auto-complete to DONE
    const nextStatus = (note.verdict === 'APPROVED' && task.status === 'DEPLOYED') ? 'DONE' : task.status;

    this.tasks.update((prev: Task[]) =>
      prev.map((t: Task) => {
        if (t.id === taskId) {
          return {
            ...t,
            status: nextStatus,
            reviewNotes: [newNote, ...(t.reviewNotes || [])],
            updatedAt: new Date().toISOString()
          };
        }
        return t;
      })
    );

    this.recordActivity({
      actor: note.author,
      actorAvatar: note.authorAvatar,
      action: 'REVIEW_NOTE_ADDED',
      taskId: task.id,
      taskTitle: task.title,
      details: `Lead Verification [${note.verdict}]: "${note.content.substring(0, 65)}..."`
    });
  }

  // Subtask Checklists
  addSubtask(taskId: string, title: string): void {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    this.tasks.update((prev: Task[]) =>
      prev.map((t: Task) => {
        if (t.id === taskId) {
          const newSubtask = {
            id: `st-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            taskId,
            title: cleanTitle,
            completed: false,
            createdAt: new Date().toISOString().split('T')[0]
          };
          return {
            ...t,
            subtasks: [...(t.subtasks || []), newSubtask],
            updatedAt: new Date().toISOString()
          };
        }
        return t;
      })
    );
  }

  toggleSubtask(taskId: string, subtaskId: string): void {
    this.tasks.update((prev: Task[]) =>
      prev.map((t: Task) => {
        if (t.id === taskId) {
          const subtasks = (t.subtasks || []).map(st =>
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
          );
          return { ...t, subtasks, updatedAt: new Date().toISOString() };
        }
        return t;
      })
    );
  }

  deleteSubtask(taskId: string, subtaskId: string): void {
    this.tasks.update((prev: Task[]) =>
      prev.map((t: Task) => {
        if (t.id === taskId) {
          const subtasks = (t.subtasks || []).filter(st => st.id !== subtaskId);
          return { ...t, subtasks, updatedAt: new Date().toISOString() };
        }
        return t;
      })
    );
  }

  // --- Smart Import Batch Ingestion ---
  importFromJson(payload: SmartImportPayload): { success: boolean; count: number; error?: string } {
    try {
      if (!payload || !Array.isArray(payload.tasks) || payload.tasks.length === 0) {
        return { success: false, count: 0, error: 'JSON must contain a "tasks" array with at least one task.' };
      }

      const team = this.teamMembers();
      let maxNum = Math.max(
        100,
        ...this.tasks().map((t: Task) => {
          const num = parseInt(t.id.replace('PB-', ''), 10);
          return isNaN(num) ? 0 : num;
        })
      );

      const newTasks: Task[] = payload.tasks.map(item => {
        maxNum++;
        let matched = team.find(
          (m: TeamMember) => item.assigneeName && m.name.toLowerCase().includes(item.assigneeName.toLowerCase())
        );
        if (!matched) {
          matched = team[maxNum % team.length];
        }

        const taskId = `PB-${maxNum}`;
        const subtasks = (item.subtasks || []).map((stTitle: string, idx: number) => ({
          id: `st-imp-${maxNum}-${idx}`,
          taskId,
          title: stTitle,
          completed: false,
          createdAt: new Date().toISOString().split('T')[0]
        }));

        return {
          id: taskId,
          title: item.title?.trim() || 'AI Imported Task',
          description: item.description?.trim() || 'Extracted from meeting action items.',
          status: 'TODO' as TaskStatus,
          priority: item.priority || 'MEDIUM',
          phase: item.phase?.trim() || 'Phase 1: Knowledge Core',
          sprint: item.sprint?.trim() || 'Sprint 24.3',
          effortPoints: Number(item.effortPoints) || 3,
          assigneeId: matched.id,
          startDate: item.startDate || new Date().toISOString().split('T')[0],
          dueDate: item.dueDate || new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0],
          blocked: false,
          deployedUrl: item.deployedUrl?.trim() || '',
          dependencies: [],
          subtasks,
          reviewNotes: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      });

      this.tasks.update((prev: Task[]) => [...newTasks, ...prev]);

      this.recordActivity({
        actor: 'Devon Ward',
        actorAvatar: 'DW',
        action: 'SMART_IMPORT_BATCH',
        taskId: `PB-${maxNum}`,
        taskTitle: `Batch Ingestion (${newTasks.length} tasks)`,
        details: `Imported ${newTasks.length} action items into Sprint backlog from meeting notes.`
      });

      return { success: true, count: newTasks.length };
    } catch (e: any) {
      return { success: false, count: 0, error: e.message || 'Malformed JSON schema.' };
    }
  }

  // --- Reset Workspace ---
  resetWorkspace(): void {
    this.tasks.set(INITIAL_TASKS);
    this.activityLogs.set(INITIAL_LOGS);
    this.searchQuery.set('');
    this.filterAssigneeId.set('ALL');
    this.filterPriority.set('ALL');
    this.filterBlockedOnly.set(false);
    this.filterDeployedOnly.set(false);
    this.currentView.set('BOARD');
    this.selectedTaskId.set(null);

    this.persistTasks(INITIAL_TASKS);
    this.persistLogs(INITIAL_LOGS);

    this.recordActivity({
      actor: 'Devon Ward',
      actorAvatar: 'DW',
      action: 'WORKSPACE_RESET',
      taskId: 'SYS-0',
      taskTitle: 'PulseBoard V1 Workspace Reset',
      details: 'Restored baseline AI engineering demo datasets and clearing filter state.'
    });
  }

  // --- Activity Audit Logger ---
  recordActivity(log: Omit<ActivityLog, 'id' | 'timestamp'>): void {
    const entry: ActivityLog = {
      ...log,
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: 'Just now'
    };

    this.activityLogs.update((prev: ActivityLog[]) => [entry, ...prev].slice(0, 50));
  }

  // --- LocalStorage Helpers ---
  private loadFromStorage<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(key);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn(`Failed to read ${key} from localStorage`, e);
    }
    return fallback;
  }

  private loadTheme(): ThemeMode {
    try {
      const theme = localStorage.getItem(STORAGE_KEY_THEME) as ThemeMode;
      if (theme === 'light' || theme === 'dark') return theme;
    } catch (e) {}
    return 'light';
  }

  private persistTasks(tasks: Task[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
    } catch (e) {
      console.error('Failed to persist tasks', e);
    }
  }

  private persistLogs(logs: ActivityLog[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to persist logs', e);
    }
  }
}
