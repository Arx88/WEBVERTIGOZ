import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy as TournamentIcon, Users, Shield, BookOpen } from "lucide-react";

export default function AdminHomePage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="label-premium text-gold/80 mb-2">PANEL DE ADMINISTRACIÓN</div>
        <h1 className="font-serif text-4xl">Centro de control</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Link href="/admin/torneo">
          <Card className="hover:border-border-strong cursor-pointer">
            <CardHeader>
              <TournamentIcon className="w-6 h-6 text-gold/60" strokeWidth={1.25} />
              <CardTitle className="text-xl mt-3">Edición del Torneo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-text-secondary text-sm font-light">
                Crear/editar edición, preset, configuración de ELO cap, comodines y jornadas.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/equipos">
          <Card className="hover:border-border-strong cursor-pointer">
            <CardHeader>
              <Users className="w-6 h-6 text-gold/60" strokeWidth={1.25} />
              <CardTitle className="text-xl mt-3">Equipos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-text-secondary text-sm font-light">
                Aprobar inscripciones, validar perfiles AoE2 Companion, gestionar ELO.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/bracket">
          <Card className="hover:border-border-strong cursor-pointer">
            <CardHeader>
              <Shield className="w-6 h-6 text-gold/60" strokeWidth={1.25} />
              <CardTitle className="text-xl mt-3">Bracket</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-text-secondary text-sm font-light">
                Generar bracket, sorteo inicial de llaves, gestión de partidos.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/casters">
          <Card className="hover:border-border-strong cursor-pointer">
            <CardHeader>
              <BookOpen className="w-6 h-6 text-gold/60" strokeWidth={1.25} />
              <CardTitle className="text-xl mt-3">Casters</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-text-secondary text-sm font-light">
                Aprobar casters, asignar tier, gestionar canales de streaming.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/emblemas">
          <Card className="hover:border-border-strong cursor-pointer">
            <CardHeader>
              <Shield className="w-6 h-6 text-gold/60" strokeWidth={1.25} />
              <CardTitle className="text-xl mt-3">Emblemas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-text-secondary text-sm font-light">
                Subir/borrar emblemas para los equipos. Mínimo 50 escudos.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/handbook">
          <Card className="hover:border-border-strong cursor-pointer">
            <CardHeader>
              <BookOpen className="w-6 h-6 text-gold/60" strokeWidth={1.25} />
              <CardTitle className="text-xl mt-3">Handbook</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-text-secondary text-sm font-light">
                Subir PDF del reglamento. Bloquea la inscripción hasta que se descarga.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
