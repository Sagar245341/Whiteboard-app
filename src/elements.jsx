import React from "react";
export const COLORS = [
  "#292d3b",
  "#3b82f6",
  "#8b5cf6",
  "#e35d6a",
  "#db8b14",
  "#14a3a0",
  "#ffffff",
];
export const FILLS = [
  "#fff4bd",
  "#dceee3",
  "#e8def9",
  "#fce0e6",
  "#dcecfb",
  "#ffdfc5",
  "#ffffff",
  "none",
];
export const uid = () => crypto.randomUUID();
export function makeElement(type, x, y, style = {}) {
  return {
    id: uid(),
    type,
    x,
    y,
    w:
      type === "sticky"
        ? 210
        : type === "text"
          ? 280
          : type === "chart"
            ? 400
            : 180,
    h:
      type === "sticky"
        ? 170
        : type === "text"
          ? 80
          : type === "chart"
            ? 280
            : 110,
    text:
      type === "sticky"
        ? "A little idea…"
        : type === "text"
          ? "Write something…"
          : type === "emoji"
            ? "✨"
            : "",
    stroke: "#292d3b",
    fill: type === "sticky" ? "#fff4bd" : "none",
    strokeWidth: 2,
    fontSize: type === "text" ? 24 : 17,
    font: "sans",
    rotation: 0,
    ...style,
  };
}
export function bounds(elements) {
  if (!elements.length) return { x: 0, y: 0, w: 1000, h: 700 };
  const xs = elements.map((e) => e.x),
    ys = elements.map((e) => e.y);
  const x = Math.min(...xs),
    y = Math.min(...ys);
  return {
    x,
    y,
    w: Math.max(...elements.map((e) => e.x + e.w)) - x,
    h: Math.max(...elements.map((e) => e.y + e.h)) - y,
  };
}
function linesFor(text, width, fontSize) {
  return String(text || "")
    .split("\n")
    .flatMap((paragraph) => {
      const words = paragraph.split(" "),
        lines = [];
      let line = "";
      for (let word of words) {
        if (
          (line + " " + word).length > Math.max(5, width / (fontSize * 0.54)) &&
          line
        ) {
          lines.push(line);
          line = "";
        }
        line += (line ? " " : "") + word;
      }
      lines.push(line);
      return lines;
    });
}
export function Chart({ e }) {
  const data = e.data || [
    { label: "Q1", value: 30 },
    { label: "Q2", value: 55 },
    { label: "Q3", value: 40 },
    { label: "Q4", value: 68 },
  ];
  const max = Math.max(1, ...data.map((d) => Math.abs(Number(d.value) || 0)));
  const plotH = e.h - 90,
    plotW = e.w - 70;
  const palette = [
    "#358565",
    "#84b6a0",
    "#c1a4e7",
    "#efbb72",
    "#7eb7d5",
    "#e49ca8",
  ];
  const total =
    data.reduce((s, d) => s + Math.max(0, Number(d.value) || 0), 0) || 1;
  let angle = -Math.PI / 2;
  return (
    <g>
      <rect width={e.w} height={e.h} rx="12" fill="#fff" stroke="#e1e6e0" />
      <text x="22" y="31" fontSize="16" fontWeight="600" fill="#294b3c">
        {e.text || "Chart"}
      </text>
      {["pie", "donut"].includes(e.chartType) ? (
        <>
          <g transform={`translate(${e.w * 0.34} ${e.h * 0.57})`}>
            {data.map((d, i) => {
              const start = angle;
              angle +=
                (Math.max(0, Number(d.value) || 0) / total) * Math.PI * 2;
              const r = Math.min(e.w * 0.22, e.h * 0.31);
              const end = angle - 0.00001;
              return (
                <path
                  key={i}
                  d={`M 0 0 L ${Math.cos(start) * r} ${Math.sin(start) * r} A ${r} ${r} 0 ${end - start > Math.PI ? 1 : 0} 1 ${Math.cos(end) * r} ${Math.sin(end) * r} Z`}
                  fill={palette[i % palette.length]}
                />
              );
            })}
            {e.chartType === "donut" && (
              <circle r={Math.min(e.w * 0.12, e.h * 0.17)} fill="white" />
            )}
          </g>
          {data.map((d, i) => (
            <g key={i} transform={`translate(${e.w * 0.64} ${65 + i * 24})`}>
              <rect
                width="9"
                height="9"
                rx="2"
                fill={palette[i % palette.length]}
              />
              <text x="16" y="9" fontSize="11" fill="#526258">
                {d.label}: {d.value}
              </text>
            </g>
          ))}
        </>
      ) : (
        <g transform="translate(45 55)">
          {[0, 0.5, 1].map((v) => (
            <g key={v}>
              <line
                x1="0"
                y1={plotH * v}
                x2={plotW}
                y2={plotH * v}
                stroke="#edf0ec"
              />
              <text
                x="-9"
                y={plotH * v + 4}
                textAnchor="end"
                fontSize="10"
                fill="#8b948b"
              >
                {Math.round(max * (1 - v))}
              </text>
            </g>
          ))}
          {e.chartType === "line" && (
            <polyline
              points={data
                .map(
                  (d, i) =>
                    `${((i + 0.5) * plotW) / data.length},${plotH - (Number(d.value) / max) * plotH}`,
                )
                .join(" ")}
              fill="none"
              stroke="#358565"
              strokeWidth="3"
            />
          )}
          {data.map((d, i) => (
            <g key={i}>
              {e.chartType === "line" ? (
                <circle
                  cx={((i + 0.5) * plotW) / data.length}
                  cy={plotH - (Number(d.value) / max) * plotH}
                  r="4"
                  fill="#358565"
                />
              ) : (
                <rect
                  x={((i + 0.15) * plotW) / data.length}
                  y={plotH - (Math.max(0, Number(d.value)) / max) * plotH}
                  width={(plotW / data.length) * 0.65}
                  height={(Math.max(0, Number(d.value)) / max) * plotH}
                  rx="4"
                  fill={palette[i % palette.length]}
                />
              )}
              <text
                x={((i + 0.5) * plotW) / data.length}
                y={plotH + 20}
                textAnchor="middle"
                fontSize="11"
                fill="#78847a"
              >
                {String(d.label).slice(0, 10)}
              </text>
            </g>
          ))}
        </g>
      )}
    </g>
  );
}
export function ElementView({ e }) {
  const { w, h } = e;
  const adaptive =
    ["#294b3c", "#292d3b", "#263e31", "#8b948b"].includes(e.stroke) &&
    (["text", "pen", "line", "arrow"].includes(e.type) ||
      !e.fill ||
      e.fill === "none");
  const style = {
    stroke: e.stroke,
    strokeWidth: e.strokeWidth || 2,
    fill: e.fill || "none",
    strokeLinejoin: "round",
    strokeLinecap: "round",
    strokeDasharray: e.dashed ? "7 5" : undefined,
  };
  const inset =
    e.type === "sticky" ? 20 : ["text", "emoji"].includes(e.type) ? 0 : 12;
  const fontSize = e.fontSize || 17;
  const lines = linesFor(e.text, w - inset * 2, fontSize);
  const centered = ["rect", "ellipse", "diamond"].includes(e.type);
  const text = (
    <text
      fill={e.stroke || "#294b3c"}
      fontSize={fontSize}
      fontFamily={
        e.font === "hand"
          ? "'Segoe Print', 'Comic Sans MS', cursive"
          : "Arial, sans-serif"
      }
      textAnchor={centered ? "middle" : "start"}
    >
      {lines
        .slice(0, Math.max(1, Math.floor((h - inset) / (fontSize * 1.4))))
        .map((line, i) => (
          <tspan
            key={i}
            x={centered ? w / 2 : inset}
            y={
              (centered
                ? h / 2 - (lines.length - 1) * fontSize * 0.7
                : inset + fontSize) +
              i * fontSize * 1.4
            }
          >
            {line}
          </tspan>
        ))}
    </text>
  );
  let shape;
  if (e.type === "sticky")
    shape = (
      <>
        <rect
          width={w}
          height={h}
          rx="3"
          fill={e.fill}
          style={{ filter: "drop-shadow(0px 3px 3px #1c392512)" }}
        />
        <rect width={w} height="25" fill="#000" opacity=".025" />
        {text}
      </>
    );
  else if (e.type === "rect")
    shape = (
      <>
        <rect width={w} height={h} rx={e.sketch ? 3 : 9} {...style} />
        {text}
      </>
    );
  else if (e.type === "ellipse")
    shape = (
      <>
        <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} {...style} />
        {text}
      </>
    );
  else if (e.type === "diamond")
    shape = (
      <>
        <polygon
          points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`}
          {...style}
        />
        {text}
      </>
    );
  else if (e.type === "text") shape = text;
  else if (e.type === "emoji")
    shape = (
      <text x="0" y={h * 0.85} fontSize={Math.min(w, h) * 0.9}>
        {e.text}
      </text>
    );
  else if (e.type === "image")
    shape = (
      <image
        width={w}
        height={h}
        href={e.src}
        preserveAspectRatio="xMidYMid meet"
      />
    );
  else if (e.type === "chart") shape = <Chart e={e} />;
  else if (e.type === "pen")
    shape = (
      <polyline
        points={(e.points || []).map((p) => `${p.x},${p.y}`).join(" ")}
        {...style}
        fill="none"
      />
    );
  else if (e.type === "line" || e.type === "arrow") {
    const x1 = e.flipX ? w : 0,
      x2 = e.flipX ? 0 : w,
      y1 = e.flipY ? h : 0,
      y2 = e.flipY ? 0 : h;
    const angle = Math.atan2(y2 - y1, x2 - x1),
      length = 12 + (e.strokeWidth || 2);
    shape = (
      <>
        <line x1={x1} y1={y1} x2={x2} y2={y2} {...style} />
        {e.type === "arrow" && (
          <path
            d={`M ${x2 - length * Math.cos(angle - 0.45)} ${y2 - length * Math.sin(angle - 0.45)} L ${x2} ${y2} L ${x2 - length * Math.cos(angle + 0.45)} ${y2 - length * Math.sin(angle + 0.45)}`}
            {...style}
            fill="none"
          />
        )}
      </>
    );
  }
  return (
    <g
      className={adaptive ? "adaptive-element" : undefined}
      transform={`translate(${e.x} ${e.y}) rotate(${e.rotation || 0} ${w / 2} ${h / 2})`}
    >
      {e.sketch && ["rect", "ellipse", "diamond"].includes(e.type) && (
        <g opacity=".2" transform="translate(2 -2)">
          {shape}
        </g>
      )}
      {shape}
    </g>
  );
}
export function MiniBoard({ elements = [], pattern = "dots" }) {
  const b = bounds(elements);
  const pad = 50;
  return (
    <svg
      viewBox={`${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`}
      className="mini-board"
      aria-hidden="true"
    >
      {elements
        .map((e, i) => ({ ...e, layer: e.layer ?? i }))
        .sort((a, b) => a.layer - b.layer)
        .map((e) => (
          <ElementView key={e.id} e={e} />
        ))}
    </svg>
  );
}
export function templateElements(kind = "launch") {
  const el = (type, x, y, text, options = {}) =>
    makeElement(type, x, y, { text, ...options });
  const title = (text) =>
    el("text", 60, 35, text, { w: 1000, h: 65, fontSize: 32 });
  if (kind === "blank") return [];
  if (kind === "flow")
    return [
      title("Project workflow"),
      el("text", 60, 110, "A clear path from opportunity to outcome.", {
        w: 900,
        fontSize: 17,
        h: 40,
      }),
      ...["Discover", "Define", "Design", "Deliver"].map((text, i) =>
        el("rect", 60 + i * 260, 230, text, {
          w: 200,
          h: 110,
          fill: ["#e5e0fb", "#dcecfb", "#fff0c5", "#dceee3"][i],
        }),
      ),
      ...[0, 1, 2].map((i) =>
        el("arrow", 270 + i * 260, 285, "", { w: 40, h: 0 }),
      ),
      el(
        "sticky",
        320,
        420,
        "Review checkpoint\n\nWhat do we need to learn before moving to the next step?",
        { w: 270, h: 190, fill: "#e5e0fb" },
      ),
    ];
  if (kind === "retro")
    return [
      title("Team retrospective"),
      el("text", 60, 110, "Reflect on the work. Agree on the next step.", {
        w: 900,
        fontSize: 17,
        h: 40,
      }),
      ...["Keep doing", "Improve", "Try next"].map((text, i) =>
        el("text", 60 + i * 330, 220, text, { w: 280, h: 45, fontSize: 22 }),
      ),
      ...[
        "What worked well?\n\nCapture a practice or moment worth repeating.",
        "Where did we get stuck?\n\nDescribe the problem, not the person.",
        "What will we change?\n\nChoose one concrete action for the next cycle.",
      ].map((text, i) =>
        el("sticky", 60 + i * 330, 300, text, {
          w: 280,
          h: 240,
          fill: ["#dceee3", "#ffe4df", "#e5e0fb"][i],
        }),
      ),
    ];
  return [
    title("Product discovery"),
    el(
      "text",
      60,
      110,
      "Understand the challenge. Explore the possibilities.",
      { w: 1000, h: 45, fontSize: 17 },
    ),
    ...["01 / THE CHALLENGE", "02 / THE OPPORTUNITY", "03 / THE NEXT STEP"].map(
      (text, i) =>
        el("text", 60 + i * 330, 210, text, { w: 300, h: 35, fontSize: 13 }),
    ),
    ...[
      "What are we solving?\n\nDescribe the problem in one sentence.\n\nWho experiences it most?",
      "What could be better?\n\nExplore a new approach.\n\nWhat would success look like?",
      "How do we move forward?\n\nIdentify the smallest useful experiment.\n\nWhat do we need to learn?",
    ].map((text, i) =>
      el("sticky", 60 + i * 330, 265, text, {
        w: 280,
        h: 270,
        fill: ["#fff0c5", "#e5e0fb", "#dcecfb"][i],
        fontSize: 18,
      }),
    ),
    el("text", 60, 610, "From insight to action", {
      w: 900,
      h: 50,
      fontSize: 26,
    }),
    ...["Explore", "Make", "Learn"].map((text, i) =>
      el("rect", 60 + i * 330, 710, text, {
        w: 230,
        h: 80,
        fill: ["#e5e0fb", "#dcecfb", "#dceee3"][i],
      }),
    ),
    ...[0, 1].map((i) => el("arrow", 310 + i * 330, 750, "", { w: 60, h: 0 })),
  ];
}
