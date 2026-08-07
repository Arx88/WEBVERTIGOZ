import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminEmblemasPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="label-premium text-gold/80 mb-2">EMBLEMAS</div>
        <h1 className="font-serif text-4xl">Gestión de emblemas</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Subir emblemas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-text-secondary text-sm font-light">
            Subí los escudos que los equipos podrán elegir al inscribirse.
            Mínimo 50 emblemas recomendados. Formato SVG o PNG transparente,
            tamaño cuadrado 512x512px.
          </p>
          <p className="text-text-tertiary text-sm">
            (Módulo en desarrollo — Fase 1 MVP)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
