import Link from "next/link";
import { getSession } from "@/lib/auth";
import { createAssessmentAction } from "@/actions/assessments";
import { AssessmentForm } from "../AssessmentForm";

export default async function NewAssessmentPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <>
      <div className="topbar">
        <div>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            <Link href="/dashboard/assessments">Assessments</Link> / New
          </p>
          <h1>New assessment</h1>
        </div>
      </div>

      <AssessmentForm
        action={createAssessmentAction}
        submitLabel="Create assessment"
        cancelHref="/dashboard/assessments"
      />
    </>
  );
}
