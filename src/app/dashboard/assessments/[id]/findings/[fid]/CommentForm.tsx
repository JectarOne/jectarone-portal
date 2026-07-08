"use client";

import { useActionState, useRef, useEffect } from "react";
import type { CommentState } from "@/actions/comments";

export function CommentForm({
  action,
}: {
  action: (prev: CommentState, formData: FormData) => Promise<CommentState>;
}) {
  const [state, formAction, pending] = useActionState(action, {} as CommentState);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) ref.current?.reset();
  }, [pending, state]);

  return (
    <form ref={ref} action={formAction} className="comment-form">
      {state.error && <div className="alert alert-error">{state.error}</div>}
      <textarea name="body" rows={3} placeholder="Add a comment… Markdown and @mentions supported." required />
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <label htmlFor="comment-visibility" className="muted" style={{ fontSize: "0.82rem" }}>Visibility</label>
        <select id="comment-visibility" name="visibility" defaultValue="internal" aria-label="Comment visibility">
          <option value="internal">Internal (team only)</option>
          <option value="client">Client-visible</option>
        </select>
        <button className="btn btn-secondary" type="submit" disabled={pending}>{pending ? "Posting…" : "Comment"}</button>
      </div>
    </form>
  );
}
