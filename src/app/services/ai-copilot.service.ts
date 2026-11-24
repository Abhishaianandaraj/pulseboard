import { Injectable, signal } from '@angular/core';
import {
  Project,
  Task,
  TeamMember,
  TaskPriority,
  ExtractedTaskDraft,
  AssigneeWarning
} from '../models/task.model';

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

  private readonly NON_NAME_STOPWORDS = new Set<string>([
    'we', 'us', 'me', 'i', 'you', 'they', 'them', 'he', 'she', 'it', 'this', 'that', 'these', 'those',
    'the', 'a', 'an', 'our', 'my', 'your', 'their', 'all', 'everyone', 'team', 'squad', 'anyone',
    'someone', 'nobody', 'none', 'unassigned', 'tbd', 'urgent', 'critical', 'high', 'medium', 'low',
    'priority', 'task', 'ticket', 'story', 'bug', 'item', 'deliverable', 'project', 'sprint',
    'frontend', 'backend', 'server', 'client', 'system', 'service', 'app', 'api', 'ui', 'ux', 'qa',
    'dev', 'ai', 'ml', 'llm', 'rag', 'db', 'sql', 'sso', 'rbac', 'gpu', 'pdf', 'csv', 'json', 'sse',
    'chat', 'model', 'pipeline', 'endpoint', 'gateway', 'dashboard', 'vector', 'prompt', 'prompts',
    'test', 'tests', 'testing', 'docs', 'doc', 'build', 'deploy', 'staging', 'prod', 'production',
    'weekly', 'daily', 'monthly', 'internal', 'external', 'automated', 'streaming', 'mobile', 'dark',
    'light', 'new', 'old', 'existing', 'sample', 'user', 'users', 'company', 'corporate', 'enterprise',
    'hr', 'audit', 'logs', 'log', 'report', 'telemetry', 'cache', 'caching', 'redis', 'qdrant',
    'token', 'tokens', 'memory', 'leak', 'button', 'chart', 'header', 'timeline', 'gantt', 'sidebar',
    'drawer', 'modal', 'login', 'auth', 'authentication', 'security', 'guardrails', 'benchmark',
    'benchmarks', 'latency', 'retrieval', 'embedding', 'embeddings', 'search', 'index', 'chunking',
    'feedback', 'widget', 'export', 'import', 'voice', 'nlp', 'action', 'note', 'notes', 'summary',
    'todo', 'next', 'also', 'please', 'create', 'add', 'fix', 'run', 'update', 'connect', 'configure',
    'implement', 'write', 'review', 'check', 'verify', 'evaluate', 'integrate', 'optimize', 'refactor',
    'migrate', 'design', 'investigate', 'open', 'make', 'set', 'up', 'assign', 'ask', 'have', 'get',
    'tomorrow', 'today', 'week', 'days', 'day', 'points', 'point', 'pts', 'effort', 'due', 'deadline',
    'after', 'before', 'blocked', 'depends', 'dependent', 'prerequisite', 'subtask', 'subtasks',
    'checklist', 'steps', 'step', 'and', 'or', 'for', 'in', 'on', 'to', 'by', 'with', 'from', 'of'
  ]);

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Standard Levenshtein edit distance for resilient speech-to-text name resolution.
   * E.g. "Abisha" -> "Abhishai" (dist 2), "Karthick" -> "Karthik" (dist 1).
   */
  private levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    let curr = new Array<number>(n + 1);

    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1,
          curr[j - 1] + 1,
          prev[j - 1] + cost
        );
      }
      [prev, curr] = [curr, prev];
    }
    return prev[n];
  }

  /**
   * Tiered fuzzy + prefix member matching across ALL workspace members:
   * - Tier 0: Exact full name match ("Abhishek J" -> only Abhishek J)
   * - Tier 1: Multi-word first+last match ("Karthick R" -> Karthik R)
   * - Tier 2: Exact first name match ("Abhishek" -> [Abhishek J, Abhishek K] -> AMBIGUOUS)
   * - Tier 3: 4+ char prefix match ("Abhi" -> Abhishai / Abhishek...)
   * - Tier 4: Fuzzy Levenshtein distance <= 2 ("Abisha" -> Abhishai, "Karthick" -> Karthik)
   */
  findMatchingMembers(queryName: string, allMembers: TeamMember[]): TeamMember[] {
    const q = queryName.trim().toLowerCase().replace(/\s+/g, ' ');
    if (q.length < 2) return [];

    const qParts = q.split(' ');

    // Tier 0: Exact full name match
    const exactFull = allMembers.filter(m => m.name.trim().toLowerCase() === q);
    if (exactFull.length > 0) return exactFull;

    // Tier 1: Multi-word query (first + last/initial)
    if (qParts.length >= 2) {
      const qFirst = qParts[0];
      const qLast = qParts.slice(1).join(' ');
      const multiMatches = allMembers.filter(m => {
        const mParts = m.name.trim().toLowerCase().split(/\s+/);
        if (mParts.length < 2) return false;
        const mFirst = mParts[0];
        const mLast = mParts.slice(1).join(' ');

        const firstOk =
          mFirst === qFirst ||
          (qFirst.length >= 4 && mFirst.length >= 4 && (mFirst.startsWith(qFirst) || qFirst.startsWith(mFirst))) ||
          (qFirst.length >= 4 && mFirst.length >= 4 && this.levenshteinDistance(qFirst, mFirst) <= 1) ||
          (qFirst.length >= 5 && mFirst.length >= 5 && qFirst[0] === mFirst[0] && this.levenshteinDistance(qFirst, mFirst) <= 2);

        const lastOk =
          mLast === qLast ||
          mLast.startsWith(qLast) ||
          qLast.startsWith(mLast) ||
          (qLast.length >= 3 && mLast.length >= 3 && this.levenshteinDistance(qLast, mLast) <= 1);

        return firstOk && lastOk;
      });
      if (multiMatches.length > 0) return multiMatches;
      return [];
    }

    // Tier 2: Exact first name match (single word)
    const exactFirst = allMembers.filter(m => m.name.trim().toLowerCase().split(/\s+/)[0] === q);
    if (exactFirst.length > 0) return exactFirst;

    // Tier 3: 4+ char prefix match
    if (q.length >= 4) {
      const prefixMatches = allMembers.filter(m => {
        const first = m.name.trim().toLowerCase().split(/\s+/)[0];
        return first.length >= 4 && (first.startsWith(q) || q.startsWith(first));
      });
      if (prefixMatches.length > 0) return prefixMatches;
    }

    // Tier 4: Fuzzy Levenshtein distance <= 2
    if (q.length >= 4) {
      const dist1: TeamMember[] = [];
      const dist2: TeamMember[] = [];

      for (const m of allMembers) {
        const first = m.name.trim().toLowerCase().split(/\s+/)[0];
        if (first.length < 4) continue;
        const d = this.levenshteinDistance(q, first);
        if (d <= 1) {
          dist1.push(m);
        } else if (d === 2 && q.length >= 5 && first.length >= 5 && q[0] === first[0]) {
          dist2.push(m);
        }
      }

      if (dist1.length > 0) return dist1;
      if (dist2.length > 0) return dist2;
    }

    return [];
  }

  private cleanCandidateNameTokens(rawSpan: string, projectCodesUpper: Set<string>): string[] {
    const pieces = rawSpan
      .split(/\s*(?:,|&|\band\b|\bplus\b)\s*/i)
      .map(p => p.trim().replace(/^(?:the|to|a|an)\s+/i, '').replace(/[.!?;:()]+$/g, '').trim())
      .filter(Boolean);

    const results: string[] = [];
    for (const piece of pieces) {
      if (piece.length < 2) continue;
      if (/^\d/.test(piece)) continue;
      if (/^PB-\d+$/i.test(piece)) continue;
      if (projectCodesUpper.has(piece.toUpperCase())) continue;

      const words = piece.split(/\s+/);
      if (words.length > 3) continue;

      const firstLower = words[0].toLowerCase();
      if (this.NON_NAME_STOPWORDS.has(firstLower)) continue;
      if (words.every(w => this.NON_NAME_STOPWORDS.has(w.toLowerCase()))) continue;

      // Reject pure acronyms / metadata unless 1-letter last initial (e.g. "Abhishek J")
      if (words.length === 1 && /^[A-Z0-9_-]+$/.test(piece) && piece.length <= 4) continue;

      if (!results.some(r => r.toLowerCase() === piece.toLowerCase())) {
        results.push(piece);
      }
    }

    return results;
  }

  /**
   * Extracts spoken/typed assignee name queries from a task clause across all natural phrasings
   * so fuzzy matches, duplicate first names, out-of-project members, and unknown names are all detected.
   */
  private extractSpokenAssigneeQueries(
    seg: string,
    visibleProjects: Project[],
    allMembers: TeamMember[]
  ): string[] {
    const projectCodesUpper = new Set(visibleProjects.map(p => p.code.toUpperCase()));
    const projPattern = visibleProjects
      .map(p => this.escapeRegex(p.code))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .join('|');

    // Strip subtasks, dependencies, and due dates before scanning for assignee slots
    let searchSeg = seg
      .replace(/\b(?:subtasks?|checklist|steps?)\s*(?:includes?|are|consists?\s+of)?\s*:?[^.;]+/gi, '')
      .replace(/(?:(?:this(?:\s+(?:task|ticket|story|item|deliverable|work))?|it)\s+)?\b(?:blocked\s+by|depends\s+on|dependent\s+on|prerequisite(?:\s+is)?|after\s+PB-\d+)\b[^.;,]*/gi, '')
      .replace(/\b(?:due|deadline|by)\s*(?:date\s*[:=]?\s*)?(?:in\s+\d+\s+days?|\d{4}-\d{2}-\d{2}|tomorrow|today|next\s+week)\b/gi, '')
      .trim();

    // Check leading speaker prefix e.g. "Vikram: Abhishai and Priya need to..."
    let speakerCandidate: string | null = null;
    const speakerMatch = searchSeg.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z.]+)?)\s*:\s+(.+)$/);
    if (speakerMatch) {
      const candidate = speakerMatch[1].trim();
      const lowerCand = candidate.toLowerCase();
      if (
        !projectCodesUpper.has(candidate.toUpperCase()) &&
        !/^(?:action\s+item|todo|task|ticket|deliverable|note|follow[\s-]*up|priority|owner|assignee)$/i.test(lowerCand)
      ) {
        speakerCandidate = candidate;
        searchSeg = speakerMatch[2].trim();
      }
    }

    const extracted: string[] = [];
    const addQueries = (rawSpan: string) => {
      for (const q of this.cleanCandidateNameTokens(rawSpan, projectCodesUpper)) {
        if (!extracted.some(e => e.toLowerCase() === q.toLowerCase())) {
          extracted.push(q);
        }
      }
    };

    // Pattern A: "assign / allocate [to] <NAMES> (to | for | in | : | - | ,)" and "ask / tell <NAMES> to"
    const assignRegex = /\b(?:assign|allocate)\s+(?:to\s+)?([A-Za-z][A-Za-z\s,&.-]{1,50}?)(?=\s+(?:to|for|in|on|with)\b|\s*[:,.;(]|$)/gi;
    let m: RegExpExecArray | null;
    while ((m = assignRegex.exec(searchSeg)) !== null) {
      addQueries(m[1]);
    }
    const askRegex = /\b(?:ask|tell)\s+([A-Za-z][A-Za-z\s,&.-]{1,45}?)(?=\s+to\b)/gi;
    while ((m = askRegex.exec(searchSeg)) !== null) {
      addQueries(m[1]);
    }

    // Pattern B: "assigned to <NAMES>", "owned by <NAMES>", "owner: <NAMES>", "assignee: <NAMES>"
    const assignedToRegex = /\b(?:assigned\s+to|owned\s+by|assignee\s*:|owner\s*:)\s*([A-Za-z][A-Za-z\s,&.-]{1,50}?)(?=\s+(?:to|for|in|on|with|blocked|depends|after|due)\b|\s*[:,.;(]|$)/gi;
    while ((m = assignedToRegex.exec(searchSeg)) !== null) {
      addQueries(m[1]);
    }

    // Pattern C: "for <NAMES> to <action>" / "for <NAMES>:" in task-creation or project-scoped position
    const forPrefix = projPattern
      ? `(?:^|(?:task|ticket|story|bug|item|deliverable|${projPattern})\\s+|,\\s*)`
      : `(?:^|(?:task|ticket|story|bug|item|deliverable)\\s+|,\\s*)`;
    const forToRegex = new RegExp(`${forPrefix}for\\s+([A-Za-z][A-Za-z\\s,&.-]{1,45}?)(?=\\s+to\\b|\\s*:\\s*)`, 'gi');
    while ((m = forToRegex.exec(searchSeg)) !== null) {
      addQueries(m[1]);
    }

    // Pattern C2: Trailing "in/for <PROJ> for <NAMES>" (e.g. "Build API in RAG-CORE for Abisha and Priya, 5 pts")
    if (projPattern) {
      const trailingProjForRegex = new RegExp(
        `\\b(?:in|for|on)\\s+(?:project\\s+)?(?:${projPattern})\\s+for\\s+([A-Za-z][A-Za-z\\s,&.-]{1,45}?)(?=\\s*[,.;(]|$)`,
        'gi'
      );
      while ((m = trailingProjForRegex.exec(searchSeg)) !== null) {
        addQueries(m[1]);
      }
    }

    // Pattern D: Leading "<NAMES> will / should / needs to / need to / has to / must"
    let strippedIntro = searchSeg.replace(/^(?:(?:and|also|then|next|please)\s+)+/i, '');
    if (projPattern) {
      strippedIntro = strippedIntro.replace(
        new RegExp(`^(?:(?:in|for|on|under)\\s+(?:project\\s+)?)?(?:${projPattern})\\b[\\s,:-]*`, 'i'),
        ''
      );
    }
    const modalVerbMatch = strippedIntro.match(
      /^([A-Za-z][A-Za-z\s,&.-]{1,45}?)\s+(?:will|should|needs?\s+to|has\s+to|have\s+to|must|is\s+going\s+to|are\s+going\s+to)\b/i
    );
    if (modalVerbMatch) {
      addQueries(modalVerbMatch[1]);
    }

    // Pattern E: Parenthetical metadata names e.g. "(Abisha, Priya, 5 pts, critical)" or "(Karthick)"
    const parenRegex = /\(([^)]+)\)/g;
    while ((m = parenRegex.exec(searchSeg)) !== null) {
      const inner = m[1];
      const parenTokens = inner.split(/,\s*|\s+and\s+/i).map(t => t.trim()).filter(Boolean);
      for (const tok of parenTokens) {
        if (/\b(?:urgent|critical|high|medium|low|priority|points?|pts?|due|days?|blocked|depends|p[0-3])\b/i.test(tok)) continue;
        if (/^\d/.test(tok) || projectCodesUpper.has(tok.toUpperCase())) continue;
        // Include if it matches a workspace member OR looks like a person name inside a metadata paren
        const matchesAny = this.findMatchingMembers(tok, allMembers).length > 0;
        const looksLikePersonName = /^[A-Z][a-z]{2,}(?:\s+[A-Z][a-z.]*)?$/.test(tok) && !this.NON_NAME_STOPWORDS.has(tok.toLowerCase());
        if (matchesAny || looksLikePersonName) {
          addQueries(tok);
        }
      }
    }

    // Pattern F: Speaker prefix acts as assignee ONLY when no explicit assignee appeared in body
    if (extracted.length === 0 && speakerCandidate) {
      addQueries(speakerCandidate);
    }

    // Pattern G: Fallback scan across words in body if no explicit assignment slot matched
    if (extracted.length === 0) {
      const tokens = searchSeg.replace(/[,.;:()!?]/g, ' ').split(/\s+/).filter(Boolean);
      for (let i = 0; i < tokens.length; i++) {
        const w = tokens[i];
        const wLower = w.toLowerCase();
        if (this.NON_NAME_STOPWORDS.has(wLower) || projectCodesUpper.has(w.toUpperCase()) || /^PB-\d+$/i.test(w)) {
          continue;
        }
        // Check 2-word full name pair first (e.g. "Abhishek J" or "Priya Nair")
        if (i + 1 < tokens.length) {
          const nextW = tokens[i + 1];
          if (!this.NON_NAME_STOPWORDS.has(nextW.toLowerCase()) && !projectCodesUpper.has(nextW.toUpperCase())) {
            const pair = `${w} ${nextW}`;
            if (this.findMatchingMembers(pair, allMembers).length > 0) {
              if (!extracted.some(e => e.toLowerCase() === pair.toLowerCase())) {
                extracted.push(pair);
              }
              i++;
              continue;
            }
          }
        }
        if (this.findMatchingMembers(w, allMembers).length > 0) {
          if (!extracted.some(e => e.toLowerCase() === wLower)) {
            extracted.push(w);
          }
        }
      }
    }

    return extracted;
  }

  /**
   * Resolves spoken/typed assignee queries against ALL workspace members and validates
   * target project membership (`targetProj.memberIds`), emitting structured `AssigneeWarning`s.
   */
  resolveAssigneesForProject(
    nameQueries: string[],
    targetProj: Project,
    allMembers: TeamMember[]
  ): { assigneeIds: string[]; assigneeWarning: AssigneeWarning | null } {
    const projectMemberIds = new Set<string>(targetProj.memberIds || []);
    const hasProjectRoster = Array.isArray(targetProj.memberIds) && targetProj.memberIds.length > 0;

    // If user didn't mention any assignee name at all, default cleanly to a member inside the target project
    if (nameQueries.length === 0) {
      const defaultProjMember = hasProjectRoster
        ? allMembers.find(m => projectMemberIds.has(m.id))
        : allMembers[0];
      return {
        assigneeIds: defaultProjMember ? [defaultProjMember.id] : [],
        assigneeWarning: null
      };
    }

    const resolvedIds: string[] = [];
    let warning: AssigneeWarning | null = null;

    for (const qName of nameQueries) {
      const matches = this.findMatchingMembers(qName, allMembers);

      if (matches.length === 0) {
        // Case 3: Unknown Name
        if (!warning) {
          warning = { type: 'UNKNOWN', queryName: qName };
        }
      } else if (matches.length >= 2) {
        // Case 1: Ambiguous First Name (2+ workspace members match) — leave empty until chosen
        warning = {
          type: 'AMBIGUOUS',
          queryName: qName,
          candidateIds: matches.map(m => m.id)
        };
      } else {
        // Single workspace member matched — verify membership in target project
        const member = matches[0];
        if (hasProjectRoster && !projectMemberIds.has(member.id)) {
          // Case 2: Out-of-Project Member — do not silently assign
          if (!warning) {
            warning = {
              type: 'NOT_IN_PROJECT',
              memberId: member.id,
              memberName: member.name,
              projectCode: targetProj.code
            };
          }
        } else {
          if (!resolvedIds.includes(member.id)) {
            resolvedIds.push(member.id);
          }
        }
      }
    }

    // For AMBIGUOUS, strictly ensure assigneeIds stays empty if only ambiguous names were queried
    return {
      assigneeIds: resolvedIds,
      assigneeWarning: warning
    };
  }

  private extractViaLocalNlp(
    text: string,
    visibleProjects: Project[],
    squadMembers: TeamMember[],
    existingTasks: Task[]
  ): ExtractedTaskDraft[] {
    const segments = this.splitIntoTaskClauses(text, visibleProjects, squadMembers);

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
          const nameKeywords = proj.name
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter(w => w.length > 3);
          if (nameKeywords.some(kw => new RegExp(`\\b${this.escapeRegex(kw)}\\b`, 'i').test(seg))) {
            matchedProj = proj;
            break;
          }
        }
      }
      const targetProj: Project = matchedProj || visibleProjects[0] || {
        id: 'proj-1',
        name: 'Enterprise RAG Copilot',
        code: 'RAG-CORE',
        description: '',
        teamName: 'Core AI Squad',
        status: 'ACTIVE',
        color: '#5C7362',
        memberIds: squadMembers.map(m => m.id)
      };

      // 2. Smart Fuzzy/Prefix Co-Assignee Resolution & Disambiguation
      const spokenNameQueries = this.extractSpokenAssigneeQueries(seg, visibleProjects, squadMembers);
      const { assigneeIds, assigneeWarning } = this.resolveAssigneesForProject(
        spokenNameQueries,
        targetProj,
        squadMembers
      );

      // 3. Priority Detection
      let priority: TaskPriority = 'MEDIUM';
      if (/\b(?:urgent|critical|blocker|p0|asap)\b/i.test(seg)) {
        priority = 'CRITICAL';
      } else if (/\b(?:high(?:\s+priority)?|important|p1)\b/i.test(seg)) {
        priority = 'HIGH';
      } else if (/\b(?:low\s+priority|minor|trivial|p3)\b/i.test(seg) || /(?:^|[,;(])\s*low\s*(?:[,;.)]|$)/i.test(seg)) {
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
        } else if (/\btomorrow\b/i.test(seg)) {
          dueDate = new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0];
        } else if (/\bnext\s+week\b/i.test(seg)) {
          dueDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
        }
      }

      // 6. Upstream Dependency Detection (supports multiple PB-XXX refs or title keyword matching)
      const dependencies: string[] = [];
      const depRegex = /(?:depends\s+on|dependent\s+on|prerequisite(?:\s+is)?|after|blocked\s+by)\s+([^.;]+)/gi;
      let depMatch: RegExpExecArray | null;
      while ((depMatch = depRegex.exec(seg)) !== null) {
        const phrase = depMatch[1].trim();
        const idMatches = phrase.match(/\bPB-\d+\b/gi);
        if (idMatches && idMatches.length > 0) {
          idMatches.forEach(rawId => {
            const matchedId = rawId.toUpperCase();
            const found = existingTasks.find(t => t.id.toUpperCase() === matchedId);
            const resolvedId = found ? found.id : matchedId;
            if (!dependencies.includes(resolvedId)) {
              dependencies.push(resolvedId);
            }
          });
        } else {
          const words = phrase.toLowerCase().split(/\s+/).filter(w => w.length > 3);
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
      const subMatch = seg.match(/\b(?:subtasks?|checklist|steps?)\s*(?:includes?|are|consists?\s+of)?\s*:?\s*([^.;]+)/i);
      if (subMatch) {
        const cleanedSubClause = subMatch[1].replace(
          /,?\s*\b(?:blocked\s+by|depends\s+on|dependent\s+on|after\s+PB-\d+|due\s+(?:in|by|on)|(?:urgent|critical|high|medium|low)\s+priority|\d+\s*-?\s*(?:points?|pts?))\b.*$/i,
          ''
        );
        const items = cleanedSubClause.split(/,\s*(?:and\s+)?|\s+and\s+/i);
        items.forEach(it => {
          const c = it.trim().replace(/^[:\s-]+|[:\s.-]+$/g, '');
          if (c.length > 2) subtasks.push(c);
        });
      }

      // 8. Clean Deliverable Title (strips known members + spoken/fuzzy/unknown name queries too)
      const title = this.cleanDeliverableTitle(seg, visibleProjects, squadMembers, spokenNameQueries);

      drafts.push({
        id: `draft-${Date.now()}-${index}`,
        title,
        description: `Composed via Voice & NLP AI Copilot from: "${seg.trim()}"`,
        projectId: targetProj.id,
        projectCode: targetProj.code,
        assigneeIds,
        assigneeWarning,
        priority,
        effortPoints,
        dueDate,
        dependencies,
        subtasks,
        confidence: assigneeWarning ? 0.78 : 0.96
      });
    });

    return drafts;
  }

  private isHeaderOrMetadataLine(line: string, visibleProjects: Project[]): boolean {
    const trimmed = line.trim();
    if (trimmed.length < 5) return true;

    // Pure metadata headers like "Attendees: ...", "Date: ...", "Topic: ...", "Agenda: ..."
    if (/^(?:attendees?|participants?|date|time|location|agenda|topic|subject|facilitator|scribe|channel)\s*[:–—-]/i.test(trimmed)) {
      return true;
    }

    // Pure section headings ending in colon (e.g. "Sprint Planning Action Items - AI Engineering Squad:", "Action Items:")
    if (/:$/.test(trimmed)) {
      const hasProject = visibleProjects.some(p => trimmed.toUpperCase().includes(p.code.toUpperCase()));
      const hasPoints = /\b\d+\s*-?\s*(?:points?|pts?)\b/i.test(trimmed);
      if (!hasProject && !hasPoints) return true;
    }

    // Document title lines like "Meeting Notes - Nov 24 Daily Standup" with no project/points/action verbs
    if (/^(?:meeting\s+notes?|sprint\s+planning|daily\s+standup|standup\s+notes?|weekly\s+sync|retrospective|summary|action\s+items?|next\s+steps?|follow[\s-]*ups?)\b/i.test(trimmed)) {
      const hasProject = visibleProjects.some(p => trimmed.toUpperCase().includes(p.code.toUpperCase()));
      const hasPoints = /\b\d+\s*-?\s*(?:points?|pts?)\b/i.test(trimmed);
      const hasActionVerb = /\b(?:assign|build|implement|create|add|fix|run|test|update|connect|configure|deploy|write|design|refactor|migrate|evaluate|integrate|optimize|investigate)\b/i.test(trimmed);
      if (!hasProject && !hasPoints && !hasActionVerb) return true;
    }

    return false;
  }

  private isContinuationClause(clause: string): boolean {
    return /^(?:this(?:\s+(?:task|ticket|story|item|deliverable|work))?\s+(?:depends|is\s+blocked|blocks|requires|needs|has|should|will|includes)|it\s+(?:depends|is\s+blocked|requires|should|needs)|depends\s+on|dependent\s+on|blocked\s+by|after\s+PB-\d+|prerequisite|subtasks?|checklist|steps?|due\s+(?:date|in|by|on)|priority\s*[:=]|estimated\b|effort\s*[:=]|story\s+points?\s*[:=])/i.test(
      clause.trim()
    );
  }

  private splitIntoTaskClauses(
    text: string,
    visibleProjects: Project[],
    squadMembers: TeamMember[]
  ): string[] {
    // 1. Split cleanly by line breaks first (avoids regex range corruption across lines)
    const rawLines = text
      .split(/\r?\n+/)
      .map(line => line.trim().replace(/^(?:[-*•–—]+\s*)+/, '').replace(/^\d+[.):]\s*/, '').trim())
      .filter(line => line.length > 0 && !this.isHeaderOrMetadataLine(line, visibleProjects));

    const projectPattern = visibleProjects
      .map(p => this.escapeRegex(p.code))
      .filter(Boolean)
      .join('|');

    const rawSegments: string[] = [];

    for (const line of rawLines) {
      // Protect checklist/subtask clauses so commas inside checklists (e.g. ", add timeout, create tests") are not split into new tasks
      const protectedSpans: string[] = [];
      let prepared = line.replace(
        /\b(?:subtasks?|checklist|steps?)\s*(?:includes?|are|consists?\s+of)?\s*:?\s*[^.;]+/gi,
        (match) => {
          const idx = protectedSpans.length;
          protectedSpans.push(match);
          return `§PROTECTED_${idx}§`;
        }
      );

      // 2. Mid-sentence task boundaries (comma or comma-less voice dictation):
      // e.g. ", and a 3-point high priority task in EVAL-GW...", "and create a 3-point task..."
      prepared = prepared.replace(
        /(?:,\s*(?:and\s+)?(?:also\s+)?|\s+and\s+(?:also\s+)?)(?=(?:create\s+|add\s+|open\s+)?(?:a|an|another)\s+(?:[\w-]+\s+){0,5}(?:task|ticket|story|bug|item|deliverable)\b)/gi,
        ' §SPLIT§ '
      );

      // 3. Mid-sentence conjunction before "assign <Name>" (supports exact, fuzzy, and unknown names) or "create/add a/an/another ..."
      // Require explicit "and"/"also" so leading scopes like "In RAG-CORE, assign Abhishai..." are NOT split apart
      prepared = prepared.replace(
        /(?:,\s*(?:and\s+(?:also\s+)?|also\s+)|\s+and\s+(?:also\s+)?)(?=(?:assign|ask|have)\s+[A-Za-z])/gi,
        ' §SPLIT§ '
      );
      prepared = prepared.replace(
        /(?:,\s*(?:and\s+(?:also\s+)?|also\s+)|\s+and\s+(?:also\s+)?)(?=(?:create|add|open)\s+(?:a|an|another)\b)/gi,
        ' §SPLIT§ '
      );

      // 4. Mid-sentence conjunction before "in/for <PROJECT_CODE>"
      if (projectPattern) {
        prepared = prepared.replace(
          new RegExp(`,\\s*and\\s+(?:also\\s+)?(?=(?:in|for)\\s+(?:${projectPattern})\\b)`, 'gi'),
          ' §SPLIT§ '
        );
      }

      // 5. Conjunction before "and a/an/another [pts]-point"
      prepared = prepared.replace(
        /(?:,\s*|\s+)and\s+(?:also\s+)?(?=(?:a|an|another)\s+\d+\s*-?\s*(?:points?|pts?)\b)/gi,
        ' §SPLIT§ '
      );

      // 6. Explicit sequential markers
      prepared = prepared.replace(
        /(?:^|[.;,]\s*)(?:next|secondly|thirdly|additionally|furthermore)\s*[,:\s]+/gi,
        ' §SPLIT§ '
      );

      // 7. Sentence boundaries (period/semicolon followed by a new clause)
      prepared = prepared.replace(
        /[.;]\s+(?=(?:(?:and\s+)?(?:also\s+)?(?:please\s+)?(?:create|add|assign|build|implement|we\s+need|next|also|in\s+|for\s+)\b|[A-Z]))/g,
        ' §SPLIT§ '
      );

      // Restore protected subtask spans
      const restoredParts = prepared
        .split('§SPLIT§')
        .map(part =>
          part
            .replace(/§PROTECTED_(\d+)§/g, (_, idx) => protectedSpans[Number(idx)] || '')
            .trim()
        )
        .filter(part => part.length > 0);

      rawSegments.push(...restoredParts);
    }

    // 8. Re-attach any standalone project-scope prefix (e.g. "In RAG-CORE") forward into its following task,
    //    and merge continuation clauses (e.g. "This task depends on PB-101.", "Subtasks: ...") backward into their preceding task.
    const projectPrefixOnlyRegex = projectPattern
      ? new RegExp(`^(?:(?:in|for|on|under)\\s+(?:project\\s+)?)?(?:${projectPattern})\\s*[,:-]*$`, 'i')
      : null;

    const merged: string[] = [];
    for (let i = 0; i < rawSegments.length; i++) {
      const seg = rawSegments[i];
      if (projectPrefixOnlyRegex && projectPrefixOnlyRegex.test(seg) && i + 1 < rawSegments.length) {
        rawSegments[i + 1] = `${seg}, ${rawSegments[i + 1]}`;
        continue;
      }
      if (merged.length > 0 && this.isContinuationClause(seg)) {
        merged[merged.length - 1] = `${merged[merged.length - 1].replace(/\.+$/, '')}. ${seg}`;
      } else if (seg.length >= 6) {
        merged.push(seg);
      }
    }

    return merged.length > 0 ? merged : [text.trim()];
  }

  private cleanDeliverableTitle(
    seg: string,
    visibleProjects: Project[],
    squadMembers: TeamMember[],
    extraAssigneeQueries: string[] = []
  ): string {
    let clean = seg.trim();

    // Build exact patterns from actual visible projects, squad members, AND spoken/fuzzy/unknown name queries
    const projCodes = visibleProjects
      .map(p => this.escapeRegex(p.code))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    const projPattern = projCodes.join('|');

    const memberTokens = Array.from(
      new Set([
        ...squadMembers.flatMap(m => {
          const full = m.name.trim();
          const first = full.split(/\s+/)[0];
          return first && first !== full ? [full, first] : [full];
        }),
        ...extraAssigneeQueries.map(q => q.trim()).filter(q => q.length >= 2)
      ])
    )
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map(n => this.escapeRegex(n));
    const memberPattern = memberTokens.join('|');
    const assigneeListPattern = memberPattern
      ? `(?:${memberPattern})(?:\\s*(?:,|&|\\band\\b)\\s*(?:${memberPattern}))*`
      : '';

    // 1. Strip leading bullet/numbering, action-item label, or speaker prefix (e.g. "Vikram: ", "Action Item:")
    clean = clean.replace(/^(?:[-*•–—]+\s*|\d+[.):]\s*)+/, '');
    clean = clean.replace(/^(?:action\s+item|todo|task|ticket|deliverable|follow[\s-]*up)\s*(?:#?\d+)?\s*[:–—-]\s*/i, '');
    if (memberPattern) {
      clean = clean.replace(new RegExp(`^(?:${memberPattern})\\s*:\\s*`, 'i'), '');
    } else {
      clean = clean.replace(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*:\s*/, '');
    }

    // 2. Strip parenthetical metadata blocks e.g. "(critical, 5 pts, due in 3 days)" or "(Abhishai, Priya)" while preserving technical parens like "(SSE)"
    clean = clean.replace(/\(([^)]+)\)/g, (full, inner: string) => {
      const trimmedInner = inner.trim();
      const isMeta = /\b(?:urgent|critical|high|medium|low|priority|points?|pts?|due|in\s+\d+\s+days?|blocked\s+by|depends\s+on|p[0-3])\b/i.test(trimmedInner) ||
        (projPattern ? new RegExp(`\\b(?:${projPattern})\\b`, 'i').test(trimmedInner) : false) ||
        (assigneeListPattern ? new RegExp(`^${assigneeListPattern}$`, 'i').test(trimmedInner) : false);
      return isMeta ? '' : full;
    });

    // 3. Strip subtask/checklist clauses
    clean = clean.replace(/(?:[,;.\s]*\b(?:with\s+)?(?:subtasks?|checklist|steps?)\s*(?:includes?|are|consists?\s+of)?\s*:?[^.;]+)/gi, '');

    // 4. Strip dependency clauses ("This task depends on PB-101", "blocked by PB-102", "after PB-101")
    clean = clean.replace(
      /(?:[,;.\s]*(?:(?:this(?:\s+(?:task|ticket|story|item|deliverable|work))?|it)\s+)?\b(?:blocked\s+by|depends\s+on|dependent\s+on|prerequisite(?:\s+is)?)\b[^.;,]*)/gi,
      ''
    );
    clean = clean.replace(/(?:[,;.\s]*\bafter\s+PB-\d+\b[^.;,]*)/gi, '');

    // 5. Strip due date phrases ("due in 4 days", "due 2026-12-01", "due tomorrow", "by next week")
    clean = clean.replace(
      /(?:[,;.\s]*\b(?:due|deadline|by)\s*(?:date\s*[:=]?\s*)?(?:in\s+\d+\s+days?|\d{4}-\d{2}-\d{2}|tomorrow|today|next\s+week|end\s+of\s+(?:day|week|sprint)|eod|eow)\b)/gi,
      ''
    );

    // 6. Peel leading conversational, project, task-creation, and assignment boilerplate iteratively
    let strippedBoilerplate = false;
    let strippedTaskNoun = false;

    for (let pass = 0; pass < 6; pass++) {
      const before = clean;

      // Layer A: Leading conjunctions, transitions, politeness
      clean = clean.replace(
        /^(?:and|also|then|next|plus|secondly|thirdly|additionally|furthermore|finally|please|kindly|can\s+you|could\s+you|we\s+need\s+to|we\s+should|let'?s)\b[\s,]*/i,
        ''
      );

      // Layer B: Leading project scope ("In RAG-CORE,", "For EVAL-GW,", "RAG-CORE:")
      if (projPattern) {
        clean = clean.replace(
          new RegExp(`^(?:(?:in|for|on|under)\\s+(?:project\\s+)?)?(?:${projPattern})\\b[\\s,:-]*`, 'i'),
          ''
        );
      }

      // Layer C: Leading task-creation phrase ("create an urgent 5-point task", "a 3-point high priority task")
      const afterCreate = clean.replace(
        /^(?:(?:create|add|open|make|log|file|raise|new)\s+)?(?:(?:a|an|another)\s+)?(?:(?:urgent|critical|high|medium|low|p[0-3])\s*(?:priority\s*)?)*(?:\d+\s*-?\s*(?:points?|pts?)\s*)?(?:(?:urgent|critical|high|medium|low|p[0-3])\s*(?:priority\s*)?)*(?:task|ticket|story|bug|item|deliverable)\b[\s,:-]*/i,
        ''
      );
      if (afterCreate !== clean) {
        clean = afterCreate;
        strippedBoilerplate = true;
        strippedTaskNoun = true;
      }

      // Layer D: "assign / ask / have <Members> (to)"
      if (assigneeListPattern) {
        const afterAssign = clean.replace(
          new RegExp(`^(?:assign|ask|have|get|tell|allocate)\\s+(?:to\\s+)?${assigneeListPattern}\\s*(?:to\\b|:\\s*|-\\s*)`, 'i'),
          ''
        );
        if (afterAssign !== clean) {
          clean = afterAssign;
          strippedBoilerplate = true;
        }

        // Layer E: "for <Members> (to)" / "assigned to <Members> (to)"
        const afterForMember = clean.replace(
          new RegExp(`^(?:for|assigned\\s+to|owned\\s+by|owner\\s*:?)\\s+${assigneeListPattern}\\s*(?:to\\b|:\\s*|-\\s*|,\\s*)`, 'i'),
          ''
        );
        if (afterForMember !== clean) {
          clean = afterForMember;
          strippedBoilerplate = true;
        }

        // Layer F: "<Members> will / should / needs to / need to / has to / must / to"
        const afterMemberVerb = clean.replace(
          new RegExp(`^${assigneeListPattern}\\s+(?:will|should|needs?\\s+to|has\\s+to|have\\s+to|must|is\\s+going\\s+to|are\\s+going\\s+to|to)\\b\\s*`, 'i'),
          ''
        );
        if (afterMemberVerb !== clean) {
          clean = afterMemberVerb;
          strippedBoilerplate = true;
        }
      }

      // Fallback proper-name assignee pattern if task noun was already stripped (handles unlisted names like "for Sarah to")
      if (strippedTaskNoun) {
        const afterGenericFor = clean.replace(
          /^(?:for|assigned\s+to)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s*(?:,|&|\band\b)\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)*\s+(?:to\b|:\s*)/,
          ''
        );
        if (afterGenericFor !== clean) {
          clean = afterGenericFor;
          strippedBoilerplate = true;
        }
      }

      // Layer G: Residual leading "to " / ": " after boilerplate stripping
      if (strippedBoilerplate) {
        clean = clean.replace(/^(?:to\s+|that\s+|:\s*)/i, '');
      }

      if (clean === before) break;
    }

    // 7. Strip trailing / comma-bounded priority & story points metadata (preserves technical terms like "low latency" or "high availability")
    clean = clean.replace(/(?:,\s*)?\b(?:(?:urgent|critical|high|medium|low|p[0-3])\s+)+priority\b/gi, '');
    clean = clean.replace(/(?:,\s*)?\b\d+\s*-?\s*(?:points?|pts?)\s*(?:task|ticket|story|item|deliverable|effort)?\b/gi, '');
    clean = clean.replace(/(?:,\s*)?\b(?:effort|size|story\s+points?)\s*[:=]?\s*\d+\b/gi, '');
    clean = clean.replace(/(?:,\s*)?\b(?:urgent|critical|p0|p1|p2|p3|asap)\b(?=\s*(?:,|;|\.|$))/gi, '');
    clean = clean.replace(/,\s*(?:high|medium|low)\b(?=\s*(?:,|;|\.|$))/gi, '');

    // 8 & 9. Iteratively strip trailing project scopes ("in RAG-CORE", "for EVAL-GW") and trailing assignee clauses ("for Abhishai and Priya", ", assigned to Karthik")
    for (let pass = 0; pass < 3; pass++) {
      const beforeTail = clean;
      if (projPattern) {
        clean = clean.replace(
          new RegExp(`(?:[\\s,]+(?:in|for|on|under)\\s+(?:project\\s+)?(?:${projPattern})\\b)[\\s.,;:]*$`, 'i'),
          ''
        );
      }
      if (assigneeListPattern) {
        clean = clean.replace(
          new RegExp(`(?:(?:,\\s*|\\s+)(?:assigned\\s+to|for|owner\\s*:?)\\s+${assigneeListPattern})[\\s.,;:]*$`, 'i'),
          ''
        );
      }
      if (clean === beforeTail) break;
    }

    // 10. Clean up orphaned commas, punctuation, empty parens, and extra spaces
    clean = clean
      .replace(/\(\s*[,;:\s]*\)/g, '')
      .replace(/\s*,\s*(?:,\s*)+/g, ', ')
      .replace(/,\s*(?:task|ticket|story|item|deliverable)\s*(?:,|$)/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[,;:\s.–—-]+|[,;:\s.–—-]+$/g, '')
      .trim();

    // Fallback if stripping somehow emptied the string
    if (clean.length < 4) {
      clean = seg
        .replace(/,\s*(?:blocked\s+by|depends\s+on)[^.;]+/gi, '')
        .replace(/,\s*\d+\s*-?\s*(?:points?|pts?)/gi, '')
        .trim();
    }

    // Capitalize first letter cleanly
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
        const rawNames: string[] = Array.isArray(item.assigneeNames)
          ? item.assigneeNames.map((n: any) => String(n || '').trim()).filter(Boolean)
          : [];
        const { assigneeIds, assigneeWarning } = this.resolveAssigneesForProject(rawNames, proj, squadMembers);

        return {
          id: `draft-llm-${Date.now()}-${idx}`,
          title: item.title || 'Untitled Deliverable',
          description: item.description || `Extracted via Corporate LLM from prompt`,
          projectId: proj.id,
          projectCode: proj.code,
          assigneeIds,
          assigneeWarning,
          priority: item.priority || 'MEDIUM',
          effortPoints: Number(item.effortPoints) || 3,
          dueDate: item.dueDate || new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
          dependencies: item.dependencies || [],
          subtasks: item.subtasks || [],
          confidence: assigneeWarning ? 0.8 : 0.98
        };
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
