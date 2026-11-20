/**
 * Progreso del alumno (se guarda en su navegador) y agregados del panel docente (que reúne los
 * archivos que exportan los alumnos). Sin nombres: solo un seudónimo que elige el alumno.
 */
import { PESOS, type Componente, type Resultado } from "./puntuacion";
import type { Lectura } from "./tipos";

export const FORMATO = "prostata-lab-progreso";
export const VERSION = 1;

export interface Intento {
  id: string;
  caso: string;
  fin: string;
  segundos: number;
  lectura: Lectura;
  nota: number;
  critico: boolean;
  perfecto: boolean;
  componentes: Partial<Record<Componente, number | null>>;
}

export interface Progreso {
  version: 1;
  seudonimo: string;
  intentos: Intento[];
}

export interface Exportacion extends Progreso {
  formato: typeof FORMATO;
  exportado: string;
}

export function progresoVacio(): Progreso {
  return { version: 1, seudonimo: "", intentos: [] };
}

export function intentoDesde(caso: string, lectura: Lectura, r: Resultado, segundos: number, fin = new Date()): Intento {
  const componentes: Intento["componentes"] = {};
  for (const c of r.componentes) componentes[c.clave] = c.valor;
  return {
    id: `${caso}-${fin.getTime().toString(36)}`,
    caso,
    fin: fin.toISOString(),
    segundos: Math.max(0, Math.round(segundos)),
    lectura,
    nota: r.nota,
    critico: r.critico,
    perfecto: r.perfecto,
    componentes,
  };
}

/** Un seudónimo no puede parecer un nombre completo ni llevar datos de contacto. */
export function seudonimoValido(s: string): boolean {
  const t = s.trim();
  return t.length >= 2 && t.length <= 24 && /^[\p{L}\p{N} ._-]+$/u.test(t) && !/@/.test(t) && t.split(/\s+/).length <= 2;
}

export function exportar(p: Progreso, ahora = new Date()): string {
  const e: Exportacion = { formato: FORMATO, version: 1, seudonimo: p.seudonimo, exportado: ahora.toISOString(), intentos: p.intentos };
  return JSON.stringify(e, null, 1);
}

const finito = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const esObjeto = (o: unknown): o is Record<string, unknown> => !!o && typeof o === "object" && !Array.isArray(o);

const nuloOFinito = (n: unknown) => n === null || finito(n);
const nuloOTexto = (t: unknown) => t === null || typeof t === "string";

function esLesion(x: unknown): boolean {
  if (!esObjeto(x)) return false;
  const m = x.marca;
  return (
    typeof x.id === "string" &&
    Array.isArray(x.sectores) &&
    x.sectores.every((c) => typeof c === "string") &&
    nuloOFinito(x.t2) &&
    nuloOFinito(x.dwi) &&
    nuloOFinito(x.pirads) &&
    nuloOTexto(x.tamano) &&
    nuloOTexto(x.epe) &&
    (m === null || (esObjeto(m) && finito(m.corte) && finito(m.x) && finito(m.y)))
  );
}

function esLectura(x: unknown): boolean {
  return (
    esObjeto(x) &&
    nuloOFinito(x.psad) &&
    nuloOFinito(x.categoria) &&
    nuloOTexto(x.decision) &&
    typeof x.impresion === "string" &&
    Array.isArray(x.lesiones) &&
    x.lesiones.every(esLesion)
  );
}

/** Valida a fondo: un intento dañado en un archivo o en el almacén no debe romper ninguna vista. */
export function esIntento(x: unknown): x is Intento {
  if (!esObjeto(x)) return false;
  const i = x as unknown as Intento;
  return (
    typeof i.id === "string" &&
    typeof i.caso === "string" &&
    typeof i.fin === "string" &&
    !Number.isNaN(Date.parse(i.fin)) &&
    finito(i.segundos) &&
    finito(i.nota) &&
    typeof i.critico === "boolean" &&
    esLectura(i.lectura) &&
    esObjeto(i.componentes) &&
    Object.values(i.componentes).every((v) => v === null || finito(v))
  );
}

/** Lo leído del almacén: se descartan los intentos dañados en vez de fallar. */
export function sanearProgreso(x: unknown): Progreso {
  if (!esObjeto(x) || !Array.isArray(x.intentos)) return progresoVacio();
  return { version: 1, seudonimo: typeof x.seudonimo === "string" ? x.seudonimo : "", intentos: x.intentos.filter(esIntento) };
}

export function sanearGrupo(x: unknown): Grupo {
  const g = grupoVacio();
  if (!esObjeto(x) || !esObjeto(x.alumnos)) return g;
  for (const [s, a] of Object.entries(x.alumnos)) {
    if (!esObjeto(a) || !Array.isArray(a.intentos)) continue;
    // defineProperty: un seudónimo como «__proto__» se guarda como clave propia.
    Object.defineProperty(g.alumnos, s, { enumerable: true, writable: true, configurable: true, value: { importado: typeof a.importado === "string" ? a.importado : "", intentos: a.intentos.filter(esIntento) } });
  }
  return g;
}

export function leerExportacion(textoJson: string): { ok: true; datos: Exportacion } | { ok: false; mensaje: string } {
  let d: unknown;
  try {
    d = JSON.parse(textoJson);
  } catch {
    return { ok: false, mensaje: "El archivo no es JSON." };
  }
  const e = d as Exportacion;
  if (!e || e.formato !== FORMATO) return { ok: false, mensaje: "No es un archivo de progreso de Próstata Lab." };
  if (e.version !== VERSION) return { ok: false, mensaje: "Versión de archivo no reconocida." };
  if (!Array.isArray(e.intentos) || !e.intentos.every(esIntento)) return { ok: false, mensaje: "El archivo tiene intentos dañados." };
  return { ok: true, datos: { ...e, seudonimo: typeof e.seudonimo === "string" ? e.seudonimo.trim() : "" } };
}

/** Une dos listas de intentos sin duplicar (por id), en orden cronológico. */
export function fusionarIntentos(a: Intento[], b: Intento[]): Intento[] {
  const mapa = new Map<string, Intento>();
  for (const i of [...a, ...b]) mapa.set(i.id, i);
  return [...mapa.values()].sort((x, y) => x.fin.localeCompare(y.fin));
}

/** Último intento de cada caso. */
export function ultimos(intentos: Intento[]): Map<string, Intento> {
  const m = new Map<string, Intento>();
  for (const i of [...intentos].sort((x, y) => x.fin.localeCompare(y.fin))) m.set(i.caso, i);
  return m;
}

export interface Resumen {
  casos: number;
  intentos: number;
  notaMedia: number | null;
  criticos: number;
  perfectos: number;
  minutos: number;
  /** Media de cada componente (0–1) en el último intento de cada caso. */
  componentes: Partial<Record<Componente, number>>;
  /** Componente más flojo, si hay datos. */
  flojo: Componente | null;
}

export function resumir(intentos: Intento[]): Resumen {
  const u = [...ultimos(intentos).values()];
  const componentes: Resumen["componentes"] = {};
  let flojo: Componente | null = null;
  for (const clave of Object.keys(PESOS) as Componente[]) {
    const vals = u.map((i) => i.componentes[clave]).filter((v): v is number => typeof v === "number");
    if (vals.length) {
      componentes[clave] = vals.reduce((s, v) => s + v, 0) / vals.length;
      if (flojo === null || (componentes[clave] as number) < (componentes[flojo] as number)) flojo = clave;
    }
  }
  return {
    casos: u.length,
    intentos: intentos.length,
    notaMedia: u.length ? Math.round(u.reduce((s, i) => s + i.nota, 0) / u.length) : null,
    criticos: u.filter((i) => i.critico).length,
    perfectos: u.filter((i) => i.perfecto).length,
    minutos: Math.round(intentos.reduce((s, i) => s + i.segundos, 0) / 60),
    componentes,
    flojo,
  };
}

/** Primer intento frente al último en los casos repetidos (aprendizaje). */
export function mejoraEnRepetidos(intentos: Intento[]): { casos: number; primero: number; ultimo: number } | null {
  const porCaso = new Map<string, Intento[]>();
  for (const i of [...intentos].sort((x, y) => x.fin.localeCompare(y.fin))) {
    porCaso.set(i.caso, [...(porCaso.get(i.caso) ?? []), i]);
  }
  const repetidos = [...porCaso.values()].filter((l) => l.length > 1);
  if (!repetidos.length) return null;
  const m = (f: (l: Intento[]) => number) => Math.round(repetidos.reduce((s, l) => s + f(l), 0) / repetidos.length);
  return { casos: repetidos.length, primero: m((l) => l[0]!.nota), ultimo: m((l) => l[l.length - 1]!.nota) };
}

// ── Panel docente ──────────────────────────────────────────────────────────────

export interface Grupo {
  version: 1;
  alumnos: Record<string, { importado: string; intentos: Intento[] }>;
}

export function grupoVacio(): Grupo {
  return { version: 1, alumnos: {} };
}

export function anadirAlGrupo(g: Grupo, e: Exportacion, ahora = new Date()): { grupo: Grupo; seudonimo: string } {
  let seudonimo = e.seudonimo;
  for (let n = Object.keys(g.alumnos).length + 1; !seudonimo || (!e.seudonimo && Object.hasOwn(g.alumnos, seudonimo)); n++) seudonimo = `Sin seudónimo ${n}`;
  const previo = Object.hasOwn(g.alumnos, seudonimo) ? g.alumnos[seudonimo]!.intentos : [];
  return {
    grupo: {
      ...g,
      alumnos: { ...g.alumnos, [seudonimo]: { importado: ahora.toISOString(), intentos: fusionarIntentos(previo, e.intentos) } },
    },
    seudonimo,
  };
}

export interface FilaCaso {
  caso: string;
  alumnos: number;
  notaMedia: number | null;
  criticos: number;
  flojo: Componente | null;
}

export function resumenPorCaso(g: Grupo, casos: string[]): FilaCaso[] {
  return casos.map((caso) => {
    const intentos = Object.values(g.alumnos)
      .map((a) => ultimos(a.intentos).get(caso))
      .filter((i): i is Intento => !!i);
    const r = resumir(intentos);
    return { caso, alumnos: intentos.length, notaMedia: r.notaMedia, criticos: r.criticos, flojo: r.flojo };
  });
}

export function csvGrupo(g: Grupo, casos: string[]): string {
  const cab = ["seudonimo", "casos", "intentos", "nota_media", "criticos", "perfectos", "minutos", ...casos.map((c) => `nota_${c}`)];
  const filas = Object.entries(g.alumnos).map(([s, a]) => {
    const r = resumir(a.intentos);
    const u = ultimos(a.intentos);
    return [s, r.casos, r.intentos, r.notaMedia ?? "", r.criticos, r.perfectos, r.minutos, ...casos.map((c) => u.get(c)?.nota ?? "")];
  });
  const esc = (v: unknown) => {
    const t = String(v);
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return [cab, ...filas].map((f) => f.map(esc).join(";")).join("\n") + "\n";
}

/** Sustituye la puntuación del archivo por la recalculada en el servidor (`null` = intento no válido). */
export function aplicarNotas(
  intentos: Intento[],
  notas: Array<Pick<Intento, "nota" | "critico" | "perfecto" | "componentes"> | null>,
): { intentos: Intento[]; cambiadas: number; descartados: number } {
  const r: Intento[] = [];
  let cambiadas = 0;
  intentos.forEach((i, k) => {
    const n = notas[k];
    if (!n) return;
    if (n.nota !== i.nota || n.critico !== i.critico) cambiadas++;
    r.push({ ...i, nota: n.nota, critico: n.critico, perfecto: n.perfecto, componentes: n.componentes });
  });
  return { intentos: r, cambiadas, descartados: intentos.length - r.length };
}
