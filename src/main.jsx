import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api";
import { neonAuth } from "./auth-client";
import { Landing, Auth, Dashboard } from "./pages";
import Board from "./Board";
import { Logo, ThemeProvider } from "./ui";
import "./styles.css";

function App() {
  const [route, setRoute] = useState(location.pathname);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  function navigate(path) {
    history.pushState({}, "", path);
    setRoute(path);
  }
  useEffect(() => {
    const pop = () => setRoute(location.pathname);
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (localStorage.getItem("canvas-token"))
      api("/me")
        .then(setUser)
        .catch(() => localStorage.removeItem("canvas-token"))
        .finally(() => setLoading(false));
    else setLoading(false);
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    document.title = route.startsWith("/board/")
      ? "Whiteboard · Sketchter"
      : route === "/dashboard"
        ? "Your whiteboards · Sketchter"
        : route === "/login"
          ? "Sign in · Sketchter"
          : route === "/register"
            ? "Create account · Sketchter"
            : "Sketchter — Think visually. Build together.";
  }, [route]);
  function authenticated(result) {
    localStorage.setItem("canvas-token", result.token);
    setUser(result.user);
    const target = sessionStorage.getItem("canvas-return");
    sessionStorage.removeItem("canvas-return");
    navigate(target || "/dashboard");
  }
  function signOut() {
    neonAuth?.signOut().catch(() => {});
    localStorage.removeItem("canvas-token");
    setUser(null);
    navigate("/");
  }
  if (loading)
    return (
      <div className="loading-page">
        <Logo />
        <p>Loading your workspace…</p>
      </div>
    );
  let content;
  if (route.startsWith("/board/")) {
    if (!user) {
      sessionStorage.setItem("canvas-return", route);
      content = <Auth onSuccess={authenticated} navigate={navigate} />;
    } else
      content = (
        <Board
          id={route.split("/")[2]}
          user={user}
          navigate={navigate}
          notify={setToast}
        />
      );
  } else if (route === "/dashboard")
    content = user ? (
      <Dashboard
        user={user}
        navigate={navigate}
        signOut={signOut}
        notify={setToast}
      />
    ) : (
      <Auth onSuccess={authenticated} navigate={navigate} />
    );
  else if (route === "/login" || route === "/register")
    content = (
      <Auth
        register={route === "/register"}
        onSuccess={authenticated}
        navigate={navigate}
      />
    );
  else content = <Landing navigate={navigate} user={user} />;
  return (
    <>
      {content}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
);
