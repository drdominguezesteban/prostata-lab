import { catalogo } from "../../shared/servidor";

export const onRequestGet: PagesFunction = () =>
  new Response(JSON.stringify(catalogo()), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" },
  });
