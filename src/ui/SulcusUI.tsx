import { useLayoutEffect, useRef } from "react";
import "./app.scoped.css";
import "./film.css";

// One Sulcus Cloud "browser window": the product's own markup and stylesheet,
// laid out at a fixed size. Where the product sets geometry through the CSSOM
// (app.js applyGeometry, placeApprovalPanel), this does the same after layout.

export type UIRect = { x: number; y: number; w: number; h: number };
export type Measured = { rects: Record<string, UIRect>; all: Record<string, UIRect[]> };
export const emptyMeasured = (): Measured => ({ rects: {}, all: {} });

const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

// app.js applyGeometry(): data-left / data-width / data-depth / data-level
// become styles. The film's entrance progress (data-fade, data-enter) becomes
// the state of the product's own one-shot animations at that moment.
export const geometry = (html: string) =>
  html.replace(/<([a-z0-9]+)(\s[^>]*?)?(\/?)>/gi, (tag, name: string, attrs: string | undefined, close: string) => {
    if (!attrs || !attrs.includes("data-")) return tag;
    const style: string[] = [];
    const get = (key: string) => {
      const m = attrs.match(new RegExp(`\\sdata-${key}="([^"]*)"`));
      return m ? m[1] : null;
    };
    const left = get("left");
    const width = get("width");
    const depth = get("depth");
    const level = get("level");
    const fade = get("fade");
    const enter = get("enter");
    if (left != null) style.push(`left:${left}%`);
    if (width != null) style.push(`width:${width}%`);
    if (depth != null) style.push(`--depth:${depth}`);
    if (level != null) style.push(`--level:${level}`);
    if (fade != null) style.push(`opacity:${ease(Number(fade)).toFixed(3)}`); // cr-fade .5s ease-out
    if (enter != null) {
      const k = ease(Number(enter)); // cr-open: from opacity 0, translateY(-4px)
      style.push(`opacity:${k.toFixed(3)}`, `transform:translateY(${(-4 * (1 - k)).toFixed(2)}px)`);
    }
    if (!style.length) return tag;
    return `<${name}${attrs} style="${style.join(";")}"${close}>`;
  });

// Element positions in the plane's own pixels (unaffected by any transform on
// the plane), for light the film draws on top of the UI.
const local = (el: HTMLElement, root: HTMLElement): UIRect => {
  let x = 0;
  let y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== root) {
    x += n.offsetLeft;
    y += n.offsetTop;
    let p: HTMLElement | null = n.parentElement;
    const off = n.offsetParent as HTMLElement | null;
    // Subtract the scroll of every container between here and the next
    // offset parent.
    while (p && p !== off && p !== root) {
      x -= p.scrollLeft;
      y -= p.scrollTop;
      p = p.parentElement;
    }
    if (off && off !== root) {
      x -= off.scrollLeft;
      y -= off.scrollTop;
    }
    n = off;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
};

export type AfterLayout = {
  // Scroll the workspace (the page under the top bar), in px.
  pageScroll?: number;
  // Scroll the event list so this event's row sits `offset` px from its top.
  listTo?: { sequence: number; offset: number };
  // Elements to measure, by name → CSS selector.
  measure?: Record<string, string>;
  // Every element matching, by name → CSS selector.
  measureAll?: Record<string, string>;
};

type Props = {
  html: string;
  width: number;
  height: number;
  vars?: Record<string, string | number>;
  after?: AfterLayout;
  // Filled in after layout with the measured rects.
  sink?: { current: Measured };
  style?: React.CSSProperties;
  className?: string;
};

export const SulcusUI: React.FC<Props> = ({ html, width, height, vars = {}, after, sink, style, className }) => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const workspace = root.querySelector<HTMLElement>(".workspace");
    if (workspace) workspace.scrollTop = after?.pageScroll ?? 0;

    if (after?.listTo) {
      const list = root.querySelector<HTMLElement>(".event-list");
      const row = root.querySelector<HTMLElement>(`[data-sequence="${after.listTo.sequence}"]`);
      if (list && row) list.scrollTop = Math.max(0, row.offsetTop - list.offsetTop - after.listTo.offset);
    }

    // app.js placeApprovalPanel(): the panel sits just below its waiting
    // row, kept inside the run surface.
    const panel = root.querySelector<HTMLElement>("#approval-panel");
    if (panel) {
      const stage = panel.parentElement!;
      const row = stage.querySelector<HTMLElement>(".cr-row.is-focus");
      const cr = stage.closest<HTMLElement>(".cr");
      if (row && cr) {
        const top = local(row, stage).y + row.offsetHeight + 14;
        const max = cr.offsetHeight - stage.offsetTop - panel.offsetHeight - 12;
        panel.style.top = `${Math.max(12, Math.min(top, max))}px`;
      }
    }

    if (sink) {
      const out = emptyMeasured();
      for (const [name, selector] of Object.entries(after?.measure ?? {})) {
        const el = root.querySelector<HTMLElement>(selector);
        if (el) out.rects[name] = local(el, root);
      }
      for (const [name, selector] of Object.entries(after?.measureAll ?? {}))
        out.all[name] = [...root.querySelectorAll<HTMLElement>(selector)].map((el) => local(el, root));
      sink.current = out;
    }
  });

  return (
    <div
      ref={ref}
      className={`sulcus-ui${className ? ` ${className}` : ""}`}
      style={
        {
          width,
          height,
          "--film-h": `${height}px`,
          ...Object.fromEntries(Object.entries(vars).map(([k, v]) => [`--film-${k}`, String(v)])),
          ...style,
        } as React.CSSProperties
      }
      dangerouslySetInnerHTML={{ __html: geometry(html) }}
    />
  );
};
