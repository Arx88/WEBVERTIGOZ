import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default function AdminBracketPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="label-premium text-gold/80 mb-2">BRACKET</div>
        <h1 className="font-serif text-4xl">Bracket del torneo</h1>
      </div>
      <Card><CardHeader><CardTitle className="text-xl">Generar bracket</CardTitle></CardHeader><CardContent>
        <p className="text-text-secondary text-sm font-light">Generar bracket automático SE de 32, sorteo inicial de llaves, gestión de partidos y jornadas.</p>
        <p className="text-text-tertiary text-sm mt-2">(Módulo en desarrollo — Fase 1 MVP)</p>
      </CardContent></Card>
    </div>
  );
}
