import { addDays } from "date-fns";
import { PrismaClient } from "@prisma/client";
import { getWeekStart } from "../src/lib/utils";
import { createHash, randomBytes } from "crypto";
import { UserRole } from "../src/lib/enums";

const prisma = new PrismaClient();
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const generateRawToken = () => randomBytes(32).toString("hex");

async function main() {
  await prisma.chatMessage.deleteMany();
  await prisma.shiftReport.deleteMany();
  await prisma.shiftTimeLog.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.zoneLimit.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.accessToken.deleteMany();
  await prisma.user.deleteMany();

  const usersData = [
    ["Суперадмин", UserRole.SUPER_ADMIN],
    ["Админ", UserRole.ADMIN],
    ["Коля", UserRole.EMPLOYEE],
    ["Дима", UserRole.EMPLOYEE],
    ["Андрей", UserRole.EMPLOYEE],
    ["Ваня П", UserRole.EMPLOYEE],
    ["Макар", UserRole.EMPLOYEE],
    ["Даниил", UserRole.EMPLOYEE]
  ] as const;
  const users = [];
  for (const [name, role] of usersData) {
    users.push(
      await prisma.user.create({
        data: {
          name,
          role,
          color: "#1f8f5f",
          payoutDebtCents: role === UserRole.EMPLOYEE ? 150000 + Math.floor(Math.random() * 450000) : 0
        }
      })
    );
  }
  const zones = await Promise.all([
    prisma.zone.create({ data: { name: "Термопресс", sortOrder: 1 } }),
    prisma.zone.create({ data: { name: "Плоттер и ДТФ", sortOrder: 2 } }),
    prisma.zone.create({ data: { name: "Вырезальщик", sortOrder: 3 } }),
    prisma.zone.create({ data: { name: "ЧПУ", sortOrder: 4 } })
  ]);
  await prisma.zoneLimit.createMany({
    data: [
      { zoneId: zones[0].id, dayOfWeek: null, startTime: "10:00", endTime: "18:00", maxEmployees: 4 },
      { zoneId: zones[1].id, dayOfWeek: null, startTime: "10:00", endTime: "18:00", maxEmployees: 2 },
      { zoneId: zones[2].id, dayOfWeek: null, startTime: "10:00", endTime: "18:00", maxEmployees: 2 },
      { zoneId: zones[3].id, dayOfWeek: null, startTime: "10:00", endTime: "18:00", maxEmployees: 2 }
    ]
  });
  const weekStartDate = getWeekStart();
  await prisma.scheduleWeek.create({ data: { weekStartDate } });
  const employees = users.filter((u) => u.role === UserRole.EMPLOYEE);
  for (let i = 0; i < employees.length; i++) {
    await prisma.shift.create({
      data: {
        userId: employees[i].id,
        zoneId: zones[i % zones.length].id,
        weekStartDate,
        dayOfWeek: (i % 5) + 1,
        startTime: "10:00",
        endTime: "18:00"
      }
    });
  }

  await prisma.systemSettings.createMany({
    data: [
      { key: "schedule.slotStart", value: "10:00" },
      { key: "schedule.slotEnd", value: "02:00" },
      { key: "schedule.slotStepMinutes", value: "60" }
    ]
  });

  const superAdmin = users.find((u) => u.role === UserRole.SUPER_ADMIN)!;
  const rawToken = generateRawToken();
  await prisma.accessToken.create({
    data: {
      userId: superAdmin.id,
      tokenHash: hashToken(rawToken)
    }
  });
  console.log(`Ссылка входа суперадмина: ${(process.env.APP_URL ?? "http://localhost:3000")}/login/token/${rawToken}`);
  console.log(`Текущая неделя начинается: ${weekStartDate.toISOString().slice(0, 10)}; проверка даты+7: ${addDays(weekStartDate, 7).toISOString().slice(0, 10)}`);
}

main().finally(async () => {
  await prisma.$disconnect();
});
