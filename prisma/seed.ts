import { PrismaClient, Role, ReportStatus } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@tupi.gov.ph";
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD must be set before seeding.");
  }

  const admin = await prisma.user.upsert({
    where: { email },
    create: {
      name: process.env.ADMIN_NAME ?? "ServeLink Administrator",
      email,
      passwordHash: await hash(password, 12),
      role: Role.ADMIN,
      adminProfile: {
        create: {
          officeName: "Municipality of Tupi",
          contact: process.env.ADMIN_PHONE ?? "",
          address: "Tupi, South Cotabato",
        },
      },
    },
    update: {
      name: process.env.ADMIN_NAME ?? "ServeLink Administrator",
      passwordHash: await hash(password, 12),
      role: Role.ADMIN,
      adminProfile: {
        upsert: {
          create: {
            officeName: "Municipality of Tupi",
            contact: process.env.ADMIN_PHONE ?? "",
            address: "Tupi, South Cotabato",
          },
          update: {
            contact: process.env.ADMIN_PHONE ?? "",
          },
        },
      },
    },
  });

  const officialsEmail = process.env.OFFICIALS_EMAIL?.trim().toLowerCase();
  const officialsPassword = process.env.OFFICIALS_PASSWORD;
  if (officialsEmail) {
    if (officialsEmail === email.trim().toLowerCase()) {
      throw new Error("OFFICIALS_EMAIL must be different from ADMIN_EMAIL.");
    }
    if (!officialsPassword) {
      throw new Error("OFFICIALS_PASSWORD must be set when OFFICIALS_EMAIL is configured.");
    }
    await prisma.user.upsert({
      where: { email: officialsEmail },
      create: {
        name: process.env.OFFICIALS_NAME ?? "ServeLink Officials",
        email: officialsEmail,
        passwordHash: await hash(officialsPassword, 12),
        role: Role.OFFICIALS,
      },
      update: {
        name: process.env.OFFICIALS_NAME ?? "ServeLink Officials",
        passwordHash: await hash(officialsPassword, 12),
        role: Role.OFFICIALS,
      },
    });
  }

  if (process.env.NODE_ENV !== "production") {
    const resident = await prisma.user.upsert({
    where: { email: "resident@example.com" },
    update: {},
    create: {
      name: "Juan Dela Cruz",
      email: "resident@example.com",
      passwordHash: await hash("Resident123!", 12),
      residentProfile: {
        create: {
          phone: "+63 917 123 4567",
          barangay: "Poblacion",
          address: "Poblacion, Tupi, South Cotabato",
        },
      },
    },
    });

    if ((await prisma.news.count()) === 0) {
      await prisma.news.create({
        data: {
          caption: "Welcome to ServeLink. Follow this page for the latest municipal updates, services, and community announcements.",
          authorId: admin.id,
        },
      });
    }

    if ((await prisma.report.count()) === 0) {
      await prisma.report.create({
        data: {
          title: "Sample road maintenance request",
          description: "This sample report demonstrates how community concerns appear on the Tupi map.",
          lat: 6.3333,
          lng: 124.95,
          address: "Poblacion, Tupi, South Cotabato",
          barangay: "Poblacion",
          status: ReportStatus.PENDING,
          residentId: resident.id,
        },
      });
    }
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error("Database seed failed:", error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
