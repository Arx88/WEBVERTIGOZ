import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default function AdminAuditoriaPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="label-premium text-gold/80 mb-2">AUDITORÍA</div>
        <h1 className="font-serif text-4xl">Logs inmutables</h1>
      </div>
      <Card><CardHeader><CardTitle className="text-xl">Sorteos auditados</CardTitle></CardHeader><CardContent>
        <p className="text-text-secondary text-sm font-light">Verificación criptográfica de cada sorteo. Hash commit-reveal SHA-256. Log append-only con hash encadenado.</p>
        <p className="text-text-tertiary text-sm mt-2">(Módulo en desarrollo — Fase 2 V1)</p>
      </CardContent></Card>
    </div>
  );
}
