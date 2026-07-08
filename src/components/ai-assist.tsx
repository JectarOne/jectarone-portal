"use client";

import { useActionState } from "react";
import { aiAssistAction, type AiState } from "@/actions/ai";
import { CAPABILITY_LABELS, type AiCapability } from "@/lib/ai/prompts";

export function AiAssist({
  findingId, assessmentId, capabilities,
}: {
  findingId?: string;
  assessmentId?: string;
  capabilities: AiCapability[];
}) {
  const [state, formAction, pending] = useActionState(aiAssistAction, {} as AiState);

  return (
    <div className="card ai-assist">
      <h3 className="sub">
        <span className="ai-badge" aria-hidden="true">AI</span> Assistant
      </h3>
      <form action={formAction}>
        {findingId && <input type="hidden" name="findingId" value={findingId} />}
        {assessmentId && <input type="hidden" name="assessmentId" value={assessmentId} />}
        <div className="ai-actions">
          {capabilities.map((c) => (
            <button key={c} className="btn btn-secondary" type="submit" name="capability" value={c} disabled={pending}>
              {CAPABILITY_LABELS[c]}
            </button>
          ))}
        </div>
      </form>

      {pending && <p className="muted" style={{ marginTop: "0.7rem" }} aria-live="polite">Generating…</p>}
      {state.error && !pending && <div className="alert alert-error" style={{ marginTop: "0.7rem" }}>{state.error}</div>}
      {state.text && !pending && (
        <div className="ai-result" aria-live="polite">
          <pre className="ai-output">{state.text}</pre>
          <p className="muted ai-disclaimer">
            AI-generated suggestion{state.provider ? ` · ${state.provider}` : ""}. Review before use — it does not replace consultant judgement.
          </p>
        </div>
      )}
    </div>
  );
}
