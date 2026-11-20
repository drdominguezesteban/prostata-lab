/**
 * Qué le falta a una lectura para poder corregirla. La usan el servidor (`faltaEnLectura`, que decide
 * si entrega la referencia) y el formulario del navegador (el resumen junto a «Enviar»), para que los
 * dos criterios no puedan divergir. Solo importa tipos: nada de `datos/` ni de `shared/servidor`.
 */
import type { Lectura, OpcionDecision } from "./tipos";

export type CampoFalta = "psad" | "sectores" | "pirads" | "categoria" | "decision" | "opcion";

export interface Falta {
  campo: CampoFalta;
  /** Paso del formulario donde está el campo (0 = Contexto clínico, 1 = Lesiones, 2 = Conclusión). */
  paso: 0 | 1 | 2;
  /** Id de la lesión, solo para «sectores» y «pirads». */
  lesion: string | null;
}

/** Densidad de PSA aceptada: mayor que 0 y como mucho 5 ng/mL/mL. */
export function psadValida(psad: number | null): boolean {
  return psad !== null && psad > 0 && psad <= 5;
}

/**
 * Todo lo que falta, en el orden del formulario: densidad de PSA, sector y categoría de cada lesión,
 * categoría del estudio y decisión. Con `opciones`, una decisión que no es del caso también falta.
 */
export function faltantesLectura(l: Lectura, opciones?: ReadonlyArray<Pick<OpcionDecision, "id">>): Falta[] {
  const f: Falta[] = [];
  if (!psadValida(l.psad)) f.push({ campo: "psad", paso: 0, lesion: null });
  for (const x of l.lesiones) {
    if (!x.sectores.length) f.push({ campo: "sectores", paso: 1, lesion: x.id });
    if (x.pirads === null) f.push({ campo: "pirads", paso: 1, lesion: x.id });
  }
  if (l.categoria === null) f.push({ campo: "categoria", paso: 2, lesion: null });
  if (l.decision === null) f.push({ campo: "decision", paso: 2, lesion: null });
  else if (opciones && !opciones.some((o) => o.id === l.decision)) f.push({ campo: "opcion", paso: 2, lesion: null });
  return f;
}

/** Cómo se nombra cada falta en el resumen «Para corregir falta: …» (el paso, contado desde 1). */
export function nombreFalta(f: Falta): string {
  const paso = ` (paso ${f.paso + 1})`;
  switch (f.campo) {
    case "psad": return `la densidad de PSA${paso}`;
    case "sectores": return `el sector de ${f.lesion}${paso}`;
    case "pirads": return `la categoría PI-RADS de ${f.lesion}${paso}`;
    case "categoria": return `la categoría PI-RADS del estudio${paso}`;
    case "decision": return `la decisión clínica${paso}`;
    case "opcion": return `una decisión de las opciones del caso${paso}`;
  }
}
