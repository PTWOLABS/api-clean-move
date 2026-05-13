import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  AppointmentStatus,
  Prisma,
  PrismaClient,
  ServiceCategory,
  UserRole,
} from "../../generated/prisma/client";
import { hash } from "bcrypt";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
  }),
});

type ServiceSeedData = Omit<
  Prisma.ServiceUncheckedCreateInput,
  "id" | "establishmentId" | "createdAt" | "updatedAt"
>;

type CustomerSeedData = Omit<
  Prisma.CustomerUncheckedCreateInput,
  "id" | "establishmentId" | "createdAt" | "updatedAt" | "deletedAt"
>;

type CustomerVehicleSeedData = Omit<
  Prisma.CustomerVehicleUncheckedCreateInput,
  | "id"
  | "establishmentId"
  | "customerId"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
>;

async function main() {
  await prisma.appointment.deleteMany();
  await prisma.customerVehicle.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.service.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.establishment.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.socialAccount.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await hash("123456", 1);

  const owner = await prisma.user.create({
    data: {
      name: "Felipe Pereira",
      email: "felipe@cleanmove.com.br",
      hashedPassword,
      role: UserRole.ESTABLISHMENT,
      phone: "11987654321",
      address: {
        street: "Estrada Farmacêutico Oswaldo Paiva",
        number: "3820",
        neighborhood: "Lavras de Baixo",
        city: "Socorro",
        state: "SP",
        zipCode: "13963060",
        country: "Brasil",
      },
    },
  });

  const establishment = await prisma.establishment.create({
    data: {
      ownerId: owner.id,
      profileImageUrl: "https://example.com/images/clean-move-profile.png",
      bannerImageUrl: "https://example.com/images/clean-move-banner.png",
      tradeName: "Clean Move Estética Automotiva",
      legalBusinessName: "Clean Move Serviços Automotivos LTDA",
      slug: "clean-move",
      cnpj: "61911322000187",
    },
  });

  const servicesData: ServiceSeedData[] = [
    {
      serviceName: "Lavagem Simples",
      description: "Lavagem externa com acabamento rápido.",
      category: ServiceCategory.WASH,
      estimatedDurationMinInMinutes: 30,
      estimatedDurationMaxInMinutes: 45,
      priceInCents: 5000,
      isActive: true,
    },
    {
      serviceName: "Lavagem Completa",
      description: "Lavagem externa e interna com aspiração.",
      category: ServiceCategory.WASH,
      estimatedDurationMinInMinutes: 60,
      estimatedDurationMaxInMinutes: 90,
      priceInCents: 9000,
      isActive: true,
    },
    {
      serviceName: "Higienização Interna",
      description: "Limpeza profunda dos bancos, carpete e painel.",
      category: ServiceCategory.SANITIZATION,
      estimatedDurationMinInMinutes: 180,
      estimatedDurationMaxInMinutes: 240,
      priceInCents: 28000,
      isActive: true,
    },
    {
      serviceName: "Polimento Técnico",
      description: "Correção de pintura com acabamento premium.",
      category: ServiceCategory.AUTOMATIVE_DETAILING,
      estimatedDurationMinInMinutes: 240,
      estimatedDurationMaxInMinutes: 360,
      priceInCents: 45000,
      isActive: true,
    },
    {
      serviceName: "Vitrificação de Pintura",
      description: "Proteção de pintura com aplicação de coating.",
      category: ServiceCategory.PROTECTION,
      estimatedDurationMinInMinutes: 360,
      estimatedDurationMaxInMinutes: 480,
      priceInCents: 90000,
      isActive: true,
    },
    {
      serviceName: "Impermeabilização de Bancos",
      description: null,
      category: ServiceCategory.UPHOLSTERY,
      estimatedDurationMinInMinutes: 120,
      estimatedDurationMaxInMinutes: 180,
      priceInCents: 22000,
      isActive: true,
    },
    {
      serviceName: "Cristalização de Vidros",
      description: "Aplicação de produto repelente de água nos vidros.",
      category: ServiceCategory.PROTECTION,
      estimatedDurationMinInMinutes: 45,
      estimatedDurationMaxInMinutes: 60,
      priceInCents: 12000,
      isActive: true,
    },
    {
      serviceName: "Limpeza de Motor",
      description: null,
      category: null,
      estimatedDurationMinInMinutes: 60,
      estimatedDurationMaxInMinutes: null,
      priceInCents: 15000,
      isActive: true,
    },
    {
      serviceName: "Revitalização de Faróis",
      description: "Restauração estética dos faróis amarelados.",
      category: ServiceCategory.AUTOMATIVE_DETAILING,
      estimatedDurationMinInMinutes: null,
      estimatedDurationMaxInMinutes: 90,
      priceInCents: 18000,
      isActive: true,
    },
    {
      serviceName: "Lavagem Premium",
      description: "Lavagem detalhada com finalização especial.",
      category: ServiceCategory.WASH,
      estimatedDurationMinInMinutes: 90,
      estimatedDurationMaxInMinutes: 120,
      priceInCents: 16000,
      isActive: false,
    },
  ];

  const services: Awaited<ReturnType<typeof prisma.service.create>>[] = [];

  for (const serviceData of servicesData) {
    const service = await prisma.service.create({
      data: {
        establishmentId: establishment.id,
        ...serviceData,
      },
    });

    services.push(service);
  }

  const customersData: CustomerSeedData[] = [
    {
      profileImageUrl: "https://example.com/customers/ana.png",
      cpfCnpj: "12345678901",
      fullName: "Ana Carolina Martins",
      phone: "11911112222",
      email: "ana.martins@example.com",
      address: {
        street: "Rua das Palmeiras",
        number: "120",
        neighborhood: "Centro",
        city: "Socorro",
        state: "SP",
        zipCode: "13960000",
      },
      birthDate: new Date("1994-03-12"),
      nickname: "Ana",
    },
    {
      profileImageUrl: null,
      cpfCnpj: "98765432100",
      fullName: "Bruno Henrique Souza",
      phone: "11922223333",
      email: "bruno.souza@example.com",
      address: Prisma.JsonNull,
      birthDate: null,
      nickname: null,
    },
    {
      profileImageUrl: "https://example.com/customers/carla.png",
      cpfCnpj: null,
      fullName: "Carla Fernanda Lima",
      phone: "11933334444",
      email: "carla.lima@example.com",
      address: {
        street: "Avenida Brasil",
        number: "890",
        neighborhood: "Jardim Santa Cruz",
        city: "Socorro",
        state: "SP",
        zipCode: "13960000",
      },
      birthDate: new Date("1988-11-25"),
      nickname: "Cá",
    },
    {
      profileImageUrl: null,
      cpfCnpj: "45678912345",
      fullName: "Diego Rafael Oliveira",
      phone: "11944445555",
      email: "diego.oliveira@example.com",
      address: Prisma.JsonNull,
      birthDate: new Date("1991-07-04"),
      nickname: null,
    },
    {
      profileImageUrl: "https://example.com/customers/eduarda.png",
      cpfCnpj: "32165498700",
      fullName: "Eduarda Ramos Almeida",
      phone: "11955556666",
      email: "eduarda.almeida@example.com",
      address: {
        street: "Rua São Paulo",
        number: "45",
        neighborhood: "Vila Nova",
        city: "Bragança Paulista",
        state: "SP",
        zipCode: "12900000",
      },
      birthDate: null,
      nickname: "Duda",
    },
    {
      profileImageUrl: null,
      cpfCnpj: null,
      fullName: "Fernando César Ribeiro",
      phone: "11966667777",
      email: "fernando.ribeiro@example.com",
      address: Prisma.JsonNull,
      birthDate: null,
      nickname: "Nando",
    },
    {
      profileImageUrl: "https://example.com/customers/gabriela.png",
      cpfCnpj: "14725836900",
      fullName: "Gabriela Moreira Santos",
      phone: "11977778888",
      email: "gabriela.santos@example.com",
      address: {
        street: "Rua Minas Gerais",
        number: "310",
        neighborhood: "Centro",
        city: "Socorro",
        state: "SP",
        zipCode: "13960000",
      },
      birthDate: new Date("1997-01-18"),
      nickname: "Gabi",
    },
    {
      profileImageUrl: null,
      cpfCnpj: "74185296300",
      fullName: "Henrique Augusto Melo",
      phone: "11988889999",
      email: "henrique.melo@example.com",
      address: Prisma.JsonNull,
      birthDate: new Date("1985-09-09"),
      nickname: null,
    },
    {
      profileImageUrl: "https://example.com/customers/isabela.png",
      cpfCnpj: null,
      fullName: "Isabela Cristina Torres",
      phone: "11999990000",
      email: "isabela.torres@example.com",
      address: {
        street: "Rua XV de Novembro",
        number: "155",
        neighborhood: "Centro",
        city: "Serra Negra",
        state: "SP",
        zipCode: "13930000",
      },
      birthDate: null,
      nickname: "Isa",
    },
    {
      profileImageUrl: null,
      cpfCnpj: "25836914700",
      fullName: "João Pedro Batista",
      phone: "11810101010",
      email: "joao.batista@example.com",
      address: Prisma.JsonNull,
      birthDate: new Date("1990-05-30"),
      nickname: null,
    },
  ];

  const customers: Awaited<ReturnType<typeof prisma.customer.create>>[] = [];

  for (const customerData of customersData) {
    const customer = await prisma.customer.create({
      data: {
        establishmentId: establishment.id,
        ...customerData,
      },
    });

    customers.push(customer);
  }

  const vehiclesData: CustomerVehicleSeedData[] = [
    {
      imageUrl: "https://example.com/vehicles/civic.png",
      plate: "ABC1D23",
      brand: "Honda",
      model: "Civic",
      color: "Preto",
      year: 2021,
      notes: "Cliente prefere produtos sem cheiro forte.",
    },
    {
      imageUrl: null,
      plate: "BRA2E34",
      brand: "Toyota",
      model: "Corolla",
      color: "Prata",
      year: 2020,
      notes: null,
    },
    {
      imageUrl: "https://example.com/vehicles/onix.png",
      plate: "CAR3F45",
      brand: "Chevrolet",
      model: "Onix",
      color: "Branco",
      year: 2019,
      notes: "Atenção especial nas rodas.",
    },
    {
      imageUrl: null,
      plate: null,
      brand: "Volkswagen",
      model: "Polo",
      color: "Cinza",
      year: 2022,
      notes: null,
    },
    {
      imageUrl: "https://example.com/vehicles/hb20.png",
      plate: "DRY4G56",
      brand: "Hyundai",
      model: "HB20",
      color: "Vermelho",
      year: 2023,
      notes: "Possui película nos vidros.",
    },
    {
      imageUrl: null,
      plate: "ECO5H67",
      brand: "Fiat",
      model: "Pulse",
      color: null,
      year: 2022,
      notes: null,
    },
    {
      imageUrl: "https://example.com/vehicles/compass.png",
      plate: "FAST678",
      brand: "Jeep",
      model: "Compass",
      color: "Azul",
      year: 2021,
      notes: "Cliente solicita cuidado extra no couro.",
    },
    {
      imageUrl: null,
      plate: "GOL7I89",
      brand: "Volkswagen",
      model: "Gol",
      color: "Branco",
      year: null,
      notes: null,
    },
    {
      imageUrl: "https://example.com/vehicles/tcross.png",
      plate: "HOT8J90",
      brand: "Volkswagen",
      model: "T-Cross",
      color: "Preto",
      year: 2024,
      notes: null,
    },
    {
      imageUrl: null,
      plate: "ION9K01",
      brand: "Nissan",
      model: "Kicks",
      color: "Cinza",
      year: 2020,
      notes: "Veículo costuma chegar com cadeirinha infantil.",
    },
  ];

  const vehicles: Awaited<ReturnType<typeof prisma.customerVehicle.create>>[] =
    [];

  for (let index = 0; index < customers.length; index++) {
    const customer = customers[index];
    const vehicleData = vehiclesData[index];

    if (!customer || !vehicleData) {
      throw new Error(`Missing seed data for vehicle at index ${index}`);
    }

    const vehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id,
        customerId: customer.id,
        ...vehicleData,
      },
    });

    vehicles.push(vehicle);
  }

  const appointmentDates: Date[] = [
    new Date("2026-05-14T09:00:00-03:00"),
    new Date("2026-05-15T10:30:00-03:00"),
    new Date("2026-05-16T14:00:00-03:00"),
    new Date("2026-05-18T08:30:00-03:00"),
    new Date("2026-05-19T13:00:00-03:00"),
    new Date("2026-05-20T16:00:00-03:00"),
    new Date("2026-05-22T11:00:00-03:00"),
    new Date("2026-05-25T15:30:00-03:00"),
    new Date("2026-05-27T09:30:00-03:00"),
    new Date("2026-05-30T10:00:00-03:00"),
  ];

  for (let index = 0; index < 10; index++) {
    const customer = customers[index];
    const service = services[index];
    const startsAt = appointmentDates[index];

    if (!customer || !service || !startsAt) {
      throw new Error(`Missing seed data for appointment at index ${index}`);
    }

    const vehicle = index % 4 === 0 ? null : vehicles[index];

    const durationInMinutes =
      service.estimatedDurationMaxInMinutes ??
      service.estimatedDurationMinInMinutes ??
      60;

    const endsAt = new Date(startsAt.getTime() + durationInMinutes * 60 * 1000);

    const status =
      index === 2 || index === 6
        ? AppointmentStatus.DONE
        : index === 4 || index === 8
          ? AppointmentStatus.CANCELLED
          : AppointmentStatus.SCHEDULED;

    await prisma.appointment.create({
      data: {
        establishmentId: establishment.id,
        customerId: customer.id,
        vehicleId: vehicle?.id ?? null,
        bookedServiceId: service.id,
        bookedServiceName: service.serviceName,
        bookedServiceCategory: service.category,
        bookedServiceDurationInMinutes: durationInMinutes,
        bookedServicePriceInCents: service.priceInCents,
        vehiclePlate: vehicle?.plate ?? null,
        vehicleBrand: vehicle?.brand ?? null,
        vehicleModel: vehicle?.model ?? null,
        vehicleColor: vehicle?.color ?? null,
        vehicleYear: vehicle?.year ?? null,
        startsAt,
        endsAt,
        description:
          index % 3 === 0
            ? "Cliente pediu atenção especial aos detalhes externos."
            : null,
        discountInCents: index % 2 === 0 ? 1000 : null,
        status,
        doneAt: status === AppointmentStatus.DONE ? endsAt : null,
        cancelledAt:
          status === AppointmentStatus.CANCELLED
            ? new Date(startsAt.getTime() - 24 * 60 * 60 * 1000)
            : null,
      },
    });
  }

  console.log("Database seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("Database seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
