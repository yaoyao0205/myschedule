import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter, HashRouter } from "react-router-dom"
import { App } from "./app/App"
import { ToastProvider } from "./components/ui/ToastProvider"
import "./styles/index.css"

const Router = window.location.protocol === "file:" ? HashRouter : BrowserRouter

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ToastProvider>
      <Router>
        <App />
      </Router>
    </ToastProvider>
  </React.StrictMode>
)
