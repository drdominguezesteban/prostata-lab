import { corregirPeticion } from "../../shared/servidor";

const LIMITE = 64_000;

export const onRequestPost: PagesFunction = async ({ request }) => {
  const texto = await request.text();
  if (texto.length > LIMITE) return respuesta(413, { ok: false, mensaje: "La lectura es demasiado grande." });
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    return respuesta(400, { ok: false, mensaje: "La lectura no es JSON." });
  }
  const r = corregirPeticion(cuerpo);
  return respuesta(r.estado, r.json);
};

function respuesta(estado: number, json: unknown): Response {
  return new Response(JSON.stringify(json), {
    status: estado,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
