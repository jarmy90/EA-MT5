# Event contract

`AgentEvent` is the canonical unit of observable work. Required fields include `id`, `runId`, `timestamp`, `agentId`, `team`, `status`, `eventType`, `task`, `summary`, `progress`, artifact references, dependency flags, severity, duration, and metadata.

The UI derives Agent Cards, Decision Stream, Job Queue, Operations Floor, and Final Decision from one `DemoState` snapshot. A live adapter should emit the same event shape; it must not present unavailable trading or connection metrics as live.
