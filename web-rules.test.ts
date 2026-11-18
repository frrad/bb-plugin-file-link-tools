import { describe, it, expect } from "vitest";
import { configurationSchema, defaultConfiguration } from "./actions";
import { applyExample, domainPattern, patternSchema, webActionFor, webUrl } from "./web-rules";
import { openMainBrowser } from "./web-opening";

describe("web routing", () => {
  it("migrates stored file-only settings without losing file rules", () => {
    const { webDefault, webRules, examples, ...old } = defaultConfiguration;
    const next = configurationSchema.parse(old);
    expect(next.rules).toEqual(old.rules);
    expect(next.webDefault).toBe("bb");
    expect(next.examples).toHaveLength(2);
    expect(webActionFor(next, "https://modal.enterprise.slack.com/archives/C123")?.action).toBe("external");
    expect(webActionFor(next, "https://github.com/foo")?.action).toBe("bb");
  });
  it("matches the first rule, treats regexes as case insensitive and bounds hostnames", () => {
    const config = configurationSchema.parse(defaultConfiguration);
    expect(webActionFor(config, "https://SLACK.com/test")?.action).toBe("external");
    for (const value of ["https://notslack.com/", "https://slack.com.evil.org/", "https://evil.org/?next=slack.com", "https://evil.org/slack.com/"]) {
      expect(webActionFor(config, value)?.action).toBe("bb");
    }
    config.webRules.unshift({ pattern: "^https://modal\\.enterprise\\.slack\\.com/", action: "bb" });
    expect(webActionFor(config, "https://modal.enterprise.slack.com/archives/C123")).toEqual({ action: "bb", ruleIndex: 0 });
  });
  it("validates patterns, rejects non-web destinations and avoids catastrophic regex backtracking", () => {
    expect(patternSchema.safeParse("[").success).toBe(false);
    expect(patternSchema.safeParse("a".repeat(513)).success).toBe(false);
    expect(patternSchema.safeParse("(a+)\\1").success).toBe(false);
    for (const url of ["javascript:alert(1)", "file:///tmp/foo", "slack://open", "/settings", "https://u:pass@slack.com/", "https://slack.com/\n"]) expect(webUrl(url)).toBe(null);
    expect(webActionFor({ webDefault: "bb", webRules: [{ pattern: "(a+)+$", action: "external" }] }, `https://example.com/${"a".repeat(4000)}!`)?.action).toBe("bb");
  });
  it("applies a domain example as a first rule and updates rather than duplicates it", () => {
    const example = { url: "https://docs.example.com/a?b=1", action: "external" as const, narrative: "Use my main browser for these docs" };
    const config = applyExample(defaultConfiguration, example);
    expect(config.webRules[0].pattern).toBe(domainPattern(example.url));
    expect(webActionFor(config, "https://docs.example.com/other")?.action).toBe("external");
    expect(webActionFor(config, "https://docsXexample.com/other")?.action).toBe("bb");
    const updated = applyExample(config, { ...example, action: "bb" });
    expect(updated.webRules).toHaveLength(config.webRules.length);
    expect(updated.webRules[0].action).toBe("bb");
  });
  it("opens on the viewing desktop, not through a server RPC", async () => {
    const received: string[] = [];
    const host = { bbDesktop: { openExternalUrl: (url: string) => { received.push(url); } }, open: () => { throw Error("wrong opener"); } } as unknown as Window;
    await openMainBrowser("https://slack.com/a?b=1#x", host);
    expect(received).toEqual(["https://slack.com/a?b=1#x"]);
    expect(() => openMainBrowser("file:///tmp/x", host)).toThrow();
  });
});
