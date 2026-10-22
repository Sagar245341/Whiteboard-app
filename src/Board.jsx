import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Minus,
  Plus,
  Maximize,
  Sparkles,
  Download,
  Users,
  Check,
  ChevronDown,
  MousePointer2,
  Hand,
  Type,
  StickyNote,
  List,
  Square,
  Circle,
  Diamond,
  Slash,
  MoveUpRight,
  PenLine,
  Eraser,
  ImagePlus,
  Smile,
  ChartColumn,
  Settings2,
  X,
  Copy,
  Trash2,
  LoaderCircle,
  Link,
  WandSparkles,
  GitBranch,
  FileText,
  AlignLeft,
  BringToFront,
} from "lucide-react";
import { api } from "./api";
import { Modal, Logo, ThemeToggle } from "./ui";
import {
  ElementView,
  makeElement,
  bounds,
  uid,
  COLORS,
  FILLS,
} from "./elements";

const TOOLS = [
  [MousePointer2, "select", "Select", "V"],
  [Hand, "hand", "Hand / pan", "H"],
  [Type, "text", "Text", "T"],
  [StickyNote, "sticky", "Sticky note", "N"],
  [List, "list", "Bullet list", "L"],
  [Square, "rect", "Rectangle", "R"],
  [Circle, "ellipse", "Ellipse", "O"],
  [Diamond, "diamond", "Diamond", "D"],
  [Slash, "line", "Line", "I"],
  [MoveUpRight, "arrow", "Arrow", "A"],
  [PenLine, "pen", "Pen", "P"],
  [Eraser, "eraser", "Eraser", "E"],
  [ImagePlus, "image", "Upload image", ""],
  [Smile, "emoji", "Emoji", ""],
  [ChartColumn, "chart", "Chart", ""],
];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clone = (value) => structuredClone(value);
export default function Board({ id, user, navigate, notify }) {
  const [board, setBoard] = useState(null),
    [error, setError] = useState("");
  const [elements, setElements] = useState([]),
    [selection, setSelection] = useState([]);
  const [tool, setTool] = useState("select"),
    [view, setView] = useState({ x: 100, y: 80, zoom: 1 });
  const [style, setStyle] = useState({
    stroke: "#292d3b",
    fill: "#fff4bd",
    strokeWidth: 2,
    fontSize: 18,
    font: "sans",
    sketch: false,
  });
  const [panel, setPanel] = useState(null),
    [editing, setEditing] = useState(null),
    [chartEdit, setChartEdit] = useState(null);
  const [connected, setConnected] = useState(false),
    [saved, setSaved] = useState(true),
    [people, setPeople] = useState([]),
    [cursors, setCursors] = useState({}),
    [marquee, setMarquee] = useState(null);
  const [, setHistoryVersion] = useState(0),
    [space, setSpace] = useState(false);
  const svg = useRef(),
    elementsRef = useRef([]),
    selectionRef = useRef([]),
    socket = useRef(),
    gesture = useRef(),
    history = useRef({ past: [], future: [] }),
    clipboard = useRef([]),
    fileInput = useRef(),
    lastCursor = useRef(0),
    pendingSaves = useRef(0);
  const editable = board?.role !== "viewer" && connected;
  function updateElements(value) {
    elementsRef.current = value;
    setElements(value);
    const ids = new Set(value.map((e) => e.id));
    const selected = selectionRef.current.filter((id) => ids.has(id));
    if (selected.length !== selectionRef.current.length) select(selected);
  }
  function select(ids) {
    selectionRef.current = ids;
    setSelection(ids);
  }
  function send(upsert, remove) {
    if (!upsert.length && !remove.length) return;
    pendingSaves.current++;
    setSaved(false);
    socket.current
      .timeout(15000)
      .emit("operations", { upsert, remove }, (timeout, result) => {
        pendingSaves.current--;
        if (timeout || result?.error) {
          notify(
            result?.error ||
              "Saving failed. Reconnect before making more changes.",
          );
          setConnected(false);
          socket.current.disconnect();
          socket.current.connect();
        } else if (!pendingSaves.current) setSaved(true);
      });
  }
  function commit(next, previous = elementsRef.current, remember = true) {
    if (!editable) return;
    const old = new Map(previous.map((e) => [e.id, e])),
      fresh = new Map(next.map((e) => [e.id, e]));
    const upsert = next.filter((e) => !same(old.get(e.id), e)),
      remove = previous.filter((e) => !fresh.has(e.id)).map((e) => e.id);
    if (remember && (upsert.length || remove.length)) {
      const touched = new Set([...upsert.map((e) => e.id), ...remove]);
      history.current.past.push({
        before: clone(previous.filter((e) => touched.has(e.id))),
        after: clone(next.filter((e) => touched.has(e.id))),
      });
      if (history.current.past.length > 100) history.current.past.shift();
      history.current.future = [];
      setHistoryVersion((v) => v + 1);
    }
    updateElements(next);
    send(upsert, remove);
  }
  function undo(redo = false) {
    if (!editable) return;
    const from = redo ? history.current.future : history.current.past,
      to = redo ? history.current.past : history.current.future;
    const entry = from.pop();
    if (!entry) return;
    const target = redo ? entry.after : entry.before,
      touched = new Set([...entry.before, ...entry.after].map((e) => e.id));
    commit(
      [
        ...elementsRef.current.filter((e) => !touched.has(e.id)),
        ...clone(target),
      ],
      elementsRef.current,
      false,
    );
    to.push(entry);
    setHistoryVersion((v) => v + 1);
    select([]);
  }
  function fit(items = elementsRef.current) {
    if (!svg.current) return;
    const b = bounds(items),
      r = svg.current.getBoundingClientRect();
    const zoom = Math.max(
      0.1,
      Math.min(
        1.25,
        (r.width - (r.width < 650 ? 90 : 210)) / (b.w + 100),
        (r.height - 170) / (b.h + 100),
      ),
    );
    setView({
      zoom,
      x: (r.width - b.w * zoom) / 2 - b.x * zoom,
      y: (r.height - b.h * zoom) / 2 - b.y * zoom,
    });
  }
  useEffect(() => {
    try {
      const key = `sketchter-recent-${user.id}`;
      const recent = JSON.parse(localStorage.getItem(key) || "{}");
      recent[id] = Date.now();
      localStorage.setItem(key, JSON.stringify(recent));
    } catch {}
    let live = true;
    const client = io({
      auth: { token: localStorage.getItem("canvas-token") },
    });
    socket.current = client;
    client.on("connect", () =>
      client.emit("join", id, (result) => {
        if (!live) return;
        if (result.error) {
          setError(result.error);
          return;
        }
        setBoard(result.board);
        updateElements(result.board.elements);
        setConnected(true);
        setSaved(true);
        requestAnimationFrame(() => fit(result.board.elements));
      }),
    );
    client.on("disconnect", () => setConnected(false));
    client.on("connect_error", (e) => {
      setConnected(false);
      api(`/boards/${id}`).catch((e) => live && setError(e.message));
    });
    client.on("operations", (data) => {
      const remove = new Set([...data.remove, ...data.upsert.map((e) => e.id)]);
      updateElements([
        ...elementsRef.current.filter((e) => !remove.has(e.id)),
        ...data.upsert,
      ]);
    });
    client.on("metadata", (data) => setBoard((b) => ({ ...b, ...data })));
    client.on("presence", setPeople);
    client.on("cursor", (data) =>
      setCursors((c) => ({ ...c, [data.id]: data })),
    );
    client.on("cursor-left", (id) =>
      setCursors((c) => {
        const copy = { ...c };
        delete copy[id];
        return copy;
      }),
    );
    client.on("deleted", () => {
      notify("This whiteboard was deleted by its owner.");
      navigate("/dashboard");
    });
    client.on("permissions-changed", () =>
      api(`/boards/${id}`)
        .then((b) => setBoard(b))
        .catch((e) => {
          setError(e.message);
          client.disconnect();
        }),
    );
    api(`/boards/${id}`).catch((e) => live && setError(e.message));
    return () => {
      live = false;
      client.disconnect();
    };
  }, [id]);
  useEffect(() => {
    if (board?.title) document.title = `${board.title} · Sketchter`;
  }, [board?.title]);
  useEffect(() => {
    const listener = (e) => {
      if (!saved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [saved]);
  function world(e) {
    const r = svg.current.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - view.x) / view.zoom,
      y: (e.clientY - r.top - view.y) / view.zoom,
    };
  }
  function center() {
    const r = svg.current.getBoundingClientRect();
    return {
      x: (r.width / 2 - view.x) / view.zoom,
      y: (r.height / 2 - view.y) / view.zoom,
    };
  }
  function add(items) {
    if (!editable) return;
    const highest = Math.max(
      0,
      ...elementsRef.current.map((e, i) => e.layer ?? i),
    );
    commit([
      ...elementsRef.current,
      ...items.map((e, i) => ({ ...e, layer: highest + i + 1 })),
    ]);
    select(items.map((e) => e.id));
    setTool("select");
  }
  function bringToFront() {
    const highest = Math.max(
      0,
      ...elementsRef.current.map((e, i) => e.layer ?? i),
    );
    let offset = 0;
    commit(
      elementsRef.current.map((e) =>
        selection.includes(e.id) ? { ...e, layer: highest + ++offset } : e,
      ),
    );
  }
  function changeStyle(change) {
    setStyle((s) => ({ ...s, ...change }));
    if (editable && selection.length)
      commit(
        elementsRef.current.map((e) =>
          selection.includes(e.id) ? { ...e, ...change } : e,
        ),
      );
  }
  function deleteSelection() {
    if (!editable) return;
    commit(
      elementsRef.current.filter((e) => !selectionRef.current.includes(e.id)),
    );
    select([]);
  }
  function duplicate() {
    if (!editable) return;
    add(
      elementsRef.current
        .filter((e) => selectionRef.current.includes(e.id))
        .map((e) => ({ ...clone(e), id: uid(), x: e.x + 24, y: e.y + 24 })),
    );
  }
  function copy() {
    clipboard.current = clone(
      elementsRef.current.filter((e) => selectionRef.current.includes(e.id)),
    );
    notify("Selection copied. Use Ctrl/Cmd + V to paste.");
  }
  useEffect(() => {
    function key(e) {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) ||
        e.target.isContentEditable ||
        editing ||
        chartEdit
      )
        return;
      const cmd = e.ctrlKey || e.metaKey;
      if (e.code === "Space") {
        e.preventDefault();
        setSpace(true);
      }
      if (e.key === "Escape") {
        select([]);
        setPanel(null);
        setTool("select");
      }
      if ((e.key === "Delete" || e.key === "Backspace") && editable) {
        e.preventDefault();
        deleteSelection();
      }
      if (cmd && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo(e.shiftKey);
      }
      if (cmd && e.key.toLowerCase() === "y") {
        e.preventDefault();
        undo(true);
      }
      if (cmd && e.key.toLowerCase() === "a") {
        e.preventDefault();
        select(elementsRef.current.map((e) => e.id));
      }
      if (cmd && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copy();
      }
      if (
        cmd &&
        e.key.toLowerCase() === "v" &&
        editable &&
        clipboard.current.length
      ) {
        e.preventDefault();
        add(
          clipboard.current.map((e) => ({
            ...clone(e),
            id: uid(),
            x: e.x + 35,
            y: e.y + 35,
          })),
        );
      }
      if (cmd && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate();
      }
      if (!cmd && !e.altKey) {
        const match = TOOLS.find(
          (t) => t[3] && t[3].toLowerCase() === e.key.toLowerCase(),
        );
        if (match && (editable || ["select", "hand"].includes(match[1])))
          setTool(match[1]);
        if (e.key === "1") fit();
      }
    }
    const up = (e) => {
      if (e.code === "Space") setSpace(false);
    };
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", up);
    };
  });
  function pointerDown(e) {
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    svg.current.focus({ preventScroll: true });
    svg.current.setPointerCapture(e.pointerId);
    const p = world(e),
      id = e.target.closest("[data-element]")?.getAttribute("data-element"),
      handle = e.target.getAttribute("data-handle");
    const before = clone(elementsRef.current);
    if (tool === "hand" || space || e.button === 1) {
      gesture.current = {
        mode: "pan",
        start: { x: e.clientX, y: e.clientY },
        view,
      };
      return;
    }
    if (handle && editable) {
      gesture.current = {
        mode: handle === "rotate" ? "rotate" : "resize",
        start: p,
        before,
        target: before.find((el) => el.id === selection[0]),
      };
      return;
    }
    if (tool === "select" || !editable) {
      if (id) {
        const next = e.shiftKey
          ? selection.includes(id)
            ? selection.filter((i) => i !== id)
            : [...selection, id]
          : selection.includes(id)
            ? selection
            : [id];
        select(next);
        if (editable)
          gesture.current = { mode: "move", start: p, before, ids: next };
      } else {
        if (!e.shiftKey) select([]);
        gesture.current = {
          mode: "marquee",
          start: p,
          additive: e.shiftKey ? selection : [],
        };
        setMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
      }
      return;
    }
    if (!editable) return;
    if (tool === "eraser") {
      if (id) commit(before.filter((el) => el.id !== id));
      gesture.current = { mode: "erase" };
      return;
    }
    if (["image", "chart", "emoji"].includes(tool)) return;
    const actual = tool === "list" ? "text" : tool;
    const created = makeElement(actual, p.x, p.y, {
      ...style,
      fill:
        actual === "sticky"
          ? style.fill === "none"
            ? "#fff4bd"
            : style.fill
          : ["text", "pen", "line", "arrow"].includes(actual)
            ? "none"
            : style.fill === "#fff4bd"
              ? "none"
              : style.fill,
      ...(tool === "list" && {
        text: "• Your first thought\n• A little possibility\n• What comes next?",
      }),
    });
    created.layer = Math.max(0, ...before.map((el, i) => el.layer ?? i)) + 1;
    if (["sticky", "text"].includes(actual)) {
      add([created]);
      setEditing(created);
      return;
    }
    created.w = 1;
    created.h = 1;
    if (actual === "pen") created.points = [{ x: 0, y: 0 }];
    updateElements([...before, created]);
    select([created.id]);
    gesture.current = { mode: "draw", start: p, before, created };
  }
  function pointerMove(e) {
    const p = world(e);
    if (socket.current?.connected && Date.now() - lastCursor.current > 45) {
      socket.current.emit("cursor", p);
      lastCursor.current = Date.now();
    }
    const g = gesture.current;
    if (!g) return;
    if (g.mode === "pan") {
      setView({
        ...g.view,
        x: g.view.x + e.clientX - g.start.x,
        y: g.view.y + e.clientY - g.start.y,
      });
      return;
    }
    if (g.mode === "marquee") {
      setMarquee({
        x: Math.min(p.x, g.start.x),
        y: Math.min(p.y, g.start.y),
        w: Math.abs(p.x - g.start.x),
        h: Math.abs(p.y - g.start.y),
      });
      return;
    }
    if (!editable) return;
    if (g.mode === "erase") {
      const hit = [...elementsRef.current]
        .reverse()
        .find(
          (el) =>
            p.x >= el.x &&
            p.x <= el.x + Math.max(10, el.w) &&
            p.y >= el.y &&
            p.y <= el.y + Math.max(10, el.h),
        );
      if (hit) commit(elementsRef.current.filter((el) => el.id !== hit.id));
      return;
    }
    if (g.mode === "move") {
      updateElements(
        g.before.map((el) =>
          g.ids.includes(el.id)
            ? { ...el, x: el.x + p.x - g.start.x, y: el.y + p.y - g.start.y }
            : el,
        ),
      );
    }
    if (g.mode === "resize" && g.target) {
      const dx = p.x - g.start.x,
        dy = p.y - g.start.y;
      updateElements(
        g.before.map((el) => {
          if (el.id !== g.target.id) return el;
          const w = Math.max(20, el.w + dx),
            h = Math.max(
              20,
              e.shiftKey ? ((el.w + dx) * el.h) / el.w : el.h + dy,
            );
          return {
            ...el,
            w,
            h,
            ...(el.type === "pen" && {
              points: el.points.map((p) => ({
                x: (p.x * w) / el.w,
                y: (p.y * h) / el.h,
              })),
            }),
          };
        }),
      );
    }
    if (g.mode === "rotate" && g.target) {
      const el = g.target,
        angle =
          (Math.atan2(p.y - el.y - el.h / 2, p.x - el.x - el.w / 2) * 180) /
            Math.PI +
          90;
      updateElements(
        g.before.map((el) =>
          el.id === g.target.id
            ? {
                ...el,
                rotation: e.shiftKey ? Math.round(angle / 15) * 15 : angle,
              }
            : el,
        ),
      );
    }
    if (g.mode === "draw") {
      const el = { ...g.created };
      if (el.type === "pen") {
        el.points = [
          ...(elementsRef.current.find((x) => x.id === el.id)?.points || []),
          { x: p.x - el.x, y: p.y - el.y },
        ];
        el.w = Math.max(1, ...el.points.map((p) => p.x));
        el.h = Math.max(1, ...el.points.map((p) => p.y));
      } else {
        el.x = Math.min(g.start.x, p.x);
        el.y = Math.min(g.start.y, p.y);
        el.w = Math.max(1, Math.abs(p.x - g.start.x));
        el.h =
          e.shiftKey && !["line", "arrow"].includes(el.type)
            ? el.w
            : Math.max(1, Math.abs(p.y - g.start.y));
        el.flipX = p.x < g.start.x;
        el.flipY = p.y < g.start.y;
      }
      updateElements([...g.before, el]);
    }
  }
  function pointerUp() {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.mode === "marquee" && marquee) {
      const m = marquee;
      select([
        ...new Set([
          ...g.additive,
          ...elementsRef.current
            .filter(
              (el) =>
                el.x < m.x + m.w &&
                el.x + el.w > m.x &&
                el.y < m.y + m.h &&
                el.y + el.h > m.y,
            )
            .map((el) => el.id),
        ]),
      ]);
      setMarquee(null);
    }
    if (["move", "draw", "resize", "rotate"].includes(g.mode)) {
      let current = elementsRef.current;
      if (g.mode === "draw") {
        let el = current.find((el) => el.id === g.created.id);
        if (el.type === "pen") {
          const minX = Math.min(...el.points.map((p) => p.x)),
            minY = Math.min(...el.points.map((p) => p.y));
          const maxX = Math.max(...el.points.map((p) => p.x)),
            maxY = Math.max(...el.points.map((p) => p.y));
          el = {
            ...el,
            x: el.x + minX,
            y: el.y + minY,
            w: Math.max(1, maxX - minX),
            h: Math.max(1, maxY - minY),
            points: el.points.map((p) => ({ x: p.x - minX, y: p.y - minY })),
          };
        } else if (el.w < 5 && el.h < 5)
          el = {
            ...el,
            w: 180,
            h: ["line", "arrow"].includes(el.type) ? 0 : 110,
          };
        current = current.map((e) => (e.id === el.id ? el : e));
        setTool("select");
      }
      commit(current, g.before);
    }
  }
  function zoom(factor) {
    const p = center();
    const r = svg.current.getBoundingClientRect(),
      z = Math.max(0.1, Math.min(4, view.zoom * factor));
    setView({ x: r.width / 2 - p.x * z, y: r.height / 2 - p.y * z, zoom: z });
  }
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    function wheel(e) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = element.getBoundingClientRect(),
          sx = e.clientX - r.left,
          sy = e.clientY - r.top;
        setView((v) => {
          const z = Math.max(
            0.1,
            Math.min(4, v.zoom * Math.exp(-e.deltaY * 0.008)),
          );
          return {
            x: sx - ((sx - v.x) * z) / v.zoom,
            y: sy - ((sy - v.y) * z) / v.zoom,
            zoom: z,
          };
        });
      } else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    }
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [board?.id]);
  async function upload(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file || !editable) return;
    try {
      const form = new FormData();
      form.append("image", file);
      const result = await api(`/boards/${id}/upload`, {
        method: "POST",
        body: form,
      });
      const img = new window.Image();
      img.onload = () => {
        const p = center(),
          w = Math.min(500, img.width);
        add([
          makeElement(
            "image",
            p.x - w / 2,
            p.y - (w * img.height) / img.width / 2,
            {
              w,
              h: (w * img.height) / img.width,
              src: result.src,
              assetId: result.assetId,
            },
          ),
        ]);
      };
      img.src = result.src;
    } catch (e) {
      notify(e.message);
    }
  }
  function chooseTool(next) {
    if (!editable && !["select", "hand"].includes(next)) return;
    if (next === "image") fileInput.current.click();
    else if (next === "chart") {
      const p = center();
      setChartEdit(
        makeElement("chart", p.x - 200, p.y - 140, {
          text: "Comparison",
          chartType: "bar",
          data: [
            { label: "Q1", value: 30 },
            { label: "Q2", value: 55 },
            { label: "Q3", value: 40 },
            { label: "Q4", value: 68 },
          ],
        }),
      );
    } else if (next === "emoji") setPanel(panel === "emoji" ? null : "emoji");
    else setTool(next);
  }
  async function exportBoard(format) {
    try {
      const b = bounds(elementsRef.current),
        pad = 40;
      const source = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Math.ceil(b.w + pad * 2)}" height="${Math.ceil(b.h + pad * 2)}" viewBox="${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}"><rect x="${b.x - pad}" y="${b.y - pad}" width="${b.w + pad * 2}" height="${b.h + pad * 2}" fill="#fdfefa"/>${svg.current.querySelector("#world-content").innerHTML}</svg>`;
      let blob = new Blob([source], { type: "image/svg+xml" });
      if (format === "png") {
        const url = URL.createObjectURL(blob);
        try {
          const image = new window.Image();
          await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
            image.src = url;
          });
          const canvas = document.createElement("canvas"),
            scale = Math.min(2, 8192 / Math.max(image.width, image.height));
          canvas.width = image.width * scale;
          canvas.height = image.height * scale;
          canvas
            .getContext("2d")
            .drawImage(image, 0, 0, canvas.width, canvas.height);
          blob = await new Promise((resolve) =>
            canvas.toBlob(resolve, "image/png"),
          );
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `${board.title.replace(/[^\w -]/g, "") || "sketchter"}.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setPanel(null);
      notify("Whiteboard exported.");
    } catch {
      notify(
        "Could not export this board. Try SVG or remove unsupported images.",
      );
    }
  }
  if (error)
    return (
      <div className="loading-page">
        <h2>Unable to open whiteboard</h2>
        <p>{error}</p>
        <button className="btn primary" onClick={() => navigate("/dashboard")}>
          Back to your whiteboards
        </button>
      </div>
    );
  if (!board)
    return (
      <div className="loading-page">
        <LoaderCircle className="spin" />
        <p>Opening your whiteboard…</p>
      </div>
    );
  const selectedElements = elements.filter((e) => selection.includes(e.id)),
    selectedBox = selectedElements.length ? bounds(selectedElements) : null;
  const currentStyle =
    selectedElements.length === 1 ? selectedElements[0] : style;
  const gridSize = Math.max(14, 24 * view.zoom);
  return (
    <div className="board-page">
      <header className="board-header">
        <div className="board-title-group">
          <button
            className="icon-btn"
            onClick={() => navigate("/dashboard")}
            title="Back to whiteboards"
            aria-label="Back to whiteboards"
          >
            <ArrowLeft size={18} />
          </button>
          <Logo compact onClick={() => navigate("/dashboard")} />
          <span className="header-divider" />
          <div className="board-title-stack">
            <input
              className="board-title-input"
              key={board.title}
              defaultValue={board.title}
              aria-label="Whiteboard name"
              disabled={!editable}
              onBlur={async (e) => {
                const title = e.target.value.trim();
                if (!title) {
                  e.target.value = board.title;
                  return;
                }
                if (title === board.title) return;
                try {
                  await api(`/boards/${id}`, {
                    method: "PATCH",
                    body: { title },
                  });
                  setBoard((b) => ({ ...b, title }));
                  document.title = `${title} · Sketchter`;
                } catch (e) {
                  notify(e.message);
                }
              }}
              onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
            />
            <span className="save-state" role="status">
              <span className={connected ? "green-dot" : "offline-dot"} />
              {!connected
                ? "Connecting…"
                : saved
                  ? "All changes saved"
                  : "Saving…"}
              {board.role === "viewer" && " · View only"}
            </span>
          </div>
        </div>
        <div className="board-header-center">
          <button
            className="icon-btn"
            disabled={!editable || !history.current.past.length}
            title="Undo (Ctrl+Z)"
            onClick={() => undo()}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-btn"
            disabled={!editable || !history.current.future.length}
            title="Redo (Ctrl+Shift+Z)"
            onClick={() => undo(true)}
          >
            <Redo2 size={17} />
          </button>
        </div>
        <div className="board-header-actions">
          <div className="presence-avatars" aria-label="People on this board">
            {people.slice(0, 3).map((p) => (
              <span
                key={p.id}
                style={{ background: p.color }}
                title={`${p.name} is here`}
              >
                {p.name[0].toUpperCase()}
              </span>
            ))}
          </div>
          <ThemeToggle />
          <button
            aria-label="AI assistant"
            aria-expanded={panel === "ai"}
            className={`btn ai-toggle ${panel === "ai" ? "active" : ""}`}
            onClick={() => setPanel(panel === "ai" ? null : "ai")}
          >
            <Sparkles size={16} />
            <span>AI assistant</span>
          </button>
          <button
            aria-label="Export"
            aria-expanded={panel === "export"}
            className="btn export-toggle"
            onClick={() => setPanel(panel === "export" ? null : "export")}
          >
            <Download size={16} />
            <span>Export</span>
            <ChevronDown size={12} />
          </button>
          <button
            className="btn primary"
            aria-label="Share"
            onClick={() => setPanel("share")}
          >
            <Users size={16} />
            <span>Share</span>
          </button>
        </div>
      </header>
      <div className={`canvas-area ${panel === "ai" ? "with-ai-panel" : ""}`}>
        <svg
          ref={svg}
          className={`infinite-canvas tool-${space ? "hand" : tool}`}
          tabIndex={0}
          aria-label="Whiteboard canvas. Use the drawing toolbar to add elements."
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onDoubleClick={(e) => {
            const eid = e.target
              .closest("[data-element]")
              ?.getAttribute("data-element");
            const el = elements.find((x) => x.id === eid);
            if (!el || !editable) return;
            if (el.type === "chart") setChartEdit(el);
            else if (!["image", "pen", "arrow", "line"].includes(el.type))
              setEditing(el);
          }}
        >
          <defs>
            <pattern
              id="board-dots"
              width={gridSize}
              height={gridSize}
              patternUnits="userSpaceOnUse"
              x={view.x}
              y={view.y}
            >
              <circle
                cx="1"
                cy="1"
                r={Math.max(0.65, view.zoom * 0.8)}
                fill="var(--canvas-dot)"
              />
            </pattern>
            <pattern
              id="board-grid"
              width={gridSize}
              height={gridSize}
              patternUnits="userSpaceOnUse"
              x={view.x}
              y={view.y}
            >
              <path
                d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
                fill="none"
                stroke="var(--canvas-grid)"
                strokeWidth=".7"
              />
            </pattern>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill={
              board.pattern === "plain"
                ? "var(--canvas-bg)"
                : `url(#board-${board.pattern})`
            }
          />
          <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
            <g id="world-content">
              {elements
                .map((e, i) => ({ ...e, layer: e.layer ?? i }))
                .sort((a, b) => a.layer - b.layer)
                .map((e) => (
                  <g
                    key={e.id}
                    data-element={e.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`${e.type}: ${String(e.text || e.type).slice(0, 70)}`}
                    onFocus={() => select([e.id])}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" || !editable) return;
                      event.preventDefault();
                      if (e.type === "chart") setChartEdit(e);
                      else if (
                        !["image", "pen", "line", "arrow"].includes(e.type)
                      )
                        setEditing(e);
                    }}
                  >
                    <ElementView e={e} />
                    <rect
                      x={e.x}
                      y={e.y}
                      width={Math.max(15, e.w)}
                      height={Math.max(15, e.h)}
                      transform={`rotate(${e.rotation || 0} ${e.x + e.w / 2} ${e.y + e.h / 2})`}
                      fill="transparent"
                      stroke="none"
                    />
                  </g>
                ))}
            </g>
            {selectedBox && (
              <g className="selection-overlay" pointerEvents="none">
                <rect
                  x={selectedBox.x - 5}
                  y={selectedBox.y - 5}
                  width={selectedBox.w + 10}
                  height={selectedBox.h + 10}
                  fill="none"
                  stroke="#7965e9"
                  strokeWidth={1.3 / view.zoom}
                  strokeDasharray={selection.length > 1 ? "5 3" : undefined}
                />
                {selection.length === 1 && editable && (
                  <>
                    <rect
                      data-handle="resize"
                      pointerEvents="all"
                      x={selectedBox.x + selectedBox.w}
                      y={selectedBox.y + selectedBox.h}
                      width={9 / view.zoom}
                      height={9 / view.zoom}
                      fill="white"
                      stroke="#7965e9"
                      strokeWidth={1 / view.zoom}
                      style={{ cursor: "nwse-resize" }}
                    />
                    <line
                      x1={selectedBox.x + selectedBox.w / 2}
                      y1={selectedBox.y - 5}
                      x2={selectedBox.x + selectedBox.w / 2}
                      y2={selectedBox.y - 27 / view.zoom}
                      stroke="#7965e9"
                      strokeWidth={1 / view.zoom}
                    />
                    <circle
                      data-handle="rotate"
                      pointerEvents="all"
                      cx={selectedBox.x + selectedBox.w / 2}
                      cy={selectedBox.y - 30 / view.zoom}
                      r={5 / view.zoom}
                      fill="white"
                      stroke="#7965e9"
                      strokeWidth={1 / view.zoom}
                      style={{ cursor: "grab" }}
                    />
                  </>
                )}
              </g>
            )}
            {marquee && (
              <rect
                {...marquee}
                fill="#7965e915"
                stroke="#7965e9"
                strokeWidth={1 / view.zoom}
              />
            )}
            {Object.values(cursors).map((c) => (
              <g
                key={c.id}
                transform={`translate(${c.x} ${c.y}) scale(${1 / view.zoom})`}
                pointerEvents="none"
              >
                <path d="M0 0L4 19L9 12L17 9Z" fill={c.color} stroke="white" />
                <rect
                  x="10"
                  y="19"
                  width={c.name.length * 7 + 18}
                  height="23"
                  rx="5"
                  fill={c.color}
                />
                <text x="18" y="35" fontSize="11" fill="white">
                  {c.name}
                </text>
              </g>
            ))}
          </g>
        </svg>
        {elements.length === 0 && (
          <div className="blank-board-message">
            <span className="empty-board-icon">
              <PenLine size={26} />
            </span>
            <h2>Start with a thought.</h2>
            <p>Add a note, sketch a shape, or explore an idea with AI.</p>
            <button className="btn" onClick={() => setPanel("ai")}>
              <Sparkles size={15} /> Open AI assistant
            </button>
          </div>
        )}
        <aside
          className="drawing-toolbar"
          aria-label="Drawing tools"
          role="toolbar"
        >
          {TOOLS.map(([I, key, label, shortcut], index) => (
            <React.Fragment key={key}>
              {[2, 5, 10, 12].includes(index) && (
                <span className="tool-separator" />
              )}
              <button
                className={tool === key ? "active" : ""}
                title={`${label}${shortcut ? ` (${shortcut})` : ""}`}
                aria-label={label}
                aria-pressed={tool === key}
                disabled={!editable && !["hand", "select"].includes(key)}
                onClick={() => chooseTool(key)}
              >
                <I size={18} />
                <small>{shortcut}</small>
              </button>
            </React.Fragment>
          ))}
        </aside>
        <div className="canvas-bottom-left">
          <div className="mobile-history">
            <button
              className="icon-btn"
              disabled={!editable || !history.current.past.length}
              aria-label="Undo"
              onClick={() => undo()}
            >
              <Undo2 size={16} />
            </button>
            <button
              className="icon-btn"
              disabled={!editable || !history.current.future.length}
              aria-label="Redo"
              onClick={() => undo(true)}
            >
              <Redo2 size={16} />
            </button>
          </div>
          <span className="canvas-watermark">
            <PenLine size={14} /> Sketchter
          </span>
          <span className="board-help">
            {board.role === "viewer"
              ? "View only"
              : "Space + drag to pan · Ctrl + scroll to zoom · Double-click to edit"}
          </span>
        </div>
        <div className="zoom-controls">
          <button
            onClick={() => setPanel(panel === "settings" ? null : "settings")}
            title="Canvas settings"
          >
            <Settings2 size={17} />
          </button>
          <span />
          <button onClick={() => zoom(1 / 1.2)} title="Zoom out">
            <Minus size={16} />
          </button>
          <button
            className="zoom-percent"
            onClick={() => setView((v) => ({ ...v, zoom: 1 }))}
            title="Reset to 100%"
          >
            {Math.round(view.zoom * 100)}%
          </button>
          <button onClick={() => zoom(1.2)} title="Zoom in">
            <Plus size={16} />
          </button>
          <span />
          <button onClick={() => fit()} title="Fit all content (1)">
            <Maximize size={16} />
          </button>
        </div>
        {editable &&
          (selection.length > 0 || !["select", "hand"].includes(tool)) && (
            <div className="properties-bar">
              <span className="property-label">STROKE</span>
              <div className="swatches">
                {COLORS.map((c) => (
                  <button
                    title={`Stroke ${c}`}
                    aria-label={`Stroke ${c}`}
                    className={currentStyle.stroke === c ? "chosen" : ""}
                    key={c}
                    style={{ background: c }}
                    onClick={() => changeStyle({ stroke: c })}
                  />
                ))}
              </div>
              <span className="property-label">FILL</span>
              <div className="swatches">
                {FILLS.map((c) => (
                  <button
                    title={`Fill ${c}`}
                    aria-label={`Fill ${c}`}
                    className={`${currentStyle.fill === c ? "chosen" : ""} ${c === "none" ? "no-fill" : ""}`}
                    key={c}
                    style={{ background: c === "none" ? "white" : c }}
                    onClick={() => changeStyle({ fill: c })}
                  />
                ))}
              </div>
              <span className="properties-divider" />
              <select
                title="Stroke width"
                value={currentStyle.strokeWidth || 2}
                onChange={(e) =>
                  changeStyle({ strokeWidth: Number(e.target.value) })
                }
              >
                <option value="1">Thin</option>
                <option value="2">Medium</option>
                <option value="4">Bold</option>
                <option value="7">Extra bold</option>
              </select>
              <button
                className={
                  currentStyle.sketch
                    ? "active property-button"
                    : "property-button"
                }
                title="Toggle hand-drawn style"
                onClick={() => changeStyle({ sketch: !currentStyle.sketch })}
              >
                <PenLine size={15} />
              </button>
              <button
                className={
                  currentStyle.dashed
                    ? "active property-button"
                    : "property-button"
                }
                title="Toggle dashed stroke"
                onClick={() => changeStyle({ dashed: !currentStyle.dashed })}
              >
                <Slash size={15} strokeDasharray="2 3" />
              </button>
              <select
                title="Font style"
                value={currentStyle.font || "sans"}
                onChange={(e) => changeStyle({ font: e.target.value })}
              >
                <option value="sans">Aa Sans</option>
                <option value="hand">Aa Hand</option>
              </select>
              <input
                aria-label="Font size"
                title="Font size"
                type="number"
                min="10"
                max="96"
                value={currentStyle.fontSize || 18}
                onChange={(e) =>
                  changeStyle({
                    fontSize: Math.max(
                      10,
                      Math.min(96, Number(e.target.value)),
                    ),
                  })
                }
              />
              {selection.length > 0 && (
                <>
                  <span className="properties-divider" />
                  <button
                    className="property-button"
                    title="Edit text or chart"
                    onClick={() => {
                      if (selectedElements[0].type === "chart")
                        setChartEdit(selectedElements[0]);
                      else setEditing(selectedElements[0]);
                    }}
                  >
                    <Type size={15} />
                  </button>
                  <button
                    className="property-button"
                    title="Duplicate selection"
                    onClick={duplicate}
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    className="property-button"
                    title="Bring to front"
                    onClick={bringToFront}
                  >
                    <BringToFront size={15} />
                  </button>
                  <button
                    className="property-button"
                    title="Delete selection"
                    onClick={deleteSelection}
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          )}
        {panel === "ai" && (
          <AIPanel
            close={() => setPanel(null)}
            selection={selectedElements}
            board={board}
            editable={editable}
            notify={notify}
            onResult={(action, data) => {
              const p = center();
              if (action === "edit") {
                if (!Array.isArray(data.items))
                  throw new Error("AI returned an invalid edit. Try again.");
                commit(
                  elementsRef.current.map((e) => {
                    const change = data.items.find(
                      (i) => i.id === e.id && selection.includes(i.id),
                    );
                    return change ? { ...e, text: String(change.text) } : e;
                  }),
                );
              } else if (action === "chart") {
                if (!Array.isArray(data.data))
                  throw new Error("AI returned an invalid chart.");
                add([
                  makeElement("chart", p.x - 200, p.y - 140, {
                    text: data.title,
                    chartType: data.chartType,
                    data: data.data,
                  }),
                ]);
              } else if (action === "diagram") {
                if (!Array.isArray(data.nodes))
                  throw new Error("AI returned an invalid diagram.");
                const nodes = data.nodes.slice(0, 12).map((n, i) =>
                  makeElement(
                    n.kind === "diamond" ? "diamond" : "rect",
                    p.x - 280 + (i % 3) * 260,
                    p.y - 140 + Math.floor(i / 3) * 190,
                    {
                      text: String(n.text),
                      w: 200,
                      h: 100,
                      fill: FILLS[i % 6],
                      aiId: n.id,
                    },
                  ),
                );
                const arrows = (data.edges || []).flatMap((edge) => {
                  const a = nodes.find((n) => n.aiId === edge.from),
                    b = nodes.find((n) => n.aiId === edge.to);
                  if (!a || !b) return [];
                  const start = { x: a.x + a.w / 2, y: a.y + a.h },
                    end = { x: b.x + b.w / 2, y: b.y };
                  if (a.y === b.y) {
                    start.x = a.x + a.w;
                    start.y = a.y + a.h / 2;
                    end.x = b.x;
                    end.y = b.y + b.h / 2;
                  }
                  return [
                    makeElement(
                      "arrow",
                      Math.min(start.x, end.x),
                      Math.min(start.y, end.y),
                      {
                        w: Math.abs(end.x - start.x),
                        h: Math.abs(end.y - start.y),
                        flipX: end.x < start.x,
                        flipY: end.y < start.y,
                      },
                    ),
                  ];
                });
                add([...arrows, ...nodes]);
              } else {
                if (!Array.isArray(data.items))
                  throw new Error("AI returned an invalid response.");
                add(
                  data.items.slice(0, 12).map((item, i) =>
                    makeElement(
                      "sticky",
                      p.x - 350 + (i % 3) * 250,
                      p.y - 150 + Math.floor(i / 3) * 220,
                      {
                        text: String(item.text),
                        w: 225,
                        h: 195,
                        fill: /^#[0-9a-f]{6}$/i.test(item.color)
                          ? item.color
                          : FILLS[i % 6],
                      },
                    ),
                  ),
                );
              }
            }}
          />
        )}
        {panel === "export" && (
          <div className="dropdown export-dropdown">
            <span className="dropdown-label">EXPORT WHITEBOARD</span>
            <button onClick={() => exportBoard("png")}>
              <ImagePlus size={16} />
              <span>
                Export as PNG<small>Crisp, ready-to-share image</small>
              </span>
            </button>
            <button onClick={() => exportBoard("svg")}>
              <Download size={16} />
              <span>
                Export as SVG<small>Scalable, editable vector</small>
              </span>
            </button>
          </div>
        )}
        {panel === "settings" && (
          <div className="floating-panel settings-panel">
            <header>
              <h3>Canvas settings</h3>
              <button
                className="icon-btn"
                aria-label="Close canvas settings"
                onClick={() => setPanel(null)}
              >
                <X size={16} />
              </button>
            </header>
            <span className="property-label">CANVAS PATTERN</span>
            {["dots", "grid", "plain"].map((pattern) => (
              <button
                disabled={!editable}
                key={pattern}
                className="pattern-option"
                onClick={async () => {
                  try {
                    await api(`/boards/${id}`, {
                      method: "PATCH",
                      body: { pattern },
                    });
                    setBoard((b) => ({ ...b, pattern }));
                  } catch (e) {
                    notify(e.message);
                  }
                }}
              >
                <span className={`pattern-sample ${pattern}`} />
                {pattern[0].toUpperCase() + pattern.slice(1)}
                {board.pattern === pattern && <Check size={15} />}
              </button>
            ))}
          </div>
        )}
        {panel === "emoji" && (
          <div className="floating-panel emoji-panel">
            <header>
              <h3>Choose an emoji</h3>
              <button
                className="icon-btn"
                aria-label="Close emoji picker"
                onClick={() => setPanel(null)}
              >
                <X size={16} />
              </button>
            </header>
            <div>
              {[
                "✨",
                "🌱",
                "💡",
                "🎯",
                "🚀",
                "❤️",
                "👀",
                "🙌",
                "👍",
                "🔥",
                "🌈",
                "☀️",
                "🌿",
                "🎉",
                "💭",
                "⭐",
                "📌",
                "✅",
                "❓",
                "⚡",
                "🦋",
                "🍋",
                "🐋",
                "🌸",
              ].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    const p = center();
                    add([
                      makeElement("emoji", p.x - 40, p.y - 40, {
                        text: emoji,
                        w: 80,
                        h: 80,
                      }),
                    ]);
                    setPanel(null);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={upload}
      />
      {editing && (
        <Modal
          title={editing.type === "emoji" ? "Choose an emoji" : "Edit text"}
          close={() => setEditing(null)}
        >
          <label className="sr-only" htmlFor="element-text">
            Element text
          </label>
          <textarea
            className="element-text-editor"
            autoFocus
            defaultValue={editing.text}
            id="element-text"
            rows="7"
            placeholder="What’s on your mind?"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                const text = e.currentTarget.value;
                commit(
                  elementsRef.current.map((el) =>
                    el.id === editing.id ? { ...el, text } : el,
                  ),
                );
                setEditing(null);
              }
            }}
          />
          <div className="modal-actions">
            <span className="muted">Ctrl/⌘ + Enter to save</span>
            <button
              className="btn primary"
              onClick={() => {
                const text = document.getElementById("element-text").value;
                commit(
                  elementsRef.current.map((el) =>
                    el.id === editing.id ? { ...el, text } : el,
                  ),
                );
                setEditing(null);
              }}
            >
              Save thought <Check size={15} />
            </button>
          </div>
        </Modal>
      )}
      {chartEdit && (
        <ChartEditor
          value={chartEdit}
          close={() => setChartEdit(null)}
          save={(el) => {
            if (elements.some((e) => e.id === el.id))
              commit(elements.map((e) => (e.id === el.id ? el : e)));
            else add([el]);
            setChartEdit(null);
          }}
        />
      )}
      {panel === "share" && (
        <ShareModal
          board={board}
          user={user}
          close={() => setPanel(null)}
          notify={notify}
          onChange={(members) => setBoard((b) => ({ ...b, members }))}
        />
      )}
    </div>
  );
}

function AIPanel({ close, selection, board, editable, notify, onResult }) {
  const [prompt, setPrompt] = useState(""),
    [action, setAction] = useState("brainstorm"),
    [count, setCount] = useState(6),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [summary, setSummary] = useState("");
  async function run(chosen = action) {
    if (chosen !== "summary" && !prompt.trim()) {
      setError("Enter a prompt to get started.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api(`/boards/${board.id}/ai`, {
        method: "POST",
        body: {
          action: chosen,
          prompt,
          count,
          selected: selection.map((e) => e.id),
        },
      });
      if (chosen === "summary") {
        if (typeof data.summary !== "string")
          throw new Error("AI could not summarize this board. Try again.");
        setSummary(data.summary);
      } else {
        onResult(chosen, data);
        notify("AI content added to your board.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className="floating-panel ai-panel">
      <header>
        <h3>
          <span className="ai-icon">
            <Sparkles size={16} />
          </span>{" "}
          AI assistant
        </h3>
        <button
          className="icon-btn"
          onClick={close}
          aria-label="Close AI assistant"
        >
          <X size={17} />
        </button>
      </header>
      <p className="muted">Turn a prompt into something you can build on.</p>
      <label className="sr-only" htmlFor="ai-prompt">
        AI prompt
      </label>
      <textarea
        id="ai-prompt"
        rows="5"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          selection.length
            ? "Describe a change… make this clearer, explore another angle, or fix the grammar."
            : "What’s on your mind? A launch plan, a new perspective, a little inspiration…"
        }
        maxLength={4000}
      />
      {selection.length > 0 && (
        <button
          className="btn primary full-width"
          disabled={busy || !editable}
          onClick={() => run("edit")}
        >
          <WandSparkles size={15} />
          Edit {selection.length} selected{" "}
          {selection.length === 1 ? "element" : "elements"}
        </button>
      )}
      <div className="panel-divider">
        <span>CREATE NEW CONTENT</span>
      </div>
      <div className="ai-action-grid">
        {[
          [StickyNote, "brainstorm", "Sticky notes"],
          [AlignLeft, "outline", "Outline"],
          [GitBranch, "diagram", "Flow diagram"],
          [ChartColumn, "chart", "Chart"],
        ].map(([I, key, label]) => (
          <button
            className={action === key ? "active" : ""}
            key={key}
            disabled={busy || !editable}
            onClick={() => setAction(key)}
          >
            <I size={15} />
            {label}
          </button>
        ))}
      </div>
      {["brainstorm", "outline"].includes(action) && (
        <label className="range-label">
          Ideas{" "}
          <input
            type="range"
            min="2"
            max="12"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
          <span>{count}</span>
        </label>
      )}
      <button
        className="btn primary full-width"
        disabled={busy || !editable}
        onClick={() => run()}
      >
        {busy ? (
          <LoaderCircle className="spin" size={15} />
        ) : (
          <Sparkles size={15} />
        )}
        {busy ? "Following the spark…" : "Bring it to the canvas"}
      </button>
      <button
        className="btn summary-btn full-width"
        disabled={busy}
        onClick={() => run("summary")}
      >
        <FileText size={15} />
        Summarize this board
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {summary && (
        <div className="ai-summary">
          <strong>Board summary</strong>
          <p>{summary}</p>
          <button
            className="text-btn"
            onClick={() =>
              navigator.clipboard
                .writeText(summary)
                .then(() => notify("Summary copied."))
                .catch(() =>
                  notify(
                    "Clipboard access is unavailable. Select and copy the text.",
                  ),
                )
            }
          >
            <Copy size={13} />
            Copy summary
          </button>
        </div>
      )}
      <div className="ai-footnote">
        <Sparkles size={11} /> AI can make mistakes. Review generated content.
      </div>
    </aside>
  );
}
function ChartEditor({ value, close, save }) {
  const [chart, setChart] = useState(clone(value));
  const data = chart.data || [];
  return (
    <Modal title="Edit chart" close={close}>
      <div className="chart-types">
        {["bar", "line", "pie", "donut"].map((type) => (
          <button
            className={chart.chartType === type ? "active" : ""}
            key={type}
            onClick={() => setChart((c) => ({ ...c, chartType: type }))}
          >
            <ChartColumn size={17} />
            {type[0].toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>
      <label className="field-label">
        Title
        <input
          value={chart.text}
          onChange={(e) => setChart((c) => ({ ...c, text: e.target.value }))}
        />
      </label>
      <div className="data-heading">
        <span className="field-label">Data</span>
        <button
          className="text-btn"
          disabled={data.length >= 12}
          onClick={() =>
            setChart((c) => ({
              ...c,
              data: [...data, { label: `Item ${data.length + 1}`, value: 0 }],
            }))
          }
        >
          <Plus size={13} />
          Add row
        </button>
      </div>
      <div className="chart-data-rows">
        {data.map((d, i) => (
          <div key={i}>
            <span style={{ background: FILLS[i % 6] }} />
            <input
              aria-label={`Row ${i + 1} label`}
              value={d.label}
              maxLength={30}
              onChange={(e) =>
                setChart((c) => ({
                  ...c,
                  data: data.map((row, j) =>
                    j === i ? { ...row, label: e.target.value } : row,
                  ),
                }))
              }
            />
            <input
              aria-label={`Row ${i + 1} value`}
              type="number"
              value={d.value}
              onChange={(e) =>
                setChart((c) => ({
                  ...c,
                  data: data.map((row, j) =>
                    j === i ? { ...row, value: Number(e.target.value) } : row,
                  ),
                }))
              }
            />
            <button
              className="icon-btn"
              disabled={data.length <= 1}
              title="Remove row"
              onClick={() =>
                setChart((c) => ({
                  ...c,
                  data: data.filter((_, j) => j !== i),
                }))
              }
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <p className="muted small-text">
        Bar, pie, and donut charts use non-negative values.
      </p>
      <div className="modal-actions">
        <button className="btn" onClick={close}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={!data.length}
          onClick={() => save(chart)}
        >
          Save chart <Check size={14} />
        </button>
      </div>
    </Modal>
  );
}
function ShareModal({ board, user, close, notify, onChange }) {
  const [email, setEmail] = useState(""),
    [role, setRole] = useState("editor"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function invite(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onChange(
        await api(`/boards/${board.id}/members`, {
          method: "POST",
          body: { email, role },
        }),
      );
      setEmail("");
      notify(
        "Access granted. Copy the board link and send it to your collaborator.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(email) {
    try {
      onChange(
        await api(`/boards/${board.id}/members/${encodeURIComponent(email)}`, {
          method: "DELETE",
        }),
      );
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Modal title="Share whiteboard" close={close}>
      <p className="muted">Choose who can view and edit this whiteboard.</p>
      {board.role === "owner" && (
        <form className="invite-form" onSubmit={invite}>
          <input
            type="email"
            placeholder="teammate@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Collaborator email"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            aria-label="Collaborator role"
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <button className="btn primary" disabled={busy}>
            {busy ? (
              <LoaderCircle size={14} className="spin" />
            ) : (
              <Plus size={14} />
            )}
            Invite
          </button>
        </form>
      )}
      {error && <p className="form-error">{error}</p>}
      <p className="property-label people-access-label">
        PEOPLE WITH ACCESS ({board.members.length + 1})
      </p>
      <div className="member-row">
        <span className="avatar">
          {board.role === "owner" ? user.name[0] : "O"}
        </span>
        <div>
          <strong>
            {board.role === "owner" ? `${user.name} (you)` : "Board owner"}
          </strong>
          <small>{board.role === "owner" ? user.email : ""}</small>
        </div>
        <span className="role-label">Owner</span>
      </div>
      {board.members.map((m) => (
        <div className="member-row" key={m.email}>
          <span className="avatar muted-avatar">
            {m.email[0].toUpperCase()}
          </span>
          <div>
            <strong>
              {m.email}
              {m.email === user.email ? " (you)" : ""}
            </strong>
            <small>Access by email</small>
          </div>
          <span className="role-label">{m.role}</span>
          {board.role === "owner" && (
            <button
              className="icon-btn"
              title={`Remove ${m.email}`}
              onClick={() => remove(m.email)}
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      <div className="sharing-info">
        <Users size={15} />
        <p>
          Only invited people can open this board. They’ll need an account with
          the email you invited. Invitations grant access; no email is sent
          automatically.
        </p>
      </div>
      <button
        className="btn full-width"
        onClick={() =>
          navigator.clipboard
            .writeText(location.href)
            .then(() => notify("Board link copied."))
            .catch(() => {
              setError(`Copy this link: ${location.href}`);
            })
        }
      >
        <Link size={15} />
        Copy board link
      </button>
    </Modal>
  );
}
