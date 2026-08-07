#!/usr/bin/env python3
"""
Genera un PDF básico con el handbook placeholder del torneo VÉRTIGO.
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT

OUTPUT = "/home/z/my-project/webvertigo/public/handbook/vertigo-handbook.pdf"

styles = getSampleStyleSheet()

title_style = ParagraphStyle(
  "CustomTitle",
  parent=styles["Title"],
  fontName="Helvetica-Bold",
  fontSize=24,
  leading=30,
  alignment=TA_CENTER,
  textColor=HexColor("#08080A"),
  spaceAfter=30,
)

subtitle_style = ParagraphStyle(
  "CustomSubtitle",
  parent=styles["Normal"],
  fontName="Helvetica",
  fontSize=12,
  leading=16,
  alignment=TA_CENTER,
  textColor=HexColor("#666666"),
  spaceAfter=40,
)

h2_style = ParagraphStyle(
  "CustomH2",
  parent=styles["Heading2"],
  fontName="Helvetica-Bold",
  fontSize=16,
  leading=20,
  textColor=HexColor("#08080A"),
  spaceBefore=20,
  spaceAfter=10,
)

body_style = ParagraphStyle(
  "CustomBody",
  parent=styles["Normal"],
  fontName="Helvetica",
  fontSize=11,
  leading=16,
  alignment=TA_LEFT,
  textColor=HexColor("#333333"),
  spaceAfter=10,
)

bullet_style = ParagraphStyle(
  "CustomBullet",
  parent=body_style,
  leftIndent=20,
  bulletIndent=10,
  spaceAfter=4,
)

doc = SimpleDocTemplate(
  OUTPUT,
  pagesize=A4,
  leftMargin=2.5*cm,
  rightMargin=2.5*cm,
  topMargin=3*cm,
  bottomMargin=3*cm,
  title="VÉRTIGO Cup — Handbook Oficial",
  author="Vértigo Cup Staff",
)

content = []

# PORTADA
content.append(Paragraph("VÉRTIGO CUP", title_style))
content.append(Paragraph("Handbook Oficial — Edición 2026", subtitle_style))
content.append(Paragraph("El azar decide tu destino", subtitle_style))
content.append(Spacer(1, 60))
content.append(Paragraph("32 equipos · 3 jugadores · 15 minutos · Una ruleta", body_style))
content.append(PageBreak())

# 1. CONCEPTO
content.append(Paragraph("1. Concepto del Torneo", h2_style))
content.append(Paragraph(
  "VÉRTIGO es un torneo de Age of Empires II con una mecánica única: "
  "las partidas se sortean con una ruleta animada 15 minutos antes de jugarse. "
  "El nombre VÉRTIGO refiere al vértigo de no saber qué te va a tocar hasta el último momento.",
  body_style
))
content.append(Paragraph("Características principales:", body_style))
content.append(Paragraph("• 32 equipos de 3 jugadores cada uno (96 jugadores en total)", bullet_style))
content.append(Paragraph("• Single Elimination: 5 rondas (R1 → Octavos → Cuartos → Semis → Final)", bullet_style))
content.append(Paragraph("• Cada partida se sortea 15 minutos antes con la ruleta animada", bullet_style))
content.append(Paragraph("• La ruleta sortea: modo, antimeta, formato (1v1/2v2/3v3/fusión), mapa, formato de llave (BO3/BO1-Deathmatch) y civilizaciones", bullet_style))
content.append(Spacer(1, 20))

# 2. ELO CAP
content.append(Paragraph("2. Tope de ELO", h2_style))
content.append(Paragraph(
  "Para mantener el equilibrio competitivo, hay un tope de ELO por equipo:",
  body_style
))
content.append(Paragraph("• Suma máxima de los 3 maxRating RM 1v1 históricos: 3500", bullet_style))
content.append(Paragraph("• Tolerancia: +20 = 3520 máximo absoluto", bullet_style))
content.append(Paragraph("• Validación vía AoE2 Companion API al cargar cada jugador", bullet_style))
content.append(Paragraph("• El ELO se congela al momento de la inscripción (no se recalcula durante el torneo)", bullet_style))
content.append(Paragraph("• Jugadores con perfil oculto se aceptan pero se marcan para verificación manual del staff", bullet_style))
content.append(Spacer(1, 20))

# 3. INSCRIPCIÓN
content.append(Paragraph("3. Inscripción", h2_style))
content.append(Paragraph(
  "Cada equipo debe completar el wizard de inscripción de 9 pasos:",
  body_style
))
content.append(Paragraph("1. Crear cuenta de equipo (email + password)", bullet_style))
content.append(Paragraph("2. Datos del equipo: nombre, frase, escudo (de la galería predefinida)", bullet_style))
content.append(Paragraph("3. Cargar 3 jugadores (búsqueda en AoE2 Companion)", bullet_style))
content.append(Paragraph("4. Elegir capitán (uno de los 3 cargados)", bullet_style))
content.append(Paragraph("5. Elegir 9 civilizaciones base (de las 40 de AoE2 DE)", bullet_style))
content.append(Paragraph("6. Elegir 3 civs extra (para finalistas, no pueden repetir con las 9 base)", bullet_style))
content.append(Paragraph("7. Descargar este handbook (obligatorio)", bullet_style))
content.append(Paragraph("8. Aceptar términos (restream permission + reglamento)", bullet_style))
content.append(Paragraph("9. Confirmar inscripción", bullet_style))
content.append(Spacer(1, 20))

# 4. FLUJO DE LLAVE
content.append(Paragraph("4. Flujo de una Llave (Match)", h2_style))
content.append(Paragraph(
  "Cada llave del bracket sigue este flujo:",
  body_style
))
content.append(Paragraph("1. ADMIN agenda la llave con fecha/hora de inicio y fin", bullet_style))
content.append(Paragraph("2. Llega la hora → la llave se abre en el dashboard de ambos equipos", bullet_style))
content.append(Paragraph("3. AMBOS equipos ponen LISTO (READY #1) → arranca sorteo", bullet_style))
content.append(Paragraph("4. Ruleta gira: 5 fases (MODO → ANTIMETA → FORMATO → MAPA → LLAVE) — solo en partida 1", bullet_style))
content.append(Paragraph("5. Memotest de civs: 1 civ por jugador (sin repetir intra-equipo)", bullet_style))
content.append(Paragraph("6. Si NO es 3v3 ni FUSIÓN: cada equipo declara lineup", bullet_style))
content.append(Paragraph("7. AMBOS equipos ponen LISTO (READY #2) → arranca ventana de comodines", bullet_style))
content.append(Paragraph("8. 5 minutos de ventana de comodines (timer se pausa durante ejecución)", bullet_style))
content.append(Paragraph("9. Partida en juego (AoE2) — durante: INVOCAR PRO disponible", bullet_style))
content.append(Paragraph("10. Cargar resultado: si BO1 o 2-0 → ganador avanza. Si 1-1 → partida 2", bullet_style))
content.append(Paragraph("11. Partida 2 (si BO3): misma ruleta sin LLAVE, nuevas civs (pueden repetir)", bullet_style))
content.append(Paragraph("12. Partida 3 (si 1-1): igual que partida 2. Ganador avanza.", bullet_style))
content.append(PageBreak())

# 5. COMODINES
content.append(Paragraph("5. Comodines (Cartas de Poder)", h2_style))
content.append(Paragraph(
  "Cada equipo tiene 4 comodines por torneo (todos configurables por el admin):",
  body_style
))
content.append(Paragraph("• Re-girar (×2 por torneo): re-gira 1 fase de la ruleta o las civs", bullet_style))
content.append(Paragraph("• Anular jugador (×1 por torneo, solo 1v1/2v2): bloquea 1 jugador del rival", bullet_style))
content.append(Paragraph("• Elegir rival (×1 por torneo, solo 1v1/2v2): fuerza a 1 jugador del rival a jugar. Mutuamente excluyente con Anular en la misma llave", bullet_style))
content.append(Paragraph("• INVOCAR PRO (×1 por torneo): durante la partida, 5 min de consejos de un PRO asignado", bullet_style))
content.append(Spacer(1, 10))
content.append(Paragraph("Reglas de uso:", body_style))
content.append(Paragraph("• Re-girar, Anular y Elegir rival se usan en la ventana de 5 min post-lineup", bullet_style))
content.append(Paragraph("• INVOCAR PRO se activa durante la partida escribiendo 'CARTA PRO' en el chat del sitio", bullet_style))
content.append(Paragraph("• Por orden de llegada: primero llega, primero se ejecuta", bullet_style))
content.append(Paragraph("• El timer de la ventana se pausa durante la ejecución de un comodín", bullet_style))
content.append(Paragraph("• El admin debe tocar 'Girar' para confirmar la ejecución (control de stream)", bullet_style))
content.append(Spacer(1, 20))

# 6. FAIRNESS
content.append(Paragraph("6. Fairness del Sorteo (Commit-Reveal SHA-256)", h2_style))
content.append(Paragraph(
  "Para garantizar que el sorteo no esté amañado, se implementa commit-reveal criptográfico:",
  body_style
))
content.append(Paragraph("1. COMMIT (antes de girar): el server genera una seed aleatoria y publica el hash SHA-256. Los jugadores lo ven en su perfil.", bullet_style))
content.append(Paragraph("2. SPIN: la ruleta gira (animación puramente visual, el resultado ya está decidido por la seed).", bullet_style))
content.append(Paragraph("3. REVEAL (después de girar): el server revela la seed. Cualquiera puede verificar que SHA-256(seed + public_inputs) == commit_hash.", bullet_style))
content.append(Paragraph("4. Log inmutable append-only con hash encadenado para auditoría.", bullet_style))
content.append(Paragraph("5. Página pública /sorteos/[id]/verificar permite verificar criptográficamente cualquier sorteo.", bullet_style))
content.append(Spacer(1, 20))

# 7. CASTERS Y STREAMING
content.append(Paragraph("7. Casters y Streaming", h2_style))
content.append(Paragraph(
  "El torneo tiene 3 canales oficiales: Twitch, YouTube y Kick. "
  "Además, cualquier streamer puede registrarse como CASTER en el sitio para ser aprobado por el staff.",
  body_style
))
content.append(Paragraph(
  "Al inscribirse, los equipos aceptan el permiso de transmisión (restream permission). "
  "Los streams pueden embedirse en la página del partido si el admin lo activa.",
  body_style
))
content.append(Spacer(1, 20))

# 8. DISPUTAS
content.append(Paragraph("8. Disputas y Reclamos", h2_style))
content.append(Paragraph(
  "Si un equipo considera que hubo un error en el sorteo o en la partida, "
  "puede abrir una disputa desde su panel de capitán dentro de los 30 minutos "
  "posteriores a la finalización del partido. La disputa debe incluir:",
  body_style
))
content.append(Paragraph("• Motivo detallado del reclamo", bullet_style))
content.append(Paragraph("• URLs de evidencia (screenshots, replays, etc.)", bullet_style))
content.append(Paragraph(
  "Solo un super_admin puede resolver disputas. Las decisiones del super_admin son definitivas.",
  body_style
))

doc.build(content)
print(f"PDF generado: {OUTPUT}")
