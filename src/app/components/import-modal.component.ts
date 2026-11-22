import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskStoreService } from '../services/task-store.service';
import { SAMPLE_IMPORT_JSON } from '../data/seed-data';

@Component({
  selector: 'app-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="close()">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="modal-title-row">
            <span class="modal-icon-wrap">
              <i class="ph-light ph-tray-arrow-down"></i>
            </span>
            <div>
              <h3 class="modal-title font-serif">Smart Import Deliverables<span class="brand-dot">.</span></h3>
              <p class="modal-sub">
                Ingest tasks into PulseBoard schema with automatic project linkage and new squad member registration
              </p>
            </div>
          </div>
          <button type="button" class="btn-close" (click)="close()">
            <i class="ph-light ph-x"></i>
          </button>
        </div>

        <!-- Modal Body -->
        <div class="modal-body custom-scroll">
          <!-- Step 1: Copy Prompt Template -->
          <div class="step-card">
            <div class="step-info">
              <span class="step-badge">STEP 1</span>
              <div>
                <strong class="step-title">Copy LLM Extraction Prompt</strong>
                <p class="step-desc">
                  Prompt instructs LLM to output valid JSON matching project codes (RAG-CORE, EVAL-GW, PULSE-V1) and squad roles.
                </p>
              </div>
            </div>
            <button type="button" class="btn-copy-prompt" (click)="copyPrompt()">
              <i class="ph-light" [class.ph-check]="isCopied()" [class.ph-copy]="!isCopied()"></i>
              <span>{{ isCopied() ? 'Copied to Clipboard!' : 'Copy Extraction Prompt' }}</span>
            </button>
          </div>

          <!-- Step 2: Paste JSON or Load 1-Click Demo -->
          <div class="step-2-header">
            <div class="step-2-title-wrap">
              <span class="step-badge step-2">STEP 2</span>
              <strong class="step-title">Paste Structured JSON</strong>
            </div>
            <button type="button" class="btn-load-sample" (click)="loadSampleJson()">
              <i class="ph-light ph-file-code"></i>
              <span>Load Sample Delivery JSON</span>
            </button>
          </div>

          <!-- JSON Code Textarea -->
          <textarea
            class="json-textarea custom-scroll"
            rows="9"
            [(ngModel)]="jsonInput"
            placeholder='{\n  "tasks": [\n    {\n      "title": "Optimize Triton FP8 Dynamic Batching",\n      "projectCode": "RAG-CORE",\n      "assigneeName": "Priya Nair",\n      "assigneeRole": "AI Engineer",\n      "priority": "HIGH",\n      "subtasks": ["Tune scheduler", "Test p99 latency"]\n    }\n  ]\n}'
          ></textarea>

          <!-- Error Alert Banner -->
          @if (errorMessage()) {
            <div class="alert-box error">
              <i class="ph-light ph-warning"></i>
              <span>{{ errorMessage() }}</span>
            </div>
          }

          <!-- Success Alert Banner -->
          @if (successMessage()) {
            <div class="alert-box success">
              <i class="ph-light ph-check-circle"></i>
              <span>{{ successMessage() }}</span>
            </div>
          }
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer">
          <div class="footer-note">
            <span class="arch-tag">Auto-Squad Onboarding</span>
            <span>New engineers auto-registered into squads if not yet present</span>
          </div>
          <div class="footer-actions">
            <button type="button" class="btn-cancel" (click)="close()">Cancel</button>
            <button
              type="button"
              class="btn-import"
              [disabled]="!jsonInput.trim()"
              (click)="executeImport()"
            >
              <i class="ph-light ph-tray-arrow-down"></i>
              <span>Import to Workspace</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(20, 19, 18, 0.45);
      backdrop-filter: blur(6px);
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      animation: fadeIn 0.18s ease-out;
    }
    .modal-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      width: 700px;
      max-width: 95vw;
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-float);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: scaleIn 0.22s var(--ease-tactile);
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes scaleIn { from { transform: scale(0.97); opacity: 0; } to { transform: scale(1); opacity: 1; } }

    .modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .modal-title-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .modal-icon-wrap {
      font-size: 20px;
      color: var(--accent-primary);
      display: flex;
      align-items: center;
    }
    .modal-title {
      font-size: 20px;
      font-weight: 500;
      color: var(--text-primary);
      margin: 0;
      letter-spacing: -0.01em;
    }
    .brand-dot {
      color: var(--accent-primary);
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
      display: flex;
      align-items: center;
      transition: var(--transition-tactile);
    }
    .btn-close:hover { color: var(--text-primary); }

    .modal-body {
      padding: 24px 24px 36px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-height: 72vh;
      overflow-y: auto;
    }
    .step-card {
      padding: 14px 18px;
      border-radius: var(--radius-inner);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .step-info {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .step-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      flex-shrink: 0;
      background: var(--accent-primary);
      color: #ffffff;
      line-height: 1.2;
    }
    .step-badge.step-2 {
      background: var(--accent-warn);
      color: #ffffff;
    }
    .step-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
    }
    .step-desc {
      font-size: 11.5px;
      color: var(--text-secondary);
      margin: 2px 0 0 0;
    }
    .btn-copy-prompt {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      color: var(--text-primary);
      border-radius: var(--radius-pill);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      transition: var(--transition-tactile);
      box-shadow: var(--shadow-sm);
    }
    .btn-copy-prompt:hover {
      border-color: var(--accent-primary);
      transform: translateY(-1px);
    }
    .step-2-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 2px 0 0 0;
    }
    .step-2-title-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .btn-load-sample {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--border-hairline);
      background: var(--bg-surface);
      color: var(--accent-primary);
      font-size: 11.5px;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: var(--radius-pill);
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      transition: var(--transition-tactile);
    }
    .btn-load-sample:hover {
      background: var(--accent-primary-tint);
      border-color: var(--accent-primary);
      text-decoration: none;
    }

    .json-textarea {
      width: 100%;
      background: var(--bg-subtle);
      color: var(--text-primary);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-inner);
      padding: 14px;
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.5;
      outline: none;
      transition: var(--transition-tactile);
    }
    .json-textarea:focus {
      background: var(--bg-surface);
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 2px var(--accent-primary-tint);
    }

    .alert-box {
      padding: 12px 16px;
      border-radius: var(--radius-inner);
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .alert-box.error {
      background: var(--status-blocked-bg);
      border: 1px solid rgba(200, 109, 81, 0.35);
      color: var(--status-blocked-text);
    }
    .alert-box.success {
      background: var(--status-done-bg);
      border: 1px solid rgba(78, 124, 89, 0.35);
      color: var(--status-done-text);
    }

    .modal-footer {
      padding: 16px 24px;
      border-top: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .footer-note {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 11.5px;
      color: var(--text-muted);
      min-width: 0;
    }
    .arch-tag {
      font-weight: 600;
      font-size: 10px;
      padding: 3px 8px;
      border-radius: 9999px;
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
      white-space: nowrap;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      line-height: 1.2;
    }
    .footer-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
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
      white-space: nowrap;
      flex-shrink: 0;
      transition: var(--transition-tactile);
    }
    .btn-cancel:hover {
      background: var(--bg-surface);
      color: var(--text-primary);
    }
    .btn-import {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      padding: 8px 18px;
      border-radius: var(--radius-pill);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      flex-shrink: 0;
      transition: var(--transition-tactile);
    }
    .btn-import:not(:disabled) {
      background: var(--accent-primary);
      color: #ffffff;
      border: 1px solid transparent;
      box-shadow: var(--shadow-sm);
    }
    .btn-import:not(:disabled):hover {
      background: var(--accent-primary-hover);
      transform: translateY(-1px);
    }
    .btn-import:disabled {
      background: var(--bg-surface);
      color: var(--text-muted);
      border: 1px solid var(--border-hairline);
      opacity: 0.65;
      cursor: not-allowed;
      box-shadow: none;
      transform: none;
    }
  `]
})
export class ImportModalComponent {
  protected readonly store = inject(TaskStoreService);
  readonly closeModal = output<void>();

  jsonInput = '';
  errorMessage = signal<string>('');
  successMessage = signal<string>('');
  isCopied = signal<boolean>(false);

  copyPrompt(): void {
    const promptText = `Extract engineering tasks from your conversation into this exact JSON format.
Strict rules:
1. "projectCode" MUST match one of: "RAG-CORE", "EVAL-GW", "PULSE-V1"
2. "assigneeRole" should be one of: "AI Engineer", "Full-Stack Dev", "QA / Test Engineer", "Tech Lead"
3. "priority" must be: "LOW", "MEDIUM", "HIGH", or "CRITICAL"
4. "dependencies" (optional): list upstream task IDs if any
5. Return ONLY a valid JSON object matching this schema:

{
  "tasks": [
    {
      "title": "Task title summarizing deliverable",
      "projectCode": "RAG-CORE",
      "assigneeName": "Priya Nair",
      "assigneeRole": "AI Engineer",
      "priority": "HIGH",
      "phase": "Phase 2: Serving Engine",
      "sprint": "Sprint 24.3",
      "effortPoints": 5,
      "dueDate": "2026-11-20",
      "subtasks": ["Implement unit tests", "Benchmark GPU memory"],
      "dependencies": []
    }
  ]
}`;

    navigator.clipboard.writeText(promptText).then(() => {
      this.isCopied.set(true);
      setTimeout(() => this.isCopied.set(false), 2500);
    });
  }

  loadSampleJson(): void {
    this.jsonInput = JSON.stringify(SAMPLE_IMPORT_JSON, null, 2);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  executeImport(): void {
    if (!this.jsonInput.trim()) return;

    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const parsed = JSON.parse(this.jsonInput);
      const res = this.store.importTasksFromJson(parsed);
      if (!res.success) {
        this.errorMessage.set(res.error || 'Failed to parse JSON payload.');
      } else {
        this.successMessage.set(`Successfully imported ${res.count} tasks! Automatically registered any new squad members.`);
        setTimeout(() => {
          this.close();
        }, 1200);
      }
    } catch (e: any) {
      this.errorMessage.set(`Invalid JSON syntax: ${e.message}`);
    }
  }

  close(): void {
    this.closeModal.emit();
  }
}
