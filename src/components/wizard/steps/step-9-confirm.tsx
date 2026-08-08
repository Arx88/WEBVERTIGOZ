"use client";
import { useWizard } from "@/components/wizard/wizard-context";
import { civName } from "@/lib/constants/civs";

export default function Step9Confirm() {
  const { data } = useWizard();
  const totalElo = data.players.reduce((s, p) => s + (p.maxRatingRm1v1 ?? 0), 0);
  const captain = data.players.find((p) => p.isCaptain);
  const players = data.players.map((p) => p.displayName).filter(Boolean);
  const civs = data.baseCivIds.map(civName);
  const civsExtra = data.extraCivIds.map(civName);

  return (
    <>
      <dl className="summary">
        <div className="s-row"><dt>Equipo</dt><dd>{data.teamName} {data.teamTagline && <em>"{data.teamTagline}"</em>}</dd></div>
        <div className="s-row"><dt>Correo</dt><dd>{data.email}</dd></div>
        <div className="s-row"><dt>Jugadores</dt><dd>{players.map((p, i) => i === 0 ? <em key={i}>★ {p}</em> : p).reduce((acc: any[], el, i) => i === 0 ? [el] : [...acc, " · ", el], [])}</dd></div>
        <div className="s-row"><dt>Capitán</dt><dd><em>{captain?.displayName ?? "—"}</em></dd></div>
        <div className="s-row"><dt>ELO Total</dt><dd><em>{totalElo}</em> / 3520</dd></div>
        <div className="s-row"><dt>Civs base (9)</dt><dd>{civs.join(" · ") || "—"}</dd></div>
        <div className="s-row"><dt>Civs extra (3)</dt><dd>{civsExtra.join(" · ") || "—"}</dd></div>
        <div className="s-row"><dt>Handbook</dt><dd>{data.handbookDownloadedAt ? <em>✓ Descargado</em> : "—"}</dd></div>
        <div className="s-row"><dt>Términos</dt><dd>{data.restreamAccepted && data.termsAcceptedAt ? <em>✓ Aceptados</em> : "—"}</dd></div>
      </dl>
      <p className="note">Al confirmar, tu equipo quedará pendiente de aprobación del staff. Recibirás la confirmación por email.</p>
    </>
  );
}
