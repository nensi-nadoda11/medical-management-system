import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppProviders } from "./app/providers/AppProviders.tsx";
import { AppRouter } from "./app/router/AppRouter.tsx";
import "./index.css";

// Global override to prevent mouse scroll from changing number input values
document.addEventListener("wheel", (event) => {
  if (
    document.activeElement instanceof HTMLInputElement &&
    document.activeElement.type === "number"
  ) {
    event.preventDefault();
  }
}, { passive: false });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
)
