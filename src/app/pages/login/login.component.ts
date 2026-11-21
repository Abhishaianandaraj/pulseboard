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
        <button
          type="button"
          class="btn-theme-toggle"
          (click)="store.toggleTheme()"
          [title]="'Switch to ' + (store.theme() === 'dark' ? 'Alabaster & Sage' : 'Sumi Ink & Moss')"
        >
          <i class="ph-light" [class.ph-sun]="store.theme() === 'dark'" [class.ph-moon]="store.theme() !== 'dark'"></i>
          <span>{{ store.theme() === 'dark' ? 'Alabaster Mode' : 'Sumi Mode' }}</span>
        </button>
      </div>

      <div class="login-card">
        <div class="login-brand-header">
          <div class="brand-badge-row">
            <div class="brand-logo-icon">
              <i class="ph-light ph-wave-sine"></i>
            </div>
            <span class="brand-version-chip">v3.0 Kanso</span>
          </div>
          <h1 class="login-title font-serif">PulseBoard<span class="brand-dot">.</span></h1>
          <p class="login-sub">Calm, portfolio-grade delivery management for high-velocity AI engineering teams</p>
        </div>

        <!-- Corporate SSO Action -->
        <div class="sso-section">
          <button type="button" class="btn-sso-primary" (click)="loginAs(store.currentUser().id)">
            <span class="sso-key-icon">
              <i class="ph-light ph-key"></i>
            </span>
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
          <div class="persona-cards-grid custom-scroll">
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
                <span class="persona-enter-arrow">
                  <i class="ph-light ph-arrow-right"></i>
                </span>
              </div>
            }
          </div>
        </div>

        <div class="login-footer">
          <span class="compliance-tag">
            <i class="ph-light ph-shield-check"></i>
            Client Isolation · Zero External Telemetry · Air-Gap Ready
          </span>
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
      top: 24px;
      right: 28px;
    }

    .btn-theme-toggle {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 7px 14px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-hairline);
      background: var(--bg-surface);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      transition: var(--transition-tactile);
    }

    .btn-theme-toggle:hover {
      background: var(--bg-subtle);
      color: var(--text-primary);
      transform: translateY(-1px);
    }

    .login-card {
      width: 100%;
      max-width: 560px;
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-card);
      padding: 38px 36px;
      box-shadow: var(--shadow-float);
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
      border-radius: var(--radius-inner);
      background: var(--accent-primary);
      color: #ffffff;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(92, 115, 98, 0.25);
    }

    .brand-version-chip {
      font-size: 10.5px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: var(--radius-pill);
      background: var(--accent-primary-tint);
      border: 1px solid rgba(92, 115, 98, 0.2);
      color: var(--accent-primary);
    }

    .login-title {
      font-family: var(--font-serif);
      font-size: 28px;
      font-weight: 500;
      letter-spacing: -0.02em;
      color: var(--text-primary);
      margin: 4px 0 0 0;
    }

    .brand-dot {
      color: var(--accent-primary);
    }

    .login-sub {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.5;
      margin: 0;
      max-width: 440px;
    }

    .sso-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .btn-sso-primary {
      width: 100%;
      padding: 12px 20px;
      border-radius: var(--radius-pill);
      background: var(--accent-primary);
      color: #ffffff;
      border: none;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: var(--transition-tactile);
      box-shadow: 0 4px 14px rgba(92, 115, 98, 0.3);
    }

    .btn-sso-primary:hover {
      background: var(--accent-primary-hover);
      transform: translateY(-1px);
    }

    .btn-sso-primary:active {
      transform: scale(0.99);
    }

    .sso-key-icon {
      font-size: 16px;
      display: flex;
      align-items: center;
    }

    .sso-actor-pill {
      font-size: 11px;
      background: rgba(255, 255, 255, 0.22);
      padding: 2px 8px;
      border-radius: var(--radius-pill);
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
      background: var(--border-hairline);
    }

    .divider-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }

    .persona-selection-area {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .persona-section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-secondary);
    }

    .persona-cards-grid {
      display: flex;
      flex-direction: column;
      gap: 7px;
      max-height: 290px;
      overflow-y: auto;
      padding-right: 4px;
    }

    .persona-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-radius: var(--radius-inner);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      cursor: pointer;
      transition: var(--transition-tactile);
    }

    .persona-card:hover {
      background: var(--bg-surface);
      border-color: var(--accent-primary);
      transform: translateY(-1px) translateX(2px);
      box-shadow: var(--shadow-sm);
    }

    .persona-card.selected {
      border-color: var(--accent-primary);
      background: var(--accent-primary-tint);
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
      font-weight: 700;
      padding: 1px 5px;
      border-radius: var(--radius-pill);
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
    }

    .persona-role-indicator[data-role="LEAD"], .persona-role-indicator[data-role="ADMIN"] {
      color: var(--status-done);
      border-color: rgba(78, 124, 89, 0.4);
    }

    .persona-role-indicator[data-role="QA"] {
      color: var(--status-deployed);
      border-color: rgba(123, 104, 174, 0.4);
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
      font-weight: 600;
      color: var(--text-primary);
    }

    .persona-tech-tag {
      font-size: 10.5px;
      color: var(--text-muted);
    }

    .persona-squad {
      font-size: 11px;
    }

    .text-muted {
      color: var(--text-muted);
    }

    .persona-pace-pill {
      font-size: 10px;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .persona-enter-arrow {
      font-size: 14px;
      color: var(--text-muted);
      transition: var(--transition-tactile);
      margin-left: 8px;
      display: flex;
      align-items: center;
    }

    .persona-card:hover .persona-enter-arrow {
      color: var(--accent-primary);
      transform: translateX(3px);
    }

    .login-footer {
      text-align: center;
      padding-top: 6px;
      border-top: 1px solid var(--border-hairline);
    }

    .compliance-tag {
      font-size: 10.5px;
      color: var(--text-muted);
      display: inline-flex;
      align-items: center;
      gap: 6px;
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
