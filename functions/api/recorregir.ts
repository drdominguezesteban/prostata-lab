import { MAX_BYTES_LOTE } from "../../shared/limites";
import { recorregirLote } from "../../shared/servidor";
import { leerJson, respuesta, segunMetodo } from "../../shared/http";

const LIMITE = MAX_BYTES_LOTE;

export const onRequest: PagesFunction = ({ request }) =>
  segunMetodo(request, {
    POST: async (req) => {
      const r = await leerJson(req, LIMITE);
      if (!r.ok) return r.respuesta;
      const c = recorregirLote(r.cuerpo);
      return respuesta(c.estado, c.json);
    },
  });
