import { Injectable, signal, computed, effect, inject } from '@angular/core';
import {
  Project,
  TeamMember,
  Task,
  Subtask,
  TaskStatus,
  TaskPriority,
  MethodologyView,
  ActivityLog,
  ReviewNote,
  ReviewVerdict,
  SmartImportPayload,
  ThemeMode,
  TechnicalRole,
  RoleCategory,
  SystemRole,
  MemberAccessRole,
  SlipReason,
  MemberLoadMetric,
  GanttConflict,
  GanttScheduleMetrics,
  ProjectBottleneckMetric,
  SlippageReasonBreakdown,
  CycleTimeMetrics,
  ExtractedTaskDraft,
  RolePermissionPolicy,
  STATUS_LABELS
} from '../models/task.model';
import {
  DEFAULT_WORKSPACE_NAME,
  INITIAL_PROJECTS,
  INITIAL_TEAM_MEMBERS,
  INITIAL_TASKS,
  INITIAL_LOGS
} from '../data/seed-data';
import { TaskRepository, normalizeTaskRecord } from './task-repository';

export function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addCalendarDays(isoDate: string, days: number): string {
  const base = isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? isoDate : todayIsoDate();
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return dt.toISOString().split('T')[0];
}

export function diffCalendarDays(startIso: string, endIso: string): number {
  const s = startIso && /^\d{4}-\d{2}-\d{2}$/.test(startIso) ? startIso : todayIsoDate();
  const e = endIso && /^\d{4}-\d{2}-\d{2}$/.test(endIso) ? endIso : s;
  const [sy, sm, sd] = s.split('-').map(Number);
  const [ey, em, ed] = e.split('-').map(Number);
  const sMs = Date.UTC(sy, sm - 1, sd);
  const eMs = Date.UTC(ey, em - 1, ed);
  return Math.round((eMs - sMs) / 86400000);
}

export function formatShortDate(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '';
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

@Injectable({
  providedIn: 'root'
})
export class TaskStoreService {
  private readonly repo = inject(TaskRepository);
  private readonly initialSnapshot = this.repo.loadState();

  // --- Core Workspace Signals ---
  readonly brandName = signal<string>(this.initialSnapshot.brandName || DEFAULT_WORKSPACE_NAME);
  readonly projects = signal<Project[]>(this.initialSnapshot.projects);
  readonly teamMembers = signal<TeamMember[]>(this.initialSnapshot.members);
  readonly tasks = signal<Task[]>(this.initialSnapshot.tasks);
  readonly activityLogs = signal<ActivityLog[]>(this.initialSnapshot.auditLogs);
  readonly rolePolicies = signal<Record<SystemRole, RolePermissionPolicy>>(this.initialSnapshot.rolePolicies);
  readonly currentView = signal<MethodologyView>('BOARD');
  readonly theme = signal<ThemeMode>(this.initialSnapshot.theme);

  // --- Active Session & RBAC Context ---
  readonly isAuthenticated = signal<boolean>(this.initialSnapshot.isAuthenticated);
  readonly currentUserId = signal<string>(this.initialSnapshot.currentUserId);

  readonly currentUser = computed<TeamMember>(() => {
    const id = this.currentUserId();
    return this.teamMembers().find((m: TeamMember) => m.id === id) || this.teamMembers()[0];
  });

  readonly currentUserRole = computed<SystemRole>(() => {
    return this.currentUser()?.systemRole || 'DEV';
  });

  // Granular Dynamic Permission Computeds
  readonly canCurrentUserCreateTasks = computed(() => {
    const policy = this.rolePolicies()[this.currentUserRole()];
    return policy ? policy.canCreateTasks : true;
  });

  readonly canCurrentUserViewAllLogs = computed(() => {
    const policy = this.rolePolicies()[this.currentUserRole()];
    return policy ? policy.canViewAllLogs : false;
  });

  readonly canCurrentUserManageSharing = computed(() => {
    const role = this.currentUserRole();
    if (role === 'LEAD' || role === 'ADMIN') return true;
    const policy = this.rolePolicies()[role];
    return policy ? policy.canManageSharing : false;
  });

  readonly canCurrentUserApproveSignOff = computed(() => {
    const policy = this.rolePolicies()[this.currentUserRole()];
    return policy ? policy.canApproveSignOff : false;
  });

  // RBAC Permission Computeds
  readonly canCreateTasks = computed(() => this.canCurrentUserCreateTasks());
  readonly canEditTasks = computed(() => this.currentUserRole() !== 'VIEWER');
  readonly canSignOffDone = computed(() => this.canCurrentUserApproveSignOff());
  readonly canApproveReview = computed(() => this.canCurrentUserApproveSignOff());
  readonly canManageGovernance = computed(() => ['LEAD', 'ADMIN'].includes(this.currentUserRole()));
  readonly isViewer = computed(() => this.currentUserRole() === 'VIEWER');

  // Lead / Admin / Viewer can see all projects in portfolio; Dev and QA only see assigned projects
  readonly canViewAllProjects = computed(() =>
    ['LEAD', 'ADMIN', 'VIEWER'].includes(this.currentUserRole())
  );

  readonly visibleProjects = computed<Project[]>(() => {
    if (this.canViewAllProjects()) {
      return this.projects();
    }
    const curId = this.currentUserId();
    return this.projects().filter((p: Project) => (p.memberIds || []).includes(curId));
  });

  // Dynamic Activity Log Scoping: Full team vs. Personal logs
  readonly visibleActivityLogs = computed<ActivityLog[]>(() => {
    const allLogs = this.activityLogs();
    const curUser = this.currentUser();
    const curId = this.currentUserId();
    const canViewAll = this.canCurrentUserViewAllLogs();
    const visibleProjectIds = new Set(this.visibleProjects().map((p: Project) => p.id));
    const visibleProjectCodes = new Set(this.visibleProjects().map((p: Project) => p.code));
    const taskMap = new Map<string, Task>(this.tasks().map((t: Task) => [t.id, t]));

    return allLogs.filter((log: ActivityLog) => {
      if (log.taskId) {
        const task = taskMap.get(log.taskId);
        if (task && !visibleProjectIds.has(task.projectId)) {
          return false;
        }
        const isKnownProjectCode = this.projects().some((p: Project) => p.code === log.taskId);
        if (isKnownProjectCode && !visibleProjectCodes.has(log.taskId)) {
          return false;
        }
      }

      if (canViewAll) {
        return true;
      }

      if (log.actorId && log.actorId === curId) return true;
      if (log.actor && curUser && log.actor === curUser.name) return true;

      if (log.taskId) {
        const task = taskMap.get(log.taskId);
        if (task) {
          const assignees = (task.assigneeIds && task.assigneeIds.length > 0)
            ? task.assigneeIds
            : (task.assigneeId ? [task.assigneeId] : []);
          if (assignees.includes(curId)) return true;
        }
      }

      return false;
    });
  });

  // --- Project Workspace Filter ---
  readonly selectedProjectId = signal<string>(this.initialSnapshot.activeProjectId || 'ALL');

  // Task Ownership & Access Control Lock
  canEditTask(task: Task | null | undefined): boolean {
    if (!task) return false;
    const role = this.currentUserRole();
    if (role === 'LEAD' || role === 'ADMIN') return true;
    if (role === 'VIEWER') return false;
    const curId = this.currentUserId();
    const assignees = (task.assigneeIds && task.assigneeIds.length > 0)
      ? task.assigneeIds
      : (task.assigneeId ? [task.assigneeId] : []);
    return assignees.length === 0 || assignees.includes(curId);
  }

  // --- Search & Filter Signals ---
  readonly searchQuery = signal<string>('');
  readonly filterAssigneeId = signal<string>('ALL');
  readonly filterPriority = signal<TaskPriority | 'ALL'>('ALL');
  readonly filterBlockedOnly = signal<boolean>(false);
  readonly filterDeployedOnly = signal<boolean>(false);
  readonly filterDueSoon = signal<boolean>(false);

  // --- Active Selected Task (for Drawer) & Global Modal Triggers ---
  readonly selectedTaskId = signal<string | null>(null);
  readonly isCreateTaskModalOpen = signal<boolean>(false);
  readonly isAiQuickCaptureOpen = signal<boolean>(false);
  readonly isImportJsonModalOpen = signal<boolean>(false);

  openCreateTaskModal(): void {
    if (!this.canCreateTasks()) return;
    this.isCreateTaskModalOpen.set(true);
  }

  closeCreateTaskModal(): void {
    this.isCreateTaskModalOpen.set(false);
  }

  openAiQuickCapture(): void {
    if (!this.canCreateTasks()) return;
    this.isAiQuickCaptureOpen.set(true);
  }

  closeAiQuickCapture(): void {
    this.isAiQuickCaptureOpen.set(false);
  }

  openImportJsonModal(): void {
    if (!this.canCreateTasks()) return;
    this.isImportJsonModalOpen.set(true);
  }

  closeImportJsonModal(): void {
    this.isImportJsonModalOpen.set(false);
  }

  readonly selectedTask = computed(() => {
    const id = this.selectedTaskId();
    if (!id) return null;
    return this.tasks().find((t: Task) => t.id === id) || null;
  });

  readonly assigneeMap = computed(() => {
    const map = new Map<string, TeamMember>();
    this.teamMembers().forEach((m: TeamMember) => map.set(m.id, m));
    return map;
  });

  readonly projectMap = computed(() => {
    const map = new Map<string, Project>();
    this.projects().forEach((p: Project) => map.set(p.id, p));
    return map;
  });

  readonly activeProject = computed(() => {
    const pId = this.selectedProjectId();
    if (pId === 'ALL') return null;
    return this.projectMap().get(pId) || null;
  });

  // --- Computed: Member Load Metrics & Recovery Scores (FR-04) ---
  readonly memberLoadMetrics = computed(() => {
    const map = new Map<string, MemberLoadMetric>();
    const tasks = this.tasks();

    for (const member of this.teamMembers()) {
      const activeTasks = tasks.filter((t: Task) => {
        const assignees = (t.assigneeIds && t.assigneeIds.length > 0)
          ? t.assigneeIds
          : (t.assigneeId ? [t.assigneeId] : []);
        return assignees.includes(member.id) && t.status !== 'DONE';
      });
      const activePoints = activeTasks.reduce((sum, t) => {
        const assignees = (t.assigneeIds && t.assigneeIds.length > 0) ? t.assigneeIds : [t.assigneeId || member.id];
        const split = Math.ceil((Number(t.effortPoints) || 0) / Math.max(1, assignees.length));
        return sum + split;
      }, 0);
      const reworkCount = activeTasks.reduce((sum, t) => sum + (Number(t.reworkCount) || 0), 0);
      const effectiveLoad = activePoints + (reworkCount * 3);
      const budget = member.capacityBudget || 15;

      let status: 'OPTIMAL' | 'NEAR_CAPACITY' | 'OVER_BUDGET' = 'OPTIMAL';
      let label = 'Normal Workload';
      if (effectiveLoad > budget) {
        status = 'OVER_BUDGET';
        label = reworkCount > 0 ? 'Overloaded · Rework Active' : 'Overloaded';
      } else if (effectiveLoad > budget * 0.75) {
        status = 'NEAR_CAPACITY';
        label = 'Near Capacity';
      }

      map.set(member.id, {
        memberId: member.id,
        activePoints,
        reworkCount,
        effectiveLoad,
        capacityBudget: budget,
        status,
        label
      });
    }

    return map;
  });

  getMemberLoadMetric(memberId: string): MemberLoadMetric {
    const metric = this.memberLoadMetrics().get(memberId);
    if (metric) return metric;
    return {
      memberId,
      activePoints: 0,
      reworkCount: 0,
      effectiveLoad: 0,
      capacityBudget: 15,
      status: 'OPTIMAL',
      label: 'Normal Workload'
    };
  }

  getStatusLabel(status: TaskStatus): string {
    return STATUS_LABELS[status] || status;
  }

  getTaskMembers(task: Task | null | undefined): TeamMember[] {
    if (!task) return [];
    const map = this.assigneeMap();
    const ids = (task.assigneeIds && task.assigneeIds.length > 0)
      ? task.assigneeIds
      : (task.assigneeId ? [task.assigneeId] : []);
    return ids.map(id => map.get(id)).filter((m): m is TeamMember => !!m);
  }

  // --- Due Soon & Overdue Triage Helpers (within 3 calendar days or overdue, and not Completed) ---
  isTaskDueSoon(task: Task): boolean {
    if (!task || task.status === 'DONE' || !task.dueDate) return false;
    const thresholdIso = addCalendarDays(todayIsoDate(), 3);
    return task.dueDate <= thresholdIso;
  }

  isTaskOverdue(task: Task): boolean {
    if (!task || task.status === 'DONE' || !task.dueDate) return false;
    return task.dueDate < todayIsoDate();
  }

  getDaysUntilDue(task: Task): number {
    if (!task || !task.dueDate) return 0;
    return diffCalendarDays(todayIsoDate(), task.dueDate);
  }

  // --- Computed: Tasks scope for current project (before search/assignee filters) ---
  readonly currentProjectTasks = computed(() => {
    const activeProject = this.selectedProjectId();
    const visibleProjectIds = new Set(this.visibleProjects().map(p => p.id));
    const allowedTasks = this.tasks().filter((t: Task) => visibleProjectIds.has(t.projectId));
    if (activeProject === 'ALL') return allowedTasks;
    return allowedTasks.filter((t: Task) => t.projectId === activeProject);
  });

  readonly dueSoonTasks = computed(() =>
    this.currentProjectTasks()
      .filter((t: Task) => this.isTaskDueSoon(t))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  );

  readonly dueSoonCount = computed(() => this.dueSoonTasks().length);

  // --- Computed: Filtered Tasks List ---
  readonly filteredTasks = computed(() => {
    const activeProject = this.selectedProjectId();
    const query = this.searchQuery().trim().toLowerCase();
    const assignee = this.filterAssigneeId();
    const priority = this.filterPriority();
    const blockedOnly = this.filterBlockedOnly();
    const deployedOnly = this.filterDeployedOnly();
    const dueSoonOnly = this.filterDueSoon();
    const pMap = this.projectMap();
    const visibleProjectIds = new Set(this.visibleProjects().map(p => p.id));

    return this.tasks().filter((task: Task) => {
      if (!visibleProjectIds.has(task.projectId)) return false;
      if (activeProject !== 'ALL' && task.projectId !== activeProject) return false;

      if (blockedOnly && !task.blocked) return false;
      if (deployedOnly && task.status !== 'DEPLOYED') return false;
      if (dueSoonOnly && !this.isTaskDueSoon(task)) return false;

      if (assignee !== 'ALL') {
        const assignees = (task.assigneeIds && task.assigneeIds.length > 0)
          ? task.assigneeIds
          : (task.assigneeId ? [task.assigneeId] : []);
        if (!assignees.includes(assignee)) return false;
      }
      if (priority !== 'ALL' && task.priority !== priority) return false;

      if (query) {
        const titleMatch = task.title.toLowerCase().includes(query);
        const descMatch = (task.description || '').toLowerCase().includes(query);
        const idMatch = task.id.toLowerCase().includes(query);
        const phaseMatch = (task.phase || '').toLowerCase().includes(query);
        const proj = pMap.get(task.projectId);
        const projCodeMatch = proj ? proj.code.toLowerCase().includes(query) : false;
        const taskMembers = this.getTaskMembers(task);
        const nameMatch = taskMembers.some(m => m.name.toLowerCase().includes(query));

        if (!titleMatch && !descMatch && !idMatch && !phaseMatch && !projCodeMatch && !nameMatch) {
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

  // --- Computed: Portfolio & Project KPIs ---
  readonly totalTasksCount = computed(() => this.currentProjectTasks().length);
  readonly doneTasksCount = computed(() => this.currentProjectTasks().filter((t: Task) => t.status === 'DONE').length);

  readonly completionProgressPercent = computed(() => {
    const total = this.totalTasksCount();
    if (total === 0) return 0;
    return Math.round((this.doneTasksCount() / total) * 100);
  });

  readonly readyForServerCheckCount = computed(() =>
    this.currentProjectTasks().filter((t: Task) => t.status === 'DEPLOYED').length
  );

  readonly blockedCount = computed(() =>
    this.currentProjectTasks().filter((t: Task) => t.blocked && t.status !== 'DONE').length
  );

  readonly availableBandwidthMembers = computed(() => {
    const all = this.teamMembers();
    const busyIds = new Set<string>();
    this.currentProjectTasks()
      .filter((t: Task) => t.status === 'TODO' || t.status === 'IN_PROGRESS')
      .forEach((t: Task) => {
        const assignees = (t.assigneeIds && t.assigneeIds.length > 0) ? t.assigneeIds : (t.assigneeId ? [t.assigneeId] : []);
        assignees.forEach(id => busyIds.add(id));
      });
    return all.filter((m: TeamMember) => !busyIds.has(m.id));
  });

  readonly memberWorkloadMap = computed(() => {
    const map = new Map<string, number>();
    this.teamMembers().forEach((m: TeamMember) => map.set(m.id, 0));
    this.currentProjectTasks().forEach((t: Task) => {
      if (t.status !== 'DONE') {
        const assignees = (t.assigneeIds && t.assigneeIds.length > 0) ? t.assigneeIds : (t.assigneeId ? [t.assigneeId] : []);
        assignees.forEach(id => {
          const current = map.get(id) || 0;
          map.set(id, current + 1);
        });
      }
    });
    return map;
  });

  readonly projectPhases = computed(() => {
    const set = new Set<string>();
    this.filteredTasks().forEach((t: Task) => set.add(t.phase || 'Unassigned Phase'));
    return Array.from(set);
  });

  readonly sprints = computed(() => {
    const set = new Set<string>();
    this.filteredTasks().forEach((t: Task) => set.add(t.sprint || 'Sprint Backlog'));
    return Array.from(set);
  });

  // --- Dependency-Driven Scheduling Calculator (Multi-Predecessor max(dueDate) + 1 day) ---
  computeScheduleFromDependencies(
    dependencyIds: string[],
    requestedStart: string,
    requestedDue: string,
    taskPool?: Task[]
  ): {
    startDate: string;
    dueDate: string;
    latestPredDueDate: string | null;
    prerequisiteIds: string[];
    helperText: string;
  } {
    const allTasks = taskPool || this.tasks();
    const cleanDeps = Array.from(new Set((dependencyIds || []).filter(Boolean)));
    const preds = cleanDeps
      .map(id => allTasks.find(t => t.id === id))
      .filter((t): t is Task => !!t && !!t.dueDate);

    const fallbackStart = requestedStart || todayIsoDate();
    const origDuration = Math.max(1, diffCalendarDays(fallbackStart, requestedDue || addCalendarDays(fallbackStart, 3)));

    if (preds.length === 0) {
      const validDue = requestedDue && requestedDue >= fallbackStart
        ? requestedDue
        : addCalendarDays(fallbackStart, origDuration);
      return {
        startDate: fallbackStart,
        dueDate: validDue,
        latestPredDueDate: null,
        prerequisiteIds: [],
        helperText: ''
      };
    }

    // Latest dueDate across all 1..N upstream prerequisites
    let latestDue = preds[0].dueDate;
    for (const p of preds) {
      if (p.dueDate > latestDue) {
        latestDue = p.dueDate;
      }
    }

    const calculatedStart = addCalendarDays(latestDue, 1);
    const nextDue = requestedDue && requestedDue > calculatedStart
      ? requestedDue
      : addCalendarDays(calculatedStart, origDuration);

    const idList = preds.map(p => p.id).join(', ');
    const helperText = `Starts after ${idList} ${preds.length === 1 ? 'finishes' : 'finish'} on ${formatShortDate(latestDue)}`;

    return {
      startDate: calculatedStart,
      dueDate: nextDue,
      latestPredDueDate: latestDue,
      prerequisiteIds: preds.map(p => p.id),
      helperText
    };
  }

  /**
   * Recursively updates downstream dependent tasks whenever an upstream task's dueDate changes
   * so no dependent task ever starts before `max(prerequisite.dueDate) + 1 day`.
   */
  private propagateDownstreamSchedule(inputTasks: Task[]): { tasks: Task[]; shiftedCount: number } {
    const cloned = inputTasks.map(t => ({ ...t, dependencies: [...(t.dependencies || [])] }));
    const taskMap = new Map<string, Task>(cloned.map(t => [t.id, t]));

    let shiftedCount = 0;
    const maxPasses = Math.max(6, cloned.length + 1);

    for (let pass = 0; pass < maxPasses; pass++) {
      let changedInPass = false;
      for (const current of cloned) {
        if (!current.dependencies || current.dependencies.length === 0) continue;

        let latestUpstreamDue: string | null = null;
        let latestUpstreamId = '';
        for (const uId of current.dependencies) {
          const u = taskMap.get(uId);
          if (u && u.dueDate && (!latestUpstreamDue || u.dueDate > latestUpstreamDue)) {
            latestUpstreamDue = u.dueDate;
            latestUpstreamId = u.id;
          }
        }

        if (!latestUpstreamDue) continue;
        const requiredStart = addCalendarDays(latestUpstreamDue, 1);

        if (current.startDate < requiredStart) {
          const currentDuration = Math.max(1, diffCalendarDays(current.startDate, current.dueDate));
          current.startDate = requiredStart;
          if (current.dueDate < addCalendarDays(requiredStart, currentDuration)) {
            current.dueDate = addCalendarDays(requiredStart, currentDuration);
          }
          const baseline = current.baselineDueDate || current.dueDate;
          if (current.dueDate > baseline) {
            current.slipReason = current.slipReason || 'DEPENDENCY_BLOCKED';
            current.slipJustification =
              current.slipJustification || `Auto-shifted after upstream ${latestUpstreamId} completion (${latestUpstreamDue})`;
          }
          current.updatedAt = new Date().toISOString();
          changedInPass = true;
          shiftedCount++;
        }
      }
      if (!changedInPass) break;
    }

    return { tasks: cloned, shiftedCount };
  }

  // --- Computed: Gantt Schedule Metrics & Critical Path (FR-03) ---
  readonly ganttScheduleMetrics = computed<GanttScheduleMetrics>(() => {
    const tasks = this.currentProjectTasks();
    const taskMap = new Map<string, Task>();
    tasks.forEach(t => taskMap.set(t.id, t));

    const conflicts: GanttConflict[] = [];

    // Conflict when downstream starts BEFORE day after upstream finishes (i.e. upstream.dueDate >= downstream.startDate)
    tasks.forEach(downstream => {
      (downstream.dependencies || []).forEach(upstreamId => {
        const upstream = taskMap.get(upstreamId);
        if (upstream && upstream.dueDate >= downstream.startDate) {
          const overlapDays = Math.max(1, diffCalendarDays(downstream.startDate, upstream.dueDate) + 1);
          conflicts.push({
            upstreamTaskId: upstream.id,
            upstreamTitle: upstream.title,
            downstreamTaskId: downstream.id,
            downstreamTitle: downstream.title,
            upstreamDueDate: upstream.dueDate,
            downstreamStartDate: downstream.startDate,
            overlapDays
          });
        }
      });
    });

    // Critical Path Calculation (CPM) using calendar duration (independent of effortPoints)
    const downstreamMap = new Map<string, string[]>();
    tasks.forEach(t => {
      (t.dependencies || []).forEach(uId => {
        if (!downstreamMap.has(uId)) downstreamMap.set(uId, []);
        downstreamMap.get(uId)!.push(t.id);
      });
    });

    const getDurationDays = (t: Task) => Math.max(1, diffCalendarDays(t.startDate, t.dueDate));

    const pathDuration = new Map<string, number>();
    const calculateLongestPath = (taskId: string, visited: Set<string> = new Set()): number => {
      if (pathDuration.has(taskId)) return pathDuration.get(taskId)!;
      if (visited.has(taskId)) return 0;
      visited.add(taskId);

      const task = taskMap.get(taskId);
      if (!task) return 0;
      const dur = getDurationDays(task);
      const downstreams = downstreamMap.get(taskId) || [];
      let maxDownstream = 0;
      for (const dId of downstreams) {
        maxDownstream = Math.max(maxDownstream, calculateLongestPath(dId, new Set(visited)));
      }
      const total = dur + maxDownstream;
      pathDuration.set(taskId, total);
      return total;
    };

    let overallMaxPath = 0;
    tasks.forEach(t => {
      const p = calculateLongestPath(t.id);
      if (p > overallMaxPath) overallMaxPath = p;
    });

    const criticalPathTaskIds = new Set<string>();
    if (overallMaxPath > 0) {
      tasks.forEach(t => {
        const p = pathDuration.get(t.id) || 0;
        if (p === overallMaxPath || (downstreamMap.has(t.id) && p >= overallMaxPath * 0.8)) {
          criticalPathTaskIds.add(t.id);
        }
      });
    }

    return {
      criticalPathTaskIds,
      conflicts,
      hasConflicts: conflicts.length > 0,
      totalSlackDays: new Map()
    };
  });

  // --- Computed: Cycle-Time & Bottleneck Analytics (FR-06) ---
  readonly cycleTimeMetrics = computed<CycleTimeMetrics>(() => {
    const tasks = this.tasks();
    const projects = this.projects();

    const deployedTasks = tasks.filter((t: Task) => t.status === 'DEPLOYED');
    const doneReviewedTasks = tasks.filter((t: Task) => t.status === 'DONE' && t.reviewNotes && t.reviewNotes.length > 0);

    let totalWaitHours = 0;
    let count = 0;
    deployedTasks.forEach((t: Task) => {
      const wait = Math.min(48, Math.max(6, (Number(t.effortPoints) || 3) * 4.5));
      totalWaitHours += wait;
      count++;
    });
    doneReviewedTasks.forEach((t: Task) => {
      const wait = Math.min(36, Math.max(4, (Number(t.effortPoints) || 3) * 3.2));
      totalWaitHours += wait;
      count++;
    });
    const avgLeadSignOffHours = count > 0 ? Math.round((totalWaitHours / count) * 10) / 10 : 8.0;

    const projectBreakdowns: ProjectBottleneckMetric[] = projects.map((p: Project) => {
      const pTasks = tasks.filter((t: Task) => t.projectId === p.id);
      const totalTasks = pTasks.length;
      const pDeployed = pTasks.filter((t: Task) => t.status === 'DEPLOYED').length;
      const reworkTasksList = pTasks.filter((t: Task) => (t.reworkCount || 0) > 0);
      const totalReworkCount = pTasks.reduce((sum, t) => sum + (t.reworkCount || 0), 0);
      const reworkRate = totalTasks > 0 ? Math.round((reworkTasksList.length / totalTasks) * 100) : 0;
      const reworkOverheadPoints = totalReworkCount * 3;
      const avgWait = totalTasks > 0 ? Math.round((8 + (pDeployed * 4.5) + (totalReworkCount * 4)) * 10) / 10 : 0;

      return {
        projectId: p.id,
        projectName: p.name,
        projectCode: p.code,
        color: p.color,
        totalTasks,
        deployedTasks: pDeployed,
        reworkTasks: reworkTasksList.length,
        totalReworkCount,
        reworkRate,
        reworkOverheadPoints,
        avgSignOffWaitHours: avgWait
      };
    });

    const slipMap: Record<NonNullable<SlipReason>, number> = {
      DEPENDENCY_BLOCKED: 0,
      SCOPE_EXPANDED: 0,
      PRODUCTION_HOTFIX: 0,
      UNDERESTIMATED: 0
    };
    let totalDrifted = 0;
    tasks.forEach((t: Task) => {
      if (t.slipReason && slipMap[t.slipReason] !== undefined) {
        slipMap[t.slipReason]++;
        totalDrifted++;
      }
    });

    const slippageBreakdowns: SlippageReasonBreakdown[] = [
      {
        reason: 'DEPENDENCY_BLOCKED',
        label: 'Dependency Blocked',
        count: slipMap['DEPENDENCY_BLOCKED'],
        percentage: totalDrifted > 0 ? Math.round((slipMap['DEPENDENCY_BLOCKED'] / totalDrifted) * 100) : 0
      },
      {
        reason: 'SCOPE_EXPANDED',
        label: 'Scope Expanded',
        count: slipMap['SCOPE_EXPANDED'],
        percentage: totalDrifted > 0 ? Math.round((slipMap['SCOPE_EXPANDED'] / totalDrifted) * 100) : 0
      },
      {
        reason: 'PRODUCTION_HOTFIX',
        label: 'Production Hotfix',
        count: slipMap['PRODUCTION_HOTFIX'],
        percentage: totalDrifted > 0 ? Math.round((slipMap['PRODUCTION_HOTFIX'] / totalDrifted) * 100) : 0
      },
      {
        reason: 'UNDERESTIMATED',
        label: 'Underestimated',
        count: slipMap['UNDERESTIMATED'],
        percentage: totalDrifted > 0 ? Math.round((slipMap['UNDERESTIMATED'] / totalDrifted) * 100) : 0
      }
    ];

    const totalReworkOverheadPoints = tasks.reduce((sum, t) => sum + ((t.reworkCount || 0) * 3), 0);

    return {
      avgLeadSignOffHours,
      totalReworkOverheadPoints,
      totalDriftedTasks: totalDrifted,
      projectBreakdowns,
      slippageBreakdowns
    };
  });

  constructor() {
    // Hydrate from remote PostgreSQL API if enabled in environment.ts
    void this.repo.fetchRemoteState().then(remote => {
      if (!remote) return;
      if (remote.brandName) this.brandName.set(remote.brandName);
      if (remote.projects) this.projects.set(remote.projects);
      if (remote.members) this.teamMembers.set(remote.members);
      if (remote.tasks) this.tasks.set(remote.tasks);
      if (remote.auditLogs) this.activityLogs.set(remote.auditLogs);
    });

    // Sync document title & brand persistence
    effect(() => {
      const brand = this.brandName();
      if (typeof document !== 'undefined') {
        document.title = `${brand} — Project & Task Management`;
      }
      void this.repo.saveBrandName(brand);
    });

    // Sync Light Mode / Dark Mode attribute & repository preference
    effect(() => {
      const mode = this.theme();
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', mode);
      }
      this.repo.saveTheme(mode);
    });

    effect(() => {
      this.repo.saveActiveProject(this.selectedProjectId());
    });

    effect(() => {
      this.repo.saveCurrentUser(this.currentUserId());
    });

    effect(() => {
      void this.repo.saveProjects(this.projects());
    });

    effect(() => {
      void this.repo.saveMembers(this.teamMembers());
    });

    effect(() => {
      void this.repo.saveTasks(this.tasks());
    });

    effect(() => {
      void this.repo.saveRolePolicies(this.rolePolicies());
    });
  }

  // --- Workspace Brand & Fresh-Start Controls ---
  updateBrandName(newBrand: string): boolean {
    if (!this.canCurrentUserManageSharing()) return false;
    const trimmed = newBrand.trim();
    if (!trimmed || trimmed === this.brandName()) return false;

    const prev = this.brandName();
    this.brandName.set(trimmed);

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: 'WORKSPACE_RENAMED',
      taskId: 'WORKSPACE',
      taskTitle: `Workspace Renamed: ${trimmed}`,
      details: `Updated workspace brand name from "${prev}" to "${trimmed}".`
    });
    return true;
  }

  clearAllTasks(): boolean {
    if (!this.canCurrentUserManageSharing()) return false;
    const count = this.tasks().length;
    this.tasks.set([]);
    this.selectedTaskId.set(null);
    void this.repo.saveTasks([]);

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: 'TASKS_CLEARED',
      taskId: 'WORKSPACE',
      taskTitle: 'Cleared All Tasks (Fresh Start)',
      details: `Cleared ${count} task(s) from workspace to start fresh.`
    });
    return true;
  }

  // --- Session Persona Switcher ---
  switchCurrentUser(userId: string): void {
    const member = this.teamMembers().find((m: TeamMember) => m.id === userId);
    if (!member) return;
    this.currentUserId.set(userId);
    this.recordActivity({
      actor: member.name,
      actorAvatar: member.avatar,
      action: 'STATUS_CHANGED',
      taskId: 'AUTH-CTX',
      taskTitle: `Session Active: ${member.name} [${member.systemRole}]`,
      details: `Signed in as ${member.name} (${member.role} • ${member.systemRole})`
    });
  }

  loginWithPersona(memberId: string): void {
    this.switchCurrentUser(memberId);
    this.isAuthenticated.set(true);
    this.repo.saveAuthStatus(true);
  }

  logout(): void {
    this.isAuthenticated.set(false);
    this.repo.saveAuthStatus(false);
  }

  // --- Project Workspace Management ---
  selectProject(projectId: string): void {
    this.selectedProjectId.set(projectId);
  }

  addProject(name: string, code: string, teamName: string = 'Core AI Engineering', description: string = ''): Project {
    const nextId = `proj-${Date.now()}`;
    const colors = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#0891b2', '#db2777'];
    const color = colors[this.projects().length % colors.length];
    const currentMemberId = this.currentUserId();
    const leadIds = this.teamMembers().filter(m => m.systemRole === 'LEAD' || m.systemRole === 'ADMIN').map(m => m.id);
    const memberIds = Array.from(new Set([currentMemberId, ...leadIds]));

    const project: Project = {
      id: nextId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      teamName: teamName.trim() || 'Core AI Engineering',
      description: description.trim() || `Project workspace for ${teamName}`,
      status: 'ACTIVE',
      color,
      memberIds
    };

    this.projects.update((prev: Project[]) => [...prev, project]);
    this.selectedProjectId.set(project.id);

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: 'PROJECT_CREATED',
      taskId: project.code,
      taskTitle: `Project [${project.code}] Created`,
      details: `Project "${project.name}" initialized under ${project.teamName}.`
    });

    return project;
  }

  // --- Team Member Access Role Mapping & CRUD (`Member` | `Lead` | `Manager`) ---
  getMemberAccessRole(member: TeamMember): MemberAccessRole {
    if (member.systemRole === 'ADMIN' || member.role === 'Delivery Manager') {
      return 'Manager';
    }
    if (member.systemRole === 'LEAD' || member.role === 'Tech Lead') {
      return 'Lead';
    }
    return 'Member';
  }

  private resolveRolesFromAccessRole(
    accessRole: MemberAccessRole,
    preferredTechRole?: TechnicalRole
  ): { systemRole: SystemRole; role: TechnicalRole } {
    if (accessRole === 'Manager') {
      return { systemRole: 'ADMIN', role: preferredTechRole || 'Delivery Manager' };
    }
    if (accessRole === 'Lead') {
      return { systemRole: 'LEAD', role: preferredTechRole || 'Tech Lead' };
    }
    const techRole: TechnicalRole =
      preferredTechRole && preferredTechRole !== 'Tech Lead' && preferredTechRole !== 'Delivery Manager'
        ? preferredTechRole
        : 'AI Engineer';
    const sysRole: SystemRole = techRole === 'QA / Test Engineer' ? 'QA' : 'DEV';
    return { systemRole: sysRole, role: techRole };
  }

  private buildInitials(name: string): string {
    return (
      name
        .trim()
        .split(/\s+/)
        .map(part => part[0]?.toUpperCase() || '')
        .slice(0, 2)
        .join('') || 'TM'
    );
  }

  addTeamMember(
    name: string,
    role: TechnicalRole = 'AI Engineer',
    squad: string = 'Core AI Engineering',
    systemRole: SystemRole = 'DEV',
    capacityBudget: number = 15,
    email?: string,
    projectIds?: string[]
  ): TeamMember {
    const nextId = `tm-${Date.now()}-${Math.floor(Math.random() * 100)}`;
    const initials = this.buildInitials(name);
    const colors = ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#d97706', '#db2777'];
    const color = colors[this.teamMembers().length % colors.length];
    const cleanEmail =
      email?.trim() || `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.')}@tcs-ai.internal`;

    const newMember: TeamMember = {
      id: nextId,
      name: name.trim(),
      role,
      systemRole,
      squad: squad.trim() || 'Core AI Engineering',
      avatar: initials,
      email: cleanEmail,
      color,
      department: squad.includes('QA') ? 'Quality Engineering' : 'AI Engineering',
      capacityBudget: Math.max(5, Math.min(40, Number(capacityBudget) || 15))
    };

    this.teamMembers.update((prev: TeamMember[]) => [...prev, newMember]);

    if (Array.isArray(projectIds) && projectIds.length > 0) {
      const targetSet = new Set(projectIds);
      this.projects.update(projs =>
        projs.map(p =>
          targetSet.has(p.id) && !p.memberIds.includes(newMember.id)
            ? { ...p, memberIds: [...p.memberIds, newMember.id] }
            : p
        )
      );
    }

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: 'MEMBER_ADDED',
      taskId: newMember.id,
      taskTitle: `Team Member Added: ${newMember.name}`,
      details: `Added ${newMember.name} (${newMember.email}) as ${newMember.role} [${newMember.systemRole}].`
    });

    return newMember;
  }

  addTeamMemberWithAccessRole(payload: {
    name: string;
    email: string;
    accessRole: MemberAccessRole;
    technicalRole?: TechnicalRole;
    squad?: string;
    capacityBudget?: number;
    projectIds?: string[];
  }): TeamMember | null {
    if (!this.canCurrentUserManageSharing()) return null;
    if (!payload.name.trim()) return null;

    const { systemRole, role } = this.resolveRolesFromAccessRole(payload.accessRole, payload.technicalRole);
    return this.addTeamMember(
      payload.name,
      role,
      payload.squad || 'Core AI Engineering',
      systemRole,
      payload.capacityBudget || 15,
      payload.email,
      payload.projectIds
    );
  }

  updateTeamMemberDetails(
    memberId: string,
    patch: {
      name?: string;
      email?: string;
      accessRole?: MemberAccessRole;
      technicalRole?: TechnicalRole;
      squad?: string;
      capacityBudget?: number;
    }
  ): boolean {
    if (!this.canCurrentUserManageSharing()) return false;
    const existing = this.teamMembers().find(m => m.id === memberId);
    if (!existing) return false;

    const nextName = patch.name !== undefined ? patch.name.trim() || existing.name : existing.name;
    const nextEmail = patch.email !== undefined ? patch.email.trim() || existing.email : existing.email;
    const nextSquad = patch.squad !== undefined ? patch.squad.trim() || existing.squad : existing.squad;
    const nextBudget =
      patch.capacityBudget !== undefined
        ? Math.max(5, Math.min(40, Number(patch.capacityBudget) || existing.capacityBudget))
        : existing.capacityBudget;

    let nextSystemRole = existing.systemRole;
    let nextTechRole = patch.technicalRole || existing.role;
    if (patch.accessRole) {
      const resolved = this.resolveRolesFromAccessRole(patch.accessRole, patch.technicalRole);
      nextSystemRole = resolved.systemRole;
      nextTechRole = resolved.role;
    }

    this.teamMembers.update(list =>
      list.map(m =>
        m.id === memberId
          ? {
              ...m,
              name: nextName,
              avatar: this.buildInitials(nextName),
              email: nextEmail,
              squad: nextSquad,
              capacityBudget: nextBudget,
              role: nextTechRole,
              systemRole: nextSystemRole
            }
          : m
      )
    );

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: 'MEMBER_UPDATED',
      taskId: memberId,
      taskTitle: `Member Updated: ${nextName}`,
      details: `Updated profile for ${nextName} (${nextEmail}) • Role: ${nextTechRole} [${nextSystemRole}].`
    });
    return true;
  }

  removeTeamMember(memberId: string): { success: boolean; error?: string } {
    if (!this.canCurrentUserManageSharing()) {
      return { success: false, error: 'Only Leads or Managers can remove team members.' };
    }
    if (this.teamMembers().length <= 1) {
      return { success: false, error: 'At least one team member must remain in the workspace.' };
    }
    if (memberId === this.currentUserId()) {
      return { success: false, error: 'Switch to another user before removing your active profile.' };
    }

    const target = this.teamMembers().find(m => m.id === memberId);
    if (!target) {
      return { success: false, error: 'Member not found.' };
    }

    this.teamMembers.update(list => list.filter(m => m.id !== memberId));
    this.projects.update(projs =>
      projs.map(p => ({
        ...p,
        memberIds: (p.memberIds || []).filter(id => id !== memberId)
      }))
    );
    this.tasks.update(taskList =>
      taskList.map(t => {
        const nextAssignees = (t.assigneeIds || []).filter(id => id !== memberId);
        return {
          ...t,
          assigneeIds: nextAssignees,
          assigneeId: nextAssignees[0] || ''
        };
      })
    );

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: 'MEMBER_REMOVED',
      taskId: memberId,
      taskTitle: `Member Removed: ${target.name}`,
      details: `Removed ${target.name} (${target.email}) from workspace and unassigned open tasks.`
    });

    return { success: true };
  }

  // --- Live Squad Governance & RBAC Policy Manager (FR-06) ---
  updateMemberGovernance(memberId: string, systemRole: SystemRole, capacityBudget: number): boolean {
    if (!this.canManageGovernance()) return false;

    const member = this.teamMembers().find((m: TeamMember) => m.id === memberId);
    if (!member) return false;

    const prevRole = member.systemRole;
    const prevBudget = member.capacityBudget;
    const newBudget = Math.max(5, Math.min(40, Number(capacityBudget) || 15));

    this.teamMembers.update((members: TeamMember[]) =>
      members.map((m: TeamMember) =>
        m.id === memberId ? { ...m, systemRole, capacityBudget: newBudget } : m
      )
    );

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: 'MEMBER_ROLE_UPDATED',
      taskId: member.id,
      taskTitle: `Governance Policy: ${member.name}`,
      details: `Updated ${member.name}: System Role [${prevRole} -> ${systemRole}], Sprint Budget [${prevBudget} -> ${newBudget} pts].`
    });

    return true;
  }

  toggleProjectMember(projectId: string, memberId: string): boolean {
    if (!this.canCurrentUserManageSharing()) return false;

    const proj = this.projects().find(p => p.id === projectId);
    const member = this.teamMembers().find(m => m.id === memberId);
    if (!proj || !member) return false;

    const currentMembers = Array.isArray(proj.memberIds) ? [...proj.memberIds] : [];
    const isAlreadyMember = currentMembers.includes(memberId);
    const nextMembers = isAlreadyMember
      ? currentMembers.filter(id => id !== memberId)
      : [...currentMembers, memberId];

    if (nextMembers.length === 0) {
      return false;
    }

    this.projects.update(projects =>
      projects.map(p => (p.id === projectId ? { ...p, memberIds: nextMembers } : p))
    );

    this.recordActivity({
      actor: this.currentUser().name,
      actorId: this.currentUserId(),
      actorAvatar: this.currentUser().avatar,
      action: 'SHARING_UPDATED',
      taskId: proj.code,
      taskTitle: `Project Membership: ${proj.name}`,
      details: `${isAlreadyMember ? 'Revoked' : 'Granted'} access for ${member.name} (${member.role}) on ${proj.name} (${proj.code}).`
    });

    return true;
  }

  updateRolePermissionPolicy(role: SystemRole, patch: Partial<RolePermissionPolicy>): boolean {
    if (!this.canCurrentUserManageSharing()) return false;

    this.rolePolicies.update(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        ...patch,
        role
      }
    }));

    const changesSummary = Object.entries(patch)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    this.recordActivity({
      actor: this.currentUser().name,
      actorId: this.currentUserId(),
      actorAvatar: this.currentUser().avatar,
      action: 'PERMISSION_POLICY_UPDATED',
      taskId: `ROLE-${role}`,
      taskTitle: `Role Policy Updated: ${role}`,
      details: `Adjusted capabilities for ${role} [${changesSummary}].`
    });

    return true;
  }

  // --- Compliance Audit Trail Exports ---
  exportAuditLogCsv(): void {
    const logs = this.visibleActivityLogs();
    const headers = ['Log ID', 'Timestamp', 'Actor', 'Action', 'Target ID', 'Target Title', 'Details', 'Transition From', 'Transition To'];
    const rows = logs.map(l => [
      `"${l.id}"`,
      `"${(l.timestamp || '').replace(/"/g, '""')}"`,
      `"${(l.actor || '').replace(/"/g, '""')}"`,
      `"${l.action}"`,
      `"${l.taskId || ''}"`,
      `"${(l.taskTitle || '').replace(/"/g, '""')}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
      `"${l.statusTransition?.from ? this.getStatusLabel(l.statusTransition.from) : ''}"`,
      `"${l.statusTransition?.to ? this.getStatusLabel(l.statusTransition.to) : ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `tcs_ai_audit_log_${todayIsoDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  exportAuditLogJson(): void {
    const logs = this.visibleActivityLogs();
    const jsonContent = JSON.stringify(logs, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `tcs_ai_audit_log_${todayIsoDate()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  getRoleCategory(role: TechnicalRole): RoleCategory {
    switch (role) {
      case 'AI Engineer': return 'AI';
      case 'QA / Test Engineer': return 'QA/TEST';
      case 'Tech Lead': return 'LEAD';
      case 'Delivery Manager': return 'DM';
      case 'Full-Stack Dev':
      default:
        return 'DEV';
    }
  }

  toggleTheme(): void {
    this.theme.update((prev: ThemeMode) => (prev === 'light' ? 'dark' : 'light'));
  }

  selectTask(taskId: string): void {
    this.selectedTaskId.set(taskId);
  }

  closeTaskDrawer(): void {
    this.selectedTaskId.set(null);
  }

  private getNextTaskNumber(): number {
    let maxNum = 100;
    for (const t of this.tasks()) {
      const m = t.id.match(/(\d+)$/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    return maxNum + 1;
  }

  // --- Task CRUD with Decoupled Effort Points, Progress & Multi-Predecessor Scheduling ---
  async createTask(newTaskData: Partial<Task>): Promise<Task | null> {
    if (!this.canCreateTasks()) return null;

    const nextNum = this.getNextTaskNumber();
    const taskId = `TCS-${nextNum}`;

    let projectId = newTaskData.projectId;
    if (!projectId || projectId === 'ALL') {
      const activeP = this.selectedProjectId();
      projectId = activeP !== 'ALL' ? activeP : (this.visibleProjects()[0]?.id || this.projects()[0]?.id || 'proj-1');
    }

    const defaultProj = this.projectMap().get(projectId);
    const fallbackAssignee = defaultProj?.memberIds?.[0] || this.teamMembers()[0]?.id || 'tm-1';
    const assigneeIds = Array.isArray(newTaskData.assigneeIds)
      ? newTaskData.assigneeIds
      : (newTaskData.assigneeId ? [newTaskData.assigneeId] : [fallbackAssignee]);
    const assigneeId = assigneeIds[0] || '';

    const dependencies = Array.from(new Set((newTaskData.dependencies || []).filter(Boolean)));
    const rawStart = newTaskData.startDate || todayIsoDate();
    const rawDue = newTaskData.dueDate || addCalendarDays(rawStart, 4);

    // Enforce multi-predecessor startDate = max(prerequisite.dueDate) + 1 day
    const scheduled = this.computeScheduleFromDependencies(dependencies, rawStart, rawDue);
    const startDate = scheduled.startDate;
    const dueDate = scheduled.dueDate;
    const baselineDueDate = newTaskData.baselineDueDate && newTaskData.baselineDueDate >= startDate
      ? newTaskData.baselineDueDate
      : dueDate;

    const subtasks: Subtask[] = (newTaskData.subtasks || []).map((st, idx) => ({
      ...st,
      id: st.id || `st-${Date.now()}-${idx}`,
      taskId
    }));

    const status: TaskStatus = newTaskData.status || 'TODO';
    let progress = 0;
    if (status === 'DONE') {
      progress = 100;
    } else if (status === 'TODO' && subtasks.length === 0 && typeof newTaskData.progress !== 'number') {
      progress = 0;
    } else if (typeof newTaskData.progress === 'number' && !isNaN(newTaskData.progress)) {
      progress = Math.max(0, Math.min(100, Math.round(newTaskData.progress)));
    } else if (subtasks.length > 0) {
      const completedCount = subtasks.filter(s => s.completed).length;
      progress = Math.round((completedCount / subtasks.length) * 100);
    }

    const pts = Math.max(1, Number(newTaskData.effortPoints ?? newTaskData.storyPoints) || 3);

    const task: Task = {
      id: taskId,
      projectId,
      title: newTaskData.title?.trim() || 'Untitled Task',
      description: newTaskData.description?.trim() || '',
      status,
      priority: newTaskData.priority || 'MEDIUM',
      phase: newTaskData.phase?.trim() || 'Phase 1: Core Execution',
      sprint: newTaskData.sprint?.trim() || 'Sprint 25.1',
      effortPoints: pts,
      storyPoints: pts,
      progress,
      assigneeIds,
      assigneeId,
      startDate,
      dueDate,
      baselineDueDate,
      reworkCount: 0,
      slipReason: null,
      slipJustification: '',
      blocked: newTaskData.blocked || false,
      blockerReason: newTaskData.blockerReason || '',
      deployedUrl: newTaskData.deployedUrl?.trim() || '',
      dependencies,
      subtasks,
      reviewNotes: newTaskData.reviewNotes || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.tasks.update((prev: Task[]) => [task, ...prev]);
    void this.repo.upsertTask(task);

    const member = assigneeId ? this.assigneeMap().get(assigneeId) : undefined;
    const proj = this.projectMap().get(projectId);
    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: 'TASK_CREATED',
      taskId: task.id,
      taskTitle: task.title,
      details: `Created task [${task.id}] in [${proj?.code || 'PROJECT'}] (${startDate} -> ${dueDate}, ${pts} pts) assigned to ${member?.name || 'Unassigned'}.`
    });

    return task;
  }

  async updateTaskAssignees(taskId: string, assigneeIds: string[]): Promise<boolean> {
    const task = this.tasks().find(t => t.id === taskId);
    if (!task || !this.canEditTask(task)) return false;

    const cleanIds = assigneeIds.filter(id => id && this.assigneeMap().has(id));
    const primaryId = cleanIds[0] || '';
    const updatedTask: Task = {
      ...task,
      assigneeIds: cleanIds,
      assigneeId: primaryId,
      updatedAt: new Date().toISOString()
    };

    this.tasks.update((prev: Task[]) =>
      prev.map((t: Task) => (t.id === taskId ? updatedTask : t))
    );
    void this.repo.upsertTask(updatedTask);

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: 'TASK_UPDATED',
      taskId: task.id,
      taskTitle: task.title,
      details: `Updated assignees: ${cleanIds.length > 0 ? cleanIds.map(id => this.assigneeMap().get(id)?.name || id).join(', ') : 'Unassigned'}.`
    });

    return true;
  }

  updateTaskProgress(taskId: string, progress: number): void {
    const task = this.tasks().find(t => t.id === taskId);
    if (!task || !this.canEditTask(task)) return;

    const clamped = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
    const updatedTask: Task = {
      ...task,
      progress: clamped,
      updatedAt: new Date().toISOString()
    };

    this.tasks.update((prev: Task[]) =>
      prev.map((t: Task) => (t.id === taskId ? updatedTask : t))
    );
    void this.repo.upsertTask(updatedTask);
  }

  async updateTask(updated: Task): Promise<void> {
    if (!this.canEditTasks()) return;

    const currentList = this.tasks();
    const old = currentList.find((t: Task) => t.id === updated.id);
    if (old && !this.canEditTask(old)) return;

    // Enforce dependency-driven start date if task has upstream prerequisites
    const scheduled = this.computeScheduleFromDependencies(
      updated.dependencies || [],
      updated.startDate,
      updated.dueDate,
      currentList
    );

    const nextStart = (updated.dependencies && updated.dependencies.length > 0)
      ? scheduled.startDate
      : (updated.startDate || todayIsoDate());
    const minValidDue = nextStart;
    const nextDue = updated.dueDate >= minValidDue ? updated.dueDate : scheduled.dueDate;

    const baseline = updated.baselineDueDate || nextDue;
    let slipReason = updated.slipReason;
    if (nextDue > baseline && !slipReason) {
      slipReason = 'UNDERESTIMATED';
    }

    const pts = Math.max(1, Number(updated.effortPoints ?? updated.storyPoints) || 3);
    let progress = typeof updated.progress === 'number' ? Math.max(0, Math.min(100, Math.round(updated.progress))) : 0;
    if (old && old.status !== updated.status) {
      if (updated.status === 'TODO') progress = 0;
      else if (updated.status === 'DONE') progress = 100;
    }

    const preparedTask: Task = {
      ...updated,
      effortPoints: pts,
      storyPoints: pts,
      progress,
      startDate: nextStart,
      dueDate: nextDue,
      slipReason,
      updatedAt: new Date().toISOString()
    };

    const replacedList = currentList.map((t: Task) => (t.id === preparedTask.id ? preparedTask : t));
    // Recursively shift downstream tasks if dueDate changed
    const { tasks: propagatedList } =
      old && old.dueDate !== preparedTask.dueDate
        ? this.propagateDownstreamSchedule(replacedList)
        : { tasks: replacedList };

    this.tasks.set(propagatedList);
    void this.repo.upsertTask(preparedTask);

    if (old && old.status !== updated.status) {
      const isUnderReview = updated.status === 'DEPLOYED';
      const actor = this.currentUser();
      this.recordActivity({
        actor: actor.name,
        actorAvatar: actor.avatar,
        action: isUnderReview ? 'DEPLOYED_TO_SERVER' : 'STATUS_CHANGED',
        taskId: updated.id,
        taskTitle: updated.title,
        details: `Changed status from "${this.getStatusLabel(old.status)}" to "${this.getStatusLabel(updated.status)}".`,
        statusTransition: { from: old.status, to: updated.status }
      });
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    if (!this.canEditTasks()) return;

    const task = this.tasks().find((t: Task) => t.id === taskId);
    if (!task || !this.canEditTask(task)) return;

    // Also unlink this deleted task from any downstream dependencies
    this.tasks.update((prev: Task[]) =>
      prev
        .filter((t: Task) => t.id !== taskId)
        .map((t: Task) =>
          (t.dependencies || []).includes(taskId)
            ? { ...t, dependencies: t.dependencies.filter(d => d !== taskId) }
            : t
        )
    );
    void this.repo.deleteTask(taskId);

    if (this.selectedTaskId() === taskId) {
      this.selectedTaskId.set(null);
    }

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: 'TASK_DELETED',
      taskId: task.id,
      taskTitle: task.title,
      details: `Deleted task [${task.id}] from workspace.`
    });
  }

  async updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<void> {
    if (!this.canEditTasks()) return;
    if (newStatus === 'DONE' && !this.canSignOffDone()) return;

    const task = this.tasks().find((t: Task) => t.id === taskId);
    if (!task || task.status === newStatus || !this.canEditTask(task)) return;

    const oldStatus = task.status;
    let nextProgress = task.progress;
    if (newStatus === 'TODO') {
      nextProgress = 0;
    } else if (newStatus === 'DONE') {
      nextProgress = 100;
    } else if (oldStatus === 'DONE' && task.subtasks.length > 0) {
      const completed = task.subtasks.filter(s => s.completed).length;
      nextProgress = Math.round((completed / task.subtasks.length) * 100);
    }

    const updatedTask: Task = {
      ...task,
      status: newStatus,
      progress: nextProgress,
      updatedAt: new Date().toISOString()
    };

    this.tasks.update((prev: Task[]) =>
      prev.map((t: Task) => (t.id === taskId ? updatedTask : t))
    );
    void this.repo.upsertTask(updatedTask);

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: newStatus === 'DEPLOYED' ? 'DEPLOYED_TO_SERVER' : 'STATUS_CHANGED',
      taskId: task.id,
      taskTitle: task.title,
      details: `Moved [${task.id}] from "${this.getStatusLabel(oldStatus)}" to "${this.getStatusLabel(newStatus)}".`,
      statusTransition: { from: oldStatus, to: newStatus }
    });
  }

  reorderTasksInColumn(status: TaskStatus, previousIndex: number, currentIndex: number): void {
    if (!this.canEditTasks()) return;

    const all = [...this.tasks()];
    const columnTasks = all.filter((t: Task) => t.status === status);
    if (!columnTasks[previousIndex] || !columnTasks[currentIndex]) return;

    const moved = columnTasks.splice(previousIndex, 1)[0];
    columnTasks.splice(currentIndex, 0, moved);

    const otherTasks = all.filter((t: Task) => t.status !== status);
    this.tasks.set([...otherTasks, ...columnTasks]);
  }

  moveTaskBetweenColumns(taskId: string, targetStatus: TaskStatus, targetIndex: number): void {
    if (!this.canEditTasks()) return;

    const task = this.tasks().find((t: Task) => t.id === taskId);
    if (!task || !this.canEditTask(task)) return;
    if (targetStatus === 'DONE' && !this.canSignOffDone()) return;

    const oldStatus = task.status;
    let nextProgress = task.progress;
    if (targetStatus === 'TODO') nextProgress = 0;
    else if (targetStatus === 'DONE') nextProgress = 100;

    const updated: Task = {
      ...task,
      status: targetStatus,
      progress: nextProgress,
      updatedAt: new Date().toISOString()
    };

    const remaining = this.tasks().filter((t: Task) => t.id !== taskId);
    const targetColumn = remaining.filter((t: Task) => t.status === targetStatus);
    const otherColumns = remaining.filter((t: Task) => t.status !== targetStatus);

    targetColumn.splice(targetIndex, 0, updated);
    this.tasks.set([...otherColumns, ...targetColumn]);
    void this.repo.upsertTask(updated);

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: targetStatus === 'DEPLOYED' ? 'DEPLOYED_TO_SERVER' : 'STATUS_CHANGED',
      taskId: task.id,
      taskTitle: task.title,
      details: `Moved [${task.id}] from "${this.getStatusLabel(oldStatus)}" to "${this.getStatusLabel(targetStatus)}".`,
      statusTransition: { from: oldStatus, to: targetStatus }
    });
  }

  toggleBlocked(taskId: string, reason?: string): void {
    if (!this.canEditTasks()) return;

    const task = this.tasks().find((t: Task) => t.id === taskId);
    if (!task) return;

    const newBlocked = !task.blocked;
    const updatedTask: Task = {
      ...task,
      blocked: newBlocked,
      blockerReason: newBlocked ? reason || 'Waiting on dependency or review input' : '',
      updatedAt: new Date().toISOString()
    };

    this.tasks.update((prev: Task[]) =>
      prev.map((t: Task) => (t.id === taskId ? updatedTask : t))
    );
    void this.repo.upsertTask(updatedTask);

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: 'BLOCKER_TOGGLED',
      taskId: task.id,
      taskTitle: task.title,
      details: newBlocked
        ? `Flagged as Blocked: ${updatedTask.blockerReason}`
        : 'Blocker cleared; work resumed.'
    });
  }

  addReviewNote(
    taskId: string,
    note: { author: string; authorAvatar: string; authorRole: 'LEAD' | 'DM' | 'REVIEWER'; verdict: ReviewVerdict; content: string }
  ): void {
    if (!this.canEditTasks()) return;

    const task = this.tasks().find((t: Task) => t.id === taskId);
    if (!task) return;

    if (note.verdict === 'APPROVED' && !this.canApproveReview()) return;

    const newNote: ReviewNote = {
      id: `rn-${Date.now()}`,
      taskId,
      ...note,
      timestamp: 'Just now'
    };

    const isNeedsChanges = note.verdict === 'NEEDS_CHANGES';
    const newReworkCount = isNeedsChanges ? (task.reworkCount || 0) + 1 : (task.reworkCount || 0);

    const nextStatus: TaskStatus = (note.verdict === 'APPROVED' && task.status === 'DEPLOYED')
      ? 'DONE'
      : (isNeedsChanges && task.status === 'DEPLOYED')
        ? 'IN_PROGRESS'
        : task.status;

    const nextProgress = nextStatus === 'DONE' ? 100 : task.progress;

    const updatedTask: Task = {
      ...task,
      status: nextStatus,
      progress: nextProgress,
      reworkCount: newReworkCount,
      reviewNotes: [newNote, ...(task.reviewNotes || [])],
      updatedAt: new Date().toISOString()
    };

    this.tasks.update((prev: Task[]) =>
      prev.map((t: Task) => (t.id === taskId ? updatedTask : t))
    );
    void this.repo.upsertTask(updatedTask);

    this.recordActivity({
      actor: note.author,
      actorAvatar: note.authorAvatar,
      action: isNeedsChanges ? 'REWORK_PENALTY' : 'REVIEW_NOTE_ADDED',
      taskId: task.id,
      taskTitle: task.title,
      details: isNeedsChanges
        ? `Review [NEEDS CHANGES]: Rework count incremented to ${newReworkCount} (+3 pt workload adjustment). Returned to In Progress.`
        : `Review [${note.verdict}]: "${note.content.substring(0, 80)}"`
    });
  }

  logSlippage(taskId: string, slipReason: SlipReason, newDueDate: string, justification?: string): void {
    if (!this.canEditTasks()) return;

    const task = this.tasks().find((t: Task) => t.id === taskId);
    if (!task) return;

    const oldDate = task.dueDate;
    const updatedList = this.tasks().map((t: Task) =>
      t.id === taskId
        ? {
            ...t,
            dueDate: newDueDate,
            slipReason,
            slipJustification: justification || t.slipJustification,
            updatedAt: new Date().toISOString()
          }
        : t
    );

    const { tasks: propagatedList } = this.propagateDownstreamSchedule(updatedList);
    this.tasks.set(propagatedList);

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: 'SLIPPAGE_LOGGED',
      taskId: task.id,
      taskTitle: task.title,
      details: `Due date updated: ${oldDate} -> ${newDueDate}. Reason: ${slipReason} (${justification || 'Schedule update'}).`
    });
  }

  // --- Multi-Predecessor Dependency Linking + Auto Start-Date Recalculation ---
  addDependency(taskId: string, upstreamTaskId: string): { success: boolean; error?: string } {
    if (!this.canEditTasks()) {
      return { success: false, error: 'Read-only roles cannot modify dependencies.' };
    }
    if (taskId === upstreamTaskId) {
      return { success: false, error: 'A task cannot depend on itself.' };
    }

    const currentTasks = this.tasks();
    const task = currentTasks.find(t => t.id === taskId);
    const upstream = currentTasks.find(t => t.id === upstreamTaskId);
    if (!task || !upstream) {
      return { success: false, error: 'Task not found.' };
    }

    const currentDeps = task.dependencies || [];
    if (currentDeps.includes(upstreamTaskId)) {
      return { success: true };
    }

    const visited = new Set<string>();
    const hasCycle = (currentId: string): boolean => {
      if (currentId === taskId) return true;
      if (visited.has(currentId)) return false;
      visited.add(currentId);
      const curr = currentTasks.find(t => t.id === currentId);
      if (!curr || !curr.dependencies) return false;
      for (const depId of curr.dependencies) {
        if (hasCycle(depId)) return true;
      }
      return false;
    };

    if (hasCycle(upstreamTaskId)) {
      return {
        success: false,
        error: `Circular dependency blocked: [${upstream.id}] already depends on [${task.id}].`
      };
    }

    const nextDeps = [...currentDeps, upstreamTaskId];
    const scheduled = this.computeScheduleFromDependencies(nextDeps, task.startDate, task.dueDate, currentTasks);

    const updatedList = currentTasks.map(t =>
      t.id === taskId
        ? {
            ...t,
            dependencies: nextDeps,
            startDate: scheduled.startDate,
            dueDate: scheduled.dueDate,
            updatedAt: new Date().toISOString()
          }
        : t
    );

    const { tasks: propagatedList } = this.propagateDownstreamSchedule(updatedList);
    this.tasks.set(propagatedList);

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: 'DEPENDENCY_UPDATED',
      taskId: task.id,
      taskTitle: task.title,
      details: `Linked prerequisite [${upstream.id}] -> [${task.id}]. Start date scheduled to ${scheduled.startDate}.`
    });

    return { success: true };
  }

  removeDependency(taskId: string, upstreamTaskId: string): void {
    if (!this.canEditTasks()) return;

    const currentTasks = this.tasks();
    const task = currentTasks.find(t => t.id === taskId);
    if (!task) return;

    const nextDeps = (task.dependencies || []).filter(id => id !== upstreamTaskId);
    let nextStart = task.startDate;
    let nextDue = task.dueDate;
    if (nextDeps.length > 0) {
      const scheduled = this.computeScheduleFromDependencies(nextDeps, task.startDate, task.dueDate, currentTasks);
      nextStart = scheduled.startDate;
      nextDue = scheduled.dueDate;
    }

    this.tasks.update((prev: Task[]) =>
      prev.map(t =>
        t.id === taskId
          ? {
              ...t,
              dependencies: nextDeps,
              startDate: nextStart,
              dueDate: nextDue,
              updatedAt: new Date().toISOString()
            }
          : t
      )
    );

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: 'DEPENDENCY_UPDATED',
      taskId: task.id,
      taskTitle: task.title,
      details: `Removed prerequisite [${upstreamTaskId}] from [${task.id}].`
    });
  }

  cascadeShiftDates(): { shiftedCount: number } {
    if (!this.canEditTasks()) return { shiftedCount: 0 };

    const { tasks: shiftedTasks, shiftedCount } = this.propagateDownstreamSchedule(this.tasks());

    if (shiftedCount > 0) {
      this.tasks.set(shiftedTasks);
      const actor = this.currentUser();
      this.recordActivity({
        actor: actor.name,
        actorAvatar: actor.avatar,
        action: 'CASCADE_SHIFT_DATES',
        taskId: 'GANTT-CASCADE',
        taskTitle: 'Auto-Shift Dependent Dates',
        details: `Auto-shifted ${shiftedCount} dependent task schedule(s) so all tasks start after their prerequisites finish.`
      });
    }

    return { shiftedCount };
  }

  // --- Interactive Subtask Checklists & Automatic Progress Sync ---
  addSubtask(taskId: string, title: string): void {
    if (!this.canEditTasks()) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    this.tasks.update((prev: Task[]) =>
      prev.map((t: Task) => {
        if (t.id === taskId) {
          const newSubtask: Subtask = {
            id: `st-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            taskId,
            title: cleanTitle,
            completed: false,
            createdAt: todayIsoDate()
          };
          const subtasks = [...(t.subtasks || []), newSubtask];
          const completedCount = subtasks.filter(s => s.completed).length;
          const progress = t.status === 'DONE' ? 100 : Math.round((completedCount / subtasks.length) * 100);
          return {
            ...t,
            subtasks,
            progress,
            updatedAt: new Date().toISOString()
          };
        }
        return t;
      })
    );
  }

  toggleSubtask(taskId: string, subtaskId: string): void {
    if (!this.canEditTasks()) return;

    this.tasks.update((prev: Task[]) =>
      prev.map((t: Task) => {
        if (t.id === taskId) {
          const subtasks = (t.subtasks || []).map(st =>
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
          );
          const completedCount = subtasks.filter(s => s.completed).length;
          const progress = subtasks.length > 0
            ? Math.round((completedCount / subtasks.length) * 100)
            : t.progress;
          return { ...t, subtasks, progress, updatedAt: new Date().toISOString() };
        }
        return t;
      })
    );
  }

  deleteSubtask(taskId: string, subtaskId: string): void {
    if (!this.canEditTasks()) return;

    this.tasks.update((prev: Task[]) =>
      prev.map((t: Task) => {
        if (t.id === taskId) {
          const subtasks = (t.subtasks || []).filter(st => st.id !== subtaskId);
          const completedCount = subtasks.filter(s => s.completed).length;
          const progress = subtasks.length > 0
            ? Math.round((completedCount / subtasks.length) * 100)
            : (t.status === 'DONE' ? 100 : 0);
          return { ...t, subtasks, progress, updatedAt: new Date().toISOString() };
        }
        return t;
      })
    );
  }

  // --- JSON Batch Import ---
  importTasksFromJson(rawPayload: SmartImportPayload | string): { success: boolean; count: number; error?: string } {
    if (!this.canCreateTasks()) {
      return { success: false, count: 0, error: 'Current role cannot import tasks.' };
    }

    try {
      let payload: SmartImportPayload;
      if (typeof rawPayload === 'string') {
        try {
          payload = JSON.parse(rawPayload);
        } catch (e: any) {
          return { success: false, count: 0, error: `Invalid JSON syntax: ${e.message}` };
        }
      } else {
        payload = rawPayload;
      }

      if (!payload || !Array.isArray(payload.tasks) || payload.tasks.length === 0) {
        return { success: false, count: 0, error: 'JSON must contain a "tasks" array with at least one task.' };
      }

      let maxNum = this.getNextTaskNumber() - 1;

      const memberMapByName = new Map<string, TeamMember>();
      this.teamMembers().forEach((m: TeamMember) => {
        memberMapByName.set(m.name.toLowerCase().trim(), m);
      });

      const projectMapByCode = new Map<string, Project>();
      this.projects().forEach((p: Project) => {
        projectMapByCode.set(p.code.toUpperCase().trim(), p);
      });

      const existingPool = [...this.tasks()];
      const newTasks: Task[] = [];
      const currentProjects = this.projects();
      const fallbackProjectId = this.selectedProjectId() !== 'ALL'
        ? this.selectedProjectId()
        : (currentProjects[0]?.id || 'proj-1');

      for (const item of payload.tasks) {
        if (!item.title || !item.title.trim()) continue;

        maxNum++;
        const taskId = `TCS-${maxNum}`;

        let taskProjectId = fallbackProjectId;
        if (item.projectCode && item.projectCode.trim()) {
          const cleanCode = item.projectCode.trim().toUpperCase();
          if (projectMapByCode.has(cleanCode)) {
            taskProjectId = projectMapByCode.get(cleanCode)!.id;
          }
        }

        const rawNames: string[] = [];
        if (Array.isArray(item.assigneeNames) && item.assigneeNames.length > 0) {
          rawNames.push(...item.assigneeNames);
        } else if (item.assigneeName && item.assigneeName.trim()) {
          rawNames.push(item.assigneeName.trim());
        }

        const resolvedIds: string[] = [];
        for (const rawName of rawNames) {
          const cleanName = rawName.trim();
          if (!cleanName) continue;
          const lookupKey = cleanName.toLowerCase();

          if (memberMapByName.has(lookupKey)) {
            resolvedIds.push(memberMapByName.get(lookupKey)!.id);
          } else {
            const role: TechnicalRole = item.assigneeRole || 'AI Engineer';
            const squad = item.squad || 'Core AI Engineering';
            const systemRole: SystemRole = role === 'Tech Lead' ? 'LEAD' : role === 'QA / Test Engineer' ? 'QA' : 'DEV';
            const newMember = this.addTeamMember(cleanName, role, squad, systemRole, 15, undefined, [taskProjectId]);
            memberMapByName.set(lookupKey, newMember);
            resolvedIds.push(newMember.id);
          }
        }

        const assigneeIds = resolvedIds;
        const assigneeId = resolvedIds[0] || '';

        const subtasks = (item.subtasks || []).map((subTitle: string, idx: number) => ({
          id: `st-${Date.now()}-${maxNum}-${idx}`,
          taskId,
          title: typeof subTitle === 'string' ? subTitle : (subTitle as any).title || 'Subtask step',
          completed: false,
          createdAt: todayIsoDate()
        }));

        const deps = Array.isArray(item.dependencies) ? item.dependencies : [];
        const rawStart = item.startDate || todayIsoDate();
        const rawDue = item.dueDate || addCalendarDays(rawStart, 5);
        const scheduled = this.computeScheduleFromDependencies(deps, rawStart, rawDue, [...existingPool, ...newTasks]);

        const pts = Math.max(1, Number(item.effortPoints ?? item.storyPoints) || 3);

        const task: Task = normalizeTaskRecord({
          id: taskId,
          projectId: taskProjectId,
          title: item.title.trim(),
          description: item.description?.trim() || '',
          status: 'TODO',
          priority: item.priority || 'MEDIUM',
          phase: item.phase || 'Sprint Backlog',
          sprint: item.sprint || 'Sprint 25.1',
          effortPoints: pts,
          storyPoints: pts,
          progress: typeof item.progress === 'number' ? item.progress : 0,
          assigneeIds,
          assigneeId,
          startDate: scheduled.startDate,
          dueDate: scheduled.dueDate,
          baselineDueDate: scheduled.dueDate,
          reworkCount: 0,
          slipReason: null,
          slipJustification: '',
          blocked: false,
          deployedUrl: item.deployedUrl?.trim() || '',
          dependencies: deps,
          subtasks,
          reviewNotes: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        newTasks.push(task);
      }

      if (newTasks.length === 0) {
        return { success: false, count: 0, error: 'No valid task items could be parsed.' };
      }

      this.tasks.update((prev: Task[]) => [...newTasks, ...prev]);

      const actor = this.currentUser();
      this.recordActivity({
        actor: actor.name,
        actorAvatar: actor.avatar,
        action: 'SMART_IMPORT_BATCH',
        taskId: newTasks[0].id,
        taskTitle: `JSON Import (${newTasks.length} tasks)`,
        details: `Imported ${newTasks.length} task(s) with dependency scheduling and squad resolution.`
      });

      return { success: true, count: newTasks.length };
    } catch (e: any) {
      return { success: false, count: 0, error: e.message || 'Malformed JSON schema.' };
    }
  }

  // --- AI Quick Capture Task Ingestion ---
  createTasksFromAiDrafts(drafts: ExtractedTaskDraft[]): { success: boolean; count: number; error?: string } {
    if (!this.canCreateTasks()) {
      return { success: false, count: 0, error: 'Current role cannot create tasks.' };
    }

    if (!Array.isArray(drafts) || drafts.length === 0) {
      return { success: false, count: 0, error: 'No task drafts provided.' };
    }

    if (drafts.some(d => !!d.assigneeWarning)) {
      return { success: false, count: 0, error: 'Resolve all assignee warnings before importing.' };
    }

    let maxNum = this.getNextTaskNumber() - 1;
    const currentProjects = this.projects();
    const fallbackProjectId = this.selectedProjectId() !== 'ALL'
      ? this.selectedProjectId()
      : (currentProjects[0]?.id || 'proj-1');

    const existingPool = [...this.tasks()];
    const newTasks: Task[] = [];

    for (const draft of drafts) {
      if (!draft.title || !draft.title.trim()) continue;

      maxNum++;
      const taskId = `TCS-${maxNum}`;
      const assigneeIds = Array.isArray(draft.assigneeIds) ? [...draft.assigneeIds] : [];
      const assigneeId = assigneeIds[0] || '';

      const projectId = draft.projectId && draft.projectId !== 'ALL'
        ? draft.projectId
        : fallbackProjectId;

      const deps = Array.isArray(draft.dependencies) ? draft.dependencies : [];
      const rawStart = draft.startDate || todayIsoDate();
      const rawDue = draft.dueDate || addCalendarDays(rawStart, 5);
      const scheduled = this.computeScheduleFromDependencies(deps, rawStart, rawDue, [...existingPool, ...newTasks]);

      const subtasks = (draft.subtasks || []).map((subTitle: string, idx: number) => ({
        id: `st-${Date.now()}-${maxNum}-${idx}`,
        taskId,
        title: typeof subTitle === 'string' ? subTitle : 'Subtask item',
        completed: false,
        createdAt: todayIsoDate()
      }));

      const pts = Math.max(1, Number(draft.effortPoints) || 3);

      const task: Task = {
        id: taskId,
        projectId,
        title: draft.title.trim(),
        description: draft.description?.trim() || '',
        status: 'TODO',
        priority: draft.priority || 'MEDIUM',
        phase: 'Sprint Backlog',
        sprint: 'Sprint 25.1',
        effortPoints: pts,
        storyPoints: pts,
        progress: 0,
        assigneeIds,
        assigneeId,
        startDate: scheduled.startDate,
        dueDate: scheduled.dueDate,
        baselineDueDate: scheduled.dueDate,
        reworkCount: 0,
        slipReason: null,
        slipJustification: '',
        blocked: false,
        deployedUrl: '',
        dependencies: deps,
        subtasks,
        reviewNotes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      newTasks.push(task);
    }

    if (newTasks.length === 0) {
      return { success: false, count: 0, error: 'No valid tasks could be generated from drafts.' };
    }

    this.tasks.update((prev: Task[]) => [...newTasks, ...prev]);

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: 'AI_PROMPT_EXTRACTION',
      taskId: newTasks[0]?.id || 'AI-CAPTURE',
      taskTitle: `AI Quick Capture (${newTasks.length} tasks)`,
      details: `[AI_EXTRACTED] Created ${newTasks.length} task(s) via AI Quick Capture.`
    });

    return { success: true, count: newTasks.length };
  }

  resetWorkspace(): void {
    this.brandName.set(DEFAULT_WORKSPACE_NAME);
    this.projects.set(INITIAL_PROJECTS);
    this.teamMembers.set(INITIAL_TEAM_MEMBERS);
    this.tasks.set(INITIAL_TASKS);
    this.activityLogs.set(INITIAL_LOGS);
    this.selectedProjectId.set('ALL');
    this.currentUserId.set('tm-1');
    this.searchQuery.set('');
    this.filterAssigneeId.set('ALL');
    this.filterPriority.set('ALL');
    this.filterBlockedOnly.set(false);
    this.filterDeployedOnly.set(false);
    this.filterDueSoon.set(false);
    this.currentView.set('BOARD');
    this.selectedTaskId.set(null);
  }

  recordActivity(log: Omit<ActivityLog, 'id' | 'timestamp'> & { actorId?: string }): void {
    const entry: ActivityLog = {
      ...log,
      actorId: log.actorId || this.currentUserId(),
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: 'Just now'
    };

    const nextLogs = [entry, ...this.activityLogs()].slice(0, 100);
    this.activityLogs.set(nextLogs);
    void this.repo.appendAuditLog(entry, nextLogs);
  }
}
