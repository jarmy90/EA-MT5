# WAWA Live Agentic Trading Station

## Implementation contract for Freebuff

**Status:** binding engineering specification  
**Target repository:** `jarmy90/EA-MT5`  
**Purpose:** turn the current dashboard into a truthful, real-time Agentic Trading Station connected to repository activity, agent runs, artifacts and, when available, MetaTrader 5 telemetry.

> This document is not a visual suggestion. Treat it as the runtime, data, security and acceptance contract. The frontend must never label generated or stale data as LIVE.

---

## 1. Non-negotiable product behavior

Wawa must answer these questions without opening a terminal:

1. Which run is active?
2. Which agent owns each task?
3. Which tool is the agent using?
4. What input did the agent receive?
5. What output or artifact did the agent produce?
6. Which decision passed or failed the risk gate?
7. Is human approval required?
8. Is GitHub, Freebuff, the event gateway and MT5 truly connected?
9. What is live, stale, simulated or unavailable?
10. Can every visible decision be traced to source events?

A moving avatar without a source event is decoration and must not be shown as active work.

---

## 2. Runtime architecture

```text
GitHub webhook ───────┐
Freebuff adapter ─────┤
MT5 bridge ───────────┤       ┌──────────────────────┐
Backtest/log watcher ─┼──────►│ Wawa Event Gateway   │
Artifact watcher ─────┤       │ auth + normalize     │
System heartbeat ─────┘       │ persist + broadcast  │
                              └──────────┬───────────┘
                                         │
                           SSE primary / WebSocket optional
                                         │
                              ┌──────────▼───────────┐
                              │ React dashboard       │
                              │ one event reducer     │
                              │ derived read models   │
                              └──────────────────────┘
```

### Required rule

The visual state of Agent Cards, Operations Floor, Decision Stream, Job Queue, Artifact panel and alerts must be derived from the same canonical event stream. Do not maintain unrelated local mock states for each component.

### Recommended deployment split

- `apps/dashboard`: React + TypeScript + Vite client.
- `apps/gateway`: small FastAPI or Node service for adapters, auth, persistence and SSE.
- `packages/contracts`: shared JSON Schema and generated TypeScript types.
- `data/demo`: deterministic simulation fixtures only.
- `docs`: architecture and integration instructions.

If the repository must temporarily remain static, implement the client and demo adapter now, but keep live adapters behind the same `EventSourceAdapter` interface. A static GitHub Pages deployment cannot receive private webhooks, safely store secrets or connect directly to a local MT5 terminal.

---

## 3. Truthfulness model

Every connection and metric must carry provenance.

```ts
export type DataMode = 'LIVE' | 'STALE' | 'SIMULATION' | 'OFFLINE' | 'UNAVAILABLE';

export interface Provenance {
  mode: DataMode;
  source: 'github' | 'freebuff' | 'mt5' | 'backtest' | 'gateway' | 'demo';
  sourceId?: string;
  observedAt: string;
  receivedAt: string;
  staleAfterMs: number;
  correlationId?: string;
}
```

Rules:

- `LIVE` requires a successful authenticated source handshake and a heartbeat inside `staleAfterMs`.
- Missing heartbeat transitions automatically to `STALE`, then `OFFLINE`.
- Demo fixtures always remain `SIMULATION`.
- Never infer LIVE from a browser timer, green dot or open page.
- Never mix live and demo values in one metric without a visible per-value label.
- A metric without provenance renders `UNAVAILABLE`, not zero.

---

## 4. Canonical event envelope

All adapters normalize external input into this envelope.

```ts
export type AgentTeam = 'research' | 'strategy' | 'risk' | 'execution' | 'system';
export type AgentStatus =
  | 'IDLE' | 'QUEUED' | 'THINKING' | 'READING' | 'USING_TOOL'
  | 'WAITING_DEPENDENCY' | 'REVIEWING' | 'BLOCKED' | 'FAILED' | 'COMPLETED';

export type EventType =
  | 'connection.changed'
  | 'run.created' | 'run.started' | 'run.paused' | 'run.completed' | 'run.failed'
  | 'task.queued' | 'task.started' | 'task.progress' | 'task.blocked' | 'task.completed' | 'task.failed'
  | 'tool.started' | 'tool.completed' | 'tool.failed'
  | 'artifact.created' | 'artifact.updated'
  | 'decision.proposed' | 'decision.reviewed' | 'decision.approved' | 'decision.rejected'
  | 'approval.requested' | 'approval.resolved'
  | 'build.started' | 'build.completed' | 'build.failed'
  | 'backtest.started' | 'backtest.progress' | 'backtest.completed' | 'backtest.failed'
  | 'trade.signal' | 'trade.order' | 'trade.fill' | 'trade.position' | 'trade.closed'
  | 'heartbeat' | 'alert.raised' | 'alert.resolved';

export interface WawaEvent<T = Record<string, unknown>> {
  schemaVersion: '1.0';
  id: string;
  sequence: number;
  eventType: EventType;
  timestamp: string;
  runId?: string;
  taskId?: string;
  agentId?: string;
  team?: AgentTeam;
  status?: AgentStatus;
  progress?: number;
  summary: string;
  payload: T;
  provenance: Provenance;
  correlationId: string;
  causationId?: string;
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
}
```

Validation rules:

- ISO 8601 timestamps with timezone.
- `sequence` strictly increases per stream.
- `progress` is 0 to 100 and cannot decrease unless a retry creates a new attempt.
- Terminal states are immutable.
- Unknown payload fields may be preserved, but invalid envelopes go to a dead-letter log and generate an alert.
- The client de-duplicates by `id` and detects sequence gaps.

---

## 5. State reducer

Implement a pure reducer:

```ts
function reduceWawaState(state: WawaState, event: WawaEvent): WawaState
```

The reducer must:

- be deterministic;
- be replayable from an empty state;
- reject duplicate IDs;
- flag out-of-order or missing sequences;
- update connection freshness;
- derive current agent task from task events;
- derive queue state from task lifecycle;
- append auditable decisions and artifacts;
- stop execution at `approval.requested` until `approval.resolved`;
- never mutate prior state;
- support snapshot hydration followed by stream continuation.

Create unit tests using a recorded fixture. Replaying the same fixture must produce byte-equivalent serialized state.

---

## 6. Live transport contract

### Bootstrap

```http
GET /api/v1/bootstrap
Authorization: Bearer <short-lived-token>
```

Response includes server time, authenticated user capabilities, connections, latest snapshot and stream cursor.

### Event stream

```http
GET /api/v1/events/stream?after=<sequence>
Accept: text/event-stream
Authorization: Bearer <short-lived-token>
Last-Event-ID: <event-id>
```

SSE frames:

```text
id: evt_01J...
event: wawa.event
data: {canonical WawaEvent JSON}
```

Requirements:

- heartbeat every 10 to 15 seconds;
- reconnect with exponential backoff and jitter;
- resume with `Last-Event-ID` or `after` cursor;
- no event loss across normal reconnects;
- provide snapshot resync when retention has expired;
- surface `LIVE`, `RECONNECTING`, `STALE` and `OFFLINE` in the UI;
- cancel stream on logout;
- do not place durable secrets in query parameters, localStorage or source code.

Use WebSocket only for genuine bidirectional low-latency controls. Prefer SSE for append-only telemetry.

---

## 7. Adapter interfaces

```ts
export interface EventSourceAdapter {
  id: string;
  connect(signal: AbortSignal): Promise<void>;
  health(): Promise<ConnectionHealth>;
  events(cursor?: string): AsyncIterable<WawaEvent>;
  disconnect(): Promise<void>;
}
```

Required adapters:

- `DemoEventAdapter`: deterministic fixtures, visibly SIMULATION.
- `GatewaySseAdapter`: production browser adapter.
- `GitHubWebhookAdapter`: server-side only.
- `FreebuffAdapter`: server-side only and based on the events Freebuff actually exposes.
- `Mt5BridgeAdapter`: local or private-network bridge, never browser-to-terminal direct.

Do not invent Freebuff or MT5 endpoints. Document the exact missing source contract when an integration cannot yet be completed.

---

## 8. Source-specific minimum payloads

### GitHub

Display only verified webhook/API facts:

- repository;
- branch;
- commit SHA;
- author supplied by GitHub;
- changed paths;
- workflow/check status;
- pull request status;
- timestamps;
- link to source object.

Webhook verification is mandatory. Use a server-side secret and constant-time signature comparison.

### Freebuff

Normalize, when actually available:

- run identifier;
- task and parent task;
- agent/worker;
- model/provider label;
- tool calls;
- progress;
- generated files;
- completion/failure reason;
- token/cost data if supplied by the source;
- human approval requests.

If Freebuff exposes only partial data, show partial truth. Do not fabricate hidden reasoning. Display concise action summaries and tool evidence, not private chain-of-thought.

### MetaTrader 5

Use a bridge that publishes sanitized telemetry:

- account mode: DEMO or REAL;
- terminal connected;
- broker and account alias, not secret credentials;
- symbol and timeframe;
- EA name and build;
- tick/bar timestamp;
- open positions;
- closed trade events;
- balance/equity/margin values when explicitly enabled;
- EA decision/audit events;
- backtest progress and result file references.

Default to read-only. Trade execution and order cancellation require explicit capability, authentication, audit logging and human approval policy.

---

## 9. Dashboard composition

### Command bar

Show WAWA, run mode, GitHub, Freebuff, Gateway and MT5 states, current run, symbol, timeframe, build, commit, stream lag and local clock.

### Four squads

1. Research & Data
2. Strategy Lab
3. Risk & Critic
4. Build & Execution

Each active card shows name, state, assigned task, real progress, tool, elapsed time, dependency, latest output and provenance.

### Center workspace

Tabs:

- Market
- EA Logic
- Pipeline
- Backtests
- Code Changes

The initial view emphasizes real operational data. Charts must not regenerate randomly. Missing series show an empty state with source requirements.

### Decision stream

Every entry includes timestamp, agent, action, tool, result, duration, severity, artifact links, correlation ID and source mode. Filters: All, Decisions, Tools, Errors, Reviews.

### Operations floor

Visual departments react to canonical events. Animations use transform and opacity and respect `prefers-reduced-motion`. Agents do not walk without task events. Selecting a station opens the same underlying task and evidence shown elsewhere.

### Bottom console

Tabs: Job Queue, Run History, Artifacts, Audit Log, Alerts.

---

## 10. UI state semantics

- Cyan: Research/Data activity.
- Violet: Strategy activity.
- Amber: Review, caution or approval pending.
- Green: verified success, connection or execution completion.
- Red: failure, rejected risk or disconnected critical source.
- Gray: idle or unavailable.

Color is never the only signal. Pair it with icon and text.

Connection badges:

```text
LIVE          authenticated + heartbeat fresh
RECONNECTING  transport retry in progress
STALE         heartbeat exceeded freshness threshold
OFFLINE       handshake failed or no recoverable transport
SIMULATION    deterministic fixtures
UNAVAILABLE   source not configured
```

---

## 11. Security boundaries

- No API keys, PATs, broker credentials or webhook secrets in frontend code.
- No secrets committed to Git.
- Browser receives short-lived tokens only.
- Apply least privilege to GitHub and Freebuff credentials.
- Sanitize file paths and agent-generated text before rendering.
- Never render arbitrary HTML from agent output.
- Add CSP appropriate to deployment.
- Audit all approval and execution actions.
- Rate-limit control endpoints.
- Maintain a capability matrix: `read_repo`, `write_repo`, `run_build`, `read_mt5`, `execute_trade`, `approve_run`.
- `execute_trade` defaults disabled.

---

## 12. Deterministic simulation fixtures

Provide four replayable fixtures:

1. `normal-run.jsonl`
2. `risk-blocked.jsonl`
3. `build-failed.jsonl`
4. `human-approval.jsonl`

Each fixture must contain realistic but explicitly synthetic events with fixed timestamps relative to a declared fixture epoch. Avoid `Math.random()` during rendering or playback.

Playback controls:

- play;
- pause;
- reset;
- next event;
- 1x, 2x and 4x;
- select scenario.

Reset must always produce identical final state.

---

## 13. Failure handling

The dashboard must visibly handle:

- SSE disconnect;
- invalid token;
- event sequence gap;
- malformed event;
- GitHub rate limit;
- Freebuff unavailable;
- MT5 bridge unavailable;
- stale trading data;
- failed build;
- failed backtest;
- artifact missing;
- human approval timeout;
- unsupported source capability.

Do not replace errors with green mock states. Provide retry, diagnostics and correlation ID.

---

## 14. Tests and acceptance gates

Required automated coverage:

- event schema validation;
- reducer determinism;
- duplicate de-duplication;
- sequence-gap detection;
- stale/offline transitions using fake timers;
- approval gate halts execution;
- rejected risk cannot become successful execution;
- failed build does not report completed;
- simulation never reports LIVE;
- XSS payload renders as text;
- responsive component smoke tests.

Required commands must pass exactly as configured in the repository:

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
```

Manual checks:

- 1440x900 and 1920x1080 without panel overlap;
- no accidental horizontal page scroll;
- keyboard navigation and visible focus;
- reduced-motion mode;
- no browser console errors;
- direct reload works on deployed route;
- graph resizes correctly;
- disconnect/reconnect state is truthful;
- fixtures replay reproducibly.

---

## 15. Completion definition

Do not claim “fully live” unless all configured live adapters have:

1. authenticated handshake;
2. real source event ingestion;
3. heartbeat/freshness handling;
4. reconnection and cursor resume;
5. provenance displayed in UI;
6. error state tested;
7. no embedded secrets;
8. written integration documentation.

If a source API or credential is unavailable, complete the adapter boundary, fixture, UI states and documentation, then state the exact blocker. “No limitations” must mean no artificial UI restriction, not bypassing security or claiming nonexistent source capabilities.

---

## 16. Required Freebuff final report

Return:

- architecture discovered;
- architecture implemented;
- exact file list;
- exact dependencies and reasons;
- live adapters truly connected;
- adapters remaining in simulation and why;
- environment variables required, names only;
- commands executed and exact results;
- screenshots at 1440x900 and mobile;
- console status;
- deployment URL if available;
- commit SHA;
- known limitations;
- next smallest step to connect each unavailable source.

Do not deliver only a plan. Implement, test and document everything possible with current permissions.
