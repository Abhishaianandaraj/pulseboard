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
          <h1 class="projects-title">Project Workspaces &amp; Squad Directories</h1>
          <p class="projects-sub">Autonomous technical initiatives, deliverable completion health, and cross-functional squad ownership</p>
        </div>
        <button type="button" class="btn-create-proj" (click)="openCreateModal()">
          + Create Project
        </button>
      </div>

      <!-- Project Cards Grid -->
      <div class="projects-grid">
        @for (proj of store.projects(); track proj.id) {
          @let pTasks = getProjectTasks(proj.id);
          @let doneCount = getDoneCount(pTasks);
          @let deployedCount = getDeployedCount(pTasks);
          @let blockedCount = getBlockedCount(pTasks);
          @let totalPoints = getTotalPoints(pTasks);
          @let progress = pTasks.length > 0 ? Math.round((doneCount / pTasks.length) * 100) : 0;
          @let squadMembers = getProjectSquadMembers(pTasks);

          <div class="project-card">
            <!-- Card Header -->
            <div class="proj-card-top">
              <div class="proj-title-group">
                <span class="proj-code-badge" [style.color]="proj.color">{{ proj.code }}</span>
                <h3 class="proj-card-name">{{ proj.name }}</h3>
              </div>
              <span class="proj-status-tag" [class.tag-active]="proj.status === 'ACTIVE'" [class.tag-staging]="proj.status === 'STAGING'">
                {{ proj.status }}
              </span>
            </div>

            <!-- Description -->
            <p class="proj-desc">{{ proj.description }}</p>

            <!-- Squad Tag -->
            <div class="proj-squad-row">
              <span class="squad-icon">🛡️</span>
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

            <!-- Card Bottom: Squad Avatars + Open Workspace Action -->
            <div class="proj-card-bottom">
              <div class="squad-avatars-row">
                @for (mem of squadMembers; track mem.id) {
                  <span
                    class="squad-mini-avatar"
                    [style.background-color]="mem.color"
                    [title]="mem.name + ' • ' + mem.role"
                  >
                    {{ mem.avatar }}
                  </span>
                }
              </div>

              <button type="button" class="btn-open-workspace" (click)="openWorkspace(proj.id)">
                Open Workspace →
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
              <h3>Create Project Workspace</h3>
              <button type="button" class="btn-close" (click)="closeCreateModal()">✕</button>
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
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      height: 100%;
      overflow-y: auto;
    }

    .projects-header-card {
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

    .projects-title {
      font-size: 18px;
      font-weight: 800;
      color: var(--text-primary);
      margin: 0;
    }

    .projects-sub {
      font-size: 12.5px;
      color: var(--text-secondary);
      margin: 3px 0 0 0;
    }

    .btn-create-proj {
      padding: 8px 16px;
      border-radius: 6px;
      background: var(--color-primary);
      color: #ffffff;
      border: none;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .btn-create-proj:hover {
      background: var(--color-primary-hover);
    }

    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 20px;
    }

    .project-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      padding: 20px;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: 14px;
      transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
    }

    .project-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
      border-color: var(--border-strong);
    }

    .proj-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .proj-title-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .proj-code-badge {
      font-size: 11px;
      font-weight: 800;
      font-family: var(--font-mono);
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      padding: 2px 7px;
      border-radius: 4px;
    }

    .proj-card-name {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .proj-status-tag {
      font-size: 9.5px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--bg-canvas);
      color: var(--text-secondary);
      border: 1px solid var(--border-subtle);
    }

    .tag-active {
      color: #059669;
      border-color: #10b981;
      background: rgba(16, 185, 129, 0.1);
    }

    .tag-staging {
      color: #7c3aed;
      border-color: #7c3aed;
      background: rgba(124, 58, 237, 0.1);
    }

    .proj-desc {
      font-size: 12px;
      color: var(--text-secondary);
      line-height: 1.45;
      margin: 0;
      min-height: 34px;
    }

    .proj-squad-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      color: var(--text-muted);
    }

    .proj-progress-section {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .progress-labels {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-secondary);
    }

    .progress-track-wrap {
      height: 7px;
      background: var(--bg-canvas);
      border-radius: 4px;
      overflow: hidden;
      border: 1px solid var(--border-subtle);
    }

    .progress-bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.2s ease;
    }

    .proj-metrics-matrix {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      padding: 8px 10px;
      text-align: center;
    }

    .metric-cell {
      display: flex;
      flex-direction: column;
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
    }

    .text-deployed { color: #7c3aed; }
    .text-blocked { color: #dc2626; }

    .proj-card-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 4px;
    }

    .squad-avatars-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .squad-mini-avatar {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      color: #ffffff;
      font-size: 9px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-open-workspace {
      padding: 6px 12px;
      border-radius: 6px;
      background: transparent;
      border: 1px solid var(--border-subtle);
      color: var(--color-primary);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.12s ease;
    }

    .btn-open-workspace:hover {
      background: var(--color-primary);
      color: #ffffff;
      border-color: var(--color-primary);
    }

    /* MODAL */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(10, 14, 20, 0.55);
      backdrop-filter: blur(2px);
      z-index: 95;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .modal-card {
      width: 100%;
      max-width: 480px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      box-shadow: var(--shadow-lg);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .modal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .modal-head h3 { font-size: 15px; font-weight: 700; margin: 0; }
    .btn-close { background: transparent; border: none; font-size: 16px; cursor: pointer; color: var(--text-muted); }

    .modal-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .form-group { display: flex; flex-direction: column; gap: 4px; }
    .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-label { font-size: 11.5px; font-weight: 600; color: var(--text-secondary); }
    .form-label.required::after { content: ' *'; color: #ef4444; }

    .form-input, .form-select, .form-textarea {
      padding: 7px 10px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-canvas);
      color: var(--text-primary);
      font-size: 12px;
      outline: none;
    }

    .modal-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      padding: 14px 20px;
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-elevated);
    }

    .btn-cancel {
      padding: 7px 14px;
      border-radius: 6px;
      background: transparent;
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      font-size: 12px;
      cursor: pointer;
    }

    .btn-submit {
      padding: 7px 16px;
      border-radius: 6px;
      background: var(--color-primary);
      border: none;
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
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
    return tasks.filter(t => t.blocked && t.status !== 'DONE').length;
  }

  getTotalPoints(tasks: Task[]): number {
    return tasks.reduce((sum, t) => sum + (Number(t.effortPoints) || 0), 0);
  }

  getProjectSquadMembers(tasks: Task[]): TeamMember[] {
    const assigneeIds = new Set(tasks.map(t => t.assigneeId));
    return this.store.teamMembers().filter(m => assigneeIds.has(m.id));
  }

  openWorkspace(projectId: string): void {
    this.store.selectProject(projectId);
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
    this.store.addProject(this.newProjName, this.newProjCode, this.newProjSquad, this.newProjDesc);
    this.closeCreateModal();
  }
}
