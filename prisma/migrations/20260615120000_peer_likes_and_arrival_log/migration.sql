-- CreateTable
CREATE TABLE "WorkplaceArrivalLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "arrivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkplaceArrivalLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShiftPeerLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftReportId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShiftPeerLike_shiftReportId_fkey" FOREIGN KEY ("shiftReportId") REFERENCES "ShiftReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShiftPeerLike_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShiftPeerLike_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WorkplaceArrivalLog_userId_arrivedAt_idx" ON "WorkplaceArrivalLog"("userId", "arrivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftPeerLike_shiftReportId_key" ON "ShiftPeerLike"("shiftReportId");

-- CreateIndex
CREATE INDEX "ShiftPeerLike_toUserId_createdAt_idx" ON "ShiftPeerLike"("toUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ShiftPeerLike_createdAt_idx" ON "ShiftPeerLike"("createdAt");
