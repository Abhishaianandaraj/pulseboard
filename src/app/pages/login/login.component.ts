import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TaskStoreService } from '../../services/task-store.service';
import { TeamMember } from '../../models/task.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="login-wrapper">
      <div class="login-theme-bar">
        <button type="button" class="btn-theme-toggle" (click)="store.toggleTheme()" [title]="'Switch to ' + (store.theme() === 'dark' ? 'Light' : 'Dark') + ' Mode'">
          {{ store.theme() === 'dark' ? '☀️ Light' : '🌙 Dark' }}
        </button>
      </div>

      <div class="login-card">
        <div class="login-brand-header">
          <div class="brand-badge-row">
            <div class="brand-logo-icon">⚡</div>
            <span class="brand-version-chip">PulseBoard V2</span>
          </div>
          <h1 class="login-title">Welcome to PulseBoard</h1>
          <p class="login-sub">Calm, portfolio-grade delivery management for high-velocity AI engineering teams</p>
        </div>

        <!-- Corporate SSO Action -->
        <div class="sso-section">
          <button type="button" class="btn-sso-primary" (click)="loginAs(store.currentUser().id)">
            <span class="sso-key-icon">🔑</span>
            <span class="sso-text">Continue with Corporate SSO</span>
            <span class="sso-actor-pill">{{ store.currentUser().name.split(' ')[0] }}</span>
          </button>
          <div class="divider-row">
            <span class="divider-line"></span>
            <span class="divider-label">OR CHOOSE A DEMO PERSONA</span>
            <span class="divider-line"></span>
          </div>
        </div>

        <!-- Quick Workspace Role Entry -->
        <div class="persona-selection-area">
          <span class="persona-section-title">Quick Workspace Role Entry</span>
          <div class="persona-cards-grid">
            @for (member of store.teamMembers(); track member.id) {
              <div
                class="persona-card"
                [class.selected]="store.currentUserId() === member.id"
                (click)="loginAs(member.id)"
              >
                <div class="persona-avatar-wrap">
                  <span class="persona-avatar" [style.background-color]="member.color">{{ member.avatar }}</span>
                  <span class="persona-role-indicator" [attr.data-role]="member.systemRole">{{ member.systemRole }}</span>
                </div>
                <div class="persona-info">
                  <div class="persona-name-row">
                    <strong class="persona-name">{{ member.name }}</strong>
                    <span class="persona-tech-tag">{{ member.role }}</span>
                  </div>
                  <span class="persona-squad text-muted">{{ member.squad }}</span>
                  <span class="persona-pace-pill">
                    {{ store.getMemberLoadMetric(member.id).label }}
                  </span>
                </div>
                <span class="persona-enter-arrow">→</span>
              </div>
            }
          </div>
        </div>

        <div class="login-footer">
          <span class="compliance-tag">🔒 End-to-End Client Isolation · Zero External Telemetry · Air-Gap Ready</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-wrapper {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: var(--bg-canvas);
      padding: 24px;
      position: relative;
    }

    .login-theme-bar {
      position: absolute;
      top: 20px;
      right: 24px;
    }

    .btn-theme-toggle {
      padding: 6px 12px;
      border-radius: 20px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-theme-toggle:hover {
      background: var(--bg-elevated);
      color: var(--text-primary);
    }

    .login-card {
      width: 100%;
      max-width: 580px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 14px;
      padding: 36px 32px;
      box-shadow: var(--shadow-lg);
      display: flex;
      flex-direction: column;
      gap: 22px;
    }

    .login-brand-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 8px;
    }

    .brand-badge-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .brand-logo-icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      color: #ffffff;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
    }

    .brand-version-chip {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      background: rgba(124, 58, 237, 0.12);
      border: 1px solid rgba(124, 58, 237, 0.35);
      color: #8b5cf6;
    }

    .login-title {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--text-primary);
      margin: 4px 0 0 0;
    }

    .login-sub {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.5;
      margin: 0;
    }

    .sso-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .btn-sso-primary {
      width: 100%;
      padding: 12px 18px;
      border-radius: 8px;
      background: var(--color-primary);
      color: #ffffff;
      border: none;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: background-color 0.15s ease, transform 0.1s ease;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
    }

    .btn-sso-primary:hover {
      background: var(--color-primary-hover);
      transform: translateY(-1px);
    }

    .sso-actor-pill {
      font-size: 11px;
      background: rgba(255, 255, 255, 0.25);
      padding: 2px 7px;
      border-radius: 10px;
      font-weight: 600;
    }

    .divider-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .divider-line {
      flex: 1;
      height: 1px;
      background: var(--border-subtle);
    }

    .divider-label {
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }

    .persona-selection-area {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .persona-section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-secondary);
    }

    .persona-cards-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 290px;
      overflow-y: auto;
      padding-right: 4px;
    }

    .persona-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-radius: 8px;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .persona-card:hover {
      background: var(--bg-elevated);
      border-color: var(--color-primary);
      transform: translateX(2px);
    }

    .persona-card.selected {
      border-color: var(--color-primary);
      background: rgba(37, 99, 235, 0.05);
    }

    .persona-avatar-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      margin-right: 12px;
    }

    .persona-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .persona-role-indicator {
      font-size: 8.5px;
      font-weight: 800;
      padding: 1px 4px;
      border-radius: 3px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
    }

    .persona-role-indicator[data-role="LEAD"], .persona-role-indicator[data-role="ADMIN"] {
      color: #059669;
      border-color: #10b981;
    }

    .persona-role-indicator[data-role="QA"] {
      color: #0891b2;
      border-color: #06b6d4;
    }

    .persona-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .persona-name-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .persona-name {
      font-size: 13px;
      color: var(--text-primary);
    }

    .persona-tech-tag {
      font-size: 10.5px;
      color: var(--text-muted);
    }

    .persona-squad {
      font-size: 11px;
    }

    .persona-pace-pill {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .persona-enter-arrow {
      font-size: 16px;
      color: var(--text-muted);
      transition: transform 0.15s ease, color 0.15s ease;
      margin-left: 8px;
    }

    .persona-card:hover .persona-enter-arrow {
      color: var(--color-primary);
      transform: translateX(3px);
    }

    .login-footer {
      text-align: center;
      padding-top: 4px;
      border-top: 1px solid var(--border-subtle);
    }

    .compliance-tag {
      font-size: 10.5px;
      color: var(--text-muted);
    }
  `]
})
export class LoginComponent {
  protected readonly store = inject(TaskStoreService);
  private readonly router = inject(Router);

  loginAs(memberId: string): void {
    this.store.loginWithPersona(memberId);
    this.router.navigate(['/my-day']);
  }
}
