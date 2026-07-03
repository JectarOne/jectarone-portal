# JectarOne Portal — Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ Membership : has
    Organization ||--o{ Membership : has
    Organization ||--o{ Assessment : owns
    Organization ||--o{ Finding : owns
    Organization ||--o{ Evidence : owns
    Organization ||--o{ ActivityLog : owns
    Assessment ||--o{ Finding : contains
    Assessment ||--o{ Report : "generation log"
    Finding ||--o{ Evidence : has
    Organization ||--o{ Asset : owns
    Asset ||--o{ Finding : "linked (optional, SetNull)"
    Organization ||--o{ Report : owns
    User ||--o{ Assessment : "created (SetNull)"
    User ||--o{ Finding : "created (SetNull)"
    User ||--o{ Evidence : "uploaded (SetNull)"
    Assessment ||--o{ ActivityLog : "logged (SetNull)"
    Finding ||--o{ ActivityLog : "logged (SetNull)"
    User ||--o{ ActivityLog : "acted (SetNull)"

    User {
      string id PK
      string email UK
      string name
      string passwordHash
    }
    Organization {
      string id PK
      string name
      string slug UK
    }
    Membership {
      string id PK
      string role
      string userId FK
      string organizationId FK
    }
    Assessment {
      string id PK
      string organizationId FK
      string clientName
      string type
      string status
      datetime archivedAt
    }
    Finding {
      string id PK
      string organizationId FK
      string assessmentId FK
      string title
      string severity
      string likelihood
      string impact
      float cvssScore
      string status
      datetime archivedAt
    }
    Evidence {
      string id PK
      string organizationId FK
      string findingId FK
      string filename
      string mimeType
      int sizeBytes
    }
    ActivityLog {
      string id PK
      string organizationId FK
      string action
      string assessmentId FK
      string findingId FK
      string userId FK
    }
    Asset {
      string id PK
      string organizationId FK
      string name
      string type
      string identifier
      datetime archivedAt
    }
    Report {
      string id PK
      string organizationId FK
      string assessmentId FK
      string title
      int findingCount
      string format
    }
```

## Cascade / tenancy rules
- Every tenant table carries `organizationId`; all queries filter by it (cross-tenant access is impossible).
- **Cascade delete:** delete an Organization → its Memberships, Assessments, Findings, Evidence, ActivityLogs go. Delete an Assessment → its Findings + their Evidence go. Delete a Finding → its Evidence goes.
- **SetNull (audit preserved):** `createdBy` / `uploadedBy` on records, and `assessmentId` / `findingId` / `userId` on ActivityLog, become null instead of deleting the log — the audit trail survives.

## Risk model
`Risk = Likelihood × Impact` on a 5×5 matrix (each axis VeryLow…VeryHigh → 1…5). Score 1–25 banded: ≥20 Critical, ≥12 High, ≥6 Medium, ≥3 Low, else VeryLow.

## PDF reports (Sprint 4)
`Report` rows are an **audit log only** — the PDF itself is never stored as a blob. Each
download (`GET /dashboard/assessments/[id]/report`) re-queries current, non-archived
findings and renders fresh via `@react-pdf/renderer`, so the export can never drift from
what's actually in the database. `Asset` is additive: `Finding.assetId` is nullable and
`SetNull` on delete, so removing an asset never deletes or corrupts its findings.
