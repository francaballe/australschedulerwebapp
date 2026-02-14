/*
  Warnings:

  - You are about to drop the `user_availability` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "app"."user_availability" DROP CONSTRAINT "user_availability_user_id_fkey";

-- DropTable
DROP TABLE "app"."user_availability";

-- CreateTable
CREATE TABLE "app"."user_unavailability" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "user_unavailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_unavailability_user_id_date_key" ON "app"."user_unavailability"("user_id", "date");

-- AddForeignKey
ALTER TABLE "app"."user_unavailability" ADD CONSTRAINT "user_unavailability_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
