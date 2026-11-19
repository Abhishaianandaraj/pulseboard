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
              <span>🔒 <strong>Viewer Session:</strong> You have read-only permissions. Switch personas in the top bar to test DEV or LEAD controls.</span>
            </div>
          }

          <!-- Drawer Header -->
          <div class="drawer-header">
            <div class="header-left">
              <span class="task-id-badge">{{ task.id }}</span>
              <span class="project-code-tag">{{ getProjectCode(task.projectId) }}</span>
              <span class="priority-pill" [attr.data-priority]="task.priority">{{ task.priority }}</span>
              @if (task.blocked) {
                <span class="blocked-badge">BLOCKED</span>
              }
              @if (task.status === 'DEPLOYED') {
                <span class="server-badge">READY FOR CHECK</span>
              }
              @if (task.reworkCount > 0) {
                <span class="rework-badge" title="Rework recovery overhead active">
                  🔁 {{ task.reworkCount }} Rework (+{{ task.reworkCount * 3 }} pts)
                </span>
              }
            </div>
            <button type="button" class="btn-close" (click)="close()" title="Close Drawer (Esc)">✕</button>
          </div>

          <!-- Drawer Content Body -->
          <div class="drawer-body custom-scroll">
            <!-- Title Input -->
            <div class="field-group">
              <label class="field-label">Task Title</label>
              <input
                type="text"
                class="input-title"
                [disabled]="store.isViewer()"
                [ngModel]="task.title"
                (ngModelChange)="updateField('title', $event)"
                placeholder="Engineering task summary..."
              />
            </div>

            <!-- Workflow Status Stepper Bar -->
            <div class="field-group">
              <label class="field-label">Workflow Status</label>
              <div class="status-grid">
                <button
                  type="button"
                  class="status-btn"
                  [disabled]="store.isViewer()"
                  [class.active]="task.status === 'TODO'"
                  (click)="setStatus('TODO')"
                >
                  To Do
                </button>
                <button
                  type="button"
                  class="status-btn"
                  [disabled]="store.isViewer()"
                  [class.active]="task.status === 'IN_PROGRESS'"
                  (click)="setStatus('IN_PROGRESS')"
                >
                  In Progress
                </button>
                <button
                  type="button"
                  class="status-btn btn-deployed"
                  [disabled]="store.isViewer()"
                  [class.active]="task.status === 'DEPLOYED'"
                  (click)="setStatus('DEPLOYED')"
                >
                  🚀 Deployed
                </button>
                <button
                  type="button"
                  class="status-btn btn-done"
                  [disabled]="store.isViewer() || (!store.canSignOffDone() && task.status !== 'DONE')"
                  [class.active]="task.status === 'DONE'"
                  (click)="setStatus('DONE')"
                  [title]="!store.canSignOffDone() ? 'Requires Tech Lead or Admin sign-off' : 'Mark task as Done'"
                >
                  ✓ Done {{ !store.canSignOffDone() ? '(Lead)' : '' }}
                </button>
              </div>
            </div>

            <!-- Assignee Capacity Advisory Banner (FR-04) -->
            @if (store.getMemberLoadMetric(task.assigneeId).status === 'OVER_BUDGET') {
              <div class="capacity-advisory-box">
                <div class="advisory-icon">⚠️</div>
                <div class="advisory-text">
                  <strong>Capacity Advisory:</strong>
                  {{ store.assigneeMap().get(task.assigneeId)?.name }} is currently Over Budget
                  ({{ store.getMemberLoadMetric(task.assigneeId).effectiveLoad }}/{{ store.assigneeMap().get(task.assigneeId)?.capacityBudget }} pts)
                  including {{ store.getMemberLoadMetric(task.assigneeId).reworkCount * 3 }} recovery penalty points. Additional story points may impact delivery.
                </div>
              </div>
            }

            <!-- Metadata Grid -->
            <div class="meta-grid">
              <div class="field-group">
                <label class="field-label">Project Workspace</label>
                <select
                  class="select-input"
                  [disabled]="store.isViewer()"
                  [ngModel]="task.projectId"
                  (ngModelChange)="updateField('projectId', $event)"
                >
                  @for (proj of store.projects(); track proj.id) {
                    <option [value]="proj.id">[{{ proj.code }}] {{ proj.name }}</option>
                  }
                </select>
              </div>

              <div class="field-group">
                <label class="field-label">Assignee & Live Capacity</label>
                <select
                  class="select-input"
                  [disabled]="store.isViewer()"
                  [ngModel]="task.assigneeId"
                  (ngModelChange)="updateField('assigneeId', $event)"
                >
                  @for (member of store.teamMembers(); track member.id) {
                    <option [value]="member.id">
                      {{ member.name }} • {{ store.getMemberLoadMetric(member.id).effectiveLoad }}/{{ member.capacityBudget }} pts ({{ store.getMemberLoadMetric(member.id).label }})
                    </option>
                  }
                </select>
              </div>

              <div class="field-group">
                <label class="field-label">Priority</label>
                <select
                  class="select-input"
                  [disabled]="store.isViewer()"
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
                  [disabled]="store.isViewer()"
                  [ngModel]="task.phase"
                  (ngModelChange)="updateField('phase', $event)"
                />
              </div>

              <div class="field-group">
                <label class="field-label">Sprint</label>
                <input
                  type="text"
                  class="text-input"
                  [disabled]="store.isViewer()"
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
                  [disabled]="store.isViewer()"
                  [ngModel]="task.effortPoints"
                  (ngModelChange)="updateField('effortPoints', +$event)"
                />
              </div>

              <div class="field-group">
                <label class="field-label">Baseline Due Date (Committed)</label>
                <input
                  type="date"
                  class="text-input"
                  [disabled]="store.isViewer()"
                  [ngModel]="task.baselineDueDate || task.dueDate"
                  (ngModelChange)="updateField('baselineDueDate', $event)"
                />
              </div>

              <div class="field-group">
                <label class="field-label">Current Forecast Due Date</label>
                <input
                  type="date"
                  class="text-input"
                  [disabled]="store.isViewer()"
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
                    <span class="drift-icon">⏱️</span>
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
                      🔗 Dependency Blocked
                    </button>
                    <button
                      type="button"
                      class="slip-reason-btn"
                      [class.active]="task.slipReason === 'SCOPE_EXPANDED'"
                      [disabled]="store.isViewer()"
                      (click)="setSlipReason(task, 'SCOPE_EXPANDED')"
                    >
                      📐 Scope Expanded
                    </button>
                    <button
                      type="button"
                      class="slip-reason-btn"
                      [class.active]="task.slipReason === 'PRODUCTION_HOTFIX'"
                      [disabled]="store.isViewer()"
                      (click)="setSlipReason(task, 'PRODUCTION_HOTFIX')"
                    >
                      🚨 Production Hotfix
                    </button>
                    <button
                      type="button"
                      class="slip-reason-btn"
                      [class.active]="task.slipReason === 'UNDERESTIMATED'"
                      [disabled]="store.isViewer()"
                      (click)="setSlipReason(task, 'UNDERESTIMATED')"
                    >
                      ⏳ Underestimated Effort
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
                    ↗ Open Endpoint
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
                        ✕
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
                  <span class="review-icon">🛡️</span>
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
                    ✓ Sign Off & Close to Done
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
                        <span class="note-time">{{ note.timestamp }}</span>
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
                Delete Task
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
      background: rgba(10, 14, 20, 0.45);
      backdrop-filter: blur(2px);
      z-index: 90;
      display: flex;
      justify-content: flex-end;
      animation: fadeIn 0.15s ease-out;
    }
    .drawer-panel {
      width: 620px;
      max-width: 92vw;
      height: 100%;
      background: var(--bg-surface);
      border-left: 1px solid var(--border-subtle);
      box-shadow: -8px 0 32px rgba(0, 0, 0, 0.25);
      display: flex;
      flex-direction: column;
      animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .viewer-notice-strip {
      background: rgba(234, 179, 8, 0.15);
      border-bottom: 1px solid rgba(234, 179, 8, 0.3);
      color: #eab308;
      padding: 8px 16px;
      font-size: 11.5px;
      font-weight: 500;
    }

    .drawer-header {
      padding: 16px 24px;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-elevated);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header-left {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .task-id-badge {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      color: var(--text-secondary);
      background: var(--bg-canvas);
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
    }
    .project-code-tag {
      font-family: var(--font-mono);
      font-size: 10.5px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 4px;
      background: rgba(59, 130, 246, 0.15);
      color: var(--accent-primary);
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    .priority-pill {
      font-size: 10.5px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .priority-pill[data-priority="CRITICAL"] { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
    .priority-pill[data-priority="HIGH"] { background: rgba(249, 115, 22, 0.15); color: #f97316; }
    .priority-pill[data-priority="MEDIUM"] { background: rgba(234, 179, 8, 0.15); color: #eab308; }
    .priority-pill[data-priority="LOW"] { background: rgba(100, 116, 139, 0.15); color: #64748b; }

    .blocked-badge {
      font-size: 10px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      background: #ef4444;
      color: #fff;
    }
    .server-badge {
      font-size: 10px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--status-deployed);
      color: #fff;
    }
    .rework-badge {
      font-size: 10.5px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 12px;
      background: rgba(239, 68, 68, 0.12);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .btn-close {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 16px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .btn-close:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

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
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-secondary);
    }
    .input-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      background: transparent;
      border: 1px solid transparent;
      border-radius: 6px;
      padding: 6px 8px;
      margin: -6px -8px;
      outline: none;
    }
    .input-title:focus {
      border-color: var(--border-focus);
      background: var(--bg-canvas);
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
    }
    .status-btn {
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .status-btn:hover:not(:disabled) {
      border-color: var(--border-focus);
      color: var(--text-primary);
    }
    .status-btn.active {
      background: var(--accent-primary);
      color: #fff;
      border-color: var(--accent-primary);
    }
    .status-btn.btn-deployed.active {
      background: var(--status-deployed);
      border-color: var(--status-deployed);
    }
    .status-btn.btn-done.active {
      background: var(--status-done);
      border-color: var(--status-done);
    }
    .status-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    /* Capacity Advisory Box */
    .capacity-advisory-box {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.25);
      border-radius: 8px;
      padding: 10px 14px;
    }
    .advisory-icon {
      font-size: 16px;
      line-height: 1;
    }
    .advisory-text {
      font-size: 12px;
      color: #ef4444;
      line-height: 1.45;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
    }

    .text-input, .select-input, .textarea-input {
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 13px;
      color: var(--text-primary);
      outline: none;
      font-family: inherit;
    }
    .text-input:focus, .select-input:focus, .textarea-input:focus {
      border-color: var(--border-focus);
    }
    .text-input-sm {
      padding: 6px 8px;
      font-size: 12px;
    }

    /* Grace Buffer Panel */
    .grace-buffer-panel {
      background: var(--bg-elevated);
      border: 1px solid rgba(234, 179, 8, 0.4);
      border-radius: 8px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .drift-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .drift-title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .drift-icon { font-size: 18px; }
    .drift-title {
      font-size: 13px;
      font-weight: 700;
      color: #eab308;
      margin: 0;
    }
    .drift-sub {
      font-size: 11px;
      color: var(--text-secondary);
      margin: 0;
    }
    .grace-pill {
      font-size: 10.5px;
      font-weight: 700;
      background: rgba(234, 179, 8, 0.15);
      color: #eab308;
      padding: 2px 7px;
      border-radius: 4px;
    }
    .slip-reasons-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
      margin-top: 4px;
      margin-bottom: 8px;
    }
    .slip-reason-btn {
      padding: 6px 10px;
      font-size: 11.5px;
      font-weight: 600;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      color: var(--text-secondary);
      cursor: pointer;
      text-align: left;
      transition: all 0.12s ease;
    }
    .slip-reason-btn:hover:not(:disabled) {
      border-color: #eab308;
      color: var(--text-primary);
    }
    .slip-reason-btn.active {
      background: rgba(234, 179, 8, 0.18);
      border-color: #eab308;
      color: #eab308;
      font-weight: 700;
    }

    .url-input-wrap {
      display: flex;
      gap: 8px;
    }
    .url-input-wrap .text-input { flex: 1; }
    .btn-test-link {
      padding: 8px 12px;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--accent-primary);
      text-decoration: none;
      white-space: nowrap;
      display: flex;
      align-items: center;
    }

    .blocker-card {
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .blocker-card.is-blocked {
      border-color: rgba(239, 68, 68, 0.4);
      background: rgba(239, 68, 68, 0.04);
    }
    .blocker-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .blocker-heading {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 2px 0;
    }
    .blocker-sub {
      font-size: 11.5px;
      color: var(--text-secondary);
      margin: 0;
    }
    .btn-blocker-toggle {
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #ef4444;
      cursor: pointer;
    }
    .btn-blocker-toggle.btn-clear {
      background: rgba(16, 185, 129, 0.15);
      border-color: rgba(16, 185, 129, 0.3);
      color: #10b981;
    }

    .subtasks-section, .review-section {
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .section-title-row, .review-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .review-title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }
    .section-sub {
      font-size: 11px;
      color: var(--text-secondary);
      margin: 0;
    }
    .btn-fast-approve {
      padding: 5px 10px;
      background: var(--status-done);
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
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
      padding: 6px 8px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
    }
    .subtask-label {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      cursor: pointer;
    }
    .subtask-text {
      font-size: 12.5px;
      color: var(--text-primary);
    }
    .subtask-row.completed .subtask-text {
      text-decoration: line-through;
      color: var(--text-muted);
    }
    .btn-del-subtask {
      border: none;
      background: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 12px;
    }
    .add-subtask-row {
      display: flex;
      gap: 8px;
    }
    .add-subtask-row .text-input { flex: 1; }
    .btn-add-sub {
      padding: 6px 12px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-primary);
      cursor: pointer;
    }

    .review-feed {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 200px;
      overflow-y: auto;
    }
    .review-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      padding: 10px;
    }
    .review-card.approved {
      border-left: 3px solid var(--status-done);
    }
    .review-card.needs-changes {
      border-left: 3px solid #ef4444;
    }
    .review-card-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .review-author {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .author-avatar {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--accent-primary);
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .author-name {
      font-size: 12px;
      color: var(--text-primary);
    }
    .note-time {
      font-size: 10.5px;
      color: var(--text-muted);
    }
    .verdict-tag {
      font-size: 10px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(100, 116, 139, 0.15);
      color: var(--text-secondary);
    }
    .verdict-tag[data-verdict="APPROVED"] {
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
    }
    .verdict-tag[data-verdict="NEEDS_CHANGES"] {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }
    .note-body {
      font-size: 12px;
      color: var(--text-secondary);
      line-height: 1.4;
      margin: 0;
    }
    .empty-reviews {
      padding: 12px;
      text-align: center;
      color: var(--text-muted);
      font-size: 12px;
    }

    .post-review-box {
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      padding: 10px;
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
      padding: 4px 8px;
      font-size: 12px;
      flex: 1;
    }
    .btn-post-review {
      padding: 6px 14px;
      background: var(--accent-primary);
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-post-review:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .rbac-hint-text {
      font-size: 11px;
      color: var(--text-muted);
      margin: 4px 0 0 0;
    }

    .drawer-footer {
      padding: 14px 24px;
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-elevated);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .btn-delete-task {
      border: none;
      background: transparent;
      color: #ef4444;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-delete-task:hover { text-decoration: underline; }
    .btn-close-drawer {
      padding: 7px 16px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }
  `]
})
export class TaskDrawerComponent {
  protected readonly store = inject(TaskStoreService);

  newSubtaskTitle = '';
  newReviewContent = '';
  newReviewVerdict: ReviewVerdict = 'OBSERVATION';

  close(): void {
    this.store.closeTaskDrawer();
  }

  getProjectCode(projectId: string): string {
    return this.store.projectMap().get(projectId)?.code || 'PROJ';
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
