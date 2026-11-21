/** Borrador de informe radiológico a partir de la lectura del alumno, con la misma estructura que el del autor. */
import { NOMBRE_ZONA_LARGA, nombreSector, zonaPrincipal } from "../shared/sectores";
import type { CasoPublico } from "../shared/servidor";
import type { Lectura } from "../shared/tipos";
import { num } from "./dom";

export function informeAlumno(c: CasoPublico, l: Lectura): string {
  const lineas = [
    `RM biparamétrica de próstata (T2, DWI con b ${c.tecnica.b_alto} y ADC; sin DCE).`,
    `Indicación: PSA ${num(c.psa)} ng/mL. ${c.contexto_docente.biopsias_previas === "ninguna" ? "Sin biopsias previas." : `Biopsias previas: ${c.contexto_docente.biopsias_previas}.`}`,
    `Volumen prostático: ${num(c.volumen)} mL. Densidad de PSA: ${l.psad === null ? "—" : num(l.psad, 2)} ng/mL/mL.`,
  ];
  // Todas las lesiones añadidas, también las que aún no tienen sector (con «—» donde falta).
  const sospechosas = l.lesiones;
  if (!sospechosas.length) lineas.push("Sin lesiones focales sospechosas.");
  const indice = [...sospechosas].sort((a, b) => (b.pirads ?? 0) - (a.pirads ?? 0))[0];
  sospechosas.forEach((x, i) => {
    const zona = zonaPrincipal(x.sectores);
    lineas.push(
      `Lesión ${i + 1}${x === indice && sospechosas.length > 1 ? " (índice)" : ""}: ${zona ? NOMBRE_ZONA_LARGA[zona] : "—"}; ${x.sectores.length ? x.sectores.map(nombreSector).join("; ") : "—"}. Tamaño ${x.tamano === ">=1.5" ? "≥1,5 cm" : x.tamano === "<1.5" ? "<1,5 cm" : "—"}.`,
      `- T2: ${x.t2 ?? "—"}.`,
      `- DWI: ${x.dwi ?? "—"}.`,
      "- DCE: no disponible.",
      `- Categoría PI-RADS v2.1: ${x.pirads ?? "—"}.`,
      `Extensión extraprostática: ${x.epe === "definida" ? "definida" : x.epe === "no" ? "sin extensión definida" : "—"}.`,
    );
  });
  lineas.push(`Conclusión: estudio PI-RADS ${l.categoria ?? "—"}.`);
  return lineas.join("\n");
}
