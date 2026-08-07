import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default function AdminJornadasPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="label-premium text-gold/80 mb-2">JORNADAS</div>
        <h1 className="font-serif text-4xl">Configuración de jornadas</h1>
      </div>
      <Card><CardHeader><CardTitle className="text-xl">Jornadas y horarios</CardTitle></CardHeader><CardContent>
        <p className="text-text-secondary text-sm font-light">Asignar fecha y hora de inicio/fin a cada llave. Mover llaves entre jornadas. Sin partidas simultáneas (evento para stream).</p>
        <p className="text-text-tertiary text-sm mt-2">(Módulo en desarrollo — Fase 1 MVP)</p>
      </CardContent></Card>
    </div>
  );
}
