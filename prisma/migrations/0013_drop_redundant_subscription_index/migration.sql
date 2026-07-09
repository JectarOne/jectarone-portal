-- Sprint 19 audit: Subscription.organizationId already has a unique index
-- ("Subscription_organizationId_key"), so the additional non-unique index was
-- pure write overhead. Safe to drop online; reads fall back to the unique index.
DROP INDEX "Subscription_organizationId_idx";
