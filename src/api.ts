import { MAX_BYTES_LOTE, MAX_LOTE } from "../shared/limites";
import type { CasoPublico, NotaRecalculada, RespuestaCorreccion } from "../shared/servidor";
import type { Lectura } from "../shared/tipos";

let cache: Promise<CasoPublico[]> | null = null;

export function casos(): Promise<CasoPublico[]> {
  cache ??= fetch("/api/casos")
    .then((r) => {
      if (!r.ok) throw new Error("catálogo");
      return r.json() as Promise<CasoPublico[]>;
    })
    .catch((e) => {
      cache = null;
      throw e;
    });
  return cache;
}

export async function corregir(caso: string, lectura: Lectura): Promise<RespuestaCorreccion> {
  const r = await fetch("/api/corregir", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ caso, lectura }),
  });
  const json = (await r.json()) as RespuestaCorreccion | { ok: false; mensaje: string };
  if (!json.ok) throw new Error(json.mensaje);
  return json;
}

/**
 * Vuelve a corregir intentos en el servidor, por lotes que caben en el límite de número y de bytes.
 * La impresión libre no se envía: no puntúa y no tiene por qué salir del navegador.
 */
export async function recorregir(intentos: Array<{ caso: string; lectura: Lectura }>): Promise<Array<NotaRecalculada | null>> {
  const piezas = intentos.map((i) => JSON.stringify({ caso: i.caso, lectura: { ...i.lectura, impresion: "" } }));
  const notas: Array<NotaRecalculada | null> = [];
  let lote: string[] = [];
  let bytes = 0;
  const enviar = async () => {
    if (!lote.length) return;
    const r = await fetch("/api/recorregir", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: `{"intentos":[${lote.join(",")}]}`,
    });
    const json = (await r.json()) as { ok: true; notas: Array<NotaRecalculada | null> } | { ok: false; mensaje: string };
    if (!json.ok) throw new Error(json.mensaje);
    notas.push(...json.notas);
    lote = [];
    bytes = 0;
  };
  for (const p of piezas) {
    const n = new TextEncoder().encode(p).length + 1;
    if (lote.length >= MAX_LOTE || bytes + n > MAX_BYTES_LOTE - 64) await enviar();
    lote.push(p);
    bytes += n;
  }
  await enviar();
  return notas;
}
