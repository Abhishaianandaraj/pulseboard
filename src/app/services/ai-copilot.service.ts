import { Injectable, signal } from '@angular/core';
import { Project, Task, TeamMember, TaskPriority, ExtractedTaskDraft } from '../models/task.model';

export type ExtractionMode = 'LOCAL_NLP' | 'CORPORATE_LLM';

const STORAGE_KEY_CORP_ENDPOINT = 'pulseboard_corp_llm_endpoint';
const STORAGE_KEY_EXTRACTION_MODE = 'pulseboard_extraction_mode';

@Injectable({
  providedIn: 'root'
})
export class AiCopilotService {
  // Voice Dictation Signals (Web Speech API)
  readonly isListening = signal<boolean>(false);
  readonly interimTranscript = signal<string>('');
  readonly voiceError = signal<string>('');
  readonly voiceSupported = signal<boolean>(
    typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  );

  private recognition: any = null;
  private onFinalCallback?: (text: string) => void;

  // Dual-Mode NLP Engine Signals
  readonly extractionMode = signal<ExtractionMode>(
    (typeof localStorage !== 'undefined' && (localStorage.getItem(STORAGE_KEY_EXTRACTION_MODE) as ExtractionMode)) || 'LOCAL_NLP'
  );
  readonly corporateEndpoint = signal<string>(
    (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY_CORP_ENDPOINT)) || ''
  );
  readonly lastExtractionNotice = signal<string>('');

  constructor() {
    this.initSpeechRecognition();
  }

  setExtractionMode(mode: ExtractionMode): void {
    this.extractionMode.set(mode);
    try {
      localStorage.setItem(STORAGE_KEY_EXTRACTION_MODE, mode);
    } catch {}
  }

  setCorporateEndpoint(url: string): void {
    this.corporateEndpoint.set(url.trim());
    try {
      localStorage.setItem(STORAGE_KEY_CORP_ENDPOINT, url.trim());
    } catch {}
  }

  // --- Live Voice Dictation (Web Speech API) ---
  private initSpeechRecognition(): void {
    if (!this.voiceSupported()) return;
    try {
      const SpeechClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        let interim = '';
        let finalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) {
            finalChunk += transcript + ' ';
          } else {
            interim += transcript;
          }
        }

        this.interimTranscript.set(interim.trim());

        if (finalChunk.trim() && this.onFinalCallback) {
          this.onFinalCallback(finalChunk.trim());
        }
      };

      this.recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.voiceError.set('Microphone access denied. Please grant permission in your browser.');
        } else if (event.error === 'no-speech') {
          // Non-fatal: user paused speaking
        } else {
          this.voiceError.set(`Microphone notification: ${event.error}`);
        }
        this.isListening.set(false);
      };

      this.recognition.onend = () => {
        this.isListening.set(false);
        this.interimTranscript.set('');
      };
    } catch (e: any) {
      this.voiceSupported.set(false);
      this.voiceError.set('Web Speech API is unavailable in this environment.');
    }
  }

  startListening(onFinalChunk?: (text: string) => void): void {
    this.voiceError.set('');
    if (!this.voiceSupported() || !this.recognition) {
      this.voiceError.set('Voice dictation is not supported by your current browser.');
      return;
    }

    this.onFinalCallback = onFinalChunk;
    try {
      this.recognition.start();
      this.isListening.set(true);
    } catch (err: any) {
      if (err.name === 'InvalidStateError') {
        this.isListening.set(true);
      } else {
        this.voiceError.set('Unable to start microphone dictation.');
        this.isListening.set(false);
      }
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListening()) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.isListening.set(false);
    this.interimTranscript.set('');
  }

  // --- Dual-Mode NLP Extraction Engine ---
  async extractTasksFromPrompt(
    rawText: string,
    visibleProjects: Project[],
    squadMembers: TeamMember[],
    existingTasks: Task[]
  ): Promise<ExtractedTaskDraft[]> {
    this.lastExtractionNotice.set('');
    const cleanText = this.sanitizeText(rawText).trim();
    if (!cleanText) return [];

    if (this.extractionMode() === 'CORPORATE_LLM' && this.corporateEndpoint()) {
      try {
        const drafts = await this.extractViaCorporateLlm(cleanText, visibleProjects, squadMembers, existingTasks);
        if (drafts.length > 0) {
          this.lastExtractionNotice.set(`Extracted ${drafts.length} deliverable(s) via Corporate LLM endpoint.`);
          return drafts;
        }
      } catch (e: any) {
        console.warn('Corporate LLM endpoint failed, falling back to local deterministic NLP parser:', e.message);
        this.lastExtractionNotice.set('Corporate LLM offline. Extracted deliverables via Local Deterministic NLP engine.');
      }
    }

    const localDrafts = this.extractViaLocalNlp(cleanText, visibleProjects, squadMembers, existingTasks);
    if (!this.lastExtractionNotice()) {
      this.lastExtractionNotice.set(`Extracted ${localDrafts.length} deliverable(s) via Local Deterministic NLP engine.`);
    }
    return localDrafts;
  }

  private sanitizeText(text: string): string {
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  }

  private extractViaLocalNlp(
    text: string,
    visibleProjects: Project[],
    squadMembers: TeamMember[],
    existingTasks: Task[]
  ): ExtractedTaskDraft[] {
    const segments = this.splitIntoTaskClauses(text);

    const drafts: ExtractedTaskDraft[] = [];

    segments.forEach((seg, index) => {
      // 1. Project Detection (exact code match or keyword)
      let matchedProj: Project | undefined;
      for (const proj of visibleProjects) {
        if (seg.toUpperCase().includes(proj.code.toUpperCase())) {
          matchedProj = proj;
          break;
        }
      }
      if (!matchedProj) {
        for (const proj of visibleProjects) {
          const nameKeywords = proj.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          if (nameKeywords.some(kw => seg.toLowerCase().includes(kw))) {
            matchedProj = proj;
            break;
          }
        }
      }
      const targetProj = matchedProj || visibleProjects[0] || { id: 'proj-1', code: 'RAG-CORE' };

      // 2. Co-Assignees Detection
      const matchedAssigneeIds: string[] = [];
      squadMembers.forEach(mem => {
        const firstName = mem.name.split(' ')[0];
        const nameRegex = new RegExp(`\\b${firstName}\\b`, 'i');
        if (nameRegex.test(seg)) {
          matchedAssigneeIds.push(mem.id);
        }
      });
      const assigneeIds = matchedAssigneeIds.length > 0
        ? Array.from(new Set(matchedAssigneeIds))
        : [squadMembers[0]?.id || 'tm-1'];

      // 3. Priority Detection
      let priority: TaskPriority = 'MEDIUM';
      if (/\b(?:urgent|critical|blocker|p0|asap)\b/i.test(seg)) {
        priority = 'CRITICAL';
      } else if (/\b(?:high(?:\s+priority)?|important|p1)\b/i.test(seg)) {
        priority = 'HIGH';
      } else if (/\b(?:low(?:\s+priority)?|minor|trivial|p3)\b/i.test(seg)) {
        priority = 'LOW';
      } else if (/\bmedium(?:\s+priority)?\b/i.test(seg)) {
        priority = 'MEDIUM';
      }

      // 4. Hyphenated & Spaced Story Points Detection (e.g. 5-point, 5 points, 3pts)
      let effortPoints = 3;
      const pointsMatch = seg.match(/\b(\d+)\s*-?\s*(?:points?|pts?)\b/i) ||
                          seg.match(/\b(?:effort|size|points)\s*[:=]?\s*(\d+)\b/i);
      if (pointsMatch) {
        const pts = parseInt(pointsMatch[1], 10);
        if (!isNaN(pts) && pts >= 1 && pts <= 21) {
          effortPoints = pts;
        }
      }

      // 5. Due Date Detection
      let dueDate = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
      const dateMatch = seg.match(/\b(\d{4}-\d{2}-\d{2})\b/);
      if (dateMatch) {
        dueDate = dateMatch[1];
      } else {
        const inDaysMatch = seg.match(/\bin\s+(\d+)\s+days?\b/i);
        if (inDaysMatch) {
          const days = parseInt(inDaysMatch[1], 10);
          dueDate = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
        }
      }

      // 6. Upstream Dependency Detection
      const dependencies: string[] = [];
      const depMatch = seg.match(/(?:depends\s+on|dependent\s+on|prerequisite(?:\s+is)?|after|blocked\s+by)\s+([^,.;]+)/i);
      if (depMatch) {
        const phrase = depMatch[1].trim().toLowerCase();
        const idMatch = phrase.match(/\bPB-\d+\b/i);
        if (idMatch) {
          const matchedId = idMatch[0].toUpperCase();
          const found = existingTasks.find(t => t.id.toUpperCase() === matchedId);
          dependencies.push(found ? found.id : matchedId);
        } else {
          const words = phrase.split(/\s+/).filter(w => w.length > 3);
          const found = existingTasks.find(t => {
            const titleLower = t.title.toLowerCase();
            return words.some(w => titleLower.includes(w));
          });
          if (found && !dependencies.includes(found.id)) {
            dependencies.push(found.id);
          }
        }
      }

      // 7. Subtasks Detection
      const subtasks: string[] = [];
      const subMatch = seg.match(/(?:subtasks?|checklist|steps?)\s*(?:include|are|:)?\s*([^.]+)/i);
      if (subMatch) {
        const items = subMatch[1].split(/,|\band\b/i);
        items.forEach(it => {
          const c = it.trim();
          if (c.length > 2) subtasks.push(c);
        });
      }

      // 8. Clean Deliverable Title
      const title = this.cleanDeliverableTitle(seg);

      drafts.push({
        id: `draft-${Date.now()}-${index}`,
        title,
        description: `Composed via Voice & NLP AI Copilot from: "${seg.trim()}"`,
        projectId: targetProj.id,
        projectCode: targetProj.code,
        assigneeIds,
        priority,
        effortPoints,
        dueDate,
        dependencies,
        subtasks,
        confidence: 0.96
      });
    });

    return drafts;
  }

  private splitIntoTaskClauses(text: string): string[] {
    let prepared = text.trim();

    // 1. Replace newlines and bullet lines with split marker
    prepared = prepared.replace(/(?:\r?\n+[\s*-•\d+.]*)+/g, ' §SPLIT§ ');

    // 2. Mid-sentence task boundaries:
    // e.g. ", and a 3-point high priority task in EVAL-GW...", ", and also create another task...", ", a 5-point ticket..."
    prepared = prepared.replace(
      /,\s*(?:and\s+)?(?:also\s+)?(?=(?:create\s+|add\s+)?(?:a|an|another)\s+(?:[\w-]+\s+){0,4}(?:task|ticket|story|bug|item|deliverable)\b)/gi,
      ' §SPLIT§ '
    );

    // 3. Conjunction before "create", "add", or "assign":
    // e.g. ", and create a task...", ", and assign Karthik..."
    prepared = prepared.replace(
      /,\s*(?:and\s+)?(?:also\s+)?(?=(?:create|add|assign)\s+[A-Za-z0-9_-]+)/gi,
      ' §SPLIT§ '
    );

    // 4. Conjunction before "and a/an/another [pts]-point":
    prepared = prepared.replace(
      /,\s*and\s+(?:also\s+)?(?=(?:a|an|another)\s+\d+\s*-?\s*(?:points?|pts?))/gi,
      ' §SPLIT§ '
    );

    // 5. Explicit sequential markers:
    prepared = prepared.replace(
      /(?:^|[.;,]\s*)(?:next|secondly|thirdly|additionally|furthermore)\s*[,:\s]+/gi,
      ' §SPLIT§ '
    );

    // 6. Sentence periods or semicolons followed by task start or capital word:
    prepared = prepared.replace(
      /[.;]\s+(?=(?:(?:please\s+)?(?:create|add|assign|build|implement|we\s+need|next|also)\b|[A-Z]))/g,
      ' §SPLIT§ '
    );

    const segments = prepared
      .split('§SPLIT§')
      .map(s => s.trim().replace(/^[-*•\d+.]\s*/, ''))
      .filter(s => s.length >= 6);

    return segments.length > 0 ? segments : [text.trim()];
  }

  private cleanDeliverableTitle(seg: string): string {
    let clean = seg.trim();

    // 1. Strip trailing dependency phrases: "blocked by ...", "depends on ...", "after ...", "prerequisite is ..."
    clean = clean.replace(/(?:,\s*)?(?:\b(?:blocked\s+by|depends\s+on|dependent\s+on|after|prerequisite(?:\s+is)?)\b\s+[^,.;]+)+/gi, '');

    // 2. Strip trailing metadata phrases: ", high priority", ", 5 points", ", 5-point", subtasks, etc.
    clean = clean.replace(/(?:,\s*)?(?:\b(?:urgent|critical|high|medium|low)\s*(?:priority)?\b)/gi, '');
    clean = clean.replace(/(?:,\s*)?(?:\b\d+\s*-?\s*(?:points?|pts?)\b)/gi, '');
    clean = clean.replace(/(?:,\s*)?(?:\b(?:subtasks?|checklist|steps?)\s*(?:include|are|:)?\s*[^.]+)/gi, '');
    clean = clean.replace(/(?:,\s*)?(?:\b(?:in|for)\s+[A-Z0-9_-]+\b)(?=\s*$)/gi, '');

    // 3. Strip leading conversational request boilerplate:
    // Handles:
    // "Create an urgent 5-point task in PULSE-V1 for Abhishai to "
    // "a 3-point high priority task in EVAL-GW for Karthik to "
    // "Assign Abhishai and Priya to "
    // "Also assign Karthik to "
    // "Add a 2-point deliverable for Priya: "
    clean = clean.replace(
      /^(?:(?:please\s+)?(?:also\s+)?(?:create|add|open|make|build|assign|set\s+up)\s+)?(?:a|an|another)?\s*(?:(?:urgent|critical|high|medium|low)\s*(?:priority)?\s*)?(?:\d+\s*-?\s*(?:points?|pts?)\s*)?(?:(?:urgent|critical|high|medium|low)\s*(?:priority)?\s*)?(?:task|ticket|story|deliverable|bug|item)?\s*(?:in|for)?\s*(?:[A-Z0-9_-]+)?\s*(?:for|to|assigned\s+to)?\s*(?:[A-Za-z\s,]+?)?\s*(?:to|for|that|which|:)\s*/i,
      ''
    );

    // If there are still phrases like "[Name] needs to" or "[Name] should":
    clean = clean.replace(/^[A-Za-z\s,]+?\s+(?:needs\s+to|should|has\s+to|must)\s+/i, '');

    // Also strip any residual leading "to ":
    clean = clean.replace(/^to\s+/i, '');

    // Strip trailing punctuation like commas, periods, colons
    clean = clean.replace(/[,;:\s.]+$/, '').trim();

    // If stripping removed too much, fallback to cleaned segment
    if (clean.length < 5) {
      clean = seg
        .replace(/,\s*(?:blocked\s+by|depends\s+on)[^,.;]+/gi, '')
        .replace(/,\s*\d+\s*-?\s*pts?/gi, '')
        .trim();
    }

    // Capitalize first letter
    if (clean.length > 0) {
      clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    }

    return clean;
  }

  private async extractViaCorporateLlm(
    promptText: string,
    visibleProjects: Project[],
    squadMembers: TeamMember[],
    existingTasks: Task[]
  ): Promise<ExtractedTaskDraft[]> {
    const endpoint = this.corporateEndpoint();
    const systemPrompt = `You are the PulseBoard Corporate Task Extractor. Output a JSON array of deliverables matching this schema:
[{ "title": string, "projectCode": string, "assigneeNames": string[], "priority": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "effortPoints": number, "dueDate": string, "dependencies": string[], "subtasks": string[] }]
Known projects: ${visibleProjects.map(p => `${p.name} (${p.code})`).join(', ')}.
Known members: ${squadMembers.map(m => m.name).join(', ')}.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          systemPrompt,
          stream: false
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const json = await response.json();
      const rawList = Array.isArray(json) ? json : (json.tasks || json.deliverables || []);
      if (!Array.isArray(rawList) || rawList.length === 0) {
        throw new Error('No task array found in response');
      }

      return rawList.map((item: any, idx: number) => {
        const proj = visibleProjects.find(p => p.code.toLowerCase() === (item.projectCode || '').toLowerCase()) || visibleProjects[0];
        const memberIds = squadMembers
          .filter(m => (item.assigneeNames || []).some((name: string) => m.name.toLowerCase().includes(name.toLowerCase())))
          .map(m => m.id);

        return {
          id: `draft-llm-${Date.now()}-${idx}`,
          title: item.title || 'Untitled Deliverable',
          description: item.description || `Extracted via Corporate LLM from prompt`,
          projectId: proj.id,
          projectCode: proj.code,
          assigneeIds: memberIds.length > 0 ? memberIds : [squadMembers[0]?.id || 'tm-1'],
          priority: item.priority || 'MEDIUM',
          effortPoints: Number(item.effortPoints) || 3,
          dueDate: item.dueDate || new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
          dependencies: item.dependencies || [],
          subtasks: item.subtasks || [],
          confidence: 0.98
        };
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
