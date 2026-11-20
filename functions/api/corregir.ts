import { corregirPeticion } from "../../shared/servidor";
import { leerJson, respuesta, segunMetodo } from "../../shared/http";

const LIMITE = 64_000;

export const onRequest: PagesFunction = ({ request }) =>
  segunMetodo(request, {
    POST: async (req) => {
      const r = await leerJson(req, LIMITE);
      if (!r.ok) return r.respuesta;
      const c = corregirPeticion(r.cuerpo);
      return respuesta(c.estado, c.json);
    },
  });
