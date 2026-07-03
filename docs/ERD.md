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
    Finding ||--o{ Evidence : has
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
```

## Cascade / tenancy rules
- Every tenant table carries `organizationId`; all queries filter by it (cross-tenant access is impossible).
- **Cascade delete:** delete an Organization → its Memberships, Assessments, Findings, Evidence, ActivityLogs go. Delete an Assessment → its Findings + their Evidence go. Delete a Finding → its Evidence goes.
- **SetNull (audit preserved):** `createdBy` / `uploadedBy` on records, and `assessmentId` / `findingId` / `userId` on ActivityLog, become null instead of deleting the log — the audit trail survives.

## Risk model
`Risk = Likelihood × Impact` on a 5×5 matrix (each axis VeryLow…VeryHigh → 1…5). Score 1–25 banded: ≥20 Critical, ≥12 High, ≥6 Medium, ≥3 Low, else VeryLow.
