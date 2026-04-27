/*
  Warnings:

  - The primary key for the `EmployeeService` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[telegramId,botId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `botId` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Made the column `clientUserId` on table `Appointment` required. This step will fail if there are existing NULL values in that column.
  - Made the column `employeeId` on table `Appointment` required. This step will fail if there are existing NULL values in that column.
  - Made the column `clientContact` on table `Appointment` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `botId` to the `Employee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `botId` to the `EmployeeService` table without a default value. This is not possible if the table is not empty.
  - Added the required column `botId` to the `ScheduleException` table without a default value. This is not possible if the table is not empty.
  - Added the required column `botId` to the `Service` table without a default value. This is not possible if the table is not empty.
  - Added the required column `botId` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `botId` to the `WorkSchedule` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_clientUserId_fkey";

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "EmployeeService" DROP CONSTRAINT "EmployeeService_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "EmployeeService" DROP CONSTRAINT "EmployeeService_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "ScheduleException" DROP CONSTRAINT "ScheduleException_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "WorkSchedule" DROP CONSTRAINT "WorkSchedule_employeeId_fkey";

-- DropIndex
DROP INDEX "User_telegramId_key";

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "botId" INTEGER NOT NULL,
ALTER COLUMN "clientUserId" SET NOT NULL,
ALTER COLUMN "employeeId" SET NOT NULL,
ALTER COLUMN "clientContact" SET NOT NULL;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "botId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "EmployeeService" DROP CONSTRAINT "EmployeeService_pkey",
ADD COLUMN     "botId" INTEGER NOT NULL,
ADD CONSTRAINT "EmployeeService_pkey" PRIMARY KEY ("employeeId", "serviceId", "botId");

-- AlterTable
ALTER TABLE "ScheduleException" ADD COLUMN     "botId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "botId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "botId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "WorkSchedule" ADD COLUMN     "botId" INTEGER NOT NULL,
ADD COLUMN     "breakEnd" TEXT,
ADD COLUMN     "breakStart" TEXT;

-- CreateTable
CREATE TABLE "Bot" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "ownerId" BIGINT NOT NULL,
    "aboutText" TEXT DEFAULT 'Информация о нас пока не заполнена.',

    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bot_token_key" ON "Bot"("token");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_botId_key" ON "User"("telegramId", "botId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeService" ADD CONSTRAINT "EmployeeService_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeService" ADD CONSTRAINT "EmployeeService_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeService" ADD CONSTRAINT "EmployeeService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clientUserId_fkey" FOREIGN KEY ("clientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
