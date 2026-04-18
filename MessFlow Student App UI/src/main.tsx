  import { createRoot } from "react-dom/client";
  import App from "./core/App";
  import "./styles/index.css";
  import { AuthProvider } from "./core/auth/AuthContext";
  import { Toaster } from "sonner";

  createRoot(document.getElementById("root")!).render(
    <AuthProvider>
      <App />
      <Toaster position="top-center" theme="dark" />
    </AuthProvider>
  );