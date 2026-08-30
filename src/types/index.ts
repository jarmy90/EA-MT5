export type EAConnection = 'CONNECTED' | 'CONNECTING' | 'OFFLINE' | 'UNAVAILABLE' | 'SIMULATION'
export type EAState = 'OFFLINE' | 'CONNECTING' | 'IDLE' | 'SCANNING' | 'SIGNAL_FOUND' | 'ORDER_PENDING' | 'POSITION_OPEN' | 'PROFITABLE' | 'LOSING' | 'RECOVERING' | 'CLOSING' | 'PAUSED' | 'RISK_BLOCKED' | 'ERROR'
export type EAVisualState = 'idle' | 'scanning' | 'signal' | 'position' | 'profitable' | 'losing' | 'recovering' | 'blocked' | 'offline'

export interface EAPosition { ticket: string; symbol: string; side: 'BUY' | 'SELL'; volume: number; entryPrice: number; currentPrice: number; stopLoss?: number; takeProfit?: number; points: number; pnl: number; returnPct?: number; openedAt: string; riskState: 'NORMAL' | 'ELEVATED' | 'CRITICAL' }
export interface EAOrder { ticket: string; symbol: string; side: 'BUY' | 'SELL'; volume: number; price: number; status: 'PENDING' | 'CANCELLED' }
export interface EATrade { ticket: string; symbol: string; side: 'BUY' | 'SELL'; pnl: number; closedAt: string }
export interface EAMetrics { floatingPnl: number; realizedPnl: number; returnPct?: number; winRate?: number; drawdownPct?: number; riskExposure?: number; balanceContribution?: number; equityContribution?: number; todayResult?: number; sessionResult?: number }
export interface EATelemetryEvent { id: string; timestamp: string; type: string; message: string; severity: 'INFO' | 'WARNING' | 'CRITICAL'; source: string }
export interface ExpertAdvisor { id: string; displayName: string; magicNumber?: number; symbol: string; timeframe: string; color: string; version?: string; build?: string; connectionState: EAConnection; operatingState: EAState; lastHeartbeat?: string; lastTickAt?: string; positions: EAPosition[]; pendingOrders: EAOrder[]; closedTrades: EATrade[]; metrics: EAMetrics; visualState: EAVisualState; provenance: string; currentTask: string; lastSignal: string }
export interface PortfolioSummary { balance?: number; equity?: number; floatingPnl?: number; realizedPnl?: number; returnPct?: number; connectedEAs: number; openPositions: number; exposure?: number; drawdownPct?: number; bestEA?: string; pressureEA?: string; globalState: 'SIMULATION' | 'LIVE' | 'OFFLINE' }
export interface AccountSnapshot { balance?: number; equity?: number; profit?: number; timestamp: string; provenance: string }
export interface MarketSnapshot { symbol: string; bid?: number; ask?: number; last?: number; timestamp: string; provenance: string }
export type DemoScenario = 'Normal Run' | 'Risk Blocked' | 'Build Failed' | 'Human Approval' | 'EA Profitable' | 'EA Losing' | 'EA Offline'
export interface DemoState { eas: ExpertAdvisor[]; portfolio: PortfolioSummary; account: AccountSnapshot; markets: MarketSnapshot[]; events: EATelemetryEvent[]; scenario: DemoScenario; cursor: number; simulation: boolean }

// Compatibility aliases for the existing event documentation and future adapters.
export type AgentStatus = EAState
export type AgentTeam = 'Research & Data' | 'Strategy Lab' | 'Risk & Critic' | 'Build & Execution'
export interface AgentTask { id: string; title: string; progress: number; elapsed: string; tool: string; dependency?: string }
export interface AgentEvent { id: string; runId: string; timestamp: string; agentId: string; team: AgentTeam; status: AgentStatus; eventType: string; task: string; summary: string; progress: number; tool?: string; inputArtifacts: string[]; outputArtifacts: string[]; dependency?: string; requiresHuman: boolean; severity: 'info' | 'warning' | 'critical'; durationMs: number; metadata?: Record<string, string> }
export interface Run { id: string; name: string; scenario: DemoScenario; startedAt: string; status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'BLOCKED' | 'FAILED' }
export interface Artifact { id: string; name: string; type: string; owner: string; status: string; updatedAt: string }
export interface SystemConnection { name: string; status: 'CONNECTED' | 'OFFLINE' | 'SIMULATION'; detail: string; updatedAt: string }
export interface TradingMetric { label: string; value: string; source: string; updatedAt: string; unavailable?: boolean }
export interface Decision { outcome: 'EXECUTE' | 'REJECT' | 'HOLD' | 'NEEDS_REVIEW'; confidence: number; rationale: string[]; evidence: string[] }
export interface Alert { id: string; severity: 'info' | 'warning' | 'critical'; message: string; timestamp: string }
export interface JobQueueItem { id: string; title: string; owner: string; status: 'QUEUED' | 'RUNNING' | 'BLOCKED' | 'DONE'; priority: string }
