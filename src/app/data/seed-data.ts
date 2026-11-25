import {
  Project,
  TeamMember,
  Task,
  ActivityLog,
  SmartImportPayload,
  RolePermissionPolicy,
  SystemRole
} from '../models/task.model';

export const DEFAULT_WORKSPACE_NAME = 'TCS-AI Initiatives';

function offsetIsoDate(daysFromToday: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().split('T')[0];
}

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
    name: 'Enterprise RAG Knowledge Assistant',
    code: 'RAG-CORE',
    description: 'Internal document retrieval, vector indexing, and enterprise Q&A pipeline.',
    teamName: 'Core AI Engineering',
    status: 'ACTIVE',
    color: '#2563eb',
    memberIds: ['tm-1', 'tm-2', 'tm-3', 'tm-5', 'tm-6']
  },
  {
    id: 'proj-2',
    name: 'LLM Guardrails & Evaluation Suite',
    code: 'EVAL-GW',
    description: 'Prompt safety validation, benchmark regression suite, and latency monitoring.',
    teamName: 'Platform & QA Engineering',
    status: 'STAGING',
    color: '#7c3aed',
    memberIds: ['tm-2', 'tm-3', 'tm-4', 'tm-5', 'tm-6']
  },
  {
    id: 'proj-3',
    name: 'TCS-AI Operations & Tooling',
    code: 'TCS-OPS',
    description: 'Internal delivery tracking, PostgreSQL audit reporting, and team automation.',
    teamName: 'Core AI Engineering',
    status: 'ACTIVE',
    color: '#059669',
    memberIds: ['tm-1', 'tm-2', 'tm-4', 'tm-5', 'tm-6']
  }
];

export const INITIAL_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'tm-1',
    name: 'Abhishai',
    role: 'Full-Stack Dev',
    systemRole: 'LEAD',
    squad: 'Core AI Engineering',
    avatar: 'AB',
    email: 'abhishai@tcs-ai.internal',
    color: '#2563eb',
    department: 'AI Engineering',
    capacityBudget: 15
  },
  {
    id: 'tm-2',
    name: 'Priya Nair',
    role: 'AI Engineer',
    systemRole: 'DEV',
    squad: 'Core AI Engineering',
    avatar: 'PN',
    email: 'priya.nair@tcs-ai.internal',
    color: '#7c3aed',
    department: 'Applied AI',
    capacityBudget: 15
  },
  {
    id: 'tm-3',
    name: 'Karthik R',
    role: 'QA / Test Engineer',
    systemRole: 'QA',
    squad: 'Platform & QA Engineering',
    avatar: 'KR',
    email: 'karthik.r@tcs-ai.internal',
    color: '#0891b2',
    department: 'Quality Engineering',
    capacityBudget: 15
  },
  {
    id: 'tm-4',
    name: 'Rahul Verma',
    role: 'Full-Stack Dev',
    systemRole: 'DEV',
    squad: 'Platform & QA Engineering',
    avatar: 'RV',
    email: 'rahul.verma@tcs-ai.internal',
    color: '#d97706',
    department: 'Backend & Data',
    capacityBudget: 15
  },
  {
    id: 'tm-5',
    name: 'Vikram Rao',
    role: 'Tech Lead',
    systemRole: 'LEAD',
    squad: 'Core AI Engineering',
    avatar: 'VR',
    email: 'vikram.rao@tcs-ai.internal',
    color: '#059669',
    department: 'Engineering Leadership',
    capacityBudget: 15
  },
  {
    id: 'tm-6',
    name: 'Sanjay Patel',
    role: 'Delivery Manager',
    systemRole: 'ADMIN',
    squad: 'Core AI Engineering',
    avatar: 'SP',
    email: 'sanjay.patel@tcs-ai.internal',
    color: '#475569',
    department: 'Delivery Management',
    capacityBudget: 15
  }
];

const t1Start = offsetIsoDate(-3);
const t1Due = offsetIsoDate(2); // Due within 3 days -> highlights "Due Soon" triage
const t2Start = offsetIsoDate(3); // Automatically 1 day after TCS-101 finishes
const t2Due = offsetIsoDate(8);

export const INITIAL_TASKS: Task[] = [
  {
    id: 'TCS-101',
    projectId: 'proj-1',
    title: 'Configure Qdrant vector index and document embedding pipeline',
    description: 'Provision internal vector collection for enterprise PDF/wiki ingestion, configure embedding service rate limits, and verify p95 query latency under 100ms.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    phase: 'Phase 1: Retrieval Core',
    sprint: 'Sprint 25.1',
    effortPoints: 5,
    storyPoints: 5,
    progress: 60,
    assigneeIds: ['tm-1', 'tm-2'],
    assigneeId: 'tm-1',
    startDate: t1Start,
    dueDate: t1Due,
    baselineDueDate: t1Due,
    reworkCount: 0,
    slipReason: null,
    slipJustification: '',
    blocked: false,
    blockerReason: '',
    deployedUrl: 'https://rag-staging.tcs-ai.internal/v1/health',
    dependencies: [],
    subtasks: [
      { id: 'st-101-1', taskId: 'TCS-101', title: 'Create Qdrant collection with cosine similarity schema', completed: true, createdAt: t1Start },
      { id: 'st-101-2', taskId: 'TCS-101', title: 'Configure internal embedding endpoint and retry backoff', completed: true, createdAt: t1Start },
      { id: 'st-101-3', taskId: 'TCS-101', title: 'Ingest baseline batch of 50 engineering SOP documents', completed: true, createdAt: t1Start },
      { id: 'st-101-4', taskId: 'TCS-101', title: 'Benchmark top-5 retrieval accuracy and p95 latency', completed: false, createdAt: t1Start },
      { id: 'st-101-5', taskId: 'TCS-101', title: 'Document collection backup and index refresh runbook', completed: false, createdAt: t1Start }
    ],
    reviewNotes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'TCS-102',
    projectId: 'proj-1',
    title: 'Integrate corporate SSO role-based access filter on RAG API',
    description: 'Enforce department-level document visibility claims from corporate SSO tokens before returning vector search passages.',
    status: 'TODO',
    priority: 'CRITICAL',
    phase: 'Phase 2: Security & Access',
    sprint: 'Sprint 25.1',
    effortPoints: 3,
    storyPoints: 3,
    progress: 0,
    assigneeIds: ['tm-1'],
    assigneeId: 'tm-1',
    startDate: t2Start,
    dueDate: t2Due,
    baselineDueDate: t2Due,
    reworkCount: 0,
    slipReason: null,
    slipJustification: '',
    blocked: false,
    blockerReason: '',
    deployedUrl: '',
    dependencies: ['TCS-101'],
    subtasks: [
      { id: 'st-102-1', taskId: 'TCS-102', title: 'Extract department and role claims from SSO JWT middleware', completed: false, createdAt: t1Start },
      { id: 'st-102-2', taskId: 'TCS-102', title: 'Apply metadata filter predicates on Qdrant search queries', completed: false, createdAt: t1Start },
      { id: 'st-102-3', taskId: 'TCS-102', title: 'Verify unauthorized document exclusion with QA test cases', completed: false, createdAt: t1Start }
    ],
    reviewNotes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const INITIAL_LOGS: ActivityLog[] = [
  {
    id: 'act-init-1',
    timestamp: 'Today at 09:30 AM',
    actor: 'Abhishai',
    actorAvatar: 'AB',
    actorId: 'tm-1',
    action: 'TASK_CREATED',
    taskId: 'TCS-101',
    taskTitle: 'Configure Qdrant vector index and document embedding pipeline',
    details: 'Initialized starter deliverable TCS-101 in RAG-CORE (60% checklist progress).'
  },
  {
    id: 'act-init-2',
    timestamp: 'Today at 09:35 AM',
    actor: 'Vikram Rao',
    actorAvatar: 'VR',
    actorId: 'tm-5',
    action: 'DEPENDENCY_UPDATED',
    taskId: 'TCS-102',
    taskTitle: 'Integrate corporate SSO role-based access filter on RAG API',
    details: `Linked prerequisite TCS-101 -> TCS-102. Start date scheduled for ${t2Start} (1 day after TCS-101 completion).`
  }
];

export const SAMPLE_IMPORT_JSON: SmartImportPayload = {
  tasks: [
    {
      title: 'Add streaming token response handler for internal chat UI',
      description: 'Render LLM tokens progressively via Server-Sent Events (SSE) with clean disconnect recovery.',
      projectCode: 'RAG-CORE',
      assigneeName: 'Priya Nair',
      assigneeRole: 'AI Engineer',
      squad: 'Core AI Engineering',
      priority: 'HIGH',
      phase: 'Phase 2: Serving Engine',
      sprint: 'Sprint 25.1',
      effortPoints: 5,
      startDate: offsetIsoDate(0),
      dueDate: offsetIsoDate(4),
      subtasks: [
        'Implement SSE stream reader in Angular service',
        'Add stop-generation cancel button',
        'Verify reconnect handling on network drop'
      ]
    },
    {
      title: 'Execute prompt-injection regression benchmark (30 test cases)',
      description: 'Validate guardrail blocking accuracy across 30 adversarial prompt-injection test cases.',
      projectCode: 'EVAL-GW',
      assigneeName: 'Karthik R',
      assigneeRole: 'QA / Test Engineer',
      squad: 'Platform & QA Engineering',
      priority: 'CRITICAL',
      phase: 'Phase 2: Security Validation',
      sprint: 'Sprint 25.1',
      effortPoints: 3,
      startDate: offsetIsoDate(0),
      dueDate: offsetIsoDate(2),
      subtasks: [
        'Run system-prompt extraction test cases',
        'Record false-positive rate and export CSV summary'
      ]
    }
  ]
};
