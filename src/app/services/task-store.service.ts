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
  RoleCategory
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

@Injectable({
  providedIn: 'root'
})
export class TaskStoreService {
  // --- Core State Signals ---
  readonly projects = signal<Project[]>(this.loadFromStorage(STORAGE_KEY_PROJECTS, INITIAL_PROJECTS));
  readonly teamMembers = signal<TeamMember[]>(this.loadFromStorage(STORAGE_KEY_MEMBERS, INITIAL_TEAM_MEMBERS));
  readonly tasks = signal<Task[]>(this.loadFromStorage(STORAGE_KEY_TASKS, INITIAL_TASKS));
  readonly activityLogs = signal<ActivityLog[]>(this.loadFromStorage(STORAGE_KEY_LOGS, INITIAL_LOGS));
  readonly currentView = signal<MethodologyView>('BOARD');
  readonly theme = signal<ThemeMode>(this.loadTheme());

  // --- Project Workspace Filter ---
  readonly selectedProjectId = signal<string>(this.loadActiveProject());

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

  // --- Computed: Filtered Tasks List (Project + Keyword + Assignee + Priority + Blocked/Deployed) ---
  readonly filteredTasks = computed(() => {
    const activeProject = this.selectedProjectId();
    const query = this.searchQuery().trim().toLowerCase();
    const assignee = this.filterAssigneeId();
    const priority = this.filterPriority();
    const blockedOnly = this.filterBlockedOnly();
    const deployedOnly = this.filterDeployedOnly();
    const map = this.assigneeMap();
    const pMap = this.projectMap();

    return this.tasks().filter((task: Task) => {
      // 1. Project Filter
      if (activeProject !== 'ALL' && task.projectId !== activeProject) return false;

      // 2. Special flags
      if (blockedOnly && !task.blocked) return false;
      if (deployedOnly && task.status !== 'DEPLOYED') return false;

      // 3. Assignee & Priority
      if (assignee !== 'ALL' && task.assigneeId !== assignee) return false;
      if (priority !== 'ALL' && task.priority !== priority) return false;

      // 4. Query text search
      if (query) {
        const titleMatch = task.title.toLowerCase().includes(query);
        const descMatch = (task.description || '').toLowerCase().includes(query);
        const idMatch = task.id.toLowerCase().includes(query);
        const phaseMatch = (task.phase || '').toLowerCase().includes(query);
        const proj = pMap.get(task.projectId);
        const projCodeMatch = proj ? proj.code.toLowerCase().includes(query) : false;
        const assigneeObj = map.get(task.assigneeId);
        const nameMatch = assigneeObj ? assigneeObj.name.toLowerCase().includes(query) : false;

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
    if (activeProject === 'ALL') return this.tasks();
    return this.tasks().filter((t: Task) => t.projectId === activeProject);
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
    const busyIds = new Set(
      this.currentProjectTasks()
        .filter((t: Task) => t.status === 'TODO' || t.status === 'IN_PROGRESS')
        .map((t: Task) => t.assigneeId)
    );
    return all.filter((m: TeamMember) => !busyIds.has(m.id));
  });

  // Workload counts per team member (for sidebar quick filters)
  readonly memberWorkloadMap = computed(() => {
    const map = new Map<string, number>();
    this.teamMembers().forEach((m: TeamMember) => map.set(m.id, 0));
    this.currentProjectTasks().forEach((t: Task) => {
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
    this.filteredTasks().forEach((t: Task) => set.add(t.phase || 'Unassigned Phase'));
    return Array.from(set);
  });

  // Distinct Sprints for Agile Sprint View
  readonly sprints = computed(() => {
    const set = new Set<string>();
    this.filteredTasks().forEach((t: Task) => set.add(t.sprint || 'Sprint Backlog'));
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

    // Auto-persist active project
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE_PROJECT, this.selectedProjectId());
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

  // --- Project Workspace Switcher ---
  selectProject(projectId: string): void {
    this.selectedProjectId.set(projectId);
  }

  addProject(name: string, code: string, teamName: string = 'Core AI Squad', description: string = ''): Project {
    const nextId = `proj-${Date.now()}`;
    const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
    const color = colors[this.projects().length % colors.length];

    const project: Project = {
      id: nextId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      teamName: teamName.trim(),
      description: description.trim() || `Workspace project for ${teamName}`,
      status: 'ACTIVE',
      color
    };

    this.projects.update((prev: Project[]) => [...prev, project]);
    this.selectedProjectId.set(project.id);

    this.recordActivity({
      actor: 'Vikram Rao',
      actorAvatar: 'VR',
      action: 'PROJECT_CREATED',
      taskId: project.code,
      taskTitle: `New Project [${project.code}] Created`,
      details: `Project "${project.name}" initialized under ${project.teamName}`
    });

    return project;
  }

  // --- Team Member Management ---
  addTeamMember(name: string, role: TechnicalRole = 'Full-Stack Dev', squad: string = 'Core AI Squad'): TeamMember {
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
      squad,
      avatar: initials,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@pulseboard.internal`,
      color,
      department: squad.includes('QA') ? 'Quality Assurance' : 'Engineering'
    };

    this.teamMembers.update((prev: TeamMember[]) => [...prev, newMember]);

    this.recordActivity({
      actor: 'Vikram Rao',
      actorAvatar: 'VR',
      action: 'MEMBER_ADDED',
      taskId: newMember.id,
      taskTitle: `Team Member Added: ${newMember.name}`,
      details: `Registered ${newMember.name} as ${newMember.role} in ${newMember.squad}`
    });

    return newMember;
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

    // Use task's projectId or fall back to selected project (or first project if ALL)
    let projectId = newTaskData.projectId;
    if (!projectId || projectId === 'ALL') {
      const activeP = this.selectedProjectId();
      projectId = activeP !== 'ALL' ? activeP : (this.projects()[0]?.id || 'proj-1');
    }

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
    const proj = this.projectMap().get(projectId);
    this.recordActivity({
      actor: 'Vikram Rao',
      actorAvatar: 'VR',
      action: 'TASK_CREATED',
      taskId: task.id,
      taskTitle: task.title,
      details: `Created task [${task.id}] in [${proj?.code || 'PROJECT'}] assigned to ${member?.name || 'Engineer'}`
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
          ? `Pushed container to ${updated.deployedUrl || 'staging endpoint'} awaiting Tech Lead signoff`
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
        actor: 'Vikram Rao',
        actorAvatar: 'VR',
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
      actor: member?.name || 'Vikram Rao',
      actorAvatar: member?.avatar || 'VR',
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
        ? `Task deployed to server! Flagged for QA / Lead inspection.`
        : `Moved card from ${oldStatus} to ${targetStatus}`,
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
      actorAvatar: member?.avatar || 'VR',
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

  // --- Smart Import Batch Ingestion (Enhanced with Project and Auto-Member creation) ---
  importTasksFromJson(payload: SmartImportPayload): { success: boolean; count: number; error?: string } {
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

      const projectsList = this.projects();
      const currentActiveProjectId = this.selectedProjectId();

      const newTasks: Task[] = payload.tasks.map(item => {
        maxNum++;

        // 1. Resolve Project
        let matchedProjectId = currentActiveProjectId !== 'ALL' ? currentActiveProjectId : (projectsList[0]?.id || 'proj-1');
        if (item.projectCode) {
          const foundProject = projectsList.find(p => p.code.toLowerCase() === item.projectCode!.toLowerCase());
          if (foundProject) {
            matchedProjectId = foundProject.id;
          }
        }

        // 2. Resolve Assignee or Auto-Register new team member
        let assignedMemberId = this.teamMembers()[0]?.id || 'tm-1';
        if (item.assigneeName && item.assigneeName.trim()) {
          const nameClean = item.assigneeName.trim();
          let existingMember = this.teamMembers().find(
            (m: TeamMember) => m.name.toLowerCase().includes(nameClean.toLowerCase())
          );

          if (!existingMember) {
            // Auto-create new team member
            const newRole: TechnicalRole = item.assigneeRole || 'Full-Stack Dev';
            const newSquad = item.squad || (item.projectCode === 'EVAL-GW' ? 'Platform & QA Squad' : 'Core AI Squad');
            existingMember = this.addTeamMember(nameClean, newRole, newSquad);
          }
          assignedMemberId = existingMember.id;
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
          projectId: matchedProjectId,
          title: item.title?.trim() || 'AI Imported Task',
          description: item.description?.trim() || 'Extracted from meeting action items.',
          status: 'TODO' as TaskStatus,
          priority: item.priority || 'MEDIUM',
          phase: item.phase?.trim() || 'Phase 1: Knowledge Core',
          sprint: item.sprint?.trim() || 'Sprint 24.3',
          effortPoints: Number(item.effortPoints) || 3,
          assigneeId: assignedMemberId,
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
        actor: 'Vikram Rao',
        actorAvatar: 'VR',
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
      taskTitle: 'PulseBoard V1 Workspace Reset',
      details: 'Restored multi-project workspace, squads, and cross-functional team demo state.'
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
    return 'dark';
  }

  private loadActiveProject(): string {
    try {
      const active = localStorage.getItem(STORAGE_KEY_ACTIVE_PROJECT);
      if (active) return active;
    } catch (e) {}
    return 'ALL';
  }
}
