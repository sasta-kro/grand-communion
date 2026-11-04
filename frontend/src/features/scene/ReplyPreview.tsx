import { CornerUpLeft } from "lucide-react";
import { tr } from "../../i18n";
import type { ReplyExcerpt } from "../../lib/types";

export function ReplyPreview({
  messageId,
  source,
  onOpen,
}: {
  messageId: number;
  source?: ReplyExcerpt | null;
  onOpen: () => void;
}) {
  return (
    <button
      className="reply-preview"
      onClick={onOpen}
      aria-label={
        source
          ? tr("chat.openOriginalMessage", { name: source.name, id: messageId })
          : tr("chat.openMessage", { id: messageId })
      }
    >
      <CornerUpLeft size={14} aria-hidden="true" />
      <span className="reply-preview-content">
        <span className="reply-preview-heading">
          <strong>{source?.name || tr("chat.originalMessage")}</strong>
          <span>#{messageId}</span>
        </span>
        <span className="reply-preview-text">
          {source
            ? source.text + (source.truncated ? "…" : "")
            : tr("chat.originalMessageNotLoaded")}
        </span>
      </span>
    </button>
  );
}
