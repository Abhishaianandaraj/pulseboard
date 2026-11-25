import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import {
  TaskStoreService,
  todayIsoDate,
  addCalendarDays,
  diffCalendarDays,
  formatShortDate
} from '../../services/task-store.service';
import {
  Task,
  TaskStatus,
  Subtask,
  Project,
  MethodologyView
} from '../../models/task.model';

interface GanttWeekColumn {
  id: string;
  label: string;
  startIso: string;
  endIso: string;
}

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  template: `
    <div class="workspace-page-wrapper">
      <!-- 1. Top Execution & Triage Toolbar -->
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
              <i class="ph-light ph-chart-bar-horizontal"></i>
              <span>Gantt Chart</span>
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
              placeholder="Search tasks, ID, owner, phase..."
              [ngModel]="store.searchQuery()"
              (ngModelChange)="store.searchQuery.set($event)"
            />
            @if (store.searchQuery()) {
              <button type="button" class="btn-clear" (click)="store.searchQuery.set('')" title="Clear search">
                <i class="ph-light ph-x"></i>
              </button>
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
              Medium
            </button>
          </div>
        </div>

        <!-- Toolbar Right Triage Filters -->
        <div class="toolbar-right">
          <!-- Prominent Due Soon Weekly Follow-Up Filter -->
          <button
            type="button"
            class="btn-triage-filter btn-due-soon"
            [class.active]="store.filterDueSoon()"
            (click)="toggleDueSoonFilter()"
            title="Filter tasks due within 3 days or overdue (not Completed) for weekly follow-up"
          >
            <i class="ph-light ph-calendar-check"></i>
            <span>Due Soon</span>
            <span class="triage-count-badge font-mono" [class.has-items]="store.dueSoonCount() > 0">
              {{ store.dueSoonCount() }}
            </span>
          </button>

          <!-- Blocked Filter -->
          <button
            type="button"
            class="btn-triage-filter btn-blocked-filter"
            [class.active]="store.filterBlockedOnly()"
            (click)="toggleBlockedFilter()"
            title="Show only blocked tasks"
          >
            <i class="ph-light ph-warning"></i>
            <span>Blocked</span>
            @if (store.blockedCount() > 0) {
              <span class="triage-count-badge danger font-mono">{{ store.blockedCount() }}</span>
            }
          </button>

          @if (hasActiveFilters()) {
            <button type="button" class="btn-reset-filters" (click)="clearAllFilters()">
              Reset Filters
            </button>
          }
        </div>
      </div>

      <!-- Active Due Soon Weekly Follow-Up Strip -->
      @if (store.filterDueSoon()) {
        <div class="due-soon-triage-banner">
          <div class="triage-banner-left">
            <i class="ph-light ph-bell-ringing"></i>
            <span>
              <strong>Weekly Follow-Up Filter Active:</strong> Showing {{ store.filteredTasks().length }} open task(s) due within 3 days or overdue, with % progress, due dates, blockers, and owners.
            </span>
          </div>
          <button type="button" class="btn-banner-clear" (click)="store.filterDueSoon.set(false)">
            Show All Tasks
          </button>
        </div>
      }

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
                    <span class="lead-check-tag">Sign-Off</span>
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
                              <i class="ph-light ph-lock-key"></i>
                            </span>
                          }
                        </div>
                        <span class="card-pts font-mono" title="Effort Points (Complexity)">{{ task.effortPoints }} pts</span>
                      </div>

                      <strong class="card-title">{{ task.title }}</strong>

                      @if (task.blocked && task.blockerReason) {
                        <div class="card-blocker-reason">
                          <i class="ph-light ph-warning-circle"></i>
                          <span>{{ task.blockerReason }}</span>
                        </div>
                      }

                      <!-- Card Progress Bar & Due Date Row -->
                      <div class="card-progress-wrap">
                        <div class="card-progress-meta">
                          <span class="card-pct font-mono">{{ task.progress }}%</span>
                          <span
                            class="card-due font-mono"
                            [class.due-soon]="store.isTaskDueSoon(task)"
                            [class.overdue]="store.isTaskOverdue(task)"
                          >
                            <i class="ph-light ph-calendar-blank"></i>
                            {{ getDueLabel(task) }}
                          </span>
                        </div>
                        <div class="card-progress-track">
                          <div
                            class="card-progress-fill"
                            [style.width.%]="task.progress"
                            [class.fill-done]="task.status === 'DONE'"
                            [class.fill-blocked]="task.blocked"
                          ></div>
                        </div>
                      </div>

                      <div class="card-footer">
                        <div class="card-meta-left">
                          <span class="card-p-badge" [attr.data-priority]="task.priority">{{ task.priority }}</span>
                          @if (task.subtasks.length > 0) {
                            <span class="card-checklist-tag font-mono">
                              <i class="ph-light ph-check-square"></i> {{ getCompletedSubtasks(task) }}/{{ task.subtasks.length }}
                            </span>
                          }
                          @if (task.dependencies.length > 0) {
                            <span class="card-dep-tag font-mono" [title]="'Depends on ' + task.dependencies.join(', ')">
                              <i class="ph-light ph-link"></i> {{ task.dependencies.length }}
                            </span>
                          }
                        </div>

                        <!-- Assigned Owners -->
                        <div class="card-owners-wrap" [title]="getTaskAssigneesFullNames(task)">
                          <div class="avatar-stack">
                            @for (m of store.getTaskMembers(task); track m.id) {
                              <span
                                class="avatar-stack-item"
                                [style.background-color]="m.color"
                              >
                                {{ m.avatar }}
                              </span>
                            }
                          </div>
                          <span class="card-owner-name">{{ getTaskAssigneesSummary(task) }}</span>
                        </div>
                      </div>
                    </div>
                  } @empty {
                    <div class="empty-col-state">
                      <span>No tasks in {{ col.title }}</span>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }

        <!-- B. SPRINT TABLE VIEW -->
        @if (store.currentView() === 'SPRINT') {
          <div class="sprint-table-card">
            <div class="sprint-table-scroll custom-scroll">
              <table class="sprint-data-table">
                <thead>
                  <tr>
                    <th style="width: 84px;">ID</th>
                    <th style="width: 100px;">Project</th>
                    <th>Deliverable</th>
                    <th style="width: 165px;">Owners</th>
                    <th style="width: 120px;">Progress</th>
                    <th style="width: 82px;">Priority</th>
                    <th style="width: 68px;">Effort</th>
                    <th style="width: 165px;">Schedule</th>
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
                        <div class="sprint-title-col">
                          <div class="sprint-title-wrap">
                            <strong class="sprint-task-title">{{ task.title }}</strong>
                            @if (task.blocked) {
                              <span class="card-blocked-tag">
                                <i class="ph-light ph-warning"></i> Blocked
                              </span>
                            }
                            @if (task.dependencies.length > 0) {
                              <span class="dep-inline-pill font-mono">After {{ task.dependencies.join(', ') }}</span>
                            }
                          </div>
                          @if (task.blocked && task.blockerReason) {
                            <span class="sprint-blocker-sub">{{ task.blockerReason }}</span>
                          }
                        </div>
                      </td>
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
                        <div class="table-progress-cell">
                          <div class="table-progress-bar">
                            <div class="table-progress-fill" [style.width.%]="task.progress"></div>
                          </div>
                          <span class="font-mono text-xs">{{ task.progress }}%</span>
                        </div>
                      </td>
                      <td>
                        <span class="card-p-badge" [attr.data-priority]="task.priority">{{ task.priority }}</span>
                      </td>
                      <td class="font-mono text-xs tabular-nums">{{ task.effortPoints }} pts</td>
                      <td>
                        <div class="table-schedule-cell font-mono">
                          <span>{{ formatDateShort(task.startDate) }} → {{ formatDateShort(task.dueDate) }}</span>
                          @if (store.isTaskDueSoon(task)) {
                            <span class="table-due-flag" [class.overdue]="store.isTaskOverdue(task)">
                              {{ store.isTaskOverdue(task) ? 'Overdue' : 'Due Soon' }}
                            </span>
                          }
                        </div>
                      </td>
                      <td (click)="$event.stopPropagation()">
                        <select
                          class="sprint-select-status"
                          [ngModel]="task.status"
                          (ngModelChange)="store.updateTaskStatus(task.id, $event)"
                          [disabled]="!store.canEditTask(task)"
                        >
                          <option value="TODO">Yet to Start</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="DEPLOYED">Under Review</option>
                          <option value="DONE" [disabled]="!store.canSignOffDone() && task.status !== 'DONE'">Completed</option>
                        </select>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="9" class="empty-table-cell">
                        No tasks match the active filters. Click <strong>+ New Task</strong> in the top bar to create a deliverable.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- C. GANTT CHART VIEW -->
        @if (store.currentView() === 'TIMELINE') {
          <div class="timeline-container">
            <!-- 1. Gantt Legend & Schedule Controls -->
            <div class="timeline-sub-toolbar">
              <div class="timeline-legend-group">
                <div class="timeline-legend-item">
                  <span class="legend-color-dot dot-todo"></span>
                  <span class="legend-label">Yet to Start</span>
                </div>
                <div class="timeline-legend-item">
                  <span class="legend-color-dot dot-inprogress"></span>
                  <span class="legend-label">In Progress</span>
                </div>
                <div class="timeline-legend-item">
                  <span class="legend-color-dot dot-review"></span>
                  <span class="legend-label">Under Review</span>
                </div>
                <div class="timeline-legend-item">
                  <span class="legend-color-dot dot-completed"></span>
                  <span class="legend-label">Completed</span>
                </div>
                <div class="timeline-legend-item">
                  <span class="legend-color-dot dot-blocked"></span>
                  <span class="legend-label">Blocked</span>
                </div>
              </div>

              <div class="timeline-toolbar-actions">
                <span class="timeline-stat-pill font-mono">
                  {{ store.filteredTasks().length }} Task(s) · Hover row to inspect dependencies
                </span>

                @if (store.ganttScheduleMetrics().hasConflicts) {
                  <button
                    type="button"
                    class="btn-timeline-opt btn-conflict-autoshift"
                    [disabled]="!store.canEditTasks()"
                    (click)="store.cascadeShiftDates()"
                    title="Shift downstream start/due dates to start 1 day after upstream prerequisites finish"
                  >
                    <i class="ph-light ph-arrows-out-line-horizontal"></i>
                    <span>Auto-Shift Dates ({{ store.ganttScheduleMetrics().conflicts.length }})</span>
                  </button>
                }
              </div>
            </div>

            <!-- 2. Split Gantt Chart Canvas -->
            @if (store.filteredTasks().length > 0) {
              <div class="timeline-split-card">
                <!-- Left Column: Deliverable, Status & Dependencies (350px) -->
                <div class="timeline-left-column">
                  <div class="timeline-col-header">
                    <span>Deliverable &amp; Prerequisites</span>
                    <span class="font-mono text-muted text-xs">Effort</span>
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
                              [attr.data-status]="getGanttStatusKey(task)"
                            >
                              {{ task.blocked ? 'Blocked' : store.getStatusLabel(task.status) }}
                            </span>
                          </div>
                          <span class="deliverable-title text-truncate" [title]="task.title">
                            {{ task.title }}
                          </span>
                          <div class="deliverable-sub-row">
                            <span class="deliverable-dates font-mono">
                              {{ formatDateShort(task.startDate) }} – {{ formatDateShort(task.dueDate) }}
                            </span>
                            @if (task.dependencies.length > 0) {
                              <span class="dep-pill font-mono">
                                <i class="ph-light ph-arrow-bend-down-right"></i> After {{ task.dependencies.join(', ') }}
                              </span>
                            }
                          </div>
                        </div>
                        <span class="font-mono text-muted text-xs deliverable-effort">{{ task.effortPoints }}p</span>
                      </div>
                    }
                  </div>
                </div>

                <!-- Right Column: Dynamic Weekly Schedule & Filled Progress Bars -->
                <div class="timeline-right-column custom-scroll">
                  <div class="timeline-weeks-header" [style.grid-template-columns]="'repeat(' + ganttWindow().weeks.length + ', minmax(160px, 1fr))'">
                    @for (week of ganttWindow().weeks; track week.id) {
                      <div class="timeline-week-head-col">
                        <span>{{ week.label }}</span>
                      </div>
                    }

                    @if (ganttWindow().todayPct !== null) {
                      <div class="timeline-today-head-badge" [style.left.%]="ganttWindow().todayPct">
                        <span class="today-tag-text font-mono">TODAY</span>
                      </div>
                    }
                  </div>

                  <div class="timeline-track-canvas" [style.height.px]="store.filteredTasks().length * 88">
                    <!-- Vertical Weekly Dividers -->
                    <div class="timeline-weeks-grid-bg" [style.grid-template-columns]="'repeat(' + ganttWindow().weeks.length + ', minmax(160px, 1fr))'">
                      @for (week of ganttWindow().weeks; track week.id) {
                        <div class="week-v-divider"></div>
                      }
                    </div>

                    <!-- Today Marker Line -->
                    @if (ganttWindow().todayPct !== null) {
                      <div class="timeline-today-v-line" [style.left.%]="ganttWindow().todayPct"></div>
                    }

                    <!-- Hover-Only Curved Dependency Connectors -->
                    <svg
                      class="timeline-hover-svg"
                      width="100%"
                      [attr.height]="store.filteredTasks().length * 88"
                      [attr.viewBox]="'0 0 1000 ' + (store.filteredTasks().length * 88)"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <marker
                          id="gantt-arrow-normal"
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
                          id="gantt-arrow-danger"
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
                          [attr.marker-end]="conn.isConflict ? 'url(#gantt-arrow-danger)' : 'url(#gantt-arrow-normal)'"
                        />
                      }
                    </svg>

                    <!-- Task Gantt Bars with Filled % Progress & Schedule Variance -->
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
                        <div
                          class="gantt-bar-outer"
                          [style.left.%]="getGanttBarLeftPercent(task)"
                          [style.width.%]="getGanttBarWidthPercent(task)"
                          [attr.data-status]="getGanttStatusKey(task)"
                          [title]="task.title + ' · ' + task.progress + '% complete (' + task.startDate + ' to ' + task.dueDate + ')'"
                        >
                          <!-- Crisp Filled Progress Bar (0% - 100%) -->
                          <div class="gantt-bar-progress-fill" [style.width.%]="task.progress"></div>

                          <!-- Bar Foreground Content -->
                          <div class="gantt-bar-content">
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

                            <span class="gantt-bar-pct font-mono">{{ task.progress }}%</span>

                            <span
                              class="gantt-variance-tag font-mono"
                              [class.is-slipped]="getScheduleVarianceDays(task) > 0"
                            >
                              {{ getScheduleVarianceDays(task) > 0 ? 'Slipped +' + getScheduleVarianceDays(task) + 'd' : 'On Track' }}
                            </span>
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </div>
            } @else {
              <div class="empty-gantt-card">
                <i class="ph-light ph-chart-bar-horizontal"></i>
                <h4>No Tasks to Plot</h4>
                <p>Clear active filters or click <strong>+ New Task</strong> in the top bar to schedule deliverables on the Gantt Chart.</p>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .workspace-page-wrapper {
      display: flex;
      flex-direction: column;
      min-height: calc(100vh - 56px);
      width: 100%;
      max-width: 100%;
      overflow-x: hidden;
      background: var(--bg-canvas);
    }

    .workspace-toolbar {
      padding: 10px 20px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .toolbar-left, .toolbar-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .view-switch-tabs {
      display: flex;
      align-items: center;
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-inner);
      padding: 2px;
      gap: 2px;
    }

    .tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: var(--radius-pill);
      font-size: 12px;
      font-weight: 600;
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
    }

    .search-box-wrap {
      position: relative;
      display: flex;
      align-items: center;
      width: 230px;
    }

    .search-icon {
      position: absolute;
      left: 10px;
      font-size: 13px;
      color: var(--text-muted);
      pointer-events: none;
      display: flex;
      align-items: center;
    }

    .search-input {
      width: 100%;
      padding: 6px 26px 6px 30px;
      border-radius: var(--radius-inner);
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
      gap: 4px;
    }

    .p-chip {
      padding: 5px 10px;
      border-radius: var(--radius-pill);
      font-size: 11px;
      font-weight: 600;
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
      cursor: pointer;
      transition: var(--transition-tactile);
    }

    .p-chip:hover {
      color: var(--text-primary);
      background: var(--bg-surface);
    }

    .p-chip.active {
      background: var(--accent-primary-tint);
      border-color: var(--accent-primary);
      color: var(--accent-primary);
    }

    .btn-triage-filter {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition-tactile);
    }

    .btn-triage-filter:hover {
      background: var(--bg-surface);
      color: var(--text-primary);
    }

    .btn-due-soon.active {
      background: var(--accent-warn-tint);
      border-color: var(--accent-warn);
      color: var(--accent-warn);
    }

    .btn-blocked-filter.active {
      background: var(--status-blocked-bg);
      border-color: var(--accent-danger);
      color: var(--status-blocked-text);
    }

    .triage-count-badge {
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      font-size: 10.5px;
      font-weight: 700;
      background: var(--bg-surface);
      color: var(--text-muted);
    }

    .triage-count-badge.has-items {
      background: var(--accent-warn);
      color: #fff;
    }

    .triage-count-badge.danger {
      background: var(--accent-danger);
      color: #fff;
    }

    .btn-reset-filters {
      padding: 5px 10px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-hairline);
      background: transparent;
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-reset-filters:hover { color: var(--text-primary); }

    .due-soon-triage-banner {
      padding: 8px 20px;
      background: var(--accent-warn-tint);
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-size: 12px;
      color: var(--text-primary);
    }

    .triage-banner-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .triage-banner-left i {
      color: var(--accent-warn);
      font-size: 15px;
    }

    .btn-banner-clear {
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }

    .workspace-viewport {
      flex: 1;
      padding: 16px 20px 28px;
      min-width: 0;
    }

    /* KANBAN BOARD */
    .kanban-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      align-items: start;
    }

    @media (max-width: 1180px) {
      .kanban-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 720px) {
      .kanban-grid {
        grid-template-columns: 1fr;
      }
    }

    .kanban-column {
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      display: flex;
      flex-direction: column;
      min-width: 0;
      max-height: calc(100vh - 155px);
    }

    .col-head {
      padding: 12px 14px;
      border-bottom: 1px solid var(--border-hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-shrink: 0;
    }

    .col-title-wrap {
      display: flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
    }

    .col-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .col-name {
      font-size: 12.5px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
      white-space: nowrap;
    }

    .col-count {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      padding: 1px 7px;
      border-radius: var(--radius-pill);
    }

    .lead-check-tag {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: var(--radius-pill);
      background: var(--status-deployed-bg);
      color: var(--status-deployed-text);
      white-space: nowrap;
    }

    .kanban-drop-zone {
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 160px;
      overflow-y: auto;
    }

    .empty-col-state {
      padding: 24px 12px;
      text-align: center;
      font-size: 11.5px;
      color: var(--text-muted);
      border: 1px dashed var(--border-hairline);
      border-radius: var(--radius-inner);
    }

    .task-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-inner);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 9px;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      transition: var(--transition-tactile);
    }

    .task-card:hover {
      border-color: var(--accent-primary);
      box-shadow: var(--shadow-md);
    }

    .task-card.card-is-blocked {
      border-left: 3px solid var(--accent-danger);
    }

    .task-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }

    .card-id-row {
      display: flex;
      align-items: center;
      gap: 5px;
      flex-wrap: wrap;
    }

    .card-id {
      font-size: 10.5px;
      font-weight: 700;
      color: var(--text-muted);
    }

    .card-proj-badge {
      font-size: 10px;
      font-weight: 700;
      background: var(--bg-subtle);
      padding: 1px 6px;
      border-radius: 4px;
    }

    .card-blocked-tag {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--status-blocked-bg);
      color: var(--status-blocked-text);
    }

    .card-lock-badge {
      color: var(--text-muted);
      font-size: 12px;
      display: inline-flex;
    }

    .card-pts {
      font-size: 10.5px;
      font-weight: 700;
      color: var(--text-secondary);
      background: var(--bg-subtle);
      padding: 1px 6px;
      border-radius: 4px;
      white-space: nowrap;
    }

    .card-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      line-height: 1.38;
      word-break: break-word;
    }

    .card-blocker-reason {
      display: flex;
      align-items: flex-start;
      gap: 5px;
      font-size: 11px;
      color: var(--status-blocked-text);
      background: var(--status-blocked-bg);
      padding: 5px 8px;
      border-radius: 4px;
      line-height: 1.35;
    }

    .card-progress-wrap {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .card-progress-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10.5px;
      color: var(--text-muted);
    }

    .card-pct {
      font-weight: 700;
      color: var(--text-secondary);
    }

    .card-due {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .card-due.due-soon {
      color: var(--accent-warn);
      font-weight: 700;
    }

    .card-due.overdue {
      color: var(--accent-danger);
      font-weight: 700;
    }

    .card-progress-track {
      height: 5px;
      border-radius: 999px;
      background: var(--bg-subtle);
      overflow: hidden;
    }

    .card-progress-fill {
      height: 100%;
      background: var(--accent-primary);
      border-radius: 999px;
      transition: width 0.2s ease;
    }

    .card-progress-fill.fill-done { background: var(--status-done); }
    .card-progress-fill.fill-blocked { background: var(--accent-danger); }

    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-top: 4px;
      border-top: 1px solid var(--border-hairline);
    }

    .card-meta-left {
      display: flex;
      align-items: center;
      gap: 5px;
      flex-wrap: wrap;
    }

    .card-p-badge {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--bg-subtle);
      color: var(--text-secondary);
    }
    .card-p-badge[data-priority="CRITICAL"] { background: var(--badge-critical-bg); color: var(--badge-critical-text); }
    .card-p-badge[data-priority="HIGH"] { background: var(--badge-high-bg); color: var(--badge-high-text); }

    .card-checklist-tag, .card-dep-tag {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      color: var(--text-muted);
    }

    .card-owners-wrap {
      display: flex;
      align-items: center;
      gap: 5px;
      min-width: 0;
    }

    .card-owner-name {
      font-size: 10.5px;
      color: var(--text-secondary);
      font-weight: 500;
      max-width: 82px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .avatar-stack {
      display: flex;
      align-items: center;
    }

    .avatar-stack-item {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      color: #fff;
      font-size: 8.5px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1.5px solid var(--bg-surface);
      margin-left: -5px;
    }
    .avatar-stack-item:first-child { margin-left: 0; }

    /* SPRINT TABLE */
    .sprint-table-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      overflow: hidden;
      box-shadow: var(--shadow-sm);
    }

    .sprint-table-scroll {
      width: 100%;
      overflow-x: auto;
    }

    .sprint-data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .sprint-data-table th {
      padding: 11px 14px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      background: var(--bg-subtle);
      border-bottom: 1px solid var(--border-hairline);
    }

    .sprint-data-table td {
      padding: 11px 14px;
      border-bottom: 1px solid var(--border-hairline);
      vertical-align: middle;
    }

    .sprint-row {
      cursor: pointer;
      transition: background 0.12s ease;
    }
    .sprint-row:hover { background: var(--bg-subtle); }

    .sprint-title-col {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .sprint-title-wrap {
      display: flex;
      align-items: center;
      gap: 7px;
      flex-wrap: wrap;
    }

    .sprint-task-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .sprint-blocker-sub {
      font-size: 11px;
      color: var(--accent-danger);
    }

    .dep-inline-pill {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      color: var(--text-secondary);
      border: 1px solid var(--border-hairline);
    }

    .table-member-cell {
      display: flex;
      align-items: center;
      gap: 7px;
    }

    .truncate-names {
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .table-progress-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .table-progress-bar {
      flex: 1;
      height: 6px;
      background: var(--bg-subtle);
      border-radius: 999px;
      overflow: hidden;
      min-width: 48px;
    }

    .table-progress-fill {
      height: 100%;
      background: var(--accent-primary);
      border-radius: 999px;
    }

    .table-schedule-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 11px;
      color: var(--text-secondary);
    }

    .table-due-flag {
      font-size: 9.5px;
      font-weight: 700;
      color: var(--accent-warn);
    }
    .table-due-flag.overdue { color: var(--accent-danger); }

    .sprint-select-status {
      width: 100%;
      padding: 5px 8px;
      border-radius: var(--radius-inner);
      border: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      color: var(--text-primary);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .empty-table-cell {
      padding: 32px !important;
      text-align: center;
      color: var(--text-muted);
      font-size: 12.5px;
    }

    .text-xs { font-size: 11.5px; }
    .text-muted { color: var(--text-muted); }
    .text-secondary { color: var(--text-secondary); }

    /* GANTT CHART VIEW */
    .timeline-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .timeline-sub-toolbar {
      padding: 10px 16px;
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .timeline-legend-group {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }

    .timeline-legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .legend-color-dot {
      width: 10px;
      height: 10px;
      border-radius: 3px;
    }
    .dot-todo { background: var(--status-todo); }
    .dot-inprogress { background: var(--accent-primary); }
    .dot-review { background: var(--status-deployed); }
    .dot-completed { background: var(--status-done); }
    .dot-blocked { background: var(--accent-danger); }

    .timeline-toolbar-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .timeline-stat-pill {
      font-size: 11px;
      color: var(--text-muted);
      background: var(--bg-subtle);
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-hairline);
    }

    .btn-conflict-autoshift {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: var(--radius-pill);
      background: var(--accent-primary);
      color: #fff;
      border: none;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .timeline-split-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      display: flex;
      overflow: hidden;
      box-shadow: var(--shadow-sm);
    }

    .timeline-left-column {
      width: 340px;
      min-width: 340px;
      border-right: 1px solid var(--border-hairline);
      display: flex;
      flex-direction: column;
      background: var(--bg-surface);
      z-index: 3;
    }

    .timeline-col-header {
      height: 44px;
      padding: 0 14px;
      background: var(--bg-subtle);
      border-bottom: 1px solid var(--border-hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
    }

    .timeline-deliverable-item {
      height: 88px;
      min-height: 88px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border-hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      cursor: pointer;
      transition: background 0.14s ease;
    }

    .timeline-deliverable-item:hover,
    .timeline-deliverable-item.is-hovered {
      background: var(--bg-subtle);
    }

    .timeline-deliverable-item.is-connected {
      background: var(--accent-primary-tint);
    }

    .deliverable-meta-wrap {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      flex: 1;
    }

    .deliverable-badges-row {
      display: flex;
      align-items: center;
      gap: 5px;
      flex-wrap: wrap;
    }

    .deliverable-key {
      font-size: 10.5px;
      font-weight: 700;
      color: var(--text-muted);
    }

    .timeline-status-badge {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      color: var(--text-secondary);
    }
    .timeline-status-badge[data-status="inprogress"] { background: var(--accent-primary-tint); color: var(--accent-primary); }
    .timeline-status-badge[data-status="review"] { background: var(--status-deployed-bg); color: var(--status-deployed-text); }
    .timeline-status-badge[data-status="completed"] { background: var(--status-done-bg); color: var(--status-done-text); }
    .timeline-status-badge[data-status="blocked"] { background: var(--status-blocked-bg); color: var(--status-blocked-text); }

    .deliverable-title {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .deliverable-sub-row {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .deliverable-dates {
      font-size: 10px;
      color: var(--text-muted);
    }

    .dep-pill {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 9.5px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      color: var(--accent-primary);
      border: 1px solid var(--border-hairline);
    }

    .timeline-right-column {
      flex: 1;
      min-width: 0;
      overflow-x: auto;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    .timeline-weeks-header {
      height: 44px;
      background: var(--bg-subtle);
      border-bottom: 1px solid var(--border-hairline);
      display: grid;
      position: relative;
      min-width: 640px;
    }

    .timeline-week-head-col {
      display: flex;
      align-items: center;
      justify-content: center;
      border-right: 1px solid var(--border-hairline);
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      padding-top: 8px;
    }
    .timeline-week-head-col:last-child { border-right: none; }

    .timeline-today-head-badge {
      position: absolute;
      top: 2px;
      transform: translateX(-50%);
      z-index: 5;
      pointer-events: none;
    }

    .today-tag-text {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--accent-primary);
      color: #fff;
      letter-spacing: 0.04em;
    }

    .timeline-track-canvas {
      position: relative;
      min-width: 640px;
    }

    .timeline-weeks-grid-bg {
      position: absolute;
      inset: 0;
      display: grid;
      pointer-events: none;
    }

    .week-v-divider {
      border-right: 1px dashed var(--border-hairline);
      height: 100%;
    }
    .week-v-divider:last-child { border-right: none; }

    .timeline-today-v-line {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 0;
      border-left: 1.5px dashed var(--accent-primary);
      z-index: 2;
      pointer-events: none;
    }

    .timeline-hover-svg {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 4;
    }

    .timeline-svg-connector {
      fill: none;
      stroke: var(--accent-primary);
      stroke-width: 2;
      stroke-dasharray: 4 3;
    }

    .timeline-svg-connector.connector-is-conflict {
      stroke: var(--accent-danger);
    }

    .timeline-lane-row {
      position: absolute;
      left: 0;
      right: 0;
      height: 88px;
      border-bottom: 1px solid var(--border-hairline);
      display: flex;
      align-items: center;
      cursor: pointer;
    }

    .timeline-lane-row:hover,
    .timeline-lane-row.is-hovered {
      background: var(--accent-primary-tint);
    }

    .gantt-bar-outer {
      position: absolute;
      height: 38px;
      border-radius: 6px;
      background: var(--bg-subtle);
      border: 1.5px solid var(--border-subtle);
      overflow: hidden;
      display: flex;
      align-items: center;
      z-index: 3;
      box-shadow: var(--shadow-sm);
      min-width: 115px;
    }

    .gantt-bar-outer[data-status="inprogress"] { border-color: var(--accent-primary); }
    .gantt-bar-outer[data-status="review"] { border-color: var(--status-deployed); }
    .gantt-bar-outer[data-status="completed"] { border-color: var(--status-done); }
    .gantt-bar-outer[data-status="blocked"] { border-color: var(--accent-danger); }

    .gantt-bar-progress-fill {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      background: var(--accent-primary-tint);
      border-right: 2px solid var(--accent-primary);
      transition: width 0.2s ease;
      pointer-events: none;
    }

    .gantt-bar-outer[data-status="completed"] .gantt-bar-progress-fill {
      background: var(--status-done-bg);
      border-right-color: var(--status-done);
    }

    .gantt-bar-outer[data-status="review"] .gantt-bar-progress-fill {
      background: var(--status-deployed-bg);
      border-right-color: var(--status-deployed);
    }

    .gantt-bar-outer[data-status="blocked"] .gantt-bar-progress-fill {
      background: var(--status-blocked-bg);
      border-right-color: var(--accent-danger);
    }

    .gantt-bar-content {
      position: relative;
      z-index: 2;
      width: 100%;
      padding: 0 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      white-space: nowrap;
    }

    .timeline-bar-avatar-stack {
      display: flex;
      align-items: center;
    }

    .bar-avatar-dot {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      color: #fff;
      font-size: 8.5px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1.5px solid var(--bg-surface);
      margin-left: -4px;
    }
    .bar-avatar-dot:first-child { margin-left: 0; }

    .gantt-bar-pct {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .gantt-variance-tag {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--bg-surface);
      color: var(--status-done-text);
      border: 1px solid var(--border-hairline);
    }

    .gantt-variance-tag.is-slipped {
      background: var(--status-blocked-bg);
      color: var(--status-blocked-text);
      border-color: var(--accent-danger);
    }

    .empty-gantt-card {
      padding: 48px 24px;
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      text-align: center;
      color: var(--text-secondary);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .empty-gantt-card i {
      font-size: 32px;
      color: var(--text-muted);
    }

    .empty-gantt-card h4 {
      margin: 0;
      font-size: 15px;
      color: var(--text-primary);
    }

    .empty-gantt-card p {
      margin: 0;
      font-size: 12.5px;
      color: var(--text-muted);
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
    { status: 'TODO', title: 'Yet to Start', description: 'Queued deliverables', accentColor: 'var(--status-todo)' },
    { status: 'IN_PROGRESS', title: 'In Progress', description: 'Actively in execution', accentColor: 'var(--accent-primary)' },
    { status: 'DEPLOYED', title: 'Under Review', description: 'Awaiting Lead/QA sign-off', accentColor: 'var(--status-deployed)' },
    { status: 'DONE', title: 'Completed', description: 'Approved & closed', accentColor: 'var(--status-done)' }
  ];

  readonly dropListIds: string[] = ['list-TODO', 'list-IN_PROGRESS', 'list-DEPLOYED', 'list-DONE'];
  readonly hoveredTaskId = signal<string | null>(null);

  // Dynamic Weekly Gantt Window based on visible tasks + Today
  readonly ganttWindow = computed(() => {
    const tasks = this.store.filteredTasks();
    const today = todayIsoDate();

    let minIso = today;
    let maxIso = addCalendarDays(today, 21);

    for (const t of tasks) {
      if (t.startDate && t.startDate < minIso) minIso = t.startDate;
      if (t.dueDate && t.dueDate > maxIso) maxIso = t.dueDate;
    }

    // Snap minIso back by 2 days for clean left padding and build 7-day weekly columns (min 4 weeks)
    const startAnchor = addCalendarDays(minIso, -2);
    const rawSpanDays = Math.max(28, diffCalendarDays(startAnchor, maxIso) + 5);
    const numWeeks = Math.min(12, Math.max(4, Math.ceil(rawSpanDays / 7)));
    const totalDays = numWeeks * 7;

    const weeks: GanttWeekColumn[] = [];
    for (let i = 0; i < numWeeks; i++) {
      const wStart = addCalendarDays(startAnchor, i * 7);
      const wEnd = addCalendarDays(wStart, 6);
      weeks.push({
        id: `wk-${i + 1}`,
        label: `Week ${i + 1} · ${formatShortDate(wStart)} – ${formatShortDate(wEnd)}`,
        startIso: wStart,
        endIso: wEnd
      });
    }

    const todayOffset = diffCalendarDays(startAnchor, today);
    const todayPct =
      todayOffset >= 0 && todayOffset <= totalDays
        ? Number(((todayOffset / totalDays) * 100).toFixed(2))
        : null;

    return {
      startIso: startAnchor,
      totalDays,
      weeks,
      todayPct
    };
  });

  switchView(view: MethodologyView): void {
    this.store.currentView.set(view);
  }

  toggleDueSoonFilter(): void {
    this.store.filterDueSoon.update(v => !v);
  }

  toggleBlockedFilter(): void {
    this.store.filterBlockedOnly.update(v => !v);
  }

  hasActiveFilters(): boolean {
    return (
      this.store.filterDueSoon() ||
      this.store.filterBlockedOnly() ||
      this.store.filterPriority() !== 'ALL' ||
      !!this.store.searchQuery().trim()
    );
  }

  clearAllFilters(): void {
    this.store.filterDueSoon.set(false);
    this.store.filterBlockedOnly.set(false);
    this.store.filterDeployedOnly.set(false);
    this.store.filterPriority.set('ALL');
    this.store.searchQuery.set('');
  }

  getProject(projectId: string): Project | undefined {
    return this.store.projectMap().get(projectId);
  }

  getCompletedSubtasks(task: Task): number {
    return (task.subtasks || []).filter((st: Subtask) => st.completed).length;
  }

  getTaskAssigneesSummary(task: Task): string {
    const members = this.store.getTaskMembers(task);
    if (members.length === 0) return 'Unassigned';
    if (members.length === 1) return members[0].name.split(' ')[0];
    return `${members[0].name.split(' ')[0]} +${members.length - 1}`;
  }

  getTaskAssigneesFullNames(task: Task): string {
    const members = this.store.getTaskMembers(task);
    return members.length > 0 ? members.map(m => `${m.name} (${m.role})`).join(', ') : 'Unassigned';
  }

  formatDateShort(iso: string): string {
    return formatShortDate(iso);
  }

  getDueLabel(task: Task): string {
    if (!task.dueDate) return 'No Date';
    if (task.status === 'DONE') return formatShortDate(task.dueDate);
    const days = this.store.getDaysUntilDue(task);
    if (days < 0) return `Overdue ${Math.abs(days)}d`;
    if (days === 0) return 'Due Today';
    if (days <= 3) return `Due in ${days}d`;
    return formatShortDate(task.dueDate);
  }

  openTask(taskId: string): void {
    this.store.selectTask(taskId);
  }

  onTaskDrop(event: CdkDragDrop<Task[], Task[], Task>): void {
    if (!this.store.canEditTasks()) return;
    const draggedTask = event.item.data as Task;
    if (!this.store.canEditTask(draggedTask)) return;

    if (event.previousContainer === event.container) {
      const status = event.container.id.replace('list-', '') as TaskStatus;
      this.store.reorderTasksInColumn(status, event.previousIndex, event.currentIndex);
    } else {
      const targetStatus = event.container.id.replace('list-', '') as TaskStatus;
      if (targetStatus === 'DONE' && !this.store.canSignOffDone()) {
        return;
      }
      this.store.updateTaskStatus(draggedTask.id, targetStatus);
    }
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

  getGanttStatusKey(task: Task): 'todo' | 'inprogress' | 'review' | 'completed' | 'blocked' {
    if (task.blocked) return 'blocked';
    if (task.status === 'DONE') return 'completed';
    if (task.status === 'DEPLOYED') return 'review';
    if (task.status === 'IN_PROGRESS') return 'inprogress';
    return 'todo';
  }

  getScheduleVarianceDays(task: Task): number {
    const baseline = task.baselineDueDate || task.dueDate;
    return Math.max(0, diffCalendarDays(baseline, task.dueDate));
  }

  getGanttBarLeftPercent(task: Task): number {
    const win = this.ganttWindow();
    const offsetDays = Math.max(0, diffCalendarDays(win.startIso, task.startDate));
    const pct = (offsetDays / win.totalDays) * 100;
    return Math.max(0.5, Math.min(84, Number(pct.toFixed(2))));
  }

  getGanttBarWidthPercent(task: Task): number {
    const win = this.ganttWindow();
    const spanDays = Math.max(1.5, diffCalendarDays(task.startDate, task.dueDate) + 1);
    const widthPct = (spanDays / win.totalDays) * 100;
    const leftPct = this.getGanttBarLeftPercent(task);
    return Math.max(13, Math.min(99 - leftPct, Number(widthPct.toFixed(2))));
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
          const x1 = (this.getGanttBarLeftPercent(upstream) + this.getGanttBarWidthPercent(upstream)) * 10;
          const y1 = upIdx * 88 + 44;
          const x2 = this.getGanttBarLeftPercent(downstream) * 10;
          const y2 = downIdx * 88 + 44;

          const dx = Math.max(25, Math.abs(x2 - x1) * 0.4);
          const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
          const isConflict = upstream.dueDate >= downstream.startDate || downstream.blocked;

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
