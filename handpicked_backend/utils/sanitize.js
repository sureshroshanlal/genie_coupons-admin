import createDOMPurify from "isomorphic-dompurify";
import { JSDOM } from "jsdom";

// Single JSDOM window shared
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

// Allow a safe subset; extend if needed
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
  "h2",
  "h3",
  "h4",
  "code",
  "pre",
  "img",
  "figure",
  "figcaption",
  "span",
];
const ALLOWED_ATTR = [
  "href",
  "title",
  "target",
  "rel",
  "src",
  "alt",
  "class",
  "aria-label",
];

export function sanitize(html) {
  if (!html) return "";
  return DOMPurify.sanitize(String(html), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ADD_ATTR: ["loading"], // for images
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
    FORBID_ATTR: ["onerror", "onclick", "onload"],
  });
}
