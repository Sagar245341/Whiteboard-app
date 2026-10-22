import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Moon, Sun, X, PenTool } from "lucide-react";

const ThemeContext = createContext(null);
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("sketchter-theme");
    return saved === "light" || saved === "dark"
      ? saved
      : matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("sketchter-theme", theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#111216" : "#f6f7f9");
  }, [theme]);
  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label =
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      className="icon-btn theme-toggle"
      onClick={toggle}
      title={label}
      aria-label={label}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
export function Logo({ onClick, compact = false }) {
  const content = (
    <>
      <span className="logo-mark">
        <PenTool size={19} strokeWidth={2.2} />
      </span>
      {!compact && <span>Sketchter</span>}
    </>
  );
  return onClick ? (
    <button
      className={`brand ${compact ? "compact" : ""}`}
      onClick={onClick}
      aria-label="Sketchter home"
    >
      {content}
    </button>
  ) : (
    <span className={`brand ${compact ? "compact" : ""}`}>{content}</span>
  );
}
export function Modal({ title, children, close, wide = false }) {
  const ref = useRef(null),
    closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement,
      dialog = ref.current;
    const focusable = () =>
      [
        ...dialog.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), textarea, select:not(:disabled), [tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length);
    const initial =
      dialog.querySelector("[autofocus]") ||
      focusable().find(
        (el) => el.tagName === "INPUT" || el.tagName === "TEXTAREA",
      ) ||
      dialog;
    initial.focus();
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items.at(-1);
        if (!first) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    dialog.addEventListener("keydown", key);
    return () => {
      dialog.removeEventListener("keydown", key);
      previous?.isConnected && previous.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <section
        ref={ref}
        tabIndex={-1}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-btn" onClick={close} aria-label="Close">
            <X size={19} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
