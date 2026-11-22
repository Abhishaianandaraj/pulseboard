import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { TaskStoreService } from './services/task-store.service';
import { TaskDrawerComponent } from './components/task-drawer.component';
import { SharePermissionsModalComponent } from './components/share-permissions-modal.component';

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
    SharePermissionsModalComponent
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

  selectProject(projectId: string): void {
    this.store.selectProject(projectId);
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
