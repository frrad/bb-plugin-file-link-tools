import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./settings.css";

export type LinkMenuTarget = { anchor: HTMLAnchorElement; x: number; y: number };
export function LinkMenu({ target, label, dismiss, children }: {
  target: LinkMenuTarget; label: string; dismiss(): void; children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const previousFocus = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const onDismiss = useRef(dismiss);
  onDismiss.current = dismiss;
  useEffect(() => {
    const menuRoot = root.current!;
    const rect = menuRoot.getBoundingClientRect();
    menuRoot.style.left = `${Math.max(8, Math.min(target.x, window.innerWidth - rect.width - 8))}px`;
    menuRoot.style.top = `${Math.max(8, Math.min(target.y, window.innerHeight - rect.height - 8))}px`;
    menuRoot.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    function outside(event: PointerEvent) { if (!root.current?.contains(event.target as Node)) onDismiss.current(); }
    function close(event: Event) {
      if (!(event.target instanceof Node) || !root.current?.contains(event.target)) onDismiss.current();
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape" || event.key === "Tab") {
        event.preventDefault(); event.stopPropagation(); onDismiss.current();
        previousFocus.current?.focus({ preventScroll: true }); return;
      }
      const buttons = Array.from(root.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    }
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", key, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", close); window.removeEventListener("scroll", close, true);
    };
  }, [target]);
  return createPortal(<div ref={root} data-link-rules role="menu" aria-label={label} className="lr-menu" style={{ left: target.x, top: target.y }}>{children}</div>, document.body);
}
