import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskStoreService } from '../services/task-store.service';
import { Task, TaskStatus, TaskPriority, ReviewVerdict, SlipReason } from '../models/task.model';

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
              <span><strong>Viewer Session:</strong> You have read-only permissions. Switch personas in the top bar to test DEV or LEAD controls.</span>
            </div>
          } @else if (isReadOnly(task)) {
            <div class="ownership-lock-badge">
              <i class="ph-light ph-lock-key"></i>
              <span><strong>Read-Only · Teammate Task:</strong> You are viewing a deliverable assigned to a teammate. You may inspect details and add review notes, but property modifications are locked to assignees and Tech Leads.</span>
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
                  <i class="ph-light ph-cloud-arrow-up"></i> Staged
                </span>
              }
              @if (task.reworkCount > 0) {
                <span class="rework-badge" title="Rework recovery overhead active">
                  <i class="ph-light ph-arrows-counter-clockwise"></i> {{ task.reworkCount }} Rework (+{{ task.reworkCount * 3 }} pts)
                </span>
              }
            </div>
            <button type="button" class="btn-close" (click)="close()" title="Close Drawer (Esc)">
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
                class="input-title font-serif"
                [disabled]="isReadOnly(task)"
                [ngModel]="task.title"
                (ngModelChange)="updateField('title', $event)"
                placeholder="Engineering task summary..."
              />
            </div>

            <!-- Workflow Status Stepper Bar (Pill Geometry) -->
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
                  To Do
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
                  Deployed
                </button>
                <button
                  type="button"
                  class="status-btn btn-done"
                  [disabled]="isReadOnly(task) || (!store.canSignOffDone() && task.status !== 'DONE')"
                  [class.active]="task.status === 'DONE'"
                  (click)="setStatus('DONE')"
                  [title]="!store.canSignOffDone() ? 'Requires Tech Lead or Admin sign-off' : 'Mark task as Done'"
                >
                  <i class="ph-light ph-check"></i>
                  <span>Done {{ !store.canSignOffDone() ? '(Lead)' : '' }}</span>
                </button>
              </div>
            </div>

            <!-- Assignee Capacity Advisory Banner (FR-04) -->
            @for (m of store.getTaskMembers(task); track m.id) {
              @if (store.getMemberLoadMetric(m.id).status === 'OVER_BUDGET') {
                <div class="capacity-advisory-box">
                  <div class="advisory-icon">
                    <i class="ph-light ph-warning"></i>
                  </div>
                  <div class="advisory-text">
                    <strong>Capacity Advisory:</strong>
                    {{ m.name }} is currently Over Budget
                    ({{ store.getMemberLoadMetric(m.id).effectiveLoad }}/{{ m.capacityBudget }} pts)
                    including {{ store.getMemberLoadMetric(m.id).reworkCount * 3 }} recovery penalty points.
                  </div>
                </div>
              }
            }

            <!-- Metadata Grid -->
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

              <div class="field-group full-width-span">
                <label class="field-label">Assignees & Co-Assignees (Points Split Equally)</label>
                <div class="assignee-picker-box">
                  <!-- Selected Member Chips -->
                  <div class="selected-assignees-wrap">
                    @for (m of store.getTaskMembers(task); track m.id) {
                      <span class="assignee-chip" [style.border-color]="m.color">
                        <span class="chip-avatar" [style.background-color]="m.color">{{ m.avatar }}</span>
                        <span class="chip-name">{{ m.name }}</span>
                        <span class="chip-role">({{ m.role }})</span>
                        <span class="capacity-dot" [attr.data-status]="store.getMemberLoadMetric(m.id).status" [title]="store.getMemberLoadMetric(m.id).label + ' (' + store.getMemberLoadMetric(m.id).effectiveLoad + '/' + m.capacityBudget + ' pts)'"></span>
                        @if (!isReadOnly(task) && store.getTaskMembers(task).length > 1) {
                          <button type="button" class="btn-remove-assignee" (click)="removeAssignee(task, m.id)" title="Remove co-assignee">
                            <i class="ph-light ph-x"></i>
                          </button>
                        }
                      </span>
                    }
                  </div>

                  <!-- Member Selection Pool -->
                  @if (!isReadOnly(task)) {
                    <div class="assignee-select-pool">
                      <span class="pool-label">Toggle squad co-assignees:</span>
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
                <label class="field-label">Effort Points</label>
                <input
                  type="number"
                  min="1"
                  max="21"
                  class="text-input"
                  [disabled]="isReadOnly(task)"
                  [ngModel]="task.effortPoints"
                  (ngModelChange)="updateField('effortPoints', +$event)"
                />
              </div>

              <div class="field-group">
                <label class="field-label">Baseline Due Date (Committed)</label>
                <input
                  type="date"
                  class="text-input"
                  [disabled]="isReadOnly(task)"
                  [ngModel]="task.baselineDueDate || task.dueDate"
                  (ngModelChange)="updateField('baselineDueDate', $event)"
                />
              </div>

              <div class="field-group">
                <label class="field-label">Current Forecast Due Date</label>
                <input
                  type="date"
                  class="text-input"
                  [disabled]="isReadOnly(task)"
                  [ngModel]="task.dueDate"
                  (ngModelChange)="onDueDateChange(task, $event)"
                />
              </div>
            </div>

            <!-- Schedule & Grace Buffer Protocol (FR-05) -->
            @if (isScheduleDrifted(task)) {
              <div class="grace-buffer-panel">
                <div class="drift-header">
                  <div class="drift-title-wrap">
                    <span class="drift-icon">
                      <i class="ph-light ph-timer"></i>
                    </span>
                    <div>
                      <h4 class="drift-title">Schedule Drift Detected (+{{ getDaysDrift(task) }} Days)</h4>
                      <p class="drift-sub">Baseline: {{ task.baselineDueDate || task.dueDate }} ➔ Forecast: {{ task.dueDate }}</p>
                    </div>
                  </div>
                  <span class="grace-pill">Grace Buffer Active</span>
                </div>

                <div class="slip-reason-section">
                  <label class="field-label">Select 1-Click Slippage Reason:</label>
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
                      placeholder="Context notes for delivery retrospective..."
                    />
                  </div>
                </div>
              </div>
            }

            <!-- Server Endpoint Verification URL -->
            <div class="field-group">
              <label class="field-label">Server / Endpoint Verification URL</label>
              <div class="url-input-wrap">
                <input
                  type="url"
                  class="text-input"
                  [disabled]="store.isViewer()"
                  [ngModel]="task.deployedUrl"
                  (ngModelChange)="updateField('deployedUrl', $event)"
                  placeholder="https://staging-infer.internal.ai/v1/health"
                />
                @if (task.deployedUrl) {
                  <a
                    [href]="task.deployedUrl"
                    target="_blank"
                    rel="noopener"
                    class="btn-test-link"
                    title="Open live endpoint in new window"
                  >
                    <span>Open Endpoint</span>
                    <i class="ph-light ph-arrow-square-out"></i>
                  </a>
                }
              </div>
            </div>

            <!-- Description -->
            <div class="field-group">
              <label class="field-label">Description & Architecture Notes</label>
              <textarea
                class="textarea-input"
                rows="3"
                [disabled]="store.isViewer()"
                [ngModel]="task.description"
                (ngModelChange)="updateField('description', $event)"
                placeholder="Technical context, container tags, and acceptance benchmarks..."
              ></textarea>
            </div>

            <!-- Blocker Control Box -->
            <div class="blocker-card" [class.is-blocked]="task.blocked">
              <div class="blocker-row">
                <div>
                  <h4 class="blocker-heading">
                    {{ task.blocked ? '⚠️ Task is Blocked' : '🟢 Active & Unblocked' }}
                  </h4>
                  <p class="blocker-sub">
                    {{ task.blocked ? 'Lead Radar is alerting managers for fast unblocking.' : 'Flag bottlenecks immediately to trigger team awareness.' }}
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
                    placeholder="Describe blocker (e.g., waiting for GPU cluster quota)..."
                  />
                </div>
              }
            </div>

            <!-- Prerequisites & Dependencies (FR-03 Gantt Connector Engine) -->
            <div class="dependencies-section">
              <div class="section-title-row">
                <div class="dep-title-wrap">
                  <span class="dep-icon">
                    <i class="ph-light ph-link"></i>
                  </span>
                  <div>
                    <h4 class="section-title">Upstream Prerequisites & Dependencies</h4>
                    <p class="section-sub">Prerequisite deliverables required before this milestone can complete</p>
                  </div>
                </div>
                <span class="dep-count-badge font-mono">{{ (task.dependencies || []).length }} Prerequisite(s)</span>
              </div>

              <!-- List of linked dependencies -->
              <div class="dep-list">
                @for (depId of task.dependencies; track depId) {
                  <div class="dep-item">
                    <span class="dep-id font-mono">{{ depId }}</span>
                    <span class="dep-task-title" [title]="getTaskTitle(depId)">{{ getTaskTitle(depId) }}</span>
                    <span class="dep-status" [attr.data-status]="getTaskStatus(depId)">{{ getTaskStatus(depId) }}</span>
                    @if (!store.isViewer()) {
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
                    <span>No upstream prerequisite dependencies linked. This deliverable can run in parallel.</span>
                  </div>
                }
              </div>

              <!-- Add dependency row -->
              @if (!store.isViewer()) {
                <div class="add-dep-row">
                  <select class="select-input select-sm" [(ngModel)]="selectedUpstreamId">
                    <option value="">+ Link Upstream Prerequisite Deliverable...</option>
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
                    Link Prerequisite
                  </button>
                </div>
              }

              @if (dependencyError) {
                <div class="dep-error-alert">
                  <span>⚠️ {{ dependencyError }}</span>
                </div>
              }
            </div>

            <!-- Subtasks Checklist -->
            <div class="subtasks-section">
              <div class="section-title-row">
                <h4 class="section-title">
                  Checklist Subtasks ({{ getCompletedCount(task) }}/{{ task.subtasks.length || 0 }})
                </h4>
              </div>

              <div class="subtasks-list">
                @for (st of task.subtasks; track st.id) {
                  <div class="subtask-row" [class.completed]="st.completed">
                    <label class="subtask-label">
                      <input
                        type="checkbox"
                        class="checkbox-custom"
                        [disabled]="store.isViewer()"
                        [checked]="st.completed"
                        (change)="store.toggleSubtask(task.id, st.id)"
                      />
                      <span class="subtask-text">{{ st.title }}</span>
                    </label>
                    @if (!store.isViewer()) {
                      <button
                        type="button"
                        class="btn-del-subtask"
                        (click)="store.deleteSubtask(task.id, st.id)"
                        title="Remove subtask"
                      >
                        <i class="ph-light ph-x"></i>
                      </button>
                    }
                  </div>
                }
              </div>

              @if (!store.isViewer()) {
                <div class="add-subtask-row">
                  <input
                    type="text"
                    class="text-input text-input-sm"
                    [(ngModel)]="newSubtaskTitle"
                    (keyup.enter)="addSubtask(task.id)"
                    placeholder="Add verification step..."
                  />
                  <button type="button" class="btn-add-sub" (click)="addSubtask(task.id)">Add</button>
                </div>
              }
            </div>

            <!-- Server Review & Verification Section -->
            <div class="review-section">
              <div class="review-header">
                <div class="review-title-wrap">
                  <span class="review-icon">
                    <i class="ph-light ph-shield-check"></i>
                  </span>
                  <div>
                    <h4 class="section-title">Lead / QA Server Verification</h4>
                    <p class="section-sub">Sign-off audit trail & recovery scoring prior to closing</p>
                  </div>
                </div>

                @if (store.canSignOffDone() && task.status === 'DEPLOYED') {
                  <button
                    type="button"
                    class="btn-fast-approve"
                    (click)="quickApproveAndClose(task)"
                    title="1-Click Tech Lead Sign-off"
                  >
                    <i class="ph-light ph-check"></i>
                    <span>Sign Off & Close</span>
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
                    <span>No Tech Lead / QA server verification notes recorded yet.</span>
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
                    placeholder="Post inspection findings, latency verification, or bug notes..."
                  ></textarea>

                  <div class="post-review-controls">
                    <div class="verdict-select">
                      <span class="field-label">Verdict:</span>
                      <select class="select-input select-sm" [(ngModel)]="newReviewVerdict">
                        @if (store.canApproveReview()) {
                          <option value="APPROVED">✓ Approved & Verified (Closes to Done)</option>
                        }
                        <option value="OBSERVATION">ℹ Observation</option>
                        <option value="NEEDS_CHANGES">✕ Needs Changes (+3pt Recovery Penalty)</option>
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
                      Note: You are currently active as <strong>{{ store.currentUser().name }} [{{ store.currentUserRole() }}]</strong>. Only Tech Lead / Admin can submit an APPROVED closing verdict.
                    </p>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Drawer Footer -->
          <div class="drawer-footer">
            @if (!store.isViewer()) {
              <button type="button" class="btn-delete-task" (click)="deleteTask(task.id)">
                <i class="ph-light ph-trash"></i>
                <span>Delete Task</span>
              </button>
            }
            <button type="button" class="btn-close-drawer" (click)="close()">
              Close Drawer
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
      background: rgba(20, 19, 18, 0.45);
      backdrop-filter: blur(6px);
      z-index: 90;
      display: flex;
      justify-content: flex-end;
      animation: fadeIn 0.18s ease-out;
    }
    .drawer-panel {
      width: 630px;
      max-width: 92vw;
      height: 100%;
      background: var(--bg-surface);
      border-left: 1px solid var(--border-hairline);
      box-shadow: var(--shadow-drawer);
      display: flex;
      flex-direction: column;
      animation: slideIn 0.25s var(--ease-tactile);
    }
    @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .viewer-notice-strip {
      background: var(--accent-warn-tint);
      border-bottom: 1px solid rgba(197, 155, 78, 0.3);
      color: var(--accent-warn);
      padding: 10px 20px;
      font-size: 11.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .ownership-lock-badge {
      background: var(--bg-subtle);
      border-bottom: 1px solid var(--border-hairline);
      color: var(--text-secondary);
      padding: 10px 20px;
      font-size: 11.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .drawer-header {
      padding: 18px 24px;
      border-bottom: 1px solid var(--border-hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
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
      border: 1px solid rgba(92, 115, 98, 0.25);
      padding: 2px 8px;
      border-radius: var(--radius-pill);
    }

    .priority-pill {
      font-size: 10px;
      font-weight: 600;
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
      border: 1px solid rgba(197, 155, 78, 0.25);
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
      padding: 24px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .field-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .field-label {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .input-title {
      font-size: 18px;
      font-weight: 500;
      padding: 8px 12px;
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
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-pill);
      padding: 3px;
    }

    .status-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 7px 10px;
      border-radius: var(--radius-pill);
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-size: 11.5px;
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition-tactile);
    }

    .status-btn:hover:not(:disabled) {
      color: var(--text-primary);
    }

    .status-btn.active {
      background: var(--bg-surface);
      color: var(--accent-primary);
      box-shadow: var(--shadow-sm);
      font-weight: 600;
    }

    .status-btn.btn-done.active {
      color: var(--status-done);
    }

    .status-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .capacity-advisory-box {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 16px;
      border-radius: var(--radius-inner);
      background: var(--accent-danger-tint);
      border: 1px solid rgba(200, 109, 81, 0.3);
      font-size: 12px;
      color: var(--text-primary);
    }

    .advisory-icon {
      font-size: 16px;
      color: var(--accent-danger);
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .full-width-span {
      grid-column: 1 / -1;
    }

    .text-input, .select-input, .textarea-input {
      padding: 8px 12px;
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

    .text-input-sm {
      padding: 6px 10px;
      font-size: 12px;
    }

    .assignee-picker-box {
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-inner);
      padding: 12px 14px;
    }

    .selected-assignees-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .assignee-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px 3px 4px;
      border-radius: var(--radius-pill);
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      font-size: 11.5px;
    }

    .chip-avatar {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      color: #ffffff;
      font-size: 8.5px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .chip-name { font-weight: 600; color: var(--text-primary); }
    .chip-role { font-size: 10.5px; color: var(--text-muted); }

    .capacity-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .capacity-dot[data-status="OPTIMAL"] { background: var(--status-done); }
    .capacity-dot[data-status="NEAR_CAPACITY"] { background: var(--accent-warn); }
    .capacity-dot[data-status="OVER_BUDGET"] { background: var(--accent-danger); }

    .btn-remove-assignee {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      font-size: 11px;
    }
    .btn-remove-assignee:hover { color: var(--accent-danger); }

    .assignee-select-pool {
      display: flex;
      flex-direction: column;
      gap: 6px;
      border-top: 1px solid var(--border-hairline);
      padding-top: 8px;
    }

    .pool-label { font-size: 11px; color: var(--text-muted); }
    .pool-chips { display: flex; flex-wrap: wrap; gap: 6px; }

    .pool-chip-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      border-radius: var(--radius-pill);
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
      font-size: 11px;
      cursor: pointer;
      transition: var(--transition-tactile);
    }
    .pool-chip-btn:hover { border-color: var(--accent-primary); }
    .pool-chip-btn.selected {
      background: var(--accent-primary-tint);
      border-color: rgba(92, 115, 98, 0.4);
      color: var(--accent-primary);
      font-weight: 600;
    }

    .chip-avatar-sm {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      color: #ffffff;
      font-size: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
    }

    .capacity-mini-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
    }
    .capacity-mini-dot[data-status="OPTIMAL"] { background: var(--status-done); }
    .capacity-mini-dot[data-status="NEAR_CAPACITY"] { background: var(--accent-warn); }
    .capacity-mini-dot[data-status="OVER_BUDGET"] { background: var(--accent-danger); }

    /* Grace Buffer Panel */
    .grace-buffer-panel {
      background: var(--accent-warn-tint);
      border: 1px solid rgba(197, 155, 78, 0.3);
      border-radius: var(--radius-inner);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .drift-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .drift-title-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .drift-icon {
      font-size: 20px;
      color: var(--accent-warn);
    }

    .drift-title { font-size: 13.5px; font-weight: 600; margin: 0; color: var(--text-primary); }
    .drift-sub { font-size: 11.5px; color: var(--text-secondary); margin: 2px 0 0 0; }

    .grace-pill {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: rgba(197, 155, 78, 0.2);
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
      padding: 6px 12px;
      border-radius: var(--radius-pill);
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
      font-size: 11px;
      cursor: pointer;
      transition: var(--transition-tactile);
    }

    .slip-reason-btn:hover { border-color: var(--accent-warn); }
    .slip-reason-btn.active {
      background: var(--accent-warn);
      color: #ffffff;
      border-color: var(--accent-warn);
      font-weight: 600;
    }

    .url-input-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .url-input-wrap .text-input { flex: 1; }

    .btn-test-link {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 7px 14px;
      border-radius: var(--radius-pill);
      background: var(--accent-primary-tint);
      border: 1px solid rgba(92, 115, 98, 0.3);
      color: var(--accent-primary);
      text-decoration: none;
      font-size: 11.5px;
      font-weight: 600;
      white-space: nowrap;
      transition: var(--transition-tactile);
    }
    .btn-test-link:hover {
      background: var(--accent-primary);
      color: #ffffff;
      transform: translateY(-1px);
    }

    /* Blocker Card */
    .blocker-card {
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-inner);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .blocker-card.is-blocked {
      background: var(--status-blocked-bg);
      border-color: rgba(200, 109, 81, 0.35);
    }

    .blocker-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .blocker-heading { font-size: 13px; font-weight: 600; margin: 0; color: var(--text-primary); }
    .blocker-sub { font-size: 11.5px; color: var(--text-secondary); margin: 2px 0 0 0; }

    .btn-blocker-toggle {
      padding: 6px 14px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-hairline);
      background: var(--bg-surface);
      color: var(--text-secondary);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition-tactile);
    }

    .btn-blocker-toggle.btn-clear {
      background: var(--accent-danger);
      color: #ffffff;
      border-color: var(--accent-danger);
    }

    /* Dependencies Section */
    .dependencies-section, .subtasks-section, .review-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-top: 16px;
      border-top: 1px solid var(--border-hairline);
    }

    .section-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .dep-title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .dep-icon, .review-icon {
      font-size: 18px;
      color: var(--accent-primary);
    }

    .section-title { font-size: 13.5px; font-weight: 600; margin: 0; color: var(--text-primary); }
    .section-sub { font-size: 11px; color: var(--text-muted); margin: 2px 0 0 0; }

    .dep-count-badge {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-muted);
    }

    .dep-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .dep-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--radius-inner);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      font-size: 12px;
    }

    .dep-id { font-weight: 700; color: var(--text-muted); font-size: 11px; }
    .dep-task-title { flex: 1; color: var(--text-primary); }
    .dep-status {
      font-size: 9.5px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--bg-surface);
      color: var(--text-muted);
    }

    .btn-del-dep, .btn-del-subtask {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
    }
    .btn-del-dep:hover, .btn-del-subtask:hover { color: var(--accent-danger); }

    .empty-deps, .empty-reviews {
      padding: 14px;
      text-align: center;
      color: var(--text-muted);
      font-size: 11.5px;
      background: var(--bg-subtle);
      border-radius: var(--radius-inner);
    }

    .add-dep-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-add-dep, .btn-add-sub {
      padding: 7px 14px;
      border-radius: var(--radius-pill);
      background: var(--accent-primary);
      color: #ffffff;
      border: none;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: var(--transition-tactile);
    }
    .btn-add-dep:hover:not(:disabled), .btn-add-sub:hover {
      background: var(--accent-primary-hover);
    }

    .subtasks-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .subtask-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 12px;
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
      cursor: pointer;
      font-size: 12.5px;
    }

    .add-subtask-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .add-subtask-row .text-input { flex: 1; }

    .review-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .btn-fast-approve {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: var(--radius-pill);
      background: var(--status-done);
      color: #ffffff;
      border: none;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition-tactile);
    }
    .btn-fast-approve:hover {
      transform: translateY(-1px);
    }

    .review-feed {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .review-card {
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-inner);
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .review-card.approved {
      border-color: rgba(78, 124, 89, 0.4);
      background: var(--status-done-bg);
    }

    .review-card.needs-changes {
      border-color: rgba(200, 109, 81, 0.4);
      background: var(--status-blocked-bg);
    }

    .review-card-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .review-author {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
    }

    .author-avatar {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--accent-primary);
      color: #ffffff;
      font-size: 8.5px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .note-time { font-size: 10px; color: var(--text-muted); }

    .verdict-tag {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 7px;
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
      padding: 14px;
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

    .select-sm {
      padding: 5px 8px;
      font-size: 11.5px;
      flex: 1;
    }

    .btn-post-review {
      padding: 6px 16px;
      background: var(--accent-primary);
      color: #fff;
      border: none;
      border-radius: var(--radius-pill);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition-tactile);
    }
    .btn-post-review:hover:not(:disabled) {
      background: var(--accent-primary-hover);
      transform: translateY(-1px);
    }

    .rbac-hint-text {
      font-size: 10.5px;
      color: var(--text-muted);
      margin: 0;
    }

    .drawer-footer {
      padding: 16px 24px;
      border-top: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
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
      transition: var(--transition-tactile);
    }
    .btn-delete-task:hover {
      text-decoration: underline;
    }

    .btn-close-drawer {
      padding: 8px 18px;
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-pill);
      color: var(--text-primary);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition-tactile);
    }
    .btn-close-drawer:hover {
      background: var(--bg-subtle);
      transform: translateY(-1px);
    }
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

    let updated: string[];
    if (current.includes(memberId)) {
      if (current.length === 1) {
        return;
      }
      updated = current.filter(id => id !== memberId);
    } else {
      updated = [...current, memberId];
    }
    this.store.updateTaskAssignees(task.id, updated);
  }

  removeAssignee(task: Task, memberId: string): void {
    if (this.isReadOnly(task)) return;
    const current = (task.assigneeIds && task.assigneeIds.length > 0)
      ? [...task.assigneeIds]
      : (task.assigneeId ? [task.assigneeId] : []);

    if (current.length <= 1) return;
    const updated = current.filter(id => id !== memberId);
    this.store.updateTaskAssignees(task.id, updated);
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

  getTaskStatus(id: string): string {
    return this.store.tasks().find(t => t.id === id)?.status || 'TODO';
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

  updateField(field: keyof Task, val: any): void {
    const task = this.store.selectedTask();
    if (!task) return;
    this.store.updateTask({ ...task, [field]: val });
  }

  setStatus(status: TaskStatus): void {
    const task = this.store.selectedTask();
    if (!task) return;
    this.store.updateTaskStatus(task.id, status);
  }

  onDueDateChange(task: Task, newDue: string): void {
    const baseline = task.baselineDueDate || task.dueDate;
    let slipReason = task.slipReason;
    if (newDue > baseline && !slipReason) {
      slipReason = 'UNDERESTIMATED';
    }
    this.store.updateTask({
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
    const base = new Date(task.baselineDueDate || task.dueDate).getTime();
    const curr = new Date(task.dueDate).getTime();
    const diff = Math.round((curr - base) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
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
      content: 'Server verification checks verified on staging. Production sign-off accepted.'
    });
  }

  deleteTask(taskId: string): void {
    this.store.deleteTask(taskId);
  }
}
