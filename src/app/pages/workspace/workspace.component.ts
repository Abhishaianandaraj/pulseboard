import { Component, inject, signal } from '@angular/core';
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

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, ImportModalComponent],
  template: `
    <div class="workspace-page-wrapper">
      <!-- 1. Top Execution Toolbar -->
      <div class="workspace-toolbar">
        <div class="toolbar-left">
          <!-- View Switcher Tabs -->
          <div class="view-switch-tabs">
            <button
              type="button"
              class="tab-btn"
              [class.active]="store.currentView() === 'BOARD'"
              (click)="switchView('BOARD')"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="9"></rect>
                <rect x="14" y="3" width="7" height="5"></rect>
                <rect x="14" y="12" width="7" height="9"></rect>
                <rect x="3" y="16" width="7" height="5"></rect>
              </svg>
              <span>Board</span>
            </button>
            <button
              type="button"
              class="tab-btn"
              [class.active]="store.currentView() === 'SPRINT'"
              (click)="switchView('SPRINT')"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
              <span>Sprint</span>
            </button>
            <button
              type="button"
              class="tab-btn"
              [class.active]="store.currentView() === 'TIMELINE'"
              (click)="switchView('TIMELINE')"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="4" y1="6" x2="16" y2="6"></line>
                <line x1="8" y1="12" x2="20" y2="12"></line>
                <line x1="6" y1="18" x2="14" y2="18"></line>
              </svg>
              <span>Gantt</span>
            </button>
          </div>

          <!-- Search Input -->
          <div class="search-box-wrap">
            <span class="search-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <input
              type="text"
              class="search-input"
              placeholder="Search deliverables, ID, phase..."
              [ngModel]="store.searchQuery()"
              (ngModelChange)="store.searchQuery.set($event)"
            />
            @if (store.searchQuery()) {
              <button type="button" class="btn-clear" (click)="store.searchQuery.set('')">✕</button>
            }
          </div>

          <!-- Priority Filter Chips -->
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
            class="btn-action btn-smart-import"
            [disabled]="!store.canCreateTasks()"
            (click)="openSmartImport()"
            title="Import deliverables via structured JSON"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Smart Import</span>
          </button>
          <button
            type="button"
            class="btn-action btn-new-task"
            [disabled]="!store.canCreateTasks()"
            (click)="openNewTaskModal()"
          >
            + New Task
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
                            <span class="card-blocked-tag">Blocked</span>
                          }
                          @if (!store.canEditTask(task)) {
                            <span class="card-lock-badge" title="Read-only · Teammate task">🔒 Read-only</span>
                          }
                        </div>
                        <span class="card-pts font-mono">{{ task.effortPoints }}p</span>
                      </div>

                      <strong class="card-title">{{ task.title }}</strong>

                      <div class="card-footer">
                        <div class="card-meta-left">
                          <span class="card-p-badge" [attr.data-priority]="task.priority">{{ task.priority }}</span>
                          @if (task.subtasks.length > 0) {
                            <span class="card-checklist-tag text-xs font-mono">
                              ☑ {{ getCompletedSubtasks(task) }}/{{ task.subtasks.length }}
                            </span>
                          }
                          @if (isCriticalPath(task.id)) {
                            <span class="key-path-tag" title="Key Path deliverable">Key Path</span>
                          }
                        </div>

                        <!-- Stacked Avatars for Co-Assignees -->
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
                  <th style="width: 155px;">Status</th>
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
                          <span class="card-blocked-tag">Blocked</span>
                        }
                        @if (!store.canEditTask(task)) {
                          <span class="card-lock-badge">🔒 Read-only</span>
                        }
                        @if (isCriticalPath(task.id)) {
                          <span class="key-path-tag">Key Path</span>
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

        <!-- C. INTERACTIVE DEPENDENCY GANTT VIEW -->
        @if (store.currentView() === 'TIMELINE') {
          <div class="gantt-wrapper">
            <!-- Gantt Controls Toolbar -->
            <div class="gantt-sub-toolbar">
              <div class="gantt-stats-row">
                <span class="gantt-stat-pill">{{ store.filteredTasks().length }} Deliverables</span>
                <span class="gantt-stat-pill key-path-pill">
                  🔥 {{ store.ganttScheduleMetrics().criticalPathTaskIds.size }} on Key Path
                </span>
              </div>

              <div class="gantt-toggle-group">
                <button
                  type="button"
                  class="btn-gantt-opt"
                  [class.active]="showKeyPath()"
                  (click)="toggleKeyPath()"
                >
                  🔥 Key Path: {{ showKeyPath() ? 'ON' : 'OFF' }}
                </button>
                <button
                  type="button"
                  class="btn-gantt-opt"
                  [class.active]="showScheduleShift()"
                  (click)="toggleScheduleShift()"
                >
                  📐 Schedule Shift: {{ showScheduleShift() ? 'ON' : 'OFF' }}
                </button>
              </div>
            </div>

            <!-- Schedule Domino Conflict Banner -->
            @if (store.ganttScheduleMetrics().hasConflicts) {
              <div class="gantt-conflict-bar">
                <span class="conflict-glyph">⚠️</span>
                <div class="conflict-text">
                  <strong>Prerequisite Overlap Risk Detected</strong>
                  <p>Upstream deliverables finish after downstream successor dates. Automatic cascade alignment is available.</p>
                </div>
                <button
                  type="button"
                  class="btn-auto-align"
                  [disabled]="!store.canEditTasks()"
                  (click)="store.cascadeShiftDates()"
                >
                  ⚡ Auto-Shift Dependent Dates
                </button>
              </div>
            }

            <!-- Split Gantt Chart -->
            <div class="gantt-split-board">
              <!-- Left Tree Column -->
              <div class="gantt-left-tree">
                <div class="gantt-tree-header">
                  <span>Deliverable &amp; Key Path</span>
                  <span class="font-mono">Pts</span>
                </div>
                <div class="gantt-tree-rows">
                  @for (task of store.filteredTasks(); track task.id) {
                    <div class="gantt-tree-item" (click)="openTask(task.id)" [class.is-key-row]="isCriticalPath(task.id) && showKeyPath()">
                      <div class="tree-item-title-wrap">
                        <span class="font-mono text-muted text-xs">{{ task.id }}</span>
                        @if (getProject(task.projectId); as proj) {
                          <span class="card-proj-badge" [style.color]="proj.color">{{ proj.code }}</span>
                        }
                        <span class="tree-title text-truncate" [title]="task.title">{{ task.title }}</span>
                        @if (isCriticalPath(task.id) && showKeyPath()) {
                          <span class="key-path-tag">Key</span>
                        }
                        @if (task.dependencies.length > 0) {
                          <span class="dep-pill font-mono">🔗 {{ task.dependencies.length }}</span>
                        }
                      </div>
                      <span class="font-mono text-muted text-xs">{{ task.effortPoints }}p</span>
                    </div>
                  }
                </div>
              </div>

              <!-- Right 30-Day Grid -->
              <div class="gantt-right-grid">
                <!-- Day Header -->
                <div class="gantt-calendar-header">
                  @for (day of timelineDays; track day) {
                    <div class="gantt-day-tick">
                      <span>{{ day }}</span>
                    </div>
                  }
                </div>

                <!-- Timeline Tracks & SVG Overlay -->
                <div class="gantt-track-area" [style.height.px]="store.filteredTasks().length * 52">
                  <!-- Background day columns -->
                  <div class="gantt-grid-columns">
                    @for (day of timelineDays; track day) {
                      <div class="day-v-line"></div>
                    }
                  </div>

                  <!-- SVG Bezier Connector Layer -->
                  <svg class="gantt-svg-overlay" width="900" [attr.height]="store.filteredTasks().length * 52">
                    <defs>
                      <marker id="arrow-normal" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--color-primary)" />
                      </marker>
                      <marker id="arrow-key" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f97316" />
                      </marker>
                      <marker id="arrow-conflict" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
                      </marker>
                    </defs>
                    @for (conn of getGanttConnectors(); track conn.upstreamId + '-' + conn.downstreamId) {
                      <path
                        [attr.d]="conn.path"
                        class="gantt-path"
                        [class.path-conflict]="conn.isConflict"
                        [class.path-key]="(isCriticalPath(conn.upstreamId) && isCriticalPath(conn.downstreamId)) && showKeyPath()"
                        [attr.marker-end]="conn.isConflict ? 'url(#arrow-conflict)' : ((isCriticalPath(conn.upstreamId) && isCriticalPath(conn.downstreamId)) && showKeyPath() ? 'url(#arrow-key)' : 'url(#arrow-normal)')"
                      />
                    }
                  </svg>

                  <!-- Task Bars -->
                  @for (task of store.filteredTasks(); track task.id; let idx = $index) {
                    <div class="gantt-bar-lane" [style.top.px]="idx * 52" (click)="openTask(task.id)">
                      <!-- Schedule Shift Baseline Shadow -->
                      @if (showScheduleShift() && task.baselineDueDate && task.dueDate > task.baselineDueDate) {
                        <div
                          class="gantt-shadow-bar"
                          [style.left.px]="getGanttLeftPx(task)"
                          [style.width.px]="getBaselineWidthPx(task)"
                          title="Original committed baseline: {{ task.baselineDueDate }}"
                        >
                          <span class="shadow-label font-mono">Shift: {{ task.baselineDueDate | slice:5:10 }}</span>
                        </div>
                      }

                      <!-- Live Forecast Delivery Bar -->
                      <div
                        class="gantt-live-bar"
                        [style.left.px]="getGanttLeftPx(task)"
                        [style.width.px]="getGanttWidthPx(task)"
                        [attr.data-status]="task.status"
                        [class.is-key-bar]="isCriticalPath(task.id) && showKeyPath()"
                        [class.is-blocked]="task.blocked"
                      >
                        <div class="bar-content-row">
                          @if (task.blocked) { <span>🚫</span> }
                          @if (task.slipReason) { <span>⚠️</span> }
                          <span class="bar-title text-truncate">{{ task.title }}</span>
                          <span class="bar-date font-mono">{{ task.dueDate | slice:5:10 }}</span>
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
              <h3>Create New Deliverable</h3>
              <button type="button" class="btn-close" (click)="closeNewTaskModal()">✕</button>
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
    </div>
  `,
  styles: [`
    .workspace-page-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .workspace-toolbar {
      padding: 12px 24px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-subtle);
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
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 3px;
      gap: 2px;
    }

    .tab-btn {
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      background: transparent;
      border: none;
      cursor: pointer;
      transition: all 0.12s ease;
    }

    .tab-btn:hover {
      color: var(--text-primary);
    }

    .tab-btn.active {
      background: var(--bg-surface);
      color: var(--text-primary);
      box-shadow: var(--shadow-sm);
    }

    .search-box-wrap {
      position: relative;
      display: flex;
      align-items: center;
      width: 220px;
    }

    .search-icon {
      position: absolute;
      left: 10px;
      font-size: 12px;
      color: var(--text-muted);
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      padding: 6px 26px 6px 28px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-canvas);
      color: var(--text-primary);
      font-size: 12px;
      outline: none;
    }

    .btn-clear {
      position: absolute;
      right: 6px;
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 11px;
    }

    .priority-chips {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .p-chip {
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      cursor: pointer;
    }

    .p-chip.active {
      background: var(--bg-elevated);
      color: var(--text-primary);
      border-color: var(--border-strong);
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-action {
      padding: 7px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.15s ease;
    }

    .btn-smart-import {
      background: rgba(124, 58, 237, 0.12);
      border: 1px solid rgba(124, 58, 237, 0.4);
      color: #8b5cf6;
    }

    .btn-smart-import:hover:not(:disabled) {
      background: rgba(124, 58, 237, 0.2);
    }

    .btn-new-task {
      background: var(--color-primary);
      color: #ffffff;
    }

    .btn-new-task:hover:not(:disabled) {
      background: var(--color-primary-hover);
    }

    .workspace-viewport {
      flex: 1;
      padding: 20px 24px;
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
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      min-height: calc(100vh - 200px);
    }

    .kanban-column.col-deployed-highlight {
      background: var(--status-deployed-bg);
      border-color: var(--status-deployed);
    }

    .col-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding: 0 4px;
    }

    .col-title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .col-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .col-name {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .col-count {
      font-size: 11px;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 10px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
    }

    .lead-check-tag {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 4px;
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
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 12px 14px;
      box-shadow: var(--shadow-sm);
      cursor: grab;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
    }

    .task-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
      border-color: var(--border-strong);
    }

    .task-card.card-is-deployed {
      border-color: var(--status-deployed);
    }

    .task-card.card-is-blocked {
      border-color: #ef4444;
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
    }

    .card-blocked-tag {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 4px;
      border-radius: 3px;
      background: rgba(239, 68, 68, 0.15);
      color: #dc2626;
    }

    .card-lock-badge {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 3px;
      background: var(--bg-hover);
      color: var(--text-muted);
      border: 1px solid var(--border-subtle);
    }

    .modal-assignee-pool {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;
    }

    .truncate-names {
      max-width: 110px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .card-pts {
      font-size: 11px;
      color: var(--text-muted);
    }

    .card-title {
      font-size: 13px;
      color: var(--text-primary);
      line-height: 1.4;
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
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 3px;
      background: var(--badge-medium-bg);
      color: var(--badge-medium-text);
    }

    .card-p-badge[data-priority="CRITICAL"] {
      background: var(--badge-critical-bg);
      color: var(--badge-critical-text);
    }

    .card-checklist-tag {
      font-size: 10.5px;
      color: var(--text-secondary);
    }

    .key-path-tag {
      font-size: 9px;
      font-weight: 800;
      padding: 1px 4px;
      border-radius: 3px;
      background: rgba(249, 115, 22, 0.15);
      color: #f97316;
    }

    .card-assignee-avatar {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      color: #ffffff;
      font-size: 9.5px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* SPRINT TABLE */
    .sprint-table-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      overflow-x: auto;
    }

    .sprint-data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .sprint-data-table th {
      padding: 10px 14px;
      background: var(--bg-elevated);
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1px solid var(--border-subtle);
    }

    .sprint-row {
      border-bottom: 1px solid var(--border-subtle);
      cursor: pointer;
      transition: background-color 0.1s ease;
    }

    .sprint-row:hover {
      background: var(--bg-canvas);
    }

    .sprint-data-table td {
      padding: 11px 14px;
      font-size: 12.5px;
    }

    .sprint-title-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .sprint-task-title {
      color: var(--text-primary);
      font-size: 12.5px;
    }

    .table-member-cell {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .sprint-select-status {
      padding: 4px 8px;
      border-radius: 5px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-canvas);
      color: var(--text-primary);
      font-size: 11.5px;
      outline: none;
    }

    /* GANTT */
    .gantt-wrapper {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .gantt-sub-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 10px 16px;
      flex-wrap: wrap;
    }

    .gantt-stats-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .gantt-stat-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 10px;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
    }

    .key-path-pill {
      background: rgba(249, 115, 22, 0.12);
      border-color: #f97316;
      color: #ea580c;
    }

    .gantt-toggle-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-gantt-opt {
      padding: 5px 10px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 600;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      cursor: pointer;
    }

    .btn-gantt-opt.active {
      background: var(--color-primary);
      color: #ffffff;
      border-color: var(--color-primary);
    }

    .gantt-conflict-bar {
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.35);
      border-radius: 8px;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .conflict-glyph { font-size: 18px; }
    .conflict-text p { font-size: 11.5px; color: var(--text-secondary); margin: 2px 0 0 0; }

    .btn-auto-align {
      padding: 6px 12px;
      border-radius: 6px;
      background: #dc2626;
      color: #ffffff;
      border: none;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
    }

    .gantt-split-board {
      display: flex;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      overflow: hidden;
    }

    .gantt-left-tree {
      width: 340px;
      min-width: 340px;
      border-right: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
    }

    .gantt-tree-header {
      height: 40px;
      padding: 0 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-elevated);
      border-bottom: 1px solid var(--border-subtle);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-muted);
    }

    .gantt-tree-rows {
      display: flex;
      flex-direction: column;
    }

    .gantt-tree-item {
      height: 52px;
      box-sizing: border-box;
      padding: 0 14px;
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      transition: background-color 0.1s ease;
    }

    .gantt-tree-item:hover {
      background: var(--bg-canvas);
    }

    .gantt-tree-item.is-key-row {
      border-left: 3px solid #f97316;
    }

    .tree-item-title-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
      overflow: hidden;
      flex: 1;
    }

    .tree-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .dep-pill {
      font-size: 9.5px;
      background: var(--badge-medium-bg);
      color: var(--badge-medium-text);
      padding: 1px 5px;
      border-radius: 3px;
    }

    .gantt-right-grid {
      flex: 1;
      overflow-x: auto;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .gantt-calendar-header {
      width: 900px;
      height: 40px;
      display: flex;
      background: var(--bg-elevated);
      border-bottom: 1px solid var(--border-subtle);
    }

    .gantt-day-tick {
      width: 30px;
      min-width: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-right: 1px dashed var(--border-subtle);
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 600;
    }

    .gantt-track-area {
      width: 900px;
      position: relative;
    }

    .gantt-grid-columns {
      position: absolute;
      inset: 0;
      display: flex;
      pointer-events: none;
    }

    .day-v-line {
      width: 30px;
      min-width: 30px;
      border-right: 1px dashed var(--border-subtle);
      height: 100%;
    }

    .gantt-svg-overlay {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 5;
    }

    .gantt-path {
      fill: none;
      stroke: var(--color-primary);
      stroke-width: 2;
      opacity: 0.8;
    }

    .gantt-path.path-key { stroke: #f97316; stroke-width: 2.5; }
    .gantt-path.path-conflict { stroke: #ef4444; stroke-width: 2.5; stroke-dasharray: 4 2; }

    .gantt-bar-lane {
      position: absolute;
      left: 0;
      right: 0;
      height: 52px;
      cursor: pointer;
    }

    .gantt-shadow-bar {
      position: absolute;
      top: 6px;
      height: 12px;
      border-radius: 4px;
      background: rgba(148, 163, 184, 0.25);
      border: 1px dashed var(--text-muted);
      z-index: 2;
      overflow: hidden;
      display: flex;
      align-items: center;
      padding: 0 4px;
    }

    .shadow-label { font-size: 8px; color: var(--text-muted); }

    .gantt-live-bar {
      position: absolute;
      top: 15px;
      height: 26px;
      border-radius: 5px;
      color: #ffffff;
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      padding: 0 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
      z-index: 3;
    }

    .gantt-live-bar[data-status="TODO"] { background: var(--status-todo); }
    .gantt-live-bar[data-status="IN_PROGRESS"] { background: var(--status-inprogress); }
    .gantt-live-bar[data-status="DEPLOYED"] { background: var(--status-deployed); }
    .gantt-live-bar[data-status="DONE"] { background: var(--status-done); }

    .gantt-live-bar.is-key-bar {
      box-shadow: 0 0 0 2px #f97316, 0 2px 6px rgba(249, 115, 22, 0.35);
    }

    .bar-content-row {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      overflow: hidden;
    }

    .bar-title { flex: 1; }
    .bar-date { font-size: 9px; opacity: 0.85; }

    /* SHARED MODALS */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(10, 14, 20, 0.55);
      backdrop-filter: blur(2px);
      z-index: 95;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .modal-card {
      width: 100%;
      max-width: 520px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      box-shadow: var(--shadow-lg);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      max-height: 90vh;
    }

    .modal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .modal-head h3 { font-size: 15px; font-weight: 700; margin: 0; }
    .btn-close { background: transparent; border: none; font-size: 16px; cursor: pointer; color: var(--text-muted); }

    .modal-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      overflow-y: auto;
    }

    .form-group { display: flex; flex-direction: column; gap: 4px; }
    .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .form-label { font-size: 11.5px; font-weight: 600; color: var(--text-secondary); }
    .form-label.required::after { content: ' *'; color: #ef4444; }

    .form-input, .form-select, .form-textarea {
      padding: 7px 10px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-canvas);
      color: var(--text-primary);
      font-size: 12px;
      outline: none;
    }

    .modal-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      padding: 14px 20px;
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-elevated);
    }

    .btn-cancel {
      padding: 7px 14px;
      border-radius: 6px;
      background: transparent;
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      font-size: 12px;
      cursor: pointer;
    }

    .btn-submit {
      padding: 7px 16px;
      border-radius: 6px;
      background: var(--color-primary);
      border: none;
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
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

  // Gantt Signals & Timeline Helpers
  readonly showKeyPath = signal<boolean>(true);
  readonly showScheduleShift = signal<boolean>(true);
  readonly timelineDays = Array.from({ length: 30 }, (_, i) => i + 1);

  // Modals
  readonly isNewTaskModalOpen = signal<boolean>(false);
  readonly isSmartImportModalOpen = signal<boolean>(false);

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

  toggleKeyPath(): void {
    this.showKeyPath.update(v => !v);
  }

  toggleScheduleShift(): void {
    this.showScheduleShift.update(v => !v);
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

  getGanttLeftPx(task: Task): number {
    const baseTimestamp = new Date('2026-11-01').getTime();
    const startTs = new Date(task.startDate || '2026-11-01').getTime();
    const startOffsetDays = Math.max(0, Math.min(30, (startTs - baseTimestamp) / 86400000));
    return Math.round(startOffsetDays * 30);
  }

  getGanttWidthPx(task: Task): number {
    const startTs = new Date(task.startDate || '2026-11-01').getTime();
    const dueTs = new Date(task.dueDate || '2026-11-15').getTime();
    const durationDays = Math.max(1, Math.min(30, (dueTs - startTs) / 86400000));
    return Math.max(28, Math.round(durationDays * 30));
  }

  getBaselineWidthPx(task: Task): number {
    const startTs = new Date(task.startDate || '2026-11-01').getTime();
    const dueTs = new Date(task.baselineDueDate || task.dueDate || '2026-11-15').getTime();
    const durationDays = Math.max(1, Math.min(30, (dueTs - startTs) / 86400000));
    return Math.max(28, Math.round(durationDays * 30));
  }

  getGanttConnectors(): Array<{ path: string; isConflict: boolean; upstreamId: string; downstreamId: string }> {
    const tasks = this.store.filteredTasks();
    const taskIndexMap = new Map<string, number>();
    const taskMap = new Map<string, Task>();
    tasks.forEach((t, idx) => {
      taskIndexMap.set(t.id, idx);
      taskMap.set(t.id, t);
    });

    const connectors: Array<{ path: string; isConflict: boolean; upstreamId: string; downstreamId: string }> = [];

    tasks.forEach((downstream, downIdx) => {
      (downstream.dependencies || []).forEach(upstreamId => {
        const upstream = taskMap.get(upstreamId);
        const upIdx = taskIndexMap.get(upstreamId);
        if (upstream && upIdx !== undefined) {
          const x1 = this.getGanttLeftPx(upstream) + this.getGanttWidthPx(upstream);
          const y1 = upIdx * 52 + 26;
          const x2 = this.getGanttLeftPx(downstream);
          const y2 = downIdx * 52 + 26;

          const dx = Math.abs(x2 - x1);
          const curveOffset = Math.min(30, Math.max(15, dx / 2));
          const path = `M ${x1} ${y1} C ${x1 + curveOffset} ${y1}, ${x2 - curveOffset} ${y2}, ${x2} ${y2}`;
          const isConflict = upstream.dueDate > downstream.startDate;

          connectors.push({
            path,
            isConflict,
            upstreamId: upstream.id,
            downstreamId: downstream.id
          });
        }
      });
    });

    return connectors;
  }
}
