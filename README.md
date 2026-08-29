# MISIÓN CONTROL // Trading Operations Center

Misión Control is a local operations dashboard for monitoring autonomous MetaTrader 5 strategies. The frontend is a dependency-free HTML dashboard with Demo Mode and Live Mode; the optional Windows bridge exposes read-only MT5 telemetry through FastAPI.

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

`MT5_PATH` y `PORT` son opcionales. El paquete Python `MetaTrader5` se comunica con el terminal de escritorio instalado en el mismo Windows; usa `MT5_PATH` si está instalado en una ruta no estándar.

## Frontend

Live Mode es el modo predeterminado y consulta `/account`, `/positions`, `/status` y `/telemetry` cada pocos segundos para reflejar datos reales. No muestra cifras demo; si la API no está disponible, muestra un estado offline claro. Cada agente cambia entre desconectado, durmiendo, espera, trabajando, excitado, estresado o alerta según mercado, posiciones y beneficio flotante. La inspiración de equipos vivos de StarNet se aplica como proyección de estado operativo verificable, sin copiar arte, marca ni código. La separación por estrategia requiere mapear magic numbers o comentarios de órdenes en una futura capa de agregación.
