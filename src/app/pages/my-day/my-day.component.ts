import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TaskStoreService } from '../../services/task-store.service';
import { Task, TaskStatus, ActivityLog } from '../../models/task.model';
import { AiPromptModalComponent } from '../../components/ai-prompt-modal.component';

@Component({
  selector: 'app-my-day',
  standalone: true,
  imports: [CommonModule, FormsModule, AiPromptModalComponent],
  template: `
    <div class="my-day-wrapper custom-scroll">
      <!-- 1. Warm Editorial Hero Card & Personal Pace Health -->
      <section class="personal-hero-card">
        <div class="hero-header-row">
          <div class="hero-avatar-col">
            <span class="user-hero-avatar" [style.background-color]="store.currentUser().color">
              {{ store.currentUser().avatar }}
            </span>
          </div>

          <div class="hero-text-col">
            <div class="hero-name-row">
              <h1 class="hero-greeting font-serif">{{ greeting() }}, {{ store.currentUser().name.split(' ')[0] }}<span class="brand-dot">.</span></h1>
              <span class="hero-role-pill" [attr.data-role]="store.currentUserRole()">
                {{ store.currentUser().role }} [{{ store.currentUserRole() }}]
              </span>
            </div>

            <!-- Inline Italic Daily Intention -->
            <div class="daily-intention-row">
              <span class="intention-icon">
                <i class="ph-light ph-feather"></i>
              </span>
              <input
                type="text"
                class="intention-input font-serif"
                [ngModel]="dailyIntention()"
                (ngModelChange)="updateIntention($event)"
                placeholder="What is your focus for today?..."
                title="Click to edit your daily focus intention"
              />
            </div>
          </div>

          <!-- Circular SVG Completion Ring & Pace Health Box -->
          <div class="hero-stats-group">
            <!-- Circular Completion Ring -->
            <div class="completion-ring-box" title="{{ myCompletedToday() }} of {{ myTotalTasks() }} tasks closed">
              <svg class="ring-svg" width="46" height="46" viewBox="0 0 46 46">
                <circle class="ring-track" cx="23" cy="23" r="18" fill="none" stroke-width="3"></circle>
                <circle
                  class="ring-progress"
                  cx="23"
                  cy="23"
                  r="18"
                  fill="none"
                  stroke-width="3"
                  stroke-dasharray="113.097"
                  [attr.stroke-dashoffset]="113.097 - (113.097 * completionPercent()) / 100"
                ></circle>
              </svg>
              <span class="ring-label font-mono">{{ completionPercent() }}%</span>
            </div>

            <!-- Pace Health Box -->
            <div class="hero-pace-box">
              <div class="pace-status-row">
                <span class="pace-dot" [class.dot-optimal]="myLoadMetric().status === 'OPTIMAL'" [class.dot-near]="myLoadMetric().status === 'NEAR_CAPACITY'" [class.dot-over]="myLoadMetric().status === 'OVER_BUDGET'"></span>
                <strong class="pace-label">{{ myLoadMetric().label }}</strong>
                <span class="pace-info-bubble" [title]="myLoadMetric().activePoints + ' active story points + ' + (myLoadMetric().reworkCount * 3) + 'pt recovery buffer = ' + myLoadMetric().effectiveLoad + ' pts / ' + myLoadMetric().capacityBudget + ' budget'">
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
        <!-- LEFT COLUMN: Open-Air Active Deliverables -->
        <div class="my-day-col">
          <div class="clean-surface-box">
            <div class="section-card-header">
              <div class="card-title-group">
                <span class="section-icon">
                  <i class="ph-light ph-sun-horizon"></i>
                </span>
                <h2 class="section-title font-serif">My Active Tasks</h2>
                <span class="section-count-badge">{{ myActiveTasks().length }}</span>
              </div>
              <div class="card-actions-group">
                <button
                  type="button"
                  class="btn-ai-prompt-mini"
                  [disabled]="!store.canCreateTasks()"
                  (click)="openAiPromptModal()"
                  title="Prompt with AI Voice & NLP Task Composer"
                >
                  <i class="ph-light ph-microphone"></i>
                  <span>Prompt with AI</span>
                </button>
                <button type="button" class="btn-jump-workspace" (click)="goToWorkspace()">
                  <span>Open Workspace</span>
                  <i class="ph-light ph-arrow-right"></i>
                </button>
              </div>
            </div>

            @if (myActiveTasks().length > 0) {
              <div class="open-air-task-list">
                @for (task of myActiveTasks(); track task.id) {
                  <div class="open-air-row" (click)="openTask(task.id)">
                    <div class="row-main">
                      <div class="row-top-meta">
                        <span class="task-id font-mono">{{ task.id }}</span>
                        @if (getProject(task.projectId); as proj) {
                          <span class="proj-badge-mini" [style.color]="proj.color">{{ proj.code }}</span>
                        }
                        <span class="priority-mini" [attr.data-priority]="task.priority">{{ task.priority }}</span>
                        @if (task.blocked) {
                          <span class="blocked-badge-mini">
                            <i class="ph-light ph-warning"></i> Blocked
                          </span>
                        }
                        <span class="effort-badge font-mono">{{ task.effortPoints }}p</span>
                      </div>

                      <strong class="row-title">{{ task.title }}</strong>

                      <div class="row-bottom-meta">
                        <span class="task-due-date font-mono text-muted">
                          <i class="ph-light ph-calendar"></i> Due {{ task.dueDate }}
                        </span>
                        @if (task.subtasks.length > 0) {
                          <span class="checklist-badge font-mono">
                            <i class="ph-light ph-check-square"></i> {{ getCompletedSubtasks(task) }}/{{ task.subtasks.length }}
                          </span>
                        }
                        <div class="avatar-stack">
                          @for (m of store.getTaskMembers(task); track m.id) {
                            <span class="avatar-stack-item" [style.background-color]="m.color" [title]="m.name">{{ m.avatar }}</span>
                          }
                        </div>
                      </div>
                    </div>

                    <!-- 1-Click Status Progression Pill -->
                    <div class="row-action-wrap" (click)="$event.stopPropagation()">
                      @if (task.status === 'TODO') {
                        <button type="button" class="btn-progression btn-start" (click)="advanceStatus(task, 'IN_PROGRESS')">
                          <i class="ph-light ph-play"></i>
                          <span>Start Working</span>
                        </button>
                      } @else if (task.status === 'IN_PROGRESS') {
                        <button type="button" class="btn-progression btn-deploy" (click)="advanceStatus(task, 'DEPLOYED')">
                          <i class="ph-light ph-cloud-arrow-up"></i>
                          <span>Deploy to Staging</span>
                        </button>
                      } @else if (task.status === 'DEPLOYED') {
                        @if (store.canSignOffDone()) {
                          <button type="button" class="btn-progression btn-done" (click)="advanceStatus(task, 'DONE')">
                            <i class="ph-light ph-check"></i>
                            <span>Verify &amp; Close</span>
                          </button>
                        } @else {
                          <span class="waiting-lead-tag">
                            <i class="ph-light ph-clock"></i> Awaiting Lead
                          </span>
                        }
                      }
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-state-box">
                <span class="empty-icon"><i class="ph-light ph-check-circle"></i></span>
                <strong class="font-serif">All caught up!</strong>
                <p>You have zero pending tasks on your active board. Head to the workspace to pick up new work.</p>
                <button type="button" class="btn-empty-action" (click)="goToWorkspace()">Explore Workspace</button>
              </div>
            }
          </div>
        </div>

        <!-- RIGHT COLUMN: Needs Attention & Project Pulse -->
        <div class="my-day-col">
          <!-- Attention / Review Queue -->
          <div class="clean-surface-box">
            <div class="section-card-header">
              <div class="card-title-group">
                <span class="section-icon attention-icon-wrap">
                  <i class="ph-light ph-warning-circle"></i>
                </span>
                <h2 class="section-title font-serif">Needs Attention</h2>
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
                          {{ item.status === 'DEPLOYED' ? 'Ready for Lead Check' : (item.blocked ? 'Blocked' : 'Needs Changes') }}
                        </span>
                      </div>
                      <strong class="row-title">{{ item.title }}</strong>
                      <div class="row-bottom-meta">
                        <span class="text-secondary text-xs">{{ getMemberName(item.assigneeId) }}</span>
                        <span class="font-mono text-muted text-xs">Due {{ item.dueDate }}</span>
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
                <i class="ph-light ph-sparkle"></i>
                <span>No urgent blockers or pending reviews requiring your action.</span>
              </div>
            }
          </div>

          <!-- Recent Project Pulse / Activity Log -->
          <div class="clean-surface-box">
            <div class="section-card-header">
              <div class="card-title-group">
                <span class="section-icon">
                  <i class="ph-light ph-wave-sine"></i>
                </span>
                <h2 class="section-title font-serif">Recent Project Pulse</h2>
              </div>
            </div>

            <div class="activity-feed-list custom-scroll">
              @for (log of recentLogs(); track log.id) {
                <div class="activity-feed-item">
                  <span class="feed-avatar" style="background: var(--accent-primary)">{{ log.actorAvatar }}</span>
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

      <!-- STANDALONE PROMPT WITH AI MODAL -->
      @if (isAiPromptModalOpen()) {
        <app-ai-prompt-modal (closeModal)="closeAiPromptModal()"></app-ai-prompt-modal>
      }
    </div>
  `,
  styles: [`
    .my-day-wrapper {
      padding: 24px 28px;
      display: flex;
      flex-direction: column;
      gap: 22px;
      height: 100%;
      overflow-y: auto;
    }

    .personal-hero-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      padding: 24px 28px;
      box-shadow: var(--shadow-soft);
    }

    .hero-header-row {
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }

    .user-hero-avatar {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      color: #ffffff;
      font-size: 18px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    }

    .hero-text-col {
      flex: 1;
      min-width: 260px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .hero-name-row {
      display: flex;
      align-items: baseline;
      gap: 12px;
      flex-wrap: wrap;
    }

    .hero-greeting {
      font-size: 26px;
      font-weight: 500;
      color: var(--text-primary);
      margin: 0;
      letter-spacing: -0.02em;
    }

    .brand-dot {
      color: var(--accent-primary);
    }

    .hero-role-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
    }

    .hero-role-pill[data-role="LEAD"], .hero-role-pill[data-role="ADMIN"] {
      color: var(--status-done);
      border-color: rgba(78, 124, 89, 0.3);
      background: rgba(78, 124, 89, 0.1);
    }

    .hero-role-pill[data-role="QA"] {
      color: var(--status-deployed);
      border-color: rgba(123, 104, 174, 0.3);
      background: rgba(123, 104, 174, 0.1);
    }

    .daily-intention-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 2px;
    }

    .intention-icon {
      color: var(--accent-primary);
      font-size: 14px;
    }

    .intention-input {
      font-style: italic;
      font-size: 13.5px;
      color: var(--text-secondary);
      background: transparent;
      border: none;
      outline: none;
      width: 100%;
      border-bottom: 1px dashed transparent;
      padding: 2px 0;
      transition: var(--transition-tactile);
    }

    .intention-input:hover, .intention-input:focus {
      color: var(--text-primary);
      border-bottom-color: var(--accent-primary);
    }

    .hero-stats-group {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .completion-ring-box {
      position: relative;
      width: 46px;
      height: 46px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ring-svg {
      transform: rotate(-90deg);
    }

    .ring-track {
      stroke: var(--border-hairline);
    }

    .ring-progress {
      stroke: var(--accent-primary);
      stroke-linecap: round;
      transition: stroke-dashoffset 0.5s var(--ease-tactile);
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
      min-width: 190px;
      padding: 10px 14px;
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
      transition: width 0.3s var(--ease-tactile);
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
      gap: 22px;
      align-items: start;
    }

    @media (max-width: 900px) {
      .my-day-grid {
        grid-template-columns: 1fr;
      }
    }

    .my-day-col {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .clean-surface-box {
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-soft);
      overflow: hidden;
    }

    .section-card-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
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

    .attention-icon-wrap {
      color: var(--accent-warn);
    }

    .section-title {
      font-size: 16px;
      font-weight: 500;
      color: var(--text-primary);
      margin: 0;
    }

    .section-count-badge {
      font-size: 10px;
      font-family: var(--font-mono);
      font-weight: 600;
      padding: 1px 7px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
    }

    .attention-badge {
      background: var(--accent-warn-tint);
      color: var(--accent-warn);
      border-color: rgba(197, 155, 78, 0.3);
    }

    .btn-jump-workspace {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
      font-size: 11.5px;
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition-tactile);
    }

    .card-actions-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-ai-prompt-mini {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 12px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-primary);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: var(--transition-tactile);
    }

    .btn-ai-prompt-mini:hover:not(:disabled) {
      background: var(--accent-primary-tint);
      border-color: var(--accent-primary);
      color: var(--accent-primary);
      transform: translateY(-1px);
    }

    .btn-jump-workspace:hover {
      background: var(--accent-primary-tint);
      border-color: rgba(92, 115, 98, 0.3);
      color: var(--accent-primary);
      transform: translateY(-1px);
    }

    /* Open-Air Row List Architecture */
    .open-air-task-list {
      display: flex;
      flex-direction: column;
    }

    .open-air-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 20px;
      border-bottom: 1px solid var(--border-hairline);
      cursor: pointer;
      transition: var(--transition-tactile);
    }

    .open-air-row:last-child {
      border-bottom: none;
    }

    .open-air-row:hover {
      background: var(--bg-subtle);
      padding-left: 24px;
    }

    .row-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-width: 0;
    }

    .row-top-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
    }

    .task-id {
      color: var(--text-muted);
      font-size: 11px;
    }

    .proj-badge-mini {
      font-weight: 700;
      font-size: 10px;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
    }

    .priority-mini {
      font-size: 9.5px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      color: var(--text-secondary);
    }

    .priority-mini[data-priority="CRITICAL"] {
      background: var(--badge-critical-bg);
      color: var(--badge-critical-text);
    }
    .priority-mini[data-priority="HIGH"] {
      background: var(--badge-high-bg);
      color: var(--badge-high-text);
    }

    .blocked-badge-mini {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 9.5px;
      font-weight: 600;
      padding: 1px 7px;
      border-radius: var(--radius-pill);
      background: var(--status-blocked-bg);
      color: var(--status-blocked-text);
    }

    .effort-badge {
      font-size: 10.5px;
      font-weight: 600;
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
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .row-bottom-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 11.5px;
    }

    .task-due-date, .checklist-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--text-muted);
    }

    /* Status Progression Pill Buttons */
    .row-action-wrap {
      display: flex;
      align-items: center;
    }

    .btn-progression {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 14px;
      border-radius: var(--radius-pill);
      font-size: 11.5px;
      font-weight: 600;
      border: 1px solid transparent;
      cursor: pointer;
      transition: var(--transition-tactile);
      white-space: nowrap;
    }

    .btn-start {
      background: var(--accent-primary-tint);
      color: var(--accent-primary);
      border-color: rgba(92, 115, 98, 0.3);
    }

    .btn-start:hover {
      background: var(--accent-primary);
      color: #ffffff;
      transform: translateY(-1px);
    }

    .btn-deploy {
      background: var(--status-deployed-bg);
      color: var(--status-deployed-text);
      border-color: rgba(123, 104, 174, 0.3);
    }

    .btn-deploy:hover {
      background: var(--status-deployed);
      color: #ffffff;
      transform: translateY(-1px);
    }

    .btn-done {
      background: var(--status-done-bg);
      color: var(--status-done-text);
      border-color: rgba(78, 124, 89, 0.3);
    }

    .btn-done:hover {
      background: var(--status-done);
      color: #ffffff;
      transform: translateY(-1px);
    }

    .waiting-lead-tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 500;
      color: var(--text-muted);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      padding: 4px 10px;
      border-radius: var(--radius-pill);
    }

    .row-nav-arrow {
      color: var(--text-muted);
      font-size: 14px;
      transition: var(--transition-tactile);
    }

    .attention-row:hover .row-nav-arrow {
      color: var(--accent-primary);
      transform: translateX(3px);
    }

    .attention-tag {
      font-size: 10px;
      font-weight: 600;
      padding: 1px 7px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      color: var(--text-secondary);
    }

    .tag-deployed {
      background: var(--status-deployed-bg);
      color: var(--status-deployed-text);
    }

    .tag-blocked {
      background: var(--status-blocked-bg);
      color: var(--status-blocked-text);
    }

    .calm-box {
      padding: 24px;
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--text-muted);
      font-size: 12.5px;
      justify-content: center;
    }

    .activity-feed-list {
      max-height: 320px;
      overflow-y: auto;
    }

    .activity-feed-item {
      display: flex;
      gap: 12px;
      padding: 12px 20px;
      border-bottom: 1px solid var(--border-hairline);
    }

    .activity-feed-item:last-child {
      border-bottom: none;
    }

    .feed-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
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
    }

    .feed-top-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }

    .feed-actor {
      font-size: 12px;
      color: var(--text-primary);
    }

    .feed-time {
      font-size: 10px;
      color: var(--text-muted);
    }

    .feed-detail {
      font-size: 11.5px;
      color: var(--text-secondary);
      line-height: 1.4;
      margin: 0;
    }

    .empty-state-box {
      padding: 40px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .empty-icon {
      font-size: 32px;
      color: var(--status-done);
    }

    .btn-empty-action {
      margin-top: 8px;
      padding: 6px 16px;
      border-radius: var(--radius-pill);
      background: var(--accent-primary);
      color: #ffffff;
      border: none;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition-tactile);
    }

    .btn-empty-action:hover {
      background: var(--accent-primary-hover);
      transform: translateY(-1px);
    }
  `]
})
export class MyDayComponent {
  protected readonly store = inject(TaskStoreService);
  private readonly router = inject(Router);
  protected readonly Math = Math;

  readonly dailyIntention = signal<string>(
    localStorage.getItem('pb_daily_intention') || 'Ship streaming token batching & review stage pull requests'
  );

  updateIntention(val: string): void {
    this.dailyIntention.set(val);
    localStorage.setItem('pb_daily_intention', val);
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

  readonly attentionItems = computed(() => {
    const curUser = this.store.currentUser();
    const visibleProjIds = new Set(this.store.visibleProjects().map(p => p.id));
    const tasks = this.store.tasks().filter(t => visibleProjIds.has(t.projectId));

    if (curUser.systemRole === 'LEAD' || curUser.systemRole === 'ADMIN') {
      return tasks.filter(t => t.status === 'DEPLOYED');
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
    return this.store.activityLogs().slice(0, 8);
  });

  getProject(projectId: string) {
    return this.store.projectMap().get(projectId);
  }

  getMemberName(memberId?: string): string {
    if (!memberId) return 'Team';
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

  readonly isAiPromptModalOpen = signal<boolean>(false);

  openAiPromptModal(): void {
    if (!this.store.canCreateTasks()) return;
    this.isAiPromptModalOpen.set(true);
  }

  closeAiPromptModal(): void {
    this.isAiPromptModalOpen.set(false);
  }

  goToWorkspace(): void {
    this.router.navigate(['/workspace']);
  }
}
