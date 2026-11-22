import {
  Project,
  TeamMember,
  Task,
  ActivityLog,
  SmartImportPayload,
  RolePermissionPolicy,
  SystemRole
} from '../models/task.model';

export const DEFAULT_ROLE_PERMISSION_POLICIES: Record<SystemRole, RolePermissionPolicy> = {
  ADMIN: {
    role: 'ADMIN',
    canCreateTasks: true,
    canViewAllLogs: true,
    canApproveSignOff: true,
    canManageSharing: true
  },
  LEAD: {
    role: 'LEAD',
    canCreateTasks: true,
    canViewAllLogs: true,
    canApproveSignOff: true,
    canManageSharing: true
  },
  VIEWER: {
    role: 'VIEWER',
    canCreateTasks: false,
    canViewAllLogs: true,
    canApproveSignOff: false,
    canManageSharing: true
  },
  DEV: {
    role: 'DEV',
    canCreateTasks: true,
    canViewAllLogs: false,
    canApproveSignOff: false,
    canManageSharing: false
  },
  QA: {
    role: 'QA',
    canCreateTasks: true,
    canViewAllLogs: false,
    canApproveSignOff: false,
    canManageSharing: false
  }
};

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'Enterprise RAG Copilot',
    code: 'RAG-CORE',
    description: 'Internal document search, question-answering, and vector retrieval pipeline.',
    teamName: 'Core AI Squad',
    status: 'ACTIVE',
    color: '#3b82f6',
    memberIds: ['tm-1', 'tm-2', 'tm-3', 'tm-5', 'tm-6']
  },
  {
    id: 'proj-2',
    name: 'LLM Guardrails & Eval Gateway',
    code: 'EVAL-GW',
    description: 'Model evaluation gateway, prompt safety benchmarks, and automated QA testing suite.',
    teamName: 'Platform & QA Squad',
    status: 'STAGING',
    color: '#8b5cf6',
    memberIds: ['tm-2', 'tm-3', 'tm-4', 'tm-5', 'tm-6']
  },
  {
    id: 'proj-3',
    name: 'PulseBoard Internal Tooling',
    code: 'PULSE-V1',
    description: 'Lightweight, zero-license-wall engineering task & deployment verification board.',
    teamName: 'Core AI Squad',
    status: 'ACTIVE',
    color: '#10b981',
    memberIds: ['tm-1', 'tm-2', 'tm-5', 'tm-6']
  }
];

export const INITIAL_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'tm-1',
    name: 'Abhishai',
    role: 'Full-Stack Dev',
    systemRole: 'DEV',
    squad: 'Core AI Squad',
    avatar: 'AB',
    email: 'abhishai@pulseboard.internal',
    color: '#2563eb',
    department: 'Engineering',
    capacityBudget: 15
  },
  {
    id: 'tm-2',
    name: 'Priya Nair',
    role: 'AI Engineer',
    systemRole: 'DEV',
    squad: 'Core AI Squad',
    avatar: 'PN',
    email: 'priya.nair@pulseboard.internal',
    color: '#7c3aed',
    department: 'Applied AI',
    capacityBudget: 15
  },
  {
    id: 'tm-3',
    name: 'Karthik R',
    role: 'QA / Test Engineer',
    systemRole: 'QA',
    squad: 'Platform & QA Squad',
    avatar: 'KR',
    email: 'karthik.r@pulseboard.internal',
    color: '#06b6d4',
    department: 'Quality Assurance',
    capacityBudget: 15
  },
  {
    id: 'tm-4',
    name: 'Rahul Verma',
    role: 'Full-Stack Dev',
    systemRole: 'DEV',
    squad: 'Platform & QA Squad',
    avatar: 'RV',
    email: 'rahul.verma@pulseboard.internal',
    color: '#f59e0b',
    department: 'Backend & Infra',
    capacityBudget: 15
  },
  {
    id: 'tm-5',
    name: 'Vikram Rao',
    role: 'Tech Lead',
    systemRole: 'LEAD',
    squad: 'Core AI Squad',
    avatar: 'VR',
    email: 'vikram.rao@pulseboard.internal',
    color: '#10b981',
    department: 'Technical Leadership',
    capacityBudget: 15
  },
  {
    id: 'tm-6',
    name: 'Sanjay Patel',
    role: 'Delivery Manager',
    systemRole: 'VIEWER',
    squad: 'Core AI Squad',
    avatar: 'SP',
    email: 'sanjay.patel@pulseboard.internal',
    color: '#64748b',
    department: 'Product Strategy',
    capacityBudget: 15
  }
];

export const INITIAL_TASKS: Task[] = [
  {
    id: 'PB-101',
    projectId: 'proj-1', // RAG-CORE
    title: 'Set up vector database index and embedding endpoint',
    description: 'Configure Qdrant vector database collection for company docs. Set up text-embedding endpoint and verify search response time under 100ms.',
    status: 'DEPLOYED',
    priority: 'CRITICAL',
    phase: 'Phase 1: Knowledge Core',
    sprint: 'Sprint 24.3',
    effortPoints: 8,
    assigneeIds: ['tm-2'], // Priya Nair (AI Engineer)
    assigneeId: 'tm-2',
    startDate: '2026-11-10',
    dueDate: '2026-11-19',
    baselineDueDate: '2026-11-19',
    reworkCount: 0,
    slipReason: null,
    blocked: false,
    deployedUrl: 'https://staging-infer.internal.ai/v1/health',
    dependencies: [],
    subtasks: [
      { id: 'st-1', taskId: 'PB-101', title: 'Create document collection with cosine distance metric', completed: true, createdAt: '2026-11-10' },
      { id: 'st-2', taskId: 'PB-101', title: 'Connect embedding API key and set up rate limiting', completed: true, createdAt: '2026-11-11' },
      { id: 'st-3', taskId: 'PB-101', title: 'Upload test batch of 20 engineering wiki articles', completed: true, createdAt: '2026-11-12' },
      { id: 'st-4', taskId: 'PB-101', title: 'Verify top-5 similarity search returns relevant paragraphs', completed: true, createdAt: '2026-11-13' }
    ],
    reviewNotes: [
      {
        id: 'rn-1',
        taskId: 'PB-101',
        author: 'Vikram Rao (Tech Lead)',
        authorAvatar: 'VR',
        authorRole: 'LEAD',
        content: 'Vector database responding cleanly on internal port 6333. Embedding latency avg 45ms. Ready for retrieval pipeline integration.',
        timestamp: 'Today at 02:15 PM',
        verdict: 'OBSERVATION'
      }
    ],
    createdAt: '2026-11-10T09:00:00Z',
    updatedAt: '2026-11-18T14:15:00Z'
  },
  {
    id: 'PB-102',
    projectId: 'proj-1', // RAG-CORE
    title: 'Connect RAG retrieval API to internal SSO authentication',
    description: 'Bridge document search endpoint with corporate OAuth/SSO login so users only retrieve internal files their department has permission to read.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    phase: 'Phase 2: Serving Engine',
    sprint: 'Sprint 24.3',
    effortPoints: 5,
    assigneeIds: ['tm-1', 'tm-2'], // Co-assigned: Abhishai + Priya Nair
    assigneeId: 'tm-1',
    startDate: '2026-11-12',
    dueDate: '2026-11-20',
    baselineDueDate: '2026-11-17',
    reworkCount: 1,
    slipReason: 'DEPENDENCY_BLOCKED',
    slipJustification: 'Waiting for corporate OAuth client ID and staging security certificate from IT',
    blocked: true,
    blockerReason: 'Waiting for corporate OAuth client ID and staging security certificate from IT',
    dependencies: ['PB-101'],
    subtasks: [
      { id: 'st-5', taskId: 'PB-102', title: 'Extract user department and email claim from auth session', completed: true, createdAt: '2026-11-12' },
      { id: 'st-6', taskId: 'PB-102', title: 'Filter vector search queries by user department role', completed: true, createdAt: '2026-11-14' },
      { id: 'st-7', taskId: 'PB-102', title: 'Add unit tests for restricted financial & HR document queries', completed: false, createdAt: '2026-11-15' }
    ],
    reviewNotes: [
      {
        id: 'rn-102',
        taskId: 'PB-102',
        author: 'Vikram Rao (Tech Lead)',
        authorAvatar: 'VR',
        authorRole: 'LEAD',
        content: 'Auth token verification failed on staging due to missing department claim. Rework required to handle fallback guest roles.',
        timestamp: 'Yesterday at 04:30 PM',
        verdict: 'NEEDS_CHANGES'
      }
    ],
    createdAt: '2026-11-12T10:00:00Z',
    updatedAt: '2026-11-18T11:30:00Z'
  },
  {
    id: 'PB-103',
    projectId: 'proj-2', // EVAL-GW
    title: 'Build AI function calling gateway for SQL and search tools',
    description: 'Create gateway middleware allowing LLM models to safely query internal PostgreSQL read-replicas and return clean JSON to the chat interface.',
    status: 'DEPLOYED',
    priority: 'HIGH',
    phase: 'Phase 2: Serving Engine',
    sprint: 'Sprint 24.3',
    effortPoints: 5,
    assigneeIds: ['tm-4', 'tm-3'], // Co-assigned: Rahul Verma + Karthik R
    assigneeId: 'tm-4',
    startDate: '2026-11-14',
    dueDate: '2026-11-21',
    baselineDueDate: '2026-11-21',
    reworkCount: 0,
    slipReason: null,
    blocked: false,
    deployedUrl: 'https://preview-orchestrator.internal.ai/agents/stream',
    dependencies: ['PB-101'],
    subtasks: [
      { id: 'st-8', taskId: 'PB-103', title: 'Define strict JSON schema validators for SQL query parameters', completed: true, createdAt: '2026-11-14' },
      { id: 'st-9', taskId: 'PB-103', title: 'Add read-only query lock to block drop/update commands', completed: true, createdAt: '2026-11-15' },
      { id: 'st-10', taskId: 'PB-103', title: 'Simulate 5 multi-step tool calls in staging test harness', completed: true, createdAt: '2026-11-16' }
    ],
    reviewNotes: [
      {
        id: 'rn-2',
        taskId: 'PB-103',
        author: 'Vikram Rao (Tech Lead)',
        authorAvatar: 'VR',
        authorRole: 'LEAD',
        content: 'Tested live in preview environment. Read-only query filter successfully caught unsafe queries. Zero lag on responses.',
        timestamp: 'Yesterday at 05:40 PM',
        verdict: 'APPROVED'
      }
    ],
    createdAt: '2026-11-14T08:30:00Z',
    updatedAt: '2026-11-17T17:40:00Z'
  },
  {
    id: 'PB-104',
    projectId: 'proj-2', // EVAL-GW
    title: 'Test RAG answers on 20 sample HR policy questions',
    description: 'Run automated evaluation suite against 20 real HR handbook scenarios. Verify correct citation links and flag low-confidence hallucinated answers.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    phase: 'Phase 3: Security & Governance',
    sprint: 'Sprint 24.4',
    effortPoints: 5,
    assigneeIds: ['tm-3'], // Karthik R (QA / Test Engineer)
    assigneeId: 'tm-3',
    startDate: '2026-11-18',
    dueDate: '2026-11-26',
    baselineDueDate: '2026-11-26',
    reworkCount: 0,
    slipReason: null,
    blocked: false,
    dependencies: ['PB-103'],
    subtasks: [
      { id: 'st-11', taskId: 'PB-104', title: 'Curate dataset of 20 frequent leave and benefits questions', completed: true, createdAt: '2026-11-16' },
      { id: 'st-12', taskId: 'PB-104', title: 'Run retrieval accuracy check on vacation policy sections', completed: false, createdAt: '2026-11-17' },
      { id: 'st-13', taskId: 'PB-104', title: 'Log hallucination rate and response latency to spreadsheet', completed: false, createdAt: '2026-11-18' }
    ],
    reviewNotes: [],
    createdAt: '2026-11-16T11:00:00Z',
    updatedAt: '2026-11-18T10:00:00Z'
  },
  {
    id: 'PB-105',
    projectId: 'proj-3', // PULSE-V1
    title: 'Update chat UI button theme from blue to green',
    description: 'Revise primary action buttons and badge accents to use the new sage green palette across light and dark modes with proper contrast ratios.',
    status: 'DONE',
    priority: 'MEDIUM',
    phase: 'Phase 1: Architecture Core',
    sprint: 'Sprint 24.2',
    effortPoints: 5,
    assigneeIds: ['tm-1'], // Abhishai
    assigneeId: 'tm-1',
    startDate: '2026-11-01',
    dueDate: '2026-11-08',
    baselineDueDate: '2026-11-08',
    reworkCount: 0,
    slipReason: null,
    blocked: false,
    dependencies: [],
    subtasks: [
      { id: 'st-14', taskId: 'PB-105', title: 'Update primary button CSS variables in styles.css', completed: true, createdAt: '2026-11-02' },
      { id: 'st-15', taskId: 'PB-105', title: 'Verify AA color contrast ratio in dark sumi ink mode', completed: true, createdAt: '2026-11-05' }
    ],
    reviewNotes: [
      {
        id: 'rn-3',
        taskId: 'PB-105',
        author: 'Vikram Rao (Tech Lead)',
        authorAvatar: 'VR',
        authorRole: 'LEAD',
        content: 'Button contrast ratio measures 4.8:1 on both alabaster and dark sumi surfaces. Passes accessibility guidelines.',
        timestamp: 'Nov 08 at 04:10 PM',
        verdict: 'APPROVED'
      }
    ],
    createdAt: '2026-11-01T09:00:00Z',
    updatedAt: '2026-11-08T16:10:00Z'
  },
  {
    id: 'PB-106',
    projectId: 'proj-1', // RAG-CORE
    title: 'Add PDF upload and text chunking for RAG pipeline',
    description: 'Enable users to drag-and-drop PDF documentation in the app, split pages into clean 500-token chunks with 50-token overlap, and store metadata.',
    status: 'TODO',
    priority: 'HIGH',
    phase: 'Phase 2: Serving Engine',
    sprint: 'Sprint 24.3',
    effortPoints: 3,
    assigneeIds: ['tm-2'], // Priya Nair
    assigneeId: 'tm-2',
    startDate: '2026-11-18', // Overlaps with PB-102 dueDate (2026-11-20), triggering domino delay detection
    dueDate: '2026-11-25',
    baselineDueDate: '2026-11-25',
    reworkCount: 0,
    slipReason: null,
    blocked: false,
    dependencies: ['PB-102'],
    subtasks: [
      { id: 'st-16', taskId: 'PB-106', title: 'Split uploaded PDFs into 500-token chunks with overlap', completed: false, createdAt: '2026-11-18' },
      { id: 'st-17', taskId: 'PB-106', title: 'Save document name, page number, and chunk metadata to database', completed: false, createdAt: '2026-11-18' }
    ],
    reviewNotes: [],
    createdAt: '2026-11-18T09:00:00Z',
    updatedAt: '2026-11-18T09:00:00Z'
  },
  {
    id: 'PB-107',
    projectId: 'proj-2', // EVAL-GW
    title: 'Build prompt response feedback thumbs-up/down widget',
    description: 'Add an interactive thumbs-up and thumbs-down reaction widget below AI answers with an optional text field for users to report wrong facts.',
    status: 'TODO',
    priority: 'MEDIUM',
    phase: 'Phase 3: Security & Governance',
    sprint: 'Sprint 24.4',
    effortPoints: 5,
    assigneeIds: ['tm-4'], // Rahul Verma
    assigneeId: 'tm-4',
    startDate: '2026-11-24',
    dueDate: '2026-11-30',
    baselineDueDate: '2026-11-30',
    reworkCount: 0,
    slipReason: null,
    blocked: false,
    dependencies: ['PB-104'],
    subtasks: [
      { id: 'st-18', taskId: 'PB-107', title: 'Add thumbs-up and thumbs-down reaction icons below AI answer', completed: false, createdAt: '2026-11-18' },
      { id: 'st-19', taskId: 'PB-107', title: 'Log user rating and comment to evaluation database API', completed: false, createdAt: '2026-11-18' }
    ],
    reviewNotes: [],
    createdAt: '2026-11-18T10:00:00Z',
    updatedAt: '2026-11-18T10:00:00Z'
  },
  {
    id: 'PB-108',
    projectId: 'proj-3', // PULSE-V1
    title: 'Build interactive Gantt timeline with dependency arrows',
    description: 'Render sequential delivery timeline showing start-to-due dates, SVG curve arrows between prerequisite tasks, and critical path highlighting.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    phase: 'Phase 2: Delivery Engine',
    sprint: 'Sprint 24.3',
    effortPoints: 5,
    assigneeIds: ['tm-1', 'tm-2'], // Co-assigned: Abhishai + Priya Nair
    assigneeId: 'tm-1',
    startDate: '2026-11-09',
    dueDate: '2026-11-19',
    baselineDueDate: '2026-11-19',
    reworkCount: 0,
    slipReason: null,
    blocked: false,
    dependencies: ['PB-105'],
    subtasks: [
      { id: 'st-20', taskId: 'PB-108', title: 'Calculate critical delivery path using topological sorting', completed: true, createdAt: '2026-11-09' },
      { id: 'st-21', taskId: 'PB-108', title: 'Draw SVG curve connector arrows between dependent tasks', completed: true, createdAt: '2026-11-12' },
      { id: 'st-22', taskId: 'PB-108', title: 'Display dashed shadow bars for tasks with schedule drift', completed: true, createdAt: '2026-11-15' }
    ],
    reviewNotes: [],
    createdAt: '2026-11-09T09:00:00Z',
    updatedAt: '2026-11-18T16:00:00Z'
  },
  {
    id: 'PB-109',
    projectId: 'proj-3', // PULSE-V1
    title: 'Fix sidebar alignment and mobile spacing on My Day',
    description: 'Improve padding on task cards and refine the responsive layout on smaller screens so long deliverable titles never wrap awkwardly.',
    status: 'TODO',
    priority: 'MEDIUM',
    phase: 'Phase 3: Production Rollout',
    sprint: 'Sprint 24.4',
    effortPoints: 3,
    assigneeIds: ['tm-5'], // Vikram Rao
    assigneeId: 'tm-5',
    startDate: '2026-11-20',
    dueDate: '2026-11-28',
    baselineDueDate: '2026-11-28',
    reworkCount: 0,
    slipReason: null,
    blocked: false,
    dependencies: ['PB-108'],
    subtasks: [
      { id: 'st-23', taskId: 'PB-109', title: 'Adjust card padding and action button spacing on My Day screen', completed: false, createdAt: '2026-11-18' },
      { id: 'st-24', taskId: 'PB-109', title: 'Test smooth vertical scrolling across Chrome, Safari, and Firefox', completed: false, createdAt: '2026-11-18' }
    ],
    reviewNotes: [],
    createdAt: '2026-11-18T12:00:00Z',
    updatedAt: '2026-11-18T12:00:00Z'
  }
];

export const INITIAL_LOGS: ActivityLog[] = [
  {
    id: 'act-1',
    timestamp: 'Just now',
    actor: 'Priya Nair',
    actorAvatar: 'PN',
    actorId: 'tm-2',
    action: 'DEPLOYED_TO_SERVER',
    taskId: 'PB-101',
    taskTitle: 'Set up vector database index and embedding endpoint',
    details: 'Deployed Qdrant index service to staging and requested Tech Lead verification',
    statusTransition: { from: 'IN_PROGRESS', to: 'DEPLOYED' }
  },
  {
    id: 'act-2',
    timestamp: '15 mins ago',
    actor: 'Vikram Rao',
    actorAvatar: 'VR',
    actorId: 'tm-5',
    action: 'REVIEW_NOTE_ADDED',
    taskId: 'PB-101',
    taskTitle: 'Set up vector database index and embedding endpoint',
    details: 'Posted verification observation: Vector DB active on port 6333 (avg embedding latency 45ms)'
  },
  {
    id: 'act-3',
    timestamp: '2 hours ago',
    actor: 'Abhishai',
    actorAvatar: 'AB',
    actorId: 'tm-1',
    action: 'BLOCKER_TOGGLED',
    taskId: 'PB-102',
    taskTitle: 'Connect RAG retrieval API to internal SSO authentication',
    details: 'Marked as blocked: Waiting for corporate OAuth client ID and staging security certificate from IT'
  },
  {
    id: 'act-4',
    timestamp: 'Yesterday at 5:40 PM',
    actor: 'Vikram Rao',
    actorAvatar: 'VR',
    actorId: 'tm-5',
    action: 'REVIEW_NOTE_ADDED',
    taskId: 'PB-103',
    taskTitle: 'Build AI function calling gateway for SQL and search tools',
    details: 'Approved server preview on preview-orchestrator.internal.ai'
  },
  {
    id: 'act-5',
    timestamp: 'Yesterday at 6:15 PM',
    actor: 'Vikram Rao',
    actorAvatar: 'VR',
    actorId: 'tm-5',
    action: 'REWORK_PENALTY',
    taskId: 'PB-104',
    taskTitle: 'Test RAG answers on 20 sample HR policy questions',
    details: 'Flagged NEEDS_CHANGES: Incomplete coverage of vacation policy questions. Imposed +3 rework recovery penalty points.'
  },
  {
    id: 'act-6',
    timestamp: 'Today at 09:30 AM',
    actor: 'Abhishai',
    actorAvatar: 'AB',
    actorId: 'tm-1',
    action: 'SLIPPAGE_LOGGED',
    taskId: 'PB-102',
    taskTitle: 'Connect RAG retrieval API to internal SSO authentication',
    details: 'Schedule drifted +2 days. Reason: DEPENDENCY_BLOCKED (Waiting for corporate OAuth client ID).'
  },
  {
    id: 'act-7',
    timestamp: 'Today at 10:45 AM',
    actor: 'Vikram Rao',
    actorAvatar: 'VR',
    actorId: 'tm-5',
    action: 'MEMBER_ROLE_UPDATED',
    taskId: 'tm-3',
    taskTitle: 'Governance & RBAC Policy Update',
    details: 'Updated Karthik R (QA / Test Engineer) system role to QA with capacity budget 15 pts.'
  },
  {
    id: 'act-8',
    timestamp: 'Today at 11:20 AM',
    actor: 'Vikram Rao',
    actorAvatar: 'VR',
    actorId: 'tm-5',
    action: 'CASCADE_SHIFT_DATES',
    taskId: 'PB-106',
    taskTitle: 'Automated Dependency Cascade Shift',
    details: 'Shifted downstream deliverable start date to align with upstream PB-102 completion.'
  }
];

export const SAMPLE_IMPORT_JSON: SmartImportPayload = {
  tasks: [
    {
      title: 'Add streaming response display for chat interface',
      description: 'Render LLM tokens progressively as they arrive from the server using server-sent events (SSE) to eliminate wait time for users.',
      projectCode: 'RAG-CORE',
      assigneeName: 'Priya Nair',
      assigneeRole: 'AI Engineer',
      squad: 'Core AI Squad',
      priority: 'HIGH',
      phase: 'Phase 2: Serving Engine',
      sprint: 'Sprint 24.3',
      effortPoints: 5,
      dueDate: '2026-11-25',
      subtasks: [
        'Handle SSE event stream in Angular chat service',
        'Add auto-scroll to latest token while generating',
        'Handle network disconnect gracefully'
      ]
    },
    {
      title: 'Test prompt injection filters with 30 sample trick questions',
      description: 'Run automated QA test suite with 30 tricky user prompts to ensure the LLM guardrail blocks sensitive system prompt disclosure.',
      projectCode: 'EVAL-GW',
      assigneeName: 'Karthik R',
      assigneeRole: 'QA / Test Engineer',
      squad: 'Platform & QA Squad',
      priority: 'CRITICAL',
      phase: 'Phase 3: Security & Governance',
      sprint: 'Sprint 24.3',
      effortPoints: 3,
      dueDate: '2026-11-24',
      subtasks: [
        'Test roleplay bypass prompts like "Ignore previous instructions"',
        'Verify guardrail triggers safe canned response',
        'Export pass/fail test report to QA summary'
      ]
    },
    {
      title: 'Build export conversation history to Markdown feature',
      description: 'Allow users to download their active AI chat conversation as a clean formatted Markdown file with questions and code blocks.',
      projectCode: 'PULSE-V1',
      assigneeName: 'Abhishai',
      assigneeRole: 'Full-Stack Dev',
      squad: 'Core AI Squad',
      priority: 'MEDIUM',
      phase: 'Phase 1: Architecture Core',
      sprint: 'Sprint 24.4',
      effortPoints: 3,
      dueDate: '2026-11-28',
      subtasks: [
        'Format chat history with question headings and code blocks',
        'Add 1-click Download Markdown button in header'
      ]
    }
  ]
};
