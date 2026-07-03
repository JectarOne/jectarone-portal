// Minimal, XSS-safe Markdown for comments. Escape first, then apply a small,
// closed set of inline patterns. No raw HTML is ever passed through.

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Render a limited Markdown subset to safe HTML: bold, italic, code, links, @mentions, line breaks. */
export function renderMarkdown(input: string): string {
  let s = escapeHtml(input);
  // inline code `x`
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  // bold **x**
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // italic *x*
  s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  // links [text](https://url) — http/https only
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  // @mentions
  s = s.replace(/(^|\s)@([a-zA-Z0-9._-]{2,40})/g, '$1<span class="mention">@$2</span>');
  // line breaks
  s = s.replace(/\n/g, "<br />");
  return s;
}

/** Extract @mentioned usernames (for future notifications). */
export function extractMentions(input: string): string[] {
  const out: string[] = [];
  const re = /(?:^|\s)@([a-zA-Z0-9._-]{2,40})/g;
  let m;
  while ((m = re.exec(input))) out.push(m[1]);
  return Array.from(new Set(out));
}
