import type { CasoPublico, RespuestaCorreccion } from "../shared/servidor";
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
