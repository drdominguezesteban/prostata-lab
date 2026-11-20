import { MAX_BYTES_LOTE } from "../../shared/limites";
import { recorregirLote } from "../../shared/servidor";
import { leerJson, respuesta } from "../../shared/http";

const LIMITE = MAX_BYTES_LOTE;

export const onRequestPost: PagesFunction = async ({ request }) => {
  const r = await leerJson(request, LIMITE);
  if (!r.ok) return r.respuesta;
  const c = recorregirLote(r.cuerpo);
  return respuesta(c.estado, c.json);
};
