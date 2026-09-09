import { useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { initApp } from "./app.js";
import "./styles/style.css";

function Root() {
  useLayoutEffect(() => {
    initApp();
  }, []);
  return <App />;
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("No se encontró #root para montar React.");
}

createRoot(rootEl).render(<Root />);
