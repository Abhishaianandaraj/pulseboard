import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TaskStoreService } from '../../services/task-store.service';
import { Task, TaskStatus, ActivityLog } from '../../models/task.model';

@Component({
  selector: 'app-my-day',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="my-day-wrapper custom-scroll">
      <!-- 1. Warm Greeting & Personal Pace Health Card -->
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
                {{ store.currentUser().role }} [{{ store.currentUserRole() }}]
              </span>
            </div>
            <p class="hero-subtext">
              Here is your focused daily delivery queue across {{ store.currentUser().squad }}.
            </p>
          </div>

          <!-- Pace Health Box -->
          <div class="hero-pace-box">
            <div class="pace-status-row">
              <span class="pace-dot" [class.dot-optimal]="myLoadMetric().status === 'OPTIMAL'" [class.dot-near]="myLoadMetric().status === 'NEAR_CAPACITY'" [class.dot-over]="myLoadMetric().status === 'OVER_BUDGET'"></span>
              <strong class="pace-label">{{ myLoadMetric().label }}</strong>
              <span class="pace-info-bubble" [title]="myLoadMetric().activePoints + ' active story points + ' + (myLoadMetric().reworkCount * 3) + 'pt recovery buffer = ' + myLoadMetric().effectiveLoad + ' pts / ' + myLoadMetric().capacityBudget + ' budget'">
                ⓘ
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
      </section>

      <!-- 2. Main Two-Column Delivery Layout -->
      <div class="my-day-grid">
        <!-- LEFT COLUMN: My Active Deliverables -->
        <div class="my-day-col">
          <div class="section-card-header">
            <div class="card-title-group">
              <span class="section-icon">🎯</span>
              <h2 class="section-title">My Active Tasks</h2>
              <span class="section-count-badge">{{ myActiveTasks().length }}</span>
            </div>
            <button type="button" class="btn-jump-workspace" (click)="goToWorkspace()">
              Open Workspace →
            </button>
          </div>

          @if (myActiveTasks().length > 0) {
            <div class="tasks-flow-list">
              @for (task of myActiveTasks(); track task.id) {
                <div class="my-task-card" (click)="openTask(task.id)">
                  <div class="my-task-top">
                    <div class="my-task-id-row">
                      <span class="task-id font-mono">{{ task.id }}</span>
                      @if (getProject(task.projectId); as proj) {
                        <span class="proj-badge-mini" [style.color]="proj.color">{{ proj.code }}</span>
                      }
                      <span class="priority-mini" [attr.data-priority]="task.priority">{{ task.priority }}</span>
                      @if (task.blocked) {
                        <span class="blocked-badge-mini">Blocked</span>
                      }
                    </div>
                    <span class="effort-badge font-mono">{{ task.effortPoints }}p</span>
                  </div>

                  <strong class="my-task-title">{{ task.title }}</strong>

                  <div class="my-task-bottom">
                    <div class="task-meta-left">
                      <span class="task-due-date font-mono text-muted text-xs">Due {{ task.dueDate }}</span>
                      @if (task.subtasks.length > 0) {
                        <span class="checklist-badge text-xs">
                          ☑ {{ getCompletedSubtasks(task) }}/{{ task.subtasks.length }}
                        </span>
                      }
                    </div>

                    <!-- 1-Click Status Progression Action -->
                    <div class="task-action-wrap" (click)="$event.stopPropagation()">
                      @if (task.status === 'TODO') {
                        <button type="button" class="btn-progression btn-start" (click)="advanceStatus(task, 'IN_PROGRESS')">
                          ▶ Start Working
                        </button>
                      } @else if (task.status === 'IN_PROGRESS') {
                        <button type="button" class="btn-progression btn-deploy" (click)="advanceStatus(task, 'DEPLOYED')">
                          🚀 Deploy to Server
                        </button>
                      } @else if (task.status === 'DEPLOYED') {
                        @if (store.canSignOffDone()) {
                          <button type="button" class="btn-progression btn-done" (click)="advanceStatus(task, 'DONE')">
                            ✓ Verify &amp; Close
                          </button>
                        } @else {
                          <span class="waiting-lead-tag">⏳ Awaiting Lead Sign-Off</span>
                        }
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="empty-state-box">
              <span class="empty-icon">🎉</span>
              <strong>All caught up!</strong>
              <p>You have zero pending tasks on your active board. Head to the workspace to pick up new work.</p>
              <button type="button" class="btn-empty-action" (click)="goToWorkspace()">Explore Workspace</button>
            </div>
          }
        </div>

        <!-- RIGHT COLUMN: Needs Attention & Project Pulse -->
        <div class="my-day-col">
          <!-- Attention / Review Queue -->
          <div class="attention-card">
            <div class="section-card-header">
              <div class="card-title-group">
                <span class="section-icon">⚠️</span>
                <h2 class="section-title">Needs My Attention</h2>
                <span class="section-count-badge attention-badge">{{ attentionItems().length }}</span>
              </div>
            </div>

            @if (attentionItems().length > 0) {
              <div class="attention-list">
                @for (item of attentionItems(); track item.id) {
                  <div class="attention-item" (click)="openTask(item.id)">
                    <div class="attention-item-top">
                      <span class="font-mono text-muted text-xs">{{ item.id }}</span>
                      <span class="attention-tag" [class.tag-deployed]="item.status === 'DEPLOYED'" [class.tag-blocked]="item.blocked">
                        {{ item.status === 'DEPLOYED' ? 'Ready for Lead Check' : (item.blocked ? 'Blocked' : 'Needs Changes') }}
                      </span>
                    </div>
                    <strong class="attention-title">{{ item.title }}</strong>
                    <div class="attention-footer text-xs">
                      <span class="text-secondary">{{ getMemberName(item.assigneeId) }}</span>
                      <span class="font-mono text-muted">Due {{ item.dueDate }}</span>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="calm-box">
                <span>✨ No urgent blockers or pending reviews requiring your action.</span>
              </div>
            }
          </div>

          <!-- Recent Project Pulse / Activity Log -->
          <div class="pulse-feed-card">
            <div class="section-card-header">
              <div class="card-title-group">
                <span class="section-icon">⚡</span>
                <h2 class="section-title">Recent Project Pulse</h2>
              </div>
            </div>

            <div class="activity-feed-list custom-scroll">
              @for (log of recentLogs(); track log.id) {
                <div class="activity-feed-item">
                  <span class="feed-avatar" style="background: var(--color-primary)">{{ log.actorAvatar }}</span>
                  <div class="feed-content">
                    <div class="feed-top-row">
                      <strong class="feed-actor">{{ log.actor }}</strong>
                      <span class="feed-time font-mono">{{ log.timestamp }}</span>
                    </div>
                    <p class="feed-detail">{{ log.details }}</p>
                  </div>
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
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      height: 100%;
      overflow-y: auto;
    }

    .personal-hero-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
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
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
    }

    .hero-text-col {
      flex: 1;
      min-width: 240px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .hero-name-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .hero-greeting {
      font-size: 20px;
      font-weight: 800;
      color: var(--text-primary);
      margin: 0;
      letter-spacing: -0.01em;
    }

    .hero-role-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
    }

    .hero-role-pill[data-role="LEAD"], .hero-role-pill[data-role="ADMIN"] {
      color: #059669;
      border-color: #10b981;
      background: rgba(16, 185, 129, 0.1);
    }

    .hero-subtext {
      font-size: 13px;
      color: var(--text-secondary);
      margin: 0;
    }

    .hero-pace-box {
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 220px;
    }

    .pace-status-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pace-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .dot-optimal { background: #10b981; }
    .dot-near { background: #f59e0b; }
    .dot-over { background: #ef4444; }

    .pace-label {
      font-size: 12px;
      color: var(--text-primary);
      flex: 1;
    }

    .pace-info-bubble {
      font-size: 11px;
      color: var(--text-muted);
      cursor: help;
    }

    .pace-track-mini {
      height: 6px;
      background: var(--bg-elevated);
      border-radius: 3px;
      overflow: hidden;
    }

    .pace-fill-mini {
      height: 100%;
      border-radius: 3px;
      transition: width 0.2s ease;
    }

    .fill-optimal { background: #10b981; }
    .fill-near { background: #f59e0b; }
    .fill-over { background: #ef4444; }

    .pace-caption {
      font-size: 10px;
      color: var(--text-muted);
    }

    .my-day-grid {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 20px;
    }

    @media (max-width: 960px) {
      .my-day-grid {
        grid-template-columns: 1fr;
      }
    }

    .my-day-col {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .section-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .card-title-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-icon {
      font-size: 16px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .section-count-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 10px;
      background: var(--bg-elevated);
      color: var(--text-secondary);
      border: 1px solid var(--border-subtle);
    }

    .attention-badge {
      background: rgba(245, 158, 11, 0.15);
      border-color: #f59e0b;
      color: #d97706;
    }

    .btn-jump-workspace {
      font-size: 12px;
      font-weight: 600;
      color: var(--color-primary);
      background: transparent;
      border: none;
      cursor: pointer;
      transition: color 0.1s ease;
    }

    .btn-jump-workspace:hover {
      text-decoration: underline;
    }

    .tasks-flow-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .my-task-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 14px 16px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 8px;
      box-shadow: var(--shadow-sm);
      transition: all 0.12s ease;
    }

    .my-task-card:hover {
      border-color: var(--color-primary);
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }

    .my-task-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .my-task-id-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .task-id {
      font-size: 11px;
      color: var(--text-muted);
    }

    .proj-badge-mini {
      font-size: 10.5px;
      font-weight: 700;
      font-family: var(--font-mono);
    }

    .priority-mini {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 3px;
      background: var(--badge-medium-bg);
      color: var(--badge-medium-text);
    }

    .priority-mini[data-priority="CRITICAL"] {
      background: var(--badge-critical-bg);
      color: var(--badge-critical-text);
    }

    .blocked-badge-mini {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 3px;
      background: rgba(239, 68, 68, 0.15);
      color: #dc2626;
    }

    .effort-badge {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 600;
    }

    .my-task-title {
      font-size: 13.5px;
      color: var(--text-primary);
      line-height: 1.4;
    }

    .my-task-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 4px;
    }

    .task-meta-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-progression {
      padding: 5px 10px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: background-color 0.15s ease;
    }

    .btn-start {
      background: var(--color-primary);
      color: #ffffff;
    }

    .btn-deploy {
      background: #7c3aed;
      color: #ffffff;
    }

    .btn-done {
      background: #10b981;
      color: #ffffff;
    }

    .waiting-lead-tag {
      font-size: 11px;
      color: #7c3aed;
      font-weight: 600;
      background: rgba(124, 58, 237, 0.1);
      padding: 3px 8px;
      border-radius: 4px;
    }

    .empty-state-box {
      background: var(--bg-surface);
      border: 1px dashed var(--border-subtle);
      border-radius: 8px;
      padding: 32px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .empty-icon {
      font-size: 28px;
    }

    .empty-state-box strong {
      font-size: 14px;
      color: var(--text-primary);
    }

    .empty-state-box p {
      font-size: 12px;
      color: var(--text-secondary);
      max-width: 280px;
      margin: 0;
    }

    .btn-empty-action {
      margin-top: 8px;
      padding: 6px 14px;
      border-radius: 6px;
      background: var(--color-primary);
      color: #ffffff;
      border: none;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .attention-card, .pulse-feed-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 16px 18px;
    }

    .attention-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .attention-item {
      padding: 8px 10px;
      border-radius: 6px;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 3px;
      transition: background-color 0.1s ease;
    }

    .attention-item:hover {
      background: var(--bg-elevated);
    }

    .attention-item-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .attention-tag {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 3px;
    }

    .tag-deployed {
      background: rgba(124, 58, 237, 0.15);
      color: #7c3aed;
    }

    .tag-blocked {
      background: rgba(239, 68, 68, 0.15);
      color: #dc2626;
    }

    .attention-title {
      font-size: 12.5px;
      color: var(--text-primary);
    }

    .attention-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: var(--text-secondary);
    }

    .calm-box {
      padding: 12px;
      border-radius: 6px;
      background: var(--bg-canvas);
      font-size: 12px;
      color: var(--text-secondary);
      text-align: center;
    }

    .activity-feed-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 320px;
      overflow-y: auto;
      padding-right: 4px;
    }

    .activity-feed-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }

    .feed-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      color: #ffffff;
      font-size: 9.5px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 2px;
    }

    .feed-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .feed-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .feed-actor {
      font-size: 12px;
      color: var(--text-primary);
    }

    .feed-time {
      font-size: 10.5px;
      color: var(--text-muted);
    }

    .feed-detail {
      font-size: 11.5px;
      color: var(--text-secondary);
      margin: 0;
      line-height: 1.4;
    }
  `]
})
export class MyDayComponent {
  protected readonly store = inject(TaskStoreService);
  private readonly router = inject(Router);
  protected readonly Math = Math;

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

  readonly myActiveTasks = computed(() => {
    const curId = this.store.currentUserId();
    return this.store.tasks().filter(t => t.assigneeId === curId && t.status !== 'DONE');
  });

  readonly attentionItems = computed(() => {
    const curUser = this.store.currentUser();
    const tasks = this.store.tasks();

    if (curUser.systemRole === 'LEAD' || curUser.systemRole === 'ADMIN') {
      return tasks.filter(t => t.status === 'DEPLOYED');
    }
    if (curUser.systemRole === 'QA') {
      return tasks.filter(t => t.status === 'DEPLOYED' || (t.blocked && t.status !== 'DONE'));
    }
    return tasks.filter(t => t.assigneeId === curUser.id && (t.blocked || (t.reworkCount > 0 && t.status !== 'DONE')));
  });

  readonly recentLogs = computed(() => {
    return this.store.activityLogs().slice(0, 8);
  });

  getProject(projectId: string) {
    return this.store.projectMap().get(projectId);
  }

  getMemberName(memberId: string): string {
    return this.store.assigneeMap().get(memberId)?.name || 'Team';
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
