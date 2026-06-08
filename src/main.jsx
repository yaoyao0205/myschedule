import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { PlannerSPA } from "./app/PlannerSPA"
import { PlannerProvider } from "./store/plannerStore"

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PlannerProvider>
      <PlannerSPA pageId="today" />
    </PlannerProvider>
  </StrictMode>
)
