import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { TaskStoreService } from '../../services/task-store.service';
import {
  Task,
  TaskStatus,
  TaskPriority,
  Subtask,
  Project,
  TeamMember,
  MethodologyView
} from '../../models/task.model';
import { ImportModalComponent } from '../../components/import-modal.component';
import { AiPromptModalComponent } from '../../components/ai-prompt-modal.component';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, ImportModalComponent, AiPromptModalComponent],
  template: `
    <div class="workspace-page-wrapper">
      <!-- 1. Top Execution Toolbar -->
      <div class="workspace-toolbar">
        <div class="toolbar-left">
          <!-- View Switcher Tabs (Pill Geometry) -->
          <div class="view-switch-tabs">
            <button
              type="button"
              class="tab-btn"
              [class.active]="store.currentView() === 'BOARD'"
              (click)="switchView('BOARD')"
            >
              <i class="ph-light ph-kanban"></i>
              <span>Board</span>
            </button>
            <button
              type="button"
              class="tab-btn"
              [class.active]="store.currentView() === 'SPRINT'"
              (click)="switchView('SPRINT')"
            >
              <i class="ph-light ph-list-dashes"></i>
              <span>Sprint</span>
            </button>
            <button
              type="button"
              class="tab-btn"
              [class.active]="store.currentView() === 'TIMELINE'"
              (click)="switchView('TIMELINE')"
            >
              <i class="ph-light ph-chart-line-up"></i>
              <span>Timeline</span>
            </button>
          </div>

          <!-- Search Input -->
          <div class="search-box-wrap">
            <span class="search-icon">
              <i class="ph-light ph-magnifying-glass"></i>
            </span>
            <input
              type="text"
              class="search-input"
              placeholder="Search deliverables, ID, phase..."
              [ngModel]="store.searchQuery()"
              (ngModelChange)="store.searchQuery.set($event)"
            />
            @if (store.searchQuery()) {
              <button type="button" class="btn-clear" (click)="store.searchQuery.set('')">
                <i class="ph-light ph-x"></i>
              </button>
            }
          </div>

          <!-- Priority Filter Chips (Pill Geometry) -->
          <div class="priority-chips">
            <button
              type="button"
              class="p-chip"
              [class.active]="store.filterPriority() === 'ALL'"
              (click)="store.filterPriority.set('ALL')"
            >
              All
            </button>
            <button
              type="button"
              class="p-chip p-chip-crit"
              [class.active]="store.filterPriority() === 'CRITICAL'"
              (click)="store.filterPriority.set('CRITICAL')"
            >
              Critical
            </button>
            <button
              type="button"
              class="p-chip p-chip-high"
              [class.active]="store.filterPriority() === 'HIGH'"
              (click)="store.filterPriority.set('HIGH')"
            >
              High
            </button>
            <button
              type="button"
              class="p-chip p-chip-med"
              [class.active]="store.filterPriority() === 'MEDIUM'"
              (click)="store.filterPriority.set('MEDIUM')"
            >
              Med
            </button>
          </div>
        </div>

        <!-- Toolbar Right Actions -->
        <div class="toolbar-right">
          <button
            type="button"
            class="btn-action btn-ai-prompt"
            [disabled]="!store.canCurrentUserCreateTasks()"
            (click)="openAiPromptModal()"
            [title]="store.canCurrentUserCreateTasks() ? 'Prompt with AI Voice & NLP Task Composer' : 'Task creation is restricted for ' + store.currentUserRole()"
          >
            <i class="ph-light ph-microphone"></i>
            <span>Prompt with AI</span>
          </button>
          <button
            type="button"
            class="btn-action btn-smart-import"
            [disabled]="!store.canCurrentUserCreateTasks()"
            (click)="openSmartImport()"
            [title]="store.canCurrentUserCreateTasks() ? 'Import deliverables via structured JSON' : 'Task creation is restricted for ' + store.currentUserRole()"
          >
            <i class="ph-light ph-tray-arrow-down"></i>
            <span>Smart Import</span>
          </button>
          <button
            type="button"
            class="btn-action btn-new-task"
            [disabled]="!store.canCurrentUserCreateTasks()"
            (click)="openNewTaskModal()"
            [title]="store.canCurrentUserCreateTasks() ? 'Create new engineering deliverable' : 'Task creation is restricted for ' + store.currentUserRole()"
          >
            <i class="ph-light ph-plus"></i>
            <span>New Task</span>
          </button>
        </div>
      </div>

      <!-- 2. Workspace Viewport -->
      <div class="workspace-viewport custom-scroll">
        <!-- A. KANBAN BOARD VIEW -->
        @if (store.currentView() === 'BOARD') {
          <div class="kanban-grid" cdkDropListGroup>
            @for (col of statusColumns; track col.status) {
              <div class="kanban-column" [class.col-deployed-highlight]="col.status === 'DEPLOYED'">
                <div class="col-head">
                  <div class="col-title-wrap">
                    <span class="col-dot" [style.background]="col.accentColor"></span>
                    <h3 class="col-name">{{ col.title }}</h3>
                    <span class="col-count font-mono">
                      @switch (col.status) {
                        @case ('TODO') { {{ store.todoTasks().length }} }
                        @case ('IN_PROGRESS') { {{ store.inProgressTasks().length }} }
                        @case ('DEPLOYED') { {{ store.deployedTasks().length }} }
                        @case ('DONE') { {{ store.doneTasks().length }} }
                      }
                    </span>
                  </div>
                  @if (col.status === 'DEPLOYED') {
                    <span class="lead-check-tag">Lead Check</span>
                  }
                </div>

                <!-- Drop List Container -->
                <div
                  [id]="'list-' + col.status"
                  cdkDropList
                  [cdkDropListData]="
                    col.status === 'TODO' ? store.todoTasks() :
                    col.status === 'IN_PROGRESS' ? store.inProgressTasks() :
                    col.status === 'DEPLOYED' ? store.deployedTasks() : store.doneTasks()
                  "
                  [cdkDropListConnectedTo]="dropListIds"
                  (cdkDropListDropped)="onTaskDrop($event)"
                  class="kanban-drop-zone custom-scroll"
                >
                  @for (task of (
                    col.status === 'TODO' ? store.todoTasks() :
                    col.status === 'IN_PROGRESS' ? store.inProgressTasks() :
                    col.status === 'DEPLOYED' ? store.deployedTasks() : store.doneTasks()
                  ); track task.id) {
                    <div
                      class="task-card"
                      cdkDrag
                      [cdkDragData]="task"
                      [cdkDragDisabled]="!store.canEditTask(task)"
                      (click)="openTask(task.id)"
                      [class.card-is-blocked]="task.blocked"
                      [class.card-is-deployed]="task.status === 'DEPLOYED'"
                    >
                      <div class="task-card-top">
                        <div class="card-id-row">
                          <span class="card-id font-mono">{{ task.id }}</span>
                          @if (getProject(task.projectId); as proj) {
                            <span class="card-proj-badge" [style.color]="proj.color">{{ proj.code }}</span>
                          }
                          @if (task.blocked) {
                            <span class="card-blocked-tag">
                              <i class="ph-light ph-warning"></i> Blocked
                            </span>
                          }
                          @if (!store.canEditTask(task)) {
                            <span class="card-lock-badge" title="Read-only · Teammate task">
                              <i class="ph-light ph-lock-key"></i> Read-only
                            </span>
                          }
                        </div>
                        <span class="card-pts font-mono">{{ task.effortPoints }}p</span>
                      </div>

                      <strong class="card-title">{{ task.title }}</strong>

                      <div class="card-footer">
                        <div class="card-meta-left">
                          <span class="card-p-badge" [attr.data-priority]="task.priority">{{ task.priority }}</span>
                          @if (task.subtasks.length > 0) {
                            <span class="card-checklist-tag font-mono">
                              <i class="ph-light ph-check-square"></i> {{ getCompletedSubtasks(task) }}/{{ task.subtasks.length }}
                            </span>
                          }
                          @if (isCriticalPath(task.id)) {
                            <span class="key-path-tag" title="Key Path deliverable">
                              <i class="ph-light ph-flame"></i> Key
                            </span>
                          }
                        </div>

                        <!-- Stacked Avatars for Co-Assignees (Fan-Out on Group Hover) -->
                        <div class="avatar-stack">
                          @for (m of store.getTaskMembers(task); track m.id) {
                            <span
                              class="avatar-stack-item"
                              [style.background-color]="m.color"
                              [title]="m.name + ' (' + m.role + ')'"
                            >
                              {{ m.avatar }}
                            </span>
                          }
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }

        <!-- B. AGILE SPRINT TABLE VIEW -->
        @if (store.currentView() === 'SPRINT') {
          <div class="sprint-table-card">
            <table class="sprint-data-table">
              <thead>
                <tr>
                  <th style="width: 80px;">ID</th>
                  <th style="width: 105px;">Project</th>
                  <th>Title</th>
                  <th style="width: 140px;">Phase</th>
                  <th style="width: 180px;">Assignees</th>
                  <th style="width: 90px;">Priority</th>
                  <th style="width: 70px;">Points</th>
                  <th style="width: 105px;">Due Date</th>
                  <th style="width: 165px;">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (task of store.filteredTasks(); track task.id) {
                  <tr (click)="openTask(task.id)" class="sprint-row">
                    <td class="font-mono text-muted text-xs">{{ task.id }}</td>
                    <td>
                      @if (getProject(task.projectId); as proj) {
                        <span class="card-proj-badge" [style.color]="proj.color">{{ proj.code }}</span>
                      }
                    </td>
                    <td>
                      <div class="sprint-title-wrap">
                        <strong class="sprint-task-title">{{ task.title }}</strong>
                        @if (task.blocked) {
                          <span class="card-blocked-tag">
                            <i class="ph-light ph-warning"></i> Blocked
                          </span>
                        }
                        @if (!store.canEditTask(task)) {
                          <span class="card-lock-badge">
                            <i class="ph-light ph-lock-key"></i> Read-only
                          </span>
                        }
                        @if (isCriticalPath(task.id)) {
                          <span class="key-path-tag">
                            <i class="ph-light ph-flame"></i> Key
                          </span>
                        }
                      </div>
                    </td>
                    <td class="text-secondary text-xs">{{ task.phase }}</td>
                    <td>
                      <div class="table-member-cell">
                        <div class="avatar-stack">
                          @for (m of store.getTaskMembers(task); track m.id) {
                            <span class="avatar-stack-item" [style.background-color]="m.color" [title]="m.name">
                              {{ m.avatar }}
                            </span>
                          }
                        </div>
                        <span class="text-xs text-secondary truncate-names">{{ getTaskAssigneesSummary(task) }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="card-p-badge" [attr.data-priority]="task.priority">{{ task.priority }}</span>
                    </td>
                    <td class="font-mono text-xs tabular-nums">{{ task.effortPoints }}p</td>
                    <td class="font-mono text-xs text-muted">{{ task.dueDate }}</td>
                    <td (click)="$event.stopPropagation()">
                      <select
                        class="sprint-select-status"
                        [ngModel]="task.status"
                        (ngModelChange)="store.updateTaskStatus(task.id, $event)"
                        [disabled]="!store.canEditTask(task)"
                      >
                        <option value="TODO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="DEPLOYED">Deployed to Staging</option>
                        <option value="DONE">Done</option>
                      </select>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <!-- C. DELIVERY ROADMAP (TIMELINE) VIEW -->
        @if (store.currentView() === 'TIMELINE') {
          <div class="timeline-container">
            <!-- 1. Top Scannable Control & Legend Strip -->
            <div class="timeline-sub-toolbar">
              <div class="timeline-legend-group">
                <div class="timeline-legend-item">
                  <span class="legend-color-dot dot-completed"></span>
                  <span class="legend-label">Completed / Deployed</span>
                </div>
                <div class="timeline-legend-item">
                  <span class="legend-color-dot dot-inprogress"></span>
                  <span class="legend-label">In Progress</span>
                </div>
                <div class="timeline-legend-item">
                  <span class="legend-color-dot dot-blocked"></span>
                  <span class="legend-label">Blocked / Delayed</span>
                </div>
              </div>

              <div class="timeline-toolbar-actions">
                <!-- Deliverables Count Pill -->
                <span class="timeline-stat-pill font-mono">
                  {{ store.filteredTasks().length }} Deliverables
                </span>

                <!-- Interactive "Blocked Only" Toggle -->
                <button
                  type="button"
                  class="btn-timeline-opt btn-blocked-toggle"
                  [class.active]="store.filterBlockedOnly()"
                  (click)="toggleBlockedFilter()"
                  title="Filter to show only blocked or delayed deliverables"
                >
                  <i class="ph-light ph-warning"></i>
                  <span>Blocked Only</span>
                  @if (store.filterBlockedOnly()) {
                    <span class="filter-active-indicator">Active</span>
                  }
                </button>

                <!-- Domino Conflict / Auto-Shift Dates (if conflicts exist) -->
                @if (store.ganttScheduleMetrics().hasConflicts) {
                  <button
                    type="button"
                    class="btn-timeline-opt btn-conflict-autoshift"
                    [disabled]="!store.canEditTasks()"
                    (click)="store.cascadeShiftDates()"
                    title="Auto-shift downstream dates to eliminate dependency conflicts"
                  >
                    <i class="ph-light ph-lightning"></i>
                    <span>Auto-Shift Dates</span>
                  </button>
                }
              </div>
            </div>

            <!-- 2. Split Delivery Roadmap Canvas -->
            <div class="timeline-split-card">
              <!-- Left Column: Task & Upstream Dependency Summary (340px) -->
              <div class="timeline-left-column">
                <div class="timeline-col-header">
                  <span>Deliverable &amp; Dependencies</span>
                  <span class="font-mono text-muted text-xs">Points</span>
                </div>
                <div class="timeline-left-list">
                  @for (task of store.filteredTasks(); track task.id) {
                    <div
                      class="timeline-deliverable-item"
                      [class.is-hovered]="task.id === hoveredTaskId()"
                      [class.is-connected]="isTaskConnectedToHovered(task.id)"
                      [class.is-blocked]="task.blocked"
                      (mouseenter)="onTaskHover(task.id)"
                      (mouseleave)="onTaskHover(null)"
                      (click)="openTask(task.id)"
                    >
                      <div class="deliverable-meta-wrap">
                        <div class="deliverable-badges-row">
                          <span class="deliverable-key font-mono">{{ task.id }}</span>
                          @if (getProject(task.projectId); as proj) {
                            <span class="card-proj-badge" [style.color]="proj.color">{{ proj.code }}</span>
                          }
                          <span
                            class="timeline-status-badge"
                            [attr.data-status]="getTimelineStatusKey(task)"
                          >
                            {{ getTimelineStatusLabel(task) }}
                          </span>
                        </div>
                        <span class="deliverable-title text-truncate" [title]="task.title">
                          {{ task.title }}
                        </span>
                        @if (task.dependencies.length > 0) {
                          <div class="deliverable-dep-row">
                            <span class="dep-pill font-mono">
                              <i class="ph-light ph-arrow-bend-down-right"></i> After {{ task.dependencies.join(', ') }}
                            </span>
                          </div>
                        }
                      </div>
                      <span class="font-mono text-muted text-xs deliverable-effort">{{ task.effortPoints }}p</span>
                    </div>
                  }
                </div>
              </div>

              <!-- Right Column: Breathable 4-Week Columns & Duration Track Canvas -->
              <div class="timeline-right-column custom-scroll">
                <!-- Weekly Sprint Column Headers -->
                <div class="timeline-weeks-header">
                  @for (week of timelineWeeks; track week.id) {
                    <div class="timeline-week-head-col">
                      <span>{{ week.label }}</span>
                    </div>
                  }

                  <!-- Today Tag Marker in Header -->
                  <div class="timeline-today-head-badge" [style.left.%]="todayPercent">
                    <span class="today-tag-text font-mono">Today</span>
                  </div>
                </div>

                <!-- Timeline Tracks & Hover SVG Overlay -->
                <div class="timeline-track-canvas" [style.height.px]="store.filteredTasks().length * 88">
                  <!-- Vertical Weekly Column Grid Dividers -->
                  <div class="timeline-weeks-grid-bg">
                    @for (week of timelineWeeks; track week.id) {
                      <div class="week-v-divider"></div>
                    }
                  </div>

                  <!-- Vertical "Today" Marker Line -->
                  <div class="timeline-today-v-line" [style.left.%]="todayPercent"></div>

                  <!-- Hover-Only Curved SVG Connector Overlay (Zero Lines When Idle) -->
                  <svg
                    class="timeline-hover-svg"
                    width="100%"
                    [attr.height]="store.filteredTasks().length * 88"
                    [attr.viewBox]="'0 0 1000 ' + (store.filteredTasks().length * 88)"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <marker
                        id="timeline-arrow-normal"
                        viewBox="0 0 10 10"
                        refX="6"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--accent-primary)" />
                      </marker>
                      <marker
                        id="timeline-arrow-danger"
                        viewBox="0 0 10 10"
                        refX="6"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--accent-danger)" />
                      </marker>
                    </defs>
                    @for (conn of activeConnectors(); track conn.id) {
                      <path
                        [attr.d]="conn.d"
                        class="timeline-svg-connector"
                        [class.connector-is-conflict]="conn.isConflict"
                        [attr.marker-end]="conn.isConflict ? 'url(#timeline-arrow-danger)' : 'url(#timeline-arrow-normal)'"
                      />
                    }
                  </svg>

                  <!-- Task Duration Pill Bars -->
                  @for (task of store.filteredTasks(); track task.id; let idx = $index) {
                    <div
                      class="timeline-lane-row"
                      [style.top.px]="idx * 88"
                      [class.is-hovered]="task.id === hoveredTaskId()"
                      [class.is-connected]="isTaskConnectedToHovered(task.id)"
                      (mouseenter)="onTaskHover(task.id)"
                      (mouseleave)="onTaskHover(null)"
                      (click)="openTask(task.id)"
                    >
                      <!-- Horizontal Rounded Pill Bar -->
                      <div
                        class="timeline-duration-pill"
                        [style.left.%]="getTimelineBarLeftPercent(task)"
                        [style.width.%]="getTimelineBarWidthPercent(task)"
                        [attr.data-status]="getTimelineStatusKey(task)"
                        [class.is-critical]="isCriticalPath(task.id)"
                        [title]="task.title + ' (' + task.startDate + ' → ' + task.dueDate + ')'"
                      >
                        <!-- Stacked Co-Assignee Overlapping Avatars -->
                        <div class="timeline-bar-avatar-stack">
                          @for (m of store.getTaskMembers(task); track m.id) {
                            <span
                              class="bar-avatar-dot"
                              [style.background-color]="m.color"
                              [title]="m.name + ' (' + m.role + ')'"
                            >
                              {{ m.avatar }}
                            </span>
                          }
                        </div>

                        <!-- Pill Status + Points Label -->
                        <div class="timeline-bar-label-group">
                          @if (task.blocked) {
                            <i class="ph-light ph-warning"></i>
                          }
                          <span class="timeline-bar-label-text">
                            {{ getTimelineStatusLabel(task) }} · {{ task.effortPoints }} pts
                          </span>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
        }
      </div>

      <!-- NEW TASK MODAL -->
      @if (isNewTaskModalOpen()) {
        <div class="modal-backdrop" (click)="closeNewTaskModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-head">
              <h3 class="font-serif">Create New Deliverable</h3>
              <button type="button" class="btn-close" (click)="closeNewTaskModal()">
                <i class="ph-light ph-x"></i>
              </button>
            </div>
            <div class="modal-body custom-scroll">
              <div class="form-group">
                <label class="form-label required">Task Title</label>
                <input type="text" class="form-input" [(ngModel)]="newTaskTitle" placeholder="e.g. Implement streaming token parser" />
              </div>

              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-textarea" rows="3" [(ngModel)]="newTaskDescription" placeholder="Engineering requirements & specifications..."></textarea>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label">Project</label>
                  <select class="form-select" [(ngModel)]="newTaskProjectId">
                    @for (proj of store.visibleProjects(); track proj.id) {
                      <option [value]="proj.id">{{ proj.name }} ({{ proj.code }})</option>
                    }
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Primary Assignee</label>
                  <select class="form-select" [(ngModel)]="newTaskAssigneeId">
                    @for (mem of store.teamMembers(); track mem.id) {
                      <option [value]="mem.id">{{ mem.name }} • {{ mem.role }}</option>
                    }
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Co-Assignees (Points Split Equally)</label>
                <div class="modal-assignee-pool">
                  @for (mem of store.teamMembers(); track mem.id) {
                    <button
                      type="button"
                      class="pool-chip-btn"
                      [class.selected]="isNewTaskAssignee(mem.id)"
                      (click)="toggleNewTaskAssignee(mem.id)"
                    >
                      <span class="chip-avatar-sm" [style.background-color]="mem.color">{{ mem.avatar }}</span>
                      <span>{{ mem.name }}</span>
                      <span class="capacity-mini-dot" [attr.data-status]="store.getMemberLoadMetric(mem.id).status"></span>
                    </button>
                  }
                </div>
              </div>

              <div class="form-grid-3">
                <div class="form-group">
                  <label class="form-label">Priority</label>
                  <select class="form-select" [(ngModel)]="newTaskPriority">
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Story Points</label>
                  <input type="number" class="form-input" [(ngModel)]="newTaskEffort" min="1" max="21" />
                </div>
                <div class="form-group">
                  <label class="form-label">Due Date</label>
                  <input type="date" class="form-input" [(ngModel)]="newTaskDueDate" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Subtask Checklist (1 item per line)</label>
                <textarea class="form-textarea" rows="3" [(ngModel)]="newTaskInitialSubtasks" placeholder="Write unit test&#10;Verify GPU memory&#10;Deploy to staging"></textarea>
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn-cancel" (click)="closeNewTaskModal()">Cancel</button>
              <button type="button" class="btn-submit" [disabled]="!newTaskTitle.trim()" (click)="submitNewTask()">Create Task</button>
            </div>
          </div>
        </div>
      }

      <!-- STANDALONE SMART IMPORT MODAL -->
      @if (isSmartImportModalOpen()) {
        <app-import-modal (closeModal)="closeSmartImport()"></app-import-modal>
      }

      <!-- STANDALONE PROMPT WITH AI MODAL -->
      @if (isAiPromptModalOpen()) {
        <app-ai-prompt-modal (closeModal)="closeAiPromptModal()"></app-ai-prompt-modal>
      }
    </div>
  `,
  styles: [`
    .workspace-page-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: calc(100vh - 50px);
      overflow: hidden;
      background: var(--bg-canvas);
    }

    .workspace-toolbar {
      padding: 10px 24px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .view-switch-tabs {
      display: flex;
      align-items: center;
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-pill);
      padding: 3px;
      gap: 2px;
    }

    .tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 14px;
      border-radius: var(--radius-pill);
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
      background: transparent;
      border: none;
      cursor: pointer;
      transition: var(--transition-tactile);
    }

    .tab-btn:hover {
      color: var(--text-primary);
    }

    .tab-btn.active {
      background: var(--bg-surface);
      color: var(--accent-primary);
      box-shadow: var(--shadow-sm);
      font-weight: 600;
    }

    .search-box-wrap {
      position: relative;
      display: flex;
      align-items: center;
      width: 220px;
    }

    .search-icon {
      position: absolute;
      left: 12px;
      font-size: 13px;
      color: var(--text-muted);
      pointer-events: none;
      display: flex;
      align-items: center;
    }

    .search-input {
      width: 100%;
      padding: 6px 28px 6px 32px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      color: var(--text-primary);
      font-size: 12px;
      outline: none;
      transition: var(--transition-tactile);
    }

    .search-input:focus {
      background: var(--bg-surface);
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 2px var(--accent-primary-tint);
    }

    .btn-clear {
      position: absolute;
      right: 8px;
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
    }

    .priority-chips {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .p-chip {
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      font-size: 11px;
      font-weight: 500;
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
      cursor: pointer;
      transition: var(--transition-tactile);
    }

    .p-chip:hover {
      background: var(--bg-surface);
      color: var(--text-primary);
    }

    .p-chip.active {
      background: var(--accent-primary-tint);
      color: var(--accent-primary);
      border-color: rgba(92, 115, 98, 0.35);
      font-weight: 600;
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      padding: 6px 14px;
      border-radius: var(--radius-pill);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: var(--transition-tactile);
    }

    .btn-action:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      transform: none !important;
    }

    .btn-ai-prompt {
      background: var(--bg-subtle);
      border-color: var(--border-hairline);
      color: var(--text-primary);
    }

    .btn-ai-prompt:hover:not(:disabled) {
      background: var(--accent-primary-tint);
      color: var(--accent-primary);
      border-color: var(--accent-primary);
      transform: translateY(-1px);
    }

    .btn-smart-import {
      background: var(--bg-subtle);
      border-color: var(--border-hairline);
      color: var(--text-secondary);
    }

    .btn-smart-import:hover:not(:disabled) {
      background: var(--accent-primary-tint);
      color: var(--accent-primary);
      border-color: rgba(92, 115, 98, 0.3);
      transform: translateY(-1px);
    }

    .btn-new-task {
      background: var(--accent-primary);
      color: #ffffff;
      box-shadow: var(--shadow-sm);
    }

    .btn-new-task:hover:not(:disabled) {
      background: var(--accent-primary-hover);
      transform: translateY(-1px);
    }

    .workspace-viewport {
      flex: 1;
      padding: 20px 24px 48px;
      overflow: auto;
    }

    /* KANBAN */
    .kanban-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(280px, 1fr));
      gap: 16px;
      min-width: 1140px;
      align-items: start;
    }

    .kanban-column {
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      padding: 14px;
      display: flex;
      flex-direction: column;
      min-height: calc(100vh - 190px);
    }

    .kanban-column.col-deployed-highlight {
      background: var(--status-deployed-bg);
      border-color: rgba(123, 104, 174, 0.35);
    }

    .col-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      padding: 0 4px;
    }

    .col-title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .col-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
    }

    .col-name {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
      letter-spacing: -0.01em;
    }

    .col-count {
      font-size: 10.5px;
      font-weight: 600;
      padding: 1px 7px;
      border-radius: var(--radius-pill);
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
    }

    .lead-check-tag {
      font-size: 9.5px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: var(--radius-pill);
      background: var(--status-deployed);
      color: #ffffff;
    }

    .kanban-drop-zone {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
      min-height: 200px;
    }

    .task-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: 14px;
      padding: 14px 16px;
      box-shadow: var(--shadow-sm);
      cursor: grab;
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: var(--transition-tactile);
    }

    .task-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
      border-color: rgba(92, 115, 98, 0.4);
    }

    .task-card.card-is-deployed {
      border-color: rgba(123, 104, 174, 0.4);
    }

    .task-card.card-is-blocked {
      border-color: rgba(200, 109, 81, 0.5);
    }

    .task-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .card-id-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .card-id {
      font-size: 11px;
      color: var(--text-muted);
    }

    .card-proj-badge {
      font-size: 10px;
      font-weight: 700;
      font-family: var(--font-mono);
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
    }

    .card-blocked-tag {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 9.5px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--status-blocked-bg);
      color: var(--status-blocked-text);
    }

    .card-lock-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 9.5px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      color: var(--text-muted);
      border: 1px solid var(--border-hairline);
    }

    .card-pts {
      font-size: 10.5px;
      color: var(--text-muted);
      background: var(--bg-subtle);
      padding: 1px 6px;
      border-radius: var(--radius-pill);
    }

    .card-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      line-height: 1.45;
    }

    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 4px;
    }

    .card-meta-left {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .card-p-badge {
      font-size: 9.5px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      color: var(--text-secondary);
    }

    .card-p-badge[data-priority="CRITICAL"] {
      background: var(--badge-critical-bg);
      color: var(--badge-critical-text);
    }

    .card-p-badge[data-priority="HIGH"] {
      background: var(--badge-high-bg);
      color: var(--badge-high-text);
    }

    .card-checklist-tag {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 10.5px;
      color: var(--text-secondary);
    }

    .key-path-tag {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-size: 9px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--accent-warn-tint);
      color: var(--accent-warn);
      border: 1px solid rgba(197, 155, 78, 0.3);
    }

    /* SPRINT TABLE */
    .sprint-table-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      overflow-x: auto;
      box-shadow: var(--shadow-soft);
    }

    .sprint-data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .sprint-data-table th {
      padding: 12px 16px;
      background: var(--bg-subtle);
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1px solid var(--border-hairline);
    }

    .sprint-row {
      border-bottom: 1px solid var(--border-hairline);
      cursor: pointer;
      transition: var(--transition-tactile);
    }

    .sprint-row:hover {
      background: var(--bg-subtle);
    }

    .sprint-data-table td {
      padding: 12px 16px;
      font-size: 12.5px;
    }

    .sprint-title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sprint-task-title {
      color: var(--text-primary);
      font-size: 13px;
      font-weight: 600;
    }

    .table-member-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .truncate-names {
      max-width: 110px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sprint-select-status {
      padding: 5px 10px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      color: var(--text-primary);
      font-size: 11.5px;
      outline: none;
      transition: var(--transition-tactile);
    }

    .sprint-select-status:hover {
      border-color: var(--accent-primary);
    }

    /* DELIVERY ROADMAP (TIMELINE) VIEW */
    .timeline-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .timeline-sub-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      padding: 10px 18px;
      box-shadow: var(--shadow-soft);
      flex-wrap: wrap;
    }

    .timeline-legend-group {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .timeline-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      color: var(--text-secondary);
      font-weight: 500;
    }

    .legend-color-dot {
      width: 8px;
      height: 8px;
      border-radius: 9999px;
      flex-shrink: 0;
    }

    .dot-completed { background: var(--accent-primary); }
    .dot-inprogress { background: var(--accent-warn); }
    .dot-blocked { background: var(--accent-danger); }

    .timeline-toolbar-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .timeline-stat-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .btn-timeline-opt {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: var(--radius-pill);
      font-size: 11.5px;
      font-weight: 500;
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
      cursor: pointer;
      transition: var(--transition-tactile);
      white-space: nowrap;
    }

    .btn-timeline-opt:hover:not(:disabled) {
      color: var(--text-primary);
      border-color: var(--border-strong);
    }

    .btn-blocked-toggle.active {
      background: var(--accent-danger-tint);
      color: var(--accent-danger);
      border-color: rgba(200, 109, 81, 0.4);
      font-weight: 600;
    }

    .filter-active-indicator {
      font-size: 9px;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--accent-danger);
      color: #ffffff;
      text-transform: uppercase;
      font-weight: 700;
    }

    .btn-conflict-autoshift {
      background: var(--accent-warn-tint);
      color: var(--accent-warn);
      border-color: rgba(197, 155, 78, 0.4);
      font-weight: 600;
    }

    .btn-conflict-autoshift:hover:not(:disabled) {
      background: var(--accent-warn);
      color: #ffffff;
    }

    .timeline-split-card {
      display: flex;
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      overflow: hidden;
      box-shadow: var(--shadow-soft);
    }

    .timeline-left-column {
      width: 340px;
      min-width: 340px;
      border-right: 1px solid var(--border-hairline);
      display: flex;
      flex-direction: column;
      background: var(--bg-surface);
    }

    .timeline-col-header {
      height: 44px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-subtle);
      border-bottom: 1px solid var(--border-hairline);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
    }

    .timeline-left-list {
      display: flex;
      flex-direction: column;
    }

    .timeline-deliverable-item {
      height: 88px;
      min-height: 88px;
      box-sizing: border-box;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      cursor: pointer;
      transition: var(--transition-tactile);
      background: var(--bg-surface);
    }

    .timeline-deliverable-item:hover {
      background: var(--bg-subtle);
    }

    .timeline-deliverable-item.is-hovered {
      background: var(--bg-subtle);
      box-shadow: inset 3px 0 0 var(--accent-primary);
    }

    .timeline-deliverable-item.is-connected {
      background: var(--accent-primary-tint);
      box-shadow: inset 3px 0 0 var(--accent-primary);
    }

    .timeline-deliverable-item.is-blocked {
      box-shadow: inset 3px 0 0 var(--accent-danger);
    }

    .deliverable-meta-wrap {
      display: flex;
      flex-direction: column;
      gap: 3px;
      overflow: hidden;
      flex: 1;
    }

    .deliverable-badges-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .deliverable-key {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 500;
    }

    .timeline-status-badge {
      display: inline-flex;
      align-items: center;
      font-size: 9.5px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      white-space: nowrap;
    }

    .timeline-status-badge[data-status="completed"] {
      background: var(--accent-primary-tint);
      color: var(--accent-primary);
    }

    .timeline-status-badge[data-status="inprogress"] {
      background: var(--accent-warn-tint);
      color: var(--accent-warn);
    }

    .timeline-status-badge[data-status="blocked"] {
      background: var(--accent-danger-tint);
      color: var(--accent-danger);
    }

    .timeline-status-badge[data-status="todo"] {
      background: var(--bg-subtle);
      color: var(--text-secondary);
      border: 1px solid var(--border-hairline);
    }

    .deliverable-title {
      font-size: 12.5px;
      font-weight: 500;
      color: var(--text-primary);
    }

    .deliverable-dep-row {
      display: flex;
      align-items: center;
    }

    .deliverable-effort {
      flex-shrink: 0;
      padding-left: 4px;
    }

    .timeline-right-column {
      flex: 1;
      min-width: 600px;
      overflow-x: auto;
      display: flex;
      flex-direction: column;
      position: relative;
      background: var(--bg-surface);
    }

    .timeline-weeks-header {
      height: 44px;
      display: flex;
      background: var(--bg-subtle);
      border-bottom: 1px solid var(--border-hairline);
      position: relative;
    }

    .timeline-week-head-col {
      flex: 1;
      min-width: 150px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding-top: 10px;
      border-right: 1px solid var(--border-hairline);
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      text-align: center;
    }

    .timeline-today-head-badge {
      position: absolute;
      top: 2px;
      transform: translateX(-50%);
      z-index: 10;
      pointer-events: none;
    }

    .today-tag-text {
      display: inline-flex;
      align-items: center;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--accent-primary);
      color: #ffffff;
      font-size: 9px;
      font-weight: 700;
      line-height: 1.2;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      box-shadow: var(--shadow-sm);
    }

    .timeline-track-canvas {
      position: relative;
      width: 100%;
      min-width: 600px;
    }

    .timeline-weeks-grid-bg {
      position: absolute;
      inset: 0;
      display: flex;
      pointer-events: none;
      z-index: 1;
    }

    .week-v-divider {
      flex: 1;
      min-width: 150px;
      border-right: 1px solid var(--border-hairline);
      height: 100%;
    }

    .timeline-today-v-line {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 0;
      border-left: 2px dashed var(--accent-primary);
      z-index: 3;
      pointer-events: none;
      opacity: 0.8;
    }

    .timeline-hover-svg {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 6;
    }

    .timeline-svg-connector {
      fill: none;
      stroke: var(--accent-primary);
      stroke-width: 2.2;
      opacity: 0.92;
    }

    .timeline-svg-connector.connector-is-conflict {
      stroke: var(--accent-danger);
      stroke-width: 2.5;
      stroke-dasharray: 4 2;
    }

    .timeline-lane-row {
      position: absolute;
      left: 0;
      right: 0;
      height: 88px;
      cursor: pointer;
      transition: background 0.15s ease;
      z-index: 4;
    }

    .timeline-lane-row:hover {
      background: rgba(140, 133, 123, 0.04);
    }

    .timeline-lane-row.is-hovered {
      background: rgba(140, 133, 123, 0.06);
    }

    .timeline-lane-row.is-connected {
      background: var(--accent-primary-tint);
    }

    .timeline-duration-pill {
      position: absolute;
      top: 26px;
      height: 36px;
      border-radius: var(--radius-pill);
      display: flex;
      align-items: center;
      padding: 0 12px;
      gap: 8px;
      box-shadow: var(--shadow-sm);
      transition: var(--transition-tactile);
      z-index: 5;
    }

    .timeline-duration-pill:hover {
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }

    .timeline-duration-pill[data-status="completed"] {
      background: rgba(92, 115, 98, 0.16);
      border: 1px solid rgba(92, 115, 98, 0.45);
      color: var(--accent-primary);
    }

    .timeline-duration-pill[data-status="inprogress"] {
      background: rgba(197, 155, 78, 0.16);
      border: 1px solid rgba(197, 155, 78, 0.45);
      color: var(--accent-warn);
    }

    .timeline-duration-pill[data-status="blocked"] {
      background: rgba(200, 109, 81, 0.18);
      border: 1px solid rgba(200, 109, 81, 0.55);
      color: var(--accent-danger);
    }

    .timeline-duration-pill[data-status="todo"] {
      background: rgba(140, 133, 123, 0.14);
      border: 1px solid rgba(140, 133, 123, 0.35);
      color: var(--text-secondary);
    }

    .timeline-duration-pill.is-critical {
      box-shadow: 0 0 0 2px var(--accent-warn), 0 2px 8px rgba(197, 155, 78, 0.35);
    }

    .timeline-bar-avatar-stack {
      display: flex;
      align-items: center;
      margin-right: 2px;
    }

    .bar-avatar-dot {
      width: 18px;
      height: 18px;
      border-radius: 9999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      font-weight: 700;
      color: #ffffff;
      border: 1.5px solid var(--bg-surface);
      margin-left: -5px;
      flex-shrink: 0;
    }

    .bar-avatar-dot:first-child {
      margin-left: 0;
    }

    .timeline-bar-label-group {
      display: flex;
      align-items: center;
      gap: 5px;
      overflow: hidden;
    }

    .timeline-bar-label-text {
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* SHARED MODALS */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(20, 19, 18, 0.45);
      backdrop-filter: blur(6px);
      z-index: 95;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .modal-card {
      width: 100%;
      max-width: 540px;
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-float);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      max-height: 90vh;
    }

    .modal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 24px;
      border-bottom: 1px solid var(--border-hairline);
    }

    .modal-head h3 { font-size: 18px; font-weight: 500; margin: 0; }
    .btn-close {
      background: transparent;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      transition: var(--transition-tactile);
    }
    .btn-close:hover { color: var(--text-primary); }

    .modal-body {
      padding: 22px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
    }

    .form-group { display: flex; flex-direction: column; gap: 5px; }
    .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .form-label { font-size: 11.5px; font-weight: 600; color: var(--text-secondary); }
    .form-label.required::after { content: ' *'; color: var(--accent-danger); }

    .form-input, .form-select, .form-textarea {
      padding: 8px 12px;
      border-radius: var(--radius-inner);
      border: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      color: var(--text-primary);
      font-size: 12.5px;
      outline: none;
      transition: var(--transition-tactile);
    }

    .form-input:focus, .form-select:focus, .form-textarea:focus {
      background: var(--bg-surface);
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 2px var(--accent-primary-tint);
    }

    .modal-assignee-pool {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;
    }

    .pool-chip-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
      font-size: 11px;
      cursor: pointer;
      transition: var(--transition-tactile);
    }

    .pool-chip-btn:hover {
      background: var(--bg-surface);
      color: var(--text-primary);
    }

    .pool-chip-btn.selected {
      background: var(--accent-primary-tint);
      border-color: rgba(92, 115, 98, 0.35);
      color: var(--accent-primary);
      font-weight: 600;
    }

    .chip-avatar-sm {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      color: #ffffff;
      font-size: 8.5px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
    }

    .capacity-mini-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .capacity-mini-dot[data-status="OPTIMAL"] { background: var(--status-done); }
    .capacity-mini-dot[data-status="NEAR_CAPACITY"] { background: var(--accent-warn); }
    .capacity-mini-dot[data-status="OVER_BUDGET"] { background: var(--accent-danger); }

    .modal-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 24px;
      border-top: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
    }

    .btn-cancel {
      padding: 8px 16px;
      border-radius: var(--radius-pill);
      background: transparent;
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition-tactile);
    }

    .btn-cancel:hover {
      background: var(--bg-surface);
      color: var(--text-primary);
    }

    .btn-submit {
      padding: 8px 18px;
      border-radius: var(--radius-pill);
      background: var(--accent-primary);
      border: none;
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      transition: var(--transition-tactile);
    }

    .btn-submit:hover:not(:disabled) {
      background: var(--accent-primary-hover);
      transform: translateY(-1px);
    }
  `]
})
export class WorkspaceComponent {
  protected readonly store = inject(TaskStoreService);

  readonly statusColumns: Array<{
    status: TaskStatus;
    title: string;
    description: string;
    accentColor: string;
  }> = [
    { status: 'TODO', title: 'To Do', description: 'Backlog ready for sprint intake', accentColor: 'var(--status-todo)' },
    { status: 'IN_PROGRESS', title: 'In Progress', description: 'Actively in development', accentColor: 'var(--status-inprogress)' },
    { status: 'DEPLOYED', title: 'Deployed to Server', description: 'Staged on GPU/Cloud, ready for verification', accentColor: 'var(--status-deployed)' },
    { status: 'DONE', title: 'Done', description: 'Verified & closed', accentColor: 'var(--status-done)' }
  ];

  readonly dropListIds: string[] = ['list-TODO', 'list-IN_PROGRESS', 'list-DEPLOYED', 'list-DONE'];

  // Delivery Roadmap (Timeline) Signals & Helpers
  readonly hoveredTaskId = signal<string | null>(null);
  readonly timelineWeeks = [
    { id: 'w1', label: 'Week 1 · Nov 10 - Nov 16' },
    { id: 'w2', label: 'Week 2 · Nov 17 - Nov 23' },
    { id: 'w3', label: 'Week 3 · Nov 24 - Nov 30' },
    { id: 'w4', label: 'Week 4 · Dec 01 - Dec 07' }
  ];
  readonly timelineStartTs = new Date('2026-11-10T00:00:00Z').getTime();
  readonly todayPercent = 42.86; // Nov 22, 2026 (Day 12 of 28 days)

  // Modals
  readonly isNewTaskModalOpen = signal<boolean>(false);
  readonly isSmartImportModalOpen = signal<boolean>(false);
  readonly isAiPromptModalOpen = signal<boolean>(false);

  // New Task Form
  newTaskTitle = '';
  newTaskDescription = '';
  newTaskProjectId = '';
  newTaskAssigneeId = '';
  newTaskAssigneeIds: string[] = ['tm-1'];
  newTaskPriority: TaskPriority = 'MEDIUM';
  newTaskEffort = 3;
  newTaskDueDate = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
  newTaskInitialSubtasks = '';

  toggleNewTaskAssignee(memberId: string): void {
    if (this.newTaskAssigneeIds.includes(memberId)) {
      if (this.newTaskAssigneeIds.length > 1) {
        this.newTaskAssigneeIds = this.newTaskAssigneeIds.filter(id => id !== memberId);
      }
    } else {
      this.newTaskAssigneeIds = [...this.newTaskAssigneeIds, memberId];
    }
    if (!this.newTaskAssigneeIds.includes(this.newTaskAssigneeId)) {
      this.newTaskAssigneeId = this.newTaskAssigneeIds[0];
    }
  }

  isNewTaskAssignee(memberId: string): boolean {
    return this.newTaskAssigneeIds.includes(memberId);
  }

  getTaskAssigneesSummary(task: Task): string {
    const members = this.store.getTaskMembers(task);
    if (members.length === 0) return 'Unassigned';
    if (members.length === 1) return members[0].name;
    return `${members[0].name} +${members.length - 1}`;
  }

  switchView(view: MethodologyView): void {
    this.store.currentView.set(view);
  }

  isCriticalPath(taskId: string): boolean {
    return this.store.ganttScheduleMetrics().criticalPathTaskIds.has(taskId);
  }

  getProject(projectId: string): Project | undefined {
    return this.store.projectMap().get(projectId);
  }

  getMember(assigneeId: string): TeamMember {
    return this.store.assigneeMap().get(assigneeId) || this.store.teamMembers()[0];
  }

  getCompletedSubtasks(task: Task): number {
    return (task.subtasks || []).filter((st: Subtask) => st.completed).length;
  }

  openTask(taskId: string): void {
    this.store.selectTask(taskId);
  }

  onTaskDrop(event: CdkDragDrop<Task[], Task[], Task>): void {
    if (!this.store.canEditTasks()) return;

    const draggedTask = event.item.data as Task;
    if (!this.store.canEditTask(draggedTask)) {
      console.warn('Ownership lock: Cannot move teammate task.');
      return;
    }

    if (event.previousContainer === event.container) {
      const status = event.container.id.replace('list-', '') as TaskStatus;
      this.store.reorderTasksInColumn(status, event.previousIndex, event.currentIndex);
    } else {
      const targetStatus = event.container.id.replace('list-', '') as TaskStatus;

      if (targetStatus === 'DONE' && !this.store.canSignOffDone()) {
        console.warn('RBAC: Only LEAD or ADMIN can mark tasks DONE.');
        return;
      }

      this.store.updateTaskStatus(draggedTask.id, targetStatus);
    }
  }

  openNewTaskModal(): void {
    if (!this.store.canCreateTasks()) return;
    this.newTaskTitle = '';
    this.newTaskDescription = '';
    const activeP = this.store.selectedProjectId();
    const visibleProjects = this.store.visibleProjects();
    this.newTaskProjectId = (activeP !== 'ALL' && visibleProjects.some(p => p.id === activeP))
      ? activeP
      : (visibleProjects[0]?.id || 'proj-1');
    const curId = this.store.currentUserId();
    this.newTaskAssigneeId = curId;
    this.newTaskAssigneeIds = [curId];
    this.newTaskPriority = 'MEDIUM';
    this.newTaskEffort = 3;
    this.newTaskDueDate = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
    this.newTaskInitialSubtasks = '';
    this.isNewTaskModalOpen.set(true);
  }

  closeNewTaskModal(): void {
    this.isNewTaskModalOpen.set(false);
  }

  submitNewTask(): void {
    if (!this.newTaskTitle.trim() || !this.store.canCreateTasks()) return;

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

    const assigneeIds = this.newTaskAssigneeIds.length > 0 ? this.newTaskAssigneeIds : [this.newTaskAssigneeId || 'tm-1'];

    this.store.createTask({
      projectId: this.newTaskProjectId,
      title: this.newTaskTitle.trim(),
      description: this.newTaskDescription.trim(),
      assigneeIds,
      assigneeId: assigneeIds[0],
      priority: this.newTaskPriority,
      phase: 'Phase 2: Serving Engine',
      sprint: 'Sprint 24.3',
      effortPoints: Number(this.newTaskEffort) || 3,
      startDate: new Date().toISOString().split('T')[0],
      dueDate: this.newTaskDueDate,
      baselineDueDate: this.newTaskDueDate,
      reworkCount: 0,
      slipReason: null,
      subtasks
    });

    this.closeNewTaskModal();
  }

  openSmartImport(): void {
    this.isSmartImportModalOpen.set(true);
  }

  closeSmartImport(): void {
    this.isSmartImportModalOpen.set(false);
  }

  openAiPromptModal(): void {
    this.isAiPromptModalOpen.set(true);
  }

  closeAiPromptModal(): void {
    this.isAiPromptModalOpen.set(false);
  }

  toggleBlockedFilter(): void {
    this.store.filterBlockedOnly.update(v => !v);
  }

  onTaskHover(taskId: string | null): void {
    this.hoveredTaskId.set(taskId);
  }

  isTaskConnectedToHovered(taskId: string): boolean {
    const hId = this.hoveredTaskId();
    if (!hId) return false;
    if (taskId === hId) return true;
    const tasks = this.store.tasks();
    const hoveredTask = tasks.find(t => t.id === hId);
    if (hoveredTask && (hoveredTask.dependencies || []).includes(taskId)) return true;
    const currentTask = tasks.find(t => t.id === taskId);
    if (currentTask && (currentTask.dependencies || []).includes(hId)) return true;
    return false;
  }

  getTimelineStatusKey(task: Task): 'completed' | 'inprogress' | 'blocked' | 'todo' {
    if (task.blocked) return 'blocked';
    if (task.status === 'DONE' || task.status === 'DEPLOYED') return 'completed';
    if (task.status === 'IN_PROGRESS') return 'inprogress';
    return 'todo';
  }

  getTimelineStatusLabel(task: Task): string {
    if (task.blocked) return 'Blocked';
    if (task.status === 'DONE') return 'Completed';
    if (task.status === 'DEPLOYED') return 'Deployed';
    if (task.status === 'IN_PROGRESS') return 'In Progress';
    return 'To Do';
  }

  getTimelineBarLeftPercent(task: Task): number {
    const startTs = new Date(task.startDate || '2026-11-10').getTime();
    const diffDays = Math.max(0, (startTs - this.timelineStartTs) / 86400000);
    const leftPct = (diffDays / 28) * 100;
    return Math.max(1, Math.min(86, Number(leftPct.toFixed(2))));
  }

  getTimelineBarWidthPercent(task: Task): number {
    const startTs = new Date(task.startDate || '2026-11-10').getTime();
    const dueTs = new Date(task.dueDate || '2026-11-20').getTime();
    const durDays = Math.max(2, (dueTs - startTs) / 86400000);
    const widthPct = (durDays / 28) * 100;
    const leftPct = this.getTimelineBarLeftPercent(task);
    return Math.max(10, Math.min(98 - leftPct, Number(widthPct.toFixed(2))));
  }

  readonly activeConnectors = computed(() => {
    const hId = this.hoveredTaskId();
    if (!hId) return [];

    const tasks = this.store.filteredTasks();
    const taskIndexMap = new Map<string, number>();
    const taskMap = new Map<string, Task>();
    tasks.forEach((t, idx) => {
      taskIndexMap.set(t.id, idx);
      taskMap.set(t.id, t);
    });

    const connectors: Array<{ id: string; d: string; isConflict: boolean }> = [];

    tasks.forEach((downstream, downIdx) => {
      (downstream.dependencies || []).forEach(upstreamId => {
        if (upstreamId !== hId && downstream.id !== hId) return;

        const upstream = taskMap.get(upstreamId);
        const upIdx = taskIndexMap.get(upstreamId);
        if (upstream && upIdx !== undefined) {
          const x1 = (this.getTimelineBarLeftPercent(upstream) + this.getTimelineBarWidthPercent(upstream)) * 10;
          const y1 = upIdx * 88 + 44;
          const x2 = this.getTimelineBarLeftPercent(downstream) * 10;
          const y2 = downIdx * 88 + 44;

          const dx = Math.max(25, Math.abs(x2 - x1) * 0.4);
          const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
          const isConflict = upstream.dueDate > downstream.startDate || downstream.blocked;

          connectors.push({
            id: `${upstream.id}->${downstream.id}`,
            d,
            isConflict
          });
        }
      });
    });

    return connectors;
  });
}
