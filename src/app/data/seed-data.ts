import {
  Project,
  TeamMember,
  Task,
  ActivityLog,
  SmartImportPayload
} from '../models/task.model';

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'Enterprise RAG Copilot',
    code: 'RAG-CORE',
    description: 'High-throughput hybrid retrieval (dense + sparse Milvus) with streaming function calling orchestrator.',
    teamName: 'Core AI Squad',
    status: 'ACTIVE',
    color: '#3b82f6'
  },
  {
    id: 'proj-2',
    name: 'LLM Guardrails & Eval Gateway',
    code: 'EVAL-GW',
    description: 'Real-time toxicity, PII masking, latency telemetry & automated adversarial red-team benchmarks.',
    teamName: 'Platform & QA Squad',
    status: 'STAGING',
    color: '#8b5cf6'
  },
  {
    id: 'proj-3',
    name: 'PulseBoard Internal Tooling',
    code: 'PULSE-V1',
    description: 'Lightweight, zero-license-wall engineering task & deployment verification board.',
    teamName: 'Core AI Squad',
    status: 'ACTIVE',
    color: '#10b981'
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
    title: 'Deploy TensorRT-LLM Inference Server to Production Staging',
    description: 'Spin up Triton + TensorRT-LLM on H100 GPU cluster. Optimize KV cache memory allocation and verify p99 latency < 28ms under 500 concurrent token streams.',
    status: 'DEPLOYED',
    priority: 'CRITICAL',
    phase: 'Phase 2: Serving Engine',
    sprint: 'Sprint 24.3',
    effortPoints: 8,
    assigneeId: 'tm-2', // Priya Nair (AI Engineer)
    startDate: '2026-11-10',
    dueDate: '2026-11-19',
    baselineDueDate: '2026-11-19',
    reworkCount: 0,
    slipReason: null,
    blocked: false,
    deployedUrl: 'https://staging-infer.internal.ai/v1/health',
    dependencies: [],
    subtasks: [
      { id: 'st-1', taskId: 'PB-101', title: 'Compile engine with FP8 quantization weights', completed: true, createdAt: '2026-11-10' },
      { id: 'st-2', taskId: 'PB-101', title: 'Configure Triton dynamic batching scheduler', completed: true, createdAt: '2026-11-11' },
      { id: 'st-3', taskId: 'PB-101', title: 'Mount shared NVMe for continuous checkpoint load', completed: true, createdAt: '2026-11-12' },
      { id: 'st-4', taskId: 'PB-101', title: 'Execute warm-up smoke tests', completed: true, createdAt: '2026-11-13' }
    ],
    reviewNotes: [
      {
        id: 'rn-1',
        taskId: 'PB-101',
        author: 'Vikram Rao (Tech Lead)',
        authorAvatar: 'VR',
        authorRole: 'LEAD',
        content: 'Container up on port 8000. Verified FP8 execution. Latency p99 at 24.2ms. Ready for QA load testing.',
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
    title: 'Hybrid Vector Search + BM25 Reranking Pipeline',
    description: 'Implement reciprocal rank fusion (RRF) combining Milvus dense embeddings with sparse lexical search. Target Recall@10 > 92% on technical customer corpus.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    phase: 'Phase 1: Knowledge Core',
    sprint: 'Sprint 24.3',
    effortPoints: 5,
    assigneeId: 'tm-1', // Abhishai (Full-Stack & AI Dev)
    startDate: '2026-11-12',
    dueDate: '2026-11-20',
    baselineDueDate: '2026-11-17',
    reworkCount: 1,
    slipReason: 'DEPENDENCY_BLOCKED',
    slipJustification: 'Waiting on Milvus 2.4 GPU-accelerated index rebuild license unlock from infra IT',
    blocked: true,
    blockerReason: 'Waiting on Milvus 2.4 GPU-accelerated index rebuild license unlock from infra IT',
    dependencies: ['PB-101'],
    subtasks: [
      { id: 'st-5', taskId: 'PB-102', title: 'Benchmark Cohere v3 vs cross-encoder miniLM', completed: true, createdAt: '2026-11-12' },
      { id: 'st-6', taskId: 'PB-102', title: 'Tune alpha parameter in RRF combiner', completed: true, createdAt: '2026-11-14' },
      { id: 'st-7', taskId: 'PB-102', title: 'Implement async batching for chunk tokenization', completed: false, createdAt: '2026-11-15' }
    ],
    reviewNotes: [
      {
        id: 'rn-102',
        taskId: 'PB-102',
        author: 'Vikram Rao (Tech Lead)',
        authorAvatar: 'VR',
        authorRole: 'LEAD',
        content: 'Milvus index rebuild failed on CPU fallback node. Rework required to test fallback indexer.',
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
    title: 'Streaming Function Calling Protocol for Multi-Agent Orchestrator',
    description: 'Enable real-time partial arguments stream parsing for structured tool output. Prevents UI stutter while autonomous subagents invoke SQL & web search tools.',
    status: 'DEPLOYED',
    priority: 'HIGH',
    phase: 'Phase 2: Serving Engine',
    sprint: 'Sprint 24.3',
    effortPoints: 5,
    assigneeId: 'tm-4', // Rahul Verma (Backend Dev)
    startDate: '2026-11-14',
    dueDate: '2026-11-21',
    baselineDueDate: '2026-11-21',
    reworkCount: 0,
    slipReason: null,
    blocked: false,
    deployedUrl: 'https://preview-orchestrator.internal.ai/agents/stream',
    dependencies: ['PB-101'],
    subtasks: [
      { id: 'st-8', taskId: 'PB-103', title: 'Draft JSON streaming grammar parser (partial JSON)', completed: true, createdAt: '2026-11-14' },
      { id: 'st-9', taskId: 'PB-103', title: 'Integrate fallback handler for malformed tool args', completed: true, createdAt: '2026-11-15' },
      { id: 'st-10', taskId: 'PB-103', title: 'Verify multi-turn tool calling sequence loop', completed: true, createdAt: '2026-11-16' }
    ],
    reviewNotes: [
      {
        id: 'rn-2',
        taskId: 'PB-103',
        author: 'Vikram Rao (Tech Lead)',
        authorAvatar: 'VR',
        authorRole: 'LEAD',
        content: 'Tested live in demo environment. Handshake is super clean and zero lag under multi-agent roundtrips.',
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
    title: 'Automated Red-Teaming & Adversarial Jailbreak Test Suite',
    description: 'Construct automated Playwright + Python evaluation suite with 300+ prompt injection tests. Output compliance scorecard into Grafana dashboard.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    phase: 'Phase 3: Security & Governance',
    sprint: 'Sprint 24.4',
    effortPoints: 5,
    assigneeId: 'tm-3', // Karthik R (QA / Test Engineer)
    startDate: '2026-11-18',
    dueDate: '2026-11-26',
    baselineDueDate: '2026-11-26',
    reworkCount: 0,
    slipReason: null,
    blocked: false,
    dependencies: ['PB-103'],
    subtasks: [
      { id: 'st-11', taskId: 'PB-104', title: 'Curate HarmEval & OWASP Top 10 for LLM datasets', completed: true, createdAt: '2026-11-16' },
      { id: 'st-12', taskId: 'PB-104', title: 'Automate synthetic jailbreak injection runner', completed: false, createdAt: '2026-11-17' },
      { id: 'st-13', taskId: 'PB-104', title: 'Configure CI regression reporting pipeline', completed: false, createdAt: '2026-11-18' }
    ],
    reviewNotes: [],
    createdAt: '2026-11-16T11:00:00Z',
    updatedAt: '2026-11-18T10:00:00Z'
  },
  {
    id: 'PB-105',
    projectId: 'proj-3', // PULSE-V1
    title: 'PulseBoard V1 Standalone State Engine & Multi-Project Support',
    description: 'Upgrade Signal-based task repository with dynamic project filtering, squad workload metrics, and role-based badges.',
    status: 'DONE',
    priority: 'MEDIUM',
    phase: 'Phase 1: Architecture Core',
    sprint: 'Sprint 24.2',
    effortPoints: 5,
    assigneeId: 'tm-1', // Abhishai
    startDate: '2026-11-01',
    dueDate: '2026-11-08',
    baselineDueDate: '2026-11-08',
    reworkCount: 0,
    slipReason: null,
    blocked: false,
    dependencies: [],
    subtasks: [
      { id: 'st-14', taskId: 'PB-105', title: 'Validate zero-warning production budget configuration', completed: true, createdAt: '2026-11-02' },
      { id: 'st-15', taskId: 'PB-105', title: 'Implement local persistence with Reset Workspace button', completed: true, createdAt: '2026-11-05' }
    ],
    reviewNotes: [
      {
        id: 'rn-3',
        taskId: 'PB-105',
        author: 'Vikram Rao (Tech Lead)',
        authorAvatar: 'VR',
        authorRole: 'LEAD',
        content: 'Clean modular 6-file Angular architecture verified. Production build passes with zero budget errors.',
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
    title: 'Context Window Chunking & Metadata Enrichment',
    description: 'Integrate dynamic sliding-window semantic chunking with document taxonomy tags to maximize context utilization.',
    status: 'TODO',
    priority: 'HIGH',
    phase: 'Phase 2: Serving Engine',
    sprint: 'Sprint 24.3',
    effortPoints: 3,
    assigneeId: 'tm-2', // Priya Nair
    startDate: '2026-11-18', // Overlaps with PB-102 dueDate (2026-11-20), triggering domino delay detection
    dueDate: '2026-11-25',
    baselineDueDate: '2026-11-25',
    reworkCount: 0,
    slipReason: null,
    blocked: false,
    dependencies: ['PB-102'],
    subtasks: [
      { id: 'st-16', taskId: 'PB-106', title: 'Implement sliding window token overlap analyzer', completed: false, createdAt: '2026-11-18' },
      { id: 'st-17', taskId: 'PB-106', title: 'Enrich vector payloads with metadata filters', completed: false, createdAt: '2026-11-18' }
    ],
    reviewNotes: [],
    createdAt: '2026-11-18T09:00:00Z',
    updatedAt: '2026-11-18T09:00:00Z'
  },
  {
    id: 'PB-107',
    projectId: 'proj-2', // EVAL-GW
    title: 'Toxicity & PII Telemetry Dashboards in Grafana',
    description: 'Real-time telemetry streaming of eval metrics into Prometheus and Grafana for automated red-team compliance scorecards.',
    status: 'TODO',
    priority: 'MEDIUM',
    phase: 'Phase 3: Security & Governance',
    sprint: 'Sprint 24.4',
    effortPoints: 5,
    assigneeId: 'tm-4', // Rahul Verma
    startDate: '2026-11-24',
    dueDate: '2026-11-30',
    baselineDueDate: '2026-11-30',
    reworkCount: 0,
    slipReason: null,
    blocked: false,
    dependencies: ['PB-104'],
    subtasks: [
      { id: 'st-18', taskId: 'PB-107', title: 'Define Prometheus custom latency metrics', completed: false, createdAt: '2026-11-18' },
      { id: 'st-19', taskId: 'PB-107', title: 'Build live Grafana dashboard JSON model', completed: false, createdAt: '2026-11-18' }
    ],
    reviewNotes: [],
    createdAt: '2026-11-18T10:00:00Z',
    updatedAt: '2026-11-18T10:00:00Z'
  },
  {
    id: 'PB-108',
    projectId: 'proj-3', // PULSE-V1
    title: 'Interactive Dependency Gantt & Critical Path Engine',
    description: 'Mathematical CPM critical path calculation with SVG arrow connectors, dual-track baseline drift, and cascade auto-shift.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    phase: 'Phase 2: Delivery Engine',
    sprint: 'Sprint 24.3',
    effortPoints: 5,
    assigneeId: 'tm-1', // Abhishai
    startDate: '2026-11-09',
    dueDate: '2026-11-19',
    baselineDueDate: '2026-11-19',
    reworkCount: 0,
    slipReason: null,
    blocked: false,
    dependencies: ['PB-105'],
    subtasks: [
      { id: 'st-20', taskId: 'PB-108', title: 'Implement topological sort for cycle detection', completed: true, createdAt: '2026-11-09' },
      { id: 'st-21', taskId: 'PB-108', title: 'Render SVG bezier curve connector paths', completed: true, createdAt: '2026-11-12' },
      { id: 'st-22', taskId: 'PB-108', title: 'Add dual-track baseline shadow bars', completed: true, createdAt: '2026-11-15' }
    ],
    reviewNotes: [],
    createdAt: '2026-11-09T09:00:00Z',
    updatedAt: '2026-11-18T16:00:00Z'
  },
  {
    id: 'PB-109',
    projectId: 'proj-3', // PULSE-V1
    title: 'Automated CI/CD Delivery Pipeline & Staging Verification',
    description: 'Zero-warning GitHub Actions pipeline enforcing budget checks, linting, and automated staging server preview deployments.',
    status: 'TODO',
    priority: 'MEDIUM',
    phase: 'Phase 3: Production Rollout',
    sprint: 'Sprint 24.4',
    effortPoints: 3,
    assigneeId: 'tm-5', // Vikram Rao
    startDate: '2026-11-20',
    dueDate: '2026-11-28',
    baselineDueDate: '2026-11-28',
    reworkCount: 0,
    slipReason: null,
    blocked: false,
    dependencies: ['PB-108'],
    subtasks: [
      { id: 'st-23', taskId: 'PB-109', title: 'Configure GitHub Pages automated action runner', completed: false, createdAt: '2026-11-18' },
      { id: 'st-24', taskId: 'PB-109', title: 'Add production bundle size regression check', completed: false, createdAt: '2026-11-18' }
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
    action: 'DEPLOYED_TO_SERVER',
    taskId: 'PB-101',
    taskTitle: 'Deploy TensorRT-LLM Inference Server to Production Staging',
    details: 'Pushed container v2.4.1 to staging-infer.internal.ai and requested Tech Lead verification',
    statusTransition: { from: 'IN_PROGRESS', to: 'DEPLOYED' }
  },
  {
    id: 'act-2',
    timestamp: '15 mins ago',
    actor: 'Vikram Rao',
    actorAvatar: 'VR',
    action: 'REVIEW_NOTE_ADDED',
    taskId: 'PB-101',
    taskTitle: 'Deploy TensorRT-LLM Inference Server to Production Staging',
    details: 'Posted verification observation: Container responding on port 8000 (p99 latency 24.2ms)'
  },
  {
    id: 'act-3',
    timestamp: '2 hours ago',
    actor: 'Abhishai',
    actorAvatar: 'AB',
    action: 'BLOCKER_TOGGLED',
    taskId: 'PB-102',
    taskTitle: 'Hybrid Vector Search + BM25 Reranking Pipeline',
    details: 'Marked as blocked: Waiting on Milvus 2.4 GPU-accelerated index rebuild license unlock'
  },
  {
    id: 'act-4',
    timestamp: 'Yesterday at 5:40 PM',
    actor: 'Vikram Rao',
    actorAvatar: 'VR',
    action: 'REVIEW_NOTE_ADDED',
    taskId: 'PB-103',
    taskTitle: 'Streaming Function Calling Protocol for Multi-Agent Orchestrator',
    details: 'Approved server preview on preview-orchestrator.internal.ai'
  }
];

export const SAMPLE_IMPORT_JSON: SmartImportPayload = {
  tasks: [
    {
      title: 'Integrate vLLM PagedAttention for Multi-LoRA Serving',
      description: 'Enable dynamic swapping of customer-specific adapter LoRA checkpoints without restarting the inference container pod.',
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
        'Benchmark GPU VRAM overhead with 10 concurrent LoRAs',
        'Add automatic TTL eviction for stale adapter weights',
        'Verify continuous batching throughput'
      ]
    },
    {
      title: 'Automated E2E Load Test on Inference Streaming SSE',
      description: 'Set up k6 load testing suite simulating 200 concurrent user streams checking for broken SSE frames and token dropouts.',
      projectCode: 'EVAL-GW',
      assigneeName: 'Karthik R',
      assigneeRole: 'QA / Test Engineer',
      squad: 'Platform & QA Squad',
      priority: 'CRITICAL',
      phase: 'Phase 3: Security & Governance',
      sprint: 'Sprint 24.3',
      effortPoints: 4,
      dueDate: '2026-11-24',
      subtasks: [
        'Write k6 streaming response validator script',
        'Simulate network jitter and client disconnection',
        'Publish Grafana latency heatmap'
      ]
    },
    {
      title: 'Evaluate Chunk Size Strategies on RAG Retrieval',
      description: 'Run automated GridSearch over 256, 512, and 1024 token chunk sizes with semantic overlap for customer knowledge docs.',
      projectCode: 'RAG-CORE',
      assigneeName: 'Abhishai',
      assigneeRole: 'Full-Stack Dev',
      squad: 'Core AI Squad',
      priority: 'MEDIUM',
      phase: 'Phase 1: Knowledge Core',
      sprint: 'Sprint 24.4',
      effortPoints: 3,
      dueDate: '2026-11-28',
      subtasks: [
        'Generate synthetic Q&A test set using Gemini Flash',
        'Compute ROUGE and MRR metrics per chunk configuration'
      ]
    }
  ]
};
