import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskStoreService } from '../../services/task-store.service';
import { SystemRole, ActivityLog } from '../../models/task.model';

@Component({
  selector: 'app-governance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="gov-page-wrapper custom-scroll">
      <!-- 1. Top Governance Header & Tab Bar -->
      <div class="gov-header-card">
        <div class="gov-title-col">
          <div class="gov-title-row">
            <span class="gov-shield-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </span>
            <h1 class="gov-heading">Governance, Bottleneck Analytics &amp; Compliance Console</h1>
            <span class="gov-version-pill">Enterprise V2</span>
          </div>
          <p class="gov-subtext">Squad RBAC authorization, cycle-time telemetry, failure recovery budgets &amp; append-only compliance audit trail</p>
        </div>

        <!-- Horizontal Tabs -->
        <div class="gov-tabs-bar">
          <button
            type="button"
            class="gov-tab-btn"
            [class.active]="activeTab() === 'RBAC_MATRIX'"
            (click)="setTab('RBAC_MATRIX')"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span>Team &amp; Access</span>
          </button>
          <button
            type="button"
            class="gov-tab-btn"
            [class.active]="activeTab() === 'ANALYTICS'"
            (click)="setTab('ANALYTICS')"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            <span>Delivery Bottlenecks</span>
          </button>
          <button
            type="button"
            class="gov-tab-btn"
            [class.active]="activeTab() === 'AUDIT_TRAIL'"
            (click)="setTab('AUDIT_TRAIL')"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span>Audit Log</span>
            <span class="tab-counter font-mono">{{ store.activityLogs().length }}</span>
          </button>
        </div>
      </div>

      <!-- 2. Tab Content Panels -->
      <div class="gov-content-panel">
        <!-- TAB 1: TEAM & ACCESS (SQUAD RBAC MATRIX) -->
        @if (activeTab() === 'RBAC_MATRIX') {
          <div class="gov-subpanel">
            <!-- Authority Alert Banner -->
            <div class="rbac-authority-banner" [class.banner-lead]="store.canManageGovernance()">
              <span class="banner-icon">
                @if (store.canManageGovernance()) {
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                } @else {
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                }
              </span>
              <div class="banner-body">
                @if (store.canManageGovernance()) {
                  <strong>Lead / Admin Authority Active</strong>
                  <p>You have full policy privileges to adjust system roles and engineer capacity budgets. Changes are immutably logged to the security audit trail.</p>
                } @else {
                  <strong>Read-Only Access (Viewing as {{ store.currentUserRole() }})</strong>
                  <p>System roles and sprint capacity allocations are locked. Switch persona in the top bar to a Lead (Vikram Rao) or Admin to modify privileges.</p>
                }
              </div>
            </div>

            <!-- Team Access Table -->
            <div class="gov-table-container">
              <table class="gov-matrix-table">
                <thead>
                  <tr>
                    <th style="width: 220px;">Team Member</th>
                    <th style="width: 170px;">Squad</th>
                    <th style="width: 150px;">Technical Role</th>
                    <th style="width: 160px;">Permission Tier</th>
                    <th style="width: 130px;">Sprint Budget</th>
                    <th>Effective Workload &amp; Recovery</th>
                    <th style="width: 120px;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (member of store.teamMembers(); track member.id) {
                    @let metric = store.getMemberLoadMetric(member.id);
                    <tr class="matrix-row">
                      <!-- Member Info -->
                      <td>
                        <div class="member-cell-wrap">
                          <span class="avatar-circle" [style.background-color]="member.color">{{ member.avatar }}</span>
                          <div class="member-meta">
                            <strong class="member-name">{{ member.name }}</strong>
                            <span class="member-email text-muted">{{ member.email }}</span>
                          </div>
                        </div>
                      </td>

                      <!-- Squad -->
                      <td>
                        <span class="squad-text">{{ member.squad }}</span>
                      </td>

                      <!-- Technical Role -->
                      <td>
                        <span class="tech-role-pill">{{ member.role }}</span>
                      </td>

                      <!-- Permission Tier -->
                      <td>
                        @if (store.canManageGovernance()) {
                          <select
                            class="role-select"
                            [value]="member.systemRole"
                            (change)="onRoleChange(member.id, $event)"
                          >
                            <option value="VIEWER">VIEWER (Read-only)</option>
                            <option value="DEV">DEV (Standard)</option>
                            <option value="QA">QA (Verification)</option>
                            <option value="LEAD">LEAD (Sign-Off & Scope)</option>
                            <option value="ADMIN">ADMIN (Full Admin)</option>
                          </select>
                        } @else {
                          <span class="role-badge-static" [attr.data-role]="member.systemRole">{{ member.systemRole }}</span>
                        }
                      </td>

                      <!-- Capacity Budget -->
                      <td>
                        @if (store.canManageGovernance()) {
                          <div class="budget-input-group">
                            <input
                              type="number"
                              class="budget-num-input font-mono"
                              [value]="member.capacityBudget"
                              min="5"
                              max="40"
                              (change)="onBudgetChange(member.id, $event)"
                            />
                            <span class="budget-unit font-mono">pts</span>
                          </div>
                        } @else {
                          <span class="font-mono text-secondary">{{ member.capacityBudget }} pts</span>
                        }
                      </td>

                      <!-- Effective Load & Recovery Bar -->
                      <td>
                        <div class="capacity-bar-group">
                          <div class="bar-track">
                            <div
                              class="bar-fill"
                              [class.fill-optimal]="metric.status === 'OPTIMAL'"
                              [class.fill-near]="metric.status === 'NEAR_CAPACITY'"
                              [class.fill-over]="metric.status === 'OVER_BUDGET'"
                              [style.width.%]="Math.min(100, (metric.effectiveLoad / member.capacityBudget) * 100)"
                            ></div>
                          </div>
                          <div class="bar-details-row font-mono">
                            <span class="pts-ratio">{{ metric.effectiveLoad }} / {{ member.capacityBudget }} pts</span>
                            <span class="formula-caption" [class.text-penalty]="metric.reworkCount > 0">
                              {{ metric.activePoints }} active
                              @if (metric.reworkCount > 0) {
                                + {{ metric.reworkCount * 3 }} rework penalty
                              }
                            </span>
                          </div>
                        </div>
                      </td>

                      <!-- Status Badge -->
                      <td>
                        <span
                          class="status-chip"
                          [class.chip-optimal]="metric.status === 'OPTIMAL'"
                          [class.chip-near]="metric.status === 'NEAR_CAPACITY'"
                          [class.chip-over]="metric.status === 'OVER_BUDGET'"
                        >
                          {{ metric.label }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- TAB 2: DELIVERY BOTTLENECKS (CYCLE TIME TELEMETRY) -->
        @if (activeTab() === 'ANALYTICS') {
          <div class="gov-subpanel">
            <!-- 3 Executive KPI Cards -->
            <div class="kpi-cards-grid">
              <!-- KPI 1: Wait Time -->
              <div class="gov-kpi-card">
                <div class="kpi-top-row">
                  <span class="kpi-label">Avg Lead Sign-Off Wait Time</span>
                  <span class="kpi-pill pill-target">Target &lt; 24h</span>
                </div>
                <div class="kpi-val-row">
                  <strong class="kpi-huge-number tabular-nums">{{ store.cycleTimeMetrics().avgLeadSignOffHours }}</strong>
                  <span class="kpi-unit">hours</span>
                </div>
                <p class="kpi-desc">Average elapsed duration tasks wait in DEPLOYED state before Lead inspection and server sign-off note.</p>
              </div>

              <!-- KPI 2: Rework Penalty Overhead -->
              <div class="gov-kpi-card">
                <div class="kpi-top-row">
                  <span class="kpi-label">Rework Recovery Overhead</span>
                  <span class="kpi-pill pill-rework">+3 pts / rejection</span>
                </div>
                <div class="kpi-val-row">
                  <strong class="kpi-huge-number text-rework tabular-nums">{{ store.cycleTimeMetrics().totalReworkOverheadPoints }}</strong>
                  <span class="kpi-unit">points</span>
                </div>
                <p class="kpi-desc">Cumulative engineering points absorbed by rework recovery penalties on rejected builds across all squads.</p>
              </div>

              <!-- KPI 3: Slipped Deliverables -->
              <div class="gov-kpi-card">
                <div class="kpi-top-row">
                  <span class="kpi-label">Slipped Deliverables</span>
                  <span class="kpi-pill pill-drift">Grace Protocol</span>
                </div>
                <div class="kpi-val-row">
                  <strong class="kpi-huge-number text-drift tabular-nums">{{ store.cycleTimeMetrics().totalDriftedTasks }}</strong>
                  <span class="kpi-unit">tasks</span>
                </div>
                <p class="kpi-desc">Tasks with baseline due dates adjusted via structured slippage justifications without punitive penalization.</p>
              </div>
            </div>

            <!-- 2 Comparative Breakdown Panels -->
            <div class="analytics-split-grid">
              <!-- Project Quality & Failure Rate -->
              <div class="analytics-subcard">
                <div class="subcard-head">
                  <h3 class="subcard-heading">Project Quality &amp; Rework Bottlenecks</h3>
                  <p class="subcard-sub">Failure rates, deployed items, and recovery overhead points by project</p>
                </div>
                <div class="project-breakdown-list">
                  @for (item of store.cycleTimeMetrics().projectBreakdowns; track item.projectId) {
                    <div class="project-stat-item">
                      <div class="item-head">
                        <div class="code-title-wrap">
                          <span class="proj-code-badge" [style.color]="item.color">{{ item.projectCode }}</span>
                          <strong class="item-name">{{ item.projectName }}</strong>
                        </div>
                        <div class="item-stats font-mono">
                          <span>{{ item.deployedTasks }} Staged</span>
                          <span class="text-rework">{{ item.totalReworkCount }} Reworks ({{ item.reworkOverheadPoints }}p)</span>
                          <span>{{ item.avgSignOffWaitHours }}h Wait</span>
                        </div>
                      </div>
                      <div class="item-bar-track">
                        <div class="item-bar-fill" [style.background]="item.color" [style.width.%]="Math.max(6, item.reworkRate)"></div>
                      </div>
                      <div class="item-foot text-xs text-muted">
                        <span>Failure Rate: <strong class="text-primary">{{ item.reworkRate }}%</strong></span>
                        <span>{{ item.totalTasks }} Total Deliverables</span>
                      </div>
                    </div>
                  }
                </div>
              </div>

              <!-- Slippage Root Cause Distribution -->
              <div class="analytics-subcard">
                <div class="subcard-head">
                  <h3 class="subcard-heading">Deadline Slippage Root Causes</h3>
                  <p class="subcard-sub">Taxonomy distribution recorded through the Deadline Grace Protocol (FR-05)</p>
                </div>
                <div class="slippage-breakdown-list">
                  @for (slip of store.cycleTimeMetrics().slippageBreakdowns; track slip.reason) {
                    <div class="slip-item">
                      <div class="slip-top-row">
                        <div class="slip-label-wrap">
                          <span class="slip-glyph">
                            @switch (slip.reason) {
                              @case ('DEPENDENCY_BLOCKED') { 🔗 }
                              @case ('SCOPE_EXPANDED') { 📐 }
                              @case ('PRODUCTION_HOTFIX') { 🔥 }
                              @case ('UNDERESTIMATED') { ⏱️ }
                            }
                          </span>
                          <strong class="slip-name">{{ slip.label }}</strong>
                        </div>
                        <span class="slip-metric font-mono">{{ slip.count }} task(s) · {{ slip.percentage }}%</span>
                      </div>
                      <div class="slip-track">
                        <div class="slip-fill" [attr.data-reason]="slip.reason" [style.width.%]="Math.max(5, slip.percentage)"></div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
        }

        <!-- TAB 3: IMMUTABLE SECURITY AUDIT TRAIL -->
        @if (activeTab() === 'AUDIT_TRAIL') {
          <div class="gov-subpanel">
            <!-- Seal & Export Bar -->
            <div class="audit-top-bar">
              <div class="audit-seal-group">
                <span class="seal-lock-icon">🔒</span>
                <div class="seal-meta">
                  <div class="seal-header-row">
                    <strong class="seal-title">LOCKED · APPEND-ONLY COMPLIANCE LEDGER</strong>
                    <span class="soc-pill">SOC2 / ISO 27001 Ready</span>
                  </div>
                  <p class="seal-note">Cryptographically isolated append-only ledger recording all state transitions, blocker toggles, and governance calibrations.</p>
                </div>
              </div>

              <div class="export-actions">
                <button type="button" class="btn-export btn-export-csv" (click)="store.exportAuditLogCsv()">
                  📥 Export CSV
                </button>
                <button type="button" class="btn-export btn-export-json" (click)="store.exportAuditLogJson()">
                  📥 Export JSON
                </button>
              </div>
            </div>

            <!-- Filter Toolbar -->
            <div class="audit-filter-toolbar">
              <div class="audit-search-box">
                <span class="search-glyph">🔍</span>
                <input
                  type="text"
                  class="audit-input"
                  placeholder="Search audit trail by actor, task ID, action, details..."
                  [ngModel]="searchQuery()"
                  (ngModelChange)="searchQuery.set($event)"
                />
                @if (searchQuery()) {
                  <button type="button" class="btn-clear-audit" (click)="searchQuery.set('')">✕</button>
                }
              </div>

              <div class="audit-filter-item">
                <label class="filter-lbl">Actor:</label>
                <select class="audit-select" [ngModel]="actorFilter()" (ngModelChange)="actorFilter.set($event)">
                  <option value="ALL">All Actors</option>
                  @for (mem of store.teamMembers(); track mem.id) {
                    <option [value]="mem.name">{{ mem.name }}</option>
                  }
                </select>
              </div>

              <div class="audit-filter-item">
                <label class="filter-lbl">Action:</label>
                <select class="audit-select" [ngModel]="actionFilter()" (ngModelChange)="actionFilter.set($event)">
                  <option value="ALL">All Actions</option>
                  <option value="STATUS_CHANGED">STATUS_CHANGED</option>
                  <option value="REWORK_PENALTY">REWORK_PENALTY</option>
                  <option value="SLIPPAGE_LOGGED">SLIPPAGE_LOGGED</option>
                  <option value="CASCADE_SHIFT_DATES">CASCADE_SHIFT_DATES</option>
                  <option value="MEMBER_ROLE_UPDATED">MEMBER_ROLE_UPDATED</option>
                  <option value="DEPLOYED_TO_SERVER">DEPLOYED_TO_SERVER</option>
                  <option value="REVIEW_NOTE_ADDED">REVIEW_NOTE_ADDED</option>
                  <option value="BLOCKER_TOGGLED">BLOCKER_TOGGLED</option>
                  <option value="TASK_CREATED">TASK_CREATED</option>
                </select>
              </div>

              <span class="records-counter font-mono text-muted text-xs">
                Showing {{ filteredLogs().length }} of {{ store.activityLogs().length }} events
              </span>
            </div>

            <!-- Audit Ledger Table -->
            <div class="gov-table-container">
              <table class="gov-matrix-table audit-table">
                <thead>
                  <tr>
                    <th style="width: 100px;">Log ID</th>
                    <th style="width: 155px;">Timestamp</th>
                    <th style="width: 170px;">Actor</th>
                    <th style="width: 180px;">Action Type</th>
                    <th style="width: 220px;">Target Deliverable</th>
                    <th>Audit Details &amp; Provenance</th>
                  </tr>
                </thead>
                <tbody>
                  @for (log of filteredLogs(); track log.id) {
                    <tr class="matrix-row">
                      <td class="font-mono text-muted text-xs">{{ log.id }}</td>
                      <td class="tabular-nums text-secondary text-xs font-mono">{{ log.timestamp }}</td>
                      <td>
                        <div class="actor-cell-wrap">
                          <span class="avatar-mini" style="background-color: var(--color-primary)">{{ log.actorAvatar }}</span>
                          <span class="text-xs font-semibold">{{ log.actor }}</span>
                        </div>
                      </td>
                      <td>
                        <span class="action-chip font-mono" [attr.data-action]="log.action">{{ log.action }}</span>
                      </td>
                      <td>
                        <div class="target-cell-wrap">
                          <strong class="target-title text-truncate">{{ log.taskTitle }}</strong>
                          @if (log.taskId) {
                            <span class="font-mono text-muted text-xs">{{ log.taskId }}</span>
                          }
                        </div>
                      </td>
                      <td>
                        <div class="details-cell-wrap">
                          <span class="details-text text-xs">{{ log.details }}</span>
                          @if (log.statusTransition) {
                            <span class="transition-tag font-mono text-xs">
                              {{ log.statusTransition.from }} → {{ log.statusTransition.to }}
                            </span>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .gov-page-wrapper {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      height: 100%;
      overflow-y: auto;
    }

    .gov-header-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      padding: 18px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .gov-title-col {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .gov-title-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .gov-shield-icon { font-size: 20px; }

    .gov-heading {
      font-size: 18px;
      font-weight: 800;
      color: var(--text-primary);
      margin: 0;
    }

    .gov-version-pill {
      font-size: 10.5px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 10px;
      background: rgba(124, 58, 237, 0.12);
      border: 1px solid rgba(124, 58, 237, 0.35);
      color: #7c3aed;
    }

    .gov-subtext {
      font-size: 12.5px;
      color: var(--text-secondary);
      margin: 0;
    }

    .gov-tabs-bar {
      display: flex;
      align-items: center;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 3px;
      gap: 2px;
    }

    .gov-tab-btn {
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      background: transparent;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.12s ease;
    }

    .gov-tab-btn:hover {
      color: var(--text-primary);
    }

    .gov-tab-btn.active {
      background: var(--bg-surface);
      color: var(--text-primary);
      box-shadow: var(--shadow-sm);
    }

    .tab-counter {
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 8px;
      background: var(--color-primary);
      color: #ffffff;
    }

    .gov-content-panel {
      display: flex;
      flex-direction: column;
    }

    .gov-subpanel {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .rbac-authority-banner {
      background: rgba(148, 163, 184, 0.1);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 12px 18px;
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .rbac-authority-banner.banner-lead {
      background: rgba(16, 185, 129, 0.08);
      border-color: rgba(16, 185, 129, 0.35);
    }

    .banner-icon { font-size: 20px; }
    .banner-body p { font-size: 12px; color: var(--text-secondary); margin: 2px 0 0 0; }

    .gov-table-container {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      overflow-x: auto;
    }

    .gov-matrix-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .gov-matrix-table th {
      padding: 11px 16px;
      background: var(--bg-elevated);
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1px solid var(--border-subtle);
    }

    .matrix-row {
      border-bottom: 1px solid var(--border-subtle);
      transition: background-color 0.1s ease;
    }

    .matrix-row:hover { background: var(--bg-canvas); }

    .gov-matrix-table td {
      padding: 12px 16px;
      font-size: 12.5px;
      vertical-align: middle;
    }

    .member-cell-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .avatar-circle {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      color: #ffffff;
      font-size: 10.5px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .member-meta { display: flex; flex-direction: column; }
    .member-name { font-size: 13px; color: var(--text-primary); }
    .member-email { font-size: 11px; }

    .squad-text { font-size: 11.5px; color: var(--text-secondary); }
    .tech-role-pill { font-size: 11px; color: var(--text-muted); font-weight: 600; }

    .role-select {
      padding: 5px 8px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-canvas);
      color: var(--text-primary);
      font-size: 11.5px;
      font-weight: 600;
      outline: none;
    }

    .role-badge-static {
      font-size: 10.5px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 4px;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
    }

    .role-badge-static[data-role="LEAD"], .role-badge-static[data-role="ADMIN"] {
      color: #059669; border-color: #10b981;
    }

    .budget-input-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .budget-num-input {
      width: 54px;
      padding: 4px 6px;
      border-radius: 5px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-canvas);
      color: var(--text-primary);
      font-size: 12px;
      outline: none;
    }

    .budget-unit { font-size: 11px; color: var(--text-muted); }

    .capacity-bar-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 170px;
    }

    .bar-track {
      height: 6px;
      background: var(--bg-canvas);
      border-radius: 3px;
      overflow: hidden;
      border: 1px solid var(--border-subtle);
    }

    .bar-fill { height: 100%; border-radius: 3px; }
    .fill-optimal { background: #10b981; }
    .fill-near { background: #f59e0b; }
    .fill-over { background: #ef4444; }

    .bar-details-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10.5px;
    }

    .pts-ratio { font-weight: 700; color: var(--text-primary); }
    .formula-caption { color: var(--text-muted); }
    .text-penalty { color: #ea580c; font-weight: 600; }

    .status-chip {
      font-size: 10.5px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 10px;
      white-space: nowrap;
    }

    .chip-optimal { background: rgba(16, 185, 129, 0.12); color: #059669; }
    .chip-near { background: rgba(245, 158, 11, 0.12); color: #d97706; }
    .chip-over { background: rgba(239, 68, 68, 0.12); color: #dc2626; }

    /* ANALYTICS */
    .kpi-cards-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    @media (max-width: 860px) {
      .kpi-cards-grid { grid-template-columns: 1fr; }
    }

    .gov-kpi-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .kpi-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .kpi-label { font-size: 12px; font-weight: 700; color: var(--text-secondary); }

    .kpi-pill { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 8px; }
    .pill-target { background: rgba(16, 185, 129, 0.12); color: #059669; }
    .pill-rework { background: rgba(239, 68, 68, 0.12); color: #dc2626; }
    .pill-drift { background: rgba(245, 158, 11, 0.12); color: #d97706; }

    .kpi-val-row {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }

    .kpi-huge-number { font-size: 28px; font-weight: 800; color: var(--text-primary); }
    .kpi-unit { font-size: 13px; color: var(--text-muted); font-weight: 600; }
    .kpi-desc { font-size: 11.5px; color: var(--text-secondary); line-height: 1.4; margin: 0; }

    .analytics-split-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    @media (max-width: 900px) {
      .analytics-split-grid { grid-template-columns: 1fr; }
    }

    .analytics-subcard {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .subcard-head {
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 8px;
    }

    .subcard-heading { font-size: 13.5px; font-weight: 700; color: var(--text-primary); margin: 0; }
    .subcard-sub { font-size: 11.5px; color: var(--text-secondary); margin: 2px 0 0 0; }

    .project-breakdown-list, .slippage-breakdown-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .project-stat-item, .slip-item {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .item-head, .slip-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .code-title-wrap, .slip-label-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .proj-code-badge {
      font-size: 10px;
      font-weight: 800;
      font-family: var(--font-mono);
      padding: 1px 6px;
      border-radius: 3px;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
    }

    .item-name, .slip-name { font-size: 12.5px; color: var(--text-primary); }
    .item-stats, .slip-metric { font-size: 11px; color: var(--text-secondary); display: flex; gap: 8px; }

    .item-bar-track, .slip-track {
      height: 7px;
      background: var(--bg-canvas);
      border-radius: 4px;
      overflow: hidden;
      border: 1px solid var(--border-subtle);
    }

    .item-bar-fill, .slip-fill { height: 100%; border-radius: 4px; }
    .slip-fill[data-reason="DEPENDENCY_BLOCKED"] { background: #3b82f6; }
    .slip-fill[data-reason="SCOPE_EXPANDED"] { background: #8b5cf6; }
    .slip-fill[data-reason="PRODUCTION_HOTFIX"] { background: #ef4444; }
    .slip-fill[data-reason="UNDERESTIMATED"] { background: #f59e0b; }

    .item-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* AUDIT TRAIL */
    .audit-top-bar {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .audit-seal-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .seal-lock-icon { font-size: 24px; }
    .seal-header-row { display: flex; align-items: center; gap: 8px; }
    .seal-title { font-size: 12.5px; color: var(--text-primary); letter-spacing: 0.04em; }

    .soc-pill {
      font-size: 9.5px;
      font-weight: 800;
      padding: 1px 6px;
      border-radius: 4px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #059669;
    }

    .seal-note { font-size: 11.5px; color: var(--text-secondary); margin: 2px 0 0 0; }

    .export-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-export {
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.12s ease;
    }

    .btn-export:hover {
      background: var(--bg-elevated);
      border-color: var(--border-strong);
    }

    .audit-filter-toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .audit-search-box {
      flex: 1;
      min-width: 240px;
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-glyph {
      position: absolute;
      left: 10px;
      font-size: 11px;
      color: var(--text-muted);
      pointer-events: none;
    }

    .audit-input {
      width: 100%;
      padding: 6px 26px 6px 28px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: 12px;
      outline: none;
    }

    .btn-clear-audit {
      position: absolute;
      right: 6px;
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 11px;
    }

    .audit-filter-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .filter-lbl { font-size: 11.5px; font-weight: 600; color: var(--text-secondary); }

    .audit-select {
      padding: 5px 8px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: 11.5px;
      outline: none;
    }

    .actor-cell-wrap { display: flex; align-items: center; gap: 6px; }
    .avatar-mini {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      color: #ffffff;
      font-size: 9px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .action-chip {
      font-size: 9.5px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 3px;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
    }

    .action-chip[data-action="STATUS_CHANGED"] { color: #2563eb; border-color: #3b82f6; }
    .action-chip[data-action="REWORK_PENALTY"] { color: #dc2626; border-color: #ef4444; }
    .action-chip[data-action="SLIPPAGE_LOGGED"] { color: #d97706; border-color: #f59e0b; }
    .action-chip[data-action="MEMBER_ROLE_UPDATED"] { color: #059669; border-color: #10b981; }

    .target-cell-wrap { display: flex; flex-direction: column; }
    .target-title { font-size: 12px; color: var(--text-primary); }

    .details-cell-wrap { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .transition-tag {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 3px;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
    }
  `]
})
export class GovernanceComponent {
  protected readonly store = inject(TaskStoreService);
  protected readonly Math = Math;

  readonly activeTab = signal<'RBAC_MATRIX' | 'ANALYTICS' | 'AUDIT_TRAIL'>('RBAC_MATRIX');
  readonly searchQuery = signal<string>('');
  readonly actorFilter = signal<string>('ALL');
  readonly actionFilter = signal<string>('ALL');

  setTab(tab: 'RBAC_MATRIX' | 'ANALYTICS' | 'AUDIT_TRAIL'): void {
    this.activeTab.set(tab);
  }

  readonly filteredLogs = computed(() => {
    const logs = this.store.activityLogs();
    const actor = this.actorFilter();
    const action = this.actionFilter();
    const q = this.searchQuery().trim().toLowerCase();

    return logs.filter((log: ActivityLog) => {
      if (actor !== 'ALL' && log.actor !== actor) return false;
      if (action !== 'ALL' && log.action !== action) return false;
      if (q) {
        const text = `${log.actor} ${log.action} ${log.taskTitle || ''} ${log.details || ''} ${log.taskId || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  });

  onRoleChange(memberId: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const newRole = select.value as SystemRole;
    const member = this.store.teamMembers().find(m => m.id === memberId);
    if (member) {
      this.store.updateMemberGovernance(memberId, newRole, member.capacityBudget);
    }
  }

  onBudgetChange(memberId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const newBudget = Number(input.value) || 15;
    const member = this.store.teamMembers().find(m => m.id === memberId);
    if (member) {
      this.store.updateMemberGovernance(memberId, member.systemRole, newBudget);
    }
  }
}
