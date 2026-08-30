# Architecture

The repository now has a Vite + React + TypeScript frontend. `src/types` owns domain contracts, `src/data` owns adapters, `src/App.tsx` composes the station, and `src/styles.css` owns presentation tokens and responsive layout. The legacy FastAPI/MT5 service remains a separate read-only integration boundary and is not modified by this frontend migration. The deterministic demo adapter is intentionally explicit and labelled SIMULATION.

## Runtime boundaries

- Presentation: React components in `src/App.tsx`.
- Domain: interfaces and unions in `src/types/index.ts`.
- Data: `src/data/demo.ts`; future live adapters should implement the same shapes.
- Animation: Framer Motion is limited to pipeline packet motion and respects reduced-motion CSS.
- Deployment: Vite emits relative assets for GitHub Pages.
