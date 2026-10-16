import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";

// O link dos e-mails às escolas (?op=<código>) abre só a janela do operacional, sem login.
const codigoOp = new URLSearchParams(window.location.search).get("op");
const App = lazy(() => import("./App.jsx"));
const Operacional = lazy(() => import("./operacional.jsx"));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={null}>{codigoOp ? <Operacional token={codigoOp} /> : <App />}</Suspense>
  </React.StrictMode>
);
