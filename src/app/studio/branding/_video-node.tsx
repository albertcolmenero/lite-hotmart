"use client";

import { Node, mergeAttributes, type NodeViewProps } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { VideoEmbed } from "@/components/video-embed";

/**
 * Custom Tiptap node for an embedded YouTube/Vimeo video. An atom block (no
 * editable inner content) carrying `{ provider, url }`. Persists via
 * `getJSON().attrs`; `parseHTML`/`renderHTML` only matter for copy-paste. The
 * public landing page renders these attrs with the same {@link VideoEmbed}.
 */
export const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      provider: { default: "youtube" },
      url: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-video]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-video": "",
        "data-provider": HTMLAttributes.provider ?? "youtube",
        "data-url": HTMLAttributes.url ?? "",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoNodeView);
  },
});

function VideoNodeView({ node, selected, deleteNode }: NodeViewProps) {
  const provider = node.attrs.provider === "vimeo" ? "vimeo" : "youtube";
  const url = typeof node.attrs.url === "string" ? node.attrs.url : "";
  return (
    <NodeViewWrapper
      className="landing-editor-video"
      data-selected={selected || undefined}
      contentEditable={false}
    >
      {/* pointer-events off so a click selects the node instead of the iframe */}
      <div style={{ pointerEvents: "none" }}>
        <VideoEmbed provider={provider} url={url} />
      </div>
      <button
        type="button"
        onClick={deleteNode}
        className="landing-editor-video-remove"
        aria-label="Remove video"
      >
        ×
      </button>
    </NodeViewWrapper>
  );
}
