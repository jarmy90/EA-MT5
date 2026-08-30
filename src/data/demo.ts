import type { Agent, AgentEvent, Artifact, Decision, DemoScenario, JobQueueItem, SystemConnection } from '../types'

const teams = [
  { id: 'research', name: 'NOVA', team: 'Research & Data' as const, role: 'Market intelligence', color: '#22D3EE', tool: 'Market Data API' },
  { id: 'strategy', name: 'VECTOR', team: 'Strategy Lab' as const, role: 'Signal synthesis', color: '#A855F7', tool: 'Backtest Runner' },
  { id: 'risk', name: 'SENTINEL', team: 'Risk & Critic' as const, role: 'Exposure control', color: '#F59E0B', tool: 'Risk Engine' },
  { id: 'build', name: 'FORGE', team: 'Build & Execution' as const, role: 'EA delivery', color: '#22C55E', tool: 'CI Pipeline' },
]

export const scenarios: DemoScenario[] = ['Normal Run', 'Risk Blocked', 'Build Failed', 'Human Approval']

export function createDemoState(scenario: DemoScenario, cursor = 4) {
  const blockedRisk = scenario === 'Risk Blocked'
  const failedBuild = scenario === 'Build Failed'
  const human = scenario === 'Human Approval'
  const statuses = blockedRisk ? ['COMPLETED', 'COMPLETED', 'BLOCKED', 'WAITING_DEPENDENCY'] : failedBuild ? ['COMPLETED', 'COMPLETED', 'COMPLETED', 'FAILED'] : human ? ['COMPLETED', 'COMPLETED', 'REVIEWING', 'WAITING_DEPENDENCY'] : ['USING_TOOL', 'THINKING', 'REVIEWING', 'QUEUED']
  const tasks = ['Ingesting USTEC + XAUUSD ticks', 'Comparing signal candidates', blockedRisk ? 'Rejecting excess exposure' : human ? 'Preparing approval packet' : 'Validating drawdown guard', failedBuild ? 'Build failed: typecheck gate' : human ? 'Awaiting human approval' : 'Packaging EA release']
  const agents: Agent[] = teams.map((t, i) => ({ id: t.id, name: t.name, team: t.team, role: t.role, color: t.color, status: statuses[i] as Agent['status'], task: { id: `task-${i}`, title: tasks[i], progress: [78, 62, blockedRisk ? 88 : 44, failedBuild ? 31 : 12][i], elapsed: `${String(4 + i * 3).padStart(2, '0')}:2${i}`, tool: t.tool, dependency: i === 3 ? (human ? 'Human Approval' : 'Risk Gate') : undefined }, lastOutput: ['42,810 ticks normalized', '3 candidates ranked', blockedRisk ? 'Gate rejected: leverage limit' : human ? 'Approval packet ready' : 'No critical exposure', failedBuild ? 'CI-104: typecheck failed' : 'Release candidate queued'][i] }))
  const baseEvents: AgentEvent[] = [
    event('e1', 'research', teams[0].team, 'TOOL', 'READING', 'Market data ingested', '42,810 ticks normalized from the configured feed.', 78, 'Market Data API', 'info'),
    event('e2', 'strategy', teams[1].team, 'DECISION', 'THINKING', 'Signal candidate ranked', 'Momentum continuation leads the deterministic model set.', 62, 'Backtest Runner', 'info'),
    event('e3', 'risk', teams[2].team, blockedRisk ? 'ERROR' : 'REVIEW', blockedRisk ? 'BLOCKED' : human ? 'REVIEWING' : 'REVIEWING', blockedRisk ? 'Risk gate blocked run' : 'Exposure review complete', blockedRisk ? 'Leverage cap exceeded; execution is prevented.' : 'Exposure remains inside configured guardrails.', 88, 'Risk Engine', blockedRisk ? 'critical' : 'info'),
    event('e4', 'build', teams[3].team, failedBuild ? 'ERROR' : human ? 'SYSTEM' : 'ARTIFACT', failedBuild ? 'FAILED' : human ? 'WAITING_DEPENDENCY' : 'QUEUED', failedBuild ? 'Build verification failed' : human ? 'Human approval required' : 'EA package queued', failedBuild ? 'Typecheck gate failed before packaging.' : human ? 'A human must approve the release candidate.' : 'Build starts after the risk gate.', 31, 'CI Pipeline', failedBuild ? 'critical' : human ? 'warning' : 'info'),
  ].slice(0, cursor)
  const decision: Decision = blockedRisk ? { outcome: 'REJECT', confidence: 96, rationale: ['Leverage exceeds risk policy', 'Execution path disabled'], evidence: ['Risk Engine / exposure snapshot'] } : failedBuild ? { outcome: 'HOLD', confidence: 99, rationale: ['Build verification failed'], evidence: ['CI Pipeline / typecheck'] } : human ? { outcome: 'NEEDS_REVIEW', confidence: 84, rationale: ['Release candidate is ready', 'Approval policy requires a human'], evidence: ['Risk review', 'EA package manifest'] } : { outcome: 'EXECUTE', confidence: 81, rationale: ['Signal passes strategy and risk gates'], evidence: ['Signal ranking', 'Exposure snapshot'] }
  const connections: SystemConnection[] = [{ name: 'MT5 Bridge', status: 'SIMULATION', detail: 'No live connection in demo adapter', updatedAt: 'now' }, { name: 'Repository', status: 'CONNECTED', detail: 'main · clean working tree', updatedAt: 'now' }, { name: 'Freebuff', status: 'SIMULATION', detail: 'Preview adapter', updatedAt: 'now' }]
  const artifacts: Artifact[] = [{ id: 'a1', name: 'market-normalized.parquet', type: 'DATASET', owner: 'NOVA', status: 'READY', updatedAt: '2m ago' }, { id: 'a2', name: 'signal-review.md', type: 'DECISION', owner: 'VECTOR', status: 'READY', updatedAt: '1m ago' }, { id: 'a3', name: failedBuild ? 'build-report.log' : 'ea-release.zip', type: 'BUILD', owner: 'FORGE', status: failedBuild ? 'FAILED' : 'QUEUED', updatedAt: 'now' }]
  const jobs: JobQueueItem[] = agents.map((a, i) => ({ id: `j${i}`, title: a.task.title, owner: a.name, status: a.status === 'BLOCKED' ? 'BLOCKED' : a.status === 'FAILED' ? 'BLOCKED' : i === 0 ? 'RUNNING' : 'QUEUED', priority: i === 2 ? 'P0' : 'P1' }))
  return { run: { id: `run-${scenario.toLowerCase().replaceAll(' ', '-')}`, name: scenario, scenario, startedAt: '14:32:08', status: blockedRisk ? 'BLOCKED' : failedBuild ? 'FAILED' : human ? 'PAUSED' : 'RUNNING' }, agents, events: baseEvents, artifacts, decision, connections, jobs }
}
function event(id: string, agentId: string, team: Agent['team'], eventType: AgentEvent['eventType'], status: Agent['status'], task: string, summary: string, progress: number, tool: string, severity: AgentEvent['severity']): AgentEvent { return { id, runId: 'run-demo', timestamp: `14:${32 + Number(id.slice(1))}:0${id.slice(1)}`, agentId, team, eventType, status, task, summary, progress, tool, inputArtifacts: [], outputArtifacts: [], requiresHuman: status === 'WAITING_DEPENDENCY', severity, durationMs: 1200 } }
