# PLAN — Sistema de Notificaciones VÉRTIGO Cup (v2)

> Estado: en implementación · Última actualización: 2026-09-02
> Alcance: notificaciones in-app para usuarios autenticados + banner de cupos para visitantes.

---

## 1. Objetivo

Un solo centro de notificaciones global que:

1. **Apostadores (rol `spectator`)**: avisen si **ganaron o perdieron** una apuesta al
   cerrarse la llave, si la apuesta fue **anulada** (stake devuelto) y cuando **se abre
   una oportunidad de apuesta** (llave programada).
2. **Capitanes (rol `owner`)**: avisen de **fases que requieren acción** — partido
   programado, ventana de READY abierta, lineup a declarar, resultado de la llave.
3. **Visitantes (sin sesión)**: banner con los **lugares de equipo libres** de la
   edición, con CTA a `/registro` (descartable, con memoria en localStorage).

Todo con la identidad visual de marca (frame neón con escudo V), **sonido** por tipo de
evento (motor WebAudio existente) y **campana animada** al llegar novedades.

---

## 2. Arquitectura (flujo completo)

```
Evento de negocio (UPDATE en match / bet)
        │
        ▼
TRIGGER en Postgres (SECURITY DEFINER)          ← la verdad vive en la DB:
  notify_bet_settled()                            ningún endpoint olvida avisar
  notify_match_scheduled()
  notify_match_phase()          ← NUEVO (READY / lineup)
        │
        ▼
Tabla `notification` (RLS: SELECT solo propias)
        │
        ├── Realtime (postgres_changes)  → campana suena AL INSTANTE
        └── Polling 45s (respaldo)       → reconcilia si realtime falla
                │
                ▼
GET /api/notifications  → lista + unread + accountId
POST /api/notifications → marcar leída(s)
                │
                ▼
NotificationCenter (cliente, montado en root layout)
  ├─ logueado:  campana + badge + panel compacto + sonidos
  └─ visitante: banner de cupos (frame de marca) con CTA
```

**Principio rector**: la *creación* de notificaciones es responsabilidad de la base de
datos (triggers), la *entrega* es responsabilidad del cliente (realtime + polling), y la
API solo *lee* y *marca leídas*. Así ninguna server action nueva o vieja puede olvidarse
de notificar.

---

## 3. Modelo de datos

```sql
notification (
  id          uuid PK DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL → account(id) ON DELETE CASCADE,
  type        varchar(40) NOT NULL DEFAULT 'generic',
  title       varchar(160) NOT NULL,
  body        varchar(400),
  link        varchar(300),          -- ruta interna relativa
  match_id    uuid,                  -- referencia opcional a la llave
  read_at     timestamptz,           -- NULL = no leída
  created_at  timestamptz NOT NULL DEFAULT now()
)
-- Índices: (account_id, created_at DESC) + parcial (account_id) WHERE read_at IS NULL
-- RLS: SELECT solo si account.supabase_auth_id = auth.uid() (espejo account).
-- Sin INSERT/UPDATE/DELETE policies: escritura solo triggers / service role.
-- Realtime: ALTER PUBLICATION supabase_realtime ADD TABLE notification.
```

Drizzle: espejada en `src/lib/db/schema.ts` + `src/types/db/index.ts`.

---

## 4. Catálogo de eventos

| type | Disparador (trigger) | Destinatarios | Sonido | Link |
|---|---|---|---|---|
| `bet_won` | bet: pending→won | espectador que acertó | `coin` | `/apuestas` |
| `bet_lost` | bet: pending→lost | espectador que falló | `error` (suave) | `/apuestas` |
| `bet_voided` | bet: pending→voided | espectador (stake devuelto) | `chime` | `/apuestas` |
| `bet_open` | match: scheduled_at_start NULL→set | **todos los spectator** | `chime` | `/partido/{id}` |
| `match_scheduled` | ídem | dueños de ambos equipos | `chime` | `/mis-partidos` |
| `match_phase` | match: status→`open` (READY) o →`lineup` | dueños de ambos equipos | `chime` | `/partido/{id}` |
| `match_result` | match: winner NULL→set | dueños de ambos equipos | `chime` | `/partido/{id}` |

El sonido **solo suena en la llegada** (no al abrir el panel). El tap/pop de la UI ya lo
cubre el `SoundProvider` global. Todo respeta el mute del sitio (`isSoundMuted`).

---

## 5. UI — especificación compacta (v2, corrige "está enorme")

### Campana (usuarios)
- Botón circular **36×36** (antes 42), icono 16px, misma píldora neón que "Ingresar".
- Badge: contador ≤9 (si no, "9+"), pop sutil al subir el número.
- **Animación de campana**: al llegar una notificación nueva, el icono oscila
  (`@keyframes notif-ring`, pivote superior, 3 vaivenes decrecientes ~0.9s) + glow.

### Panel (usuarios)
- Ancho **320px** (antes 400), `max-height: min(60vh, 440px)` (antes 560).
- Header compacto de **40px** SIN la imagen gigante de fondo: título + botón "leídas".
- Filas de **~52px**: icono 24px en caja, título 12px (1 línea, ellipsis), cuerpo 11px
  (máx 2 líneas, clamp), hora relativa ("ahora", "5m", "3h", "2d").
- Entrada: fade+slide 8px, 180ms. Scroll interno con scrollbar fina de marca.
- El frame de marca (escudo V) queda reservado para el **banner de visitantes**; en el
  panel vive como detalle: hairline superior con gradiente fucsia + escudo mini opcional.

### Banner de visitantes
- Ancho **min(440px, calc(100vw − 32px))** (antes 620) → altura ≈150px (antes ≈210).
- Sigue usando el frame neón adjunto (mix-blend-mode: screen, el negro desaparece).
- Kicker con nombre de edición + estado de inscripciones; título grande con el número
  resaltado; CTA solo si la inscripción está abierta y queda lugar.
- Descartable (X) con memoria en `localStorage` (`vertigo-slots-banner-dismissed`).

### Posicionamiento
- `.notif-root`: `fixed top 84px right 16px z-98` (debajo de la píldora de sesión).
- Banner: `fixed bottom 18px center z-97`.

---

## 6. Entrega: Realtime + respaldo

1. **Realtime**: suscripción `postgres_changes` (INSERT) filtrada por
   `account_id=eq.{id}` con el browser client (`getSupabaseBrowser`). Al insert:
   prepend a la lista, unread+1, sonido según tipo, campana oscila.
2. **Polling de respaldo**: cada 45s y al volver el foco — reconcilia si el socket
   murió. Deduplicación por `id`.
3. La primera carga **no suena** (solo llegadas posteriores al montaje).

---

## 7. API

- `GET /api/notifications` → `{ authenticated, accountId?, role?, displayName?,
  notifications[30], unread }`. `accountId` permite filtrar el canal realtime.
- `POST /api/notifications` → `{ all: true }` o `{ id }` → `read_at = now()`.
  Siempre filtra por la cuenta de la sesión (nunca por un id del body).

---

## 8. Roadmap

| # | Fase | Estado |
|---|------|--------|
| 1 | Tabla + RLS + índices (migración base) | ✅ aplicada |
| 2 | Triggers bet settled / match scheduled / match finished | ✅ aplicados y probados (rollback) |
| 3 | API GET/POST | ✅ |
| 4 | Campana + panel + banner de visitantes | ✅ |
| 5 | **Rediseño compacto** (v2) + sonidos + campana animada | 🔨 esta iteración |
| 6 | **Trigger de fases** (READY abierta, lineup) | 🔨 esta iteración |
| 7 | **Realtime** + polling de respaldo | 🔨 esta iteración |
| 8 | Preferencias por usuario (silenciar tipos) | ⏳ futuro |
| 9 | Email/push como canal secundario (Resend ya está) | ⏳ futuro |
| 10 | Página `/notificaciones` con historial completo | ⏳ futuro |

---

## 9. Testing

- **Triggers**: transacción con `ROLLBACK` — simular settlement/schedule/finish y
  contar inserts. Sin residuos.
- **Componente**: preview del navegador — campana, panel, badge, animación, banner.
- **Typecheck**: `npm run type-check` en cada fase.
- **Realtime**: insert manual service-role → campana suena sin recargar.

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Realtime cae / socket muerto | Polling 45s reconcilia siempre |
| Ráfaga de inserts (16 llaves programadas) | Un sonido por tanda (throttle 1.5s), badge suma |
| Panel enorme en mobile | Ancho `calc(100vw−24px)`, banner se achica solo |
| Notificaciones huérfanas | FK CASCADE desde account |
| Sonido molesto | Respeta mute global del sitio; volumen discreto del motor |
