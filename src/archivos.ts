/**
 * Archivos de progreso: recuperar la copia propia, exportarla y reunir las del grupo en el panel docente.
 * Sin DOM, para poder probarlo: las vistas solo pintan lo que devuelve cada función.
 */
import { almacen } from "./almacen";
import { anadirAlGrupo, aplicarNotas, archivoDemasiadoGrande, archivoGrande, exportar, fusionarIntentos, leerExportacion, seudonimoValido } from "../shared/progreso";
import type { NotaRecalculada } from "../shared/servidor";
import type { Lectura } from "../shared/tipos";

/** Lo que se usa de un `File` (así las pruebas pueden pasar objetos simples). */
export interface ArchivoEntrada {
  name: string;
  size: number;
  text(): Promise<string>;
}

export const SIN_ESPACIO =
  "No cabe en el almacenamiento de este navegador y no se ha guardado nada. Libera espacio (por ejemplo, vaciando el panel docente) e inténtalo de nuevo.";
export const SEUDONIMO_NO_VALIDO = "Usa un seudónimo corto (2–24 caracteres, sin correo ni nombre y apellidos).";

/** «Recuperar una copia» en «Mis resultados». `casosValidos` = ids del catálogo (null si no se ha podido cargar). */
export async function recuperarCopia(f: ArchivoEntrada, casosValidos: string[] | null): Promise<{ ok: boolean; mensaje: string }> {
  if (archivoDemasiadoGrande(f.size)) return { ok: false, mensaje: archivoGrande() };
  const r = leerExportacion(await f.text());
  if (!r.ok) return r;
  const validos = casosValidos ? r.datos.intentos.filter((i) => casosValidos.includes(i.caso)) : r.datos.intentos;
  const descartados = r.datos.intentos.length - validos.length;
  const q = almacen.progreso();
  const antes = q.intentos.length;
  q.intentos = fusionarIntentos(q.intentos, validos);
  if (!q.seudonimo && r.datos.seudonimo) q.seudonimo = r.datos.seudonimo;
  if (!almacen.guardarProgreso(q)) return { ok: false, mensaje: SIN_ESPACIO };
  return {
    ok: true,
    mensaje: [
      `Copia recuperada: ${q.intentos.length - antes} intentos nuevos.`,
      descartados ? `${descartados} descartados por ser de casos que no existen.` : "",
      r.seudonimoDescartado ? "El seudónimo del archivo no era válido y no se ha usado." : "",
    ].filter(Boolean).join(" "),
  };
}

/** Guarda el seudónimo escrito en la caja; si no es válido, no se guarda. */
export function guardarSeudonimo(valor: string): { ok: boolean; mensaje: string } {
  const v = valor.trim();
  if (v && !seudonimoValido(v)) return { ok: false, mensaje: SEUDONIMO_NO_VALIDO };
  const q = almacen.progreso();
  q.seudonimo = v;
  return almacen.guardarProgreso(q) ? { ok: true, mensaje: "Guardado." } : { ok: false, mensaje: SIN_ESPACIO };
}

/**
 * «Exportar mi progreso»: con un seudónimo no válido en la caja no se exporta (antes salía el anterior sin avisar).
 * Si el almacén está lleno, se exporta igualmente con el seudónimo de la caja: así el alumno no pierde su progreso.
 */
export function prepararExportacion(valorCaja: string, ahora = new Date()): { ok: true; nombre: string; contenido: string; aviso: string } | { ok: false; mensaje: string } {
  const g = guardarSeudonimo(valorCaja);
  if (!g.ok && g.mensaje === SEUDONIMO_NO_VALIDO) return { ok: false, mensaje: g.mensaje };
  const q = { ...almacen.progreso(), seudonimo: valorCaja.trim() };
  const nombre = `prostata-lab-${(q.seudonimo || "progreso").replace(/[^\p{L}\p{N}_-]+/gu, "-")}-${ahora.toISOString().slice(0, 10)}.json`;
  return { ok: true, nombre, contenido: exportar(q, ahora), aviso: g.mensaje };
}

export type Recorregir = (intentos: Array<{ caso: string; lectura: Lectura }>) => Promise<Array<NotaRecalculada | null>>;

/** Panel docente: lee, verifica en el servidor y añade al grupo varios archivos. Devuelve los mensajes. */
export async function cargarArchivosDocente(archivos: ArchivoEntrada[], recorregir: Recorregir): Promise<string[]> {
  let grupo = almacen.grupo();
  const avisos: string[] = [];
  const exitos = new Set<number>();
  for (const f of archivos) {
    if (archivoDemasiadoGrande(f.size)) {
      avisos.push(`${f.name}: ${archivoGrande()}`);
      continue;
    }
    const r = leerExportacion(await f.text());
    if (!r.ok) {
      avisos.push(`${f.name}: ${r.mensaje}`);
      continue;
    }
    if (r.seudonimoDescartado) {
      avisos.push(`${f.name}: el seudónimo parece un nombre o un correo. No se ha importado; pide al alumno que ponga un seudónimo y vuelva a exportar.`);
      continue;
    }
    // La nota del archivo no se usa: el alumno podría haberla editado. Se corrige de nuevo en el servidor.
    let notas;
    try {
      notas = await recorregir(r.datos.intentos.map((i) => ({ caso: i.caso, lectura: i.lectura })));
    } catch {
      avisos.push(`${f.name}: no se ha podido verificar con el servidor. No se ha importado; inténtalo de nuevo.`);
      continue;
    }
    const v = aplicarNotas(r.datos.intentos, notas);
    if (!v.intentos.length && r.datos.intentos.length) {
      avisos.push(`${f.name}: ningún intento es válido. No se ha importado.`);
      continue;
    }
    const res = anadirAlGrupo(grupo, { ...r.datos, intentos: v.intentos });
    grupo = res.grupo;
    const extra = [
      v.cambiadas ? `${v.cambiadas} con la nota recalculada en el servidor, distinta de la del archivo` : "",
      v.descartados ? `${v.descartados} descartados por no ser válidos` : "",
    ].filter(Boolean).join("; ");
    exitos.add(avisos.push(`${f.name}: ${v.intentos.length} intentos de «${res.seudonimo}»${extra ? ` (${extra})` : ""}.`) - 1);
  }
  if (exitos.size && !almacen.guardarGrupo(grupo)) {
    // Nada de lo leído ha quedado guardado: no se anuncia como importado.
    return [...avisos.filter((_, k) => !exitos.has(k)), `${SIN_ESPACIO} No se ha importado ningún archivo de este lote.`];
  }
  return avisos;
}
