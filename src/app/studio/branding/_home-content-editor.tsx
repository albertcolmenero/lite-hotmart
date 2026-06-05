"use client";

import { useState, type ReactNode } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import type { JSONContent } from "@tiptap/core";
import { Video } from "./_video-node";
import { youtubeId, vimeoId } from "@/components/video-embed";
import type { HomeDoc } from "@/lib/home-content";

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

/** Seed the editor from the legacy plain-text bio so first-time editing isn't blank. */
function bioToDoc(bio: string): JSONContent {
  const blocks = bio
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length === 0) return EMPTY_DOC;
  return {
    type: "doc",
    content: blocks.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
  };
}

/**
 * Rich editor for the creator's home-page content. Lives inside the Branding
 * page's `<form action={updateBrandingAction}>`; its JSON is kept in a controlled
 * hidden input named `homeContent` so it submits with the rest of the form.
 */
export function HomeContentEditor({
  initialContent,
  fallbackBio,
}: {
  initialContent: HomeDoc | null;
  fallbackBio: string | null;
}) {
  const initialDoc: JSONContent =
    initialContent ?? (fallbackBio ? bioToDoc(fallbackBio) : EMPTY_DOC);

  const [json, setJson] = useState(() => JSON.stringify(initialDoc));
  const [showVideo, setShowVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoError, setVideoError] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false, // required for Next SSR / React 19 (avoids hydration mismatch)
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // link + underline are bundled in StarterKit v3 — configure here, don't re-import.
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
        },
        // Keep the producible content aligned with the toolbar: disable the
        // extras (no buttons, reachable only via hidden markdown shortcuts) so
        // they can't be created and then render unstyled on the storefront.
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
        code: false,
      }),
      Video,
    ],
    content: initialDoc,
    editorProps: { attributes: { class: "landing-editor" } },
    onUpdate: ({ editor }) => setJson(JSON.stringify(editor.getJSON())),
  });

  // editor is null on first render with immediatelyRender:false — still submit the
  // initial content so a save before mount is a faithful no-op.
  if (!editor) return <input type="hidden" name="homeContent" value={json} />;

  const insertVideo = () => {
    const url = videoUrl.trim();
    const provider = vimeoId(url) ? "vimeo" : youtubeId(url) ? "youtube" : null;
    if (!provider) {
      setVideoError("Enter a valid YouTube or Vimeo link.");
      return;
    }
    editor.chain().focus().insertContent({ type: "video", attrs: { provider, url } }).run();
    setVideoUrl("");
    setVideoError(null);
    setShowVideo(false);
  };

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const input = window.prompt("Link URL", prev ?? "https://");
    if (input === null) return;
    const href = input.trim();
    if (href === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const { from, to } = editor.state.selection;
    if (from === to && !editor.isActive("link")) {
      // Collapsed cursor on plain text: setMark only stores a mark for future
      // typing and inserts nothing — so drop the URL in as visible linked text.
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] })
        .run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };

  return (
    <div className="landing-editor-shell">
      <div className="landing-editor-toolbar">
        <TbBtn label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <b>B</b>
        </TbBtn>
        <TbBtn label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <i>I</i>
        </TbBtn>
        <TbBtn label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <span style={{ textDecoration: "underline" }}>U</span>
        </TbBtn>
        <span className="landing-editor-divider" />
        <TbBtn label="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </TbBtn>
        <TbBtn label="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          H3
        </TbBtn>
        <span className="landing-editor-divider" />
        <TbBtn label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          •
        </TbBtn>
        <TbBtn label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1.
        </TbBtn>
        <span className="landing-editor-divider" />
        <TbBtn label="Link" active={editor.isActive("link")} onClick={setLink}>
          Link
        </TbBtn>
        <TbBtn
          label="Embed video"
          active={showVideo}
          onClick={() => {
            setShowVideo((v) => !v);
            setVideoError(null);
          }}
        >
          Video
        </TbBtn>
      </div>

      {showVideo ? (
        <div className="landing-editor-videobox">
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                insertVideo();
              }
            }}
            placeholder="https://youtu.be/…  or  https://vimeo.com/…"
            className="input"
            autoFocus
          />
          <button type="button" className="btn btn-secondary" onClick={insertVideo}>
            Insert
          </button>
          {videoError ? <span className="landing-editor-videoerr">{videoError}</span> : null}
        </div>
      ) : null}

      <EditorContent editor={editor} />

      <input type="hidden" name="homeContent" value={json} />
    </div>
  );
}

function TbBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active || undefined}
      data-active={active || undefined}
      title={label}
      className="landing-editor-btn"
    >
      {children}
    </button>
  );
}
