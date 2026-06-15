-- CreateTable
CREATE TABLE "ZoneChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "zoneId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ZoneChecklistItem_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShiftReportChecklistAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftReportId" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ShiftReportChecklistAnswer_shiftReportId_fkey" FOREIGN KEY ("shiftReportId") REFERENCES "ShiftReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShiftReportChecklistAnswer_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ZoneChecklistItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ZoneChecklistItem_zoneId_sortOrder_idx" ON "ZoneChecklistItem"("zoneId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftReportChecklistAnswer_shiftReportId_checklistItemId_key" ON "ShiftReportChecklistAnswer"("shiftReportId", "checklistItemId");
