import { Injectable, signal, computed, effect } from '@angular/core';
import {
  Project,
  Task,
  TaskStatus,
  TaskPriority,
  TeamMember,
  ActivityLog,
  MethodologyView,
  SmartImportPayload,
  ReviewNote,
  ReviewVerdict,
  ThemeMode,
  TechnicalRole,
  RoleCategory,
  SystemRole,
  SlipReason,
  MemberLoadMetric,
  GanttConflict,
  GanttScheduleMetrics,
  ProjectBottleneckMetric,
  SlippageReasonBreakdown,
  CycleTimeMetrics
} from '../models/task.model';
import {
  INITIAL_PROJECTS,
  INITIAL_TEAM_MEMBERS,
  INITIAL_TASKS,
  INITIAL_LOGS
} from '../data/seed-data';

const STORAGE_KEY_PROJECTS = 'pulseboard_v1_projects';
const STORAGE_KEY_MEMBERS = 'pulseboard_v1_members';
const STORAGE_KEY_TASKS = 'pulseboard_v1_tasks';
const STORAGE_KEY_LOGS = 'pulseboard_v1_logs';
const STORAGE_KEY_THEME = 'pulseboard_v1_theme';
const STORAGE_KEY_ACTIVE_PROJECT = 'pulseboard_v1_active_project';
const STORAGE_KEY_CURRENT_USER = 'pulseboard_v1_current_user';
const STORAGE_KEY_AUTH = 'pulseboard_v1_auth';

@Injectable({
  providedIn: 'root'
})
export class TaskStoreService {
  // --- Core State Signals ---
  readonly projects = signal<Project[]>(this.loadProjectsWithDefaults());
  readonly teamMembers = signal<TeamMember[]>(this.loadMembersWithDefaults());
  readonly tasks = signal<Task[]>(this.loadTasksWithDefaults());
  readonly activityLogs = signal<ActivityLog[]>(this.loadFromStorage(STORAGE_KEY_LOGS, INITIAL_LOGS));
  readonly currentView = signal<MethodologyView>('BOARD');
  readonly theme = signal<ThemeMode>(this.loadTheme());

  // --- Active Session & RBAC Context ---
  readonly isAuthenticated = signal<boolean>(this.loadAuthStatus());
  readonly currentUserId = signal<string>(this.loadCurrentUser());

  readonly currentUser = computed<TeamMember>(() => {
    const id = this.currentUserId();
    return this.teamMembers().find((m: TeamMember) => m.id === id) || this.teamMembers()[0];
  });

  readonly currentUserRole = computed<SystemRole>(() => {
    return this.currentUser()?.systemRole || 'DEV';
  });

  // RBAC Permission Computeds
  readonly canCreateTasks = computed(() => this.currentUserRole() !== 'VIEWER');
  readonly canEditTasks = computed(() => this.currentUserRole() !== 'VIEWER');
  readonly canSignOffDone = computed(() => this.currentUserRole() === 'LEAD' || this.currentUserRole() === 'ADMIN');
  readonly canApproveReview = computed(() => this.currentUserRole() === 'LEAD' || this.currentUserRole() === 'ADMIN');
  readonly canManageGovernance = computed(() => this.currentUserRole() === 'LEAD' || this.currentUserRole() === 'ADMIN');
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

  // --- Project Workspace Filter ---
  readonly selectedProjectId = signal<string>(this.loadActiveProject());

  // Task Ownership & Access Control Lock
  canEditTask(task: Task | null | undefined): boolean {
    if (!task) return false;
    const role = this.currentUserRole();
    if (role === 'LEAD' || role === 'ADMIN') return true;
    if (role === 'VIEWER') return false;
    // DEV or QA: editable only if current user is an assignee or task is unassigned
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

  // --- Computed: Map of Projects by ID ---
  readonly projectMap = computed(() => {
    const map = new Map<string, Project>();
    this.projects().forEach((p: Project) => map.set(p.id, p));
    return map;
  });

  // --- Computed: Active Project Object ---
  readonly activeProject = computed(() => {
    const pId = this.selectedProjectId();
    if (pId === 'ALL') return null;
    return this.projectMap().get(pId) || null;
  });

  // --- Computed: Member Load Metrics & Recovery Scores (FR-04) ---
  // Formula: Effective Load = Active Story Points + (Reopened or Failed Builds * 3 pt Recovery Penalty)
  // Multi-assignees split points: Math.ceil(effortPoints / coAssigneesCount)
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
      let label = 'Comfortable Pace';
      if (effectiveLoad > budget) {
        status = 'OVER_BUDGET';
        label = reworkCount > 0 ? 'Overloaded · Fixing Failed Build' : 'Overloaded';
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
      label: 'Optimal'
    };
  }

  getTaskMembers(task: Task | null | undefined): TeamMember[] {
    if (!task) return [];
    const map = this.assigneeMap();
    const ids = (task.assigneeIds && task.assigneeIds.length > 0)
      ? task.assigneeIds
      : (task.assigneeId ? [task.assigneeId] : []);
    return ids.map(id => map.get(id)).filter((m): m is TeamMember => !!m);
  }

  // --- Computed: Filtered Tasks List (Project + Keyword + Assignee + Priority + Blocked/Deployed) ---
  readonly filteredTasks = computed(() => {
    const activeProject = this.selectedProjectId();
    const query = this.searchQuery().trim().toLowerCase();
    const assignee = this.filterAssigneeId();
    const priority = this.filterPriority();
    const blockedOnly = this.filterBlockedOnly();
    const deployedOnly = this.filterDeployedOnly();
    const pMap = this.projectMap();
    const visibleProjectIds = new Set(this.visibleProjects().map(p => p.id));

    return this.tasks().filter((task: Task) => {
      // 0. Project Visibility Scoping
      if (!visibleProjectIds.has(task.projectId)) return false;

      // 1. Project Filter
      if (activeProject !== 'ALL' && task.projectId !== activeProject) return false;

      // 2. Special flags
      if (blockedOnly && !task.blocked) return false;
      if (deployedOnly && task.status !== 'DEPLOYED') return false;

      // 3. Assignee & Priority
      if (assignee !== 'ALL') {
        const assignees = (task.assigneeIds && task.assigneeIds.length > 0)
          ? task.assigneeIds
          : (task.assigneeId ? [task.assigneeId] : []);
        if (!assignees.includes(assignee)) return false;
      }
      if (priority !== 'ALL' && task.priority !== priority) return false;

      // 4. Query text search
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

  // --- Computed: Tasks scope for current project (before search/assignee filters) ---
  readonly currentProjectTasks = computed(() => {
    const activeProject = this.selectedProjectId();
    const visibleProjectIds = new Set(this.visibleProjects().map(p => p.id));
    const allowedTasks = this.tasks().filter((t: Task) => visibleProjectIds.has(t.projectId));
    if (activeProject === 'ALL') return allowedTasks;
    return allowedTasks.filter((t: Task) => t.projectId === activeProject);
  });

  // --- Computed: Kanban Workflow Columns ---
  readonly todoTasks = computed(() => this.filteredTasks().filter((t: Task) => t.status === 'TODO'));
  readonly inProgressTasks = computed(() => this.filteredTasks().filter((t: Task) => t.status === 'IN_PROGRESS'));
  readonly deployedTasks = computed(() => this.filteredTasks().filter((t: Task) => t.status === 'DEPLOYED'));
  readonly doneTasks = computed(() => this.filteredTasks().filter((t: Task) => t.status === 'DONE'));

  // --- Computed: Lead Radar KPIs (Dynamically scoped to active Project) ---
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

  // Available bandwidth: Team members with 0 active tasks in the active scope
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

  // Workload counts per team member (for sidebar quick filters)
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

  // Distinct Phases for Waterfall Timeline
  readonly projectPhases = computed(() => {
    const set = new Set<string>();
    this.filteredTasks().forEach((t: Task) => set.add(t.phase || 'Unassigned Phase'));
    return Array.from(set);
  });

  // Distinct Sprints for Agile Sprint View
  readonly sprints = computed(() => {
    const set = new Set<string>();
    this.filteredTasks().forEach((t: Task) => set.add(t.sprint || 'Sprint Backlog'));
    return Array.from(set);
  });

  // --- Computed: Gantt Schedule Metrics & Critical Path (FR-03) ---
  readonly ganttScheduleMetrics = computed<GanttScheduleMetrics>(() => {
    const tasks = this.currentProjectTasks();
    const taskMap = new Map<string, Task>();
    tasks.forEach(t => taskMap.set(t.id, t));

    const conflicts: GanttConflict[] = [];

    // 1. Detect schedule conflicts: upstream.dueDate > downstream.startDate
    tasks.forEach(downstream => {
      (downstream.dependencies || []).forEach(upstreamId => {
        const upstream = taskMap.get(upstreamId);
        if (upstream) {
          if (upstream.dueDate > downstream.startDate) {
            const uDue = new Date(upstream.dueDate).getTime();
            const dStart = new Date(downstream.startDate).getTime();
            const overlapDays = Math.max(1, Math.round((uDue - dStart) / (1000 * 60 * 60 * 24)));
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
        }
      });
    });

    // 2. Critical Path Calculation (CPM)
    const downstreamMap = new Map<string, string[]>();
    tasks.forEach(t => {
      (t.dependencies || []).forEach(uId => {
        if (!downstreamMap.has(uId)) downstreamMap.set(uId, []);
        downstreamMap.get(uId)!.push(t.id);
      });
    });

    const getDurationDays = (t: Task) => {
      const s = new Date(t.startDate || '2026-11-01').getTime();
      const d = new Date(t.dueDate || '2026-11-15').getTime();
      return Math.max(1, Math.round((d - s) / (1000 * 60 * 60 * 24)));
    };

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

    // 1. Average Lead Sign-off Wait Time
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
    const avgLeadSignOffHours = count > 0 ? Math.round((totalWaitHours / count) * 10) / 10 : 14.5;

    // 2. Project Bottleneck Breakdown
    const projectBreakdowns: ProjectBottleneckMetric[] = projects.map((p: Project) => {
      const pTasks = tasks.filter((t: Task) => t.projectId === p.id);
      const totalTasks = pTasks.length;
      const pDeployed = pTasks.filter((t: Task) => t.status === 'DEPLOYED').length;
      const reworkTasksList = pTasks.filter((t: Task) => (t.reworkCount || 0) > 0);
      const totalReworkCount = pTasks.reduce((sum, t) => sum + (t.reworkCount || 0), 0);
      const reworkRate = totalTasks > 0 ? Math.round((reworkTasksList.length / totalTasks) * 100) : 0;
      const reworkOverheadPoints = totalReworkCount * 3;
      const avgWait = Math.round((12 + (pDeployed * 5.2) + (totalReworkCount * 4)) * 10) / 10;

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

    // 3. Slippage Reason Breakdown
    const slipMap: Record<NonNullable<SlipReason>, number> = {
      'DEPENDENCY_BLOCKED': 0,
      'SCOPE_EXPANDED': 0,
      'PRODUCTION_HOTFIX': 0,
      'UNDERESTIMATED': 0
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

    // Auto-persist active project
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE_PROJECT, this.selectedProjectId());
      } catch (e) {}
    });

    // Auto-persist current user
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY_CURRENT_USER, this.currentUserId());
      } catch (e) {}
    });

    // Auto-persist projects
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(this.projects()));
      } catch (e) {}
    });

    // Auto-persist members
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(this.teamMembers()));
      } catch (e) {}
    });

    // Auto-persist tasks
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(this.tasks()));
      } catch (e) {}
    });

    // Auto-persist activity logs
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(this.activityLogs()));
      } catch (e) {}
    });
  }

  // --- Session Persona Switcher (FR-01 Simulation) ---
  switchCurrentUser(userId: string): void {
    const member = this.teamMembers().find((m: TeamMember) => m.id === userId);
    if (!member) return;
    this.currentUserId.set(userId);
    this.recordActivity({
      actor: member.name,
      actorAvatar: member.avatar,
      action: 'STATUS_CHANGED',
      taskId: 'AUTH-CTX',
      taskTitle: `Session Persona: ${member.name} [${member.systemRole}]`,
      details: `Active session swapped to ${member.name} (${member.role} • ${member.systemRole} permissions active)`
    });
  }

  loginWithPersona(memberId: string): void {
    this.switchCurrentUser(memberId);
    this.isAuthenticated.set(true);
    try {
      sessionStorage.setItem(STORAGE_KEY_AUTH, 'true');
    } catch (e) {}
  }

  logout(): void {
    this.isAuthenticated.set(false);
    try {
      sessionStorage.setItem(STORAGE_KEY_AUTH, 'false');
    } catch (e) {}
  }

  // --- Project Workspace Switcher ---
  selectProject(projectId: string): void {
    this.selectedProjectId.set(projectId);
  }

  addProject(name: string, code: string, teamName: string = 'Core AI Squad', description: string = ''): Project {
    const nextId = `proj-${Date.now()}`;
    const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
    const color = colors[this.projects().length % colors.length];
    const currentMemberId = this.currentUserId();
    const leadIds = this.teamMembers().filter(m => m.systemRole === 'LEAD' || m.systemRole === 'ADMIN').map(m => m.id);
    const memberIds = Array.from(new Set([currentMemberId, ...leadIds]));

    const project: Project = {
      id: nextId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      teamName: teamName.trim(),
      description: description.trim() || `Workspace project for ${teamName}`,
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
      taskTitle: `New Project [${project.code}] Created`,
      details: `Project "${project.name}" initialized under ${project.teamName}`
    });

    return project;
  }

  // --- Team Member Management ---
  addTeamMember(
    name: string,
    role: TechnicalRole = 'Full-Stack Dev',
    squad: string = 'Core AI Squad',
    systemRole: SystemRole = 'DEV',
    capacityBudget: number = 15
  ): TeamMember {
    const nextId = `tm-${Date.now()}`;
    const initials = name
      .trim()
      .split(' ')
      .map(part => part[0]?.toUpperCase() || '')
      .slice(0, 2)
      .join('') || 'DEV';

    const colors = ['#2563eb', '#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
    const color = colors[this.teamMembers().length % colors.length];

    const newMember: TeamMember = {
      id: nextId,
      name: name.trim(),
      role,
      systemRole,
      squad,
      avatar: initials,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@pulseboard.internal`,
      color,
      department: squad.includes('QA') ? 'Quality Assurance' : 'Engineering',
      capacityBudget
    };

    this.teamMembers.update((prev: TeamMember[]) => [...prev, newMember]);

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: 'MEMBER_ADDED',
      taskId: newMember.id,
      taskTitle: `Team Member Added: ${newMember.name}`,
      details: `Registered ${newMember.name} as ${newMember.role} (${newMember.systemRole}) in ${newMember.squad}`
    });

    return newMember;
  }

  // --- Live Squad Governance & RBAC Policy Manager (FR-06) ---
  updateMemberGovernance(memberId: string, systemRole: SystemRole, capacityBudget: number): boolean {
    if (!this.canManageGovernance()) {
      console.warn('RBAC: Only LEAD or ADMIN can update member governance policies.');
      return false;
    }

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
      details: `Updated ${member.name}: System Role [${prevRole} → ${systemRole}], Capacity Budget [${prevBudget} → ${newBudget} pts]`
    });

    return true;
  }

  // --- Compliance Audit Trail CSV Export ---
  exportAuditLogCsv(): void {
    const logs = this.activityLogs();
    const headers = ['Log ID', 'Timestamp', 'Actor', 'Action', 'Target ID', 'Target Title', 'Details', 'Transition From', 'Transition To'];
    const rows = logs.map(l => [
      `"${l.id}"`,
      `"${(l.timestamp || '').replace(/"/g, '""')}"`,
      `"${(l.actor || '').replace(/"/g, '""')}"`,
      `"${l.action}"`,
      `"${l.taskId || ''}"`,
      `"${(l.taskTitle || '').replace(/"/g, '""')}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
      `"${l.statusTransition?.from || ''}"`,
      `"${l.statusTransition?.to || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `pulseboard_audit_trail_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // --- Compliance Audit Trail JSON Export ---
  exportAuditLogJson(): void {
    const logs = this.activityLogs();
    const jsonContent = JSON.stringify(logs, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `pulseboard_audit_trail_${new Date().toISOString().split('T')[0]}.json`);
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

  // --- Task CRUD Methods ---
  async createTask(newTaskData: Partial<Task>): Promise<Task | null> {
    if (!this.canCreateTasks()) {
      console.warn('RBAC: Viewer session cannot create tasks.');
      return null;
    }

    const nextNum = Math.max(
      100,
      ...this.tasks().map((t: Task) => {
        const num = parseInt(t.id.replace('PB-', ''), 10);
        return isNaN(num) ? 0 : num;
      })
    ) + 1;

    const defaultMember = this.teamMembers()[0];
    const assigneeIds = (Array.isArray(newTaskData.assigneeIds) && newTaskData.assigneeIds.length > 0)
      ? newTaskData.assigneeIds
      : [newTaskData.assigneeId || defaultMember.id];
    const assigneeId = newTaskData.assigneeId || assigneeIds[0];

    let projectId = newTaskData.projectId;
    if (!projectId || projectId === 'ALL') {
      const activeP = this.selectedProjectId();
      projectId = activeP !== 'ALL' ? activeP : (this.projects()[0]?.id || 'proj-1');
    }

    const dueDate = newTaskData.dueDate || new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
    const baselineDueDate = newTaskData.baselineDueDate || dueDate;

    const task: Task = {
      id: `PB-${nextNum}`,
      projectId,
      title: newTaskData.title?.trim() || 'Untitled Engineering Task',
      description: newTaskData.description?.trim() || '',
      status: newTaskData.status || 'TODO',
      priority: newTaskData.priority || 'MEDIUM',
      phase: newTaskData.phase?.trim() || 'Phase 1: Knowledge Core',
      sprint: newTaskData.sprint?.trim() || 'Sprint 24.3',
      effortPoints: Number(newTaskData.effortPoints) || 3,
      assigneeIds,
      assigneeId,
      startDate: newTaskData.startDate || new Date().toISOString().split('T')[0],
      dueDate,
      baselineDueDate,
      reworkCount: 0,
      slipReason: null,
      slipJustification: '',
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
    const proj = this.projectMap().get(projectId);
    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: 'TASK_CREATED',
      taskId: task.id,
      taskTitle: task.title,
      details: `Created task [${task.id}] in [${proj?.code || 'PROJECT'}] assigned to ${member?.name || 'Engineer'}`
    });

    return task;
  }

  async updateTaskAssignees(taskId: string, assigneeIds: string[]): Promise<boolean> {
    const task = this.tasks().find(t => t.id === taskId);
    if (!task || !this.canEditTask(task)) return false;

    const cleanIds = assigneeIds.filter(id => id && this.assigneeMap().has(id));
    const primaryId = cleanIds[0] || task.assigneeId || 'tm-1';

    this.tasks.update((prev: Task[]) =>
      prev.map((t: Task) =>
        t.id === taskId
          ? { ...t, assigneeIds: cleanIds, assigneeId: primaryId, updatedAt: new Date().toISOString() }
          : t
      )
    );

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: 'TASK_UPDATED',
      taskId: task.id,
      taskTitle: task.title,
      details: `Updated assignees: ${cleanIds.map(id => this.assigneeMap().get(id)?.name || id).join(', ')}`
    });

    return true;
  }

  async updateTask(updated: Task): Promise<void> {
    if (!this.canEditTasks()) {
      console.warn('RBAC: Viewer session cannot edit tasks.');
      return;
    }

    const currentList = this.tasks();
    const old = currentList.find((t: Task) => t.id === updated.id);

    if (old && !this.canEditTask(old)) {
      console.warn('Ownership lock: Cannot edit task owned by teammate.');
      return;
    }

    // Auto-detect slippage if dueDate shifted past baselineDueDate
    const baseline = updated.baselineDueDate || updated.dueDate;
    let slipReason = updated.slipReason;
    if (updated.dueDate > baseline && !slipReason) {
      slipReason = 'UNDERESTIMATED';
    }

    const preparedTask: Task = {
      ...updated,
      slipReason,
      updatedAt: new Date().toISOString()
    };

    this.tasks.update((prev: Task[]) =>
      prev.map((t: Task) => (t.id === preparedTask.id ? preparedTask : t))
    );

    if (old && old.status !== updated.status) {
      const isDeployed = updated.status === 'DEPLOYED';
      const actor = this.currentUser();
      this.recordActivity({
        actor: actor.name,
        actorAvatar: actor.avatar,
        action: isDeployed ? 'DEPLOYED_TO_SERVER' : 'STATUS_CHANGED',
        taskId: updated.id,
        taskTitle: updated.title,
        details: isDeployed
          ? `Pushed container to ${updated.deployedUrl || 'staging endpoint'} awaiting Tech Lead signoff`
          : `Transitioned status from ${old.status} to ${updated.status}`,
        statusTransition: { from: old.status, to: updated.status }
      });
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    if (!this.canEditTasks()) {
      console.warn('RBAC: Viewer session cannot delete tasks.');
      return;
    }

    const task = this.tasks().find((t: Task) => t.id === taskId);
    if (!task) return;

    if (!this.canEditTask(task)) {
      console.warn('Ownership lock: Cannot delete task owned by teammate.');
      return;
    }

    this.tasks.update((prev: Task[]) => prev.filter((t: Task) => t.id !== taskId));

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
      details: `Deleted task [${task.id}] from project backlog`
    });
  }

  async updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<void> {
    if (!this.canEditTasks()) {
      console.warn('RBAC: Viewer session cannot change task status.');
      return;
    }

    if (newStatus === 'DONE' && !this.canSignOffDone()) {
      console.warn('RBAC: Only Tech Lead or Admin can move tasks to DONE.');
      return;
    }

    const task = this.tasks().find((t: Task) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    if (!this.canEditTask(task)) {
      console.warn('Ownership lock: Cannot change status of task owned by teammate.');
      return;
    }

    const oldStatus = task.status;
    this.tasks.update((prev: Task[]) =>
      prev.map((t: Task) => (t.id === taskId ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t))
    );

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: newStatus === 'DEPLOYED' ? 'DEPLOYED_TO_SERVER' : 'STATUS_CHANGED',
      taskId: task.id,
      taskTitle: task.title,
      details: newStatus === 'DEPLOYED'
        ? `Task deployed to server! Flagged for Tech Lead / QA verification.`
        : `Moved status from ${oldStatus} to ${newStatus}`,
      statusTransition: { from: oldStatus, to: newStatus }
    });
  }

  // Drag and Drop within same column
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

  // Drag and Drop across columns
  moveTaskBetweenColumns(taskId: string, targetStatus: TaskStatus, targetIndex: number): void {
    if (!this.canEditTasks()) return;

    const task = this.tasks().find((t: Task) => t.id === taskId);
    if (!task) return;

    if (!this.canEditTask(task)) {
      console.warn('Ownership lock: Cannot move card owned by teammate.');
      return;
    }

    if (targetStatus === 'DONE' && !this.canSignOffDone()) {
      console.warn('RBAC: Only Tech Lead or Admin can sign off tasks to DONE.');
      return;
    }

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

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: targetStatus === 'DEPLOYED' ? 'DEPLOYED_TO_SERVER' : 'STATUS_CHANGED',
      taskId: task.id,
      taskTitle: task.title,
      details: targetStatus === 'DEPLOYED'
        ? `Task deployed to server! Flagged for QA / Lead inspection.`
        : `Moved card from ${oldStatus} to ${targetStatus}`,
      statusTransition: { from: oldStatus, to: targetStatus }
    });
  }

  // Toggle Blocker
  toggleBlocked(taskId: string, reason?: string): void {
    if (!this.canEditTasks()) return;

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

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
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
    if (!this.canEditTasks()) return;

    const task = this.tasks().find((t: Task) => t.id === taskId);
    if (!task) return;

    // Enforce Lead/Admin sign-off permission for APPROVED verdict
    if (note.verdict === 'APPROVED' && !this.canApproveReview()) {
      console.warn('RBAC: Only Tech Lead or Admin can approve server deployments.');
      return;
    }

    const newNote: ReviewNote = {
      id: `rn-${Date.now()}`,
      taskId,
      ...note,
      timestamp: 'Just now'
    };

    const isNeedsChanges = note.verdict === 'NEEDS_CHANGES';
    const newReworkCount = isNeedsChanges ? (task.reworkCount || 0) + 1 : (task.reworkCount || 0);

    // If approved and deployed -> move to DONE. If needs changes and deployed -> return to IN_PROGRESS
    const nextStatus = (note.verdict === 'APPROVED' && task.status === 'DEPLOYED')
      ? 'DONE'
      : (isNeedsChanges && task.status === 'DEPLOYED')
        ? 'IN_PROGRESS'
        : task.status;

    this.tasks.update((prev: Task[]) =>
      prev.map((t: Task) => {
        if (t.id === taskId) {
          return {
            ...t,
            status: nextStatus,
            reworkCount: newReworkCount,
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
      action: isNeedsChanges ? 'REWORK_PENALTY' : 'REVIEW_NOTE_ADDED',
      taskId: task.id,
      taskTitle: task.title,
      details: isNeedsChanges
        ? `Lead Verification [NEEDS CHANGES]: Rework count incremented to ${newReworkCount} (+3 pt recovery penalty applied). Moved to In Progress.`
        : `Lead Verification [${note.verdict}]: "${note.content.substring(0, 65)}..."`
    });
  }

  // 1-Click Deadline Slippage Grace Protocol (FR-05)
  logSlippage(taskId: string, slipReason: SlipReason, newDueDate: string, justification?: string): void {
    if (!this.canEditTasks()) return;

    const task = this.tasks().find((t: Task) => t.id === taskId);
    if (!task) return;

    const oldDate = task.dueDate;
    this.tasks.update((prev: Task[]) =>
      prev.map((t: Task) =>
        t.id === taskId
          ? {
              ...t,
              dueDate: newDueDate,
              slipReason,
              slipJustification: justification || t.slipJustification,
              updatedAt: new Date().toISOString()
            }
          : t
      )
    );

    const actor = this.currentUser();
    this.recordActivity({
      actor: actor.name,
      actorAvatar: actor.avatar,
      action: 'SLIPPAGE_LOGGED',
      taskId: task.id,
      taskTitle: task.title,
      details: `Schedule extension logged: ${oldDate} ➔ ${newDueDate}. Reason: ${slipReason} (${justification || 'No extra notes'})`
    });
  }

  // --- Dependency Management & Circular Dependency Prevention (FR-03) ---
  addDependency(taskId: string, upstreamTaskId: string): { success: boolean; error?: string } {
    if (!this.canEditTasks()) {
      return { success: false, error: 'RBAC: Viewer session cannot edit dependencies.' };
    }
    if (taskId === upstreamTaskId) {
      return { success: false, error: 'A deliverable cannot depend on itself.' };
    }

    const task = this.tasks().find(t => t.id === taskId);
    const upstream = this.tasks().find(t => t.id === upstreamTaskId);
    if (!task || !upstream) {
      return { success: false, error: 'Task not found.' };
    }

    const currentDeps = task.dependencies || [];
    if (currentDeps.includes(upstreamTaskId)) {
      return { success: true };
    }

    // Circular Dependency Cycle Detection
    const visited = new Set<string>();
    const hasCycle = (currentId: string): boolean => {
      if (currentId === taskId) return true;
      if (visited.has(currentId)) return false;
      visited.add(currentId);
      const curr = this.tasks().find(t => t.id === currentId);
      if (!curr || !curr.dependencies) return false;
      for (const depId of curr.dependencies) {
        if (hasCycle(depId)) return true;
      }
      return false;
    };

    if (hasCycle(upstreamTaskId)) {
      return {
        success: false,
        error: `Circular dependency detected: [${upstream.id}] already depends on [${task.id}]. Loop disallowed.`
      };
    }

    this.tasks.update((prev: Task[]) =>
      prev.map(t =>
        t.id === taskId
          ? {
              ...t,
              dependencies: [...(t.dependencies || []), upstreamTaskId],
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
      details: `Linked prerequisite dependency: [${upstream.id}] ➔ [${task.id}]`
    });

    return { success: true };
  }

  removeDependency(taskId: string, upstreamTaskId: string): void {
    if (!this.canEditTasks()) return;

    const task = this.tasks().find(t => t.id === taskId);
    if (!task) return;

    this.tasks.update((prev: Task[]) =>
      prev.map(t =>
        t.id === taskId
          ? {
              ...t,
              dependencies: (t.dependencies || []).filter(id => id !== upstreamTaskId),
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
      details: `Unlinked prerequisite dependency [${upstreamTaskId}] from [${task.id}]`
    });
  }

  // --- Automated Cascade Date Shift (FR-03 Domino Delay Prevention) ---
  cascadeShiftDates(): { shiftedCount: number } {
    if (!this.canEditTasks()) {
      console.warn('RBAC: Viewer session cannot cascade shift dates.');
      return { shiftedCount: 0 };
    }

    const tasks = [...this.tasks()];
    const taskMap = new Map<string, Task>();
    tasks.forEach(t => taskMap.set(t.id, { ...t, dependencies: [...(t.dependencies || [])] }));

    let shiftedCount = 0;
    // Iterate to propagate shifts down chains
    for (let pass = 0; pass < 5; pass++) {
      let changedInPass = false;
      for (const task of tasks) {
        const current = taskMap.get(task.id)!;
        for (const upstreamId of current.dependencies) {
          const upstream = taskMap.get(upstreamId);
          if (upstream && upstream.dueDate > current.startDate) {
            const upstreamDueTs = new Date(upstream.dueDate).getTime();
            const currentStartTs = new Date(current.startDate).getTime();
            const currentDueTs = new Date(current.dueDate).getTime();
            const durationMs = Math.max(86400000, currentDueTs - currentStartTs);

            const newStart = upstream.dueDate;
            const newDue = new Date(upstreamDueTs + durationMs).toISOString().split('T')[0];

            current.startDate = newStart;
            current.dueDate = newDue;
            if (newDue > (current.baselineDueDate || current.dueDate)) {
              current.slipReason = current.slipReason || 'DEPENDENCY_BLOCKED';
              current.slipJustification = current.slipJustification || `Auto-shifted to accommodate upstream [${upstream.id}] delivery`;
            }
            current.updatedAt = new Date().toISOString();
            changedInPass = true;
            shiftedCount++;
          }
        }
      }
      if (!changedInPass) break;
    }

    if (shiftedCount > 0) {
      this.tasks.set(Array.from(taskMap.values()));
      const actor = this.currentUser();
      this.recordActivity({
        actor: actor.name,
        actorAvatar: actor.avatar,
        action: 'CASCADE_SHIFT_DATES',
        taskId: 'GANTT-CASCADE',
        taskTitle: 'Cascade Shift Downstream Dates',
        details: `Auto-shifted ${shiftedCount} downstream dependent delivery window(s) to resolve schedule conflicts.`
      });
    }

    return { shiftedCount };
  }

  // Subtask Checklists
  addSubtask(taskId: string, title: string): void {
    if (!this.canEditTasks()) return;

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
    if (!this.canEditTasks()) return;

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
    if (!this.canEditTasks()) return;

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

  // --- Smart Import Batch Ingestion (Enhanced with Project, Multi-Assignees and Auto-Member creation) ---
  importTasksFromJson(payload: SmartImportPayload): { success: boolean; count: number; error?: string } {
    if (!this.canCreateTasks()) {
      return { success: false, count: 0, error: 'RBAC: Viewer session cannot import tasks.' };
    }

    try {
      if (!payload || !Array.isArray(payload.tasks) || payload.tasks.length === 0) {
        return { success: false, count: 0, error: 'JSON must contain a "tasks" array with at least one task.' };
      }

      let maxNum = Math.max(
        100,
        ...this.tasks().map((t: Task) => {
          const num = parseInt(t.id.replace('PB-', ''), 10);
          return isNaN(num) ? 0 : num;
        })
      );

      const memberMapByName = new Map<string, TeamMember>();
      this.teamMembers().forEach((m: TeamMember) => {
        memberMapByName.set(m.name.toLowerCase().trim(), m);
      });

      const projectMapByCode = new Map<string, Project>();
      this.projects().forEach((p: Project) => {
        projectMapByCode.set(p.code.toUpperCase().trim(), p);
      });

      const newTasks: Task[] = [];
      const currentProjects = this.projects();
      const fallbackProjectId = this.selectedProjectId() !== 'ALL'
        ? this.selectedProjectId()
        : (currentProjects[0]?.id || 'proj-1');

      for (const item of payload.tasks) {
        if (!item.title || !item.title.trim()) continue;

        maxNum++;
        const taskId = `PB-${maxNum}`;

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
            const role: TechnicalRole = item.assigneeRole || 'Full-Stack Dev';
            const squad = item.squad || 'Core AI Squad';
            const systemRole: SystemRole = role === 'Tech Lead' ? 'LEAD' : role === 'QA / Test Engineer' ? 'QA' : 'DEV';
            const newMember = this.addTeamMember(cleanName, role, squad, systemRole, 15);
            memberMapByName.set(lookupKey, newMember);
            resolvedIds.push(newMember.id);
          }
        }

        if (resolvedIds.length === 0) {
          resolvedIds.push(this.teamMembers()[0]?.id || 'tm-1');
        }

        const assigneeIds = resolvedIds;
        const assigneeId = resolvedIds[0];

        let taskProjectId = fallbackProjectId;
        if (item.projectCode && item.projectCode.trim()) {
          const cleanCode = item.projectCode.trim().toUpperCase();
          if (projectMapByCode.has(cleanCode)) {
            taskProjectId = projectMapByCode.get(cleanCode)!.id;
          }
        }

        const subtasks = (item.subtasks || []).map((subTitle: string, idx: number) => ({
          id: `st-${Date.now()}-${maxNum}-${idx}`,
          taskId,
          title: typeof subTitle === 'string' ? subTitle : (subTitle as any).title || 'Subtask step',
          completed: false,
          createdAt: new Date().toISOString().split('T')[0]
        }));

        const dueDate = item.dueDate || new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0];

        const task: Task = {
          id: taskId,
          projectId: taskProjectId,
          title: item.title.trim(),
          description: item.description?.trim() || '',
          status: 'TODO',
          priority: item.priority || 'MEDIUM',
          phase: item.phase || 'Sprint Backlog',
          sprint: item.sprint || 'Sprint 24.3',
          effortPoints: Number(item.effortPoints) || 3,
          assigneeIds,
          assigneeId,
          startDate: item.startDate || new Date().toISOString().split('T')[0],
          dueDate,
          baselineDueDate: dueDate,
          reworkCount: 0,
          slipReason: null,
          slipJustification: '',
          blocked: false,
          deployedUrl: item.deployedUrl?.trim() || '',
          dependencies: [],
          subtasks,
          reviewNotes: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

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
        taskId: `PB-${maxNum}`,
        taskTitle: `Batch Ingestion (${newTasks.length} tasks)`,
        details: `Imported ${newTasks.length} engineering deliverables with auto-team resolution.`
      });

      return { success: true, count: newTasks.length };
    } catch (e: any) {
      return { success: false, count: 0, error: e.message || 'Malformed JSON schema.' };
    }
  }

  // --- Reset Workspace ---
  resetWorkspace(): void {
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
    this.currentView.set('BOARD');
    this.selectedTaskId.set(null);

    this.recordActivity({
      actor: 'Vikram Rao',
      actorAvatar: 'VR',
      action: 'WORKSPACE_RESET',
      taskId: 'SYS-0',
      taskTitle: 'PulseBoard V2 Workspace Reset',
      details: 'Restored multi-project workspace, squads, capacity budgets, and cross-functional team demo state.'
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

  private loadProjectsWithDefaults(): Project[] {
    const projects = this.loadFromStorage<Project[]>(STORAGE_KEY_PROJECTS, INITIAL_PROJECTS);
    return projects.map((p: Project) => {
      const init = INITIAL_PROJECTS.find(ip => ip.id === p.id);
      return {
        ...p,
        memberIds: (Array.isArray(p.memberIds) && p.memberIds.length > 0)
          ? p.memberIds
          : (init?.memberIds || ['tm-1', 'tm-2', 'tm-3', 'tm-4', 'tm-5', 'tm-6'])
      };
    });
  }

  private loadMembersWithDefaults(): TeamMember[] {
    const members = this.loadFromStorage<TeamMember[]>(STORAGE_KEY_MEMBERS, INITIAL_TEAM_MEMBERS);
    return members.map((m: TeamMember) => ({
      ...m,
      capacityBudget: m.capacityBudget || 15,
      systemRole: m.systemRole || (m.role === 'Tech Lead' ? 'LEAD' : m.role === 'QA / Test Engineer' ? 'QA' : m.role === 'Delivery Manager' ? 'VIEWER' : 'DEV')
    }));
  }

  private loadTasksWithDefaults(): Task[] {
    const tasks = this.loadFromStorage<Task[]>(STORAGE_KEY_TASKS, INITIAL_TASKS);
    return tasks.map((t: Task) => {
      const init = INITIAL_TASKS.find(it => it.id === t.id);
      const assigneeIds = (Array.isArray(t.assigneeIds) && t.assigneeIds.length > 0)
        ? t.assigneeIds
        : (init?.assigneeIds || (t.assigneeId ? [t.assigneeId] : ['tm-1']));
      const assigneeId = t.assigneeId || assigneeIds[0] || 'tm-1';
      return {
        ...t,
        assigneeIds,
        assigneeId,
        baselineDueDate: t.baselineDueDate || t.dueDate,
        reworkCount: t.reworkCount || 0,
        slipReason: t.slipReason || null,
        dependencies: Array.isArray(t.dependencies) ? t.dependencies : []
      };
    });
  }

  private loadCurrentUser(): string {
    try {
      const user = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
      if (user) return user;
    } catch (e) {}
    return 'tm-1'; // Abhishai (DEV)
  }

  private loadTheme(): ThemeMode {
    try {
      const theme = localStorage.getItem(STORAGE_KEY_THEME) as ThemeMode;
      if (theme === 'light' || theme === 'dark') return theme;
    } catch (e) {}
    return 'dark';
  }

  private loadActiveProject(): string {
    try {
      const active = localStorage.getItem(STORAGE_KEY_ACTIVE_PROJECT);
      if (active) return active;
    } catch (e) {}
    return 'ALL';
  }

  private loadAuthStatus(): boolean {
    try {
      const val = sessionStorage.getItem(STORAGE_KEY_AUTH);
      return val !== 'false';
    } catch (e) {}
    return true;
  }
}
