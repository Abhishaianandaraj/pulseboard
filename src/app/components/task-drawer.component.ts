import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskStoreService, diffCalendarDays } from '../services/task-store.service';
import { Task, TaskStatus, ReviewVerdict, SlipReason } from '../models/task.model';

@Component({
  selector: 'app-task-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (store.selectedTask(); as task) {
      <div class="drawer-backdrop" (click)="close()">
        <aside class="drawer-panel" (click)="$event.stopPropagation()">
          <!-- Role Gating Viewer Notice -->
          @if (store.isViewer()) {
            <div class="viewer-notice-strip">
              <i class="ph-light ph-lock-key"></i>
              <span><strong>Read-Only Session:</strong> Switch personas in the top bar to edit tasks or approve reviews.</span>
            </div>
          } @else if (isReadOnly(task)) {
            <div class="ownership-lock-badge">
              <i class="ph-light ph-lock-key"></i>
              <span><strong>Read-Only · Teammate Task:</strong> Property edits are restricted to assigned owners and Leads/Managers. Review notes remain open.</span>
            </div>
          }

          <!-- Drawer Header -->
          <div class="drawer-header">
            <div class="header-left">
              <span class="task-id-badge font-mono">{{ task.id }}</span>
              <span class="project-code-tag font-mono">{{ getProjectCode(task.projectId) }}</span>
              <span class="priority-pill" [attr.data-priority]="task.priority">{{ task.priority }}</span>
              @if (task.blocked) {
                <span class="blocked-badge">
                  <i class="ph-light ph-warning"></i> Blocked
                </span>
              }
              @if (task.status === 'DEPLOYED') {
                <span class="server-badge">
                  <i class="ph-light ph-clipboard-text"></i> Under Review
                </span>
              }
              @if (store.isTaskDueSoon(task)) {
                <span class="due-soon-badge" [class.overdue]="store.isTaskOverdue(task)">
                  <i class="ph-light ph-calendar-blank"></i>
                  {{ store.isTaskOverdue(task) ? 'Overdue' : 'Due Soon' }}
                </span>
              }
              @if (task.reworkCount > 0) {
                <span class="rework-badge" title="Rework recovery overhead active">
                  <i class="ph-light ph-arrows-counter-clockwise"></i> {{ task.reworkCount }} Rework (+{{ task.reworkCount * 3 }} pts)
                </span>
              }
            </div>
            <button type="button" class="btn-close" (click)="close()" title="Close Drawer">
              <i class="ph-light ph-x"></i>
            </button>
          </div>

          <!-- Drawer Content Body -->
          <div class="drawer-body custom-scroll">
            <!-- Title Input -->
            <div class="field-group">
              <label class="field-label">Task Title</label>
              <input
                type="text"
                class="input-title"
                [disabled]="isReadOnly(task)"
                [ngModel]="task.title"
                (ngModelChange)="updateField('title', $event)"
                placeholder="Deliverable summary..."
              />
            </div>

            <!-- Workflow Status Stepper Bar -->
            <div class="field-group">
              <label class="field-label">Workflow Status</label>
              <div class="status-grid">
                <button
                  type="button"
                  class="status-btn"
                  [disabled]="isReadOnly(task)"
                  [class.active]="task.status === 'TODO'"
                  (click)="setStatus('TODO')"
                >
                  Yet to Start
                </button>
                <button
                  type="button"
                  class="status-btn"
                  [disabled]="isReadOnly(task)"
                  [class.active]="task.status === 'IN_PROGRESS'"
                  (click)="setStatus('IN_PROGRESS')"
                >
                  In Progress
                </button>
                <button
                  type="button"
                  class="status-btn btn-deployed"
                  [disabled]="isReadOnly(task)"
                  [class.active]="task.status === 'DEPLOYED'"
                  (click)="setStatus('DEPLOYED')"
                >
                  Under Review
                </button>
                <button
                  type="button"
                  class="status-btn btn-done"
                  [disabled]="isReadOnly(task) || (!store.canSignOffDone() && task.status !== 'DONE')"
                  [class.active]="task.status === 'DONE'"
                  (click)="setStatus('DONE')"
                  [title]="!store.canSignOffDone() ? 'Requires Lead or Manager sign-off' : 'Mark task as Completed'"
                >
                  <i class="ph-light ph-check"></i>
                  <span>Completed {{ !store.canSignOffDone() ? '(Lead)' : '' }}</span>
                </button>
              </div>
            </div>

            <!-- Completion Progress Bar & Slider (0% - 100%) -->
            <div class="progress-control-card">
              <div class="progress-head-row">
                <div class="progress-label-wrap">
                  <label class="field-label">Completion Progress</label>
                  <span class="progress-sub-hint">
                    @if (task.subtasks.length > 0) {
                      Auto-calculated from checklist ({{ getCompletedCount(task) }}/{{ task.subtasks.length }}) · Manual override enabled
                    } @else {
                      Adjust slider or add checklist items below
                    }
                  </span>
                </div>
                <div class="progress-num-input-wrap">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    class="progress-num-input font-mono"
                    [disabled]="isReadOnly(task)"
                    [ngModel]="task.progress"
                    (ngModelChange)="onProgressChange(task.id, $event)"
                  />
                  <span class="pct-unit font-mono">%</span>
                </div>
              </div>
              <div class="progress-bar-visual">
                <div class="progress-bar-fill" [style.width.%]="task.progress" [class.fill-done]="task.progress === 100"></div>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                class="progress-range-input"
                [disabled]="isReadOnly(task)"
                [ngModel]="task.progress"
                (ngModelChange)="onProgressChange(task.id, $event)"
              />
            </div>

            <!-- Assignee Capacity Advisory Banner (FR-04) -->
            @for (m of store.getTaskMembers(task); track m.id) {
              @if (store.getMemberLoadMetric(m.id).status === 'OVER_BUDGET') {
                <div class="capacity-advisory-box">
                  <div class="advisory-icon">
                    <i class="ph-light ph-warning"></i>
                  </div>
                  <div class="advisory-text">
                    <strong>Workload Advisory:</strong>
                    {{ m.name }} is above sprint capacity
                    ({{ store.getMemberLoadMetric(m.id).effectiveLoad }}/{{ m.capacityBudget }} pts)
                    including {{ store.getMemberLoadMetric(m.id).reworkCount * 3 }} rework points.
                  </div>
                </div>
              }
            }

            <!-- Metadata & Schedule Grid -->
            <div class="meta-grid">
              <div class="field-group">
                <label class="field-label">Project Workspace</label>
                <select
                  class="select-input"
                  [disabled]="isReadOnly(task)"
                  [ngModel]="task.projectId"
                  (ngModelChange)="updateField('projectId', $event)"
                >
                  @for (proj of store.projects(); track proj.id) {
                    <option [value]="proj.id">[{{ proj.code }}] {{ proj.name }}</option>
                  }
                </select>
              </div>

              <div class="field-group">
                <label class="field-label">Priority</label>
                <select
                  class="select-input"
                  [disabled]="isReadOnly(task)"
                  [ngModel]="task.priority"
                  (ngModelChange)="updateField('priority', $event)"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div class="field-group full-width-span">
                <label class="field-label">Assigned Owners (Effort Points Split Equally)</label>
                <div class="assignee-picker-box">
                  <!-- Selected Member Chips -->
                  <div class="selected-assignees-wrap">
                    @for (m of store.getTaskMembers(task); track m.id) {
                      <span class="assignee-chip" [style.border-color]="m.color">
                        <span class="chip-avatar" [style.background-color]="m.color">{{ m.avatar }}</span>
                        <span class="chip-name">{{ m.name }}</span>
                        <span class="chip-role">({{ m.role }})</span>
                        <span class="capacity-dot" [attr.data-status]="store.getMemberLoadMetric(m.id).status" [title]="store.getMemberLoadMetric(m.id).label + ' (' + store.getMemberLoadMetric(m.id).effectiveLoad + '/' + m.capacityBudget + ' pts)'"></span>
                        @if (!isReadOnly(task)) {
                          <button type="button" class="btn-remove-assignee" (click)="removeAssignee(task, m.id)" title="Remove assignee">
                            <i class="ph-light ph-x"></i>
                          </button>
                        }
                      </span>
                    } @empty {
                      <span class="unassigned-hint">Unassigned — select one or more owners below.</span>
                    }
                  </div>

                  <!-- Member Selection Pool -->
                  @if (!isReadOnly(task)) {
                    <div class="assignee-select-pool">
                      <span class="pool-label">Toggle team owners:</span>
                      <div class="pool-chips">
                        @for (member of store.teamMembers(); track member.id) {
                          <button
                            type="button"
                            class="pool-chip-btn"
                            [class.selected]="isTaskAssignee(task, member.id)"
                            (click)="toggleTaskAssignee(task, member.id)"
                          >
                            <span class="chip-avatar-sm" [style.background-color]="member.color">{{ member.avatar }}</span>
                            <span>{{ member.name }}</span>
                            <span class="capacity-mini-dot" [attr.data-status]="store.getMemberLoadMetric(member.id).status"></span>
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>

              <div class="field-group">
                <label class="field-label">Phase</label>
                <input
                  type="text"
                  class="text-input"
                  [disabled]="isReadOnly(task)"
                  [ngModel]="task.phase"
                  (ngModelChange)="updateField('phase', $event)"
                />
              </div>

              <div class="field-group">
                <label class="field-label">Sprint</label>
                <input
                  type="text"
                  class="text-input"
                  [disabled]="isReadOnly(task)"
                  [ngModel]="task.sprint"
                  (ngModelChange)="updateField('sprint', $event)"
                />
              </div>

              <div class="field-group">
                <label class="field-label">Effort Points <span class="label-muted">(Independent of Dates)</span></label>
                <input
                  type="number"
                  min="1"
                  max="21"
                  class="text-input font-mono"
                  [disabled]="isReadOnly(task)"
                  [ngModel]="task.effortPoints"
                  (ngModelChange)="updateField('effortPoints', +$event)"
                />
              </div>

              <div class="field-group">
                <label class="field-label">Calendar Span</label>
                <div class="duration-readonly-box font-mono">
                  <i class="ph-light ph-calendar-blank"></i>
                  <span>{{ getDurationDays(task) }} {{ getDurationDays(task) === 1 ? 'day' : 'days' }}</span>
                </div>
              </div>

              <div class="field-group">
                <label class="field-label">Start Date</label>
                <input
                  type="date"
                  class="text-input font-mono"
                  [disabled]="isReadOnly(task) || (task.dependencies && task.dependencies.length > 0)"
                  [ngModel]="task.startDate"
                  (ngModelChange)="onStartDateChange(task, $event)"
                  [title]="(task.dependencies && task.dependencies.length > 0) ? 'Automatically calculated from upstream prerequisites' : 'Task start date'"
                />
              </div>

              <div class="field-group">
                <label class="field-label">Due Date</label>
                <input
                  type="date"
                  class="text-input font-mono"
                  [disabled]="isReadOnly(task)"
                  [min]="task.startDate"
                  [ngModel]="task.dueDate"
                  (ngModelChange)="onDueDateChange(task, $event)"
                />
              </div>

              <div class="field-group full-width-span">
                <label class="field-label">Baseline Due Date (Committed Target)</label>
                <input
                  type="date"
                  class="text-input font-mono"
                  [disabled]="isReadOnly(task)"
                  [ngModel]="task.baselineDueDate || task.dueDate"
                  (ngModelChange)="updateField('baselineDueDate', $event)"
                />
              </div>

              @if (getScheduleHelperText(task); as depHelper) {
                <div class="dep-schedule-helper full-width-span">
                  <i class="ph-light ph-git-commit"></i>
                  <span><strong>Dependency-Driven Start:</strong> {{ depHelper }}</span>
                </div>
              }
            </div>

            <!-- Schedule & Variance Tracking (FR-05) -->
            @if (isScheduleDrifted(task)) {
              <div class="grace-buffer-panel">
                <div class="drift-header">
                  <div class="drift-title-wrap">
                    <span class="drift-icon">
                      <i class="ph-light ph-timer"></i>
                    </span>
                    <div>
                      <h4 class="drift-title">Schedule Slipped (+{{ getDaysDrift(task) }} Days)</h4>
                      <p class="drift-sub">Baseline: {{ task.baselineDueDate || task.dueDate }} → Current Due: {{ task.dueDate }}</p>
                    </div>
                  </div>
                  <span class="grace-pill">Variance Logged</span>
                </div>

                <div class="slip-reason-section">
                  <label class="field-label">Select Slippage Reason:</label>
                  <div class="slip-reasons-grid">
                    <button
                      type="button"
                      class="slip-reason-btn"
                      [class.active]="task.slipReason === 'DEPENDENCY_BLOCKED'"
                      [disabled]="store.isViewer()"
                      (click)="setSlipReason(task, 'DEPENDENCY_BLOCKED')"
                    >
                      <i class="ph-light ph-link"></i> Dependency Blocked
                    </button>
                    <button
                      type="button"
                      class="slip-reason-btn"
                      [class.active]="task.slipReason === 'SCOPE_EXPANDED'"
                      [disabled]="store.isViewer()"
                      (click)="setSlipReason(task, 'SCOPE_EXPANDED')"
                    >
                      <i class="ph-light ph-arrows-out"></i> Scope Expanded
                    </button>
                    <button
                      type="button"
                      class="slip-reason-btn"
                      [class.active]="task.slipReason === 'PRODUCTION_HOTFIX'"
                      [disabled]="store.isViewer()"
                      (click)="setSlipReason(task, 'PRODUCTION_HOTFIX')"
                    >
                      <i class="ph-light ph-fire"></i> Production Hotfix
                    </button>
                    <button
                      type="button"
                      class="slip-reason-btn"
                      [class.active]="task.slipReason === 'UNDERESTIMATED'"
                      [disabled]="store.isViewer()"
                      (click)="setSlipReason(task, 'UNDERESTIMATED')"
                    >
                      <i class="ph-light ph-timer"></i> Underestimated Effort
                    </button>
                  </div>

                  <div class="slip-justification-wrap">
                    <input
                      type="text"
                      class="text-input text-input-sm"
                      [disabled]="store.isViewer()"
                      [ngModel]="task.slipJustification"
                      (ngModelChange)="updateField('slipJustification', $event)"
                      placeholder="Context notes for weekly status review..."
                    />
                  </div>
                </div>
              </div>
            }

            <!-- Verification URL -->
            <div class="field-group">
              <label class="field-label">Staging / Review Verification URL</label>
              <div class="url-input-wrap">
                <input
                  type="url"
                  class="text-input"
                  [disabled]="store.isViewer()"
                  [ngModel]="task.deployedUrl"
                  (ngModelChange)="updateField('deployedUrl', $event)"
                  placeholder="https://staging.tcs-ai.internal/v1/health"
                />
                @if (task.deployedUrl) {
                  <a
                    [href]="task.deployedUrl"
                    target="_blank"
                    rel="noopener"
                    class="btn-test-link"
                    title="Open verification link in new tab"
                  >
                    <span>Open Link</span>
                    <i class="ph-light ph-arrow-square-out"></i>
                  </a>
                }
              </div>
            </div>

            <!-- Description -->
            <div class="field-group">
              <label class="field-label">Description &amp; Acceptance Criteria</label>
              <textarea
                class="textarea-input"
                rows="3"
                [disabled]="store.isViewer()"
                [ngModel]="task.description"
                (ngModelChange)="updateField('description', $event)"
                placeholder="Scope details, technical notes, and acceptance criteria..."
              ></textarea>
            </div>

            <!-- Blocker Control Box -->
            <div class="blocker-card" [class.is-blocked]="task.blocked">
              <div class="blocker-row">
                <div>
                  <h4 class="blocker-heading">
                    <i class="ph-light" [ngClass]="task.blocked ? 'ph-warning' : 'ph-check-circle'"></i>
                    <span>{{ task.blocked ? 'Task is Blocked' : 'On Track · No Active Blockers' }}</span>
                  </h4>
                  <p class="blocker-sub">
                    {{ task.blocked ? 'Flagged for immediate attention in Gantt Chart & Weekly Follow-Up.' : 'Flag blockers early so Leads can unblock dependencies.' }}
                  </p>
                </div>
                <button
                  type="button"
                  class="btn-blocker-toggle"
                  [disabled]="store.isViewer()"
                  [class.btn-clear]="task.blocked"
                  (click)="toggleBlocker(task)"
                >
                  {{ task.blocked ? 'Clear Blocker' : 'Flag Blocker' }}
                </button>
              </div>

              @if (task.blocked) {
                <div class="blocker-input-wrap">
                  <input
                    type="text"
                    class="text-input text-input-sm"
                    [disabled]="store.isViewer()"
                    [ngModel]="task.blockerReason"
                    (ngModelChange)="updateField('blockerReason', $event)"
                    placeholder="Describe blocker reason (e.g., waiting for API credentials)..."
                  />
                </div>
              }
            </div>

            <!-- Prerequisites & Dependencies (Multi-Predecessor Auto-Scheduling) -->
            <div class="dependencies-section">
              <div class="section-title-row">
                <div class="dep-title-wrap">
                  <span class="dep-icon">
                    <i class="ph-light ph-link"></i>
                  </span>
                  <div>
                    <h4 class="section-title">Upstream Prerequisites (Dependencies)</h4>
                    <p class="section-sub">Start date automatically schedules to 1 day after all prerequisites finish</p>
                  </div>
                </div>
                <span class="dep-count-badge font-mono">{{ (task.dependencies || []).length }} Linked</span>
              </div>

              <!-- List of linked dependencies -->
              <div class="dep-list">
                @for (depId of task.dependencies; track depId) {
                  <div class="dep-item">
                    <span class="dep-id font-mono">{{ depId }}</span>
                    <span class="dep-task-title" [title]="getTaskTitle(depId)">{{ getTaskTitle(depId) }}</span>
                    <span class="dep-due font-mono">Due {{ getTaskDueDate(depId) }}</span>
                    <span class="dep-status" [attr.data-status]="getTaskStatus(depId)">{{ store.getStatusLabel(getTaskStatus(depId)) }}</span>
                    @if (!store.isViewer() && !isReadOnly(task)) {
                      <button
                        type="button"
                        class="btn-del-dep"
                        (click)="store.removeDependency(task.id, depId)"
                        title="Unlink prerequisite"
                      >
                        <i class="ph-light ph-x"></i>
                      </button>
                    }
                  </div>
                } @empty {
                  <div class="empty-deps">
                    <span>No prerequisite tasks linked. Start date can be set freely.</span>
                  </div>
                }
              </div>

              <!-- Add dependency row -->
              @if (!store.isViewer() && !isReadOnly(task)) {
                <div class="add-dep-row">
                  <select class="select-input select-sm" [(ngModel)]="selectedUpstreamId">
                    <option value="">+ Select prerequisite task...</option>
                    @for (candidate of getAvailableUpstreamCandidates(task); track candidate.id) {
                      <option [value]="candidate.id">
                        [{{ candidate.id }}] {{ candidate.title }} (Due: {{ candidate.dueDate }})
                      </option>
                    }
                  </select>
                  <button
                    type="button"
                    class="btn-add-dep"
                    [disabled]="!selectedUpstreamId"
                    (click)="linkDependency(task.id)"
                  >
                    Link Task
                  </button>
                </div>
              }

              @if (dependencyError) {
                <div class="dep-error-alert">
                  <i class="ph-light ph-warning"></i>
                  <span>{{ dependencyError }}</span>
                </div>
              }
            </div>

            <!-- Interactive Subtask Checklist Builder -->
            <div class="subtasks-section">
              <div class="section-title-row">
                <h4 class="section-title">
                  Subtask Checklist ({{ getCompletedCount(task) }}/{{ task.subtasks.length || 0 }})
                </h4>
                <span class="subtask-pct-badge font-mono">{{ task.progress }}% Complete</span>
              </div>

              <div class="subtasks-list">
                @for (st of task.subtasks; track st.id) {
                  <div class="subtask-row" [class.completed]="st.completed">
                    <label class="subtask-label">
                      <input
                        type="checkbox"
                        class="checkbox-custom"
                        [disabled]="store.isViewer() || isReadOnly(task)"
                        [checked]="st.completed"
                        (change)="store.toggleSubtask(task.id, st.id)"
                      />
                      <span class="subtask-text">{{ st.title }}</span>
                    </label>
                    @if (!store.isViewer() && !isReadOnly(task)) {
                      <button
                        type="button"
                        class="btn-del-subtask"
                        (click)="store.deleteSubtask(task.id, st.id)"
                        title="Remove checklist item"
                      >
                        <i class="ph-light ph-trash"></i>
                      </button>
                    }
                  </div>
                } @empty {
                  <div class="empty-subtasks">
                    <span>No checklist items yet. Type an item below and press Enter or click + Add.</span>
                  </div>
                }
              </div>

              @if (!store.isViewer() && !isReadOnly(task)) {
                <div class="add-subtask-row">
                  <input
                    type="text"
                    class="text-input text-input-sm"
                    [(ngModel)]="newSubtaskTitle"
                    (keydown.enter)="$event.preventDefault(); addSubtask(task.id)"
                    placeholder="Type checklist step and press Enter..."
                  />
                  <button
                    type="button"
                    class="btn-add-sub"
                    [disabled]="!newSubtaskTitle.trim()"
                    (click)="addSubtask(task.id)"
                  >
                    + Add
                  </button>
                </div>
              }
            </div>

            <!-- Review & Sign-Off Section -->
            <div class="review-section">
              <div class="review-header">
                <div class="review-title-wrap">
                  <span class="review-icon">
                    <i class="ph-light ph-shield-check"></i>
                  </span>
                  <div>
                    <h4 class="section-title">Lead / QA Review &amp; Sign-Off</h4>
                    <p class="section-sub">Verification notes and approval history before marking Completed</p>
                  </div>
                </div>

                @if (store.canSignOffDone() && task.status === 'DEPLOYED') {
                  <button
                    type="button"
                    class="btn-fast-approve"
                    (click)="quickApproveAndClose(task)"
                    title="1-Click Lead Approval"
                  >
                    <i class="ph-light ph-check"></i>
                    <span>Approve &amp; Complete</span>
                  </button>
                }
              </div>

              <!-- Existing Review Feed -->
              <div class="review-feed">
                @for (note of task.reviewNotes; track note.id) {
                  <div class="review-card" [class.approved]="note.verdict === 'APPROVED'" [class.needs-changes]="note.verdict === 'NEEDS_CHANGES'">
                    <div class="review-card-meta">
                      <div class="review-author">
                        <span class="author-avatar">{{ note.authorAvatar }}</span>
                        <strong class="author-name">{{ note.author }}</strong>
                        <span class="note-time font-mono">{{ note.timestamp }}</span>
                      </div>
                      <span class="verdict-tag" [attr.data-verdict]="note.verdict">
                        {{ note.verdict }}
                      </span>
                    </div>
                    <p class="note-body">{{ note.content }}</p>
                  </div>
                } @empty {
                  <div class="empty-reviews">
                    <span>No review notes recorded yet.</span>
                  </div>
                }
              </div>

              <!-- New Review Post Form -->
              @if (!store.isViewer()) {
                <div class="post-review-box">
                  <textarea
                    class="textarea-input"
                    rows="2"
                    [(ngModel)]="newReviewContent"
                    placeholder="Add review feedback, test verification results, or sign-off notes..."
                  ></textarea>

                  <div class="post-review-controls">
                    <div class="verdict-select">
                      <span class="field-label">Verdict:</span>
                      <select class="select-input select-sm" [(ngModel)]="newReviewVerdict">
                        @if (store.canApproveReview()) {
                          <option value="APPROVED">Approved (Marks Completed)</option>
                        }
                        <option value="OBSERVATION">Observation / Note</option>
                        <option value="NEEDS_CHANGES">Needs Changes (+3pt Rework)</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      class="btn-post-review"
                      [disabled]="!newReviewContent.trim()"
                      (click)="submitReview(task.id)"
                    >
                      Post Review
                    </button>
                  </div>

                  @if (!store.canApproveReview()) {
                    <p class="rbac-hint-text">
                      Active as <strong>{{ store.currentUser().name }} [{{ store.currentUserRole() }}]</strong>. Only Lead or Manager roles can approve and close tasks.
                    </p>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Drawer Footer -->
          <div class="drawer-footer">
            @if (!store.isViewer() && !isReadOnly(task)) {
              <button type="button" class="btn-delete-task" (click)="deleteTask(task.id)">
                <i class="ph-light ph-trash"></i>
                <span>Delete Task</span>
              </button>
            } @else {
              <span></span>
            }
            <button type="button" class="btn-close-drawer" (click)="close()">
              Close
            </button>
          </div>
        </aside>
      </div>
    }
  `,
  styles: [`
    .drawer-backdrop {
      position: fixed;
      inset: 0;
      background: var(--surface-overlay);
      backdrop-filter: blur(4px);
      z-index: 90;
      display: flex;
      justify-content: flex-end;
      animation: fadeIn 0.16s ease-out;
    }
    .drawer-panel {
      width: 650px;
      max-width: 94vw;
      height: 100vh;
      max-height: 100vh;
      overflow: hidden;
      background: var(--bg-surface);
      border-left: 1px solid var(--border-hairline);
      box-shadow: var(--shadow-drawer);
      display: flex;
      flex-direction: column;
      animation: slideIn 0.2s var(--ease-tactile);
    }
    @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .viewer-notice-strip {
      background: var(--accent-warn-tint);
      border-bottom: 1px solid var(--border-subtle);
      color: var(--accent-warn);
      padding: 9px 20px;
      font-size: 11.5px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .ownership-lock-badge {
      background: var(--bg-subtle);
      border-bottom: 1px solid var(--border-hairline);
      color: var(--text-secondary);
      padding: 9px 20px;
      font-size: 11.5px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .drawer-header {
      padding: 16px 24px;
      border-bottom: 1px solid var(--border-hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-shrink: 0;
      background: var(--bg-surface);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .task-id-badge {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      padding: 2px 8px;
      border-radius: var(--radius-pill);
    }

    .project-code-tag {
      font-size: 11px;
      font-weight: 700;
      color: var(--accent-primary);
      background: var(--accent-primary-tint);
      border: 1px solid var(--border-subtle);
      padding: 2px 8px;
      border-radius: var(--radius-pill);
    }

    .priority-pill {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      color: var(--text-secondary);
    }

    .priority-pill[data-priority="CRITICAL"] {
      background: var(--badge-critical-bg);
      color: var(--badge-critical-text);
    }
    .priority-pill[data-priority="HIGH"] {
      background: var(--badge-high-bg);
      color: var(--badge-high-text);
    }

    .blocked-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: var(--status-blocked-bg);
      color: var(--status-blocked-text);
    }

    .server-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: var(--status-deployed-bg);
      color: var(--status-deployed-text);
    }

    .due-soon-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: var(--accent-warn-tint);
      color: var(--accent-warn);
    }

    .due-soon-badge.overdue {
      background: var(--status-blocked-bg);
      color: var(--status-blocked-text);
    }

    .rework-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: var(--accent-warn-tint);
      color: var(--accent-warn);
    }

    .btn-close {
      background: transparent;
      border: none;
      font-size: 18px;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      transition: var(--transition-tactile);
    }
    .btn-close:hover { color: var(--text-primary); }

    .drawer-body {
      flex: 1;
      min-height: 0;
      padding: 20px 24px 36px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .field-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .field-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .label-muted {
      font-weight: 500;
      text-transform: none;
      letter-spacing: 0;
      color: var(--text-muted);
    }

    .input-title {
      font-size: 16px;
      font-weight: 700;
      padding: 9px 12px;
      border-radius: var(--radius-inner);
      border: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      color: var(--text-primary);
      outline: none;
      transition: var(--transition-tactile);
    }

    .input-title:focus {
      background: var(--bg-surface);
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 2px var(--accent-primary-tint);
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
    }

    .status-btn {
      padding: 7px 8px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      color: var(--text-secondary);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: var(--transition-tactile);
    }

    .status-btn:hover:not(:disabled) {
      background: var(--bg-surface);
      color: var(--text-primary);
    }

    .status-btn.active {
      background: var(--accent-primary-tint);
      color: var(--accent-primary);
      border-color: var(--accent-primary);
    }

    .status-btn.btn-deployed.active {
      background: var(--status-deployed-bg);
      color: var(--status-deployed-text);
      border-color: var(--status-deployed);
    }

    .status-btn.btn-done.active {
      background: var(--status-done-bg);
      color: var(--status-done-text);
      border-color: var(--status-done);
    }

    .status-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    /* Completion Progress Card */
    .progress-control-card {
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-inner);
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .progress-head-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .progress-label-wrap {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .progress-sub-hint {
      font-size: 11px;
      color: var(--text-muted);
    }

    .progress-num-input-wrap {
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-inner);
      padding: 3px 8px;
    }

    .progress-num-input {
      width: 44px;
      border: none;
      background: transparent;
      color: var(--text-primary);
      font-size: 12.5px;
      font-weight: 700;
      text-align: right;
      outline: none;
    }

    .pct-unit {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--text-muted);
    }

    .progress-bar-visual {
      height: 8px;
      border-radius: 999px;
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      overflow: hidden;
    }

    .progress-bar-fill {
      height: 100%;
      background: var(--accent-primary);
      border-radius: 999px;
      transition: width 0.2s ease;
    }

    .progress-bar-fill.fill-done {
      background: var(--status-done);
    }

    .progress-range-input {
      width: 100%;
      accent-color: var(--accent-primary);
      cursor: pointer;
      margin: 0;
    }

    .capacity-advisory-box {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: var(--accent-warn-tint);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-inner);
      padding: 10px 14px;
      color: var(--accent-warn);
      font-size: 12px;
    }

    .advisory-icon {
      font-size: 16px;
      display: flex;
      align-items: center;
      margin-top: 1px;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .full-width-span {
      grid-column: 1 / -1;
    }

    .assignee-picker-box {
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-inner);
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .selected-assignees-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }

    .unassigned-hint {
      font-size: 11.5px;
      color: var(--text-muted);
    }

    .assignee-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-pill);
      font-size: 11.5px;
    }

    .chip-avatar {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      color: #fff;
      font-size: 9px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .chip-name { font-weight: 600; color: var(--text-primary); }
    .chip-role { font-size: 10.5px; color: var(--text-muted); }

    .capacity-dot, .capacity-mini-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .capacity-dot[data-status="OPTIMAL"], .capacity-mini-dot[data-status="OPTIMAL"] { background: var(--status-done); }
    .capacity-dot[data-status="NEAR_CAPACITY"], .capacity-mini-dot[data-status="NEAR_CAPACITY"] { background: var(--accent-warn); }
    .capacity-dot[data-status="OVER_BUDGET"], .capacity-mini-dot[data-status="OVER_BUDGET"] { background: var(--accent-danger); }

    .btn-remove-assignee {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 1px;
    }
    .btn-remove-assignee:hover { color: var(--accent-danger); }

    .assignee-select-pool {
      border-top: 1px solid var(--border-hairline);
      padding-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .pool-label {
      font-size: 10.5px;
      color: var(--text-muted);
      font-weight: 600;
    }

    .pool-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .pool-chip-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 9px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-hairline);
      background: var(--bg-surface);
      color: var(--text-secondary);
      font-size: 11px;
      cursor: pointer;
      transition: var(--transition-tactile);
    }

    .pool-chip-btn.selected {
      background: var(--accent-primary-tint);
      border-color: var(--accent-primary);
      color: var(--accent-primary);
      font-weight: 600;
    }

    .chip-avatar-sm {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      color: #fff;
      font-size: 8px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .text-input, .select-input, .textarea-input {
      width: 100%;
      padding: 7px 11px;
      border-radius: var(--radius-inner);
      border: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      color: var(--text-primary);
      font-size: 12.5px;
      outline: none;
      transition: var(--transition-tactile);
    }

    .text-input:focus, .select-input:focus, .textarea-input:focus {
      background: var(--bg-surface);
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 2px var(--accent-primary-tint);
    }

    .text-input:disabled, .select-input:disabled, .textarea-input:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }

    .duration-readonly-box {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 11px;
      border-radius: var(--radius-inner);
      border: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 600;
    }

    .dep-schedule-helper {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--radius-inner);
      background: var(--accent-primary-tint);
      border: 1px solid var(--border-subtle);
      color: var(--accent-primary);
      font-size: 11.5px;
    }

    .grace-buffer-panel {
      background: var(--accent-warn-tint);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-inner);
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .drift-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .drift-title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .drift-icon {
      font-size: 16px;
      color: var(--accent-warn);
      display: flex;
    }

    .drift-title {
      font-size: 12.5px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .drift-sub {
      font-size: 11px;
      color: var(--text-secondary);
      margin: 2px 0 0;
    }

    .grace-pill {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: var(--bg-surface);
      color: var(--accent-warn);
    }

    .slip-reason-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .slip-reasons-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    .slip-reason-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-hairline);
      background: var(--bg-surface);
      color: var(--text-secondary);
      font-size: 11.5px;
      font-weight: 500;
      cursor: pointer;
    }

    .slip-reason-btn.active {
      border-color: var(--accent-warn);
      color: var(--accent-warn);
      font-weight: 700;
    }

    .url-input-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-test-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 7px 12px;
      border-radius: var(--radius-pill);
      background: var(--accent-primary-tint);
      color: var(--accent-primary);
      font-size: 11.5px;
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
    }

    .blocker-card {
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-inner);
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .blocker-card.is-blocked {
      background: var(--status-blocked-bg);
      border-color: var(--accent-danger);
    }

    .blocker-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .blocker-heading {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12.5px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .blocker-sub {
      font-size: 11px;
      color: var(--text-secondary);
      margin: 2px 0 0;
    }

    .btn-blocker-toggle {
      padding: 6px 12px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-hairline);
      background: var(--bg-surface);
      color: var(--accent-danger);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }

    .btn-blocker-toggle.btn-clear {
      background: var(--accent-danger);
      color: #fff;
      border-color: var(--accent-danger);
    }

    .dependencies-section, .subtasks-section, .review-section {
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-inner);
      padding: 14px;
      background: var(--bg-surface);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .section-title-row, .review-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .dep-title-wrap, .review-title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .dep-icon, .review-icon {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-inner);
      background: var(--bg-subtle);
      color: var(--accent-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
    }

    .section-title {
      font-size: 12.5px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .section-sub {
      font-size: 11px;
      color: var(--text-muted);
      margin: 1px 0 0;
    }

    .dep-count-badge, .subtask-pct-badge {
      font-size: 10.5px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      color: var(--text-secondary);
    }

    .dep-list, .subtasks-list, .review-feed {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .dep-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      border-radius: var(--radius-inner);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      font-size: 12px;
    }

    .dep-id {
      font-weight: 700;
      color: var(--accent-primary);
      font-size: 11px;
    }

    .dep-task-title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--text-primary);
      font-weight: 500;
    }

    .dep-due {
      font-size: 10.5px;
      color: var(--text-muted);
      white-space: nowrap;
    }

    .dep-status {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: var(--radius-pill);
      background: var(--bg-surface);
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .btn-del-dep, .btn-del-subtask {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 2px;
    }
    .btn-del-dep:hover, .btn-del-subtask:hover { color: var(--accent-danger); }

    .empty-deps, .empty-subtasks, .empty-reviews {
      font-size: 11.5px;
      color: var(--text-muted);
      padding: 8px 10px;
      background: var(--bg-subtle);
      border-radius: var(--radius-inner);
    }

    .add-dep-row, .add-subtask-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-add-dep, .btn-add-sub {
      padding: 6px 14px;
      border-radius: var(--radius-pill);
      background: var(--accent-primary);
      color: #fff;
      border: none;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }

    .btn-add-dep:disabled, .btn-add-sub:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .dep-error-alert {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 10px;
      border-radius: var(--radius-inner);
      background: var(--status-blocked-bg);
      color: var(--status-blocked-text);
      font-size: 11.5px;
      font-weight: 600;
    }

    .subtask-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 7px 10px;
      border-radius: var(--radius-inner);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
    }

    .subtask-row.completed .subtask-text {
      text-decoration: line-through;
      color: var(--text-muted);
    }

    .subtask-label {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      cursor: pointer;
      font-size: 12px;
      color: var(--text-primary);
    }

    .checkbox-custom {
      width: 15px;
      height: 15px;
      accent-color: var(--accent-primary);
      cursor: pointer;
    }

    .btn-fast-approve {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 12px;
      border-radius: var(--radius-pill);
      background: var(--status-done);
      color: #fff;
      border: none;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .review-card {
      padding: 10px 12px;
      border-radius: var(--radius-inner);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .review-card-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .review-author {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
    }

    .author-avatar {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--accent-primary);
      color: #fff;
      font-size: 9px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .author-name { color: var(--text-primary); }
    .note-time { font-size: 10px; color: var(--text-muted); }

    .verdict-tag {
      font-size: 9.5px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: var(--radius-pill);
      background: var(--bg-surface);
      color: var(--text-secondary);
    }
    .verdict-tag[data-verdict="APPROVED"] { color: var(--status-done); }
    .verdict-tag[data-verdict="NEEDS_CHANGES"] { color: var(--accent-danger); }

    .note-body {
      font-size: 12px;
      color: var(--text-primary);
      line-height: 1.45;
      margin: 0;
    }

    .post-review-box {
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-inner);
      padding: 12px;
    }

    .post-review-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .verdict-select {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
    }

    .select-sm, .text-input-sm {
      padding: 6px 9px;
      font-size: 12px;
      flex: 1;
    }

    .btn-post-review {
      padding: 6px 14px;
      background: var(--accent-primary);
      color: #fff;
      border: none;
      border-radius: var(--radius-pill);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-post-review:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .rbac-hint-text {
      font-size: 10.5px;
      color: var(--text-muted);
      margin: 0;
    }

    .drawer-footer {
      padding: 14px 24px;
      border-top: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .btn-delete-task {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border: none;
      background: transparent;
      color: var(--accent-danger);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-delete-task:hover { text-decoration: underline; }

    .btn-close-drawer {
      padding: 7px 16px;
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-pill);
      color: var(--text-primary);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-close-drawer:hover { background: var(--bg-subtle); }
  `]
})
export class TaskDrawerComponent {
  protected readonly store = inject(TaskStoreService);

  newSubtaskTitle = '';
  newReviewContent = '';
  newReviewVerdict: ReviewVerdict = 'OBSERVATION';

  selectedUpstreamId = '';
  dependencyError = '';

  isReadOnly(task: Task | null | undefined): boolean {
    return !this.store.canEditTask(task);
  }

  isTaskAssignee(task: Task, memberId: string): boolean {
    const assignees = (task.assigneeIds && task.assigneeIds.length > 0)
      ? task.assigneeIds
      : (task.assigneeId ? [task.assigneeId] : []);
    return assignees.includes(memberId);
  }

  toggleTaskAssignee(task: Task, memberId: string): void {
    if (this.isReadOnly(task)) return;
    const current = (task.assigneeIds && task.assigneeIds.length > 0)
      ? [...task.assigneeIds]
      : (task.assigneeId ? [task.assigneeId] : []);

    const updated = current.includes(memberId)
      ? current.filter(id => id !== memberId)
      : [...current, memberId];

    void this.store.updateTaskAssignees(task.id, updated);
  }

  removeAssignee(task: Task, memberId: string): void {
    if (this.isReadOnly(task)) return;
    const current = (task.assigneeIds && task.assigneeIds.length > 0)
      ? [...task.assigneeIds]
      : (task.assigneeId ? [task.assigneeId] : []);

    const updated = current.filter(id => id !== memberId);
    void this.store.updateTaskAssignees(task.id, updated);
  }

  close(): void {
    this.store.closeTaskDrawer();
    this.dependencyError = '';
    this.selectedUpstreamId = '';
  }

  getProjectCode(projectId: string): string {
    return this.store.projectMap().get(projectId)?.code || 'PROJ';
  }

  getTaskTitle(id: string): string {
    return this.store.tasks().find(t => t.id === id)?.title || id;
  }

  getTaskDueDate(id: string): string {
    return this.store.tasks().find(t => t.id === id)?.dueDate || '—';
  }

  getTaskStatus(id: string): TaskStatus {
    return this.store.tasks().find(t => t.id === id)?.status || 'TODO';
  }

  getDurationDays(task: Task): number {
    return Math.max(1, diffCalendarDays(task.startDate, task.dueDate));
  }

  getScheduleHelperText(task: Task): string {
    if (!task.dependencies || task.dependencies.length === 0) return '';
    return this.store.computeScheduleFromDependencies(
      task.dependencies,
      task.startDate,
      task.dueDate
    ).helperText;
  }

  onProgressChange(taskId: string, val: number): void {
    this.store.updateTaskProgress(taskId, val);
  }

  getAvailableUpstreamCandidates(currentTask: Task): Task[] {
    const currentDeps = currentTask.dependencies || [];
    return this.store.tasks().filter(
      t => t.id !== currentTask.id &&
           t.projectId === currentTask.projectId &&
           !currentDeps.includes(t.id)
    );
  }

  linkDependency(taskId: string): void {
    if (!this.selectedUpstreamId) return;
    this.dependencyError = '';
    const res = this.store.addDependency(taskId, this.selectedUpstreamId);
    if (!res.success) {
      this.dependencyError = res.error || 'Failed to link dependency.';
    } else {
      this.selectedUpstreamId = '';
    }
  }

  updateField(field: keyof Task, val: unknown): void {
    const task = this.store.selectedTask();
    if (!task) return;
    void this.store.updateTask({ ...task, [field]: val } as Task);
  }

  setStatus(status: TaskStatus): void {
    const task = this.store.selectedTask();
    if (!task) return;
    this.store.updateTaskStatus(task.id, status);
  }

  onStartDateChange(task: Task, newStart: string): void {
    if (!newStart) return;
    const nextDue = task.dueDate && task.dueDate >= newStart ? task.dueDate : newStart;
    void this.store.updateTask({
      ...task,
      startDate: newStart,
      dueDate: nextDue
    });
  }

  onDueDateChange(task: Task, newDue: string): void {
    if (!newDue) return;
    const baseline = task.baselineDueDate || task.dueDate;
    let slipReason = task.slipReason;
    if (newDue > baseline && !slipReason) {
      slipReason = 'UNDERESTIMATED';
    }
    void this.store.updateTask({
      ...task,
      dueDate: newDue,
      slipReason
    });
  }

  isScheduleDrifted(task: Task): boolean {
    const baseline = task.baselineDueDate || task.dueDate;
    return task.dueDate > baseline;
  }

  getDaysDrift(task: Task): number {
    return Math.max(0, diffCalendarDays(task.baselineDueDate || task.dueDate, task.dueDate));
  }

  setSlipReason(task: Task, reason: SlipReason): void {
    this.store.logSlippage(task.id, reason, task.dueDate, task.slipJustification);
  }

  toggleBlocker(task: Task): void {
    this.store.toggleBlocked(task.id, task.blockerReason);
  }

  getCompletedCount(task: Task): number {
    return (task.subtasks || []).filter(st => st.completed).length;
  }

  addSubtask(taskId: string): void {
    if (!this.newSubtaskTitle.trim()) return;
    this.store.addSubtask(taskId, this.newSubtaskTitle);
    this.newSubtaskTitle = '';
  }

  submitReview(taskId: string): void {
    if (!this.newReviewContent.trim()) return;
    const user = this.store.currentUser();
    this.store.addReviewNote(taskId, {
      author: `${user.name} (${user.role})`,
      authorAvatar: user.avatar,
      authorRole: user.systemRole === 'LEAD' || user.systemRole === 'ADMIN' ? 'LEAD' : 'REVIEWER',
      verdict: this.newReviewVerdict,
      content: this.newReviewContent.trim()
    });
    this.newReviewContent = '';
  }

  quickApproveAndClose(task: Task): void {
    const user = this.store.currentUser();
    this.store.addReviewNote(task.id, {
      author: `${user.name} (${user.role})`,
      authorAvatar: user.avatar,
      authorRole: 'LEAD',
      verdict: 'APPROVED',
      content: 'Verification checks passed. Approved and marked Completed.'
    });
  }

  deleteTask(taskId: string): void {
    this.store.deleteTask(taskId);
  }
}
