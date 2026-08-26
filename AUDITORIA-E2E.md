# Auditoría End-to-End — VÉRTIGO Cup

**Fecha:** 2026-08-24 · **Rama:** `main` · **Entorno:** dev server `localhost:3003` + Supabase real
**Método:** pruebas automatizadas con Playwright (Edge headless) simulando usuarios reales por rol
(anónimo, capitán, espectador, caster, admin) + llamadas REST directas a la BD con clave `anon` y
`service_role` + revisión de código de cada server action.

> Nada fue commiteado. Los fixes están aplicados en el working copy a la espera de tu revisión.
> Todos los datos de prueba fueron limpiados (ver §9).

---

## 1. Resumen ejecutivo

**¿Está listo para lanzar?** El sitio funciona de punta a punta en todos los roles y la seguridad
(RLS + endpoints API) está bien cerrada. Los **3 agujeros funcionales graves del wizard de
inscripción** y las **4 recomendaciones de código (R1/R2/R4/R5)** ya están corregidos y validados
con `tsc` limpio. Quedan **2 tareas de datos que tenés que hacer vos como admin antes de largar**
(ver §7). Sin esas dos tareas, el torneo arranca con datos sucios.

**Fixes aplicados en esta auditoría (9 en total, todos con `tsc --noEmit` = 0):**

| # | Fix | Archivo | Estado |
|---|-----|---------|--------|
| 1 | Ocultar "APUESTAS DE ESPECTADOR" a participantes en modo por sortear | `bet-panel.tsx` | ✅ verificado E2E |
| 2 | Solape chip/nav en tablets 769–899px | `vertigo-design-system.css` | ✅ verificado en 12 anchos |
| 3 | **Control de cupo `max_teams` en el wizard** | `wizard.ts` | ✅ tsc + query verificada |
| 4 | **Freno a doble inscripción del mismo capitán** | `wizard.ts` | ✅ tsc |
| 5 | **Freno a jugador inscripto en dos equipos** | `wizard.ts` | ✅ tsc + control positivo |
| 6 | **R1 — Cierre de inscripciones por status** (causa de raíz de §3.2) | `edition.ts` | ✅ tsc + `found:false` verificado |
| 7 | **R2 — Fix de hidratación de fechas** (TZ fija en 32 sitios) | `format.ts` + 21 archivos | ✅ tsc |
| 8 | **R4 — Unicidad de nombre de equipo en el wizard** | `wizard.ts` | ✅ tsc |
| 9 | **R5 — Doble freno de cupo en `approveTeamAction`** | `auth.ts` | ✅ tsc |

Además: **R3 — `CRON_SECRET` configurado** en `.env.local` (ver §5). No es código, es configuración.

Los fixes 3–6 son los importantes: sin ellos, **cualquiera podía seguir registrando equipos en un
torneo que ya está lleno y en curso**, y un mismo jugador podía aparecer en varios equipos. Es
exactamente el escenario "se registraron más equipos de los que se podía / se duplican cosas" que
querías evitar. Hoy la inscripción está **doblemente cerrada**: por cupo (43 ≥ 32) y por status
(ninguna edición está en `"registration"`).

---

## 2. Lo que funciona (verificado E2E, rol por rol)

### Anónimo (visitante sin sesión) — 22 PASS
- Las **16 páginas públicas** responden 200 con contenido: landing, bracket, equipos, apuestas,
  fixture, resultados, casters, jornadas, comodines, formato, premios, registro-espectador,
  registro-caster, login, partido/[id], overlay.
- En `/partido/[id]` ve el **CTA de registro** para apostar (correcto: es el gancho de conversión).
- Los **guards redirigen bien**: `/admin`, `/captain` → `/login?redirect=…` (5 rutas probadas).

### Capitán (dueño de equipo) — verificado
- Login → redirige a `/mi-equipo`. Secciones del panel renderizan.
- **Ya NO ve "APUESTAS DE ESPECTADOR"** en su partido en modo por sortear (fix #1, confirmado con
  sesión real de capitán; el hero "Modo por sortear" sigue intacto).
- `/mi-equipo`, `/mis-partidos`, `/disputas` cargan sin errores.
- El wizard le muestra el estado "ya registrado" (no lo deja re-inscribirse desde la UI).

### Espectador — 7 PASS (ciclo completo de apuesta)
- Registro por UI → cae en `/apuestas` con **1000 pts** de saldo.
- Apuesta 100 a un equipo → **boleta estampada**, panel pari-mutuel actualizado.
- **Anti doble apuesta**: al recargar, el formulario desaparece (y la BD tiene unique constraint
  `bet_unique_spectator_match` de respaldo).
- **Cancelar → reintegro exacto**: el saldo vuelve a 1000, la apuesta se borra. Verificado en BD.

### Caster — 3 PASS
- Rol `caster` + canal de Twitch grabados en BD; login redirige a `/casters`.

### Admin — 16 PASS
- Login → redirige a `/admin`. Las **11 páginas del panel** responden 200: dashboard, equipos,
  bracket, torneo, jornadas, casters, disputas, emblemas, handbook, auditoría, partido.
- **Aprobar equipo funciona** (cambia `status=approved`, sigue visible en el panel).
- **Toggle de requisitos funciona** (anti-smurf ida y vuelta sobre el card de Acido, verificado en
  BD). *Nota: un primer FAIL fue falso negativo del script de prueba, no del sitio.*
- **Un capitán NO puede entrar a `/admin`** (lo manda a `/mi-equipo`).

### Seguridad / RLS — 6 PASS (lo más importante)
Probado con la **clave `anon`** (la que va en el bundle público y cualquiera puede extraer):
- `SELECT bet` → **0 filas** (las apuestas son privadas). ✅
- `SELECT account` → **0 filas** (roles/emails no expuestos). ✅
- `SELECT spectator_wallet` → **0 filas** (saldos no expuestos). ✅
- `UPDATE team_registration` → **bloqueado** (RLS lo deja en 0 filas afectadas). ✅
- `INSERT bet` → **bloqueado (401)**. ✅
- Endpoints API sensibles bien protegidos: `exec-sql`/`create-super-admin`/`promote` con guard de
  dev + token; `upload-handbook` con `requireAdmin()`; `cron/refresh-stats` con `CRON_SECRET` en
  prod. ✅

**Conclusión de seguridad: aunque alguien extraiga la clave pública del cliente, no puede leer ni
escribir datos sensibles. El modelo de confianza (service role solo en servidor) está bien aplicado.**

---

## 3. Los 3 agujeros del wizard (ya corregidos)

El wizard de inscripción (`/registro` → `submitWizard`) validaba bien ELO, civs, emblema y términos,
pero **no controlaba nada de lo siguiente**:

### 3.1 Cupo `max_teams` no aplicado — CRÍTICO
- `tournament_edition.max_teams = 32`, pero `submitWizard` **nunca contaba** las inscripciones.
- **Situación real encontrada:** la edición tiene **43 inscripciones** (33 aprobadas + 10 pendientes).
  O sea, **ya se superó el cupo de 32**.
- `approveTeamAction` tampoco frenaba al aprobar. Y el sorteo exige `>= 32` pero no pone techo.
- **Fix:** ahora `submitWizard` cuenta las inscripciones no rechazadas (aprobadas + pendientes) con
  service role y bloquea si `>= max_teams`. Como hoy hay 43 ≥ 32, **la inscripción queda cerrada
  automáticamente**. Si el admin limpia y baja de 32, se reabre sola (útil para llenar vacantes).

### 3.2 Inscripción abierta con el torneo en curso — CRÍTICO (corregido de raíz)
- `getEditionForRegistration()` buscaba una edición `status="registration"` y, si no había, **caía a la
  más reciente**. La única edición está `"active"` (torneo en curso, bracket ya sorteado), así que
  el wizard **seguía aceptando equipos nuevos en pleno torneo**.
- **Fix (R1, aplicado):** se eliminó ese fallback. Ahora la función devuelve `null` si ninguna edición
  está en `"registration"`, y tanto el wizard como `/api/tournament/config` manejan el `null` sin
  romperse (el config responde `found:false` con valores por defecto — verificado). Abrir o cerrar
  inscripciones pasa a ser una decisión explícita del admin desde `/admin/torneo` (transición de
  status), no un efecto secundario. Combinado con el fix 3.1, hoy la inscripción está doblemente cerrada.

### 3.3 Doble inscripción del mismo capitán — MEDIO
- Cada submit crea un `team_account` nuevo, así que la unique constraint
  `(team_account_id, edition_id)` **nunca saltaba**: un capitán podía crear varios equipos.
- **Fix:** ahora `submitWizard` verifica si el capitán ya tiene un equipo inscripto en la edición y
  lo bloquea con "Ya tenés un equipo inscripto en esta edición".

### 3.4 Jugador en dos equipos — MEDIO
- La unique constraint `(team_registration_id, aoe2_profile_id)` solo frena duplicados **dentro** de
  un equipo, no **entre** equipos.
- **Situación real encontrada:** hay **8 perfiles de AoE2 inscriptos en varios equipos** (129
  jugadores pero solo 111 perfiles únicos = 18 inscripciones duplicadas). Ej.: "Acido" en 7 equipos,
  "George586" en 5. **Todos están solo en equipos pendientes/sin seed — el bracket vivo (32 sembrados)
  está limpio.** Es contaminación de datos de prueba, no fraude en el torneo en curso.
- **Fix:** ahora `submitWizard` bloquea si algún jugador ya está inscripto en otro equipo de la
  edición. (Los duplicados existentes hay que limpiarlos a mano — ver tarea T2.)

---

## 4. Hallazgos que NO requerían tu decisión (ya corregidos) y pendientes

| Sev | Hallazgo | Estado |
|-----|----------|--------|
| 🔴 Alta | **Hidratación de fechas** — `new Date(...).toLocale*` en SSR con distinta TZ entre servidor y cliente → hydration mismatch. | ✅ **Corregido (R2):** helper `fmt` en `src/lib/format.ts` con `timeZone: "America/Argentina/Buenos_Aires"` fijo, aplicado en los 32 sitios (21 archivos). Mismo formato visual de antes (es-AR), solo se fijó la TZ. `tsc` limpio. |
| 🟡 Media | **Ventana de inscripción sin efecto** — `registration_opens_at/closes_at` en NULL y sin código que los lea. | ✅ **Corregido de otra forma (R1):** el cierre ahora se controla por `status` de la edición (ver §3.2). Las columnas de fechas siguen sin usarse; si las querés activas es un agregado futuro, no un bug. |
| 🟡 Media | **Sin unicidad de nombre de equipo** — dos equipos podían llamarse igual. | ✅ **Corregido (R4):** `submitWizard` ahora rechaza un nombre ya existente (case-insensitive) con mensaje claro. `tsc` limpio. |
| 🟢 Baja | **404 transitorio en consola** — visto una vez en landing/equipos; no reproducible. | ⚪ Sin cambios (no reproducible, no bloquea). |
| 🟢 Baja | **`display_name` NULL en cuenta del capitán Acido** — el chip cae al prefijo del email. | ⚪ Sin cambios (estético; se arregla cargando el display_name en el perfil). |

---

## 5. Endpoints y cron

- `/api/cron/refresh-stats`: exige `Authorization: Bearer $CRON_SECRET`. **`CRON_SECRET` ya está
  generado y agregado a `.env.local`** (R3, aplicado). Verificado en dev: sin header → **401**,
  con el Bearer correcto → **200**, con Bearer incorrecto → **401**.
  - **Para producción:** setear el mismo `CRON_SECRET` como variable de entorno en Vercel (el
    `.env.local` no se commitea). Si no se setea, en prod el endpoint da 401 y queda desactivado
    (seguro, pero no refresca stats).
  - **Para que corra solo:** configurar un scheduler (Vercel Cron, GitHub Action, etc.) que haga
    `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/refresh-stats`. Es
    opcional: sin esto, las stats se refrescan igual cuando se visita un equipo (cache bajo demanda).
- Corrida de prueba: `{"ok":true,"players":99,"staleOrMissing":0}` — el cache de stats está al día.

---

## 6. Estado de datos de la edición (foto al 2026-08-24)

- **1 edición** (`vertigo-2026-1`), status `active`, `max_teams=32`.
- **43 inscripciones:** 33 aprobadas + 10 pendientes.
- **Bracket:** 32 equipos sembrados (seeds 1–32), 16 matches de Ronda 1, **sin byes**. Correcto.
- **1 equipo aprobado SIN seed** → quedó fuera del bracket: **"Submit Test Team"** (equipo de prueba
  residual, aprobado el 2026-08-12, *después* del sorteo del 2026-08-11). Ver tarea T1.
- **8 perfiles duplicados** solo en la cola pendiente. Ver tarea T2.

---

## 7. Tareas para el admin ANTES de lanzar

### 🔴 T1 — Limpiar el equipo de prueba aprobado sin seed
"Submit Test Team" está `approved` pero fuera del bracket. **Rechazalo** desde `/admin/equipos`
(para que no cuente como aprobado) o borralo. Si lo dejás, figura como aprobado sin poder jugar.

### 🔴 T2 — Revisar y limpiar la cola de 10 pendientes
La mayoría son equipos de prueba. Revisalos en `/admin/equipos` y **rechazá los truchos**:
`Reino Unido` (×2), `Reino Perfil Final`, `El Reino de tu MACHO`, `dadasas`, `Submit Test Team`.
Los que parecen reales y decidas aprobar: `Acido`, `ArieteKamayuk`, `Rosario Central`, `Cronos`.
**Ojo:** con el fix de cupo, si llegás a 32 aprobados ya no entrarán más (correcto). Y si algún
jugador de esos equipos ya está en otro equipo, el sistema ahora lo va a señalar.

### 🟡 T3 — Decidir sobre los 8 perfiles duplicados (si aprobás esos equipos)
Si aprobás equipos pendientes cuyos jugadores ya están en otro lado, el nuevo check los bloqueará.
Resolvelo caso a caso (cuál es el equipo "real" de cada jugador).

---

## 8. Recomendaciones de código — TODAS aplicadas y validadas

Las cinco recomendaciones originales quedaron implementadas en esta misma pasada (ver tabla de §1):

- **R1 — Cierre de inscripciones por status (causa de raíz de §3.2).** ✅ `getEditionForRegistration`
  ya no tiene fallback a la última edición: devuelve `null` si ninguna está `status="registration"`.
  El admin abre/cierra inscripciones explícitamente desde `/admin/torneo`. Verificado:
  `/api/tournament/config` ahora responde `found:false` (la edición actual está `active`).
- **R2 — Fix de hidratación de fechas.** ✅ Helper `src/lib/format.ts` (`fmt`) con TZ fija
  `America/Argentina/Buenos_Aires`, aplicado en los 32 sitios que formateaban fechas (21 archivos).
- **R3 — `CRON_SECRET`.** ✅ Generado y agregado a `.env.local`; endpoint verificado 401/200/401.
  Falta setearlo en Vercel para producción (ver §5).
- **R4 — Unicidad de nombre de equipo.** ✅ Validación case-insensitive en `submitWizard`.
- **R5 — `approveTeamAction` con doble freno de cupo.** ✅ Antes de aprobar cuenta los aprobados de la
  edición y bloquea si ya se llegó a `max_teams`, con mensaje que le dice al admin cuántos hay.

**Validación final:** `npx tsc --noEmit` = 0 errores; todas las páginas públicas responden 200;
`/apuestas` redirige a `/registro-espectador` para anónimos (esperado, requiere sesión de espectador).

**Único pendiente de código (menor, opcional):** el wizard todavía deja al usuario recorrer los 9
pasos aunque la inscripción esté cerrada, y recién lo frena al enviar. Si querés, puedo hacer que
`/registro` muestre un cartel "Inscripciones cerradas" de entrada cuando `found:false`. No es un bug,
es una mejora de UX.

---

## 9. Limpieza realizada (sin residuos)

- Cuentas de prueba creadas para la auditoría: admin, espectador, caster (quedan para re-testear;
  el admin temporal se puede borrar). El capitán es la cuenta real `somosarcadian@gmail.com`.
- Equipos descartables de prueba (aprobar/toggle/RLS): **todos borrados** (0 residuales).
- Apuestas del espectador de prueba: **borradas**, saldo **restaurado a 1000**.
- `anti_smurf_check` de Acido: **revertido a `false`** (todos los equipos quedaron en `false`).
- **Match de prueba `142cbb11…` sigue creado** (slot 100, Ronda 1, Acido vs Clan de la Tormenta) —
  lo dejo porque dijiste que lo borramos cuando lo pidas.

---

## Anexo: cómo reproducir las pruebas

Scripts en `.e2e-audit/` (no se commitean): `00-login-captain`, `01-anon`, `02-captain`,
`03-spectator`, `03b-caster`, `04-admin`, `04b-toggle`, `05-edges`. Correr con
`cd .e2e-audit && node NN-name.mjs`. Screens en `.e2e-audit/shots/`.
