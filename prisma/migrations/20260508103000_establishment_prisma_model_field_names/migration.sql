ALTER TABLE "establishments"
RENAME COLUMN "corporate_name" TO "tradeName";

ALTER TABLE "establishments"
RENAME COLUMN "social_reason" TO "legalBusinessName";

ALTER TABLE "establishments"
DROP COLUMN "operating_hours";
