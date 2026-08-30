# Real integrations

The current station uses a deterministic SIMULATION adapter. MT5 remains available through the existing local FastAPI bridge, but this new frontend does not claim a live connection unless an adapter supplies it.

A future integration can consume the existing backend contract through Server-Sent Events or WebSocket transport. The transport should map incoming events into `AgentEvent`, validate timestamps and source metadata, and expose connection health separately from trading values. No new endpoint is assumed here: define and document the transport contract before wiring it.

Secrets must remain in local environment configuration or the platform's secret manager. Never commit credentials, account passwords, or tokens.
