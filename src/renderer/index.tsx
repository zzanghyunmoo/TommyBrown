import { createRoot } from "react-dom/client";
import { App } from "./app";
import { Showcase } from "./components/showcase";
import { initializeTheme } from "./theme";
import "./styles.css";
import "./workspace.css";
import "./documents.css";
import "./terminals.css";
import "./browser.css";
import "./connectors.css";
import "./workbench.css";
import "./model-mappings.css";
import "./settings.css";

if (import.meta.env.DEV) {
  void import("react-grab");
  void import("react-scan");
}
const root = document.getElementById("root");
if (!root) throw new Error("The application mount point is missing.");
void initializeTheme()
  .then(() => {
    createRoot(root).render(
      new URLSearchParams(location.search).has("showcase") ? (
        <Showcase />
      ) : (
        <App />
      ),
    );
  })
  .catch(() => {
    document.documentElement.dataset["theme"] = "light";
    root.textContent =
      "화면 설정을 불러오지 못했습니다. 앱을 다시 열어 주세요.";
  });
