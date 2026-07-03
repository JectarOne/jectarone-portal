"use client";

import { useState, useActionState } from "react";
import type { CommentState } from "@/actions/comments";
import { deleteCommentAction } from "@/actions/comments";

export function CommentItem({
  id, authorName, when, edited, html, raw, canModify, editAction,
}: {
  id: string;
  authorName: string;
  when: string;
  edited: boolean;
  html: string;
  raw: string;
  canModify: boolean;
  editAction: (prev: CommentState, formData: FormData) => Promise<CommentState>;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(editAction, {} as CommentState);

  return (
    <div className="comment">
      <div className="comment-head">
        <strong>{authorName}</strong>
        <span className="comment-meta">{when}{edited ? " · edited" : ""}</span>
        {canModify && !editing && (
          <span className="comment-actions">
            <button type="button" className="linkbtn" onClick={() => setEditing(true)}>Edit</button>
            <form action={deleteCommentAction} style={{ display: "inline" }}>
              <input type="hidden" name="id" value={id} />
              <button type="submit" className="linkbtn danger">Delete</button>
            </form>
          </span>
        )}
      </div>
      {editing ? (
        <form action={formAction} className="comment-form">
          {state.error && <div className="alert alert-error">{state.error}</div>}
          <textarea name="body" rows={3} defaultValue={raw} required />
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button className="btn btn-secondary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
            <button className="btn btn-secondary" type="button" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="comment-body" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </div>
  );
}
