import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { TaskStoreService } from './services/task-store.service';
import { TaskDrawerComponent } from './components/task-drawer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TaskDrawerComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  protected readonly store = inject(TaskStoreService);
  private readonly router = inject(Router);

  readonly isAuthenticated = computed(() => this.store.isAuthenticated());

  selectProject(projectId: string): void {
    this.store.selectProject(projectId);
  }

  logout(): void {
    this.store.logout();
    this.router.navigate(['/login']);
  }
}
