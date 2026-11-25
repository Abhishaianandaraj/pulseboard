import { Component, inject, computed, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { TaskStoreService } from './services/task-store.service';
import { TaskDrawerComponent } from './components/task-drawer.component';
import { SharePermissionsModalComponent } from './components/share-permissions-modal.component';
import { CreateTaskModalComponent } from './components/create-task-modal.component';
import { AiPromptModalComponent } from './components/ai-prompt-modal.component';
import { ImportModalComponent } from './components/import-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TaskDrawerComponent,
    SharePermissionsModalComponent,
    CreateTaskModalComponent,
    AiPromptModalComponent,
    ImportModalComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  protected readonly store = inject(TaskStoreService);
  private readonly router = inject(Router);

  readonly isAuthenticated = computed(() => this.store.isAuthenticated());
  readonly isShareModalOpen = signal<boolean>(false);
  readonly shareModalProjectId = signal<string | null>(null);
  readonly isNewTaskMenuOpen = signal<boolean>(false);

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.isNewTaskMenuOpen()) {
      this.isNewTaskMenuOpen.set(false);
    }
  }

  selectProject(projectId: string): void {
    this.store.selectProject(projectId);
  }

  openNewTask(): void {
    this.isNewTaskMenuOpen.set(false);
    this.store.openCreateTaskModal();
  }

  toggleNewTaskMenu(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.store.canCurrentUserCreateTasks()) return;
    this.isNewTaskMenuOpen.update(v => !v);
  }

  openAiQuickCapture(event: MouseEvent): void {
    event.stopPropagation();
    this.isNewTaskMenuOpen.set(false);
    this.store.openAiQuickCapture();
  }

  openImportJson(event: MouseEvent): void {
    event.stopPropagation();
    this.isNewTaskMenuOpen.set(false);
    this.store.openImportJsonModal();
  }

  openShareModal(projectId?: string): void {
    this.shareModalProjectId.set(projectId || null);
    this.isShareModalOpen.set(true);
  }

  closeShareModal(): void {
    this.isShareModalOpen.set(false);
  }

  logout(): void {
    this.store.logout();
    this.router.navigate(['/login']);
  }
}
