import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CdkDragDrop,
  DragDropModule
} from '@angular/cdk/drag-drop';
import { TaskStoreService } from './services/task-store.service';
import {
  Project,
  Task,
  TaskStatus,
  TaskPriority,
  MethodologyView,
  Subtask,
  TeamMember,
  TechnicalRole
} from './models/task.model';
import { TaskDrawerComponent } from './components/task-drawer.component';
import { ImportModalComponent } from './components/import-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    TaskDrawerComponent,
    ImportModalComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  protected readonly store = inject(TaskStoreService);

  readonly statusColumns: Array<{
    status: TaskStatus;
    title: string;
    description: string;
    accentColor: string;
  }> = [
    {
      status: 'TODO',
      title: 'To Do',
      description: 'Backlog & planned work',
      accentColor: 'var(--status-todo)'
    },
    {
      status: 'IN_PROGRESS',
      title: 'In Progress',
      description: 'Actively in development',
      accentColor: 'var(--status-inprogress)'
    },
    {
      status: 'DEPLOYED',
      title: 'Deployed to Server',
      description: 'Staged on GPU/Cloud, ready for verification',
      accentColor: 'var(--status-deployed)'
    },
    {
      status: 'DONE',
      title: 'Done',
      description: 'Verified & closed',
      accentColor: 'var(--status-done)'
    }
  ];

  readonly dropListIds: string[] = ['list-TODO', 'list-IN_PROGRESS', 'list-DEPLOYED', 'list-DONE'];

  // Modal / Sidebar UI signals
  readonly isSidebarCollapsed = signal<boolean>(false);
  readonly isNewTaskModalOpen = signal<boolean>(false);
  readonly isSmartImportModalOpen = signal<boolean>(false);
  readonly isActivityDrawerOpen = signal<boolean>(false);
  readonly isNewProjectModalOpen = signal<boolean>(false);
  readonly isAddMemberFormOpen = signal<boolean>(false);

  // New Project Form State
  newProjectName = '';
  newProjectCode = '';
  newProjectTeam = 'Core AI Squad';
  newProjectDesc = '';

  // New Member Form State
  newMemberName = '';
  newMemberRole: TechnicalRole = 'Full-Stack Dev';
  newMemberSquad = 'Core AI Squad';

  // New Task Form State
  newTaskTitle = '';
  newTaskDescription = '';
  newTaskProjectId = '';
  newTaskAssigneeId = '';
  newTaskPriority: TaskPriority = 'MEDIUM';
  newTaskPhase = 'Phase 2: Serving Engine';
  newTaskSprint = 'Sprint 24.3';
  newTaskEffort = 3;
  newTaskStartDate = new Date().toISOString().split('T')[0];
  newTaskDueDate = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
  newTaskDeployedUrl = '';
  newTaskInitialSubtasks = '';

  toggleSidebar(): void {
    this.isSidebarCollapsed.update((v: boolean) => !v);
  }

  switchView(view: MethodologyView): void {
    this.store.currentView.set(view);
  }

  // Drag and drop handler
  onTaskDrop(event: CdkDragDrop<Task[], Task[], Task>): void {
    if (event.previousContainer === event.container) {
      const status = event.container.id.replace('list-', '') as TaskStatus;
      this.store.reorderTasksInColumn(status, event.previousIndex, event.currentIndex);
    } else {
      const draggedTask = event.item.data as Task;
      const targetStatus = event.container.id.replace('list-', '') as TaskStatus;
      this.store.moveTaskBetweenColumns(draggedTask.id, targetStatus, event.currentIndex);
    }
  }

  // Quick Filters
  setAssigneeFilter(id: string): void {
    this.store.filterAssigneeId.set(id);
  }

  setPriorityFilter(priority: TaskPriority | 'ALL'): void {
    this.store.filterPriority.set(priority);
  }

  toggleBlockedFilter(): void {
    this.store.filterBlockedOnly.update((v: boolean) => !v);
  }

  toggleDeployedFilter(): void {
    this.store.filterDeployedOnly.update((v: boolean) => !v);
  }

  clearAllFilters(): void {
    this.store.searchQuery.set('');
    this.store.filterAssigneeId.set('ALL');
    this.store.filterPriority.set('ALL');
    this.store.filterBlockedOnly.set(false);
    this.store.filterDeployedOnly.set(false);
  }

  hasActiveFilters(): boolean {
    return (
      this.store.searchQuery().length > 0 ||
      this.store.filterAssigneeId() !== 'ALL' ||
      this.store.filterPriority() !== 'ALL' ||
      this.store.filterBlockedOnly() ||
      this.store.filterDeployedOnly()
    );
  }

  // Project Switcher
  selectProject(projectId: string): void {
    this.store.selectProject(projectId);
  }

  openNewProjectModal(): void {
    this.newProjectName = '';
    this.newProjectCode = '';
    this.newProjectTeam = 'Core AI Squad';
    this.newProjectDesc = '';
    this.isNewProjectModalOpen.set(true);
  }

  closeNewProjectModal(): void {
    this.isNewProjectModalOpen.set(false);
  }

  submitNewProject(): void {
    if (!this.newProjectName.trim() || !this.newProjectCode.trim()) return;
    this.store.addProject(
      this.newProjectName,
      this.newProjectCode,
      this.newProjectTeam,
      this.newProjectDesc
    );
    this.closeNewProjectModal();
  }

  // Add Member Inline Form
  toggleAddMemberForm(): void {
    this.isAddMemberFormOpen.update(v => !v);
    this.newMemberName = '';
    this.newMemberRole = 'Full-Stack Dev';
    this.newMemberSquad = 'Core AI Squad';
  }

  submitNewMember(): void {
    if (!this.newMemberName.trim()) return;
    this.store.addTeamMember(
      this.newMemberName,
      this.newMemberRole,
      this.newMemberSquad
    );
    this.isAddMemberFormOpen.set(false);
  }

  // Task selection & detail drawer
  openTask(taskId: string): void {
    this.store.selectTask(taskId);
  }

  // New Task Modal handlers
  openNewTaskModal(): void {
    this.newTaskTitle = '';
    this.newTaskDescription = '';
    const activeP = this.store.selectedProjectId();
    this.newTaskProjectId = activeP !== 'ALL' ? activeP : (this.store.projects()[0]?.id || 'proj-1');
    this.newTaskAssigneeId = this.store.teamMembers()[0]?.id || 'tm-1';
    this.newTaskPriority = 'MEDIUM';
    this.newTaskPhase = 'Phase 2: Serving Engine';
    this.newTaskSprint = 'Sprint 24.3';
    this.newTaskEffort = 3;
    this.newTaskStartDate = new Date().toISOString().split('T')[0];
    this.newTaskDueDate = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
    this.newTaskDeployedUrl = '';
    this.newTaskInitialSubtasks = '';
    this.isNewTaskModalOpen.set(true);
  }

  closeNewTaskModal(): void {
    this.isNewTaskModalOpen.set(false);
  }

  submitNewTask(): void {
    if (!this.newTaskTitle.trim()) return;

    const subtasks: Subtask[] = this.newTaskInitialSubtasks
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0)
      .map((title: string, idx: number) => ({
        id: `st-init-${Date.now()}-${idx}`,
        taskId: '',
        title,
        completed: false,
        createdAt: new Date().toISOString().split('T')[0]
      }));

    this.store.createTask({
      projectId: this.newTaskProjectId,
      title: this.newTaskTitle.trim(),
      description: this.newTaskDescription.trim(),
      assigneeId: this.newTaskAssigneeId,
      priority: this.newTaskPriority,
      phase: this.newTaskPhase.trim(),
      sprint: this.newTaskSprint.trim(),
      effortPoints: Number(this.newTaskEffort) || 3,
      startDate: this.newTaskStartDate,
      dueDate: this.newTaskDueDate,
      deployedUrl: this.newTaskDeployedUrl.trim(),
      subtasks
    });

    this.closeNewTaskModal();
  }

  // Smart Import Modal handlers
  openSmartImport(): void {
    this.isSmartImportModalOpen.set(true);
  }

  closeSmartImport(): void {
    this.isSmartImportModalOpen.set(false);
  }

  // Activity Audit Drawer handlers
  openActivityDrawer(): void {
    this.isActivityDrawerOpen.set(true);
  }

  closeActivityDrawer(): void {
    this.isActivityDrawerOpen.set(false);
  }

  // Project Code helper
  getProject(projectId: string): Project | undefined {
    return this.store.projectMap().get(projectId);
  }

  // Assignee helper for cards
  getMember(assigneeId: string): TeamMember {
    return this.store.assigneeMap().get(assigneeId) || this.store.teamMembers()[0];
  }

  // Checklist helper
  getCompletedSubtasks(task: Task): number {
    return (task.subtasks || []).filter((st: Subtask) => st.completed).length;
  }

  // Waterfall Timeline calculation helper
  getTimelineBarStyle(task: Task): { left: string; width: string } {
    const baseTimestamp = new Date('2026-11-01').getTime();
    const totalDays = 30;

    const startTs = new Date(task.startDate || '2026-11-01').getTime();
    const dueTs = new Date(task.dueDate || '2026-11-15').getTime();

    const startOffsetDays = Math.max(0, Math.min(30, (startTs - baseTimestamp) / 86400000));
    const durationDays = Math.max(2, Math.min(30 - startOffsetDays, (dueTs - startTs) / 86400000));

    const leftPercent = (startOffsetDays / totalDays) * 100;
    const widthPercent = (durationDays / totalDays) * 100;

    return {
      left: `${leftPercent}%`,
      width: `${Math.max(widthPercent, 6)}%`
    };
  }
}
