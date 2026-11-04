import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";

// O link dos e-mails às escolas (?op=<código>) abre só a janela do operacional, sem login.
const codigoOp = new URLSearchParams(window.location.search).get("op");
// A app vive toda em "/": qualquer outro caminho (ex.: /xpto) mostra a página 404.
const caminhoValido = ["/", "/index.html"].includes(window.location.pathname);
const App = lazy(() => import("./App.jsx"));
const Operacional = lazy(() => import("./operacional.jsx"));
const NaoEncontrado = lazy(() => import("./naoEncontrado.jsx"));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={null}>{codigoOp ? <Operacional token={codigoOp} /> : caminhoValido ? <App /> : <NaoEncontrado />}</Suspense>
  </React.StrictMode>
);
