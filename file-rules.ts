import { z } from "zod";
import { fileExtension } from "./file-request.ts";
export const viewerActionPattern = /^viewer:[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+$/u;
export const fileExampleSchema = z.object({ path: z.string().trim().min(1).max(32768), action: z.string().min(1), narrative: z.string().trim().max(500), directory: z.boolean().default(false) });
export type FileExample = z.infer<typeof fileExampleSchema>;
export function applyFileExample<T extends { rules: { extensions: string[]; action: string }[] }>(config: T, example: FileExample): T {
  const extension = fileExtension(example.path);
  if (example.directory || !/^\.[a-z0-9]+$/u.test(extension)) throw new Error("Use an example with a file extension");
  const rules = config.rules.map(rule => ({ ...rule, extensions: rule.extensions.filter(ext => ext !== extension) })).filter(rule => rule.extensions.length);
  return { ...config, rules: [{ extensions: [extension], action: example.action }, ...rules] };
}
