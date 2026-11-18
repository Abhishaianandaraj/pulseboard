import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskStoreService } from '../services/task-store.service';
import { Task, TaskStatus, TaskPriority, ReviewVerdict } from '../models/task.model';

@Component({
  selector: 'app-task-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (store.selectedTask(); as task) {
      <div class="drawer-backdrop" (click)="close()">
        <aside class="drawer-panel" (click)="$event.stopPropagation()">
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
                  [class.active]="task.status === 'TODO'"
                  (click)="setStatus('TODO')"
                >
                  To Do
                </button>
                <button
                  type="button"
                  class="status-btn"
                  [class.active]="task.status === 'IN_PROGRESS'"
                  (click)="setStatus('IN_PROGRESS')"
                >
                  In Progress
                </button>
                <button
                  type="button"
                  class="status-btn btn-deployed"
                  [class.active]="task.status === 'DEPLOYED'"
                  (click)="setStatus('DEPLOYED')"
                >
                  🚀 Deployed
                </button>
                <button
                  type="button"
                  class="status-btn btn-done"
                  [class.active]="task.status === 'DONE'"
                  (click)="setStatus('DONE')"
                >
                  ✓ Done
                </button>
              </div>
            </div>

            <!-- Metadata Grid -->
            <div class="meta-grid">
              <div class="field-group">
                <label class="field-label">Project Workspace</label>
                <select
                  class="select-input"
                  [ngModel]="task.projectId"
                  (ngModelChange)="updateField('projectId', $event)"
                >
                  @for (proj of store.projects(); track proj.id) {
                    <option [value]="proj.id">[{{ proj.code }}] {{ proj.name }}</option>
                  }
                </select>
              </div>

              <div class="field-group">
                <label class="field-label">Assignee (Role & Squad)</label>
                <select
                  class="select-input"
                  [ngModel]="task.assigneeId"
                  (ngModelChange)="updateField('assigneeId', $event)"
                >
                  @for (member of store.teamMembers(); track member.id) {
                    <option [value]="member.id">
                      {{ member.name }} • {{ member.role }} ({{ member.squad }})
                    </option>
                  }
                </select>
              </div>

              <div class="field-group">
                <label class="field-label">Priority</label>
                <select
                  class="select-input"
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
                  [ngModel]="task.phase"
                  (ngModelChange)="updateField('phase', $event)"
                />
              </div>

              <div class="field-group">
                <label class="field-label">Sprint</label>
                <input
                  type="text"
                  class="text-input"
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
                  [ngModel]="task.effortPoints"
                  (ngModelChange)="updateField('effortPoints', +$event)"
                />
              </div>

              <div class="field-group">
                <label class="field-label">Due Date</label>
                <input
                  type="date"
                  class="text-input"
                  [ngModel]="task.dueDate"
                  (ngModelChange)="updateField('dueDate', $event)"
                />
              </div>
            </div>

            <!-- Server Endpoint Verification URL -->
            <div class="field-group">
              <label class="field-label">Server / Endpoint Verification URL</label>
              <div class="url-input-wrap">
                <input
                  type="url"
                  class="text-input"
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
                        [checked]="st.completed"
                        (change)="store.toggleSubtask(task.id, st.id)"
                      />
                      <span class="subtask-text">{{ st.title }}</span>
                    </label>
                    <button
                      type="button"
                      class="btn-del-subtask"
                      (click)="store.deleteSubtask(task.id, st.id)"
                      title="Remove subtask"
                    >
                      ✕
                    </button>
                  </div>
                }
              </div>

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
            </div>

            <!-- Server Review & Verification Section -->
            <div class="review-section">
              <div class="review-header">
                <div class="review-title-wrap">
                  <span class="review-icon">🛡️</span>
                  <div>
                    <h4 class="section-title">Lead / QA Server Verification</h4>
                    <p class="section-sub">Audit trail of endpoint checks & approvals prior to closing</p>
                  </div>
                </div>
                <span class="ai-roadmap-pill" title="Autonomous test runner coming in V2">
                  ✨ AI Auto-Triage (V2)
                </span>
              </div>

              <!-- Existing Review Feed -->
              <div class="review-feed">
                @for (note of task.reviewNotes; track note.id) {
                  <div class="review-card" [class.approved]="note.verdict === 'APPROVED'">
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
              <div class="post-review-box">
                <textarea
                  class="textarea-input"
                  rows="2"
                  [(ngModel)]="newReviewContent"
                  placeholder="Post inspection findings, p99 latency verification, or bug notes..."
                ></textarea>

                <div class="post-review-controls">
                  <div class="verdict-select">
                    <span class="field-label">Verdict:</span>
                    <select class="select-input select-sm" [(ngModel)]="newReviewVerdict">
                      <option value="APPROVED">✓ Approved & Verified</option>
                      <option value="OBSERVATION">ℹ Observation</option>
                      <option value="NEEDS_CHANGES">✕ Needs Changes</option>
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
              </div>
            </div>
          </div>

          <!-- Drawer Footer -->
          <div class="drawer-footer">
            <button type="button" class="btn-delete-task" (click)="deleteTask(task.id)">
              Delete Task
            </button>
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
      width: 580px;
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
      background: var(--accent-light);
      color: var(--accent-primary);
      border: 1px solid var(--accent-primary);
    }
    .priority-pill {
      font-size: 10.5px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .priority-pill[data-priority="CRITICAL"] { background: var(--badge-critical-bg); color: var(--badge-critical-text); }
    .priority-pill[data-priority="HIGH"] { background: var(--badge-high-bg); color: var(--badge-high-text); }
    .priority-pill[data-priority="MEDIUM"] { background: var(--badge-medium-bg); color: var(--badge-medium-text); }
    .priority-pill[data-priority="LOW"] { background: var(--badge-low-bg); color: var(--badge-low-text); }

    .blocked-badge {
      font-size: 10.5px;
      font-weight: 700;
      background: var(--badge-critical-bg);
      color: var(--badge-critical-text);
      padding: 3px 8px;
      border-radius: 6px;
    }
    .server-badge {
      font-size: 10.5px;
      font-weight: 700;
      background: var(--status-deployed-bg);
      color: var(--status-deployed-text);
      padding: 3px 8px;
      border-radius: 6px;
    }
    .btn-close {
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-size: 16px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .btn-close:hover {
      background: var(--bg-canvas);
      color: var(--text-primary);
    }
    .drawer-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 18px;
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
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .input-title {
      font-size: 17px;
      font-weight: 700;
      color: var(--text-primary);
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 10px 12px;
      outline: none;
      transition: border-color 0.15s ease;
    }
    .input-title:focus {
      border-color: var(--accent-primary);
    }
    .status-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
    }
    .status-btn {
      padding: 8px 6px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .status-btn.active {
      background: var(--accent-primary);
      color: #ffffff;
      border-color: var(--accent-primary);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    }
    .status-btn.btn-deployed.active {
      background: var(--status-deployed);
      border-color: var(--status-deployed);
    }
    .status-btn.btn-done.active {
      background: var(--status-done);
      border-color: var(--status-done);
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .text-input, .select-input, .textarea-input {
      width: 100%;
      background: var(--bg-surface);
      color: var(--text-primary);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 12.5px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s ease;
    }
    .text-input:focus, .select-input:focus, .textarea-input:focus {
      border-color: var(--accent-primary);
    }
    .text-input-sm {
      padding: 6px 10px;
      font-size: 12px;
    }
    .url-input-wrap {
      display: flex;
      gap: 8px;
    }
    .btn-test-link {
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
      padding: 6px 12px;
      background: var(--status-deployed-bg);
      color: var(--status-deployed-text);
      border: 1px solid var(--status-deployed);
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 600;
      text-decoration: none;
    }
    .blocker-card {
      padding: 12px 14px;
      border-radius: 8px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-elevated);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .blocker-card.is-blocked {
      background: var(--badge-critical-bg);
      border-color: var(--badge-critical-text);
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
      margin: 0;
    }
    .blocker-sub {
      font-size: 11.5px;
      color: var(--text-secondary);
      margin: 2px 0 0 0;
    }
    .btn-blocker-toggle {
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 700;
      border: 1px solid var(--badge-critical-text);
      background: var(--badge-critical-bg);
      color: var(--badge-critical-text);
      cursor: pointer;
    }
    .btn-blocker-toggle.btn-clear {
      background: var(--status-done);
      color: #ffffff;
      border-color: var(--status-done);
    }
    .subtasks-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .section-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
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
      padding: 6px 10px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
    }
    .subtask-row.completed {
      opacity: 0.65;
    }
    .subtask-row.completed .subtask-text {
      text-decoration: line-through;
    }
    .subtask-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12.5px;
      color: var(--text-primary);
      cursor: pointer;
      flex: 1;
    }
    .btn-del-subtask {
      border: none;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 12px;
    }
    .btn-del-subtask:hover { color: #ef4444; }
    .add-subtask-row {
      display: flex;
      gap: 6px;
    }
    .btn-add-sub {
      padding: 6px 14px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      color: var(--text-primary);
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .review-section {
      padding: 16px;
      border-radius: 8px;
      border: 1px solid var(--status-deployed);
      background: var(--bg-elevated);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .review-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
    }
    .review-title-wrap {
      display: flex;
      gap: 8px;
    }
    .review-icon { font-size: 18px; }
    .ai-roadmap-pill {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 12px;
      background: var(--status-deployed-bg);
      color: var(--status-deployed-text);
      border: 1px solid var(--status-deployed);
    }
    .review-feed {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 180px;
      overflow-y: auto;
    }
    .review-card {
      padding: 10px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .review-card.approved {
      border-left: 3px solid var(--status-done);
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
      background: var(--status-deployed);
      color: #ffffff;
      font-size: 9px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .author-name { color: var(--text-primary); }
    .note-time { color: var(--text-muted); font-size: 10px; }
    .verdict-tag {
      font-size: 9.5px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .verdict-tag[data-verdict="APPROVED"] { background: var(--badge-done-bg); color: var(--badge-done-text); }
    .verdict-tag[data-verdict="NEEDS_CHANGES"] { background: var(--badge-critical-bg); color: var(--badge-critical-text); }
    .verdict-tag[data-verdict="OBSERVATION"] { background: var(--badge-medium-bg); color: var(--badge-medium-text); }
    .note-body {
      font-size: 12px;
      color: var(--text-primary);
      margin: 0;
      line-height: 1.4;
    }
    .empty-reviews {
      text-align: center;
      padding: 12px;
      font-size: 11.5px;
      color: var(--text-muted);
      border: 1px dashed var(--border-subtle);
      border-radius: 6px;
    }
    .post-review-box {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .post-review-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .verdict-select {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .select-sm {
      padding: 4px 8px;
      font-size: 11.5px;
    }
    .btn-post-review {
      padding: 6px 14px;
      background: var(--status-deployed);
      color: #ffffff;
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
    .drawer-footer {
      padding: 16px 24px;
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
  newReviewVerdict: ReviewVerdict = 'APPROVED';

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
    this.store.addReviewNote(taskId, {
      author: 'Vikram Rao (Tech Lead)',
      authorAvatar: 'VR',
      authorRole: 'LEAD',
      verdict: this.newReviewVerdict,
      content: this.newReviewContent.trim()
    });
    this.newReviewContent = '';
  }

  deleteTask(taskId: string): void {
    this.store.deleteTask(taskId);
  }
}
