/**
 * The JSON value in a model's reply. Models asked for "JSON only" still sometimes wrap it
 * in a code fence or add a sentence around it; take the fenced block, else the whole text,
 * else the first balanced object or array. Undefined when there's no JSON to be found.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const body = fenced ? fenced[1]!.trim() : trimmed;
  try {
    return JSON.parse(body);
  } catch {
    const span = firstBalanced(body);
    if (!span) return undefined;
    try {
      return JSON.parse(span);
    } catch {
      return undefined;
    }
  }
}

/** The first {...} or [...] whose brackets balance, skipping brackets inside strings. */
function firstBalanced(text: string): string | null {
  const start = text.search(/[[{]/);
  if (start < 0) return null;
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") {
      if (stack.pop() !== ch) return null;
      if (stack.length === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
