import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default function AdminEquiposPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="label-premium text-gold/80 mb-2">EQUIPOS</div>
        <h1 className="font-serif text-4xl">Inscripciones</h1>
      </div>
      <Card><CardHeader><CardTitle className="text-xl">Lista de equipos</CardTitle></CardHeader><CardContent>
        <p className="text-text-secondary text-sm font-light">Acá vas a poder aprobar/rechazar inscripciones, validar perfiles AoE2 Companion y gestionar el ELO de cada equipo.</p>
        <p className="text-text-tertiary text-sm mt-2">(Módulo en desarrollo — Fase 1 MVP)</p>
      </CardContent></Card>
    </div>
  );
}
