-- [projet] Champs personnalisés pour les votants (discussion Rallly #201)
-- AlterTable
ALTER TABLE "polls" ADD COLUMN     "custom_fields" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "custom_answers" JSONB NOT NULL DEFAULT '{}';
