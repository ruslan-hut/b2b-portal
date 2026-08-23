/**
 * Client-side mirror of `backend/internal/lib/htmlsafe`.
 *
 * The backend sanitises every block on save and remains the authority — this
 * exists because the rich-text editor pastes foreign markup straight into a
 * contenteditable surface, and Word's `<span style="mso-…">` soup or a marketing
 * page's `<script>` would otherwise sit in the editor looking like content until
 * the save silently ate it. Cleaning at the paste keeps what the editor sees and
 * what the server stores the same thing.
 *
 * **The allowlist below must stay in step with `htmlsafe.allowedTags`.** A tag
 * the editor strips but the server accepts is a paste that loses formatting for
 * no visible reason; the reverse is markup that survives the editor and vanishes
 * on save.
 */

/** Tags kept as themselves. Anything else is unwrapped — its text survives. */
const ALLOWED_TAGS = new Set([
  'p', 'div', 'br', 'hr', 'pre', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'span', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ins',
  'sub', 'sup', 'small', 'code', 'abbr',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'a', 'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col'
]);

/**
 * Tags dropped with their contents.
 *
 * Without this, `<script>alert(1)</script>` survives as the literal text
 * "alert(1)" mid-paragraph: harmless, but it reads as a broken sanitiser and an
 * editor will paste it back in trying to fix it.
 */
const STRIP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'form', 'noscript', 'template'
]);

/** Attributes kept, per tag. No class, id or style — the hub styles its own. */
const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ['href', 'target', 'title'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  abbr: ['title'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan']
};

/** Schemes a link or image may point at. Rejects javascript: and data:. */
const SAFE_SCHEMES = ['http:', 'https:', 'mailto:'];

function isSafeUrl(value: string): boolean {
  const url = value.trim();
  if (!url) {
    return false;
  }
  // Relative targets (/partners/legal, #section) carry no scheme and are fine.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return SAFE_SCHEMES.some(scheme => url.toLowerCase().startsWith(scheme));
  }
  return true;
}

function cleanElement(el: Element): void {
  const tag = el.tagName.toLowerCase();
  const allowed = ALLOWED_ATTRS[tag] || [];

  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (!allowed.includes(name)) {
      el.removeAttribute(attr.name);
      continue;
    }
    if ((name === 'href' || name === 'src') && !isSafeUrl(attr.value)) {
      el.removeAttribute(attr.name);
    }
  }

  if (tag === 'a' && el.getAttribute('target') === '_blank') {
    // Matches the server's RequireNoReferrerOnFullyQualifiedLinks.
    el.setAttribute('rel', 'noreferrer');
  }
}

function walk(node: Node): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.COMMENT_NODE) {
      child.remove();
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }

    const el = child as Element;
    const tag = el.tagName.toLowerCase();

    if (STRIP_WITH_CONTENT.has(tag)) {
      el.remove();
      continue;
    }

    walk(el);

    if (!ALLOWED_TAGS.has(tag)) {
      // Unwrap: the tag goes, its text stays, which is what bluemonday does.
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }

    cleanElement(el);
  }
}

/**
 * sanitizeHtml strips everything outside the allowlist from a fragment.
 *
 * Empty input stays empty rather than becoming an empty document: a block with
 * no text must not gain markup by passing through here.
 */
export function sanitizeHtml(html: string): string {
  if (!html || !html.trim()) {
    return '';
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  walk(doc.body);
  return doc.body.innerHTML;
}

/**
 * isBlankHtml reports whether a fragment renders as nothing.
 *
 * A contenteditable surface an editor emptied still holds `<br>` or
 * `<p><br></p>`; storing that would make a block count as translated in the
 * language rail while showing an empty page.
 */
export function isBlankHtml(html: string): boolean {
  if (!html || !html.trim()) {
    return true;
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (doc.body.querySelector('img, hr, table')) {
    return false;
  }
  return !(doc.body.textContent || '').replace(/\u00a0/g, ' ').trim();
}
