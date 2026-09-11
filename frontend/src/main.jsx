import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/style.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("No se encontró #root para montar React.");
}

createRoot(rootEl).render(<App />);
