import { createRoot } from "react-dom/client";
import "./lib/errorLogger";  // Global error + rejection logging (must be early)
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
// sync f6858ca
// deploy-force-1744325400
