import { catalogo } from "../../shared/servidor";
import { segunMetodo } from "../../shared/http";

export const onRequest: PagesFunction = ({ request }) =>
  segunMetodo(request, {
    GET: () =>
      new Response(JSON.stringify(catalogo()), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" },
      }),
  });
