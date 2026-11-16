-- [projet] Mode réservation de créneaux (discussion Rallly #139)
-- AlterTable
ALTER TABLE "polls" ADD COLUMN     "booking_mode" BOOLEAN NOT NULL DEFAULT false;
