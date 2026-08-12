import { redirect } from "next/navigation";

/*
 * /torneo → /bracket
 *
 * Esta ruta mostraba datos hardcodeados de ejemplo (equipos "Alpha",
 * "Omega", stats "32 equipos" literales). Se unificó con /bracket,
 * que lee el bracket real de la DB. Mantenemos el redirect para no
 * romper links viejos.
 */
export default function TorneoPage() {
  redirect("/bracket");
}
