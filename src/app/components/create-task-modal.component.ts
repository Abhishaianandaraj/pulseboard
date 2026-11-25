import { Component, inject, output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TaskStoreService,
  todayIsoDate,
  addCalendarDays,
  diffCalendarDays
} from '../services/task-store.service';
import {
  Task,
  TaskPriority,
  TaskStatus,
  Subtask,
  TeamMember,
  STATUS_LABELS
} from '../models/task.model';

@Component({
  selector: 'app-create-task-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="close.emit()">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <!-- Sticky Modal Header -->
        <div class="modal-head">
          <div class="head-title-group">
            <span class="head-icon">
              <i class="ph-light ph-plus-square"></i>
            </span>
            <div>
              <h3 class="modal-title">Create New Task</h3>
              <p class="modal-subtitle">Schedule dates, prerequisites, effort points, and checklist items</p>
            </div>
          </div>
          <button type="button" class="btn-close" (click)="close.emit()" title="Close dialog">
            <i class="ph-light ph-x"></i>
          </button>
        </div>

        <!-- Scrollable Modal Body -->
        <div class="modal-body custom-scroll">
          <!-- Title -->
          <div class="form-group">
            <label class="form-label required">Task Title</label>
            <input
              type="text"
              class="form-input"
              [(ngModel)]="title"
              placeholder="e.g., Implement role-based document access filter on RAG API"
            />
          </div>

          <!-- Project & Status -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Project</label>
              <select class="form-select" [ngModel]="projectId" (ngModelChange)="onProjectChange($event)">
                @for (proj of store.visibleProjects(); track proj.id) {
                  <option [value]="proj.id">[{{ proj.code }}] {{ proj.name }}</option>
                }
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Initial Status</label>
              <select class="form-select" [ngModel]="status" (ngModelChange)="onStatusChange($event)">
                <option value="TODO">{{ statusLabels.TODO }}</option>
                <option value="IN_PROGRESS">{{ statusLabels.IN_PROGRESS }}</option>
                <option value="DEPLOYED">{{ statusLabels.DEPLOYED }}</option>
              </select>
            </div>
          </div>

          <!-- Priority & Decoupled Effort Points -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Priority</label>
              <select class="form-select" [(ngModel)]="priority">
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            <div class="form-group">
              <div class="label-row">
                <label class="form-label">Effort Points (Decoupled from Dates)</label>
              </div>
              <div class="points-selector-row">
                @for (pt of presetPoints; track pt) {
                  <button
                    type="button"
                    class="pt-chip-btn font-mono"
                    [class.active]="effortPoints === pt"
                    (click)="effortPoints = pt"
                  >
                    {{ pt }}
                  </button>
                }
                <input
                  type="number"
                  class="form-input pts-num-input font-mono"
                  [(ngModel)]="effortPoints"
                  min="1"
                  max="21"
                />
              </div>
            </div>
          </div>

          <!-- Upstream Prerequisites (Multi-Predecessor Selection: 1 to 5+ supported) -->
          <div class="form-group">
            <div class="label-row">
              <label class="form-label">Prerequisite Tasks (Optional · Auto-Calculates Start Date)</label>
              @if (selectedDependencies.length > 0) {
                <span class="meta-badge font-mono">{{ selectedDependencies.length }} selected</span>
              }
            </div>

            @if (getAvailablePrerequisites().length > 0) {
              <div class="prereq-picker-list custom-scroll">
                @for (cand of getAvailablePrerequisites(); track cand.id) {
                  <label class="prereq-row" [class.selected]="selectedDependencies.includes(cand.id)">
                    <input
                      type="checkbox"
                      [checked]="selectedDependencies.includes(cand.id)"
                      (change)="togglePrerequisite(cand.id)"
                    />
                    <span class="prereq-id font-mono">{{ cand.id }}</span>
                    <span class="prereq-title">{{ cand.title }}</span>
                    <span class="prereq-due font-mono">Due {{ cand.dueDate }}</span>
                  </label>
                }
              </div>
            } @else {
              <div class="empty-inline-hint">No existing tasks in this project yet — task can start on any date.</div>
            }
          </div>

          <!-- Start Date & Due Date Pickers (with Prerequisite Helper Note) -->
          <div class="schedule-box">
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Start Date</label>
                <input
                  type="date"
                  class="form-input font-mono"
                  [ngModel]="startDate"
                  [min]="minAllowedStartDate()"
                  (ngModelChange)="onStartDateChange($event)"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Due Date</label>
                <input
                  type="date"
                  class="form-input font-mono"
                  [ngModel]="dueDate"
                  [min]="startDate"
                  (ngModelChange)="onDueDateChange($event)"
                />
              </div>
            </div>

            <div class="schedule-meta-strip">
              @if (prerequisiteScheduleHelper()) {
                <span class="prereq-helper-note">
                  <i class="ph-light ph-git-commit"></i>
                  <span>{{ prerequisiteScheduleHelper() }}</span>
                </span>
              } @else {
                <span class="duration-note">
                  <i class="ph-light ph-calendar-blank"></i>
                  <span>No prerequisites — independent schedule</span>
                </span>
              }
              <span class="duration-pill font-mono">
                Calendar Span: {{ calendarDurationDays() }}d · {{ effortPoints }} Effort Pt{{ effortPoints === 1 ? '' : 's' }}
              </span>
            </div>
          </div>

          <!-- Assignees (Scoped to Project Members) -->
          <div class="form-group">
            <label class="form-label">Assigned Owners (Points Split Across Co-Assignees)</label>
            <div class="assignee-pool">
              @for (mem of getProjectMembers(); track mem.id) {
                <button
                  type="button"
                  class="pool-chip-btn"
                  [class.selected]="assigneeIds.includes(mem.id)"
                  (click)="toggleAssignee(mem.id)"
                >
                  <span class="chip-avatar-sm" [style.background-color]="mem.color">{{ mem.avatar }}</span>
                  <span>{{ mem.name }}</span>
                  <span
                    class="capacity-mini-dot"
                    [attr.data-status]="store.getMemberLoadMetric(mem.id).status"
                    [title]="store.getMemberLoadMetric(mem.id).label"
                  ></span>
                </button>
              }
            </div>
          </div>

          <!-- Interactive Subtask Checklist Builder & Initial Progress -->
          <div class="form-group">
            <div class="label-row">
              <label class="form-label">Subtask Checklist ({{ completedSubtasksCount() }}/{{ subtasks.length }})</label>
              <div class="progress-inline-control">
                <span class="form-label">Progress:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  [(ngModel)]="progress"
                  class="progress-slider"
                />
                <span class="progress-pct font-mono">{{ progress }}%</span>
              </div>
            </div>

            <div class="checklist-builder-box">
              <div class="checklist-input-row">
                <input
                  type="text"
                  class="form-input"
                  [(ngModel)]="newSubtaskText"
                  (keydown.enter)="$event.preventDefault(); addSubtaskItem()"
                  placeholder="Type a checklist step and press Enter..."
                />
                <button
                  type="button"
                  class="btn-add-subtask"
                  [disabled]="!newSubtaskText.trim()"
                  (click)="addSubtaskItem()"
                >
                  <i class="ph-light ph-plus"></i>
                  <span>Add</span>
                </button>
              </div>

              @if (subtasks.length > 0) {
                <div class="checklist-items-list">
                  @for (item of subtasks; track item.id; let idx = $index) {
                    <div class="checklist-item-row" [class.is-done]="item.completed">
                      <label class="checklist-check-label">
                        <input
                          type="checkbox"
                          [checked]="item.completed"
                          (change)="toggleSubtaskItem(idx)"
                        />
                        <span class="checklist-item-text">{{ item.title }}</span>
                      </label>
                      <button
                        type="button"
                        class="btn-remove-subtask"
                        (click)="removeSubtaskItem(idx)"
                        title="Remove checklist item"
                      >
                        <i class="ph-light ph-trash"></i>
                      </button>
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Description -->
          <div class="form-group">
            <label class="form-label">Description &amp; Acceptance Criteria</label>
            <textarea
              class="form-textarea"
              rows="2"
              [(ngModel)]="description"
              placeholder="Technical specifications, target endpoints, or acceptance criteria..."
            ></textarea>
          </div>
        </div>

        <!-- Sticky Modal Footer -->
        <div class="modal-actions">
          <button type="button" class="btn-cancel" (click)="close.emit()">Cancel</button>
          <button
            type="button"
            class="btn-submit"
            [disabled]="!title.trim()"
            (click)="submit()"
          >
            <i class="ph-light ph-check"></i>
            <span>Create Task</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: var(--surface-overlay);
      backdrop-filter: blur(4px);
      z-index: 110;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .modal-card {
      width: 100%;
      max-width: 640px;
      max-height: 88vh;
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-float);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .modal-head {
      padding: 14px 20px;
      border-bottom: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-shrink: 0;
    }

    .head-title-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .head-icon {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-inner);
      background: var(--accent-primary-tint);
      color: var(--accent-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }

    .modal-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .modal-subtitle {
      font-size: 11.5px;
      color: var(--text-secondary);
      margin: 1px 0 0 0;
    }

    .btn-close {
      border: none;
      background: transparent;
      color: var(--text-muted);
      font-size: 18px;
      cursor: pointer;
      padding: 4px;
      border-radius: var(--radius-sm);
    }

    .btn-close:hover {
      color: var(--text-primary);
      background: var(--bg-hover);
    }

    .modal-body {
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .form-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    @media (max-width: 560px) {
      .form-grid-2 {
        grid-template-columns: 1fr;
      }
    }

    .label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }

    .form-label {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .form-label.required::after {
      content: ' *';
      color: var(--accent-danger);
    }

    .form-input, .form-select, .form-textarea {
      width: 100%;
      padding: 7px 10px;
      border-radius: var(--radius-inner);
      border: 1px solid var(--border-strong);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: 12.5px;
      outline: none;
      transition: var(--transition-tactile);
    }

    .form-input:focus, .form-select:focus, .form-textarea:focus {
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 2px var(--accent-primary-tint);
    }

    .points-selector-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .pt-chip-btn {
      padding: 5px 9px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      color: var(--text-secondary);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .pt-chip-btn.active {
      background: var(--accent-primary);
      border-color: var(--accent-primary);
      color: var(--text-inverse);
    }

    .pts-num-input {
      width: 62px;
      text-align: center;
      margin-left: auto;
    }

    .meta-badge {
      font-size: 10.5px;
      padding: 1px 7px;
      border-radius: var(--radius-pill);
      background: var(--accent-primary-tint);
      color: var(--accent-primary);
      font-weight: 600;
    }

    .prereq-picker-list {
      max-height: 118px;
      overflow-y: auto;
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-inner);
      background: var(--bg-subtle);
      display: flex;
      flex-direction: column;
    }

    .prereq-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-bottom: 1px solid var(--border-hairline);
      font-size: 12px;
      cursor: pointer;
    }

    .prereq-row:last-child {
      border-bottom: none;
    }

    .prereq-row.selected {
      background: var(--accent-primary-tint);
    }

    .prereq-id {
      font-size: 11px;
      font-weight: 600;
      color: var(--accent-primary);
      flex-shrink: 0;
    }

    .prereq-title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--text-primary);
    }

    .prereq-due {
      font-size: 10.5px;
      color: var(--text-muted);
      flex-shrink: 0;
    }

    .empty-inline-hint {
      font-size: 11.5px;
      color: var(--text-muted);
      padding: 7px 10px;
      background: var(--bg-subtle);
      border: 1px dashed var(--border-hairline);
      border-radius: var(--radius-inner);
    }

    .schedule-box {
      padding: 10px 12px;
      border-radius: var(--radius-inner);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .schedule-meta-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }

    .prereq-helper-note {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11.5px;
      font-weight: 600;
      color: var(--accent-primary);
    }

    .duration-note {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      color: var(--text-muted);
    }

    .duration-pill {
      font-size: 10.5px;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .assignee-pool {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
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
      font-size: 11.5px;
      cursor: pointer;
      white-space: nowrap;
    }

    .pool-chip-btn.selected {
      background: var(--accent-primary-tint);
      border-color: var(--accent-primary);
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

    /* Interactive Subtask Checklist Builder */
    .progress-inline-control {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .progress-slider {
      width: 84px;
      accent-color: var(--accent-primary);
      cursor: pointer;
    }

    .progress-pct {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--accent-primary);
      min-width: 34px;
      text-align: right;
    }

    .checklist-builder-box {
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-inner);
      background: var(--bg-subtle);
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .checklist-input-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-add-subtask {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 7px 12px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--accent-primary);
      background: var(--accent-primary);
      color: var(--text-inverse);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .btn-add-subtask:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .checklist-items-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 140px;
      overflow-y: auto;
    }

    .checklist-item-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 5px 8px;
      border-radius: var(--radius-sm);
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
    }

    .checklist-item-row.is-done .checklist-item-text {
      text-decoration: line-through;
      color: var(--text-muted);
    }

    .checklist-check-label {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;
      cursor: pointer;
      font-size: 12px;
      color: var(--text-primary);
    }

    .checklist-item-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .btn-remove-subtask {
      border: none;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      padding: 2px 4px;
      font-size: 14px;
    }

    .btn-remove-subtask:hover {
      color: var(--accent-danger);
    }

    .modal-actions {
      padding: 12px 20px;
      border-top: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-shrink: 0;
    }

    .btn-cancel {
      padding: 7px 15px;
      border-radius: var(--radius-pill);
      background: var(--bg-surface);
      border: 1px solid var(--border-strong);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
    }

    .btn-submit {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 18px;
      border-radius: var(--radius-pill);
      background: var(--accent-primary);
      border: 1px solid transparent;
      color: var(--text-inverse);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }

    .btn-submit:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  `]
})
export class CreateTaskModalComponent implements OnInit {
  protected readonly store = inject(TaskStoreService);
  readonly close = output<void>();

  readonly statusLabels = STATUS_LABELS;
  readonly presetPoints = [1, 2, 3, 5, 8, 13];

  title = '';
  description = '';
  projectId = '';
  status: TaskStatus = 'TODO';
  priority: TaskPriority = 'MEDIUM';
  effortPoints = 3;
  startDate = todayIsoDate();
  dueDate = addCalendarDays(todayIsoDate(), 4);
  selectedDependencies: string[] = [];
  assigneeIds: string[] = [];
  subtasks: Subtask[] = [];
  newSubtaskText = '';
  progress = 0;

  ngOnInit(): void {
    const activeP = this.store.selectedProjectId();
    const visible = this.store.visibleProjects();
    this.projectId =
      activeP !== 'ALL' && visible.some(p => p.id === activeP)
        ? activeP
        : (visible[0]?.id || 'proj-1');

    const projMembers = this.getProjectMembers();
    const curId = this.store.currentUserId();
    this.assigneeIds = projMembers.some(m => m.id === curId)
      ? [curId]
      : (projMembers[0] ? [projMembers[0].id] : []);
  }

  onProjectChange(newProjectId: string): void {
    this.projectId = newProjectId;
    this.selectedDependencies = [];
    const projMembers = this.getProjectMembers();
    const validIds = new Set(projMembers.map(m => m.id));
    this.assigneeIds = this.assigneeIds.filter(id => validIds.has(id));
    if (this.assigneeIds.length === 0 && projMembers[0]) {
      this.assigneeIds = [projMembers[0].id];
    }
  }

  onStatusChange(newStatus: TaskStatus): void {
    this.status = newStatus;
    if (newStatus === 'TODO' && this.subtasks.length === 0) {
      this.progress = 0;
    }
  }

  getProjectMembers(): TeamMember[] {
    const proj = this.store.projectMap().get(this.projectId);
    const all = this.store.teamMembers();
    if (!proj || !Array.isArray(proj.memberIds) || proj.memberIds.length === 0) {
      return all;
    }
    const set = new Set(proj.memberIds);
    return all.filter(m => set.has(m.id));
  }

  getAvailablePrerequisites(): Task[] {
    return this.store.tasks().filter(t => t.projectId === this.projectId);
  }

  togglePrerequisite(taskId: string): void {
    const currentDuration = Math.max(1, diffCalendarDays(this.startDate, this.dueDate));

    if (this.selectedDependencies.includes(taskId)) {
      this.selectedDependencies = this.selectedDependencies.filter(id => id !== taskId);
    } else {
      this.selectedDependencies = [...this.selectedDependencies, taskId];
    }

    if (this.selectedDependencies.length > 0) {
      const scheduled = this.store.computeScheduleFromDependencies(
        this.selectedDependencies,
        this.startDate,
        addCalendarDays(this.startDate, currentDuration)
      );
      this.startDate = scheduled.startDate;
      // Preserve calendar duration if dueDate would fall before or on calculated startDate
      if (this.dueDate <= scheduled.startDate) {
        this.dueDate = addCalendarDays(scheduled.startDate, currentDuration);
      } else {
        this.dueDate = addCalendarDays(scheduled.startDate, currentDuration);
      }
    }
  }

  minAllowedStartDate(): string {
    if (this.selectedDependencies.length === 0) return '';
    const scheduled = this.store.computeScheduleFromDependencies(
      this.selectedDependencies,
      this.startDate,
      this.dueDate
    );
    return scheduled.startDate;
  }

  prerequisiteScheduleHelper(): string {
    if (this.selectedDependencies.length === 0) return '';
    return this.store.computeScheduleFromDependencies(
      this.selectedDependencies,
      this.startDate,
      this.dueDate
    ).helperText;
  }

  onStartDateChange(newStart: string): void {
    if (!newStart) return;
    const minStart = this.minAllowedStartDate();
    const effectiveStart = minStart && newStart < minStart ? minStart : newStart;
    const prevDuration = Math.max(1, diffCalendarDays(this.startDate, this.dueDate));
    this.startDate = effectiveStart;
    if (this.dueDate < effectiveStart) {
      this.dueDate = addCalendarDays(effectiveStart, prevDuration);
    }
  }

  onDueDateChange(newDue: string): void {
    if (!newDue) return;
    this.dueDate = newDue < this.startDate ? addCalendarDays(this.startDate, 1) : newDue;
  }

  calendarDurationDays(): number {
    return Math.max(1, diffCalendarDays(this.startDate, this.dueDate));
  }

  toggleAssignee(memberId: string): void {
    if (this.assigneeIds.includes(memberId)) {
      this.assigneeIds = this.assigneeIds.filter(id => id !== memberId);
    } else {
      this.assigneeIds = [...this.assigneeIds, memberId];
    }
  }

  addSubtaskItem(): void {
    const clean = this.newSubtaskText.trim();
    if (!clean) return;
    this.subtasks = [
      ...this.subtasks,
      {
        id: `st-new-${Date.now()}-${this.subtasks.length}`,
        taskId: '',
        title: clean,
        completed: false,
        createdAt: todayIsoDate()
      }
    ];
    this.newSubtaskText = '';
    this.recalculateProgressFromSubtasks();
  }

  toggleSubtaskItem(index: number): void {
    this.subtasks = this.subtasks.map((s, i) =>
      i === index ? { ...s, completed: !s.completed } : s
    );
    this.recalculateProgressFromSubtasks();
  }

  removeSubtaskItem(index: number): void {
    this.subtasks = this.subtasks.filter((_, i) => i !== index);
    this.recalculateProgressFromSubtasks();
  }

  completedSubtasksCount(): number {
    return this.subtasks.filter(s => s.completed).length;
  }

  private recalculateProgressFromSubtasks(): void {
    if (this.subtasks.length === 0) {
      this.progress = 0;
      return;
    }
    this.progress = Math.round((this.completedSubtasksCount() / this.subtasks.length) * 100);
  }

  submit(): void {
    if (!this.title.trim()) return;

    void this.store.createTask({
      projectId: this.projectId,
      title: this.title.trim(),
      description: this.description.trim(),
      status: this.status,
      priority: this.priority,
      effortPoints: Number(this.effortPoints) || 3,
      storyPoints: Number(this.effortPoints) || 3,
      progress: Number(this.progress) || 0,
      assigneeIds: this.assigneeIds,
      assigneeId: this.assigneeIds[0] || '',
      startDate: this.startDate,
      dueDate: this.dueDate,
      baselineDueDate: this.dueDate,
      dependencies: this.selectedDependencies,
      subtasks: this.subtasks
    });

    this.close.emit();
  }
}
