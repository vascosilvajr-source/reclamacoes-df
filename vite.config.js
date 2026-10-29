import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Cada build tem a sua versão; a app compara-a com /versao.json para avisar de atualizações.
const versao = String(Date.now());

export default defineConfig({
  define: { __VERSAO__: JSON.stringify(versao) },
  plugins: [
    react(),
    {
      name: "versao-da-app",
      apply: "build",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "versao.json", source: JSON.stringify({ v: versao }) });
      },
    },
  ],
});
