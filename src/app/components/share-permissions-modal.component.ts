import { Component, inject, signal, computed, input, output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskStoreService } from '../services/task-store.service';
import {
  SystemRole,
  RolePermissionPolicy,
  TeamMember,
  MemberAccessRole
} from '../models/task.model';

type TeamSettingsTab = 'MEMBERS' | 'PROJECTS' | 'SETTINGS';

@Component({
  selector: 'app-share-permissions-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="close.emit()">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <!-- Sticky Header -->
        <div class="modal-header">
          <div class="modal-title-row">
            <span class="modal-icon-wrap">
              <i class="ph-light ph-users-three"></i>
            </span>
            <div>
              <h3 class="modal-title">Team &amp; Members — {{ store.brandName() }}</h3>
              <p class="modal-sub">
                Manage team members, projects, project access, workspace branding, and role permissions
              </p>
            </div>
          </div>
          <button type="button" class="btn-close" (click)="close.emit()" title="Close dialog">
            <i class="ph-light ph-x"></i>
          </button>
        </div>

        <!-- Tab Navigation Strip -->
        <div class="tabs-bar">
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab() === 'MEMBERS'"
            (click)="activeTab.set('MEMBERS')"
          >
            <i class="ph-light ph-users"></i>
            <span>Team Members ({{ store.teamMembers().length }})</span>
          </button>
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab() === 'PROJECTS'"
            (click)="activeTab.set('PROJECTS')"
          >
            <i class="ph-light ph-folder-simple"></i>
            <span>Projects &amp; Access ({{ store.projects().length }})</span>
          </button>
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab() === 'SETTINGS'"
            (click)="activeTab.set('SETTINGS')"
          >
            <i class="ph-light ph-gear-six"></i>
            <span>Team Settings &amp; Permissions</span>
          </button>
        </div>

        <!-- Scrollable Modal Body -->
        <div class="modal-body custom-scroll">
          @if (!store.canCurrentUserManageSharing()) {
            <div class="readonly-banner">
              <i class="ph-light ph-lock-simple"></i>
              <span>You are signed in with a Member role. Switch to a Lead or Manager profile to add/edit members, rename the workspace, or modify permissions.</span>
            </div>
          }

          @if (feedbackMessage()) {
            <div class="feedback-banner" [class.is-error]="feedbackIsError()">
              <i class="ph-light" [class.ph-warning]="feedbackIsError()" [class.ph-check-circle]="!feedbackIsError()"></i>
              <span>{{ feedbackMessage() }}</span>
            </div>
          }

          <!-- TAB 1: TEAM MEMBERS ROSTER (ADD / EDIT / REMOVE) -->
          @if (activeTab() === 'MEMBERS') {
            @if (store.canCurrentUserManageSharing()) {
              <div class="section-box">
                <div class="section-head">
                  <h4 class="section-title">Add Team Member</h4>
                </div>
                <div class="add-member-grid">
                  <input
                    type="text"
                    class="form-input"
                    [(ngModel)]="newMemberName"
                    placeholder="Full Name (e.g., Ananya Sharma)"
                  />
                  <input
                    type="email"
                    class="form-input"
                    [(ngModel)]="newMemberEmail"
                    placeholder="Email (e.g., ananya.s@tcs-ai.internal)"
                  />
                  <select class="form-select" [(ngModel)]="newMemberRole">
                    <option value="Member">Role: Member</option>
                    <option value="Lead">Role: Lead</option>
                    <option value="Manager">Role: Manager</option>
                  </select>
                  <button
                    type="button"
                    class="btn-primary"
                    [disabled]="!newMemberName.trim()"
                    (click)="submitAddMember()"
                  >
                    <i class="ph-light ph-user-plus"></i>
                    <span>Add Member</span>
                  </button>
                </div>
              </div>
            }

            <div class="section-box">
              <div class="section-head">
                <h4 class="section-title">Workspace Directory</h4>
                <span class="section-hint">Switch, edit, or remove team members</span>
              </div>

              <div class="roster-list">
                @for (member of store.teamMembers(); track member.id) {
                  <div class="roster-row">
                    @if (editingMemberId() === member.id) {
                      <!-- Inline Member Editor -->
                      <div class="edit-member-grid">
                        <input type="text" class="form-input" [(ngModel)]="editName" placeholder="Name" />
                        <input type="email" class="form-input" [(ngModel)]="editEmail" placeholder="Email" />
                        <select class="form-select" [(ngModel)]="editRole">
                          <option value="Member">Member</option>
                          <option value="Lead">Lead</option>
                          <option value="Manager">Manager</option>
                        </select>
                        <div class="edit-actions">
                          <button type="button" class="btn-primary btn-sm" (click)="saveMemberEdit(member.id)">Save</button>
                          <button type="button" class="btn-secondary btn-sm" (click)="cancelMemberEdit()">Cancel</button>
                        </div>
                      </div>
                    } @else {
                      <div class="member-info-left">
                        <span class="avatar-circle" [style.background-color]="member.color">{{ member.avatar }}</span>
                        <div class="member-text">
                          <div class="member-name-line">
                            <strong>{{ member.name }}</strong>
                            @if (member.id === store.currentUserId()) {
                              <span class="you-tag">Active User</span>
                            }
                          </div>
                          <span class="member-email">{{ member.email }} · {{ member.role }}</span>
                        </div>
                      </div>

                      <div class="member-actions-right">
                        <span class="access-role-pill" [attr.data-access]="store.getMemberAccessRole(member)">
                          {{ store.getMemberAccessRole(member) }}
                        </span>

                        @if (member.id !== store.currentUserId()) {
                          <button
                            type="button"
                            class="btn-secondary btn-sm"
                            (click)="store.switchCurrentUser(member.id)"
                            title="Switch active session to this member"
                          >
                            Switch User
                          </button>
                        }

                        @if (store.canCurrentUserManageSharing()) {
                          <button
                            type="button"
                            class="btn-icon"
                            (click)="startMemberEdit(member)"
                            title="Edit member"
                          >
                            <i class="ph-light ph-pencil-simple"></i>
                          </button>
                          @if (member.id !== store.currentUserId() && store.teamMembers().length > 1) {
                            <button
                              type="button"
                              class="btn-icon btn-icon-danger"
                              (click)="removeMember(member)"
                              title="Remove member"
                            >
                              <i class="ph-light ph-trash"></i>
                            </button>
                          }
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          }

          <!-- TAB 2: PROJECTS & PROJECT MEMBER ASSIGNMENT -->
          @if (activeTab() === 'PROJECTS') {
            @if (store.canCurrentUserManageSharing()) {
              <div class="section-box">
                <div class="section-head">
                  <h4 class="section-title">Create New Project</h4>
                </div>
                <div class="create-proj-grid">
                  <input
                    type="text"
                    class="form-input"
                    [(ngModel)]="newProjName"
                    placeholder="Project Name (e.g., Document Summarizer)"
                  />
                  <input
                    type="text"
                    class="form-input font-mono"
                    [(ngModel)]="newProjCode"
                    placeholder="Code (e.g., DOC-SUM)"
                  />
                  <input
                    type="text"
                    class="form-input"
                    [(ngModel)]="newProjTeam"
                    placeholder="Team / Squad Name"
                  />
                  <button
                    type="button"
                    class="btn-primary"
                    [disabled]="!newProjName.trim() || !newProjCode.trim()"
                    (click)="submitCreateProject()"
                  >
                    <i class="ph-light ph-plus"></i>
                    <span>Create Project</span>
                  </button>
                </div>
              </div>
            }

            <div class="section-box">
              <div class="section-head">
                <div>
                  <h4 class="section-title">Project Member Access</h4>
                  <span class="section-hint">Select a project below and toggle which team members belong to it</span>
                </div>
                <button type="button" class="btn-secondary btn-sm" (click)="copyProjectLink()">
                  <i class="ph-light" [class.ph-check]="copiedLink()" [class.ph-link-simple]="!copiedLink()"></i>
                  <span>{{ copiedLink() ? 'Link Copied!' : 'Copy Project Link' }}</span>
                </button>
              </div>

              <div class="project-pills-row">
                @for (p of store.projects(); track p.id) {
                  <button
                    type="button"
                    class="project-pill"
                    [class.active]="selectedProjectId() === p.id"
                    (click)="selectedProjectId.set(p.id)"
                  >
                    <span class="p-dot" [style.background-color]="p.color"></span>
                    <span class="font-mono">{{ p.code }}</span>
                    <span class="p-name">{{ p.name }}</span>
                    <span class="p-count font-mono">({{ p.memberIds.length }})</span>
                  </button>
                }
              </div>

              <div class="roster-list">
                @for (member of store.teamMembers(); track member.id) {
                  <div class="roster-row">
                    <div class="member-info-left">
                      <span class="avatar-circle" [style.background-color]="member.color">{{ member.avatar }}</span>
                      <div class="member-text">
                        <strong>{{ member.name }}</strong>
                        <span class="member-email">{{ member.email }} · {{ store.getMemberAccessRole(member) }}</span>
                      </div>
                    </div>

                    <div class="member-actions-right">
                      <span class="proj-access-status" [class.active]="isMemberAssigned(member.id)">
                        {{ isMemberAssigned(member.id) ? 'Assigned' : 'Not in Project' }}
                      </span>
                      <button
                        type="button"
                        class="toggle-switch-btn"
                        [class.is-active]="isMemberAssigned(member.id)"
                        [disabled]="!store.canCurrentUserManageSharing()"
                        (click)="toggleMember(member.id)"
                      >
                        <span class="switch-slider"></span>
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <!-- TAB 3: TEAM SETTINGS, BRANDING, PERMISSIONS & FRESH START -->
          @if (activeTab() === 'SETTINGS') {
            <!-- Workspace Branding -->
            <div class="section-box">
              <div class="section-head">
                <div>
                  <h4 class="section-title">Workspace Brand Name</h4>
                  <span class="section-hint">Displayed in the navigation sidebar, sign-in screen, and browser title</span>
                </div>
              </div>
              <div class="brand-edit-row">
                <input
                  type="text"
                  class="form-input"
                  [(ngModel)]="brandNameDraft"
                  [disabled]="!store.canCurrentUserManageSharing()"
                  placeholder="TCS-AI Initiatives"
                />
                <button
                  type="button"
                  class="btn-primary"
                  [disabled]="!store.canCurrentUserManageSharing() || !brandNameDraft.trim() || brandNameDraft.trim() === store.brandName()"
                  (click)="saveBrandName()"
                >
                  Save Brand Name
                </button>
              </div>
            </div>

            <!-- Role Capabilities Matrix -->
            <div class="section-box">
              <div class="section-head">
                <div>
                  <h4 class="section-title">Role Capabilities &amp; Activity Log Visibility</h4>
                  <span class="section-hint">Configure task creation, full vs. personal activity log scope, and review sign-off</span>
                </div>
              </div>

              <div class="matrix-table-wrap">
                <table class="matrix-table">
                  <thead>
                    <tr>
                      <th>System Role</th>
                      <th class="text-center">Create Tasks</th>
                      <th class="text-center">View All Activity Logs</th>
                      <th class="text-center">Approve Reviews</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of policyRoles; track r) {
                      <tr>
                        <td>
                          <strong>{{ r }}</strong>
                          <span class="role-sub">{{ getRoleDescription(r) }}</span>
                        </td>
                        <td class="text-center">
                          <input
                            type="checkbox"
                            [checked]="store.rolePolicies()[r].canCreateTasks"
                            [disabled]="!store.canCurrentUserManageSharing() || r === 'ADMIN'"
                            (change)="onTogglePolicy(r, 'canCreateTasks', $event)"
                          />
                        </td>
                        <td class="text-center">
                          <input
                            type="checkbox"
                            [checked]="store.rolePolicies()[r].canViewAllLogs"
                            [disabled]="!store.canCurrentUserManageSharing() || r === 'ADMIN'"
                            (change)="onTogglePolicy(r, 'canViewAllLogs', $event)"
                          />
                        </td>
                        <td class="text-center">
                          <input
                            type="checkbox"
                            [checked]="store.rolePolicies()[r].canApproveSignOff"
                            [disabled]="!store.canCurrentUserManageSharing() || r === 'ADMIN'"
                            (change)="onTogglePolicy(r, 'canApproveSignOff', $event)"
                          />
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Discreet Clear All Tasks (Start Fresh) for Leads / Managers -->
            @if (store.canCurrentUserManageSharing()) {
              <div class="section-box danger-box">
                <div class="danger-row">
                  <div>
                    <h4 class="section-title danger-title">Clear All Tasks (Start Fresh)</h4>
                    <p class="section-hint">
                      Removes all {{ store.tasks().length }} task(s) across projects while preserving your projects, team members, and workspace brand.
                    </p>
                  </div>

                  @if (!confirmingClearTasks()) {
                    <button
                      type="button"
                      class="btn-danger-outline"
                      [disabled]="store.tasks().length === 0"
                      (click)="confirmingClearTasks.set(true)"
                    >
                      <i class="ph-light ph-broom"></i>
                      <span>Clear All Tasks (Start Fresh)</span>
                    </button>
                  } @else {
                    <div class="confirm-clear-actions">
                      <button type="button" class="btn-danger-solid" (click)="executeClearAllTasks()">
                        Confirm Clear ({{ store.tasks().length }})
                      </button>
                      <button type="button" class="btn-secondary btn-sm" (click)="confirmingClearTasks.set(false)">
                        Cancel
                      </button>
                    </div>
                  }
                </div>
              </div>
            }
          }
        </div>

        <!-- Sticky Modal Footer -->
        <div class="modal-footer">
          <span class="footer-note">
            <i class="ph-light ph-shield-check"></i>
            <span>Changes are persisted via TaskRepository and recorded in the Activity Log</span>
          </span>
          <button type="button" class="btn-primary" (click)="close.emit()">Done</button>
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
      z-index: 120;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .modal-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      width: 100%;
      max-width: 820px;
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-float);
      overflow: hidden;
    }

    .modal-header {
      padding: 14px 20px;
      border-bottom: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-shrink: 0;
    }

    .modal-title-row {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .modal-icon-wrap {
      width: 34px;
      height: 34px;
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

    .modal-sub {
      font-size: 12px;
      color: var(--text-secondary);
      margin: 2px 0 0 0;
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

    .tabs-bar {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 20px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-hairline);
      flex-shrink: 0;
      overflow-x: auto;
    }

    .tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: var(--radius-pill);
      border: 1px solid transparent;
      background: transparent;
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }

    .tab-btn:hover {
      background: var(--bg-subtle);
      color: var(--text-primary);
    }

    .tab-btn.active {
      background: var(--accent-primary-tint);
      border-color: var(--accent-primary);
      color: var(--accent-primary);
    }

    .modal-body {
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }

    .readonly-banner, .feedback-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      border-radius: var(--radius-inner);
      font-size: 12px;
      background: var(--accent-primary-tint);
      border: 1px solid var(--accent-primary);
      color: var(--text-primary);
    }

    .feedback-banner.is-error {
      background: var(--accent-danger-tint);
      border-color: var(--accent-danger);
      color: var(--accent-danger);
    }

    .section-box {
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      background: var(--bg-subtle);
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    .section-title {
      font-size: 13.5px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .section-hint {
      font-size: 11.5px;
      color: var(--text-muted);
    }

    .add-member-grid {
      display: grid;
      grid-template-columns: 1.4fr 1.6fr 1fr auto;
      gap: 8px;
    }

    .create-proj-grid {
      display: grid;
      grid-template-columns: 1.5fr 0.9fr 1.2fr auto;
      gap: 8px;
    }

    .edit-member-grid {
      display: grid;
      grid-template-columns: 1.4fr 1.6fr 1fr auto;
      gap: 8px;
      width: 100%;
      align-items: center;
    }

    @media (max-width: 720px) {
      .add-member-grid,
      .create-proj-grid,
      .edit-member-grid {
        grid-template-columns: 1fr;
      }
    }

    .edit-actions {
      display: flex;
      gap: 6px;
    }

    .form-input, .form-select {
      padding: 7px 10px;
      border-radius: var(--radius-inner);
      border: 1px solid var(--border-strong);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: 12px;
      outline: none;
      min-width: 0;
    }

    .form-input:focus, .form-select:focus {
      border-color: var(--accent-primary);
    }

    .roster-list {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-inner);
      background: var(--bg-surface);
      overflow: hidden;
    }

    .roster-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border-hairline);
      flex-wrap: wrap;
    }

    .roster-row:last-child {
      border-bottom: none;
    }

    .member-info-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .avatar-circle {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .member-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .member-name-line {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12.5px;
      color: var(--text-primary);
    }

    .you-tag {
      font-size: 10px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--accent-primary-tint);
      color: var(--accent-primary);
    }

    .member-email {
      font-size: 11px;
      color: var(--text-muted);
    }

    .member-actions-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .access-role-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
    }

    .access-role-pill[data-access="Lead"] {
      background: var(--accent-primary-tint);
      border-color: var(--accent-primary);
      color: var(--accent-primary);
    }

    .access-role-pill[data-access="Manager"] {
      background: var(--status-done-bg);
      border-color: var(--status-done);
      color: var(--status-done-text);
    }

    .project-pills-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .project-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 11px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-hairline);
      background: var(--bg-surface);
      color: var(--text-secondary);
      font-size: 12px;
      cursor: pointer;
    }

    .project-pill.active {
      background: var(--accent-primary-tint);
      border-color: var(--accent-primary);
      color: var(--accent-primary);
      font-weight: 600;
    }

    .p-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .p-count {
      font-size: 11px;
      color: var(--text-muted);
    }

    .proj-access-status {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 500;
    }

    .proj-access-status.active {
      color: var(--status-done);
      font-weight: 600;
    }

    .toggle-switch-btn {
      width: 38px;
      height: 20px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-strong);
      background: var(--bg-subtle);
      position: relative;
      cursor: pointer;
      padding: 0;
      transition: var(--transition-tactile);
    }

    .toggle-switch-btn.is-active {
      background: var(--accent-primary);
      border-color: var(--accent-primary);
    }

    .toggle-switch-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .switch-slider {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #ffffff;
      transition: transform 0.16s ease;
    }

    .toggle-switch-btn.is-active .switch-slider {
      transform: translateX(18px);
    }

    .brand-edit-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .brand-edit-row .form-input {
      flex: 1;
    }

    .matrix-table-wrap {
      overflow-x: auto;
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-inner);
      background: var(--bg-surface);
    }

    .matrix-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    .matrix-table th, .matrix-table td {
      padding: 9px 12px;
      border-bottom: 1px solid var(--border-hairline);
      text-align: left;
    }

    .matrix-table th {
      background: var(--bg-subtle);
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .matrix-table tr:last-child td {
      border-bottom: none;
    }

    .matrix-table .text-center {
      text-align: center;
    }

    .role-sub {
      display: block;
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 400;
    }

    .danger-box {
      border-color: rgba(220, 38, 38, 0.35);
      background: var(--accent-danger-tint);
    }

    .danger-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
    }

    .danger-title {
      color: var(--accent-danger);
    }

    .confirm-clear-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--accent-primary);
      background: var(--accent-primary);
      color: var(--text-inverse);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 11px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-strong);
      background: var(--bg-surface);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
    }

    .btn-sm {
      padding: 4px 10px;
      font-size: 11.5px;
    }

    .btn-icon {
      border: 1px solid var(--border-hairline);
      background: var(--bg-surface);
      color: var(--text-secondary);
      width: 28px;
      height: 28px;
      border-radius: var(--radius-pill);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .btn-icon:hover {
      color: var(--text-primary);
      border-color: var(--border-strong);
    }

    .btn-icon-danger:hover {
      color: var(--accent-danger);
      border-color: var(--accent-danger);
    }

    .btn-danger-outline {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 13px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--accent-danger);
      background: var(--bg-surface);
      color: var(--accent-danger);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }

    .btn-danger-outline:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-danger-solid {
      padding: 6px 13px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--accent-danger);
      background: var(--accent-danger);
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }

    .modal-footer {
      padding: 12px 20px;
      border-top: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-shrink: 0;
    }

    .footer-note {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      color: var(--text-muted);
    }
  `]
})
export class SharePermissionsModalComponent implements OnInit {
  protected readonly store = inject(TaskStoreService);

  readonly initialProjectId = input<string | null>(null);
  readonly close = output<void>();

  readonly activeTab = signal<TeamSettingsTab>('MEMBERS');
  readonly selectedProjectId = signal<string>('proj-1');
  readonly copiedLink = signal<boolean>(false);
  readonly confirmingClearTasks = signal<boolean>(false);
  readonly feedbackMessage = signal<string>('');
  readonly feedbackIsError = signal<boolean>(false);

  readonly policyRoles: SystemRole[] = ['DEV', 'QA', 'LEAD', 'VIEWER', 'ADMIN'];

  // Add Member Form
  newMemberName = '';
  newMemberEmail = '';
  newMemberRole: MemberAccessRole = 'Member';

  // Edit Member Form
  readonly editingMemberId = signal<string | null>(null);
  editName = '';
  editEmail = '';
  editRole: MemberAccessRole = 'Member';

  // Create Project Form
  newProjName = '';
  newProjCode = '';
  newProjTeam = 'Core AI Engineering';

  // Workspace Brand Form
  brandNameDraft = '';

  readonly activeProject = computed(() =>
    this.store.projects().find(p => p.id === this.selectedProjectId()) || this.store.projects()[0]
  );

  ngOnInit(): void {
    this.brandNameDraft = this.store.brandName();
    const initId = this.initialProjectId();
    if (initId && initId !== 'ALL') {
      this.selectedProjectId.set(initId);
      this.activeTab.set('PROJECTS');
    } else {
      const storeSelected = this.store.selectedProjectId();
      if (storeSelected && storeSelected !== 'ALL') {
        this.selectedProjectId.set(storeSelected);
      } else if (this.store.projects().length > 0) {
        this.selectedProjectId.set(this.store.projects()[0].id);
      }
    }
  }

  private showFeedback(msg: string, isError = false): void {
    this.feedbackMessage.set(msg);
    this.feedbackIsError.set(isError);
    setTimeout(() => {
      if (this.feedbackMessage() === msg) {
        this.feedbackMessage.set('');
      }
    }, 3200);
  }

  submitAddMember(): void {
    if (!this.newMemberName.trim()) return;
    const allProjectIds = this.store.projects().map(p => p.id);
    const created = this.store.addTeamMemberWithAccessRole({
      name: this.newMemberName.trim(),
      email: this.newMemberEmail.trim(),
      accessRole: this.newMemberRole,
      projectIds: [this.selectedProjectId() || allProjectIds[0]].filter(Boolean)
    });
    if (created) {
      this.showFeedback(`Added ${created.name} (${this.newMemberRole}) to workspace.`);
      this.newMemberName = '';
      this.newMemberEmail = '';
      this.newMemberRole = 'Member';
    }
  }

  startMemberEdit(member: TeamMember): void {
    this.editingMemberId.set(member.id);
    this.editName = member.name;
    this.editEmail = member.email;
    this.editRole = this.store.getMemberAccessRole(member);
  }

  cancelMemberEdit(): void {
    this.editingMemberId.set(null);
  }

  saveMemberEdit(memberId: string): void {
    const ok = this.store.updateTeamMemberDetails(memberId, {
      name: this.editName,
      email: this.editEmail,
      accessRole: this.editRole
    });
    if (ok) {
      this.editingMemberId.set(null);
      this.showFeedback('Member details updated.');
    }
  }

  removeMember(member: TeamMember): void {
    const res = this.store.removeTeamMember(member.id);
    if (!res.success) {
      this.showFeedback(res.error || 'Unable to remove member.', true);
    } else {
      this.showFeedback(`Removed ${member.name} from workspace.`);
    }
  }

  submitCreateProject(): void {
    if (!this.newProjName.trim() || !this.newProjCode.trim()) return;
    const proj = this.store.addProject(
      this.newProjName.trim(),
      this.newProjCode.trim(),
      this.newProjTeam.trim() || 'Core AI Engineering'
    );
    this.selectedProjectId.set(proj.id);
    this.newProjName = '';
    this.newProjCode = '';
    this.showFeedback(`Created project [${proj.code}] ${proj.name}.`);
  }

  isMemberAssigned(memberId: string): boolean {
    const proj = this.activeProject();
    return proj ? (proj.memberIds || []).includes(memberId) : false;
  }

  toggleMember(memberId: string): void {
    const ok = this.store.toggleProjectMember(this.selectedProjectId(), memberId);
    if (!ok) {
      this.showFeedback('At least one member must remain assigned to each project.', true);
    }
  }

  saveBrandName(): void {
    const ok = this.store.updateBrandName(this.brandNameDraft);
    if (ok) {
      this.showFeedback(`Workspace renamed to "${this.store.brandName()}".`);
    }
  }

  onTogglePolicy(role: SystemRole, key: keyof Omit<RolePermissionPolicy, 'role'>, event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    this.store.updateRolePermissionPolicy(role, { [key]: inputEl.checked });
  }

  executeClearAllTasks(): void {
    this.store.clearAllTasks();
    this.confirmingClearTasks.set(false);
    this.showFeedback('All tasks cleared. Workspace is ready for fresh tasks.');
  }

  copyProjectLink(): void {
    const proj = this.activeProject();
    const url = `${window.location.origin}${window.location.pathname}#/workspace?project=${proj?.code || 'ALL'}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    this.copiedLink.set(true);
    setTimeout(() => this.copiedLink.set(false), 2200);
  }

  getRoleDescription(role: SystemRole): string {
    switch (role) {
      case 'DEV': return 'Member (Engineering)';
      case 'QA': return 'Member (Quality / Validation)';
      case 'LEAD': return 'Lead (Review Sign-Off & Scope)';
      case 'VIEWER': return 'Stakeholder (Read-Only Portfolio View)';
      case 'ADMIN': return 'Manager (Full Workspace Admin)';
    }
  }
}
