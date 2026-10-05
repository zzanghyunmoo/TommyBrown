import { createRoot } from "react-dom/client";
import { App } from "./app";
import { Showcase } from "./components/showcase";
import "./styles.css";
import "./workspace.css";
import "./documents.css";
import "./terminals.css";
import "./browser.css";
import "./connectors.css";
import "./workbench.css";

if (import.meta.env.DEV) {
  void import("react-grab");
  void import("react-scan");
}
const root = document.getElementById("root");
if (!root) throw new Error("The application mount point is missing.");
createRoot(root).render(
  new URLSearchParams(location.search).has("showcase") ? <Showcase /> : <App />,
);
