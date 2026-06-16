-- AlterTable: phone/password auth + approval status
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED';

-- All existing active users are pre-approved
UPDATE "User" SET "approvalStatus" = 'APPROVED' WHERE "isActive" = 1;

-- Unique phone (SQLite: nullable unique allows multiple NULLs)
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PushSubscription_userId_endpoint_key" ON "PushSubscription"("userId", "endpoint");
