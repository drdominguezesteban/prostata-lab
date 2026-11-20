import { defineConfig, type Plugin } from "vite";
import { catalogo, corregirPeticion, recorregirLote } from "./shared/servidor";

/** En `vite` no hay funciones de Pages: el mismo código responde desde el servidor de desarrollo. */
function apiLocal(): Plugin {
  return {
    name: "prostata-lab-api-local",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const ruta = req.url?.split("?")[0] ?? "";
        res.setHeader("content-type", "application/json; charset=utf-8");
        if (ruta === "/api/casos" && req.method === "GET") {
          res.end(JSON.stringify(catalogo()));
          return;
        }
        const manejador = req.method === "POST" ? { "/api/corregir": corregirPeticion, "/api/recorregir": recorregirLote }[ruta] : undefined;
        if (manejador) {
          let cuerpo = "";
          req.on("data", (d: Buffer) => (cuerpo += d.toString("utf-8")));
          req.on("end", () => {
            try {
              const r = manejador(JSON.parse(cuerpo));
              res.statusCode = r.estado;
              res.end(JSON.stringify(r.json));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, mensaje: "La petición no es JSON." }));
            }
          });
          return;
        }
        res.removeHeader("content-type");
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [apiLocal()],
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
});
