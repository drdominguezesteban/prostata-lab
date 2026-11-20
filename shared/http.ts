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

/** Método no admitido en una ruta de la API: 405 en JSON con la cabecera `Allow`. */
export function metodoNoPermitido(permitidos: string[]): Response {
  const r = respuesta(405, { ok: false, mensaje: `Método no permitido. Usa ${permitidos.join(" o ")}.` });
  r.headers.set("allow", permitidos.join(", "));
  return r;
}

/** Ruta de la API que no existe: 404 en JSON (no la portada de la web). */
export function noEncontrado(): Response {
  return respuesta(404, { ok: false, mensaje: "No existe esa ruta de la API." });
}

/**
 * Reparte una petición según su método. HEAD responde como GET sin cuerpo; el resto, 405.
 * Una sola función por ruta (`onRequest`) evita que Pages pase los otros métodos a la web estática.
 */
export async function segunMetodo(request: Request, manejadores: Partial<Record<"GET" | "POST", (r: Request) => Response | Promise<Response>>>): Promise<Response> {
  const metodo = request.method.toUpperCase();
  const permitidos = Object.keys(manejadores);
  if (manejadores.GET && metodo === "HEAD") {
    const r = await manejadores.GET(request);
    return new Response(null, { status: r.status, headers: r.headers });
  }
  const m = manejadores[metodo as "GET" | "POST"];
  if (!m) return metodoNoPermitido(manejadores.GET ? [...permitidos, "HEAD"] : permitidos);
  return m(request);
}
