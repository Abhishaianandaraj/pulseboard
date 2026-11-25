import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  Project,
  TeamMember,
  Task,
  ActivityLog,
  RolePermissionPolicy,
  SystemRole,
  ThemeMode
} from '../models/task.model';
import {
  DEFAULT_WORKSPACE_NAME,
  INITIAL_PROJECTS,
  INITIAL_TEAM_MEMBERS,
  INITIAL_TASKS,
  INITIAL_LOGS,
  DEFAULT_ROLE_PERMISSION_POLICIES
} from '../data/seed-data';
import { environment } from '../../environments/environment';

export interface WorkspaceStateSnapshot {
  brandName: string;
  projects: Project[];
  members: TeamMember[];
  tasks: Task[];
  auditLogs: ActivityLog[];
  rolePolicies: Record<SystemRole, RolePermissionPolicy>;
  theme: ThemeMode;
  activeProjectId: string;
  currentUserId: string;
  isAuthenticated: boolean;
}

const STORAGE_KEYS = {
  BRAND: 'tcs_ai_v4_brand',
  PROJECTS: 'tcs_ai_v4_projects',
  MEMBERS: 'tcs_ai_v4_members',
  TASKS: 'tcs_ai_v4_tasks',
  LOGS: 'tcs_ai_v4_logs',
  POLICIES: 'tcs_ai_v4_policies',
  THEME: 'tcs_ai_v4_theme',
  ACTIVE_PROJECT: 'tcs_ai_v4_active_project',
  CURRENT_USER: 'tcs_ai_v4_current_user',
  AUTH: 'tcs_ai_v4_auth'
} as const;

export abstract class TaskRepository {
  abstract loadState(): WorkspaceStateSnapshot;
  abstract fetchRemoteState(): Promise<Partial<WorkspaceStateSnapshot> | null>;
  abstract saveBrandName(brandName: string): Promise<void>;
  abstract saveProjects(projects: Project[]): Promise<void>;
  abstract saveMembers(members: TeamMember[]): Promise<void>;
  abstract saveTasks(tasks: Task[]): Promise<void>;
  abstract upsertTask(task: Task): Promise<void>;
  abstract deleteTask(taskId: string): Promise<void>;
  abstract appendAuditLog(entry: ActivityLog, allLogs: ActivityLog[]): Promise<void>;
  abstract saveRolePolicies(policies: Record<SystemRole, RolePermissionPolicy>): Promise<void>;
  abstract saveTheme(theme: ThemeMode): void;
  abstract saveActiveProject(projectId: string): void;
  abstract saveCurrentUser(userId: string): void;
  abstract saveAuthStatus(isAuthenticated: boolean): void;
}

export function normalizeTaskRecord(t: Task): Task {
  const subtasks = Array.isArray(t.subtasks) ? t.subtasks : [];
  let computedProgress: number;
  if (typeof t.progress === 'number' && !isNaN(t.progress)) {
    computedProgress = Math.max(0, Math.min(100, Math.round(t.progress)));
  } else if (t.status === 'DONE') {
    computedProgress = 100;
  } else if (t.status === 'TODO') {
    computedProgress = 0;
  } else if (subtasks.length > 0) {
    const done = subtasks.filter(s => s.completed).length;
    computedProgress = Math.round((done / subtasks.length) * 100);
  } else {
    computedProgress = t.status === 'DEPLOYED' ? 85 : 35;
  }

  const pts = Number(t.effortPoints ?? t.storyPoints) || 3;
  const assigneeIds = Array.isArray(t.assigneeIds)
    ? t.assigneeIds
    : (t.assigneeId ? [t.assigneeId] : []);

  return {
    ...t,
    effortPoints: pts,
    storyPoints: pts,
    progress: computedProgress,
    assigneeIds,
    assigneeId: assigneeIds[0] || '',
    baselineDueDate: t.baselineDueDate || t.dueDate,
    reworkCount: Number(t.reworkCount) || 0,
    slipReason: t.slipReason || null,
    dependencies: Array.isArray(t.dependencies) ? t.dependencies : [],
    subtasks,
    reviewNotes: Array.isArray(t.reviewNotes) ? t.reviewNotes : []
  };
}

@Injectable()
export class LocalStorageTaskRepository extends TaskRepository {
  loadState(): WorkspaceStateSnapshot {
    const brandName = this.readString(STORAGE_KEYS.BRAND, DEFAULT_WORKSPACE_NAME);

    const rawProjects = this.readJson<Project[] | null>(STORAGE_KEYS.PROJECTS, null);
    const projects = (rawProjects && Array.isArray(rawProjects) && rawProjects.length > 0 ? rawProjects : INITIAL_PROJECTS).map(p => ({
      ...p,
      memberIds: Array.isArray(p.memberIds) ? p.memberIds : []
    }));

    const rawMembers = this.readJson<TeamMember[] | null>(STORAGE_KEYS.MEMBERS, null);
    const members = (rawMembers && Array.isArray(rawMembers) && rawMembers.length > 0 ? rawMembers : INITIAL_TEAM_MEMBERS).map(m => ({
      ...m,
      capacityBudget: Number(m.capacityBudget) || 15,
      systemRole: m.systemRole || 'DEV'
    }));

    // Note: an empty array [] is valid when Lead clicks "Clear All Tasks (Start Fresh)"
    const rawTasks = this.readJson<Task[] | null>(STORAGE_KEYS.TASKS, null);
    const tasks = (rawTasks !== null && Array.isArray(rawTasks) ? rawTasks : INITIAL_TASKS).map(normalizeTaskRecord);

    const rawLogs = this.readJson<ActivityLog[] | null>(STORAGE_KEYS.LOGS, null);
    const auditLogs = rawLogs !== null && Array.isArray(rawLogs) ? rawLogs : INITIAL_LOGS;

    const storedPolicies = this.readJson<Record<SystemRole, RolePermissionPolicy> | null>(STORAGE_KEYS.POLICIES, null);
    const rolePolicies: Record<SystemRole, RolePermissionPolicy> = storedPolicies
      ? {
          ADMIN: { ...DEFAULT_ROLE_PERMISSION_POLICIES.ADMIN, ...(storedPolicies.ADMIN || {}) },
          LEAD: { ...DEFAULT_ROLE_PERMISSION_POLICIES.LEAD, ...(storedPolicies.LEAD || {}) },
          VIEWER: { ...DEFAULT_ROLE_PERMISSION_POLICIES.VIEWER, ...(storedPolicies.VIEWER || {}) },
          DEV: { ...DEFAULT_ROLE_PERMISSION_POLICIES.DEV, ...(storedPolicies.DEV || {}) },
          QA: { ...DEFAULT_ROLE_PERMISSION_POLICIES.QA, ...(storedPolicies.QA || {}) }
        }
      : { ...DEFAULT_ROLE_PERMISSION_POLICIES };

    const rawTheme = this.readString(STORAGE_KEYS.THEME, 'light');
    const theme: ThemeMode = rawTheme === 'dark' ? 'dark' : 'light';
    const activeProjectId = this.readString(STORAGE_KEYS.ACTIVE_PROJECT, 'ALL');
    const currentUserId = this.readString(STORAGE_KEYS.CURRENT_USER, 'tm-1');
    const isAuthenticated = this.readSessionAuth();

    return {
      brandName,
      projects,
      members,
      tasks,
      auditLogs,
      rolePolicies,
      theme,
      activeProjectId,
      currentUserId,
      isAuthenticated
    };
  }

  async fetchRemoteState(): Promise<Partial<WorkspaceStateSnapshot> | null> {
    return null;
  }

  async saveBrandName(brandName: string): Promise<void> {
    this.writeString(STORAGE_KEYS.BRAND, brandName);
  }

  async saveProjects(projects: Project[]): Promise<void> {
    this.writeJson(STORAGE_KEYS.PROJECTS, projects);
  }

  async saveMembers(members: TeamMember[]): Promise<void> {
    this.writeJson(STORAGE_KEYS.MEMBERS, members);
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    this.writeJson(STORAGE_KEYS.TASKS, tasks);
  }

  async upsertTask(task: Task): Promise<void> {
    const existing = this.readJson<Task[]>(STORAGE_KEYS.TASKS, INITIAL_TASKS);
    const idx = existing.findIndex(t => t.id === task.id);
    const next = idx >= 0
      ? existing.map(t => (t.id === task.id ? task : t))
      : [task, ...existing];
    this.writeJson(STORAGE_KEYS.TASKS, next);
  }

  async deleteTask(taskId: string): Promise<void> {
    const existing = this.readJson<Task[]>(STORAGE_KEYS.TASKS, INITIAL_TASKS);
    this.writeJson(
      STORAGE_KEYS.TASKS,
      existing.filter(t => t.id !== taskId)
    );
  }

  async appendAuditLog(_entry: ActivityLog, allLogs: ActivityLog[]): Promise<void> {
    this.writeJson(STORAGE_KEYS.LOGS, allLogs);
  }

  async saveRolePolicies(policies: Record<SystemRole, RolePermissionPolicy>): Promise<void> {
    this.writeJson(STORAGE_KEYS.POLICIES, policies);
  }

  saveTheme(theme: ThemeMode): void {
    this.writeString(STORAGE_KEYS.THEME, theme);
  }

  saveActiveProject(projectId: string): void {
    this.writeString(STORAGE_KEYS.ACTIVE_PROJECT, projectId);
  }

  saveCurrentUser(userId: string): void {
    this.writeString(STORAGE_KEYS.CURRENT_USER, userId);
  }

  saveAuthStatus(isAuthenticated: boolean): void {
    try {
      sessionStorage.setItem(STORAGE_KEYS.AUTH, isAuthenticated ? 'true' : 'false');
    } catch {}
  }

  protected readJson<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        return JSON.parse(raw) as T;
      }
    } catch (e) {
      console.warn(`Failed reading JSON key ${key}`, e);
    }
    return fallback;
  }

  protected writeJson(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`Failed writing JSON key ${key}`, e);
    }
  }

  protected readString(key: string, fallback: string): string {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null && raw.trim().length > 0) {
        return raw;
      }
    } catch {}
    return fallback;
  }

  protected writeString(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }

  protected readSessionAuth(): boolean {
    try {
      const val = sessionStorage.getItem(STORAGE_KEYS.AUTH);
      return val !== 'false';
    } catch {}
    return true;
  }
}

/**
 * PostgreSQL REST Adapter (`environment.useBackendApi = true`).
 * Maps cleanly to local Node/Express or FastAPI endpoints backed by PostgreSQL:
 *   - GET / PUT   /api/projects
 *   - GET / PUT   /api/members
 *   - GET / PUT   /api/tasks
 *   - PUT         /api/tasks/:id
 *   - DELETE      /api/tasks/:id
 *   - GET / POST  /api/audit-logs
 */
@Injectable()
export class PostgresApiTaskRepository extends LocalStorageTaskRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/+$/, '');

  override async fetchRemoteState(): Promise<Partial<WorkspaceStateSnapshot> | null> {
    try {
      const [projects, members, tasks, auditLogs] = await Promise.all([
        firstValueFrom(this.http.get<Project[]>(`${this.baseUrl}/projects`)),
        firstValueFrom(this.http.get<TeamMember[]>(`${this.baseUrl}/members`)),
        firstValueFrom(this.http.get<Task[]>(`${this.baseUrl}/tasks`)),
        firstValueFrom(this.http.get<ActivityLog[]>(`${this.baseUrl}/audit-logs`))
      ]);

      const normalizedTasks = Array.isArray(tasks) ? tasks.map(normalizeTaskRecord) : undefined;
      if (projects) await super.saveProjects(projects);
      if (members) await super.saveMembers(members);
      if (normalizedTasks) await super.saveTasks(normalizedTasks);
      if (auditLogs) this.writeJson(STORAGE_KEYS.LOGS, auditLogs);

      return {
        projects: Array.isArray(projects) ? projects : undefined,
        members: Array.isArray(members) ? members : undefined,
        tasks: normalizedTasks,
        auditLogs: Array.isArray(auditLogs) ? auditLogs : undefined
      };
    } catch (err) {
      console.warn('PostgresApiTaskRepository: Backend API unreachable, operating from local cache.', err);
      return null;
    }
  }

  override async saveBrandName(brandName: string): Promise<void> {
    await super.saveBrandName(brandName);
    try {
      await firstValueFrom(this.http.put(`${this.baseUrl}/workspace/settings`, { brandName }));
    } catch (err) {
      console.warn('PostgresApiTaskRepository.saveBrandName failed:', err);
    }
  }

  override async saveProjects(projects: Project[]): Promise<void> {
    await super.saveProjects(projects);
    try {
      await firstValueFrom(this.http.put(`${this.baseUrl}/projects`, { projects }));
    } catch (err) {
      console.warn('PostgresApiTaskRepository.saveProjects failed:', err);
    }
  }

  override async saveMembers(members: TeamMember[]): Promise<void> {
    await super.saveMembers(members);
    try {
      await firstValueFrom(this.http.put(`${this.baseUrl}/members`, { members }));
    } catch (err) {
      console.warn('PostgresApiTaskRepository.saveMembers failed:', err);
    }
  }

  override async saveTasks(tasks: Task[]): Promise<void> {
    await super.saveTasks(tasks);
    try {
      await firstValueFrom(this.http.put(`${this.baseUrl}/tasks`, { tasks }));
    } catch (err) {
      console.warn('PostgresApiTaskRepository.saveTasks failed:', err);
    }
  }

  override async upsertTask(task: Task): Promise<void> {
    await super.upsertTask(task);
    try {
      await firstValueFrom(
        this.http.put(`${this.baseUrl}/tasks/${encodeURIComponent(task.id)}`, task)
      );
    } catch (err) {
      console.warn('PostgresApiTaskRepository.upsertTask failed:', err);
    }
  }

  override async deleteTask(taskId: string): Promise<void> {
    await super.deleteTask(taskId);
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/tasks/${encodeURIComponent(taskId)}`)
      );
    } catch (err) {
      console.warn('PostgresApiTaskRepository.deleteTask failed:', err);
    }
  }

  override async appendAuditLog(entry: ActivityLog, allLogs: ActivityLog[]): Promise<void> {
    await super.appendAuditLog(entry, allLogs);
    try {
      await firstValueFrom(this.http.post(`${this.baseUrl}/audit-logs`, entry));
    } catch (err) {
      console.warn('PostgresApiTaskRepository.appendAuditLog failed:', err);
    }
  }

  override async saveRolePolicies(policies: Record<SystemRole, RolePermissionPolicy>): Promise<void> {
    await super.saveRolePolicies(policies);
    try {
      await firstValueFrom(this.http.put(`${this.baseUrl}/workspace/policies`, policies));
    } catch (err) {
      console.warn('PostgresApiTaskRepository.saveRolePolicies failed:', err);
    }
  }
}
