import { useEffect, useRef } from "react";
import { parseFileLink, type ParsedFileLink } from "./links";

export function useFileLinks(threadId: string, inspect: ((path: string) => Promise<{ directory: boolean; hostId: string } | null>) | null) {
  const verified = useRef(new Map<HTMLAnchorElement, ParsedFileLink & { directory: boolean; hostId: string }>());
  useEffect(() => {
    let disposed = false;
    let frame = 0;
    const observed = new Map<HTMLAnchorElement, { href: string; link: ParsedFileLink }>();
    const checks = new Map<string, Promise<{ directory: boolean; hostId: string } | null>>();
    verified.current = new Map();
    if (!inspect) return;
    const visibility = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const anchor = entry.target as HTMLAnchorElement;
        const candidate = observed.get(anchor);
        if (!candidate) continue;
        visibility.unobserve(anchor);
        let check = checks.get(candidate.link.path);
        if (!check) {
          // Unverified links retain BB’s normal behavior.
          check = inspect(candidate.link.path).catch(() => null);
          checks.set(candidate.link.path, check);
        }
        void check.then((info) => {
          if (disposed || !info || observed.get(anchor) !== candidate
            || !anchor.isConnected || anchor.getAttribute("href") !== candidate.href) return;
          verified.current.set(anchor, { ...candidate.link, ...info });
        });
      }
    });
    function sync() {
      frame = 0;
      const found = new Set<HTMLAnchorElement>();
      for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-timeline-row-id] a[href]"))) {
        if (anchor.closest("[data-timeline-row-id]")?.getAttribute("data-timeline-row-id")?.split(":")[0] !== threadId) continue;
        const href = anchor.getAttribute("href")!;
        const link = parseFileLink(href);
        if (!link) continue;
        found.add(anchor);
        if (observed.get(anchor)?.href === href) continue;
        verified.current.delete(anchor);
        observed.set(anchor, { href, link });
        visibility.observe(anchor);
      }
      for (const anchor of observed.keys()) {
        if (found.has(anchor)) continue;
        visibility.unobserve(anchor);
        observed.delete(anchor);
        verified.current.delete(anchor);
      }
    }
    const mutations = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(sync);
    });
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "data-timeline-row-id"] });
    sync();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      mutations.disconnect();
      visibility.disconnect();
      verified.current.clear();
    };
  }, [threadId, inspect]);
  return verified;
}
