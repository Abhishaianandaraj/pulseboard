import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskStoreService } from '../services/task-store.service';
import { AiCopilotService, ExtractionMode } from '../services/ai-copilot.service';
import { ExtractedTaskDraft, TaskPriority, TeamMember, Project } from '../models/task.model';

@Component({
  selector: 'app-ai-prompt-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="close()">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="modal-title-row">
            <span class="modal-icon-wrap">
              <i class="ph-light ph-microphone"></i>
            </span>
            <div>
              <h3 class="modal-title font-serif">Prompt with AI<span class="brand-dot">.</span></h3>
              <p class="modal-sub">
                Voice dictation &amp; natural language task composer with deterministic project &amp; squad resolution
              </p>
            </div>
          </div>
          <button type="button" class="btn-close" (click)="close()" title="Close dialog">
            <i class="ph-light ph-x"></i>
          </button>
        </div>

        <!-- Modal Body -->
        <div class="modal-body custom-scroll">
          <!-- Voice & Action Controls Row -->
          <div class="controls-toolbar">
            <!-- Voice Dictation Pill Button -->
            <button
              type="button"
              class="btn-voice-toggle"
              [class.is-recording]="copilot.isListening()"
              (click)="toggleListening()"
              [disabled]="!copilot.voiceSupported()"
            >
              @if (copilot.isListening()) {
                <span class="pulse-ring"></span>
                <i class="ph-light ph-stop-circle"></i>
                <span>Stop Listening</span>
              } @else {
                <i class="ph-light ph-microphone"></i>
                <span>Start Voice Prompt</span>
              }
            </button>

            <!-- Quick Sample Prompt Button -->
            <button type="button" class="btn-pill-subtle" (click)="loadSampleStandupPrompt()">
              <i class="ph-light ph-lightning"></i>
              <span>Try Sample Standup Prompt</span>
            </button>

            <!-- Mode Config Toggle Button -->
            <button
              type="button"
              class="btn-pill-subtle"
              (click)="showSettings.set(!showSettings())"
            >
              <i class="ph-light ph-gear-six"></i>
              <span>{{ copilot.extractionMode() === 'CORPORATE_LLM' ? 'Corporate LLM Active' : 'Local NLP Engine' }}</span>
              <i class="ph-light" [class.ph-caret-down]="!showSettings()" [class.ph-caret-up]="showSettings()"></i>
            </button>
          </div>

          <!-- Interim Voice Readout Banner (when listening) -->
          @if (copilot.isListening() && copilot.interimTranscript()) {
            <div class="interim-voice-box">
              <span class="interim-wave-icon">
                <i class="ph-light ph-waveform"></i>
              </span>
              <p class="interim-text font-serif">"{{ copilot.interimTranscript() }}"</p>
            </div>
          }

          <!-- Voice Permission Error Alert -->
          @if (copilot.voiceError()) {
            <div class="alert-banner alert-warn">
              <i class="ph-light ph-warning"></i>
              <span>{{ copilot.voiceError() }}</span>
            </div>
          }

          <!-- Collapsible Corporate Endpoint & Settings Drawer -->
          @if (showSettings()) {
            <div class="settings-panel">
              <div class="settings-header">
                <strong class="settings-title">NLP Extraction Engine Configuration</strong>
                <div class="mode-switch-group">
                  <button
                    type="button"
                    class="btn-mode-tab"
                    [class.active]="copilot.extractionMode() === 'LOCAL_NLP'"
                    (click)="setMode('LOCAL_NLP')"
                  >
                    Local Deterministic
                  </button>
                  <button
                    type="button"
                    class="btn-mode-tab"
                    [class.active]="copilot.extractionMode() === 'CORPORATE_LLM'"
                    (click)="setMode('CORPORATE_LLM')"
                  >
                    Corporate LLM Endpoint
                  </button>
                </div>
              </div>

              @if (copilot.extractionMode() === 'CORPORATE_LLM') {
                <div class="endpoint-input-row">
                  <label class="endpoint-label">Endpoint URL:</label>
                  <input
                    type="text"
                    class="endpoint-input"
                    [ngModel]="copilot.corporateEndpoint()"
                    (ngModelChange)="copilot.setCorporateEndpoint($event)"
                    placeholder="https://llm.internal.corp/v1/chat/completions"
                  />
                </div>
              }
            </div>
          }

          <!-- Multi-Line Prompt Input Box -->
          <div class="prompt-box-wrap">
            <textarea
              class="prompt-textarea custom-scroll"
              rows="4"
              [(ngModel)]="promptText"
              placeholder="Speak or type naturally — e.g., 'Create an urgent 5-point task in PULSE-V1 for Abhishai to implement RBAC route guards and role middleware blocked by PB-101, and a 3-point high priority task in EVAL-GW for Karthik to configure latency telemetry'"
            ></textarea>

            <div class="prompt-box-footer">
              <span class="prompt-hint">
                <i class="ph-light ph-info"></i> Auto-detects projects, co-assignees, priority, story points &amp; upstream dependencies.
              </span>
              <button
                type="button"
                class="btn-extract"
                [disabled]="!promptText.trim() || isExtracting()"
                (click)="runExtraction()"
              >
                @if (isExtracting()) {
                  <i class="ph-light ph-spinner-gap spin-icon"></i>
                  <span>Extracting Deliverables...</span>
                } @else {
                  <i class="ph-light ph-sparkle"></i>
                  <span>Extract Deliverables</span>
                }
              </button>
            </div>
          </div>

          <!-- Extraction Notice Banner -->
          @if (copilot.lastExtractionNotice()) {
            <div class="alert-banner alert-info">
              <i class="ph-light ph-info"></i>
              <span>{{ copilot.lastExtractionNotice() }}</span>
            </div>
          }

          <!-- Staged Task Drafts List -->
          @if (drafts().length > 0) {
            <div class="staging-container">
              <div class="staging-head">
                <div class="staging-title-group">
                  <span class="staging-pill">{{ drafts().length }} Staged</span>
                  <strong class="staging-label">Review &amp; Edit Deliverables Before Creating</strong>
                </div>
                <button type="button" class="btn-clear-staging" (click)="clearDrafts()">
                  <i class="ph-light ph-x"></i>
                  <span>Clear All</span>
                </button>
              </div>

              <div class="staging-list custom-scroll">
                @for (draft of drafts(); track draft.id; let idx = $index) {
                  <div class="draft-row-card">
                    <!-- Row Top: Title and Remove -->
                    <div class="draft-top-bar">
                      <div class="draft-index font-mono">#{{ idx + 1 }}</div>
                      <input
                        type="text"
                        class="draft-title-input"
                        [(ngModel)]="draft.title"
                        placeholder="Deliverable title"
                      />
                      <button
                        type="button"
                        class="btn-delete-draft"
                        (click)="removeDraft(idx)"
                        title="Remove deliverable"
                      >
                        <i class="ph-light ph-trash"></i>
                      </button>
                    </div>

                    <!-- Row Controls Grid -->
                    <div class="draft-meta-grid">
                      <!-- Project Select -->
                      <div class="meta-field">
                        <label class="meta-label">Project</label>
                        <select
                          class="meta-select"
                          [ngModel]="draft.projectId"
                          (ngModelChange)="onDraftProjectChange(draft, $event)"
                        >
                          @for (p of store.visibleProjects(); track p.id) {
                            <option [value]="p.id">{{ p.code }} ({{ p.name }})</option>
                          }
                        </select>
                      </div>

                      <!-- Priority Select -->
                      <div class="meta-field">
                        <label class="meta-label">Priority</label>
                        <select class="meta-select" [(ngModel)]="draft.priority">
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                          <option value="CRITICAL">Critical</option>
                        </select>
                      </div>

                      <!-- Points Input -->
                      <div class="meta-field meta-pts">
                        <label class="meta-label">Points</label>
                        <input
                          type="number"
                          class="meta-input font-mono"
                          [(ngModel)]="draft.effortPoints"
                          min="1"
                          max="21"
                        />
                      </div>

                      <!-- Due Date -->
                      <div class="meta-field">
                        <label class="meta-label">Due Date</label>
                        <input
                          type="date"
                          class="meta-input font-mono"
                          [(ngModel)]="draft.dueDate"
                        />
                      </div>
                    </div>

                    <!-- Co-Assignee Chips & Capacity Context -->
                    <div class="draft-assignees-row">
                      <span class="assignees-label">Co-Assignees:</span>
                      <div class="assignee-chips-wrap">
                        @for (mem of store.teamMembers(); track mem.id) {
                          <button
                            type="button"
                            class="mem-pill-toggle"
                            [class.selected]="draft.assigneeIds.includes(mem.id)"
                            (click)="toggleDraftAssignee(draft, mem.id)"
                            title="{{ mem.name }} • {{ mem.role }}"
                          >
                            <span class="mem-mini-avatar" [style.background-color]="mem.color">
                              {{ mem.avatar }}
                            </span>
                            <span class="mem-pill-name">{{ mem.name.split(' ')[0] }}</span>
                            <!-- Capacity Comfort Indicator Dot -->
                            @if (getMemberCapacityStatus(mem.id); as status) {
                              <span
                                class="cap-indicator-dot"
                                [class.cap-opt]="status === 'OPTIMAL'"
                                [class.cap-near]="status === 'NEAR_CAPACITY'"
                                [class.cap-over]="status === 'OVER_BUDGET'"
                              ></span>
                            }
                          </button>
                        }
                      </div>
                    </div>

                    <!-- Dependencies & Subtasks (if detected) -->
                    @if (draft.dependencies.length > 0 || draft.subtasks.length > 0) {
                      <div class="draft-extra-details">
                        @if (draft.dependencies.length > 0) {
                          <div class="detail-chip-group">
                            <span class="detail-label">Depends on:</span>
                            @for (depId of draft.dependencies; track depId) {
                              <span class="dep-pill font-mono">
                                <i class="ph-light ph-link"></i> {{ depId }} ({{ getTaskTitle(depId) }})
                              </span>
                            }
                          </div>
                        }
                        @if (draft.subtasks.length > 0) {
                          <div class="detail-chip-group">
                            <span class="detail-label">Subtasks:</span>
                            @for (st of draft.subtasks; track st) {
                              <span class="subtask-pill">
                                <i class="ph-light ph-check-square"></i> {{ st }}
                              </span>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer">
          <div class="footer-note">
            <span class="engine-badge font-mono">
              <i class="ph-light ph-cpu"></i>
              {{ copilot.extractionMode() === 'CORPORATE_LLM' ? 'LLM PROXY' : 'LOCAL NLP' }}
            </span>
            <span>All tasks automatically tagged with [AI_EXTRACTED] in immutable provenance log</span>
          </div>

          <div class="footer-actions">
            <button type="button" class="btn-cancel" (click)="close()">Cancel</button>
            <button
              type="button"
              class="btn-create-all"
              [disabled]="drafts().length === 0"
              (click)="commitDeliverables()"
            >
              <i class="ph-light ph-plus-circle"></i>
              <span>Create {{ drafts().length }} Deliverables</span>
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
      width: 780px;
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
      padding: 18px 24px;
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
      font-size: 22px;
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
      padding: 20px 24px 36px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-height: 72vh;
      overflow-y: auto;
    }

    /* Controls Toolbar */
    .controls-toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .btn-voice-toggle {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      padding: 7px 16px;
      border-radius: var(--radius-pill);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid var(--border-hairline);
      background: var(--bg-surface);
      color: var(--text-primary);
      box-shadow: var(--shadow-sm);
      transition: var(--transition-tactile);
    }
    .btn-voice-toggle:hover:not(:disabled) {
      border-color: var(--accent-primary);
      transform: translateY(-1px);
    }
    .btn-voice-toggle.is-recording {
      background: var(--accent-danger);
      color: #ffffff;
      border-color: transparent;
    }
    .pulse-ring {
      position: absolute;
      top: -2px;
      left: -2px;
      right: -2px;
      bottom: -2px;
      border-radius: var(--radius-pill);
      border: 2px solid var(--accent-danger);
      animation: pulse 1.4s infinite;
      pointer-events: none;
    }
    @keyframes pulse {
      0% { transform: scale(0.98); opacity: 0.8; }
      50% { transform: scale(1.04); opacity: 0.3; }
      100% { transform: scale(0.98); opacity: 0.8; }
    }

    .btn-pill-subtle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      padding: 7px 14px;
      border-radius: var(--radius-pill);
      font-size: 11.5px;
      font-weight: 500;
      border: 1px solid var(--border-hairline);
      background: var(--bg-subtle);
      color: var(--text-secondary);
      cursor: pointer;
      transition: var(--transition-tactile);
    }
    .btn-pill-subtle:hover {
      background: var(--bg-surface);
      color: var(--text-primary);
      border-color: var(--accent-primary);
    }

    /* Interim Voice Transcript */
    .interim-voice-box {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: var(--radius-inner);
      background: var(--accent-primary-tint);
      border: 1px dashed var(--accent-primary);
    }
    .interim-wave-icon {
      font-size: 16px;
      color: var(--accent-primary);
      animation: bounce 1s infinite alternate;
    }
    @keyframes bounce { from { transform: scale(0.9); } to { transform: scale(1.1); } }
    .interim-text {
      margin: 0;
      font-size: 13px;
      font-style: italic;
      color: var(--text-primary);
    }

    /* Alerts */
    .alert-banner {
      padding: 10px 14px;
      border-radius: var(--radius-inner);
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .alert-warn {
      background: rgba(197, 155, 78, 0.12);
      border: 1px solid rgba(197, 155, 78, 0.3);
      color: var(--accent-warn);
    }
    .alert-info {
      background: var(--accent-primary-tint);
      border: 1px solid var(--border-hairline);
      color: var(--text-primary);
    }

    /* Settings Panel */
    .settings-panel {
      padding: 12px 16px;
      border-radius: var(--radius-inner);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .settings-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .settings-title {
      font-size: 12px;
      color: var(--text-primary);
    }
    .mode-switch-group {
      display: flex;
      align-items: center;
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-pill);
      padding: 2px;
      gap: 2px;
    }
    .btn-mode-tab {
      padding: 3px 10px;
      border-radius: var(--radius-pill);
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: var(--transition-tactile);
    }
    .btn-mode-tab.active {
      background: var(--accent-primary);
      color: #ffffff;
      font-weight: 600;
    }
    .endpoint-input-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .endpoint-label {
      font-size: 11.5px;
      color: var(--text-muted);
      white-space: nowrap;
    }
    .endpoint-input {
      flex: 1;
      padding: 6px 10px;
      border-radius: var(--radius-inner);
      border: 1px solid var(--border-hairline);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-family: var(--font-mono);
      font-size: 11.5px;
      outline: none;
    }

    /* Prompt Box */
    .prompt-box-wrap {
      border: 1px solid var(--border-hairline);
      border-radius: var(--radius-inner);
      background: var(--bg-subtle);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .prompt-textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 14px;
      background: transparent;
      color: var(--text-primary);
      border: none;
      outline: none;
      font-size: 13px;
      line-height: 1.5;
      resize: vertical;
      min-height: 90px;
    }
    .prompt-box-footer {
      padding: 10px 14px;
      background: var(--bg-surface);
      border-top: 1px solid var(--border-hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .prompt-hint {
      font-size: 11.5px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .btn-extract {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      padding: 7px 16px;
      border-radius: var(--radius-pill);
      background: var(--accent-primary);
      color: #ffffff;
      border: none;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      transition: var(--transition-tactile);
    }
    .btn-extract:hover:not(:disabled) {
      background: var(--accent-primary-hover);
      transform: translateY(-1px);
    }
    .btn-extract:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .spin-icon {
      animation: spin 1s linear infinite;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    /* Staging Section */
    .staging-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      border-top: 1px solid var(--border-hairline);
      padding-top: 14px;
    }
    .staging-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .staging-title-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .staging-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
      padding: 2px 8px;
      border-radius: 9999px;
      background: var(--accent-primary);
      color: #ffffff;
      font-size: 10.5px;
      font-weight: 700;
    }
    .staging-label {
      font-size: 13px;
      color: var(--text-primary);
      font-weight: 600;
    }
    .btn-clear-staging {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 11.5px;
      cursor: pointer;
      transition: var(--transition-tactile);
    }
    .btn-clear-staging:hover {
      color: var(--accent-danger);
    }

    .staging-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 280px;
      overflow-y: auto;
    }
    .draft-row-card {
      padding: 12px 14px;
      border-radius: var(--radius-inner);
      background: var(--bg-subtle);
      border: 1px solid var(--border-hairline);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .draft-top-bar {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .draft-index {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
    }
    .draft-title-input {
      flex: 1;
      padding: 6px 10px;
      border-radius: var(--radius-inner);
      border: 1px solid var(--border-hairline);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: 12.5px;
      font-weight: 600;
      outline: none;
    }
    .draft-title-input:focus {
      border-color: var(--accent-primary);
    }
    .btn-delete-draft {
      border: none;
      background: transparent;
      color: var(--text-muted);
      font-size: 15px;
      cursor: pointer;
      transition: var(--transition-tactile);
    }
    .btn-delete-draft:hover {
      color: var(--accent-danger);
    }

    .draft-meta-grid {
      display: grid;
      grid-template-columns: 2fr 1.3fr 1fr 1.4fr;
      gap: 10px;
    }
    .meta-field {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .meta-label {
      font-size: 10.5px;
      color: var(--text-muted);
      font-weight: 500;
    }
    .meta-select, .meta-input {
      padding: 5px 8px;
      border-radius: var(--radius-inner);
      border: 1px solid var(--border-hairline);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: 11.5px;
      outline: none;
    }
    .meta-select:focus, .meta-input:focus {
      border-color: var(--accent-primary);
    }

    .draft-assignees-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .assignees-label {
      font-size: 11px;
      color: var(--text-muted);
      white-space: nowrap;
    }
    .assignee-chips-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .mem-pill-toggle {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-hairline);
      background: var(--bg-surface);
      color: var(--text-secondary);
      font-size: 11px;
      cursor: pointer;
      white-space: nowrap;
      transition: var(--transition-tactile);
    }
    .mem-pill-toggle:hover {
      border-color: var(--accent-primary);
      color: var(--text-primary);
    }
    .mem-pill-toggle.selected {
      background: var(--accent-primary-tint);
      border-color: var(--accent-primary);
      color: var(--text-primary);
      font-weight: 600;
    }
    .mem-mini-avatar {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      color: #ffffff;
      font-size: 8.5px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .mem-pill-name {
      font-size: 11px;
    }
    .cap-indicator-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .cap-opt { background: #4e7c59; }
    .cap-near { background: #c59b4e; }
    .cap-over { background: #c86d51; }

    .draft-extra-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-top: 4px;
      border-top: 1px dashed var(--border-hairline);
    }
    .detail-chip-group {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .detail-label {
      font-size: 10.5px;
      color: var(--text-muted);
    }
    .dep-pill, .subtask-pill {
      font-size: 10.5px;
      padding: 2px 7px;
      border-radius: var(--radius-pill);
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      color: var(--text-secondary);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    /* Modal Footer */
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
    .engine-badge {
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
      gap: 4px;
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
    .btn-create-all {
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
    .btn-create-all:not(:disabled) {
      background: var(--accent-primary);
      color: #ffffff;
      border: 1px solid transparent;
      box-shadow: var(--shadow-sm);
    }
    .btn-create-all:not(:disabled):hover {
      background: var(--accent-primary-hover);
      transform: translateY(-1px);
    }
    .btn-create-all:disabled {
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
export class AiPromptModalComponent {
  protected readonly store = inject(TaskStoreService);
  protected readonly copilot = inject(AiCopilotService);
  readonly closeModal = output<void>();

  promptText = '';
  showSettings = signal<boolean>(false);
  isExtracting = signal<boolean>(false);
  drafts = signal<ExtractedTaskDraft[]>([]);

  toggleListening(): void {
    if (this.copilot.isListening()) {
      this.copilot.stopListening();
    } else {
      this.copilot.startListening((finalChunk: string) => {
        this.promptText = (this.promptText ? this.promptText + ' ' : '') + finalChunk;
      });
    }
  }

  setMode(mode: ExtractionMode): void {
    this.copilot.setExtractionMode(mode);
  }

  loadSampleStandupPrompt(): void {
    this.promptText = `Create an urgent 5-point task in PULSE-V1 for Abhishai to implement RBAC route guards and role middleware blocked by PB-101, and a 3-point high priority task in EVAL-GW for Karthik to configure latency telemetry`;
  }

  async runExtraction(): Promise<void> {
    if (!this.promptText.trim()) return;

    this.isExtracting.set(true);
    try {
      const result = await this.copilot.extractTasksFromPrompt(
        this.promptText,
        this.store.visibleProjects(),
        this.store.teamMembers(),
        this.store.tasks()
      );
      this.drafts.set(result);
    } finally {
      this.isExtracting.set(false);
    }
  }

  onDraftProjectChange(draft: ExtractedTaskDraft, projectId: string): void {
    draft.projectId = projectId;
    const proj = this.store.visibleProjects().find(p => p.id === projectId);
    if (proj) {
      draft.projectCode = proj.code;
    }
  }

  toggleDraftAssignee(draft: ExtractedTaskDraft, memberId: string): void {
    if (draft.assigneeIds.includes(memberId)) {
      if (draft.assigneeIds.length > 1) {
        draft.assigneeIds = draft.assigneeIds.filter(id => id !== memberId);
      }
    } else {
      draft.assigneeIds.push(memberId);
    }
  }

  getMemberCapacityStatus(memberId: string): 'OPTIMAL' | 'NEAR_CAPACITY' | 'OVER_BUDGET' | null {
    const metric = this.store.memberLoadMetrics().get(memberId);
    return metric ? metric.status : null;
  }

  getTaskTitle(taskId: string): string {
    const t = this.store.tasks().find(task => task.id === taskId);
    return t ? t.title.slice(0, 24) + (t.title.length > 24 ? '...' : '') : taskId;
  }

  removeDraft(index: number): void {
    this.drafts.update(list => list.filter((_, i) => i !== index));
  }

  clearDrafts(): void {
    this.drafts.set([]);
  }

  commitDeliverables(): void {
    const currentDrafts = this.drafts();
    if (currentDrafts.length === 0) return;

    const res = this.store.createTasksFromAiDrafts(currentDrafts);
    if (res.success) {
      this.close();
    }
  }

  close(): void {
    if (this.copilot.isListening()) {
      this.copilot.stopListening();
    }
    this.closeModal.emit();
  }
}
