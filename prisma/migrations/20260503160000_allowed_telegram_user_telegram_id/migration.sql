-- AlterTable
ALTER TABLE "AllowedTelegramUser" ADD COLUMN "telegramId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AllowedTelegramUser_telegramId_key" ON "AllowedTelegramUser"("telegramId");
