# Panel de reservas de estudio

Prueba técnica. Backend en Express + TypeScript (datos en memoria), frontend en React + TypeScript.

## Cómo arrancar

Node 20+. Backend y frontend van en dos terminales, **los dos a la vez** (el frontend llama a `/api/*` y Vite se lo reenvía al backend en `localhost:3000`).

```bash
# Terminal 1 — backend, puerto 3000
cd backend && npm install && npm run dev
```

```bash
# Terminal 2 — frontend, puerto 5173
cd frontend && npm install && npm run dev
```

Abrir `http://localhost:5173`. El backend arranca con 3 salas y un seed determinista de 100 reservas en memoria (se pierden al reiniciar). No hace falta `.env`; para probar a mano sin la latencia simulada ni el 20 % de fallos: `FAIL_RATE=0 LATENCY_MIN_MS=0 LATENCY_MAX_MS=0 npm run dev` en el backend.

## Cómo lanzar los tests

```bash
(cd backend && npm run typecheck && npm test)
(cd frontend && npm run typecheck && npm test && npm run build)
grep -rn "any\|@ts-ignore" backend/src frontend/src   # debe salir vacío
```

(Los paréntesis son subshells: así el segundo `cd` no hereda el directorio del primero si se pega todo el bloque de una vez.)

108 tests backend + 70 frontend, todos en memoria / con `fetch` mockeado — no hace falta ningún servidor arrancado para testear. `frontend/vitest.config.ts` fija `FAIL_RATE=0` y latencia a 0 para toda la suite. El único resultado del `grep` es `expect.any(String)` (matcher de Vitest, no el tipo `any`).

## Decisiones ante ambigüedades del enunciado

- **`q` busca por subcadena**, no por palabras sueltas, ignorando mayúsculas y acentos (`search.ts`).
- **Cursor** = base64 de `{start, id}`, opaco para el cliente; ordena y desempata por esa misma tupla (`cursor.ts`).
- **Reservas en el pasado**: `validation.ts` no las rechaza (útil para poblar históricos); solo `availability.ts` oculta huecos ya empezados al elegir uno nuevo.
- **Rate limit por cliente** (`req.ip`), no global; cada uno tiene su propia ventana de 10 escrituras/10 s.
- **`PATCH` sí permite mover y cambiar estado a la vez**: se valida primero la transición, luego si el estado resultante permite mover, y por último horario/solape.
- **Idempotencia con cuerpo distinto**: se ignora el cuerpo nuevo y se devuelve la respuesta ya cacheada de la primera vez; una escritura que falló (p. ej. un 503 de caos) no se cachea.
- **`DELETE` borra de verdad** (hard); `PATCH status: 'cancelled'` es el soft-cancel con histórico. Son acciones distintas a propósito.
- **`from`/`to` del listado**: una fecha `AAAA-MM-DD` es el día completo en hora local del estudio; cualquier otro valor es un instante ISO en UTC. Entra lo que se solape con el rango.
- **Diálogo de nueva reserva accesible a mano** (`<div role="dialog">`, no `<dialog>` nativo): jsdom no soporta `showModal()`, y así se controla el focus trap sin depender del navegador.
- **Cancelar pide confirmación** (`window.confirm`) antes de escribir, por ser irreversible; confirmar no la pide, porque una confirmada se puede seguir cancelando después.

## Qué ha quedado fuera y por qué

- **Docker, login, i18n, despliegue**: excluidos por las reglas del enunciado.
- **Mover o borrar una reserva desde la UI**: la API los soporta (`PATCH` con `roomId`/`start`/`end`, `DELETE`), pero el frontend solo expone crear, confirmar y cancelar.
- **Paginación por número de página**: solo scroll infinito con cursor, tal como pide el enunciado; un cursor opaco no permite calcular "página X de Y".
- **URL de API configurable**: el frontend siempre llama a rutas relativas (`/api/...`), pensado para el proxy de Vite o para servirse del mismo origen; no había un destino de despliegue real que justificara una variable de entorno.
- **Reintento infinito en lecturas**: el cliente reintenta `503`/`429` también en lecturas, pero solo hasta `MAX_RETRIES`; agotados, el listado ofrece un botón "Reintentar" manual en vez de seguir en bucle.
- **Tests end-to-end en el repo**: se usó Playwright puntualmente durante el desarrollo para verificar la UI contra un backend real, pero no quedó como parte de `npm test`.
- **Live regions de accesibilidad** más allá de `role="alert"`/`role="status"`: no pedidas por el enunciado.
