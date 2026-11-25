import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TaskStoreService, formatShortDate } from '../../services/task-store.service';
import { Task, TaskStatus } from '../../models/task.model';

@Component({
  selector: 'app-my-day',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="my-day-wrapper custom-scroll">
      <!-- 1. Executive Personal & Workload Summary Card -->
      <section class="personal-hero-card">
        <div class="hero-header-row">
          <div class="hero-avatar-col">
            <span class="user-hero-avatar" [style.background-color]="store.currentUser().color">
              {{ store.currentUser().avatar }}
            </span>
          </div>

          <div class="hero-text-col">
            <div class="hero-name-row">
              <h1 class="hero-greeting">{{ greeting() }}, {{ store.currentUser().name.split(' ')[0] }}</h1>
              <span class="hero-role-pill" [attr.data-role]="store.currentUserRole()">
                {{ store.currentUser().role }} · {{ store.getMemberAccessRole(store.currentUser()) }}
              </span>
            </div>

            <!-- Inline Daily Objective -->
            <div class="daily-intention-row">
              <span class="intention-icon">
                <i class="ph-light ph-target"></i>
              </span>
              <input
                type="text"
                class="intention-input"
                [ngModel]="dailyIntention()"
                (ngModelChange)="updateIntention($event)"
                placeholder="Set daily priority or sprint focus..."
                title="Click to edit your daily priority note"
              />
            </div>
          </div>

          <!-- Triage Action + Completion Ring & Workload Box -->
          <div class="hero-stats-group">
            <!-- Prominent Due Soon Filter Button for Weekly Follow-Up -->
            <button
              type="button"
              class="btn-due-soon-hero"
              [class.active]="store.filterDueSoon()"
              (click)="toggleDueSoon()"
              title="Filter tasks due within the next 3 days or overdue (not Completed)"
            >
              <i class="ph-light ph-calendar-check"></i>
              <span>Due Soon</span>
              <span class="due-count-pill font-mono" [class.has-urgent]="store.dueSoonCount() > 0">
                {{ store.dueSoonCount() }}
              </span>
            </button>

            <!-- Circular Completion Ring -->
            <div class="completion-ring-box" title="{{ myCompletedToday() }} of {{ myTotalTasks() }} assigned tasks Completed">
              <svg class="ring-svg" width="46" height="46" viewBox="0 0 46 46">
                <circle class="ring-track" cx="23" cy="23" r="18" fill="none" stroke-width="3.5"></circle>
                <circle
                  class="ring-progress"
                  cx="23"
                  cy="23"
                  r="18"
                  fill="none"
                  stroke-width="3.5"
                  stroke-dasharray="113.097"
                  [attr.stroke-dashoffset]="113.097 - (113.097 * completionPercent()) / 100"
                ></circle>
              </svg>
              <span class="ring-label font-mono">{{ completionPercent() }}%</span>
            </div>

            <!-- Workload Health Box -->
            <div class="hero-pace-box">
              <div class="pace-status-row">
                <span class="pace-dot" [class.dot-optimal]="myLoadMetric().status === 'OPTIMAL'" [class.dot-near]="myLoadMetric().status === 'NEAR_CAPACITY'" [class.dot-over]="myLoadMetric().status === 'OVER_BUDGET'"></span>
                <strong class="pace-label">{{ myLoadMetric().label }}</strong>
                <span class="pace-info-bubble" [title]="myLoadMetric().activePoints + ' active effort points + ' + (myLoadMetric().reworkCount * 3) + 'pt rework overhead = ' + myLoadMetric().effectiveLoad + ' / ' + myLoadMetric().capacityBudget + ' pts'">
                  <i class="ph-light ph-info"></i>
                </span>
              </div>
              <div class="pace-track-mini">
                <div
                  class="pace-fill-mini"
                  [class.fill-optimal]="myLoadMetric().status === 'OPTIMAL'"
                  [class.fill-near]="myLoadMetric().status === 'NEAR_CAPACITY'"
                  [class.fill-over]="myLoadMetric().status === 'OVER_BUDGET'"
                  [style.width.%]="Math.min(100, (myLoadMetric().effectiveLoad / myLoadMetric().capacityBudget) * 100)"
                ></div>
              </div>
              <span class="pace-caption font-mono">
                {{ myLoadMetric().effectiveLoad }} of {{ myLoadMetric().capacityBudget }} pts allocated
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. Main Two-Column Delivery Layout -->
      <div class="my-day-grid">
        <!-- LEFT COLUMN: Active Deliverables / Due Soon Weekly Follow-Up Triage -->
        <div class="my-day-col">
          <div class="clean-surface-box">
            <div class="section-card-header">
              <div class="card-title-group">
                <span class="section-icon" [class.warn-icon]="store.filterDueSoon()">
                  <i class="ph-light" [ngClass]="store.filterDueSoon() ? 'ph-calendar-check' : 'ph-list-checks'"></i>
                </span>
                <h2 class="section-title">
                  {{ store.filterDueSoon() ? 'Due Soon · Weekly Follow-Up Triage' : 'My Active Tasks' }}
                </h2>
                <span class="section-count-badge">{{ displayedTasks().length }}</span>
              </div>
              <div class="card-actions-group">
                @if (store.filterDueSoon()) {
                  <button type="button" class="btn-clear-due-filter" (click)="store.filterDueSoon.set(false)">
                    Show My Tasks
                  </button>
                }
                <button type="button" class="btn-jump-workspace" (click)="goToWorkspace()">
                  <span>Open Workspace</span>
                  <i class="ph-light ph-arrow-right"></i>
                </button>
              </div>
            </div>

            @if (displayedTasks().length > 0) {
              <div class="open-air-task-list">
                @for (task of displayedTasks(); track task.id) {
                  <div class="open-air-row" [class.row-blocked]="task.blocked" (click)="openTask(task.id)">
                    <div class="row-main">
                      <div class="row-top-meta">
                        <span class="task-id font-mono">{{ task.id }}</span>
                        @if (getProject(task.projectId); as proj) {
                          <span class="proj-badge-mini" [style.color]="proj.color">{{ proj.code }}</span>
                        }
                        <span class="status-chip-mini" [attr.data-status]="task.status">
                          {{ store.getStatusLabel(task.status) }}
                        </span>
                        <span class="priority-mini" [attr.data-priority]="task.priority">{{ task.priority }}</span>
                        @if (task.blocked) {
                          <span class="blocked-badge-mini">
                            <i class="ph-light ph-warning"></i> Blocked
                          </span>
                        }
                        <span class="effort-badge font-mono">{{ task.effortPoints }} pts</span>
                      </div>

                      <strong class="row-title">{{ task.title }}</strong>

                      @if (task.blocked && task.blockerReason) {
                        <div class="row-blocker-reason">
                          <i class="ph-light ph-warning-circle"></i>
                          <span><strong>Blocker:</strong> {{ task.blockerReason }}</span>
                        </div>
                      }

                      <!-- Progress Bar + Due Date + Assigned Owners -->
                      <div class="row-progress-strip">
                        <div class="row-progress-bar">
                          <div
                            class="row-progress-fill"
                            [style.width.%]="task.progress"
                            [class.fill-blocked]="task.blocked"
                          ></div>
                        </div>
                        <span class="row-progress-pct font-mono">{{ task.progress }}%</span>
                      </div>

                      <div class="row-bottom-meta">
                        <span
                          class="task-due-date font-mono"
                          [class.due-soon]="store.isTaskDueSoon(task)"
                          [class.overdue]="store.isTaskOverdue(task)"
                        >
                          <i class="ph-light ph-calendar-blank"></i>
                          {{ getDueSummary(task) }} ({{ formatDateShort(task.dueDate) }})
                        </span>
                        @if (task.subtasks.length > 0) {
                          <span class="checklist-badge font-mono">
                            <i class="ph-light ph-check-square"></i> {{ getCompletedSubtasks(task) }}/{{ task.subtasks.length }}
                          </span>
                        }
                        <div class="owners-inline">
                          <div class="avatar-stack">
                            @for (m of store.getTaskMembers(task); track m.id) {
                              <span class="avatar-stack-item" [style.background-color]="m.color" [title]="m.name">{{ m.avatar }}</span>
                            }
                          </div>
                          <span class="owners-names">{{ getOwnersSummary(task) }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- 1-Click Status Progression -->
                    <div class="row-action-wrap" (click)="$event.stopPropagation()">
                      @if (store.canEditTask(task)) {
                        @if (task.status === 'TODO') {
                          <button type="button" class="btn-progression btn-start" (click)="advanceStatus(task, 'IN_PROGRESS')">
                            <i class="ph-light ph-play"></i>
                            <span>Start Task</span>
                          </button>
                        } @else if (task.status === 'IN_PROGRESS') {
                          <button type="button" class="btn-progression btn-deploy" (click)="advanceStatus(task, 'DEPLOYED')">
                            <i class="ph-light ph-clipboard-text"></i>
                            <span>Submit Review</span>
                          </button>
                        } @else if (task.status === 'DEPLOYED') {
                          @if (store.canSignOffDone()) {
                            <button type="button" class="btn-progression btn-done" (click)="advanceStatus(task, 'DONE')">
                              <i class="ph-light ph-check"></i>
                              <span>Approve</span>
                            </button>
                          } @else {
                            <span class="waiting-lead-tag">
                              <i class="ph-light ph-clock"></i> Under Review
                            </span>
                          }
                        }
                      }
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-state-box">
                <span class="empty-icon"><i class="ph-light ph-check-circle"></i></span>
                <strong>{{ store.filterDueSoon() ? 'No Urgent Deadlines' : 'All Assigned Tasks Completed' }}</strong>
                <p>
                  {{ store.filterDueSoon()
                    ? 'Zero open tasks are due within the next 3 days or overdue.'
                    : 'You have no open tasks assigned. Create a task or inspect the Workspace board.' }}
                </p>
                <button type="button" class="btn-empty-action" (click)="goToWorkspace()">Open Workspace</button>
              </div>
            }
          </div>
        </div>

        <!-- RIGHT COLUMN: Needs Attention & Activity Log -->
        <div class="my-day-col">
          <!-- Review & Blocker Queue -->
          <div class="clean-surface-box">
            <div class="section-card-header">
              <div class="card-title-group">
                <span class="section-icon attention-icon-wrap">
                  <i class="ph-light ph-warning-circle"></i>
                </span>
                <h2 class="section-title">Needs Attention</h2>
                <span class="section-count-badge attention-badge">{{ attentionItems().length }}</span>
              </div>
            </div>

            @if (attentionItems().length > 0) {
              <div class="open-air-task-list">
                @for (item of attentionItems(); track item.id) {
                  <div class="open-air-row attention-row" (click)="openTask(item.id)">
                    <div class="row-main">
                      <div class="row-top-meta">
                        <span class="font-mono text-muted text-xs">{{ item.id }}</span>
                        <span class="attention-tag" [class.tag-deployed]="item.status === 'DEPLOYED'" [class.tag-blocked]="item.blocked">
                          {{ item.status === 'DEPLOYED' ? 'Under Review · Sign-Off' : (item.blocked ? 'Blocked' : 'Rework Active') }}
                        </span>
                        <span class="font-mono text-xs text-muted">{{ item.progress }}%</span>
                      </div>
                      <strong class="row-title">{{ item.title }}</strong>
                      <div class="row-bottom-meta">
                        <span class="text-secondary text-xs">{{ getOwnersSummary(item) }}</span>
                        <span class="font-mono text-muted text-xs">Due {{ formatDateShort(item.dueDate) }}</span>
                      </div>
                    </div>
                    <span class="row-nav-arrow">
                      <i class="ph-light ph-arrow-right"></i>
                    </span>
                  </div>
                }
              </div>
            } @else {
              <div class="calm-box">
                <i class="ph-light ph-check-circle"></i>
                <span>No blocked tasks or pending reviews requiring action.</span>
              </div>
            }
          </div>

          <!-- Activity Log -->
          <div class="clean-surface-box">
            <div class="section-card-header">
              <div class="card-title-group">
                <span class="section-icon">
                  <i class="ph-light ph-clock-counter-clockwise"></i>
                </span>
                <h2 class="section-title">Activity Log</h2>
              </div>
              @if (store.canCurrentUserViewAllLogs()) {
                <span class="pulse-scope-badge scope-portfolio font-mono" title="Lead & Manager Access: Full workspace events visible">
                  <i class="ph-light ph-shield-check"></i> All Team Logs
                </span>
              } @else {
                <span class="pulse-scope-badge scope-personal font-mono" title="Personal Scope: Showing events where you are actor or owner">
                  <i class="ph-light ph-user"></i> Personal Logs
                </span>
              }
            </div>

            <div class="activity-feed-list custom-scroll">
              @for (log of recentLogs(); track log.id) {
                <div class="activity-feed-item">
                  <span class="feed-avatar">{{ log.actorAvatar }}</span>
                  <div class="feed-content">
                    <div class="feed-top-row">
                      <strong class="feed-actor">{{ log.actor }}</strong>
                      <span class="feed-time font-mono">{{ log.timestamp }}</span>
                    </div>
                    <p class="feed-detail">{{ log.details }}</p>
                  </div>
                </div>
              } @empty {
                <div class="calm-box">
                  <span>No recent activity logged yet.</span>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .my-day-wrapper {
      padding: 20px 24px 40px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      min-height: 100%;
    }

    .personal-hero-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      padding: 20px 24px;
      box-shadow: var(--shadow-sm);
    }

    .hero-header-row {
      display: flex;
      align-items: center;
      gap: 18px;
      flex-wrap: wrap;
    }

    .user-hero-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      color: #ffffff;
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .hero-text-col {
      flex: 1;
      min-width: 240px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .hero-name-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .hero-greeting {
      font-size: 21px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
      letter-spacing: -0.02em;
    }

    .hero-role-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 9px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
    }

    .daily-intention-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .intention-icon {
      color: var(--accent-primary);
      font-size: 14px;
      display: flex;
    }

    .intention-input {
      font-size: 13px;
      color: var(--text-secondary);
      background: transparent;
      border: none;
      outline: none;
      width: 100%;
      border-bottom: 1px dashed transparent;
      padding: 2px 0;
    }

    .intention-input:hover, .intention-input:focus {
      color: var(--text-primary);
      border-bottom-color: var(--accent-primary);
    }

    .hero-stats-group {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }

    .btn-due-soon-hero {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 8px 14px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      color: var(--text-primary);
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition-tactile);
    }

    .btn-due-soon-hero:hover {
      border-color: var(--accent-warn);
    }

    .btn-due-soon-hero.active {
      background: var(--accent-warn-tint);
      border-color: var(--accent-warn);
      color: var(--accent-warn);
    }

    .due-count-pill {
      padding: 1px 7px;
      border-radius: var(--radius-pill);
      font-size: 11px;
      font-weight: 700;
      background: var(--bg-surface);
      color: var(--text-secondary);
    }

    .due-count-pill.has-urgent {
      background: var(--accent-warn);
      color: #fff;
    }

    .completion-ring-box {
      position: relative;
      width: 46px;
      height: 46px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ring-svg { transform: rotate(-90deg); }
    .ring-track { stroke: var(--border-hairline); }
    .ring-progress {
      stroke: var(--accent-primary);
      stroke-linecap: round;
      transition: stroke-dashoffset 0.35s ease;
    }

    .ring-label {
      position: absolute;
      font-size: 10px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .hero-pace-box {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-width: 185px;
      padding: 9px 13px;
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-inner);
    }

    .pace-status-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .pace-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
    }
    .dot-optimal { background: var(--status-done); }
    .dot-near { background: var(--accent-warn); }
    .dot-over { background: var(--accent-danger); }

    .pace-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .pace-info-bubble {
      font-size: 12px;
      color: var(--text-muted);
      cursor: help;
      margin-left: auto;
    }

    .pace-track-mini {
      height: 5px;
      background: var(--border-hairline);
      border-radius: var(--radius-pill);
      overflow: hidden;
    }

    .pace-fill-mini {
      height: 100%;
      border-radius: var(--radius-pill);
    }
    .fill-optimal { background: var(--status-done); }
    .fill-near { background: var(--accent-warn); }
    .fill-over { background: var(--accent-danger); }

    .pace-caption {
      font-size: 10px;
      color: var(--text-muted);
    }

    /* 2. Grid Layout */
    .my-day-grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 20px;
      align-items: start;
    }

    @media (max-width: 960px) {
      .my-day-grid {
        grid-template-columns: 1fr;
      }
    }

    .my-day-col {
      display: flex;
      flex-direction: column;
      gap: 18px;
      min-width: 0;
    }

    .clean-surface-box {
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
    }

    .section-card-header {
      padding: 14px 18px;
      border-bottom: 1px solid var(--border-hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .card-title-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-icon {
      font-size: 16px;
      color: var(--accent-primary);
      display: flex;
      align-items: center;
    }
    .section-icon.warn-icon, .attention-icon-wrap {
      color: var(--accent-warn);
    }

    .section-title {
      font-size: 14.5px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .section-count-badge {
      font-size: 10.5px;
      font-family: var(--font-mono);
      font-weight: 700;
      padding: 1px 7px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
    }

    .attention-badge {
      background: var(--accent-warn-tint);
      color: var(--accent-warn);
    }

    .card-actions-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-clear-due-filter, .btn-jump-workspace {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 11px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-jump-workspace:hover, .btn-clear-due-filter:hover {
      color: var(--accent-primary);
      border-color: var(--accent-primary);
    }

    .pulse-scope-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 9px;
      border-radius: var(--radius-pill);
      font-size: 10.5px;
      font-weight: 600;
      background: var(--bg-subtle);
      color: var(--text-secondary);
      border: 1px solid var(--border-hairline);
    }

    .pulse-scope-badge.scope-portfolio {
      background: var(--accent-primary-tint);
      color: var(--accent-primary);
    }

    .open-air-task-list {
      display: flex;
      flex-direction: column;
    }

    .open-air-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--border-hairline);
      cursor: pointer;
      transition: background 0.14s ease;
    }
    .open-air-row:last-child { border-bottom: none; }
    .open-air-row:hover { background: var(--bg-subtle); }
    .open-air-row.row-blocked { border-left: 3px solid var(--accent-danger); }

    .row-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    .row-top-meta {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 11px;
      flex-wrap: wrap;
    }

    .task-id {
      color: var(--text-muted);
      font-weight: 700;
    }

    .proj-badge-mini {
      font-weight: 700;
      font-size: 10px;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
    }

    .status-chip-mini {
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      color: var(--text-secondary);
    }
    .status-chip-mini[data-status="IN_PROGRESS"] { background: var(--accent-primary-tint); color: var(--accent-primary); }
    .status-chip-mini[data-status="DEPLOYED"] { background: var(--status-deployed-bg); color: var(--status-deployed-text); }

    .priority-mini {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--bg-subtle);
      color: var(--text-secondary);
    }
    .priority-mini[data-priority="CRITICAL"] { background: var(--badge-critical-bg); color: var(--badge-critical-text); }
    .priority-mini[data-priority="HIGH"] { background: var(--badge-high-bg); color: var(--badge-high-text); }

    .blocked-badge-mini {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--status-blocked-bg);
      color: var(--status-blocked-text);
    }

    .effort-badge {
      font-size: 10.5px;
      font-weight: 700;
      color: var(--text-muted);
      background: var(--bg-subtle);
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      margin-left: auto;
    }

    .row-title {
      font-size: 13.5px;
      font-weight: 600;
      color: var(--text-primary);
      line-height: 1.35;
    }

    .row-blocker-reason {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11.5px;
      color: var(--status-blocked-text);
      background: var(--status-blocked-bg);
      padding: 4px 8px;
      border-radius: 4px;
    }

    .row-progress-strip {
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: 280px;
    }

    .row-progress-bar {
      flex: 1;
      height: 6px;
      border-radius: 999px;
      background: var(--bg-subtle);
      overflow: hidden;
    }

    .row-progress-fill {
      height: 100%;
      background: var(--accent-primary);
      border-radius: 999px;
    }
    .row-progress-fill.fill-blocked { background: var(--accent-danger); }

    .row-progress-pct {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-secondary);
    }

    .row-bottom-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 11px;
      flex-wrap: wrap;
    }

    .task-due-date, .checklist-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--text-muted);
    }

    .task-due-date.due-soon {
      color: var(--accent-warn);
      font-weight: 700;
    }

    .task-due-date.overdue {
      color: var(--accent-danger);
      font-weight: 700;
    }

    .owners-inline {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: auto;
    }

    .owners-names {
      font-size: 11px;
      color: var(--text-secondary);
      font-weight: 500;
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
      margin-left: -4px;
    }
    .avatar-stack-item:first-child { margin-left: 0; }

    .row-action-wrap {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }

    .btn-progression {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 12px;
      border-radius: var(--radius-pill);
      font-size: 11.5px;
      font-weight: 600;
      border: 1px solid transparent;
      cursor: pointer;
      white-space: nowrap;
    }

    .btn-start {
      background: var(--accent-primary-tint);
      color: var(--accent-primary);
      border-color: var(--border-subtle);
    }
    .btn-start:hover { background: var(--accent-primary); color: #fff; }

    .btn-deploy {
      background: var(--status-deployed-bg);
      color: var(--status-deployed-text);
    }
    .btn-deploy:hover { background: var(--status-deployed); color: #fff; }

    .btn-done {
      background: var(--status-done-bg);
      color: var(--status-done-text);
    }
    .btn-done:hover { background: var(--status-done); color: #fff; }

    .waiting-lead-tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 600;
      color: var(--status-deployed-text);
      background: var(--status-deployed-bg);
      padding: 4px 10px;
      border-radius: var(--radius-pill);
    }

    .attention-tag {
      font-size: 10px;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      color: var(--text-secondary);
    }
    .tag-deployed { background: var(--status-deployed-bg); color: var(--status-deployed-text); }
    .tag-blocked { background: var(--status-blocked-bg); color: var(--status-blocked-text); }

    .row-nav-arrow {
      color: var(--text-muted);
      font-size: 14px;
    }

    .calm-box {
      padding: 22px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-muted);
      font-size: 12.5px;
      justify-content: center;
    }

    .activity-feed-list {
      max-height: 58vh;
      overflow-y: auto;
    }

    .activity-feed-item {
      display: flex;
      gap: 10px;
      padding: 12px 18px;
      border-bottom: 1px solid var(--border-hairline);
    }
    .activity-feed-item:last-child {
      border-bottom: none;
      padding-bottom: 20px;
    }

    .feed-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--accent-primary);
      color: #ffffff;
      font-size: 9px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .feed-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .feed-top-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
    }

    .feed-actor {
      font-size: 12px;
      color: var(--text-primary);
    }

    .feed-time {
      font-size: 10px;
      color: var(--text-muted);
      white-space: nowrap;
    }

    .feed-detail {
      font-size: 11.5px;
      color: var(--text-secondary);
      line-height: 1.4;
      margin: 0;
    }

    .empty-state-box {
      padding: 36px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: var(--text-secondary);
      font-size: 12.5px;
    }

    .empty-icon {
      font-size: 28px;
      color: var(--status-done);
    }

    .btn-empty-action {
      margin-top: 6px;
      padding: 7px 16px;
      border-radius: var(--radius-pill);
      background: var(--accent-primary);
      color: #ffffff;
      border: none;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .text-xs { font-size: 11px; }
    .text-muted { color: var(--text-muted); }
    .text-secondary { color: var(--text-secondary); }
  `]
})
export class MyDayComponent {
  protected readonly store = inject(TaskStoreService);
  private readonly router = inject(Router);
  protected readonly Math = Math;

  readonly dailyIntention = signal<string>(
    localStorage.getItem('tcs_ai_daily_focus') || 'Complete RAG chunking benchmark & review weekly follow-up items'
  );

  updateIntention(val: string): void {
    this.dailyIntention.set(val);
    localStorage.setItem('tcs_ai_daily_focus', val);
  }

  toggleDueSoon(): void {
    this.store.filterDueSoon.update(v => !v);
  }

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  });

  readonly myLoadMetric = computed(() => {
    const curId = this.store.currentUserId();
    return this.store.getMemberLoadMetric(curId);
  });

  readonly myTotalTasks = computed(() => {
    const curId = this.store.currentUserId();
    return this.store.tasks().filter((t: Task) => {
      const assignees = (t.assigneeIds && t.assigneeIds.length > 0)
        ? t.assigneeIds
        : (t.assigneeId ? [t.assigneeId] : []);
      return assignees.includes(curId);
    }).length;
  });

  readonly myCompletedToday = computed(() => {
    const curId = this.store.currentUserId();
    return this.store.tasks().filter((t: Task) => {
      const assignees = (t.assigneeIds && t.assigneeIds.length > 0)
        ? t.assigneeIds
        : (t.assigneeId ? [t.assigneeId] : []);
      return assignees.includes(curId) && t.status === 'DONE';
    }).length;
  });

  readonly completionPercent = computed(() => {
    const total = this.myTotalTasks();
    if (total === 0) return 100;
    return Math.round((this.myCompletedToday() / total) * 100);
  });

  readonly myActiveTasks = computed(() => {
    const curId = this.store.currentUserId();
    const visibleProjIds = new Set(this.store.visibleProjects().map(p => p.id));
    return this.store.tasks().filter((t: Task) => {
      if (!visibleProjIds.has(t.projectId)) return false;
      const assignees = (t.assigneeIds && t.assigneeIds.length > 0)
        ? t.assigneeIds
        : (t.assigneeId ? [t.assigneeId] : []);
      return assignees.includes(curId) && t.status !== 'DONE';
    });
  });

  readonly displayedTasks = computed(() => {
    if (this.store.filterDueSoon()) {
      return this.store.dueSoonTasks();
    }
    return this.myActiveTasks();
  });

  readonly attentionItems = computed(() => {
    const curUser = this.store.currentUser();
    const visibleProjIds = new Set(this.store.visibleProjects().map(p => p.id));
    const tasks = this.store.tasks().filter(t => visibleProjIds.has(t.projectId));

    if (curUser.systemRole === 'LEAD' || curUser.systemRole === 'ADMIN') {
      return tasks.filter(t => t.status === 'DEPLOYED' || (t.blocked && t.status !== 'DONE'));
    }
    if (curUser.systemRole === 'QA') {
      return tasks.filter(t => t.status === 'DEPLOYED' || (t.blocked && t.status !== 'DONE'));
    }
    return tasks.filter(t => {
      const assignees = (t.assigneeIds && t.assigneeIds.length > 0)
        ? t.assigneeIds
        : (t.assigneeId ? [t.assigneeId] : []);
      return assignees.includes(curUser.id) && (t.blocked || (t.reworkCount > 0 && t.status !== 'DONE'));
    });
  });

  readonly recentLogs = computed(() => {
    return this.store.visibleActivityLogs();
  });

  getProject(projectId: string) {
    return this.store.projectMap().get(projectId);
  }

  getOwnersSummary(task: Task): string {
    const members = this.store.getTaskMembers(task);
    if (members.length === 0) return 'Unassigned';
    return members.map(m => m.name).join(', ');
  }

  formatDateShort(iso: string): string {
    return formatShortDate(iso);
  }

  getDueSummary(task: Task): string {
    const days = this.store.getDaysUntilDue(task);
    if (days < 0) return `Overdue ${Math.abs(days)}d`;
    if (days === 0) return 'Due Today';
    if (days === 1) return 'Due Tomorrow';
    return `Due in ${days}d`;
  }

  getCompletedSubtasks(task: Task): number {
    return (task.subtasks || []).filter(st => st.completed).length;
  }

  advanceStatus(task: Task, nextStatus: TaskStatus): void {
    this.store.updateTaskStatus(task.id, nextStatus);
  }

  openTask(taskId: string): void {
    this.store.selectTask(taskId);
  }

  goToWorkspace(): void {
    this.router.navigate(['/workspace']);
  }
}
