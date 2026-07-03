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
      <button className="btn btn-secondary" type="submit" disabled={pending}>{pending ? "Posting…" : "Comment"}</button>
    </form>
  );
}
