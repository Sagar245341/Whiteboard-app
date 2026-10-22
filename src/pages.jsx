import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Plus,
  Search,
  LayoutGrid,
  Clock3,
  Users,
  LogOut,
  MoreHorizontal,
  Sparkles,
  MousePointer2,
  StickyNote,
  Shapes,
  ArrowUpRight,
  LoaderCircle,
  X,
  PenLine,
  Copy,
  Trash2,
  GitBranch,
  PanelTop,
  ArrowDownUp,
  Check,
  ChevronRight,
  Layers3,
} from "lucide-react";
import { api } from "./api";
import { neonAuth } from "./auth-client";
import { MiniBoard, templateElements } from "./elements";
import { Logo, Modal, ThemeToggle } from "./ui";
export { Logo, Modal } from "./ui";

const templates = [
  {
    kind: "blank",
    title: "Blank canvas",
    description: "Start with a clean slate.",
    icon: Plus,
  },
  {
    kind: "launch",
    title: "Project brainstorm",
    description: "Turn a challenge into a plan.",
    icon: StickyNote,
  },
  {
    kind: "flow",
    title: "Simple flowchart",
    description: "Map a process, step by step.",
    icon: GitBranch,
  },
  {
    kind: "retro",
    title: "Team retrospective",
    description: "Reflect and decide what’s next.",
    icon: Users,
  },
];

export function Landing({ navigate, user }) {
  const start = () => navigate(user ? "/dashboard" : "/register");
  return (
    <div className="landing">
      <nav className="landing-nav" aria-label="Main navigation">
        <Logo onClick={() => navigate("/")} />
        <div className="nav-middle">
          <a href="#workspace">Workspace</a>
          <a href="#features">Features</a>
        </div>
        <div className="nav-actions">
          <ThemeToggle />
          {!user && (
            <button className="text-btn" onClick={() => navigate("/login")}>
              Log in
            </button>
          )}
          <button className="btn primary" onClick={start}>
            {user ? "Open workspace" : "Start creating"}
            <ArrowUpRight size={15} />
          </button>
        </div>
      </nav>
      <main>
        <section className="hero" id="workspace">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="accent-dot" /> YOUR COLLABORATIVE WHITEBOARD
            </span>
            <h1>
              Less friction.
              <br />
              More <span>clear thinking.</span>
            </h1>
            <p>
              Sketch the first thought. Connect the next one. A shared workspace
              for ideas, diagrams, and the people behind them.
            </p>
            <button className="btn primary large" onClick={start}>
              {user ? "Go to your whiteboards" : "Create your workspace"}
              <ArrowRight size={17} />
            </button>
            <div className="hero-detail">
              <Check size={14} /> An infinite canvas. A focused workflow.
            </div>
          </div>
          <div
            className="product-preview"
            aria-label="Example project whiteboard"
          >
            <div className="preview-top">
              <span>
                <span className="preview-document">
                  <PanelTop size={15} />
                </span>
                Product discovery
              </span>
              <span className="preview-label">EXAMPLE BOARD</span>
            </div>
            <div className="preview-canvas">
              <div className="preview-tools" aria-hidden="true">
                {[MousePointer2, PenLine, StickyNote, Shapes].map((Icon, i) => (
                  <span key={i} className={i === 0 ? "active" : ""}>
                    <Icon size={17} />
                  </span>
                ))}
              </div>
              <MiniBoard elements={templateElements("launch")} />
            </div>
            <div className="preview-bottom">
              <span>
                <Layers3 size={12} />
                Ideas, in perspective
              </span>
              <span>Made with Sketchter</span>
            </div>
          </div>
        </section>
        <section className="features" id="features">
          <div className="section-heading">
            <span className="eyebrow">FROM FIRST THOUGHT TO NEXT STEP</span>
            <h2>One space. Your entire process.</h2>
          </div>
          <div className="feature-grid">
            {[
              [
                PenLine,
                "Work without edges",
                "Notes, sketches, images, and charts on an infinite canvas. Your thinking sets the boundaries.",
              ],
              [
                Users,
                "Stay on the same page",
                "Create together in real time. Share a board with the right people and control who can edit.",
              ],
              [
                Sparkles,
                "Find your next direction",
                "Brainstorm, generate diagrams, or summarize your board with an AI assistant in your workspace.",
              ],
            ].map(([Icon, title, text]) => (
              <article key={title}>
                <span className="feature-icon">
                  <Icon size={21} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer>
        <Logo onClick={() => navigate("/")} />
        <span>A clear space for what comes next.</span>
        <button className="text-btn" onClick={start}>
          Open Sketchter <ArrowUpRight size={14} />
        </button>
      </footer>
    </div>
  );
}

export function Auth({
  register: initialRegister = false,
  onSuccess,
  navigate,
}) {
  const [register, setRegister] = useState(initialRegister),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setRegister(initialRegister);
    setError("");
  }, [initialRegister]);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      if (neonAuth) {
        const result = register
          ? await neonAuth.signUp.email(values)
          : await neonAuth.signIn.email({
              email: values.email,
              password: values.password,
            });
        if (result.error) throw new Error(result.error.message);
        const jwt = await neonAuth.token();
        if (!jwt.data?.token)
          throw new Error(
            "Check your email to verify your account, then sign in.",
          );
        onSuccess(
          await api("/auth/neon", {
            method: "POST",
            body: { token: jwt.data.token },
          }),
        );
      } else
        onSuccess(
          await api(`/auth/${register ? "register" : "login"}`, {
            method: "POST",
            body: values,
          }),
        );
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-form-side">
        <header>
          <Logo onClick={() => navigate("/")} />
          <ThemeToggle />
        </header>
        <div className="auth-form-wrap">
          <span className="eyebrow">YOUR NEXT IDEA STARTS HERE</span>
          <h1>{register ? "Create your workspace" : "Welcome back"}</h1>
          <p>
            {register
              ? "A shared space for your best thinking."
              : "Sign in to pick up where you left off."}
          </p>
          <form onSubmit={submit} aria-busy={busy}>
            {register && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  placeholder="Alex Morgan"
                  required
                  maxLength={80}
                  disabled={busy}
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                disabled={busy}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                autoComplete={register ? "new-password" : "current-password"}
                placeholder="At least 8 characters"
                required
                minLength={8}
                maxLength={256}
                disabled={busy}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn primary large" disabled={busy}>
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={17} />
                  {register ? "Creating account…" : "Signing in…"}
                </>
              ) : (
                <>
                  {register ? "Create your account" : "Sign in"}
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to Sketchter?"}{" "}
            <button
              disabled={busy}
              onClick={() => navigate(register ? "/login" : "/register")}
            >
              {register ? "Log in" : "Create an account"}
            </button>
          </p>
        </div>
        <span className="auth-footer">
          Sketchter · Think visually. Build together.
        </span>
      </div>
      <aside className="auth-art">
        <div className="auth-art-heading">
          <span className="eyebrow">A WORKSPACE THAT THINKS WITH YOU</span>
          <h2>
            Make room
            <br />
            for the next idea.
          </h2>
          <p>From a rough sketch to a shared direction.</p>
        </div>
        <div className="auth-board">
          <MiniBoard elements={templateElements("flow")} />
        </div>
        <div className="auth-art-caption">
          <PenLine size={16} />
          <span>Draw freely. Connect ideas. Move forward.</span>
        </div>
      </aside>
    </div>
  );
}

function BoardCard({ board, open, duplicate, requestDelete, busy }) {
  const [menu, setMenu] = useState(false),
    ref = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const outside = (event) => {
      if (!ref.current?.contains(event.target)) setMenu(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        setMenu(false);
        ref.current?.querySelector(".card-menu-toggle")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [menu]);
  return (
    <article className="board-card" ref={ref}>
      <button
        className="board-thumbnail"
        onClick={() => open(board.id)}
        aria-label={`Open ${board.title}`}
      >
        {board.elements.length ? (
          <MiniBoard elements={board.elements} />
        ) : (
          <span className="blank-thumbnail">
            <PanelTop size={28} />
            <span>A clean slate</span>
          </span>
        )}
        <span className="thumbnail-open">
          <ArrowUpRight size={16} />
        </span>
      </button>
      <div className="board-card-info">
        <button className="board-card-title" onClick={() => open(board.id)}>
          {board.title}
        </button>
        <div className="board-card-meta">
          <span>
            {board.role === "owner" ? (
              board.members.length ? (
                <>
                  <Users size={12} />
                  Shared
                </>
              ) : (
                "Personal board"
              )
            ) : (
              <>
                <Users size={12} />
                {board.role === "editor" ? "Can edit" : "View only"}
              </>
            )}
          </span>
          <time dateTime={new Date(board.updatedAt).toISOString()}>
            {new Date(board.updatedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </time>
        </div>
        <button
          className="icon-btn card-menu-toggle"
          aria-label={`Options for ${board.title}`}
          aria-expanded={menu}
          onClick={() => setMenu((v) => !v)}
        >
          <MoreHorizontal size={18} />
        </button>
        {menu && (
          <div className="dropdown card-dropdown" aria-label="Board actions">
            <button
              disabled={busy}
              onClick={() => {
                duplicate(board);
                setMenu(false);
              }}
            >
              <Copy size={15} />
              Duplicate board
            </button>
            {board.role === "owner" && (
              <button
                className="danger"
                onClick={() => {
                  requestDelete(board);
                  setMenu(false);
                }}
              >
                <Trash2 size={15} />
                Delete board
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function Dashboard({ user, navigate, signOut, notify }) {
  const [boards, setBoards] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [sort, setSort] = useState("recent"),
    [create, setCreate] = useState(false),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(null);
  const [recent] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem(`sketchter-recent-${user.id}`) || "{}",
      );
    } catch {
      return {};
    }
  });
  async function load() {
    setLoading(true);
    try {
      setBoards(await api("/boards"));
      setError("");
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  const open = (id) => navigate(`/board/${id}`);
  async function createBoard(kind) {
    if (busy) return;
    setBusy(true);
    try {
      const title = {
        launch: "Product discovery",
        flow: "Project workflow",
        retro: "Team retrospective",
        blank: "Untitled whiteboard",
      }[kind];
      const board = await api("/boards", {
        method: "POST",
        body: { title, elements: templateElements(kind) },
      });
      open(board.id);
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function duplicate(board) {
    setBusy(true);
    try {
      const copy = await api("/boards", {
        method: "POST",
        body: { title: `${board.title} (copy)`, elements: board.elements },
      });
      setBoards((items) => [copy, ...items]);
      notify("Board duplicated.");
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function removeBoard() {
    setBusy(true);
    try {
      await api(`/boards/${deleting.id}`, { method: "DELETE" });
      setBoards((items) => items.filter((board) => board.id !== deleting.id));
      setDeleting(null);
      notify("Whiteboard deleted.");
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }
  const filtered = boards
    .filter(
      (board) =>
        board.title.toLowerCase().includes(search.toLowerCase()) &&
        (filter !== "shared" ||
          board.role !== "owner" ||
          board.members.length) &&
        (filter !== "recent" || recent[board.id]),
    )
    .sort((a, b) =>
      filter === "recent"
        ? recent[b.id] - recent[a.id]
        : sort === "name"
          ? a.title.localeCompare(b.title)
          : b.updatedAt - a.updatedAt,
    );
  const navigation = [
    [LayoutGrid, "all", "All whiteboards"],
    [Clock3, "recent", "Recently opened"],
    [Users, "shared", "Shared boards"],
  ];
  return (
    <div className="dashboard">
      <aside className="dashboard-sidebar">
        <Logo onClick={() => navigate("/")} />
        <div className="workspace-label">
          <span className="workspace-icon">{user.name[0].toUpperCase()}</span>
          <span>
            Personal workspace<small>{user.name}</small>
          </span>
        </div>
        <span className="sidebar-label">WORKSPACE</span>
        <nav aria-label="Workspace navigation">
          {navigation.map(([Icon, id, label]) => (
            <button
              key={id}
              className={filter === id ? "active" : ""}
              aria-current={filter === id ? "page" : undefined}
              onClick={() => setFilter(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "all" && <small>{boards.length}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="feature-icon">
            <Layers3 size={19} />
          </span>
          <h3>A head start for your ideas</h3>
          <p>Choose a template and make it your own.</p>
          <button className="text-btn" onClick={() => setCreate(true)}>
            Explore templates
            <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="sidebar-account">
          <span className="avatar">{user.name[0].toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <small title={user.email}>{user.email}</small>
          </div>
          <button
            className="icon-btn"
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="dashboard-content">
        <header className="dashboard-header">
          <div className="dashboard-breadcrumb">
            <span className="mobile-brand">
              <Logo onClick={() => navigate("/")} compact />
            </span>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {filter === "all"
                ? "All whiteboards"
                : filter === "recent"
                  ? "Recently opened"
                  : "Shared boards"}
            </strong>
          </div>
          <div className="dashboard-header-actions">
            <ThemeToggle />
            <span className="account-label">{user.name}</span>
            <button
              className="avatar mobile-signout"
              onClick={signOut}
              title="Sign out"
              aria-label="Sign out"
            >
              {user.name[0].toUpperCase()}
            </button>
          </div>
        </header>
        <main className="dashboard-main">
          <div className="dashboard-heading">
            <div>
              <span className="eyebrow">YOUR WORK, IN PERSPECTIVE</span>
              <h1>
                {filter === "recent"
                  ? "Recently opened"
                  : filter === "shared"
                    ? "Shared whiteboards"
                    : "Your whiteboards"}
              </h1>
              <p>
                {filter === "shared"
                  ? "A shared space to move ideas forward."
                  : "Pick up an idea. Start something new."}
              </p>
            </div>
            <button
              className="btn primary"
              onClick={() => setCreate(true)}
              disabled={busy}
            >
              <Plus size={17} />
              New whiteboard
            </button>
          </div>
          <nav className="mobile-workspace-nav" aria-label="Workspace filters">
            {navigation.map(([Icon, id, label]) => (
              <button
                key={id}
                className={filter === id ? "active" : ""}
                onClick={() => setFilter(id)}
              >
                <Icon size={15} />
                {id === "all"
                  ? "All boards"
                  : id === "recent"
                    ? "Recent"
                    : "Shared"}
              </button>
            ))}
          </nav>
          <div className="board-list-controls">
            <label className="search-box">
              <Search size={17} />
              <input
                placeholder="Search whiteboards…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search whiteboards"
              />
              {search && (
                <button
                  className="icon-btn"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <div className="list-summary">
              <span>
                {filtered.length} {filtered.length === 1 ? "board" : "boards"}
              </span>
              <label className="sort-control">
                <ArrowDownUp size={14} />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  aria-label="Sort whiteboards"
                  disabled={filter === "recent"}
                >
                  <option value="recent">Last edited</option>
                  <option value="name">Name A–Z</option>
                </select>
              </label>
            </div>
          </div>
          {error ? (
            <div className="empty-state" role="alert">
              <PanelTop size={30} />
              <h2>Couldn’t load your whiteboards</h2>
              <p>{error}</p>
              <button className="btn" onClick={load}>
                Try again
              </button>
            </div>
          ) : loading ? (
            <div
              className="boards-grid"
              aria-label="Loading whiteboards"
              aria-busy="true"
            >
              {[0, 1, 2].map((i) => (
                <div key={i} className="board-skeleton">
                  <div />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="boards-grid">
                <button
                  className="new-board-card"
                  onClick={() => setCreate(true)}
                  disabled={busy}
                >
                  <span>
                    <Plus size={23} />
                  </span>
                  <strong>Create a whiteboard</strong>
                  <small>A fresh space for your next idea</small>
                </button>
                {filtered.map((board) => (
                  <BoardCard
                    key={board.id}
                    board={board}
                    open={open}
                    duplicate={duplicate}
                    requestDelete={setDeleting}
                    busy={busy}
                  />
                ))}
              </div>
              {boards.length === 0 && (
                <div className="first-board-hint">
                  <PenLine size={16} />
                  <span>
                    Your workspace is ready. Create a whiteboard or start with a
                    template.
                  </span>
                </div>
              )}
              {boards.length > 0 && !filtered.length && (
                <div className="empty-state">
                  <Search size={27} />
                  <h2>
                    {search
                      ? "No matching whiteboards"
                      : filter === "recent"
                        ? "Your recent boards will appear here"
                        : "No shared whiteboards yet"}
                  </h2>
                  <p>
                    {search
                      ? "Try another name or clear your search."
                      : "Open a board to get started."}
                  </p>
                  {search && (
                    <button className="btn" onClick={() => setSearch("")}>
                      Clear search
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
      {create && (
        <Modal
          title="Create a whiteboard"
          close={() => !busy && setCreate(false)}
        >
          <p className="muted">
            Start from scratch or choose a starting point.
          </p>
          <div className="template-options">
            {templates.map(({ kind, title, description, icon: Icon }) => (
              <button
                disabled={busy}
                key={kind}
                onClick={() => createBoard(kind)}
              >
                <span className="template-preview">
                  {kind === "blank" ? (
                    <Plus size={28} />
                  ) : (
                    <MiniBoard elements={templateElements(kind)} />
                  )}
                </span>
                <span className="template-name">
                  <Icon size={15} />
                  <strong>{title}</strong>
                  <ArrowUpRight size={14} />
                </span>
                <small>{description}</small>
              </button>
            ))}
          </div>
          {busy && (
            <p className="muted creation-status" role="status">
              <LoaderCircle className="spin" size={15} />
              Creating your whiteboard…
            </p>
          )}
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Delete this whiteboard?"
          close={() => !busy && setDeleting(null)}
        >
          <p className="muted">
            “{deleting.title}” and its contents will be permanently deleted.
            Everyone will lose access to this board.
          </p>
          <div className="modal-actions">
            <button
              className="btn"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Keep whiteboard
            </button>
            <button
              className="btn danger-solid"
              disabled={busy}
              onClick={removeBoard}
            >
              {busy && <LoaderCircle size={14} className="spin" />}Delete
              whiteboard
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
