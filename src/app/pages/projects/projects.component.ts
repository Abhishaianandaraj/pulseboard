import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TaskStoreService } from '../../services/task-store.service';
import { Project, Task, TeamMember } from '../../models/task.model';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="projects-page-wrapper custom-scroll">
      <!-- Header -->
      <div class="projects-header-card">
        <div>
          <h1 class="projects-title font-serif">Project Workspaces &amp; Squad Directories<span class="brand-dot">.</span></h1>
          <p class="projects-sub">Autonomous technical initiatives, deliverable completion health, and cross-functional squad ownership</p>
        </div>
        <button type="button" class="btn-create-proj" (click)="openCreateModal()">
          <i class="ph-light ph-plus"></i>
          <span>Create Project</span>
        </button>
      </div>

      <!-- Project Cards Grid (Scoped to user visible projects) -->
      <div class="projects-grid">
        @for (proj of store.visibleProjects(); track proj.id) {
          @let pTasks = getProjectTasks(proj.id);
          @let doneCount = getDoneCount(pTasks);
          @let deployedCount = getDeployedCount(pTasks);
          @let blockedCount = getBlockedCount(pTasks);
          @let totalPoints = getTotalPoints(pTasks);
          @let progress = pTasks.length > 0 ? Math.round((doneCount / pTasks.length) * 100) : 0;
          @let squadMembers = getProjectSquadMembers(proj, pTasks);

          <div class="project-card">
            <!-- Card Header -->
            <div class="proj-card-top">
              <div class="proj-title-group">
                <span class="proj-code-badge font-mono" [style.color]="proj.color">{{ proj.code }}</span>
                <h3 class="proj-card-name font-serif">{{ proj.name }}</h3>
              </div>
              <span class="proj-status-tag" [class.tag-active]="proj.status === 'ACTIVE'" [class.tag-staging]="proj.status === 'STAGING'">
                {{ proj.status }}
              </span>
            </div>

            <!-- Description -->
            <p class="proj-desc">{{ proj.description }}</p>

            <!-- Squad Tag -->
            <div class="proj-squad-row">
              <span class="squad-icon">
                <i class="ph-light ph-users"></i>
              </span>
              <span class="squad-name">{{ proj.teamName }}</span>
            </div>

            <!-- Completion Progress -->
            <div class="proj-progress-section">
              <div class="progress-labels font-mono">
                <span>Progress: {{ doneCount }}/{{ pTasks.length }} Closed</span>
                <strong>{{ progress }}%</strong>
              </div>
              <div class="progress-track-wrap">
                <div class="progress-bar-fill" [style.background]="proj.color" [style.width.%]="progress"></div>
              </div>
            </div>

            <!-- Metrics Matrix -->
            <div class="proj-metrics-matrix font-mono">
              <div class="metric-cell">
                <span class="metric-num">{{ pTasks.length }}</span>
                <span class="metric-lbl">Deliverables</span>
              </div>
              <div class="metric-cell">
                <span class="metric-num" [class.text-deployed]="deployedCount > 0">{{ deployedCount }}</span>
                <span class="metric-lbl">Staged</span>
              </div>
              <div class="metric-cell">
                <span class="metric-num" [class.text-blocked]="blockedCount > 0">{{ blockedCount }}</span>
                <span class="metric-lbl">Blocked</span>
              </div>
              <div class="metric-cell">
                <span class="metric-num">{{ totalPoints }}p</span>
                <span class="metric-lbl">Points</span>
              </div>
            </div>

            <!-- Card Bottom: Stacked Squad Avatars + Open Workspace Action -->
            <div class="proj-card-bottom">
              <div class="avatar-stack">
                @for (mem of squadMembers; track mem.id) {
                  <span
                    class="avatar-stack-item"
                    [style.background-color]="mem.color"
                    [title]="mem.name + ' • ' + mem.role"
                  >
                    {{ mem.avatar }}
                  </span>
                }
              </div>

              <button type="button" class="btn-open-workspace" (click)="openWorkspace(proj.id)">
                <span>Open Workspace</span>
                <i class="ph-light ph-arrow-right"></i>
              </button>
            </div>
          </div>
        }
      </div>

      <!-- CREATE PROJECT MODAL -->
      @if (isCreateModalOpen()) {
        <div class="modal-backdrop" (click)="closeCreateModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-head">
              <h3 class="font-serif">Create Project Workspace</h3>
              <button type="button" class="btn-close" (click)="closeCreateModal()">
                <i class="ph-light ph-x"></i>
              </button>
            </div>
            <div class="modal-body custom-scroll">
              <div class="form-group">
                <label class="form-label required">Project Name</label>
                <input type="text" class="form-input" [(ngModel)]="newProjName" placeholder="e.g. Fine-Tuning Pipeline & LoRA Hub" />
              </div>
              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label required">Project Code</label>
                  <input type="text" class="form-input font-mono" [(ngModel)]="newProjCode" placeholder="e.g. LORA-HUB" />
                </div>
                <div class="form-group">
                  <label class="form-label">Squad / Team</label>
                  <select class="form-select" [(ngModel)]="newProjSquad">
                    <option value="Core AI Squad">Core AI Squad</option>
                    <option value="Platform & QA Squad">Platform & QA Squad</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-textarea" rows="3" [(ngModel)]="newProjDesc" placeholder="Scope, infrastructure, and deliverable goals..."></textarea>
              </div>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn-cancel" (click)="closeCreateModal()">Cancel</button>
              <button type="button" class="btn-submit" [disabled]="!newProjName.trim() || !newProjCode.trim()" (click)="submitCreateProject()">Create Workspace</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .projects-page-wrapper {
      padding: 24px 28px;
      display: flex;
      flex-direction: column;
      gap: 22px;
      height: 100%;
      overflow-y: auto;
      background: var(--bg-canvas);
    }

    .projects-header-card {
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

    .projects-title {
      font-size: 24px;
      font-weight: 500;
      color: var(--text-primary);
      margin: 0;
      letter-spacing: -0.02em;
    }

    .brand-dot {
      color: var(--accent-primary);
    }

    .projects-sub {
      font-size: 13px;
      color: var(--text-secondary);
      margin: 4px 0 0 0;
    }

    .btn-create-proj {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 8px 18px;
      border-radius: var(--radius-pill);
      background: var(--accent-primary);
      color: #ffffff;
      border: none;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      transition: var(--transition-tactile);
    }

    .btn-create-proj:hover {
      background: var(--accent-primary-hover);
      transform: translateY(-1px);
    }

    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 20px;
    }

    .project-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      padding: 22px;
      box-shadow: var(--shadow-soft);
      display: flex;
      flex-direction: column;
      gap: 15px;
      transition: var(--transition-tactile);
    }

    .project-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
      border-color: rgba(92, 115, 98, 0.4);
    }

    .proj-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .proj-title-group {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .proj-code-badge {
      font-size: 11px;
      font-weight: 700;
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      padding: 2px 8px;
      border-radius: var(--radius-pill);
    }

    .proj-card-name {
      font-size: 17px;
      font-weight: 500;
      color: var(--text-primary);
      margin: 0;
      letter-spacing: -0.01em;
    }

    .proj-status-tag {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      color: var(--text-secondary);
      border: 1px solid var(--border-hairline);
    }

    .tag-active {
      color: var(--status-done);
      border-color: rgba(78, 124, 89, 0.35);
      background: rgba(78, 124, 89, 0.1);
    }

    .tag-staging {
      color: var(--status-deployed);
      border-color: rgba(123, 104, 174, 0.35);
      background: rgba(123, 104, 174, 0.1);
    }

    .proj-desc {
      font-size: 12.5px;
      color: var(--text-secondary);
      line-height: 1.5;
      margin: 0;
      min-height: 38px;
    }

    .proj-squad-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      color: var(--text-muted);
    }

    .squad-icon {
      font-size: 14px;
      color: var(--accent-primary);
      display: flex;
      align-items: center;
    }

    .proj-progress-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .progress-labels {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-muted);
    }

    .progress-track-wrap {
      height: 6px;
      background: var(--border-hairline);
      border-radius: var(--radius-pill);
      overflow: hidden;
    }

    .progress-bar-fill {
      height: 100%;
      border-radius: var(--radius-pill);
      transition: width 0.3s var(--ease-tactile);
    }

    .proj-metrics-matrix {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-inner);
      padding: 8px 10px;
    }

    .metric-cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .metric-num {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .metric-lbl {
      font-size: 9.5px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .text-deployed { color: var(--status-deployed); }
    .text-blocked { color: var(--accent-danger); }

    .proj-card-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 6px;
      padding-top: 14px;
      border-top: 1px solid var(--border-hairline);
    }

    .btn-open-workspace {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: var(--radius-pill);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
      font-size: 11.5px;
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition-tactile);
    }

    .btn-open-workspace:hover {
      background: var(--accent-primary-tint);
      border-color: rgba(92, 115, 98, 0.3);
      color: var(--accent-primary);
      transform: translateY(-1px);
    }

    /* Modals */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(20, 19, 18, 0.45);
      backdrop-filter: blur(6px);
      z-index: 95;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .modal-card {
      width: 100%;
      max-width: 520px;
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-float);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .modal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 24px;
      border-bottom: 1px solid var(--border-hairline);
    }

    .modal-head h3 { font-size: 18px; font-weight: 500; margin: 0; }
    .btn-close {
      background: transparent;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      transition: var(--transition-tactile);
    }
    .btn-close:hover { color: var(--text-primary); }

    .modal-body {
      padding: 22px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-group { display: flex; flex-direction: column; gap: 5px; }
    .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-label { font-size: 11.5px; font-weight: 600; color: var(--text-secondary); }
    .form-label.required::after { content: ' *'; color: var(--accent-danger); }

    .form-input, .form-select, .form-textarea {
      padding: 8px 12px;
      border-radius: var(--radius-inner);
      border: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      color: var(--text-primary);
      font-size: 12.5px;
      outline: none;
      transition: var(--transition-tactile);
    }

    .form-input:focus, .form-select:focus, .form-textarea:focus {
      background: var(--bg-surface);
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 2px var(--accent-primary-tint);
    }

    .modal-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 24px;
      border-top: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
    }

    .btn-cancel {
      padding: 8px 16px;
      border-radius: var(--radius-pill);
      background: transparent;
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition-tactile);
    }

    .btn-cancel:hover {
      background: var(--bg-surface);
      color: var(--text-primary);
    }

    .btn-submit {
      padding: 8px 18px;
      border-radius: var(--radius-pill);
      background: var(--accent-primary);
      border: none;
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      transition: var(--transition-tactile);
    }

    .btn-submit:hover:not(:disabled) {
      background: var(--accent-primary-hover);
      transform: translateY(-1px);
    }
  `]
})
export class ProjectsComponent {
  protected readonly store = inject(TaskStoreService);
  private readonly router = inject(Router);
  protected readonly Math = Math;

  readonly isCreateModalOpen = signal<boolean>(false);
  newProjName = '';
  newProjCode = '';
  newProjSquad = 'Core AI Squad';
  newProjDesc = '';

  getProjectTasks(projectId: string): Task[] {
    return this.store.tasks().filter(t => t.projectId === projectId);
  }

  getDoneCount(tasks: Task[]): number {
    return tasks.filter(t => t.status === 'DONE').length;
  }

  getDeployedCount(tasks: Task[]): number {
    return tasks.filter(t => t.status === 'DEPLOYED').length;
  }

  getBlockedCount(tasks: Task[]): number {
    return tasks.filter(t => t.blocked).length;
  }

  getTotalPoints(tasks: Task[]): number {
    return tasks.reduce((sum, t) => sum + (t.effortPoints || 0), 0);
  }

  getProjectSquadMembers(proj: Project, tasks: Task[]): TeamMember[] {
    const memberIds = new Set<string>();
    (proj.memberIds || []).forEach(id => memberIds.add(id));
    tasks.forEach(t => {
      (t.assigneeIds || []).forEach(id => memberIds.add(id));
      if (t.assigneeId) memberIds.add(t.assigneeId);
    });
    return Array.from(memberIds)
      .map(id => this.store.assigneeMap().get(id))
      .filter((m): m is TeamMember => !!m);
  }

  openWorkspace(projectId: string): void {
    this.store.selectedProjectId.set(projectId);
    this.router.navigate(['/workspace']);
  }

  openCreateModal(): void {
    this.newProjName = '';
    this.newProjCode = '';
    this.newProjSquad = 'Core AI Squad';
    this.newProjDesc = '';
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
  }

  submitCreateProject(): void {
    if (!this.newProjName.trim() || !this.newProjCode.trim()) return;

    this.store.addProject(
      this.newProjName.trim(),
      this.newProjCode.trim().toUpperCase(),
      this.newProjSquad,
      this.newProjDesc.trim() || 'Engineering deliverables and milestone targets.'
    );

    this.closeCreateModal();
  }
}
