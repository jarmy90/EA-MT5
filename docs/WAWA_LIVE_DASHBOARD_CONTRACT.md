# WAWA Live Dashboard Contract

## Status

This document is the binding contract for the current frontend. The root application is a React + TypeScript + Vite dashboard. The current UI runs through a deterministic demo adapter and must label all non-live values as `SIMULATION` or `DEMO DATA`.

## Truthfulness

`LIVE` may only be shown when a real adapter has a successful handshake, receives valid events, and maintains a non-stale heartbeat. MT5, GitHub, Freebuff, trading metrics, orders, P&L, win rate, and repository health must remain `OFFLINE`, `UNAVAILABLE`, or `SIMULATION` until those conditions are verifiable. No credentials are stored in the frontend or repository.

## Domain model

The canonical frontend contracts are in `src/types/index.ts`: `Agent`, `AgentTeam`, `AgentStatus`, `AgentTask`, `AgentEvent`, `Run`, `Artifact`, `SystemConnection`, `TradingMetric`, `Decision`, `Alert`, and `JobQueueItem`. `AgentEvent` is the source of truth for visible work; cards, stream, queue, floor, artifacts, and decisions must derive from one state snapshot.

## Current implementation

- Four functional squads: Research & Data, Strategy Lab, Risk & Critic, Build & Execution.
- Deterministic scenarios: Normal Run, Risk Blocked, Build Failed, Human Approval.
- Play/Pause, Reset, next event, scenario selection, event filters, and collapsible navigation.
- Trading chart is deterministic SVG demo data and explicitly labelled simulation.
- Operations Floor visualizes Repository/Data Intake → Research → Strategy → Risk Gate → Build → Human Approval.
- Responsive layout, keyboard-focusable controls, readable labels, and reduced-motion support.

## Live adapter requirements

A future adapter must map verified backend events into the canonical contracts, carry source and timestamp metadata, expose connection state independently from trading values, reject stale heartbeats, and fall back to `UNAVAILABLE` without fabricating values. SSE or WebSocket may be used after a transport contract is defined; this repository does not invent a new endpoint.

## Acceptance boundary

The current implementation is complete as a simulation experience. Live MT5 telemetry remains outside this React adapter until the existing local API is mapped and verified end-to-end. See `docs/REAL_INTEGRATIONS.md` for the safe integration boundary.
