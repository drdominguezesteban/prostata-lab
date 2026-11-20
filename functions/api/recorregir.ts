import { recorregirLote } from "../../shared/servidor";
import { leerJson, respuesta } from "../../shared/http";

// Hasta MAX_LOTE intentos de unos pocos kB cada uno.
const LIMITE = 1_500_000;

export const onRequestPost: PagesFunction = async ({ request }) => {
  const r = await leerJson(request, LIMITE);
  if (!r.ok) return r.respuesta;
  const c = recorregirLote(r.cuerpo);
  return respuesta(c.estado, c.json);
};
