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
      <!-- 1. Top Governance Header & Pill Tab Bar -->
      <div class="gov-header-card">
        <div class="gov-title-col">
          <div class="gov-title-row">
            <span class="gov-shield-icon">
              <i class="ph-light ph-shield-check"></i>
            </span>
            <h1 class="gov-heading">Governance, Analytics &amp; Audit Log</h1>
            <span class="gov-version-pill">v4.0</span>
          </div>
          <p class="gov-subtext">Role permissions, sprint capacity workload, review cycle times &amp; append-only compliance audit log</p>
        </div>

        <!-- Horizontal Pill Tabs -->
        <div class="gov-tabs-bar">
          <button
            type="button"
            class="gov-tab-btn"
            [class.active]="activeTab() === 'RBAC_MATRIX'"
            (click)="setTab('RBAC_MATRIX')"
          >
            <i class="ph-light ph-users"></i>
            <span>Team &amp; Access</span>
          </button>
          <button
            type="button"
            class="gov-tab-btn"
            [class.active]="activeTab() === 'ANALYTICS'"
            (click)="setTab('ANALYTICS')"
          >
            <i class="ph-light ph-chart-bar"></i>
            <span>Delivery Bottlenecks</span>
          </button>
          <button
            type="button"
            class="gov-tab-btn"
            [class.active]="activeTab() === 'AUDIT_TRAIL'"
            (click)="setTab('AUDIT_TRAIL')"
          >
            <i class="ph-light ph-file-text"></i>
            <span>Audit Log</span>
            <span class="tab-counter font-mono">{{ store.visibleActivityLogs().length }}</span>
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
                  <i class="ph-light ph-shield-check"></i>
                } @else {
                  <i class="ph-light ph-lock-key"></i>
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

            <!-- Team Access Table (Open-Air Surfaces) -->
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
                <p class="kpi-desc">Average elapsed duration tasks wait in Under Review state before Lead/Manager sign-off.</p>
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
                  <h3 class="subcard-heading font-serif">Project Quality &amp; Rework Bottlenecks</h3>
                  <p class="subcard-sub">Failure rates, deployed items, and recovery overhead points by project</p>
                </div>
                <div class="project-breakdown-list">
                  @for (item of store.cycleTimeMetrics().projectBreakdowns; track item.projectId) {
                    <div class="project-stat-item">
                      <div class="item-head">
                        <div class="code-title-wrap">
                          <span class="proj-code-badge font-mono" [style.color]="item.color">{{ item.projectCode }}</span>
                          <strong class="item-name font-serif">{{ item.projectName }}</strong>
                        </div>
                        <div class="item-stats font-mono">
                          <span>{{ item.deployedTasks }} Under Review</span>
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
                  <h3 class="subcard-heading font-serif">Deadline Slippage Root Causes</h3>
                  <p class="subcard-sub">Taxonomy distribution recorded through the Deadline Grace Protocol (FR-05)</p>
                </div>
                <div class="slippage-breakdown-list">
                  @for (slip of store.cycleTimeMetrics().slippageBreakdowns; track slip.reason) {
                    <div class="slip-item">
                      <div class="slip-top-row">
                        <div class="slip-label-wrap">
                          <span class="slip-glyph">
                            @switch (slip.reason) {
                              @case ('DEPENDENCY_BLOCKED') { <i class="ph-light ph-link"></i> }
                              @case ('SCOPE_EXPANDED') { <i class="ph-light ph-arrows-out"></i> }
                              @case ('PRODUCTION_HOTFIX') { <i class="ph-light ph-fire"></i> }
                              @case ('UNDERESTIMATED') { <i class="ph-light ph-timer"></i> }
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
                <span class="seal-lock-icon">
                  <i class="ph-light ph-lock-key"></i>
                </span>
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
                  <i class="ph-light ph-download-simple"></i>
                  <span>Export CSV</span>
                </button>
                <button type="button" class="btn-export btn-export-json" (click)="store.exportAuditLogJson()">
                  <i class="ph-light ph-download-simple"></i>
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            <!-- Scope Banner for Audit Log -->
            <div class="audit-scope-banner" [class.is-personal]="!store.canCurrentUserViewAllLogs()">
              @if (store.canCurrentUserViewAllLogs()) {
                <div class="scope-banner-content">
                  <i class="ph-light ph-shield-check banner-icon"></i>
                  <span><strong>Full Portfolio Audit View:</strong> Tech Lead &amp; Delivery Manager access enabled. All workspace and cross-project events are visible.</span>
                </div>
              } @else {
                <div class="scope-banner-content">
                  <i class="ph-light ph-lock-simple banner-icon"></i>
                  <span><strong>Personal Activity View:</strong> Full team audit logs are restricted to Tech Lead &amp; Delivery Manager. Displaying actions you initiated or deliverables assigned to you.</span>
                </div>
              }
            </div>

            <!-- Filter Toolbar -->
            <div class="audit-filter-toolbar">
              <div class="audit-search-box">
                <span class="search-glyph">
                  <i class="ph-light ph-magnifying-glass"></i>
                </span>
                <input
                  type="text"
                  class="audit-input"
                  placeholder="Search audit trail by actor, task ID, action, details..."
                  [ngModel]="searchQuery()"
                  (ngModelChange)="searchQuery.set($event)"
                />
                @if (searchQuery()) {
                  <button type="button" class="btn-clear-audit" (click)="searchQuery.set('')">
                    <i class="ph-light ph-x"></i>
                  </button>
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
                  <option value="SHARING_UPDATED">SHARING_UPDATED</option>
                  <option value="PERMISSION_POLICY_UPDATED">PERMISSION_POLICY_UPDATED</option>
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
                Showing {{ filteredLogs().length }} of {{ store.visibleActivityLogs().length }} events
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
                          <span class="avatar-mini" style="background-color: var(--accent-primary)">{{ log.actorAvatar }}</span>
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
                              {{ store.getStatusLabel(log.statusTransition.from) }} → {{ store.getStatusLabel(log.statusTransition.to) }}
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
      padding: 24px 28px 48px;
      display: flex;
      flex-direction: column;
      gap: 22px;
      min-height: 100%;
      background: var(--bg-canvas);
    }

    .gov-header-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      padding: 22px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      box-shadow: var(--shadow-soft);
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

    .gov-shield-icon {
      font-size: 20px;
      color: var(--accent-primary);
      display: flex;
      align-items: center;
    }

    .gov-heading {
      font-size: 22px;
      font-weight: 500;
      color: var(--text-primary);
      margin: 0;
      letter-spacing: -0.02em;
    }

    .brand-dot {
      color: var(--accent-primary);
    }

    .gov-version-pill {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: var(--accent-primary-tint);
      color: var(--accent-primary);
      border: 1px solid rgba(92, 115, 98, 0.2);
    }

    .gov-subtext {
      font-size: 12.5px;
      color: var(--text-secondary);
      margin: 0;
    }

    .gov-tabs-bar {
      display: flex;
      align-items: center;
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-pill);
      padding: 3px;
      gap: 3px;
    }

    .gov-tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: var(--radius-pill);
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition-tactile);
    }

    .gov-tab-btn:hover {
      color: var(--text-primary);
    }

    .gov-tab-btn.active {
      background: var(--bg-surface);
      color: var(--accent-primary);
      box-shadow: var(--shadow-sm);
      font-weight: 600;
    }

    .tab-counter {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      color: var(--text-muted);
    }

    .gov-content-panel {
      flex: 1;
    }

    .gov-subpanel {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding-bottom: 48px;
    }

    .rbac-authority-banner {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 18px;
      border-radius: var(--radius-inner);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      font-size: 12.5px;
    }

    .rbac-authority-banner.banner-lead {
      background: var(--accent-primary-tint);
      border-color: rgba(92, 115, 98, 0.3);
    }

    .banner-icon {
      font-size: 18px;
      color: var(--accent-primary);
      margin-top: 1px;
    }

    .banner-body strong {
      display: block;
      color: var(--text-primary);
      margin-bottom: 2px;
    }

    .banner-body p {
      color: var(--text-secondary);
      margin: 0;
      line-height: 1.45;
    }

    /* Open-Air Table */
    .gov-table-container {
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      max-height: 62vh;
      overflow-y: auto;
      overflow-x: auto;
      padding-right: 2px;
      box-shadow: var(--shadow-soft);
    }

    .gov-matrix-table thead th {
      position: sticky;
      top: 0;
      z-index: 5;
      background: var(--bg-subtle);
    }

    .gov-matrix-table tbody tr:last-child td {
      border-bottom: none;
      padding-bottom: 20px;
    }

    .gov-matrix-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .gov-matrix-table th {
      padding: 12px 16px;
      background: var(--bg-subtle);
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1px solid var(--border-hairline);
    }

    .matrix-row {
      border-bottom: 1px solid var(--border-hairline);
      transition: var(--transition-tactile);
    }

    .matrix-row:hover {
      background: var(--bg-subtle);
    }

    .gov-matrix-table td {
      padding: 12px 16px;
      font-size: 12.5px;
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
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .member-meta {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .member-name { font-size: 13px; color: var(--text-primary); }
    .member-email { font-size: 11px; }

    .squad-text { color: var(--text-secondary); font-size: 12px; }

    .tech-role-pill {
      font-size: 10.5px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      color: var(--text-secondary);
      border: 1px solid var(--border-hairline);
    }

    .role-select {
      padding: 5px 8px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      color: var(--text-primary);
      font-size: 11.5px;
      outline: none;
      transition: var(--transition-tactile);
    }

    .role-select:focus {
      border-color: var(--accent-primary);
      background: var(--bg-surface);
    }

    .role-badge-static {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      color: var(--text-secondary);
      border: 1px solid var(--border-hairline);
    }

    .budget-input-group {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .budget-num-input {
      width: 48px;
      padding: 4px 6px;
      border-radius: var(--radius-inner);
      border: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      color: var(--text-primary);
      font-size: 12px;
      text-align: center;
    }

    .budget-unit { font-size: 11px; color: var(--text-muted); }

    .capacity-bar-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-width: 170px;
    }

    .bar-track {
      height: 6px;
      background: var(--border-hairline);
      border-radius: var(--radius-pill);
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: var(--radius-pill);
      transition: width 0.3s var(--ease-tactile);
    }

    .fill-optimal { background: var(--status-done); }
    .fill-near { background: var(--accent-warn); }
    .fill-over { background: var(--accent-danger); }

    .bar-details-row {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: var(--text-muted);
    }

    .text-penalty { color: var(--accent-danger); font-weight: 600; }

    .status-chip {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      color: var(--text-secondary);
    }

    .chip-optimal { background: var(--status-done-bg); color: var(--status-done-text); }
    .chip-near { background: var(--accent-warn-tint); color: var(--accent-warn); }
    .chip-over { background: var(--status-blocked-bg); color: var(--status-blocked-text); }

    /* KPI CARDS */
    .kpi-cards-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px;
    }

    @media (max-width: 900px) {
      .kpi-cards-grid { grid-template-columns: 1fr; }
    }

    .gov-kpi-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      padding: 20px 24px;
      box-shadow: var(--shadow-soft);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .kpi-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .kpi-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }

    .kpi-pill {
      font-size: 10px;
      font-weight: 600;
      padding: 1px 7px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      color: var(--text-muted);
    }

    .pill-rework { background: var(--accent-danger-tint); color: var(--accent-danger); }
    .pill-drift { background: var(--accent-warn-tint); color: var(--accent-warn); }

    .kpi-val-row {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }

    .kpi-huge-number {
      font-size: 34px;
      font-weight: 600;
      font-family: var(--font-sans);
      color: var(--text-primary);
    }

    .kpi-unit { font-size: 12px; color: var(--text-muted); }
    .kpi-desc { font-size: 11.5px; color: var(--text-muted); line-height: 1.45; margin: 0; }

    .text-rework { color: var(--accent-danger); }
    .text-drift { color: var(--accent-warn); }

    /* Breakdown Panels */
    .analytics-split-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
    }

    @media (max-width: 900px) {
      .analytics-split-grid { grid-template-columns: 1fr; }
    }

    .analytics-subcard {
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      padding: 22px;
      box-shadow: var(--shadow-soft);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .subcard-heading {
      font-size: 17px;
      font-weight: 500;
      color: var(--text-primary);
      margin: 0;
    }

    .subcard-sub { font-size: 12px; color: var(--text-secondary); margin: 3px 0 0 0; }

    .project-breakdown-list, .slippage-breakdown-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .project-stat-item, .slip-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
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
      font-size: 10.5px;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
    }

    .item-name { font-size: 14px; font-weight: 500; color: var(--text-primary); }
    .item-stats { font-size: 11px; color: var(--text-muted); display: flex; gap: 8px; }

    .item-bar-track, .slip-track {
      height: 6px;
      background: var(--border-hairline);
      border-radius: var(--radius-pill);
      overflow: hidden;
    }

    .item-bar-fill, .slip-fill {
      height: 100%;
      border-radius: var(--radius-pill);
      transition: width 0.3s var(--ease-tactile);
    }

    .item-foot {
      display: flex;
      justify-content: space-between;
      color: var(--text-muted);
    }

    .slip-glyph {
      font-size: 14px;
      color: var(--accent-primary);
      display: flex;
      align-items: center;
    }

    .slip-name { font-size: 12.5px; color: var(--text-primary); }
    .slip-metric { font-size: 11px; color: var(--text-muted); }

    .slip-fill[data-reason="DEPENDENCY_BLOCKED"] { background: var(--accent-primary); }
    .slip-fill[data-reason="SCOPE_EXPANDED"] { background: var(--accent-warn); }
    .slip-fill[data-reason="PRODUCTION_HOTFIX"] { background: var(--accent-danger); }
    .slip-fill[data-reason="UNDERESTIMATED"] { background: #7B68AE; }

    /* AUDIT LOG */
    .audit-top-bar {
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      padding: 18px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      box-shadow: var(--shadow-soft);
    }

    .audit-seal-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .seal-lock-icon {
      font-size: 22px;
      color: var(--accent-primary);
      display: flex;
      align-items: center;
    }

    .seal-header-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .seal-title {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: var(--text-primary);
    }

    .soc-pill {
      font-size: 10px;
      font-weight: 600;
      padding: 1px 7px;
      border-radius: var(--radius-pill);
      background: var(--accent-primary-tint);
      color: var(--accent-primary);
    }

    .seal-note {
      font-size: 11.5px;
      color: var(--text-secondary);
      margin: 2px 0 0 0;
    }

    .export-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-export {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition-tactile);
    }

    .btn-export:hover {
      background: var(--accent-primary-tint);
      color: var(--accent-primary);
      border-color: rgba(92, 115, 98, 0.35);
      transform: translateY(-1px);
    }

    .audit-filter-toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-pill);
      padding: 8px 16px;
    }

    .audit-search-box {
      position: relative;
      display: flex;
      align-items: center;
      width: 280px;
    }

    .search-glyph {
      position: absolute;
      left: 10px;
      font-size: 13px;
      color: var(--text-muted);
      pointer-events: none;
      display: flex;
      align-items: center;
    }

    .audit-input {
      width: 100%;
      padding: 6px 26px 6px 30px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      color: var(--text-primary);
      font-size: 12px;
      outline: none;
      transition: var(--transition-tactile);
    }

    .audit-input:focus {
      background: var(--bg-surface);
      border-color: var(--accent-primary);
    }

    .btn-clear-audit {
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

    .audit-filter-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .filter-lbl { font-size: 11.5px; font-weight: 500; color: var(--text-secondary); }

    .audit-select {
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      color: var(--text-primary);
      font-size: 11.5px;
      outline: none;
      transition: var(--transition-tactile);
    }

    .audit-select:focus {
      border-color: var(--accent-primary);
    }

    .records-counter {
      margin-left: auto;
    }

    .actor-cell-wrap { display: flex; align-items: center; gap: 7px; }
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
      font-weight: 600;
      padding: 2px 7px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
    }

    .action-chip[data-action="STATUS_CHANGED"] { color: var(--accent-primary); border-color: rgba(92, 115, 98, 0.3); }
    .action-chip[data-action="REWORK_PENALTY"] { color: var(--accent-danger); border-color: rgba(200, 109, 81, 0.3); }
    .action-chip[data-action="SLIPPAGE_LOGGED"] { color: var(--accent-warn); border-color: rgba(197, 155, 78, 0.3); }
    .action-chip[data-action="MEMBER_ROLE_UPDATED"] { color: var(--status-done); border-color: rgba(78, 124, 89, 0.3); }
    .action-chip[data-action="SHARING_UPDATED"] { color: #79a8d4; border-color: rgba(90, 140, 180, 0.3); }
    .action-chip[data-action="PERMISSION_POLICY_UPDATED"] { color: var(--accent-primary); border-color: rgba(92, 115, 98, 0.3); }

    .audit-scope-banner {
      display: flex;
      align-items: center;
      padding: 10px 16px;
      border-radius: var(--radius-sm);
      background: var(--accent-primary-tint);
      border: 1px solid rgba(92, 115, 98, 0.25);
      color: var(--text-primary);
      font-size: 12px;
      margin-bottom: 4px;
    }

    .audit-scope-banner.is-personal {
      background: var(--bg-subtle);
      border-color: var(--border-hairline);
      color: var(--text-secondary);
    }

    .scope-banner-content {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .scope-banner-content .banner-icon {
      font-size: 16px;
      color: var(--accent-primary);
      flex-shrink: 0;
    }

    .audit-scope-banner.is-personal .banner-icon {
      color: var(--accent-warn);
    }

    .target-cell-wrap { display: flex; flex-direction: column; gap: 1px; }
    .target-title { font-size: 12.5px; color: var(--text-primary); font-weight: 500; }

    .details-cell-wrap { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .transition-tag {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
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
    const logs = this.store.visibleActivityLogs();
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
