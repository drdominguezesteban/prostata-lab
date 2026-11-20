/**
 * Corrección de una lectura frente a la referencia del autor. Módulo puro: sin DOM ni almacén.
 *
 * Reglas (también se explican en «Método»):
 * - Cuentan como lesiones del alumno las que tienen PI-RADS ≥3 o sin categoría todavía.
 * - Emparejamiento por sectores: comparten sector (mejor cuanto más se solapan) o, si no, son
 *   contiguos. Un sector contiguo ya no cuenta como falso positivo + omisión.
 * - Cada componente se puntúa siempre; los que no aplican (localización y secuencias en un estudio
 *   sin lesiones) no cuentan y el resto se reescala a 100.
 * - Error crítico en la decisión: decisión = 0 y, además, se restan PENALIZACION_ERROR_CRITICO
 *   puntos al total (mínimo 0).
 */
import { ladoDe, sector, sonAdyacentes, zonaPrincipal } from "./sectores";
import type { Caso, LesionAlumno, LesionReferencia, Lectura } from "./tipos";

export const PESOS = {
  deteccion: 25,
  localizacion: 20,
  secuencias: 20,
  pirads: 20,
  psad: 5,
  decision: 10,
} as const;

export type Componente = keyof typeof PESOS;

export const ETIQUETAS: Record<Componente, string> = {
  deteccion: "Detección",
  localizacion: "Localización",
  secuencias: "Puntuación por secuencia",
  pirads: "Categoría PI-RADS del estudio",
  psad: "Densidad de PSA",
  decision: "Decisión clínica",
};

export const PENALIZACION_ERROR_CRITICO = 10;
/** Penalización de detección por cada lesión marcada sin correspondencia. */
export const PENALIZACION_FALSO_POSITIVO = 0.25;
/** Crédito de localización cuando la lesión está en un sector contiguo, sin compartir ninguno. */
export const CREDITO_ADYACENTE = 0.4;
/** Una lesión marcada solo en un sector contiguo cuenta como media detección: está cerca, pero no encima. */
export const CREDITO_DETECCION_ADYACENTE = 0.5;
/** Margen para la densidad de PSA (redondeo a dos decimales). */
export const TOLERANCIA_PSAD = 0.015;
/** Nota mínima, sin error crítico, para contar como caso perfecto. */
export const UMBRAL_PERFECTO = 90;

export type TipoPareja = "coincide" | "adyacente" | "falso_positivo" | "omitida";

export interface Pareja {
  alumno: LesionAlumno | null;
  referencia: LesionReferencia | null;
  tipo: TipoPareja;
  /** Solape de sectores (índice de Jaccard) cuando coinciden. */
  solape: number;
}

export interface ValorComponente {
  clave: Componente;
  etiqueta: string;
  peso: number;
  /** 0–1, o null si no aplica en este caso. */
  valor: number | null;
}

export interface Resultado {
  nota: number;
  notaSinPenalizacion: number;
  critico: boolean;
  perfecto: boolean;
  componentes: ValorComponente[];
  parejas: Pareja[];
  /** Comentarios del autor para los errores que ha cometido el alumno. */
  comentarios: string[];
  /** Lesiones del alumno cuya categoría no sigue la regla de v2.1 con sus propias puntuaciones. */
  erroresRegla: Array<{ lesion: string; esperado: number; puesto: number }>;
  decision: "correcta" | "aceptable" | "no_preferente" | "critica" | "sin_responder";
}

export function esSospechosa(l: LesionAlumno): boolean {
  return l.pirads === null || l.pirads >= 3;
}

/**
 * Categoría PI-RADS v2.1 en RM biparamétrica (sin DCE) a partir de T2 y DWI.
 * ZP: manda la DWI. ZT: manda T2; DWI 4–5 sube T2 2 a 3, y DWI 5 sube T2 3 a 4.
 * En zona central y estroma anterior no se calcula (lo decide el lector).
 */
export function piradsPorRegla(zona: string | null, t2: number | null, dwi: number | null): number | null {
  if (zona === "PZ") return dwi;
  if (zona !== "TZ" || t2 === null) return null;
  if (t2 === 2 && dwi !== null && dwi >= 4) return 3;
  if (t2 === 3 && dwi === 5) return 4;
  return t2;
}

function puntuacionPareja(a: LesionAlumno, r: LesionReferencia): { tipo: TipoPareja; solape: number; orden: number } | null {
  const ref = new Set(r.sectores);
  const comunes = a.sectores.filter((s) => ref.has(s)).length;
  if (comunes > 0) {
    // Dice: marcar de más o de menos baja el solape; marcar media glándula no puntúa como acertar.
    const solape = (2 * comunes) / (a.sectores.length + r.sectores.length);
    return { tipo: "coincide", solape, orden: 1 + solape };
  }
  const contiguo = a.sectores.some((s) => r.sectores.some((t) => sonAdyacentes(s, t)));
  return contiguo ? { tipo: "adyacente", solape: 0, orden: 0.5 } : null;
}

/** Empareja lesiones del alumno con las de referencia, de mejor a peor solape. */
export function emparejar(lesiones: LesionAlumno[], referencia: LesionReferencia[]): Pareja[] {
  const candidatas: Array<{ a: LesionAlumno; r: LesionReferencia; tipo: TipoPareja; solape: number; orden: number }> = [];
  for (const a of lesiones) {
    for (const r of referencia) {
      const p = puntuacionPareja(a, r);
      if (p) candidatas.push({ a, r, ...p });
    }
  }
  candidatas.sort((x, y) => y.orden - x.orden || Number(y.r.indice) - Number(x.r.indice));
  const usadasA = new Set<string>();
  const usadasR = new Set<string>();
  const parejas: Pareja[] = [];
  for (const c of candidatas) {
    if (usadasA.has(c.a.id) || usadasR.has(c.r.id)) continue;
    usadasA.add(c.a.id);
    usadasR.add(c.r.id);
    parejas.push({ alumno: c.a, referencia: c.r, tipo: c.tipo, solape: c.solape });
  }
  for (const r of referencia) {
    if (!usadasR.has(r.id)) parejas.push({ alumno: null, referencia: r, tipo: "omitida", solape: 0 });
  }
  for (const a of lesiones) {
    if (!usadasA.has(a.id)) parejas.push({ alumno: a, referencia: null, tipo: "falso_positivo", solape: 0 });
  }
  const orden = (p: Pareja) => (p.referencia ? referencia.indexOf(p.referencia) : 100 + lesiones.indexOf(p.alumno!));
  return parejas.sort((x, y) => orden(x) - orden(y));
}

function cercania(a: number | null, b: number): number {
  if (a === null) return 0;
  const d = Math.abs(a - b);
  return d === 0 ? 1 : d === 1 ? 0.5 : 0;
}

function media(valores: number[]): number {
  return valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : 0;
}

function acotar(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Lesión «índice» del alumno: la de mayor categoría. */
function indiceAlumno(lesiones: LesionAlumno[]): LesionAlumno | null {
  return [...lesiones].sort((a, b) => (b.pirads ?? 0) - (a.pirads ?? 0))[0] ?? null;
}

/** Evalúa las condiciones de `errores_frecuentes` del caso («pirads=4», «lado=I», …). */
export function cumpleCondicion(condicion: string, caso: Caso, lectura: Lectura, sospechosas: LesionAlumno[]): boolean {
  const [clave, valor] = condicion.split("=");
  switch (clave) {
    case "pirads":
      return lectura.categoria === Number(valor);
    case "decision":
      return lectura.decision === valor;
    case "sin_lesion":
      return sospechosas.length === 0 && caso.lesiones.length > 0;
    case "lesiones":
      return sospechosas.length === Number(valor);
    case "epe":
      return lectura.lesiones.some((l) => l.epe === valor);
    case "lado": {
      const ind = indiceAlumno(sospechosas);
      return ind !== null && ladoDe(ind.sectores) === valor;
    }
    case "zona": {
      const ind = indiceAlumno(sospechosas);
      return ind !== null && zonaPrincipal(ind.sectores) === valor;
    }
    default:
      return false;
  }
}

export const CONDICIONES_CONOCIDAS = ["pirads", "decision", "sin_lesion", "lesiones", "epe", "lado", "zona"];

export function corregir(caso: Caso, lectura: Lectura): Resultado {
  const sospechosas = lectura.lesiones.filter((l) => l.sectores.length > 0 && esSospechosa(l));
  const referencia = caso.lesiones;
  const parejas = emparejar(sospechosas, referencia);
  const emparejadas = parejas.filter((p) => p.alumno && p.referencia);
  const fp = parejas.filter((p) => p.tipo === "falso_positivo").length;
  const hayReferencia = referencia.length > 0;

  const deteccion = hayReferencia
    ? acotar((emparejadas.reduce((s, p) => s + (p.tipo === "coincide" ? 1 : CREDITO_DETECCION_ADYACENTE), 0) - PENALIZACION_FALSO_POSITIVO * fp) / referencia.length)
    : acotar(1 - 0.5 * fp);

  const porReferencia = (f: (p: Pareja) => number) =>
    media(referencia.map((r) => {
      const p = emparejadas.find((x) => x.referencia === r);
      return p ? f(p) : 0;
    }));

  const localizacion = hayReferencia
    ? porReferencia((p) => (p.tipo === "coincide" ? Math.max(CREDITO_ADYACENTE, p.solape) : CREDITO_ADYACENTE))
    : null;

  const secuencias = hayReferencia
    ? porReferencia((p) => {
        const a = p.alumno!;
        const r = p.referencia!;
        return media([cercania(a.t2, r.t2), cercania(a.dwi, r.dwi), a.tamano === r.tamano ? 1 : 0]);
      })
    : null;

  const pirads = cercania(lectura.categoria, caso.categoria_estudio);
  const psad = lectura.psad !== null && Math.abs(lectura.psad - caso.densidad_psa_correcta) <= TOLERANCIA_PSAD + 1e-9 ? 1 : 0;

  const d = caso.decision;
  const elegida = lectura.decision;
  const decisionTipo: Resultado["decision"] = !elegida
    ? "sin_responder"
    : d.correcta.includes(elegida)
      ? "correcta"
      : d.aceptable.includes(elegida)
        ? "aceptable"
        : d.critico_si_elige.includes(elegida)
          ? "critica"
          : "no_preferente";
  const decision = decisionTipo === "correcta" ? 1 : decisionTipo === "aceptable" ? 0.5 : 0;
  const critico = decisionTipo === "critica";

  const valores: Record<Componente, number | null> = { deteccion, localizacion, secuencias, pirads, psad, decision };
  const componentes: ValorComponente[] = (Object.keys(PESOS) as Componente[]).map((clave) => ({
    clave,
    etiqueta: ETIQUETAS[clave],
    peso: PESOS[clave],
    valor: valores[clave],
  }));
  const aplicables = componentes.filter((c) => c.valor !== null);
  const pesoTotal = aplicables.reduce((s, c) => s + c.peso, 0);
  const bruto = aplicables.reduce((s, c) => s + c.peso * (c.valor as number), 0) / pesoTotal;
  const notaSinPenalizacion = Math.round(bruto * 100);
  const nota = Math.max(0, notaSinPenalizacion - (critico ? PENALIZACION_ERROR_CRITICO : 0));

  const comentarios = caso.errores_frecuentes
    .filter((e) => cumpleCondicion(e.si, caso, lectura, sospechosas))
    .map((e) => e.feedback);

  const erroresRegla: Resultado["erroresRegla"] = [];
  for (const l of lectura.lesiones) {
    const esperado = piradsPorRegla(zonaPrincipal(l.sectores), l.t2, l.dwi);
    if (esperado !== null && l.pirads !== null && esperado !== l.pirads) {
      erroresRegla.push({ lesion: l.id, esperado, puesto: l.pirads });
    }
  }

  return {
    nota,
    notaSinPenalizacion,
    critico,
    perfecto: nota >= UMBRAL_PERFECTO && !critico,
    componentes,
    parejas,
    comentarios,
    erroresRegla,
    decision: decisionTipo,
  };
}

/** Densidad de PSA con dos decimales (PSA / volumen). */
export function calcularPsad(psa: number, volumen: number): number {
  return Math.round((psa / volumen) * 100) / 100;
}

export function sectoresValidos(codigos: string[]): boolean {
  return codigos.every((c) => sector(c) !== undefined);
}
