import {
  TeamMember,
  Task,
  ActivityLog,
  SmartImportPayload
} from '../models/task.model';

export const INITIAL_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'tm-1',
    name: 'Aria Chen',
    role: 'Principal AI Engineer',
    avatar: 'AC',
    email: 'aria.chen@ai-core.internal',
    color: '#3b82f6',
    department: 'Model Architecture'
  },
  {
    id: 'tm-2',
    name: 'Marcus Vance',
    role: 'Staff MLOps Architect',
    avatar: 'MV',
    email: 'marcus.v@ai-core.internal',
    color: '#8b5cf6',
    department: 'Serving & Infrastructure'
  },
  {
    id: 'tm-3',
    name: 'Elena Rostova',
    role: 'Senior Agent Systems Dev',
    avatar: 'ER',
    email: 'elena.r@ai-core.internal',
    color: '#06b6d4',
    department: 'Autonomous Execution'
  },
  {
    id: 'tm-4',
    name: 'Kiran Patel',
    role: 'Data & Benchmark Specialist',
    avatar: 'KP',
    email: 'kiran.p@ai-core.internal',
    color: '#10b981',
    department: 'Eval & Governance'
  },
  {
    id: 'tm-5',
    name: 'Devon Ward',
    role: 'Delivery Lead / DM',
    avatar: 'DW',
    email: 'devon.w@ai-core.internal',
    color: '#f59e0b',
    department: 'Technical Management'
  }
];

export const INITIAL_TASKS: Task[] = [
  {
    id: 'PB-101',
    title: 'Deploy TensorRT-LLM Inference Server to Production Staging',
    description: 'Spin up Triton + TensorRT-LLM on H100 GPU cluster. Optimize KV cache memory allocation and verify p99 latency < 28ms under 500 concurrent token streams.',
    status: 'DEPLOYED',
    priority: 'CRITICAL',
    phase: 'Phase 2: Serving Engine',
    sprint: 'Sprint 24.3',
    effortPoints: 8,
    assigneeId: 'tm-2', // Marcus Vance
    startDate: '2026-11-10',
    dueDate: '2026-11-19',
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
        author: 'Devon Ward (Lead)',
        authorAvatar: 'DW',
        authorRole: 'LEAD',
        content: 'Container up and responding on port 8000. Double check streaming SSE throughput before final signoff.',
        timestamp: 'Today at 02:15 PM',
        verdict: 'OBSERVATION'
      }
    ],
    createdAt: '2026-11-10T09:00:00Z',
    updatedAt: '2026-11-18T14:15:00Z'
  },
  {
    id: 'PB-102',
    title: 'Hybrid Vector Search + BM25 Reranking Pipeline',
    description: 'Implement reciprocal rank fusion (RRF) combining Milvus dense embeddings with sparse lexical search. Target Recall@10 > 92% on technical customer corpus.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    phase: 'Phase 1: Knowledge Core',
    sprint: 'Sprint 24.3',
    effortPoints: 5,
    assigneeId: 'tm-1', // Aria Chen
    startDate: '2026-11-12',
    dueDate: '2026-11-20',
    blocked: true,
    blockerReason: 'Waiting on Milvus 2.4 GPU-accelerated index rebuild license unlock from infra IT',
    dependencies: ['PB-101'],
    subtasks: [
      { id: 'st-5', taskId: 'PB-102', title: 'Benchmark Cohere v3 vs cross-encoder miniLM', completed: true, createdAt: '2026-11-12' },
      { id: 'st-6', taskId: 'PB-102', title: 'Tune alpha parameter in RRF combiner', completed: true, createdAt: '2026-11-14' },
      { id: 'st-7', taskId: 'PB-102', title: 'Implement async batching for chunk tokenization', completed: false, createdAt: '2026-11-15' }
    ],
    reviewNotes: [],
    createdAt: '2026-11-12T10:00:00Z',
    updatedAt: '2026-11-18T11:30:00Z'
  },
  {
    id: 'PB-103',
    title: 'Streaming Function Calling Protocol for Multi-Agent Orchestrator',
    description: 'Enable real-time partial arguments stream parsing for structured tool output. Prevents UI stutter while autonomous subagents invoke SQL & web search tools.',
    status: 'DEPLOYED',
    priority: 'HIGH',
    phase: 'Phase 2: Serving Engine',
    sprint: 'Sprint 24.3',
    effortPoints: 5,
    assigneeId: 'tm-3', // Elena Rostova
    startDate: '2026-11-14',
    dueDate: '2026-11-21',
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
        author: 'Devon Ward (Lead)',
        authorAvatar: 'DW',
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
    title: 'Automated Red-Teaming & Jailbreak Evaluation Benchmark',
    description: 'Construct automated evaluation suite with 300+ adversarial prompt injection tests. Output compliance scorecard into Grafana dashboard.',
    status: 'TODO',
    priority: 'MEDIUM',
    phase: 'Phase 3: Security & Governance',
    sprint: 'Sprint 24.4',
    effortPoints: 3,
    assigneeId: 'tm-4', // Kiran Patel
    startDate: '2026-11-20',
    dueDate: '2026-11-27',
    blocked: false,
    dependencies: ['PB-103'],
    subtasks: [
      { id: 'st-11', taskId: 'PB-104', title: 'Curate HarmEval & OWASP Top 10 for LLM datasets', completed: false, createdAt: '2026-11-16' },
      { id: 'st-12', taskId: 'PB-104', title: 'Wire semantic similarity judge using Gemini Flash', completed: false, createdAt: '2026-11-17' },
      { id: 'st-13', taskId: 'PB-104', title: 'Generate weekly automated regression markdown reports', completed: false, createdAt: '2026-11-18' }
    ],
    reviewNotes: [],
    createdAt: '2026-11-16T11:00:00Z',
    updatedAt: '2026-11-16T11:00:00Z'
  },
  {
    id: 'PB-105',
    title: 'Model Quantization Pipeline (AWQ 4-Bit Weight Only)',
    description: 'Automate AWQ quantization for fine-tuned Llama-3-70B checkpoints to reduce VRAM footprint from 140GB down to 38GB per pod.',
    status: 'DONE',
    priority: 'MEDIUM',
    phase: 'Phase 1: Knowledge Core',
    sprint: 'Sprint 24.2',
    effortPoints: 5,
    assigneeId: 'tm-2', // Marcus Vance
    startDate: '2026-11-01',
    dueDate: '2026-11-08',
    blocked: false,
    dependencies: [],
    subtasks: [
      { id: 'st-14', taskId: 'PB-105', title: 'Validate perplexity degradation < 0.15 on Wikitext', completed: true, createdAt: '2026-11-02' },
      { id: 'st-15', taskId: 'PB-105', title: 'Export Hugging Face compatible safetensors artifacts', completed: true, createdAt: '2026-11-05' }
    ],
    reviewNotes: [
      {
        id: 'rn-3',
        taskId: 'PB-105',
        author: 'Aria Chen',
        authorAvatar: 'AC',
        authorRole: 'REVIEWER',
        content: 'Perplexity benchmarks verified. Memory savings approved for production cluster roll out.',
        timestamp: 'Nov 08 at 04:10 PM',
        verdict: 'APPROVED'
      }
    ],
    createdAt: '2026-11-01T09:00:00Z',
    updatedAt: '2026-11-08T16:10:00Z'
  }
];

export const INITIAL_LOGS: ActivityLog[] = [
  {
    id: 'act-1',
    timestamp: 'Just now',
    actor: 'Marcus Vance',
    actorAvatar: 'MV',
    action: 'DEPLOYED_TO_SERVER',
    taskId: 'PB-101',
    taskTitle: 'Deploy TensorRT-LLM Inference Server to Production Staging',
    details: 'Pushed container v2.4.1 to staging-infer.internal.ai and requested verification',
    statusTransition: { from: 'IN_PROGRESS', to: 'DEPLOYED' }
  },
  {
    id: 'act-2',
    timestamp: '15 mins ago',
    actor: 'Devon Ward',
    actorAvatar: 'DW',
    action: 'REVIEW_NOTE_ADDED',
    taskId: 'PB-101',
    taskTitle: 'Deploy TensorRT-LLM Inference Server to Production Staging',
    details: 'Posted verification observation regarding streaming SSE throughput'
  },
  {
    id: 'act-3',
    timestamp: '2 hours ago',
    actor: 'Aria Chen',
    actorAvatar: 'AC',
    action: 'BLOCKER_TOGGLED',
    taskId: 'PB-102',
    taskTitle: 'Hybrid Vector Search + BM25 Reranking Pipeline',
    details: 'Marked as blocked: Waiting on Milvus 2.4 GPU-accelerated index rebuild license unlock'
  },
  {
    id: 'act-4',
    timestamp: 'Yesterday at 5:40 PM',
    actor: 'Devon Ward',
    actorAvatar: 'DW',
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
      assigneeName: 'Marcus Vance',
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
      title: 'Implement LLM Guardrails Filter for PII & Toxicity',
      description: 'Set up real-time bidirectional safety filters scanning user prompts and generated model responses for confidential tokens.',
      assigneeName: 'Elena Rostova',
      priority: 'CRITICAL',
      phase: 'Phase 3: Security & Governance',
      sprint: 'Sprint 24.3',
      effortPoints: 4,
      dueDate: '2026-11-23',
      subtasks: [
        'Wire regex token masking for API keys & SSN format',
        'Deploy Llama-Guard-3 microservice container',
        'Configure zero-latency fallback response buffer'
      ]
    },
    {
      title: 'Evaluate Chunk Size Strategies on RAG Retrieval',
      description: 'Run automated GridSearch over 256, 512, and 1024 token chunk sizes with semantic overlap for customer knowledge docs.',
      assigneeName: 'Kiran Patel',
      priority: 'MEDIUM',
      phase: 'Phase 1: Knowledge Core',
      sprint: 'Sprint 24.4',
      effortPoints: 3,
      dueDate: '2026-11-28',
      subtasks: [
        'Generate synthetic Q&A test set using Gemini Pro',
        'Compute ROUGE and MRR metrics per chunk configuration'
      ]
    }
  ]
};
