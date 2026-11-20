/**
 * Lo que solo ve el servidor: las respuestas del autor. El navegador recibe el catálogo público
 * (sin respuestas) y la referencia completa solo después de enviar una lectura.
 * Lo usan las funciones de Cloudflare Pages y el servidor de desarrollo de Vite.
 */
import casosJson from "../datos/casos.json";
import geometriaJson from "../datos/geometria.json";
import { faltantesLectura } from "./faltantes";
import { MAX_LOTE } from "./limites";
import { corregir, type Componente, type Resultado } from "./puntuacion";
import { esSector, legibilizar } from "./sectores";
import type { Caso, Epe, LesionAlumno, Lectura, OpcionDecision, Tamano } from "./tipos";

const CASOS = casosJson as unknown as Caso[];
const GEOMETRIA = geometriaJson as unknown as Record<string, Geometria>;

export interface Geometria {
  lesiones: Array<{ id: string; cortes: number[]; corte_referencia: number; contornos_px: Record<string, number[][][]> }>;
}

export interface CasoPublico {
  id: string;
  numero: number;
  nivel: number;
  edad: number;
  psa: number;
  volumen: number;
  contexto_docente: Caso["contexto_docente"];
  aviso_contexto: string;
  opciones: OpcionDecision[];
  tecnica: Caso["tecnica"];
  zonal: boolean;
}

/** Casos con máscara zonal de PI-CAI (Módulo 1). */
const CON_ZONAL = new Set(["10807_1000823", "11032_1001052", "11137_1001160", "11260_1001283", "11377_1001400"]);

export function catalogo(): CasoPublico[] {
  return CASOS.map((c) => ({
    id: c.id,
    numero: c.numero,
    nivel: c.nivel,
    edad: c.contexto_real.edad,
    psa: c.contexto_real.psa_ng_ml,
    volumen: c.contexto_real.volumen_ml,
    contexto_docente: c.contexto_docente,
    aviso_contexto: c.aviso_contexto,
    opciones: c.decision.opciones,
    tecnica: c.tecnica,
    zonal: CON_ZONAL.has(c.id),
  }));
}

export interface Referencia {
  categoria: number;
  psad: number;
  lesiones: Caso["lesiones"];
  decision: Caso["decision"];
  informe: string;
  desenlace: string;
  estrato: string;
  medicion: string | null;
  geometria: Geometria;
}

export interface RespuestaCorreccion {
  ok: true;
  resultado: Resultado;
  referencia: Referencia;
}

const ESTRATOS: Record<string, string> = {
  histologia_positiva: "histología positiva",
  biopsia_negativa: "biopsia negativa",
  sin_biopsia_seguimiento_no_documentado: "sin biopsia; seguimiento no documentado",
};

function numero(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

/** Puntuaciones PI-RADS, T2 y DWI: solo enteros (2,5 no es una categoría). */
function entero(v: unknown, min: number, max: number): number | null {
  return Number.isInteger(v) ? numero(v, min, max) : null;
}

function texto(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/** Valida y limpia la lectura que llega del navegador. */
export function limpiarLectura(entrada: unknown): Lectura | null {
  if (!entrada || typeof entrada !== "object") return null;
  const e = entrada as Record<string, unknown>;
  const lesiones = Array.isArray(e.lesiones) ? e.lesiones.slice(0, 6) : [];
  const limpias: LesionAlumno[] = [];
  const ids = new Set<string>();
  for (const [i, bruta] of lesiones.entries()) {
    if (!bruta || typeof bruta !== "object") continue;
    const l = bruta as Record<string, unknown>;
    const sectores = Array.isArray(l.sectores)
      ? [...new Set(l.sectores.filter((s): s is string => typeof s === "string" && esSector(s)))].slice(0, 12)
      : [];
    const m = l.marca as Record<string, unknown> | null | undefined;
    const corte = m ? numero(m.corte, 0, 200) : null;
    const x = m ? numero(m.x, 0, 1000) : null;
    const y = m ? numero(m.y, 0, 1000) : null;
    let id = texto(l.id, 8) || `L${i + 1}`;
    // Ids únicos: una lesión repetida no puede esquivar la penalización por falso positivo.
    for (let n = 1; ids.has(id); n++) id = `L${i + 1}#${n}`;
    ids.add(id);
    limpias.push({
      id,
      sectores,
      t2: entero(l.t2, 1, 5),
      dwi: entero(l.dwi, 1, 5),
      tamano: l.tamano === "<1.5" || l.tamano === ">=1.5" ? (l.tamano as Tamano) : null,
      epe: l.epe === "no" || l.epe === "definida" ? (l.epe as Epe) : null,
      pirads: entero(l.pirads, 1, 5),
      marca: corte !== null && x !== null && y !== null ? { corte, x, y } : null,
    });
  }
  return {
    psad: numero(e.psad, 0, 10),
    lesiones: limpias,
    categoria: entero(e.categoria, 1, 5),
    decision: typeof e.decision === "string" && /^[a-z]$/.test(e.decision) ? e.decision : null,
    impresion: texto(e.impresion, 4000),
  };
}

export function casoPorId(id: string): Caso | undefined {
  return CASOS.find((c) => c.id === id);
}

/**
 * La referencia solo se entrega tras una lectura completa, igual que exige el formulario:
 * densidad de PSA, cada lesión con sector y categoría, categoría del estudio y decisión.
 * Los criterios están en `shared/faltantes.ts`, que usa también el navegador; aquí solo se
 * forma el mensaje de la primera falta.
 */
export function faltaEnLectura(l: Lectura, caso?: Caso): string | null {
  const f = faltantesLectura(l, caso?.decision.opciones)[0];
  if (!f) return null;
  switch (f.campo) {
    case "psad": return "Falta la densidad de PSA.";
    case "sectores":
    case "pirads": return `Falta el sector o la categoría de ${f.lesion}.`;
    case "categoria": return "Falta la categoría PI-RADS del estudio.";
    case "decision": return "Falta la decisión clínica.";
    case "opcion": return "Esa decisión no es una de las opciones del caso.";
  }
}

export interface NotaRecalculada {
  nota: number;
  critico: boolean;
  perfecto: boolean;
  componentes: Partial<Record<Componente, number | null>>;
}

/**
 * Panel docente: vuelve a corregir en el servidor los intentos importados para no fiarse de la nota
 * que trae el archivo. Solo devuelve puntuaciones, nunca la referencia. `null` = intento no válido.
 */
export function recorregirLote(cuerpo: unknown): { estado: number; json: { ok: true; notas: Array<NotaRecalculada | null> } | { ok: false; mensaje: string } } {
  const intentos = (cuerpo as { intentos?: unknown } | null)?.intentos;
  if (!Array.isArray(intentos)) return { estado: 400, json: { ok: false, mensaje: "Faltan los intentos." } };
  if (intentos.length > MAX_LOTE) return { estado: 413, json: { ok: false, mensaje: `Como máximo ${MAX_LOTE} intentos por vez.` } };
  const notas = intentos.map((i): NotaRecalculada | null => {
    const e = i as { caso?: unknown; lectura?: unknown } | null;
    const caso = typeof e?.caso === "string" ? casoPorId(e.caso) : undefined;
    const lectura = caso ? limpiarLectura(e?.lectura) : null;
    if (!caso || !lectura || faltaEnLectura(lectura, caso)) return null;
    const r = corregir(caso, lectura);
    const componentes: NotaRecalculada["componentes"] = {};
    for (const c of r.componentes) componentes[c.clave] = c.valor;
    return { nota: r.nota, critico: r.critico, perfecto: r.perfecto, componentes };
  });
  return { estado: 200, json: { ok: true, notas } };
}

export function corregirPeticion(cuerpo: unknown): { estado: number; json: RespuestaCorreccion | { ok: false; mensaje: string } } {
  const c = cuerpo as { caso?: unknown; lectura?: unknown } | null;
  const caso = typeof c?.caso === "string" ? casoPorId(c.caso) : undefined;
  if (!caso) return { estado: 404, json: { ok: false, mensaje: "No encuentro ese caso." } };
  const lectura = limpiarLectura(c?.lectura);
  if (!lectura) return { estado: 400, json: { ok: false, mensaje: "La lectura no tiene un formato válido." } };
  const falta = faltaEnLectura(lectura, caso);
  if (falta) return { estado: 422, json: { ok: false, mensaje: falta } };
  const resultado = corregir(caso, lectura);
  return {
    estado: 200,
    json: {
      ok: true,
      resultado,
      referencia: {
        categoria: caso.categoria_estudio,
        psad: caso.densidad_psa_correcta,
        lesiones: caso.lesiones.map((l) => ({ ...l, explicacion: legibilizar(l.explicacion) })),
        decision: caso.decision,
        informe: legibilizar(caso.informe_referencia),
        desenlace: caso.desenlace_real,
        estrato: ESTRATOS[caso.estrato_referencia] ?? caso.estrato_referencia.replace(/_/g, " "),
        medicion: caso.medicion,
        geometria: GEOMETRIA[caso.id] ?? { lesiones: [] },
      },
    },
  };
}
