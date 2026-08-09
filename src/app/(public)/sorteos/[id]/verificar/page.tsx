import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { verifyCommit, deterministicIndex, hashSeed } from "@/lib/crypto";
import Link from "next/link";
import { civName } from "@/lib/constants/civs";

export const dynamic = "force-dynamic";

interface DrawData {
  id: string;
  status: string;
  commitHash: string;
  revealedSeed: string | null;
  publicInputs: any;
  result: any;
  committedAt: string;
  revealedAt: string | null;
  publishedAt: string | null;
  drawType: "match" | "seeding";
  matchGameId?: string;
  bracketId?: string;
}

async function getDrawData(id: string): Promise<DrawData | null> {
  const supabase = await getSupabaseServer();

  // Intentar roulette_draw primero
  const { data: rDraw } = (await supabase
    .from("roulette_draw")
    .select(
      "id, status, commit_hash, revealed_seed, public_inputs, result, committed_at, revealed_at, published_at, match_game_id"
    )
    .eq("id", id)
    .single()) as { data: any };

  if (rDraw?.data) {
    const r = rDraw.data;
    return {
      id: r.id,
      status: r.status,
      commitHash: r.commit_hash,
      revealedSeed: r.revealed_seed,
      publicInputs: r.public_inputs,
      result: r.result,
      committedAt: r.committed_at,
      revealedAt: r.revealed_at,
      publishedAt: r.published_at,
      drawType: "match",
      matchGameId: r.match_game_id,
    };
  }

  // Intentar seeding_draw
  const { data: sDraw } = (await supabase
    .from("seeding_draw")
    .select(
      "id, status, commit_hash, revealed_seed, public_inputs, result, committed_at, revealed_at, published_at, bracket_id"
    )
    .eq("id", id)
    .single()) as { data: any };

  if (sDraw?.data) {
    const s = sDraw.data;
    return {
      id: s.id,
      status: s.status,
      commitHash: s.commit_hash,
      revealedSeed: s.revealed_seed,
      publicInputs: s.public_inputs,
      result: s.result,
      committedAt: s.committed_at,
      revealedAt: s.revealed_at,
      publishedAt: s.published_at,
      drawType: "seeding",
      bracketId: s.bracket_id,
    };
  }

  return null;
}

async function getAuditLog(drawId: string): Promise<any[]> {
  const supabase = await getSupabaseServer();
  const { data } = (await supabase
    .from("draw_audit_log")
    .select("event_type, hash_chain, previous_hash, payload, created_at")
    .eq("draw_id", drawId)
    .order("created_at", { ascending: true })) as { data: any };
  return data ?? [];
}

export default async function SorteoVerificarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const draw = await getDrawData(id);

  if (!draw) {
    notFound();
  }

  const auditLog = await getAuditLog(id);
  const isRevealed = draw.status === "revealed" || draw.status === "published";
  const commitVerified = isRevealed && draw.revealedSeed
    ? verifyCommit(draw.revealedSeed, draw.commitHash)
    : null;

  // Si está revelado, recalcular los índices para verificar
  let verificationSteps: Array<{
    stepIndex: number;
    stepLabel: string;
    N: number;
    expectedIndex: number;
    resultValue?: string;
  }> = [];

  if (isRevealed && draw.revealedSeed && draw.result) {
    const clientSeed = draw.publicInputs?.clientSeed ?? id;
    // Para sorteo de partida: 6 etapas (modo, antimeta, formato, mapa, civs, llave)
    // Los N y labels dependen del preset; aquí mostramos lo que sabemos del result
    if (draw.drawType === "match" && draw.result) {
      const steps = [
        { stepIndex: 0, label: "Modo de juego", N: 4, value: draw.result.gameMode },
        { stepIndex: 1, label: "Antimeta", N: 6, value: draw.result.antimetaMode },
        { stepIndex: 2, label: "Formato jugadores", N: 4, value: draw.result.playerMode },
        { stepIndex: 3, label: "Mapa", N: 9, value: draw.result.map },
        { stepIndex: 4, label: "Civs", N: 12, value: draw.result.civsA?.join(", ") },
        { stepIndex: 5, label: "Formato llave", N: 2, value: draw.result.llaveFormat },
      ];
      verificationSteps = steps
        .filter((s) => s.value !== undefined && s.value !== null)
        .map((s) => ({
          stepIndex: s.stepIndex,
          stepLabel: s.label,
          N: s.N,
          expectedIndex: deterministicIndex(s.N, draw.revealedSeed!, clientSeed, s.stepIndex),
          resultValue: s.value,
        }));
    }
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="text-sm opacity-60 hover:opacity-100">
          ← Volver al inicio
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs uppercase tracking-widest opacity-60">
            Verificación criptográfica
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              isRevealed
                ? "bg-green-500/20 text-green-300"
                : "bg-yellow-500/20 text-yellow-300"
            }`}
          >
            {isRevealed ? "REVELADO" : "PENDIENTE"}
          </span>
        </div>
        <h1 className="text-3xl font-serif mt-2">
          Sorteo {draw.drawType === "seeding" ? "de bracket" : "de partida"}
        </h1>
        <p className="text-sm opacity-60 mt-1 font-mono">{draw.id}</p>
      </div>

      {/* Resumen del sorteo */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4 border-b border-white/10 pb-2">
          Datos del sorteo
        </h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="opacity-60">Tipo</dt>
            <dd className="font-mono">{draw.drawType}</dd>
          </div>
          <div>
            <dt className="opacity-60">Estado</dt>
            <dd className="font-mono">{draw.status}</dd>
          </div>
          <div>
            <dt className="opacity-60">Commit hash (público desde el inicio)</dt>
            <dd className="font-mono text-xs break-all">{draw.commitHash}</dd>
          </div>
          <div>
            <dt className="opacity-60">Client seed (público)</dt>
            <dd className="font-mono text-xs break-all">
              {draw.publicInputs?.clientSeed ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="opacity-60">Commit realizado</dt>
            <dd className="font-mono text-xs">
              {new Date(draw.committedAt).toLocaleString("es-AR")}
            </dd>
          </div>
          <div>
            <dt className="opacity-60">Revelado</dt>
            <dd className="font-mono text-xs">
              {draw.revealedAt ? new Date(draw.revealedAt).toLocaleString("es-AR") : "—"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Verificación del commit */}
      {isRevealed && draw.revealedSeed && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4 border-b border-white/10 pb-2">
            Verificación del commit
          </h2>
          <div
            className={`p-4 rounded-lg border ${
              commitVerified
                ? "bg-green-500/10 border-green-500/40"
                : "bg-red-500/10 border-red-500/40"
            }`}
          >
            <p className="font-mono text-sm mb-2">
              <span className="opacity-60">SHA-256(revealedSeed) = </span>
              <br />
              <span className="break-all">{hashSeed(draw.revealedSeed)}</span>
            </p>
            <p className="font-mono text-sm mb-2">
              <span className="opacity-60">commitHash guardado = </span>
              <br />
              <span className="break-all">{draw.commitHash}</span>
            </p>
            <p className="font-bold mt-3">
              {commitVerified
                ? "✓ Verificación exitosa: el hash coincide. El serverSeed no fue manipulado."
                : "✗ Verificación fallida: el hash NO coincide. Posible manipulación."}
            </p>
          </div>
          <div className="mt-4">
            <dt className="opacity-60 text-sm mb-1">ServerSeed revelado</dt>
            <dd className="font-mono text-xs break-all p-2 bg-black/40 rounded">
              {draw.revealedSeed}
            </dd>
          </div>
        </section>
      )}

      {/* Verificación de cada etapa */}
      {verificationSteps.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4 border-b border-white/10 pb-2">
            Verificación por etapa
          </h2>
          <p className="text-sm opacity-60 mb-4">
            Cada etapa del sorteo se computó con HMAC-SHA256(serverSeed, clientSeed +
            stepIndex) % N. Podés verificar manualmente con cualquier herramienta externa.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/20 text-left">
                  <th className="py-2 pr-4">Etapa</th>
                  <th className="py-2 pr-4">N</th>
                  <th className="py-2 pr-4">Índice esperado</th>
                  <th className="py-2 pr-4">Resultado guardado</th>
                </tr>
              </thead>
              <tbody>
                {verificationSteps.map((step) => (
                  <tr key={step.stepIndex} className="border-b border-white/5">
                    <td className="py-2 pr-4 font-mono">{step.stepLabel}</td>
                    <td className="py-2 pr-4 font-mono">{step.N}</td>
                    <td className="py-2 pr-4 font-mono text-green-300">{step.expectedIndex}</td>
                    <td className="py-2 pr-4 font-mono">
                      {step.resultValue ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Resultado publicado */}
      {draw.result && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4 border-b border-white/10 pb-2">
            Resultado publicado
          </h2>
          <pre className="bg-black/40 p-4 rounded-lg text-xs font-mono overflow-x-auto">
            {JSON.stringify(draw.result, null, 2)}
          </pre>
        </section>
      )}

      {/* Log de auditoría */}
      {auditLog.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4 border-b border-white/10 pb-2">
            Cadena de auditoría ({auditLog.length} eventos)
          </h2>
          <p className="text-sm opacity-60 mb-4">
            Cada evento se encadena al anterior con SHA-256. Cambiar un evento rompe toda
            la cadena posterior, lo que hace el log inmutable y detectable.
          </p>
          <div className="space-y-2">
            {auditLog.map((log, i) => (
              <div
                key={log.event_type + i}
                className="bg-black/30 p-3 rounded-lg text-xs font-mono"
              >
                <div className="flex justify-between mb-1">
                  <span className="font-bold text-purple-300">{log.event_type}</span>
                  <span className="opacity-60">
                    {new Date(log.created_at).toLocaleString("es-AR")}
                  </span>
                </div>
                <div className="opacity-60 text-[10px] break-all">
                  hash: {log.hash_chain?.slice(0, 32)}...
                </div>
                {log.previous_hash && (
                  <div className="opacity-40 text-[10px] break-all">
                    prev: {log.previous_hash?.slice(0, 32)}...
                  </div>
                )}
                {log.payload && (
                  <details className="mt-1">
                    <summary className="cursor-pointer opacity-60">payload</summary>
                    <pre className="mt-1 text-[10px] opacity-70">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer explicativo */}
      <section className="text-xs opacity-50 mt-12 border-t border-white/10 pt-6">
        <p>
          <strong>Cómo funciona el commit-reveal:</strong> El admin genera un serverSeed
          aleatorio y publica solo su hash SHA-256 (commitHash) antes del sorteo. La
          ruleta computa los resultados con HMAC-SHA256(serverSeed, clientSeed + step)
          de forma determinista. Después del sorteo, el serverSeed se revela, permitiendo
          a cualquiera verificar que SHA-256(revealedSeed) === commitHash y que los
          resultados coinciden con la computación determinista.
        </p>
      </section>
    </main>
  );
}
