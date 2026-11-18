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
            <span class="ai-spark-icon">✨</span>
            <div>
              <h3 class="modal-title">Smart Import (Multi-Project & AI-Ready JSON)</h3>
              <p class="modal-sub">
                Extract tasks into PulseBoard schema with automatic project linkage and new squad member registration
              </p>
            </div>
          </div>
          <button type="button" class="btn-close" (click)="close()">✕</button>
        </div>

        <!-- Modal Body -->
        <div class="modal-body custom-scroll">
          <!-- Step 1: Copy Gemini Prompt Template -->
          <div class="step-card">
            <div class="step-info">
              <span class="step-badge">STEP 1</span>
              <div>
                <strong class="step-title">Copy Gemini / Claude System Prompt</strong>
                <p class="step-desc">
                  Prompt instructs LLM to output valid JSON matching project codes (RAG-CORE, EVAL-GW, PULSE-V1) and roles.
                </p>
              </div>
            </div>
            <button type="button" class="btn-copy-prompt" (click)="copyPrompt()">
              {{ isCopied() ? '✓ Copied to Clipboard!' : '📋 Copy Gemini Prompt' }}
            </button>
          </div>

          <!-- Step 2: Paste JSON or Load 1-Click Demo -->
          <div class="step-2-header">
            <div>
              <span class="step-badge step-2">STEP 2</span>
              <strong class="step-title ml-2">Paste Structured JSON</strong>
            </div>
            <button type="button" class="btn-load-sample" (click)="loadSampleJson()">
              ✨ Load Sample Meeting JSON (1-Click Demo)
            </button>
          </div>

          <!-- JSON Code Textarea -->
          <textarea
            class="json-textarea"
            rows="9"
            [(ngModel)]="jsonInput"
            placeholder='{\n  "tasks": [\n    {\n      "title": "Optimize Triton FP8 Dynamic Batching",\n      "projectCode": "RAG-CORE",\n      "assigneeName": "Priya Nair",\n      "assigneeRole": "AI Engineer",\n      "priority": "HIGH",\n      "subtasks": ["Tune scheduler", "Test p99 latency"]\n    }\n  ]\n}'
          ></textarea>

          <!-- Error Alert Banner -->
          @if (errorMessage()) {
            <div class="alert-box error">
              <span>⚠️ {{ errorMessage() }}</span>
            </div>
          }

          <!-- Success Alert Banner -->
          @if (successMessage()) {
            <div class="alert-box success">
              <span>🎉 {{ successMessage() }}</span>
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
              Import to Workspace
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
      background: rgba(10, 14, 20, 0.55);
      backdrop-filter: blur(3px);
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      animation: fadeIn 0.15s ease-out;
    }
    .modal-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      width: 700px;
      max-width: 95vw;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: scaleIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes scaleIn { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }

    .modal-header {
      padding: 18px 24px;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-elevated);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .modal-title-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .ai-spark-icon { font-size: 22px; }
    .modal-title {
      font-size: 16px;
      font-weight: 700;
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
      color: var(--text-secondary);
      font-size: 16px;
      cursor: pointer;
      padding: 4px;
    }
    .btn-close:hover { color: var(--text-primary); }

    .modal-body {
      padding: 22px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-height: 72vh;
      overflow-y: auto;
    }
    .step-card {
      padding: 12px 14px;
      border-radius: 8px;
      background: var(--badge-done-bg);
      border: 1px solid var(--status-done);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .step-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .step-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      background: var(--status-done);
      color: #ffffff;
      border-radius: 4px;
    }
    .step-badge.step-2 {
      background: var(--accent-primary);
    }
    .step-title {
      font-size: 12.5px;
      color: var(--text-primary);
    }
    .step-desc {
      font-size: 11px;
      color: var(--text-secondary);
      margin: 2px 0 0 0;
    }
    .btn-copy-prompt {
      padding: 6px 12px;
      background: var(--bg-surface);
      border: 1px solid var(--status-done);
      color: var(--text-primary);
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .step-2-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .ml-2 { margin-left: 8px; }
    .btn-load-sample {
      border: none;
      background: transparent;
      color: var(--status-deployed);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-load-sample:hover { text-decoration: underline; }

    .json-textarea {
      width: 100%;
      background: #0d1117;
      color: #58a6ff;
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 12px;
      font-family: var(--font-mono);
      font-size: 11.5px;
      line-height: 1.5;
      outline: none;
      resize: vertical;
    }
    .json-textarea:focus {
      border-color: var(--accent-primary);
    }

    .alert-box {
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }
    .alert-box.error {
      background: var(--badge-critical-bg);
      border: 1px solid var(--badge-critical-text);
      color: var(--badge-critical-text);
    }
    .alert-box.success {
      background: var(--badge-done-bg);
      border: 1px solid var(--status-done);
      color: var(--badge-done-text);
    }

    .modal-footer {
      padding: 16px 24px;
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-elevated);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .footer-note {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: var(--text-secondary);
    }
    .arch-tag {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      border-radius: 4px;
    }
    .footer-actions {
      display: flex;
      gap: 8px;
    }
    .btn-cancel {
      padding: 7px 16px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      border-radius: 6px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-import {
      padding: 7px 18px;
      background: var(--accent-primary);
      border: 1px solid var(--accent-primary);
      color: #ffffff;
      border-radius: 6px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    }
    .btn-import:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
})
export class ImportModalComponent {
  protected readonly store = inject(TaskStoreService);

  readonly closeModal = output<void>();

  jsonInput = '';
  isCopied = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  readonly geminiPromptTemplate = `You are an AI Technical Delivery Manager for a high-performance AI Engineering Team.
Analyze the following unstructured meeting notes, transcribe them into actionable engineering tasks, and output ONLY valid JSON matching this exact schema:

{
  "tasks": [
    {
      "title": "Clear concise engineering task title",
      "description": "Specific implementation instructions, benchmark goals, or context",
      "projectCode": "RAG-CORE | EVAL-GW | PULSE-V1",
      "assigneeName": "Abhishai | Priya Nair | Karthik R | Rahul Verma | Vikram Rao | Any New Member",
      "assigneeRole": "AI Engineer | Full-Stack Dev | QA / Test Engineer | Tech Lead | Delivery Manager",
      "squad": "Core AI Squad | Platform & QA Squad",
      "priority": "LOW | MEDIUM | HIGH | CRITICAL",
      "phase": "Phase 1: Knowledge Core | Phase 2: Serving Engine | Phase 3: Security & Governance",
      "sprint": "Sprint 24.3",
      "effortPoints": 3,
      "dueDate": "YYYY-MM-DD",
      "subtasks": [
        "First concrete step",
        "Second verification step"
      ]
    }
  ]
}

Raw Meeting Notes to Extract:
[PASTE YOUR RAW MEETING NOTES OR SLACK THREAD HERE]`;

  close(): void {
    this.closeModal.emit();
  }

  copyPrompt(): void {
    navigator.clipboard.writeText(this.geminiPromptTemplate).then(() => {
      this.isCopied.set(true);
      setTimeout(() => this.isCopied.set(false), 2500);
    });
  }

  loadSampleJson(): void {
    this.jsonInput = JSON.stringify(SAMPLE_IMPORT_JSON, null, 2);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  executeImport(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (!this.jsonInput.trim()) {
      this.errorMessage.set('Please paste JSON or click "Load Sample Meeting JSON".');
      return;
    }

    try {
      const parsed = JSON.parse(this.jsonInput);
      const res = this.store.importTasksFromJson(parsed);

      if (res.success) {
        this.successMessage.set(`Successfully imported ${res.count} tasks with automatic project and squad member resolution!`);
        setTimeout(() => this.close(), 1200);
      } else {
        this.errorMessage.set(res.error || 'Failed to import JSON.');
      }
    } catch (e: any) {
      this.errorMessage.set(`JSON Syntax Error: ${e.message}`);
    }
  }
}
