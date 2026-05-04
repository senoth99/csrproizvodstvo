-- Детализация начисления по отчёту: за выход + за работа = итого в accrualAmountCents.
ALTER TABLE "ShiftReport" ADD COLUMN "accrualAppearanceCents" INTEGER;
ALTER TABLE "ShiftReport" ADD COLUMN "accrualWorkCents" INTEGER;
