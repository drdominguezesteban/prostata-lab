/**
 * Pestañas de secuencia del visor en el móvil (patrón WAI-ARIA «Tabs», activación automática).
 * Lógica pura, sin DOM, para poder probarla.
 */

/** Ancho máximo (px) en el que el visor muestra una sola secuencia con pestañas. Por encima, las tres juntas. */
export const ANCHO_MOVIL = 599;
export const CONSULTA_MOVIL = `(max-width: ${ANCHO_MOVIL}.98px)`;

/**
 * Pestaña que se activa al pulsar una tecla en la lista de pestañas, o `null` si la tecla no es suya.
 * Flechas izquierda/derecha (con vuelta al principio y al final), Inicio y Fin.
 */
export function pestanaSegunTecla(actual: number, tecla: string, total: number): number | null {
  if (total < 1) return null;
  switch (tecla) {
    case "ArrowRight":
      return (actual + 1) % total;
    case "ArrowLeft":
      return (actual - 1 + total) % total;
    case "Home":
      return 0;
    case "End":
      return total - 1;
    default:
      return null;
  }
}
