# VÉRTIGO Cup — Especificación Técnica y Funcional

> **Documento maestro de requirements** — fuente única de verdad para todo el desarrollo.
> Última actualización: 2026-08-08
> Estado: EN DESARROLLO (MVP Fase 1)

---

## 0. Resumen Ejecutivo

**VÉRTIGO** es una plataforma web para organizar torneos de Age of Empires II con una mecánica única: las partidas se sortean con una ruleta animada **15 minutos antes** de jugarse. El nombre "VÉRTIGO" refiere al vértigo de no saber qué te va a tocar hasta el último momento.

- **Equipos**: 32, de 3 jugadores cada uno.
- **Formato**: Single Elimination (5 rondas: 32→16→8→4→2→1). Esta edición es eliminatoria; futuras ediciones pueden tener otros formatos.
- **Stack**: Next.js 16 + Supabase (Postgres + Auth + Realtime + Storage) + Drizzle ORM + Vercel.
- **Branding**: fondo casi negro, premium sobrio medieval, tipografías Butler + Oswald, cero glow masivo.
- **Multi-edición**: el sistema soporta múltiples ediciones del torneo (recurrente).

---

## 1. Stack Tecnológico

| Capa | Tecnología | Razón |
|---|---|---|
| Framework | Next.js 16 (App Router, RSC, Server Actions) | Server Actions para mutations del admin sin API boilerplate. |
| DB | Postgres (Supabase) | RLS, JSONB, triggers, `SELECT FOR UPDATE`. |
| ORM | Drizzle | Edge-friendly, SQL-first, mejor DX en Server Components. |
| Auth | Supabase Auth | Roles via `app_metadata`: `owner`, `captain`, `player`, `admin`, `super_admin`, `caster`. |
| Realtime | Supabase Realtime | `postgres_changes` + `broadcast` + `presence`. |
| Storage | Supabase Storage | PDFs handbook, emblemas, screenshots disputes, replays. |
| Animación | Framer Motion + CSS 3D (basado en repo VERTIGO original) | Para ruleta + memotest flip + microdetalles. |
| Bracket | SVG propio (~150 LOC motor SE) | Las libs existentes no soportan sorteo anidado. |
| AoE2 data | Backend proxy a `data.aoe2companion.com` | Cache Redis/Postgres, TTL 30-60 min, throttle 16 req/10s. |
| Twitch/YouTube/Kick | APIs oficiales + embeds | Filtros por caster registrado. |
| Hosting | Vercel + Supabase cloud | Deploy nativo Next.js 16. |

---

## 2. Branding y Estética

### 2.1 Principio rector
**"Premium sobrio medieval" — NO cyberpunk, NO glow masivo, NO neon saturado.**

Cada elemento visual debe responder: "¿esto se ve premium o ruidoso?". Si es ruidoso, se saca.

### 2.2 Paleta de colores

| Elemento | Hex | Uso |
|---|---|---|
| Fondo principal | `#08080A` | Casi negro, fondo base del sitio. |
| Fondo elevado | `#0C0C0F` | Cards, paneles, modales. |
| Fondo hover | `#14141A` | Estados hover sutiles. |
| Borde sutil | `#1F1F26` | Bordes 1px entre secciones. |
| Borde dorado | `#D4AF37` | Ornamentos, headers de cards premium. |
| Texto primario | `#FFF8E7` | Blanco roto (no puro), cuerpo y títulos. |
| Texto secundario | `#A0A0A8` | Gris claro para metadata. |
| Texto terciario | `#5C5C66` | Gris para placeholders. |
| Acento primario | `#8B2CF5` | Violeta — solo acentos puntuales, sin glow. |
| Acento crítico | `#E63946` | Rojo carmesí — alertas, errores, "live". |
| Acento éxito | `#22C55E` | Verde — success states. |
| Dorado decorativo | `#D4AF37` | Ornamentos sutiles. |

### 2.3 Tipografías

| Uso | Familia | Peso | Tamaño |
|---|---|---|---|
| Títulos (headlines) | **Butler Free Version** (serif display) | Bold/Black | 32-72px |
| UI (botones, labels, badges) | **Oswald** (sans condensada) | SemiBold 600 | 11-14px, UPPERCASE, letter-spacing +2px |
| Body | **Oswald** Light 300 | 14-16px |
| Numérico (countdown, ELO) | **Oswald** Medium 500 tabular-nums | 24-48px |

### 2.4 Reglas visuales estrictas

- **Prohibido**: glows masivos, neón, drop-shadows de más de 4px blur, gradientes radiales en backgrounds generales.
- **Permitido**: sutiles box-shadows (`0 4px 12px rgba(0,0,0,0.4)`), hovers con transición de color, microanimaciones discretas (200-300ms ease-out), ornamentos line-art blancos 1px stroke.
- **Vignette**: solo sutil en bordes, no en todo el sitio.
- **Grain noise**: máximo 5% opacidad en backgrounds, blend mode overlay.
- **Dorado**: solo para ornamentos finos (1px borders, separadores, iconos pequeños). No rellenar áreas con dorado.

### 2.5 La Ruleta (UI/UX existente — INTOCABLE estéticamente)

El componente `Roulette` del repo `WEBSITE-VERTIGO` original (carrusel 3D coverflow, capas H/V alternantes, animación RAF, audio Web Audio API, fases MODO→ANTIMETA→FORMATO→MAPA→LLAVE) **se respeta tal cual**. Solo se adapta para integrarse al sitio:
- Scopeo de CSS (sacar clases globales del body).
- Mover `document.body.classList.toggle` a un ref local del wrapper.
- Cargar fonts y assets desde el nuevo proyecto.
- NO cambiar mecánica, animación, audio ni estética del carrusel.

El **post-sorteo split-screen summary** del componente original se respeta — es la pantalla que el stream va a mostrar.

### 2.6 Memotest de Civs (UX nueva)

- **Dorso de tarjetas**: cuadrado squircle (border-radius ~20%), fondo violeta degradado `#8B2CF5` → `#6A0DAD`, logo "II" rojo carmesí `#E63946` gigante centrado, texto "AGE OF EMPIRES" blanco roto arriba/abajo con tracking amplio.
- **Selector**: se mueve tipo slot-machine por encima de la grilla de tarjetas, frena en una, esa tarjeta hace flip 3D y revela la civ.
- **Animación**: flip 3D con Framer Motion, duración ~600ms, ease-out.
- **Sin glow masivo**: solo un sutil box-shadow dorado 1px en la tarjeta activa.

---

## 3. Formato del Torneo

### 3.1 Estructura
- **32 equipos** × 3 jugadores cada uno = 96 jugadores.
- **Single Elimination**: 5 rondas (R1 → Octavos → Cuartos → Semis → Final).
- **Byes**: si no hay 32 exactos, los seeds más altos pasan directo a R2.
- **31 partidos** totales en el bracket principal.

### 3.2 Multi-jornada (configurable por admin)
- Cada LLAVE (match) tiene asignada fecha/hora de inicio y fin.
- Las jornadas se configuran desde el panel admin.
- No hay partidas simultáneas — son secuenciales (evento para stream).
- Los partidos se agendan uno tras otro dentro de una jornada.

### 3.3 Multi-edición
- El sistema soporta varias ediciones del torneo VÉRTIGO.
- Las cuentas de equipo persisten entre ediciones.
- En cada edición los equipos se reinscriben (nombre, frase, emblema pueden cambiar; roster y civs se re-eligen).

---

## 4. Reglas del ELO Cap

- **Tope**: suma de los 3 `maxRating` RM 1v1 históricos de cada jugador ≤ **3500**.
- **Tolerancia**: +20 = máximo absoluto **3520**.
- **Validación**: al cargar cada jugador, vía API de AoE2 Companion (`/api/profiles/{id}?extend=stats`).
- **Snapshot freeze**: el ELO se congela al momento de la inscripción. No se recalcula durante el torneo.
- **Jugadores con ELO oculto** (`shared=false`): se aceptan pero se marcan como "Falta verificación" en panel admin.
- **Configurable desde admin**: cap, tolerancia, campo a usar (`rm_1v1_max` por defecto).
- **Torneos recurrentes**: el ELO cap se aplica de nuevo en cada edición con el ELO actualizado.

---

## 5. Wizard de Inscripción (9 pasos)

### 5.1 Layout: altura fija, sin scroll molesto

```
┌─────────────────────────────────────────────┐
│  [HEADER FIJO: logo + paso X/9 + progreso]   │  ← altura fija
├─────────────────────────────────────────────┤
│  [TÍTULO DEL PASO + descripción breve]       │  ← altura fija
├─────────────────────────────────────────────┤
│                                              │
│  [CONTENIDO DEL PASO]                        │  ← altura fija (viewport - header - title - footer)
│  ← si desborda, scroll interno aquí           │     con scrollbar sutil estilizada
│                                              │
├─────────────────────────────────────────────┤
│  [FOOTER FIJO: Atrás | Siguiente]             │  ← altura fija
└─────────────────────────────────────────────┘
```

- Altura total = `100vh`.
- Header, título y footer nunca se mueven.
- Solo el contenido central puede tener scroll interno si hace falta.

### 5.2 Pasos

1. **Cuenta** — email + password (o login si ya existe).
2. **Datos equipo** — nombre + frase + emblema (de galería predefinida de 50 escudos).
3. **Cargar 3 jugadores** — búsqueda en AoE2 Companion por nombre, selección del candidato correcto, validación de `profile_id`.
4. **Elegir capitán** — uno de los 3 cargados, con ELO check en vivo.
5. **Elegir 9 civs principales** — grid de cartas con flip, de las 40 civs de AoE2.
6. **Elegir 3 civs extra** — para finalistas, mismo grid excluyendo las 9 ya elegidas.
7. **Descargar Handbook PDF** — botón DESCARGAR (subido por admin), bloquea el botón Siguiente hasta que se haga click.
8. **Aceptar Términos** — restream permission + reglas del torneo.
9. **Confirmación** — review final + submit.

### 5.3 Avatares
- **Emblema** = 1 por equipo, lo elige el capitán de la galería (50 escudos subidos por admin).
- **Avatar de usuario** = auto-asignado aleatoriamente de un set de ~12 genéricos (siluetas medievales: caballero, arquero, monje, etc.) — el usuario no lo elige.

---

## 6. Flujo Completo de una LLAVE (Match)

### 6.1 Diagrama de estados

```
ADMIN agenda LLAVE (fecha/hora inicio+fin, modificable)
            │
            ▼
LLEGA LA HORA → LLAVE "se abre" en dashboard de ambos equipos
            │
            ▼
═══ READY #1 ═══
   EQUIPO A: [LISTO]   EQUIPO B: [LISTO]   ← ambos deben clickear
            │
            ▼ (cuando AMBOS están LISTO)
═══════════ PARTIDA N (1, 2 o 3 si BO3) ═══════════
   RULETA GIRA (5 fases en P1 / 4 fases en P2-P3):
   1. MODO (Antimeta, Guerreras Imperiales, Muerte Súbita, Regicida...)
   2. ANTIMETA (si MODO=Antimeta, sub-variante)
   3. FORMATO (1v1, 2v2, 3v3, FUSIÓN)
   4. MAPA
   5. LLAVE (BO3 o BO1/Deathmatch) ← SOLO PARTIDA 1
   
   MEMOTEST DE CIVS (según FORMATO):
   - 1v1 → 1 civ por equipo
   - 2v2 → 2 civs por equipo (sin repetir intra-equipo)
   - 3v3 → 3 civs por equipo (sin repetir intra-equipo)
   - FUSIÓN → 1 civ por equipo (compartida)
   
   COMMIT-REVEAL fairness (SHA-256) + log inmutable
   
   POST-SORTEO SUMMARY (split-screen, respeta UX actual de la ruleta)
            │
            ▼
═══ DECLARACIÓN DE LINEUP (si NO es 3v3 ni FUSIÓN) ═══
   Cada equipo declara quiénes juegan (1 o 2 jugadores)
            │
            ▼
═══ READY #2 ═══
   Ambos equipos confirman lineup completo con [LISTO]
   (Solo cuando ambos confirmaron → arranca timer de comodines)
            │
            ▼
═══ VENTANA DE COMODINES (5 min, timer en UI) ═══
   Disponibles (POR TORNEO, todos admin-configurables):
   - Re-girar (default 2) ← re-gira 1 fase o civs
   - Anular jugador (default 1) ← solo 1v1/2v2
   - Elegir rival (default 1) ← solo 1v1/2v2, MUTUAMENTE EXCLUYENTE con Anular
   - INVOCAR PRO (default 1, NO disponible en ventana — se usa durante partida)
   
   ORDEN: por orden de ejecución (primero llega, primero se ejecuta)
   TIMER SE PAUSA durante ejecución de comodín
            │
            ▼
═══ PARTIDA N EN JUEGO (AoE2) ═══
   Durante partida: INVOCAR PRO (escribir "CARTA PRO" en chat del sitio)
   Admin puede quitar el comodín si el equipo no lo marca como ejecutado
            │
            ▼
TERMINA PARTIDA N → se carga resultado
   ┌── Si BO1 (Deathmatch) → GANADOR AVANZA, fin llave
   ├── Si BO3 y 2-0 → GANADOR AVANZA, fin llave
   └── Si BO3 y 1-1 → ir a PARTIDA N+1 (vuelve a RULETA)
```

### 6.2 Estados de un Match

```
scheduled → open → drawing → lineup → comodin_window → in_progress → finished
                │                                                 │
                └─→ forfeit (auto, timeout)                  disputed → finished
                                                                  ↑
                                                          (super_admin resuelve)
```

| Estado | Significado | Quién lo dispara |
|---|---|---|
| `scheduled` | Llave creada, esperando horario | Sistema (al generar bracket) |
| `open` | Llegó la hora, esperando READY #1 de ambos | Sistema (cron) |
| `drawing` | Sorteo en curso | Admin (gira ruleta) |
| `lineup` | Sorteo listo, esperando declaración de lineup | Sistema (post-ruleta) |
| `comodin_window` | 5 min para usar comodines | Sistema (post-ready #2) |
| `in_progress` | Partida en juego | Árbitro |
| `finished` | Resultado cargado, gana avanza | Árbitro/Sistema |
| `disputed` | Reclamo abierto | Capitán |
| `forfeit` | Ausencia | Sistema (timeout) |
| `cancelled` | Rollback | Super_admin |

---

## 7. Comodines (Detallados)

### 7.1 Inventario por equipo por edición (admin-configurable)

| Comodín | Default | Restricciones |
|---|---|---|
| Re-girar | 2 por torneo | Re-gira 1 fase de la ruleta o las civs |
| Anular jugador | 1 por torneo | Solo 1v1/2v2. Mutuamente excluyente con Elegir rival en misma llave |
| Elegir rival | 1 por torneo | Solo 1v1/2v2. Mutuamente excluyente con Anular en misma llave |
| INVOCAR PRO | 1 por torneo | Se usa DURANTE la partida, no en ventana |

### 7.2 Re-girar
- El equipo ejecuta el comodín y selecciona qué fase re-girar: MODO, ANTIMETA, FORMATO, MAPA o CIVS.
- Se ejecuta una animación atractiva (la ruleta o memotest gira de nuevo solo para esa fase).
- El admin debe tocar "Girar" para confirmar (control de stream).
- El resultado nuevo puede ser el mismo que el anterior (no se excluye).

### 7.3 Anular jugador
- Solo aplica en 1v1 y 2v2 (no 3v3 ni FUSIÓN).
- El equipo que ejecuta elige un jugador del rival que NO pueda jugar esa llave.
- El rival debe completar su lineup con los jugadores restantes.
- Si es 1v1 y se anula al único jugador disponible → forfeit (caso edge).

### 7.4 Elegir rival
- Solo aplica en 1v1 y 2v2 (no 3v3 ni FUSIÓN).
- Mutuamente excluyente con Anular en la misma llave.
- El equipo que ejecuta elige un jugador del rival que **debe** jugar esa llave (forzado).
- Útil cuando el rival tiene un jugador fuerte y querés obligarlo a jugar vs tu especialista.

### 7.5 INVOCAR PRO
- Se activa DURANTE la partida escribiendo "CARTA PRO" en el chat del sitio (no chat de AoE2 ni Twitch).
- Un PRO asignado por el torneo da 5 minutos de consejos al equipo.
- Admin puede quitar el comodín si el equipo no lo marca como ejecutado en la página.
- Admin-configurable: cantidad por torneo, duración de los consejos.

### 7.6 Orden de ejecución
- Por orden de llegada: primero llega, primero se ejecuta.
- Timer de 5 min se pausa durante ejecución de un comodín.
- Se retoma luego de su ejecución.
- Si ambos equipos quieren usar comodines simultáneamente, se encolan.

---

## 8. Fairness: Commit-Reveal SHA-256

El riesgo existencial del torneo es que un admin amañe el sorteo. Se mitiga con **commit-reveal**:

### 8.1 Esquema

```
FASE 1 — COMMIT (antes de girar):
   seed     = CSPRNG 32 bytes (crypto.randomBytes en Node)
   public_inputs = { match_id, preset_version, timestamp, admin_id }
   commit_hash = SHA256( seed || public_inputs )
   → persistir commit_hash (público, visible en UI de jugadores)
   → NO persistir seed todavía (o persistir encriptado)

FASE 2 — SPIN:
   ruleta animada gira (resultado visual = f(seed), determinista)

FASE 3 — REVEAL (después de girar):
   publicar seed + public_inputs
   verificar: SHA256( seed || public_inputs ) == commit_hash
   → si coincide, el resultado es válido (auditable)
   → guardar DRAW_AUDIT_LOG con la verificación
```

### 8.2 Reglas operativas
- **Grabación en video** del giro de ruleta (stream del torneo).
- **Log inmutable append-only** con hash encadenado (cada log incluye hash del anterior).
- **Timeout commit→reveal** de máximo 5 minutos (admin-configurable).
- **Preset versionado** (frozen al iniciar la edición) — el commit referencia `preset_version`.
- **Página pública** `/sorteos/[id]/verificar` donde cualquiera puede verificar el hash.

---

## 9. AoE2 Companion Integration

### 9.1 API
- **Endpoint**: `GET https://data.aoe2companion.com/api/profiles/{profile_id}?extend=stats`
- **Sin auth**, CORS abierto, rate limit **16 req/10s por IP**.
- **Identificador**: `profile_id` numérico (universal, no cambia con renombramientos).

### 9.2 Arquitectura: Backend Proxy con Cache

```
Frontend VÉRTIGO → Backend propio (Server Action) → data.aoe2companion.com
                       ↓
                   Cache Postgres (TTL 30-60 min)
                   Throttle ≤16 req/10s
                   Header User-Agent: VERTIGO-Cup/1.0
```

### 9.3 Datos a obtener
- `name`, `country`, `clan`, `platform`, `verified`
- `leaderboards[].maxRating` (para ELO cap)
- `leaderboards[].rating` (actual)
- `leaderboards[].rank`, `rankCountry`
- `stats[].civ[]` (winrate por civ)
- `linkedProfiles[]` (anti-smurf)

### 9.4 Anti-smurf básico
- Al cargar un jugador, se chequean `linkedProfiles[]`.
- Si el jugador tiene cuentas vinculadas no declaradas → flag en panel admin.

---

## 10. Casting / Twitch / YouTube / Kick

### 10.1 Canales oficiales
- 1 canal principal de Twitch
- 1 canal de YouTube
- 1 canal de Kick

### 10.2 Casters community
- Cualquiera puede registrarse como CASTER en el sitio.
- Panel admin aprueba/rechaza.
- Tiers: `official`, `secondary`, `community`.

### 10.3 Embeds
- Embed del stream en la página del partido.
- Solo aparece si se activa desde admin panel y está configurado.
- Restream permission: se acepta en los términos al inscribir equipo.

---

## 11. Configuración Admin (Todo Configurable)

El admin puede configurar desde el panel:

| Categoría | Items |
|---|---|
| **Edición del torneo** | Nombre, slug, fechas, banner, status, canales Twitch/YouTube/Kick |
| **ELO cap** | Cap máximo (default 3500), tolerancia (default +20), campo a usar |
| **Equipos** | Tamaño del equipo (default 3), máximo de equipos (default 32), reinscripción entre ediciones |
| **Civs** | Civs base por equipo (default 9), civs extra para finalistas (default 3), pool de civs disponibles |
| **Formato** | Formato del bracket (SE / grupos / Swiss — para futuras ediciones), byes automáticos |
| **Comodines** | Cantidad de Re-girar, Anular, Elegir rival, INVOCAR PRO (todos configurables), duración ventana comodines, duración INVOCAR PRO |
| **Sorteo** | Duración animación ruleta, duración memotest, enable/disable commit-reveal |
| **Jornadas** | Crear/editar/mover jornadas, asignar llaves, horarios inicio/fin, mover llaves entre jornadas |
| **Emblemas** | Subir/borrar/activar emblemas, asignar categoría |
| **Handbook** | Subir PDF del handbook (bloquea aceptar T&C hasta descargar) |
| **Casters** | Aprobar/rechazar, asignar tier, asignar caster a llave, activar/desactivar embed |
| **Términos** | Texto de T&C editable, Restream permission required |
| **Anti-smurf** | Activar/desactivar check, reglas de validación |
| **Fairness** | Timeout commit-reveal, activar/desactivar, activar/desactivar log público |

Todo esto vive en una tabla `tournament_config` (clave-valor JSON) por edición, con defaults saneados.

---

## 12. Modelo de Datos (Resumen)

### 12.1 Entidades principales

```
account (Supabase Auth)
  ├─ id (uuid, PK)
  ├─ email
  ├─ role: owner | admin | super_admin | caster
  └─ created_at

team_account (persiste entre ediciones)
  ├─ id (uuid, PK)
  ├─ owner_account_id (FK → account.id)
  ├─ name, tagline
  ├─ emblem_id (FK → emblem.id)
  └─ created_at

tournament_edition
  ├─ id, slug, name, banner_url
  ├─ status: draft | registration | active | finished
  ├─ elo_cap, elo_tolerance, max_rating_field
  ├─ preset_version_id (FK, frozen al iniciar)
  ├─ starts_at, ends_at
  └─ twitch_channel, youtube_channel, kick_channel

preset_version (inmutable una vez congelado)
  ├─ id, version, frozen_at
  ├─ game_modes[], antimeta_modes[], player_modes[]
  ├─ maps[], antimeta_map_pools
  ├─ llave_options[]
  └─ comodin_config (json)

team_registration (1 por equipo por edición)
  ├─ id, team_account_id, tournament_edition_id
  ├─ 9 base_civ_ids[], 3 extra_civ_ids[]
  ├─ elo_freeze_snapshot
  ├─ elo_verification_status: verified | pending | hidden | failed
  ├─ restream_permission_accepted
  ├─ handbook_downloaded_at
  ├─ terms_accepted_at
  ├─ status: pending | approved | rejected
  └─ seed

player_registration (3 por team_registration)
  ├─ id, team_registration_id
  ├─ aoe2_profile_id, aoe2_steam_id
  ├─ display_name, country (snapshots)
  ├─ max_rating_rm_1v1, rating_rm_1v1_current (snapshots)
  ├─ is_captain
  └─ verification_payload (json)

emblem
  ├─ id, name, image_url, category
  └─ is_active

bracket
  ├─ id, tournament_edition_id
  ├─ type: winner | consolation
  └─ rounds_count

round
  ├─ id, bracket_id
  ├─ index, name

match (la LLAVE)
  ├─ id, round_id, slot_index
  ├─ parent_match_a_id, parent_match_b_id
  ├─ team_a_id, team_b_id (nullable)
  ├─ status: scheduled | open | drawing | lineup | comodin_window | in_progress | finished | disputed | forfeit | cancelled
  ├─ scheduled_at_start, scheduled_at_end
  ├─ ready_a_at, ready_b_at (READY #1)
  ├─ ready_lineup_a_at, ready_lineup_b_at (READY #2)
  ├─ format: BO3 | BO1
  ├─ winner_team_id
  └─ stream_caster_id

match_game (cada partida dentro de la llave)
  ├─ id, match_id, game_number (1, 2, 3)
  ├─ status: pending | drawing | lineup | comodin_window | in_progress | finished
  ├─ sorteo_id (FK → roulette_draw.id)
  ├─ lineup_a[], lineup_b[]
  ├─ civs_a[], civs_b[]
  ├─ winner_team_id, replay_url
  └─ started_at, finished_at

roulette_draw (commit-reveal fairness)
  ├─ id, match_game_id, admin_id
  ├─ status: committed | spinning | revealed | published | cancelled
  ├─ commit_hash, revealed_seed
  ├─ public_inputs (json)
  ├─ committed_at, spinning_at, revealed_at
  └─ preset_version_id

draw_result
  ├─ id, draw_id
  ├─ game_mode, antimeta_mode, player_mode
  ├─ map, llave_format
  ├─ civs_a[], civs_b[]
  └─ raw_payload

draw_audit_log (append-only, inmutable)
  ├─ id, draw_id
  ├─ event_type: commit | spin_start | spin_end | reveal | publish | cancel
  ├─ hash_chain
  ├─ actor_account_id
  └─ payload, created_at

comodin_inventory (1 por team_registration)
  ├─ id, team_registration_id
  ├─ reroll_available, anular_available
  ├─ elegir_rival_available, invocar_pro_available
  └─ updated_at

comodin_usage (registro de cada uso)
  ├─ id, comodin_inventory_id
  ├─ match_id, match_game_id
  ├─ comodin_type: reroll | anular | elegir_rival | invocar_pro
  ├─ target_phase (para reroll)
  ├─ target_player_id (para anular/elegir)
  ├─ status: pending | executing | executed | cancelled | revoked
  ├─ requested_at, executed_at, revoked_at
  ├─ executed_by_account_id
  └─ result_payload

caster
  ├─ id, account_id, display_name
  ├─ twitch_channel, youtube_channel, kick_channel
  ├─ tier: official | secondary | community
  └─ approved_at

dispute
  ├─ id, match_id, raised_by_team_id
  ├─ reason, evidence_urls[]
  ├─ status: open | reviewing | resolved | rejected
  ├─ resolution_notes
  └─ resolved_by_super_admin_id

match_schedule
  ├─ match_id (PK, FK → match.id)
  ├─ scheduled_at_start, scheduled_at_end
  ├─ jornada_label
  ├─ modified_by_admin_id
  └─ modified_at

tournament_config (clave-valor JSON por edición)
  ├─ id, tournament_edition_id
  ├─ key, value (json)
  └─ updated_at
```

### 12.2 Constraints críticos

- **UNIQUE (match_id, comodin_type)** WHERE `comodin_type IN ('anular', 'elegir_rival')` AND `status != 'cancelled'` → solo 1 de los dos por llave.
- **CHECK** en `comodin_inventory`: `reroll_available >= 0`, etc.
- **FOREIGN KEY** con `ON DELETE RESTRICT` para no borrar equipos con inscripciones activas.
- **TRIGGER** Postgres: cuando `match.status` cambia a `finished`, propagar ganador al `parent_match` slot correcto.
- **TRIGGER** Postgres: cuando `roulette_draw.status` cambia a `revealed`, actualizar `team_profile` (vista materializada).

---

## 13. Rutas del Sitio

```
(public)
  /                              # landing + countdown
  /torneo                        # bracket público + standings
  /equipos/[id]                  # perfil público del equipo
  /jugadores/[id]                # perfil público del jugador (stats AoE2 Companion)
  /partido/[id]                  # detalle de match: equipos, sorteo, resultado, stream
  /sorteos/[id]/verificar       # página pública de verificación commit-reveal
  /casters                       # lista de casters registrados

(auth)
  /login                         # Supabase Auth
  /registro                      # wizard de inscripción de equipo (9 pasos)

(captain)
  /mi-equipo                     # roster, capitán, civs elegidas
  /mis-partidos                  # próximos partidos + sorteo en vivo
  /disputas                      # abrir reclamo

(admin)
  /admin/torneo                  # crear/editar edición, preset, config
  /admin/equipos                 # aprobar inscripciones, validar perfiles
  /admin/bracket                 # generar bracket, sorteo inicial de llaves
  /admin/partido/[id]            # ABRIR LLAVE + tirar ruleta + cargar resultado
  /admin/auditoria               # logs inmutables, commit-reveal verifications
  /admin/casters                 # aprobar casters, asignar tier
  /admin/emblemas                # subir/borrar emblemas
  /admin/handbook                # subir PDF del handbook
  /admin/jornadas                # configurar jornadas y horarios

(caster)
  /caster/perfil                 # registrar canales
  /caster/asignaciones           # ver llaves asignadas

(overlay)
  /overlay/[match_id]            # widget para OBS Browser Source
```

---

## 14. Plan de Desarrollo por Fases

### Fase 0 — Discovery & Cierre (1 semana) ✅
- Validar dudas con el organizador.
- Congelar preset de la ruleta.
- Diseño UX wireframes.
- **Entregable**: schema DB final + wireframes + preset congelado.

### Fase 1 — MVP (5-7 semanas, 1-2 devs)
**Objetivo**: torneo jugable punta a punta, sin fairness ni Twitch ni disputes.

- Setup proyecto + Supabase + Auth + RLS
- Branding system (paleta + Butler + Oswald + componentes base)
- Wizard de inscripción 9 pasos (con AoE2 Companion integration)
- Validación ELO cap (con snapshot freeze)
- Selector de civs con memotest preview
- Panel admin (CRUD equipos, emblemas, edición)
- Motor SE de 32 + byes + bracket SVG
- Ruleta animada (porte VERTIGO refactorizada, sin fairness aún)
- Memotest animado (flip 3D + selector)
- Flujo de llave: open → ready → draw → lineup → comodin_window → in_progress → finished
- Comodines básicos (reroll, anular, elegir_rival — sin INVOCAR PRO aún)
- Avance automático de ganador al bracket siguiente
- Perfil de equipo + dashboard mobile

**No incluido en MVP**: commit-reveal, overlay OBS, disputes, INVOCAR PRO, Twitch embed, stats, anti-smurf, multi-edición completa.

### Fase 2 — V1 Justicia y Operacional (3-4 semanas)
- Commit-reveal SHA-256 fairness completo
- Log inmutable encadenado + auditoría admin
- Sistema de disputes (modelo + workflow + UI admin)
- INVOCAR PRO completo (chat monitoring + admin revoke)
- Twitch/YouTube/Kick embeds + caster registration
- Overlay OBS (`/overlay/[match_id]?token=...`)
- Anti-smurf básico (`linkedProfiles[]`)
- Disponibilidad horaria por equipo
- Replay uploader obligatorio para cerrar `finished`
- Notificaciones (email + in-app)

### Fase 3 — V2 Engagement (4-6 semanas)
- Stats globales (win rate por civ/mapa, modo más sorteado)
- Copa de consolación (mini-bracket para eliminados R1)
- Pick'em de fans → **implementado** como apuestas de espectadores con puntos: registro libre con 1000 pts de bienvenida, apuesta por ganador de cada llave con monto libre hasta que la llave abre, liquidación pari-mutuel (pozo repartido proporcional entre ganadores), cancelación/re-apuesta mientras esté `scheduled`, reintegro si la llave se cancela, ranking con premio para el mejor apostador (ver `migrations/0004_espectadores_apuestas.sql`, `/apuestas`, `/partido/[id]`)
- Registro libre de casters + moderación admin (tier oficial/secundario/community, aprobar/desaprobar, eliminar)
- Mobile PWA instalable
- Multi-edición completa (varios torneos corriendo)
- Auto-import de replays vía aoe2.net
- Handbook PDF generator dinámico

---

## 15. Riesgos y Mitigaciones (Top 5)

| # | Riesgo | Prob | Impacto | Mitigación |
|---|---|:--:|:--:|---|
| 1 | Admin amañe el sorteo | Media | Crítico | Commit-reveal SHA-256 + log encadenado + grabación de video. |
| 2 | Bug en propagación al bracket siguiente | Media | Crítico | Trigger Postgres + test E2E obligatorio por ronda. |
| 3 | Concurrencia: dos admins abren la misma llave | Media | Alto | `SELECT ... FOR UPDATE` + 409 Conflict. |
| 4 | Sorteo da resultado inválido (1v1 sin jugadores) | Media | Medio | Validación pre-reveal contra preset + roster real. Re-sortear automáticamente. |
| 5 | Carga pico: 32 equipos consultando perfil al publicarse | Alta | Bajo | Cache de RSC + SWR + vista materializada. |

---

## 16. Decisiones de Diseño Confirmadas

| # | Decisión | Status |
|---|---|---|
| 1 | Stack: Next.js 16 + Supabase + Drizzle + Vercel | ✅ Confirmado |
| 2 | Formato: Single Elimination de 32 | ✅ Confirmado (esta edición) |
| 3 | Multi-edición recurrente | ✅ Confirmado |
| 4 | Cuentas por equipo (no por jugador) | ✅ Confirmado |
| 5 | ELO cap 3500 + 20 tolerancia, freeze al inscribir | ✅ Confirmado |
| 6 | Wizard 9 pasos, altura fija, sin scroll molesto | ✅ Confirmado |
| 7 | 9 civs base + 3 extra para finalistas (no se cambian) | ✅ Confirmado |
| 8 | Memotest: dorso AoE2 violeta + flip 3D + selector slot-machine | ✅ Confirmado |
| 9 | Comodines: 4 tipos, configurables, por torneo | ✅ Confirmado |
| 10 | Ventana 5 min comodines post-lineup + READY #2 | ✅ Confirmado |
| 11 | Branding: fondo casi negro, premium sobrio, sin glow masivo | ✅ Confirmado |
| 12 | Tipografías: Butler + Oswald | ✅ Confirmado |
| 13 | Ruleta existente: respeto total, solo scopeo CSS | ✅ Confirmado |
| 14 | Commit-reveal SHA-256 fairness | ✅ Confirmado |
| 15 | AoE2 Companion API con backend proxy + cache | ✅ Confirmado |
| 16 | Mobile-first crítico | ✅ Confirmado |
| 17 | Casting oficial + community, Twitch API integration | ✅ Confirmado |
| 18 | Handbook PDF subido por admin | ✅ Confirmado |
| 19 | Emblemas: 50 escudos subidos por admin | ✅ Confirmado |
| 20 | Avatar de usuario: auto-asignado aleatorio de 12 genéricos | ✅ Confirmado |
| 21 | Todo configurable desde admin panel | ✅ Confirmado |

---

## 17. Análisis del Repo WEBSITE-VERTIGO Original

El repo `Arx88/WEBSITE-VERTIGO` contiene la ruleta original. Resumen del análisis:

### 17.1 Stack del original
- Next.js 16 + React 19 + TypeScript + Tailwind 4 + shadcn/ui
- Prisma + SQLite (instalado pero sin usar)
- next-auth (instalado pero sin configurar)
- next-intl (instalado pero sin configurar)
- ~25 deps muertas (tanstack-query/table, dnd-kit, recharts, etc.)
- 48 componentes shadcn/ui instalados, solo 1 usado

### 17.2 Cómo funciona la ruleta
- **5 fases**: MODO → ANTIMETA → FORMATO → MAPA → LLAVE
- **Carrusel 3D coverflow** (no es pie wheel), capas H/V alternantes
- **Animación**: RAF + CSS 3D transforms, 7-8.5s, 6-9 vueltas, easing `1 - (1-p)^9`
- **Audio**: Web Audio API puro (oscillators + gain), ticks + gong multicapa
- **Configuración**: localStorage + página `/config` con CRUD completo

### 17.3 Integración al nuevo proyecto
- **NO forkear directo** (deuda técnica: 145MB de PNGs, 47 shadcn sin usar, `ignoreBuildErrors: true`, ESLint desactivado, `/api/download` 404).
- **Copiar selectivamente**: `Roulette.tsx`, `config.tsx`, `modes.ts`, `/config/page.tsx`, `globals.css`.
- **Refactorizar**: scopear CSS, sacar body coupling, extraer hooks.
- **Agregar**: pesos por segmento (si se quiere), backend con commit-reveal, persistencia en DB.

---

## 18. Referencias

- Repo ruleta original: https://github.com/Arx88/WEBSITE-VERTIGO
- AoE2 Companion API: https://data.aoe2companion.com/api
- AoE2 Companion docs: https://www.aoe2companion.com/more/api
- World's Edge backend (backup): https://aoe-api.worldsedgelink.com
- aoe2cm.net (inspiración preset): https://aoe2cm.net
- Supabase docs: https://supabase.com/docs
- Drizzle docs: https://orm.drizzle.team
- Next.js 16: https://nextjs.org/blog/next-16

---

**Documento vivo**: este spec se actualiza conforme avanza el desarrollo. Cualquier cambio funcional debe reflejarse acá antes de implementarse.
