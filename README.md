# WAWA // Agentic Trading Station

WAWA is a professional agentic trading operations station. The frontend is now a React + TypeScript + Vite dashboard with deterministic, explicitly labelled SIMULATION data; the existing optional Windows bridge exposes read-only MetaTrader 5 telemetry through FastAPI.

## Arranque por Remote Desktop

1. Tener MetaTrader 5 abierto y con sesión iniciada.
2. Hacer doble clic en `start_mision_control.bat`.
3. El script instala dependencias solo si faltan, comprueba MT5, inicia la API y abre el navegador automáticamente.
4. Si la API no responde, la interfaz muestra: `API no disponible. ¿Has ejecutado start_mision_control.bat?`

La API queda disponible en `http://127.0.0.1:8000`. La ventana de consola debe permanecer abierta mientras se usa el panel. El launcher también acepta `.env` opcional para una sesión que deba iniciar sesión por sí misma. El bridge intenta reconectar con MT5 cada 10 segundos si el terminal o la sesión dejan de responder.

## API

- `GET /status` — estado de terminal/sesión y último error
- `GET /health` — comprobación de disponibilidad
- `GET /account` — balance, equity, margen y beneficio
- `GET /positions` — posiciones abiertas
- `GET /telemetry` — paquete combinado de estado, cuenta, posiciones y ticks para el dashboard
- `GET /tick/{symbol}` — último tick, por ejemplo `/tick/EURUSD`
- `GET /rates/{symbol}?timeframe=M15&count=200` — histórico OHLCV (`M1`, `M5`, `M15`, `M30`, `H1`, `H4`, `D1`)

La API es de solo lectura y no envía órdenes.

## Visión y arquitectura

The station represents an organization working from data intake through research, strategy, risk governance, delivery, and human approval. Every visible agent state, event, queue item, artifact, and decision is derived from one deterministic demo snapshot. No demo P&L, orders, MT5 status, or Freebuff status is presented as live.

The frontend stack is React, TypeScript, Vite, Framer Motion, Lucide React, and inline SVG/CSS. The primary view is four independent EA stations with a shared portfolio manager. Live mode polls `/telemetry` without inventing values; if the handshake is absent, the UI remains OFFLINE/UNAVAILABLE and offers deterministic simulation only as an explicit opt-in. See `docs/ARCHITECTURE.md`, `docs/EVENT_CONTRACT.md`, `docs/REAL_INTEGRATIONS.md`, and `docs/WAWA_LIVE_DASHBOARD_CONTRACT.md`.

## Estructura

```text
index.html                 Frontend Misión Control y modos Demo/Live
api/main.py                Rutas FastAPI y servidor del frontend
mt5_bridge/service.py      Adaptador oficial MetaTrader5 y reconexión
requirements.txt           Dependencias Python
start_mision_control.py    Launcher multiplataforma
start_mision_control.bat   Launcher de doble clic para Windows
env.example.txt            Referencia de configuración local sin credenciales
```

## Configuración local

El launcher y el bridge cargan `.env` automáticamente si existe:

```text
MT5_LOGIN=tu_login
MT5_PASSWORD=tu_password
MT5_SERVER=ICMarketsEU-MT5-5
```

Sin `.env`, el bridge no inicia sesión por cuenta propia y confía en la sesión activa del terminal MetaTrader 5.

`MT5_PATH` y `PORT` son opcionales. Para atribución exacta por EA, configura `AGENT_MAP` con magic numbers o tags; sin mapa, las posiciones se reparten round-robin entre agentes del mismo símbolo. Los estados visuales usan ticks frescos, posiciones y profit: el mercado cerrado produce `SLEEPING`, mientras que actividad y resultado producen `WORKING`, `ENERGIZED`, `STRESSED` o `ALERT`.

Ejemplo de `AGENT_MAP`:

```text
AGENT_MAP=[{"id":"NQ-ALPHA","symbols":["USTEC"],"magics":[111001],"tags":[]},{"id":"NQ-SIGMA","symbols":["USTEC"],"magics":[111002],"tags":[]},{"id":"XAU-PRIME","symbols":["XAUUSD"],"magics":[222001],"tags":[]},{"id":"XAU-FLASH","symbols":["XAUUSD"],"magics":[222002],"tags":[]}]
```

`tools/list_magics.py` imprime los magic numbers y comentarios de las posiciones abiertas para completar ese mapa.

`MT5_PATH` y `PORT` son opcionales. El paquete Python `MetaTrader5` se comunica con el terminal de escritorio instalado en el mismo Windows; usa `MT5_PATH` si está instalado en una ruta no estándar.

## Auto-descubrimiento de Magic Numbers

El sistema descubre automáticamente los magic numbers de tus EAs al arrancar:

1. Lee los magic numbers de las posiciones abiertas reales.
2. Los agrupa por grupo de símbolo (NQ para USTEC, XAU para XAUUSD).
3. Asigna cada magic al siguiente agente libre de su grupo, en orden.
4. Guarda el mapeo en `data/agent_map.auto.json` para que sea estable entre reinicios.

Prioridad: `AGENT_MAP` manual en `.env` > `agent_map.auto.json` > round-robin por símbolo.

Consulta el mapeo actual en `http://127.0.0.1:8000/agents/map`.

## Fórmula de Floating P&L

El beneficio flotante se calcula de forma unificada en header, tarjetas y log:

```text
floating_pnl = profit + swap + commission
```

El mismo número aparece en los tres sitios. Los valores vienen directamente de MT5 sin redondeos intermedios.

## Desarrollo y despliegue

```bash
bun install
bun run dev
bun run typecheck
bun run build
bun run preview
```

GitHub Pages se publica desde la raíz de `main` mediante `.github/workflows/deploy-pages.yml`. Vite usa `base: './'`, por lo que los assets funcionan bajo `/EA-MT5/`. La aplicación no se coloca dentro de `docs/`; esa carpeta contiene únicamente documentación.

## Escenarios demo

El selector permite reproducir `Normal Run`, `Risk Blocked`, `Build Failed` y `Human Approval`. Todos son deterministas y están marcados `SIMULATION`; no representan órdenes, P&L, conexión MT5 ni estado real.

## Frontend

Live Mode es el modo predeterminado y consulta `/telemetry` cada segundo. Solo muestra datos reales cuando el backend confirma conexión; si falla, muestra `OFFLINE` y no sustituye valores por demo. La simulación se activa manualmente y usa el mismo componente de estación EA. Los estados visuales representan actividad, posición, beneficio, pérdida, bloqueo o desconexión.
