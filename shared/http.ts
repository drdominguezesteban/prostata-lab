/** Lee un cuerpo JSON con tope de bytes: rechaza por `content-length` y, si no lo hay, al pasarse leyendo. */
export async function leerJson(request: Request, limite: number): Promise<{ ok: true; cuerpo: unknown } | { ok: false; respuesta: Response }> {
  const demasiado = { ok: false as const, respuesta: respuesta(413, { ok: false, mensaje: "La petición es demasiado grande." }) };
  if (Number(request.headers.get("content-length") ?? "0") > limite) return demasiado;
  const trozos: Uint8Array[] = [];
  let total = 0;
  if (request.body) {
    const lector = request.body.getReader();
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      total += value.byteLength;
      if (total > limite) {
        await lector.cancel();
        return demasiado;
      }
      trozos.push(value);
    }
  }
  const bytes = new Uint8Array(total);
  let pos = 0;
  for (const t of trozos) {
    bytes.set(t, pos);
    pos += t.byteLength;
  }
  try {
    return { ok: true, cuerpo: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, respuesta: respuesta(400, { ok: false, mensaje: "La petición no es JSON." }) };
  }
}

export function respuesta(estado: number, json: unknown): Response {
  return new Response(JSON.stringify(json), {
    status: estado,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
