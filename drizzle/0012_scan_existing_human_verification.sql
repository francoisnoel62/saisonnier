-- Les annonces collectées antérieures au scan ont été saisies par le fondateur (SH8).
UPDATE offers
SET human_verified_at = coalesce(published_at, created_at)
WHERE origin = 'collected' AND human_verified_at IS NULL;
