# VÉRTIGO Cup — WEBVERTIGOZ

> Plataforma web del torneo VÉRTIGO de Age of Empires II.
> 32 equipos · 3 jugadores cada uno · partidas sorteadas con ruleta 15 minutos antes.

[![Status](https://img.shields.io/badge/status-WIP%20MVP%20Fase%201-D4AF37)]()
[![Stack](https://img.shields.io/badge/stack-Next.js%2016%20%2B%20Supabase%20%2B%20Drizzle-08080A)]()

## ¿Qué es VÉRTIGO?

VÉRTIGO es un torneo de Age of Empires II con una mecánica única: las partidas se sortean con una ruleta animada **15 minutos antes** de jugarse. El nombre "VÉRTIGO" refiere al vértigo de no saber qué te va a tocar hasta el último momento.

### Características principales

- **32 equipos** × 3 jugadores cada uno
- **Single Elimination** (5 rondas: 32→16→8→4→2→1)
- **Ruleta animada** sortea: modo de juego, antimeta, formato (1v1/2v2/3v3/fusión), mapa, formato de llave (BO3/BO1-Deathmatch) y civilizaciones
- **Memotest de civs**: cada equipo elige 9 civs base + 3 extra para finalistas, sorteadas con un memotest animado
- **Comodines**: Re-girar (×2), Anular jugador (×1), Elegir rival (×1), INVOCAR PRO (×1)
- **ELO cap 3500** (suma de los 3 maxRating RM 1v1 históricos) con tolerancia +20
- **Commit-reveal fairness** SHA-256 para sorteos auditables criptográficamente
- **Multi-edición recurrente** — el sistema soporta varias ediciones del torneo
- **Apuestas de espectadores** — registro libre con 1000 puntos de bienvenida; se apuesta en cada llave qué equipo gana (pari-mutuel con cuotas dinámicas); ranking con premio para el mejor apostador
- **Casters** — registro libre con moderación admin (tiers oficial / secundario / community)
- **Mobile-first crítico** — los capitanes van a usar el sitio desde el celular

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, RSC, Server Actions) |
| DB | Postgres (Supabase) |
| ORM | Drizzle |
| Auth | Supabase Auth (roles: owner, player, admin, super_admin, caster, spectator) |
| Realtime | Supabase Realtime |
| Storage | Supabase Storage |
| Animación | Framer Motion + CSS 3D |
| Bracket | SVG propio |
| AoE2 data | Backend proxy a `data.aoe2companion.com` |
| Hosting | Vercel |

## Setup

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar .env.example a .env.local y completar
cp .env.example .env.local

# 3. Generar tipos de Drizzle
npm run db:generate

# 4. Push del schema a Supabase
npm run db:push

# 5. Levantar dev server
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

## Variables de entorno

Ver `.env.example` para la lista completa:

- `NEXT_PUBLIC_SUPABASE_URL` — URL del proyecto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Anon key de Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (server only)
- `DATABASE_URL` — Connection string de Postgres
- `AOE2_COMPANION_API_URL` — API de AoE2 Companion
- `AOE2_COMPANION_USER_AGENT` — User-Agent header
- `NEXT_PUBLIC_APP_URL` — URL del sitio

## Estructura del proyecto

```
src/
├── app/                      # App Router (Next.js 16)
│   ├── (public)/             # Rutas públicas (landing, torneo, equipos, casters, apuestas)
│   ├── (auth)/               # Login, registro (wizard)
│   ├── (captain)/            # Dashboard de capitán
│   ├── (admin)/              # Panel admin
│   ├── (caster)/             # Dashboard de caster
│   ├── (overlay)/            # Widget para OBS Browser Source
│   ├── api/                  # API routes (upload, etc.)
│   ├── layout.tsx            # Layout raíz (fonts Butler + Oswald)
│   ├── page.tsx              # Landing
│   └── globals.css           # Estilos globales premium sobrios
├── components/
│   ├── ui/                   # Componentes base (Button, Card, Badge, etc.)
│   ├── ruleta/               # Ruleta animada (porte de VERTIGO original)
│   ├── wizard/               # Wizard de inscripción (9 pasos)
│   ├── bracket/              # Visualización SVG del bracket
│   ├── memotest/             # Memotest animado de civs
│   ├── admin/                # Componentes admin
│   ├── apuestas/             # Panel de apuesta del espectador (bet-panel)
│   ├── team/                 # Perfil de equipo
│   └── shared/               # Layout components (header, footer, etc.)
├── lib/
│   ├── db/                   # Drizzle schema + cliente
│   ├── supabase/             # Clientes Supabase (browser, server, service)
│   ├── aoe2/                 # Backend proxy a AoE2 Companion API
│   ├── utils/                # Helpers (cn, formatDate, slugify, etc.)
│   └── constants/            # Constantes del dominio (roles, estados, defaults)
├── server/
│   ├── actions/              # Server Actions (mutations admin)
│   ├── queries/              # Queries server-side (RSC data fetching)
│   └── Jobs/                 # Cron jobs / scheduled tasks
├── types/
│   ├── db/                   # Tipos de Supabase (generados)
│   └── domain/               # Tipos del dominio (AoE2, ruleta, etc.)
└── styles/                   # Estilos adicionales
docs/
└── SPEC.md                   # Especificación técnica y funcional completa
```

## Variables de entorno

Además de las de Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`) y `NEXT_PUBLIC_APP_URL`:

| Variable | Uso |
| --- | --- |
| `CRON_SECRET` | Bearer token de los crons (`/api/cron/*`: payment-deadline, refresh-stats, etc.). |
| `GMAIL_USER` | Mail del staff que envía los emails (ej: `vertigocupaoe2@gmail.com`). |
| `GMAIL_APP_PASSWORD` | Contraseña de aplicación de Google de 16 letras (myaccount.google.com/apppasswords, exige verificación en 2 pasos activa). Sin ella los envíos se saltean y la waitlist queda pendiente de reintento. |
| `RESEND_API_KEY` | (Opcional, fallback) Envío vía Resend — requiere dominio verificado para enviar a terceros. |

**Crons:** en Vercel Hobby los cron jobs corren 1x/día. La expiración de plazas impagas no depende solo del cron: `/api/tournament/slots` y `/api/tournament/config` hacen un *sweep* en cada lectura, así que la plaza se libera y se notifica a la waitlist apenas alguien abre el landing o el wizard.

## Documentación

- **[`docs/SPEC.md`](docs/SPEC.md)** — Especificación técnica y funcional completa (fuente única de verdad).
- README original de la ruleta: [github.com/Arx88/WEBSITE-VERTIGO](https://github.com/Arx88/WEBSITE-VERTIGO)

## Plan de desarrollo

### Fase 1 — MVP (5-7 semanas)
Torneo jugable punta a punta, sin fairness ni Twitch ni disputes.

- ✅ Setup proyecto + Supabase + Auth + RLS
- ✅ Branding system (Butler + Oswald, paleta oscura premium)
- ✅ Schema SQL completo (Drizzle)
- ✅ Helpers AoE2 Companion (proxy + cache + throttle)
- ✅ Componentes UI base (Button, Card, Badge, Input, etc.)
- ⏳ Wizard de inscripción (9 pasos)
- ⏳ Validación ELO cap
- ⏳ Selector de civs con memotest preview
- ⏳ Panel admin (CRUD equipos, emblemas, edición)
- ⏳ Motor SE de 32 + byes + bracket SVG
- ⏳ Ruleta animada (porte de VERTIGO refactorizada)
- ⏳ Memotest animado (flip 3D + selector)
- ⏳ Flujo de llave completo
- ⏳ Comodines básicos
- ⏳ Avance automático de ganador
- ⏳ Perfil de equipo + dashboard mobile

### Fase 2 — V1 Justicia (3-4 semanas)
- Commit-reveal SHA-256 fairness
- Disputes workflow
- INVOCAR PRO completo
- Twitch/YouTube/Kick embeds
- Overlay OBS
- Anti-smurf
- Notificaciones

### Fase 3 — V2 Engagement (4-6 semanas)
- Stats globales
- Copa de consolación
- ✅ Pick'em de fans → apuestas de espectadores con puntos (pari-mutuel, 1000 pts de bienvenida, ranking con premio)
- ✅ Registro de casters + moderación admin
- Mobile PWA
- Multi-edición completa

## Reglas de branding

**"Premium sobrio medieval"** — NO cyberpunk, NO glow masivo, NO neon saturado.

- Fondo casi negro `#08080A`
- Texto blanco roto `#FFF8E7` (no puro)
- Acentos dorados sutiles `#D4AF37` (solo ornamentos 1px)
- Tipografías: **Butler** (títulos) + **Oswald** (UI)
- Sin glow masivo, sin drop-shadows de más de 4px
- Microanimaciones discretas (200-300ms ease-out)
- Mobile-first crítico

## Licencia

Propietario — VÉRTIGO Cup Staff. Todos los derechos reservados.

## Links

- GitHub: [github.com/Arx88/WEBVERTIGOZ](https://github.com/Arx88/WEBVERTIGOZ)
- AoE2 Companion: [aoe2companion.com](https://www.aoe2companion.com)
- Supabase: [supabase.com](https://supabase.com)

---

*"Cada partida es un misterio hasta el último momento. Solo los preparados sobreviven al vértigo."*
