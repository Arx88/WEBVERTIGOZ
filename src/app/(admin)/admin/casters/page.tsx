import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default function AdminCastersPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="label-premium text-gold/80 mb-2">CASTERS</div>
        <h1 className="font-serif text-4xl">Gestión de casters</h1>
      </div>
      <Card><CardHeader><CardTitle className="text-xl">Casters registrados</CardTitle></CardHeader><CardContent>
        <p className="text-text-secondary text-sm font-light">Aprobar/rechazar casters, asignar tier (official/secondary/community), vincular canales Twitch/YouTube/Kick.</p>
        <p className="text-text-tertiary text-sm mt-2">(Módulo en desarrollo — Fase 1 MVP)</p>
      </CardContent></Card>
    </div>
  );
}
