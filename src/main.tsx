import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import { prepareOAuthCallback } from "@/lib/oauthHandoff";
import App from "./App.tsx";
import "./index.css";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

const oauthHandoff = prepareOAuthCallback({
  href: window.location.href,
  namespace: convex.url,
  storage: window.localStorage,
});
if (oauthHandoff.previousRefreshToken) {
  void convex
    .mutation(api.auth.signOut, {
      refreshToken: oauthHandoff.previousRefreshToken,
    })
    .catch(() => {});
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class">
      <ConvexAuthProvider client={convex} api={api.auth}>
        <App />
      </ConvexAuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
