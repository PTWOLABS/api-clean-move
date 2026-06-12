import { PrismaService } from "../../src/infra/database/prisma/prisma.service";

export async function seedServiceCategory(
  prisma: PrismaService,
  establishmentId: string,
  name: string,
) {
  const existing = await prisma.serviceCategory.findFirst({
    where: {
      establishmentId,
      name,
      deletedAt: null,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.serviceCategory.create({
    data: {
      establishmentId,
      name,
    },
  });
}
