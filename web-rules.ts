import { z } from "zod";
import { RE2JS } from "re2js";

export const webActions = ["bb", "external"] as const;
export type WebAction = typeof webActions[number];
export const webActionLabels: Record<WebAction, string> = { bb: "BB browser", external: "Main browser" };
const compiled = new Map<string, RE2JS>();
export function compilePattern(pattern: string) {
  let regex = compiled.get(pattern);
  if (!regex) {
    regex = RE2JS.compile(pattern, RE2JS.CASE_INSENSITIVE);
    if (compiled.size >= 100) compiled.clear();
    compiled.set(pattern, regex);
  }
  return regex;
}
export const patternSchema = z.string().trim().min(1, "Enter a URL pattern").max(512).superRefine((value, ctx) => {
  try { compilePattern(value); }
  catch (error) { ctx.addIssue({ code: "custom", message: `Invalid URL pattern: ${(error as Error).message}` }); }
});
export function webUrl(value: string): string | null {
  if (value.length > 8192 || /[\x00-\x20\x7f]/u.test(value)) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export const exampleUrlSchema = z.string().max(8192).refine(value => webUrl(value) !== null, "Enter an HTTP(S) URL without credentials");
export const webRuleSchema = z.object({ pattern: patternSchema, action: z.enum(webActions) });
export const exampleSchema = z.object({ url: exampleUrlSchema, action: z.enum(webActions), narrative: z.string().trim().max(500) });
export const initialWebRules = [{ pattern: "^https?://([a-z0-9-]+\\.)*slack\\.com([/:?#]|$)", action: "external" as const }];
export const initialExamples = [
  { url: "https://modal.enterprise.slack.com/archives/C123/p1234567890123456", action: "external" as const, narrative: "All Slack links should open in my main browser so it can hand them to the Slack app." },
  { url: "https://github.com/frrad/bb-plugin-file-link-tools", action: "bb" as const, narrative: "GitHub links should open inside BB." },
];
export type WebRule = z.infer<typeof webRuleSchema>;
export type LinkExample = z.infer<typeof exampleSchema>;
export type WebConfiguration = { webDefault: WebAction; webRules: WebRule[]; examples: LinkExample[] };
export function webActionFor(config: Pick<WebConfiguration, "webDefault" | "webRules">, value: string) {
  const url = webUrl(value);
  if (!url) return null;
  const index = config.webRules.findIndex(rule => compilePattern(rule.pattern).test(url));
  return { action: index < 0 ? config.webDefault : config.webRules[index].action, ruleIndex: index };
}
export function domainPattern(value: string) {
  const url = webUrl(value);
  if (!url) throw new Error("Enter a valid HTTP(S) URL first");
  const hostname = new URL(url).hostname.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return `^https?://${hostname}([/:?#]|$)`;
}
export function applyExample(config: WebConfiguration, example: LinkExample): WebConfiguration {
  const pattern = domainPattern(example.url);
  return { ...config, webRules: [{ pattern, action: example.action }, ...config.webRules.filter(rule => rule.pattern !== pattern)] };
}
