import { Component, inject, signal, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskStoreService } from '../services/task-store.service';
import { SystemRole, RolePermissionPolicy, TeamMember, Project } from '../models/task.model';

@Component({
  selector: 'app-share-permissions-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="close.emit()">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="modal-title-row">
            <span class="modal-icon-wrap">
              <i class="ph-light ph-users-three"></i>
            </span>
            <div>
              <h3 class="modal-title font-serif">Share &amp; Permissions<span class="brand-dot">.</span></h3>
              <p class="modal-sub">
                Granular project squad membership, role permissions, and personal vs. portfolio audit log visibility.
              </p>
            </div>
          </div>
          <button type="button" class="btn-close" (click)="close.emit()" title="Close dialog">
            <i class="ph-light ph-x"></i>
          </button>
        </div>

        <!-- Modal Body -->
        <div class="modal-body custom-scroll">
          <!-- Active Role Scope Indicator -->
          <div class="scope-banner" [class.is-personal]="!store.canCurrentUserViewAllLogs()">
            @if (store.canCurrentUserViewAllLogs()) {
              <i class="ph-light ph-shield-check banner-icon"></i>
              <div class="banner-text">
                <strong>Full Portfolio Audit View Active</strong>
                <span>Your role ({{ store.currentUserRole() }}) has permission to inspect all activity events across projects.</span>
              </div>
            } @else {
              <i class="ph-light ph-lock-simple banner-icon"></i>
              <div class="banner-text">
                <strong>Personal Activity View Active</strong>
                <span>Your audit log is scoped to actions you initiated or tasks assigned to you. Full logs are restricted to Tech Lead &amp; Delivery Manager.</span>
              </div>
            }
          </div>

          <!-- Section 1: Project Squad Access -->
          <div class="modal-section">
            <div class="section-header-row">
              <div class="section-title-wrap">
                <span class="section-step-pill">SECTION 1</span>
                <h4 class="section-title">Project Squad Access</h4>
              </div>

              <!-- Copy Link Action -->
              <button
                type="button"
                class="btn-copy-link"
                (click)="copyProjectLink()"
                [title]="copiedLink() ? 'Copied to clipboard!' : 'Copy shareable link'"
              >
                @if (copiedLink()) {
                  <i class="ph-light ph-check text-success"></i>
                  <span class="text-success font-medium">Link Copied!</span>
                } @else {
                  <i class="ph-light ph-link-simple"></i>
                  <span>Copy Workspace Link</span>
                }
              </button>
            </div>

            <!-- Project Selector Pills -->
            <div class="project-selector-row">
              <span class="field-label">Target Project:</span>
              <div class="project-pills">
                @for (p of store.projects(); track p.id) {
                  <button
                    type="button"
                    class="project-pill"
                    [class.active]="selectedProjectId() === p.id"
                    (click)="selectedProjectId.set(p.id)"
                  >
                    <span class="p-dot" [style.background-color]="p.color"></span>
                    <span class="p-code font-mono">{{ p.code }}</span>
                    <span class="p-count">({{ p.memberIds.length }})</span>
                  </button>
                }
              </div>
            </div>

            <!-- Project Squad Members Roster -->
            <div class="members-table-wrap">
              <div class="members-table-header">
                <span class="col-member">Team Member</span>
                <span class="col-role">System Role</span>
                <span class="col-status">Project Status</span>
                <span class="col-action">Access Toggle</span>
              </div>

              <div class="members-table-body">
                @for (member of store.teamMembers(); track member.id) {
                  <div class="member-row" [class.is-included]="isMemberAssigned(member.id)">
                    <!-- Member Info -->
                    <div class="col-member member-info-col">
                      <span class="avatar-mini" [style.background]="getMemberRoleColor(member.role)">{{ member.avatar }}</span>
                      <div class="member-meta">
                        <span class="member-name">{{ member.name }}</span>
                        <span class="member-role text-muted">{{ member.role }}</span>
                      </div>
                    </div>

                    <!-- System Role Badge -->
                    <div class="col-role">
                      <span class="role-badge font-mono" [attr.data-role]="member.systemRole">{{ member.systemRole }}</span>
                    </div>

                    <!-- Membership Status -->
                    <div class="col-status">
                      @if (isMemberAssigned(member.id)) {
                        <span class="status-pill status-member">
                          <i class="ph-light ph-check-circle"></i> Member
                        </span>
                      } @else {
                        <span class="status-pill status-non-member">
                          <i class="ph-light ph-lock-simple"></i> No Access
                        </span>
                      }
                    </div>

                    <!-- 1-Click Access Toggle Switch -->
                    <div class="col-action">
                      <button
                        type="button"
                        class="toggle-switch-btn"
                        [class.is-active]="isMemberAssigned(member.id)"
                        [disabled]="!store.canCurrentUserManageSharing()"
                        (click)="toggleMember(member.id)"
                        [title]="store.canCurrentUserManageSharing() ? (isMemberAssigned(member.id) ? 'Revoke project access' : 'Grant project access') : 'Only Tech Lead or Delivery Manager can alter project membership'"
                      >
                        <span class="switch-slider"></span>
                        <span class="switch-label font-mono">
                          {{ isMemberAssigned(member.id) ? 'Active' : 'Off' }}
                        </span>
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Section 2: Role Capabilities & Audit Visibility Matrix -->
          <div class="modal-section">
            <div class="section-header-row">
              <div class="section-title-wrap">
                <span class="section-step-pill">SECTION 2</span>
                <h4 class="section-title">Role Capabilities &amp; Visibility Matrix</h4>
              </div>
              @if (!store.canCurrentUserManageSharing()) {
                <span class="readonly-badge font-mono">
                  <i class="ph-light ph-lock-key"></i> Read-Only (Lead / Viewer Required)
                </span>
              }
            </div>
            <p class="section-desc">
              Define workspace-wide execution rights. When "View All Logs" is off, members in that role are restricted to their personal audit trail.
            </p>

            <div class="matrix-card">
              <div class="matrix-grid-header">
                <span class="col-m-role">Role</span>
                <span class="col-m-perm text-center">Create Deliverables</span>
                <span class="col-m-perm text-center">View All Logs</span>
                <span class="col-m-perm text-center">Approve Sign-Off</span>
              </div>

              <div class="matrix-grid-body">
                @for (r of policyRoles; track r) {
                  <div class="matrix-row">
                    <!-- Role Name -->
                    <div class="col-m-role">
                      <div class="role-cell">
                        <span class="role-badge font-mono" [attr.data-role]="r">{{ r }}</span>
                        <span class="role-desc text-muted">{{ getRoleDescription(r) }}</span>
                      </div>
                    </div>

                    <!-- Can Create Tasks -->
                    <div class="col-m-perm text-center">
                      <label class="matrix-toggle-label">
                        <input
                          type="checkbox"
                          class="toggle-checkbox"
                          [checked]="store.rolePolicies()[r].canCreateTasks"
                          [disabled]="!store.canCurrentUserManageSharing() || r === 'ADMIN'"
                          (change)="onTogglePolicy(r, 'canCreateTasks', $event)"
                        />
                        <span class="toggle-indicator"></span>
                      </label>
                    </div>

                    <!-- Can View All Logs -->
                    <div class="col-m-perm text-center">
                      <label class="matrix-toggle-label">
                        <input
                          type="checkbox"
                          class="toggle-checkbox"
                          [checked]="store.rolePolicies()[r].canViewAllLogs"
                          [disabled]="!store.canCurrentUserManageSharing() || r === 'ADMIN'"
                          (change)="onTogglePolicy(r, 'canViewAllLogs', $event)"
                        />
                        <span class="toggle-indicator"></span>
                      </label>
                    </div>

                    <!-- Can Approve Sign-Off -->
                    <div class="col-m-perm text-center">
                      <label class="matrix-toggle-label">
                        <input
                          type="checkbox"
                          class="toggle-checkbox"
                          [checked]="store.rolePolicies()[r].canApproveSignOff"
                          [disabled]="!store.canCurrentUserManageSharing() || r === 'ADMIN'"
                          (change)="onTogglePolicy(r, 'canApproveSignOff', $event)"
                        />
                        <span class="toggle-indicator"></span>
                      </label>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer">
          <div class="footer-meta text-muted">
            <i class="ph-light ph-clock-counter-clockwise"></i>
            <span>All permissions and sharing toggles are logged to the immutable audit ledger.</span>
          </div>
          <button type="button" class="btn-primary" (click)="close.emit()">
            Done
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
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      animation: fadeIn 0.15s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-card {
      background: var(--surface-modal);
      border: 1px solid var(--border-hairline);
      border-radius: 16px;
      width: 100%;
      max-width: 740px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.45);
      animation: slideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* Header */
    .modal-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border-hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      background: var(--surface-primary);
    }

    .modal-title-row {
      display: flex;
      align-items: center;
      gap: 0.875rem;
    }

    .modal-icon-wrap {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: var(--surface-subtle);
      border: 1px solid var(--border-hairline);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      color: var(--accent-primary);
      flex-shrink: 0;
    }

    .modal-title {
      font-size: 1.25rem;
      font-weight: 500;
      color: var(--text-primary);
      margin: 0;
      line-height: 1.2;
    }

    .brand-dot {
      color: var(--accent-primary);
    }

    .modal-sub {
      font-size: 0.8125rem;
      color: var(--text-muted);
      margin: 0.2rem 0 0;
      line-height: 1.4;
    }

    .btn-close {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.125rem;
      cursor: pointer;
      transition: all 0.15s ease;
      flex-shrink: 0;
    }

    .btn-close:hover {
      background: var(--surface-subtle);
      color: var(--text-primary);
      border-color: var(--border-hairline);
    }

    /* Modal Body */
    .modal-body {
      padding: 1.25rem 1.5rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    /* Scope Banner */
    .scope-banner {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: 10px;
      background: rgba(138, 158, 126, 0.08);
      border: 1px solid rgba(138, 158, 126, 0.25);
      color: var(--accent-primary);
    }

    .scope-banner.is-personal {
      background: rgba(200, 160, 60, 0.08);
      border-color: rgba(200, 160, 60, 0.25);
      color: var(--text-primary);
    }

    .banner-icon {
      font-size: 1.25rem;
      margin-top: 0.125rem;
      flex-shrink: 0;
    }

    .banner-text {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      font-size: 0.8125rem;
      line-height: 1.4;
    }

    .banner-text strong {
      font-size: 0.8125rem;
      font-weight: 600;
    }

    .banner-text span {
      color: var(--text-muted);
    }

    /* Section Headers */
    .modal-section {
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
    }

    .section-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .section-title-wrap {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .section-step-pill {
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      padding: 2px 8px;
      border-radius: 9999px;
      background: var(--surface-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-muted);
      white-space: nowrap;
    }

    .section-title {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .section-desc {
      font-size: 0.8125rem;
      color: var(--text-muted);
      margin: 0;
      line-height: 1.4;
    }

    .readonly-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.6875rem;
      padding: 3px 8px;
      border-radius: 9999px;
      background: var(--surface-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-muted);
      white-space: nowrap;
    }

    /* Copy Link Button */
    .btn-copy-link {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 4px 10px;
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--text-secondary);
      background: var(--surface-subtle);
      border: 1px solid var(--border-hairline);
      border-radius: 9999px;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .btn-copy-link:hover {
      color: var(--text-primary);
      border-color: var(--accent-primary);
      background: var(--surface-primary);
    }

    /* Project Pills */
    .project-selector-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .field-label {
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--text-muted);
      white-space: nowrap;
    }

    .project-pills {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .project-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
      background: var(--surface-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .project-pill:hover {
      border-color: var(--border-focus);
      color: var(--text-primary);
    }

    .project-pill.active {
      background: var(--surface-primary);
      border-color: var(--accent-primary);
      color: var(--text-primary);
      font-weight: 600;
      box-shadow: 0 0 0 1px var(--accent-primary);
    }

    .p-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .p-count {
      color: var(--text-muted);
      font-size: 0.6875rem;
    }

    /* Members Table */
    .members-table-wrap {
      border: 1px solid var(--border-hairline);
      border-radius: 12px;
      background: var(--surface-primary);
      overflow: hidden;
    }

    .members-table-header {
      display: grid;
      grid-template-columns: 2.2fr 1fr 1.2fr 1fr;
      padding: 0.625rem 1rem;
      background: var(--surface-subtle);
      border-bottom: 1px solid var(--border-hairline);
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }

    .members-table-body {
      display: flex;
      flex-direction: column;
    }

    .member-row {
      display: grid;
      grid-template-columns: 2.2fr 1fr 1.2fr 1fr;
      align-items: center;
      padding: 0.625rem 1rem;
      border-bottom: 1px solid var(--border-hairline);
      transition: background 0.12s ease;
    }

    .member-row:last-child {
      border-bottom: none;
    }

    .member-row:hover {
      background: var(--surface-subtle);
    }

    .member-info-col {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }

    .avatar-mini {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      color: #fff;
      font-size: 0.6875rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .member-meta {
      display: flex;
      flex-direction: column;
      line-height: 1.25;
      min-width: 0;
    }

    .member-name {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .member-role {
      font-size: 0.6875rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .role-badge {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 4px;
      background: var(--surface-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .role-badge[data-role="LEAD"],
    .role-badge[data-role="ADMIN"] {
      border-color: rgba(138, 158, 126, 0.4);
      color: var(--accent-primary);
    }

    .role-badge[data-role="VIEWER"] {
      border-color: rgba(90, 140, 180, 0.4);
      color: #79a8d4;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.6875rem;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 9999px;
      white-space: nowrap;
    }

    .status-member {
      background: rgba(138, 158, 126, 0.12);
      color: var(--accent-primary);
      border: 1px solid rgba(138, 158, 126, 0.3);
    }

    .status-non-member {
      background: var(--surface-subtle);
      color: var(--text-muted);
      border: 1px solid var(--border-hairline);
    }

    /* Switch button */
    .toggle-switch-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 2px;
    }

    .toggle-switch-btn:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .switch-slider {
      width: 32px;
      height: 18px;
      border-radius: 9999px;
      background: var(--surface-subtle);
      border: 1px solid var(--border-hairline);
      position: relative;
      transition: all 0.15s ease;
    }

    .switch-slider::after {
      content: '';
      position: absolute;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--text-muted);
      top: 2px;
      left: 2px;
      transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .toggle-switch-btn.is-active .switch-slider {
      background: var(--accent-primary);
      border-color: var(--accent-primary);
    }

    .toggle-switch-btn.is-active .switch-slider::after {
      background: #ffffff;
      transform: translateX(14px);
    }

    .switch-label {
      font-size: 0.6875rem;
      color: var(--text-muted);
    }

    .toggle-switch-btn.is-active .switch-label {
      color: var(--accent-primary);
      font-weight: 600;
    }

    /* Matrix Card */
    .matrix-card {
      border: 1px solid var(--border-hairline);
      border-radius: 12px;
      background: var(--surface-primary);
      overflow: hidden;
    }

    .matrix-grid-header {
      display: grid;
      grid-template-columns: 2.2fr 1fr 1fr 1fr;
      padding: 0.625rem 1rem;
      background: var(--surface-subtle);
      border-bottom: 1px solid var(--border-hairline);
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }

    .matrix-grid-body {
      display: flex;
      flex-direction: column;
    }

    .matrix-row {
      display: grid;
      grid-template-columns: 2.2fr 1fr 1fr 1fr;
      align-items: center;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-hairline);
      transition: background 0.12s ease;
    }

    .matrix-row:last-child {
      border-bottom: none;
    }

    .matrix-row:hover {
      background: var(--surface-subtle);
    }

    .role-cell {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }

    .role-desc {
      font-size: 0.6875rem;
      white-space: nowrap;
    }

    .text-center {
      text-align: center;
    }

    .matrix-toggle-label {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .toggle-checkbox {
      appearance: none;
      -webkit-appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 4px;
      border: 1px solid var(--border-hairline);
      background: var(--surface-subtle);
      cursor: pointer;
      position: relative;
      transition: all 0.15s ease;
      outline: none;
    }

    .toggle-checkbox:checked {
      background: var(--accent-primary);
      border-color: var(--accent-primary);
    }

    .toggle-checkbox:checked::after {
      content: '';
      position: absolute;
      left: 5px;
      top: 2px;
      width: 5px;
      height: 9px;
      border: solid #ffffff;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }

    .toggle-checkbox:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }

    /* Modal Footer */
    .modal-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--border-hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      background: var(--surface-primary);
    }

    .footer-meta {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
    }

    .btn-primary {
      padding: 0.5rem 1.25rem;
      border-radius: 9999px;
      font-size: 0.8125rem;
      font-weight: 600;
      background: var(--accent-primary);
      color: #ffffff;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .btn-primary:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    @media (max-width: 640px) {
      .members-table-header,
      .member-row,
      .matrix-grid-header,
      .matrix-row {
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
      }
      .col-role,
      .role-desc {
        display: none;
      }
    }
  `]
})
export class SharePermissionsModalComponent {
  readonly store = inject(TaskStoreService);

  readonly initialProjectId = input<string | null>(null);
  readonly close = output<void>();

  readonly selectedProjectId = signal<string>('p-1');
  readonly copiedLink = signal<boolean>(false);

  readonly policyRoles: SystemRole[] = ['ADMIN', 'LEAD', 'VIEWER', 'DEV', 'QA'];

  constructor() {
    // If initialProjectId is provided or store has an active project
    const init = this.initialProjectId();
    if (init && init !== 'ALL') {
      this.selectedProjectId.set(init);
    } else {
      const active = this.store.selectedProjectId();
      if (active !== 'ALL') {
        this.selectedProjectId.set(active);
      } else {
        const first = this.store.projects()[0];
        if (first) {
          this.selectedProjectId.set(first.id);
        }
      }
    }
  }

  isMemberAssigned(memberId: string): boolean {
    const proj = this.store.projects().find(p => p.id === this.selectedProjectId());
    if (!proj) return false;
    return (proj.memberIds || []).includes(memberId);
  }

  toggleMember(memberId: string): void {
    if (!this.store.canCurrentUserManageSharing()) return;
    this.store.toggleProjectMember(this.selectedProjectId(), memberId);
  }

  onTogglePolicy(role: SystemRole, key: 'canCreateTasks' | 'canViewAllLogs' | 'canApproveSignOff', event: Event): void {
    if (!this.store.canCurrentUserManageSharing()) return;
    const target = event.target as HTMLInputElement;
    const checked = target.checked;
    this.store.updateRolePermissionPolicy(role, { [key]: checked });
  }

  getRoleDescription(role: SystemRole): string {
    switch (role) {
      case 'ADMIN': return 'Full portfolio & root policy control';
      case 'LEAD': return 'Sprint sign-off & team management';
      case 'VIEWER': return 'Delivery executive & audit oversight';
      case 'DEV': return 'Core implementation & task updates';
      case 'QA': return 'Verification & defect tracking';
    }
  }

  getMemberRoleColor(roleTitle: string): string {
    if (roleTitle.includes('Lead')) return '#8a9e7e';
    if (roleTitle.includes('Delivery')) return '#79a8d4';
    if (roleTitle.includes('QA')) return '#c59b4e';
    return '#5a7860';
  }

  copyProjectLink(): void {
    const proj = this.store.projects().find(p => p.id === this.selectedProjectId());
    const code = proj ? proj.code : 'PORTFOLIO';
    const url = `${window.location.origin}${window.location.pathname}#/workspace?project=${code}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    this.copiedLink.set(true);
    setTimeout(() => {
      this.copiedLink.set(false);
    }, 2200);
  }
}
