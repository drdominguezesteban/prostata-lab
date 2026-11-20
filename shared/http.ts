/** Lee un cuerpo JSON con límite de tamaño; rechaza antes de leer si `content-length` ya lo supera. */
export async function leerJson(request: Request, limite: number): Promise<{ ok: true; cuerpo: unknown } | { ok: false; respuesta: Response }> {
  const declarado = Number(request.headers.get("content-length") ?? "0");
  if (declarado > limite) return { ok: false, respuesta: respuesta(413, { ok: false, mensaje: "La petición es demasiado grande." }) };
  const texto = await request.text();
  if (texto.length > limite) return { ok: false, respuesta: respuesta(413, { ok: false, mensaje: "La petición es demasiado grande." }) };
  try {
    return { ok: true, cuerpo: JSON.parse(texto) };
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
