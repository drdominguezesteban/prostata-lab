/** Geometría sencilla para el Módulo 1 (sin DOM). Polígonos en píxeles de la imagen: [[[x, y], …], …]. */

/** Distancia (en píxeles) del punto al borde más cercano de los polígonos; Infinity si no hay ninguno. */
export function distanciaAPoligonos(polys: number[][][], x: number, y: number): number {
  let d = Infinity;
  for (const p of polys) {
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [ax = 0, ay = 0] = p[j]!;
      const [bx = 0, by = 0] = p[i]!;
      const dx = bx - ax;
      const dy = by - ay;
      const l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
      d = Math.min(d, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
    }
  }
  return d;
}

/** Más allá de este margen alrededor de las zonas segmentadas, el clic ya no está en la próstata ni en su borde. */
export const MARGEN_PROSTATA_MM = 10;

/** ¿El punto queda lejos de la glándula en ese corte? Solo si el corte tiene zonas segmentadas. */
export function lejosDeLaGlandula(polys: number[][][], x: number, y: number, mmPorPx: number): boolean {
  if (!polys.length) return false;
  return distanciaAPoligonos(polys, x, y) * mmPorPx > MARGEN_PROSTATA_MM;
}
