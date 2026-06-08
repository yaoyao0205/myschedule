import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { PlannerSPA } from "../app/PlannerSPA"
import { PlannerProvider } from "../store/plannerStore"
import "../index.css"

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PlannerProvider>
      <PlannerSPA pageId="lists" />
    </PlannerProvider>
  </StrictMode>
)
