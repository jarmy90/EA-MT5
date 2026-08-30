export type AgentStatus = 'IDLE' | 'QUEUED' | 'THINKING' | 'READING' | 'USING_TOOL' | 'WAITING_DEPENDENCY' | 'REVIEWING' | 'BLOCKED' | 'FAILED' | 'COMPLETED'
export type AgentTeam = 'Research & Data' | 'Strategy Lab' | 'Risk & Critic' | 'Build & Execution'
export type EventType = 'DECISION' | 'TOOL' | 'REVIEW' | 'ERROR' | 'ARTIFACT' | 'SYSTEM'

export interface AgentTask { id: string; title: string; progress: number; elapsed: string; tool: string; dependency?: string }
export interface Agent { id: string; name: string; team: AgentTeam; role: string; status: AgentStatus; task: AgentTask; lastOutput: string; color: string }
export interface AgentEvent { id: string; runId: string; timestamp: string; agentId: string; team: AgentTeam; status: AgentStatus; eventType: EventType; task: string; summary: string; progress: number; tool?: string; inputArtifacts: string[]; outputArtifacts: string[]; dependency?: string; requiresHuman: boolean; severity: 'info' | 'warning' | 'critical'; durationMs: number; metadata?: Record<string, string> }
export interface Run { id: string; name: string; scenario: DemoScenario; startedAt: string; status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'BLOCKED' | 'FAILED' }
export interface Artifact { id: string; name: string; type: string; owner: string; status: string; updatedAt: string }
export interface SystemConnection { name: string; status: 'CONNECTED' | 'OFFLINE' | 'SIMULATION'; detail: string; updatedAt: string }
export interface TradingMetric { label: string; value: string; source: string; updatedAt: string; unavailable?: boolean }
export interface Decision { outcome: 'EXECUTE' | 'REJECT' | 'HOLD' | 'NEEDS_REVIEW'; confidence: number; rationale: string[]; evidence: string[] }
export interface Alert { id: string; severity: 'info' | 'warning' | 'critical'; message: string; timestamp: string }
export interface JobQueueItem { id: string; title: string; owner: string; status: 'QUEUED' | 'RUNNING' | 'BLOCKED' | 'DONE'; priority: string }
export type DemoScenario = 'Normal Run' | 'Risk Blocked' | 'Build Failed' | 'Human Approval'
export interface DemoState { run: Run; agents: Agent[]; events: AgentEvent[]; artifacts: Artifact[]; decision: Decision; alerts: Alert[]; jobs: JobQueueItem[]; connections: SystemConnection[]; metrics: TradingMetric[] }
