import { Fragment, type ReactNode } from "react";
import type { JSONContent } from "@tiptap/core";
import { VideoEmbed } from "@/components/video-embed";
import { safeHref, type HomeDoc } from "@/lib/home-content";

/**
 * Renders stored Tiptap JSON (`Creator.homeContent`) to React on the public
 * landing page. Deliberately NOT `dangerouslySetInnerHTML` / Tiptap's
 * `generateHTML`: this walks a controlled node set so output is XSS-safe (React
 * escapes text, link hrefs are scheme-validated, videos embed only on valid IDs)
 * and reuses {@link VideoEmbed}. Styling mirrors the editor via `.landing-prose`.
 */
export function HomeContent({ doc }: { doc: HomeDoc }) {
  return <div className="landing-prose">{renderChildren(doc.content)}</div>;
}

function renderChildren(nodes: JSONContent[] | undefined): ReactNode {
  if (!nodes) return null;
  return nodes.map((node, i) => renderNode(node, i));
}

function renderNode(node: JSONContent, key: number): ReactNode {
  switch (node.type) {
    case "paragraph":
      return <p key={key}>{renderChildren(node.content)}</p>;
    case "heading": {
      const Tag = node.attrs?.level === 3 ? "h3" : "h2";
      return <Tag key={key}>{renderChildren(node.content)}</Tag>;
    }
    case "bulletList":
      return <ul key={key}>{renderChildren(node.content)}</ul>;
    case "orderedList":
      return <ol key={key}>{renderChildren(node.content)}</ol>;
    case "listItem":
      return <li key={key}>{renderChildren(node.content)}</li>;
    case "blockquote":
      return <blockquote key={key}>{renderChildren(node.content)}</blockquote>;
    case "codeBlock":
      return (
        <pre key={key}>
          <code>{renderChildren(node.content)}</code>
        </pre>
      );
    case "horizontalRule":
      return <hr key={key} />;
    case "hardBreak":
      return <br key={key} />;
    case "video": {
      const provider = node.attrs?.provider === "vimeo" ? "vimeo" : "youtube";
      const url = typeof node.attrs?.url === "string" ? node.attrs.url : "";
      if (!url) return null;
      return (
        <div key={key} className="landing-prose-video">
          <VideoEmbed provider={provider} url={url} />
        </div>
      );
    }
    case "text":
      return <Fragment key={key}>{applyMarks(node.text ?? "", node.marks)}</Fragment>;
    default:
      // Unknown block node: render its children if any — never raw HTML.
      return node.content ? (
        <Fragment key={key}>{renderChildren(node.content)}</Fragment>
      ) : null;
  }
}

function applyMarks(text: string, marks: JSONContent["marks"]): ReactNode {
  if (!marks || marks.length === 0) return text;
  // Apply `link` outermost so the <a> wraps the styled text.
  const ordered = [...marks].sort(
    (a, b) => (a.type === "link" ? 1 : 0) - (b.type === "link" ? 1 : 0),
  );
  return ordered.reduce<ReactNode>((acc, mark, i) => {
    switch (mark.type) {
      case "bold":
        return <strong key={i}>{acc}</strong>;
      case "italic":
        return <em key={i}>{acc}</em>;
      case "underline":
        return <u key={i}>{acc}</u>;
      case "strike":
        return <s key={i}>{acc}</s>;
      case "code":
        return <code key={i}>{acc}</code>;
      case "link": {
        const href = safeHref(mark.attrs?.href);
        if (!href) return acc;
        return (
          <a key={i} href={href} target="_blank" rel="noopener noreferrer nofollow">
            {acc}
          </a>
        );
      }
      default:
        return acc;
    }
  }, text);
}
