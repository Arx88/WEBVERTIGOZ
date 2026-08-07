import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminHandbookPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="label-premium text-gold/80 mb-2">HANDBOOK</div>
        <h1 className="font-serif text-4xl">Subir PDF del reglamento</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Cargar handbook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-text-secondary text-sm font-light">
            Subí el PDF con el reglamento completo del torneo. Los equipos
            deberán descargarlo obligatoriamente antes de poder aceptar los
            términos y completar la inscripción.
          </p>
          <p className="text-text-tertiary text-sm">
            (Módulo en desarrollo — Fase 1 MVP)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
