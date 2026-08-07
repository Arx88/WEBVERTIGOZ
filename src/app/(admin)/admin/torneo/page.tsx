import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminTorneoPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="label-premium text-gold/80 mb-2">CONFIGURACIÓN</div>
        <h1 className="font-serif text-4xl">Edición del Torneo</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Configuración general</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-text-secondary text-sm font-light">
            Acá vas a poder configurar todos los parámetros de la edición:
            ELO cap, tolerancia, comodines, jornadas, casters oficiales, y más.
          </p>
          <p className="text-text-tertiary text-sm">
            (Módulo en desarrollo — Fase 1 MVP)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
