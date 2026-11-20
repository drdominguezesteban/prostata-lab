import { MAX_LOTE } from "../shared/limites";
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

/** Vuelve a corregir intentos en el servidor (por lotes). Solo devuelve puntuaciones. */
export async function recorregir(intentos: Array<{ caso: string; lectura: Lectura }>): Promise<Array<NotaRecalculada | null>> {
  const notas: Array<NotaRecalculada | null> = [];
  for (let i = 0; i < intentos.length; i += MAX_LOTE) {
    const r = await fetch("/api/recorregir", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intentos: intentos.slice(i, i + MAX_LOTE) }),
    });
    const json = (await r.json()) as { ok: true; notas: Array<NotaRecalculada | null> } | { ok: false; mensaje: string };
    if (!json.ok) throw new Error(json.mensaje);
    notas.push(...json.notas);
  }
  return notas;
}
