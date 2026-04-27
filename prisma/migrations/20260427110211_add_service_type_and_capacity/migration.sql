-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('SERVICE', 'TRAINING', 'WORKSHOP', 'COURSE');

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "maxCapacity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "type" "ServiceType" NOT NULL DEFAULT 'SERVICE';
