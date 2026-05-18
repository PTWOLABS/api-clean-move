import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcrypt";

import {
  AppointmentStatus,
  Prisma,
  PrismaClient,
  ServiceCategory,
  UserRole,
} from "../../generated/prisma/client";

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

type EmployeeSeedData = {
  name: string;
  email: string;
  phone: string;
  cpf: string | null;
  birthDate: Date | null;
  profileImageUrl: string | null;
  features: string[];
};

const DEFAULT_PASSWORD = "123456";
const REFERENCE_DATE = new Date();
const ESTABLISHMENT_SLUG = "clean-move";
const OWNER_EMAIL = "felipe@cleanmove.com.br";
const TIME_SLOTS = [
  { hour: 8, minute: 0 },
  { hour: 9, minute: 30 },
  { hour: 11, minute: 0 },
  { hour: 13, minute: 30 },
  { hour: 15, minute: 0 },
  { hour: 16, minute: 30 },
  { hour: 18, minute: 0 },
] as const;

const SERVICE_CATALOG: ServiceSeedData[] = [
  {
    serviceName: "Lavagem Express",
    description:
      "Lavagem externa com secagem rápida para rotinas do dia a dia.",
    category: ServiceCategory.WASH,
    estimatedDurationMinInMinutes: 25,
    estimatedDurationMaxInMinutes: 35,
    priceInCents: 4500,
    isActive: true,
  },
  {
    serviceName: "Lavagem Completa",
    description: "Lavagem externa e interna com aspiração e acabamento.",
    category: ServiceCategory.WASH,
    estimatedDurationMinInMinutes: 60,
    estimatedDurationMaxInMinutes: 90,
    priceInCents: 9500,
    isActive: true,
  },
  {
    serviceName: "Lavagem Premium com Cera",
    description: "Lavagem detalhada com aplicação de cera líquida.",
    category: ServiceCategory.WASH,
    estimatedDurationMinInMinutes: 90,
    estimatedDurationMaxInMinutes: 120,
    priceInCents: 16000,
    isActive: true,
  },
  {
    serviceName: "Lavagem de Motor",
    description: "Limpeza técnica do cofre do motor com proteção básica.",
    category: ServiceCategory.WASH,
    estimatedDurationMinInMinutes: 45,
    estimatedDurationMaxInMinutes: 60,
    priceInCents: 14000,
    isActive: true,
  },
  {
    serviceName: "Higienização Interna",
    description: "Limpeza profunda de bancos, carpetes e painel.",
    category: ServiceCategory.SANITIZATION,
    estimatedDurationMinInMinutes: 180,
    estimatedDurationMaxInMinutes: 240,
    priceInCents: 28000,
    isActive: true,
  },
  {
    serviceName: "Higienização de Ar-Condicionado",
    description: "Sanitização do sistema de ar-condicionado automotivo.",
    category: ServiceCategory.SANITIZATION,
    estimatedDurationMinInMinutes: 45,
    estimatedDurationMaxInMinutes: 60,
    priceInCents: 12000,
    isActive: true,
  },
  {
    serviceName: "Remoção de Odores",
    description: "Tratamento interno para redução de odores persistentes.",
    category: ServiceCategory.SANITIZATION,
    estimatedDurationMinInMinutes: 60,
    estimatedDurationMaxInMinutes: 90,
    priceInCents: 15000,
    isActive: true,
  },
  {
    serviceName: "Polimento Técnico",
    description: "Correção de pintura com foco em brilho e remoção de marcas.",
    category: ServiceCategory.AUTOMATIVE_DETAILING,
    estimatedDurationMinInMinutes: 240,
    estimatedDurationMaxInMinutes: 360,
    priceInCents: 45000,
    isActive: true,
  },
  {
    serviceName: "Polimento Comercial",
    description: "Polimento de uma etapa para renovação visual da pintura.",
    category: ServiceCategory.AUTOMATIVE_DETAILING,
    estimatedDurationMinInMinutes: 180,
    estimatedDurationMaxInMinutes: 240,
    priceInCents: 32000,
    isActive: true,
  },
  {
    serviceName: "Revitalização de Faróis",
    description: "Restauração estética de faróis opacos ou amarelados.",
    category: ServiceCategory.AUTOMATIVE_DETAILING,
    estimatedDurationMinInMinutes: 60,
    estimatedDurationMaxInMinutes: 90,
    priceInCents: 18000,
    isActive: true,
  },
  {
    serviceName: "Detailing de Motor",
    description: null,
    category: ServiceCategory.AUTOMATIVE_DETAILING,
    estimatedDurationMinInMinutes: 90,
    estimatedDurationMaxInMinutes: 120,
    priceInCents: 22000,
    isActive: true,
  },
  {
    serviceName: "Vitrificação de Pintura",
    description: "Aplicação de coating cerâmico com alta durabilidade.",
    category: ServiceCategory.PROTECTION,
    estimatedDurationMinInMinutes: 360,
    estimatedDurationMaxInMinutes: 480,
    priceInCents: 92000,
    isActive: true,
  },
  {
    serviceName: "Cristalização de Vidros",
    description: "Aplicação de repelente de água nos vidros.",
    category: ServiceCategory.PROTECTION,
    estimatedDurationMinInMinutes: 45,
    estimatedDurationMaxInMinutes: 60,
    priceInCents: 12000,
    isActive: true,
  },
  {
    serviceName: "Proteção de Plásticos",
    description: "Revitalização e proteção de plásticos externos.",
    category: ServiceCategory.PROTECTION,
    estimatedDurationMinInMinutes: 60,
    estimatedDurationMaxInMinutes: 90,
    priceInCents: 17000,
    isActive: true,
  },
  {
    serviceName: "PPF Parcial",
    description: "Proteção parcial de áreas críticas com película.",
    category: ServiceCategory.PROTECTION,
    estimatedDurationMinInMinutes: 300,
    estimatedDurationMaxInMinutes: 420,
    priceInCents: 125000,
    isActive: false,
  },
  {
    serviceName: "Impermeabilização de Bancos",
    description: "Proteção têxtil para bancos e áreas internas.",
    category: ServiceCategory.UPHOLSTERY,
    estimatedDurationMinInMinutes: 120,
    estimatedDurationMaxInMinutes: 180,
    priceInCents: 22000,
    isActive: true,
  },
  {
    serviceName: "Hidratação de Couro",
    description: "Tratamento e hidratação de bancos e detalhes em couro.",
    category: ServiceCategory.UPHOLSTERY,
    estimatedDurationMinInMinutes: 90,
    estimatedDurationMaxInMinutes: 120,
    priceInCents: 21000,
    isActive: true,
  },
  {
    serviceName: "Limpeza de Teto",
    description: "Limpeza e recuperação de teto automotivo.",
    category: ServiceCategory.UPHOLSTERY,
    estimatedDurationMinInMinutes: 90,
    estimatedDurationMaxInMinutes: 120,
    priceInCents: 19000,
    isActive: true,
  },
  {
    serviceName: "Consultoria de Detailing",
    description: "Serviço interno para análise de estado e orçamento.",
    category: null,
    estimatedDurationMinInMinutes: 30,
    estimatedDurationMaxInMinutes: 45,
    priceInCents: 5000,
    isActive: true,
  },
  {
    serviceName: "Lavagem Premium Legado",
    description: "Serviço antigo mantido apenas para histórico.",
    category: ServiceCategory.WASH,
    estimatedDurationMinInMinutes: 90,
    estimatedDurationMaxInMinutes: 120,
    priceInCents: 18000,
    isActive: false,
  },
];

const EMPLOYEE_SEED_DATA: EmployeeSeedData[] = [
  {
    name: "Ana Paula Costa",
    email: "ana.costa@cleanmove.com.br",
    phone: "11910000001",
    cpf: "10000000001",
    birthDate: new Date("1993-02-14T00:00:00.000Z"),
    profileImageUrl: "https://example.com/employees/ana-costa.png",
    features: [
      "create:appointments",
      "update:appointments",
      "update:customers",
    ],
  },
  {
    name: "Bruno Tavares",
    email: "bruno.tavares@cleanmove.com.br",
    phone: "11910000002",
    cpf: "10000000002",
    birthDate: new Date("1989-08-09T00:00:00.000Z"),
    profileImageUrl: null,
    features: ["create:customers", "update:customers", "create:appointments"],
  },
  {
    name: "Carla Mendes",
    email: "carla.mendes@cleanmove.com.br",
    phone: "11910000003",
    cpf: null,
    birthDate: new Date("1996-11-21T00:00:00.000Z"),
    profileImageUrl: "https://example.com/employees/carla-mendes.png",
    features: ["create:services", "update:services", "update:appointments"],
  },
  {
    name: "Diego Amaral",
    email: "diego.amaral@cleanmove.com.br",
    phone: "11910000004",
    cpf: "10000000004",
    birthDate: null,
    profileImageUrl: null,
    features: [
      "delete:appointments",
      "update:appointments",
      "update:employees:self",
    ],
  },
  {
    name: "Eduarda Ribeiro",
    email: "eduarda.ribeiro@cleanmove.com.br",
    phone: "11910000005",
    cpf: "10000000005",
    birthDate: new Date("1991-05-17T00:00:00.000Z"),
    profileImageUrl: "https://example.com/employees/eduarda-ribeiro.png",
    features: [
      "create:appointments",
      "create:customers",
      "update:customers",
      "update:appointments",
      "create:services",
    ],
  },
];

const CUSTOMER_IDENTITIES = [
  { fullName: "Ana Carolina Martins", nickname: "Ana" },
  { fullName: "Bruno Henrique Souza", nickname: null },
  { fullName: "Carla Fernanda Lima", nickname: "Cá" },
  { fullName: "Diego Rafael Oliveira", nickname: null },
  { fullName: "Eduarda Ramos Almeida", nickname: "Duda" },
  { fullName: "Fernando Cesar Ribeiro", nickname: "Nando" },
  { fullName: "Gabriela Moreira Santos", nickname: "Gabi" },
  { fullName: "Henrique Augusto Melo", nickname: null },
  { fullName: "Isabela Cristina Torres", nickname: "Isa" },
  { fullName: "Joao Pedro Batista", nickname: null },
  { fullName: "Juliana Pires Rocha", nickname: "Ju" },
  { fullName: "Kaique Vinicius Prado", nickname: null },
  { fullName: "Larissa Campos Nogueira", nickname: "Lari" },
  { fullName: "Marcelo Teixeira Lopes", nickname: null },
  { fullName: "Natalia Faria Gomes", nickname: "Nati" },
  { fullName: "Otavio Sampaio Cunha", nickname: null },
  { fullName: "Patricia Neves Moura", nickname: "Paty" },
  { fullName: "Rafael Augusto Moretti", nickname: "Rafa" },
  { fullName: "Sabrina Dias Leal", nickname: null },
  { fullName: "Tiago Vitor Cardoso", nickname: null },
  { fullName: "Vanessa Prado Simões", nickname: "Vane" },
  { fullName: "William Fonseca Silva", nickname: null },
  { fullName: "Yasmin Couto Ferreira", nickname: "Yaya" },
  { fullName: "Alexandre Braga Rezende", nickname: "Xande" },
  { fullName: "Beatriz Moura Freitas", nickname: "Bia" },
  { fullName: "Caio Luiz Arruda", nickname: null },
  { fullName: "Debora Martins Araujo", nickname: "Deb" },
  { fullName: "Erica Soares Nunes", nickname: null },
  { fullName: "Fabricio Azevedo Pinto", nickname: "Fabi" },
  { fullName: "Giovana Castro Peixoto", nickname: "Gi" },
  { fullName: "Heitor Domingues Reis", nickname: null },
  { fullName: "Irene Barros Chaves", nickname: null },
  { fullName: "Leandro Cavalcante Rosa", nickname: "Leo" },
  { fullName: "Mariana Duarte Assis", nickname: "Mari" },
  { fullName: "Paulo Sergio Mattos", nickname: null },
  { fullName: "Renata Vidal Correa", nickname: "Rê" },
] as const;

const VEHICLE_FLEET = [
  { brand: "Honda", model: "Civic", color: "Preto" },
  { brand: "Toyota", model: "Corolla", color: "Prata" },
  { brand: "Chevrolet", model: "Onix", color: "Branco" },
  { brand: "Volkswagen", model: "Polo", color: "Cinza" },
  { brand: "Hyundai", model: "HB20", color: "Vermelho" },
  { brand: "Fiat", model: "Pulse", color: "Azul" },
  { brand: "Jeep", model: "Compass", color: "Preto" },
  { brand: "Volkswagen", model: "T-Cross", color: "Branco" },
  { brand: "Nissan", model: "Kicks", color: "Cinza" },
  { brand: "BMW", model: "320i", color: "Azul" },
  { brand: "Audi", model: "A3", color: "Preto" },
  { brand: "Mercedes-Benz", model: "GLA 200", color: "Prata" },
  { brand: "Renault", model: "Duster", color: "Marrom" },
  { brand: "Peugeot", model: "208", color: "Cinza" },
  { brand: "Kia", model: "Sportage", color: "Branco" },
  { brand: "Mitsubishi", model: "L200", color: "Prata" },
  { brand: "Ford", model: "Ranger", color: "Vermelho" },
  { brand: "Volvo", model: "XC40", color: "Preto" },
] as const;

const SERVICE_SELECTION_SEQUENCE = [
  0, 1, 0, 4, 7, 1, 2, 12, 0, 10, 8, 5, 0, 15, 2, 11, 0, 1, 6, 13, 0, 9, 4, 16,
  1, 0, 3, 7, 17, 0, 2, 12, 1, 0, 18, 5, 8, 0, 14, 4, 19, 0, 1, 11, 2,
] as const;

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

  const hashedPassword = await hash(DEFAULT_PASSWORD, 1);

  const owner = await prisma.user.create({
    data: {
      name: "Felipe Pereira",
      email: OWNER_EMAIL,
      hashedPassword,
      role: UserRole.ESTABLISHMENT,
      phone: "11987654321",
      address: {
        street: "Estrada Farmaceutico Oswaldo Paiva",
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
      tradeName: "Clean Move Estetica Automotiva",
      legalBusinessName: "Clean Move Servicos Automotivos LTDA",
      slug: ESTABLISHMENT_SLUG,
      cnpj: "61911322000187",
    },
  });

  const employees = await seedEmployees({
    establishmentId: establishment.id,
    hashedPassword,
  });
  const services = await seedServices(establishment.id);
  const customers = await seedCustomers(establishment.id);
  const vehicles = await seedVehicles(establishment.id, customers);
  const appointmentsCreated = await seedAppointments({
    establishmentId: establishment.id,
    customers,
    vehicles,
    services,
  });

  console.log("Database seed completed successfully.");
  console.log(
    [
      `owner=${owner.email}`,
      `employees=${employees.length}`,
      `services=${services.length}`,
      `customers=${customers.length}`,
      `vehicles=${vehicles.length}`,
      `appointments=${appointmentsCreated}`,
    ].join(" | "),
  );
}

async function seedEmployees({
  establishmentId,
  hashedPassword,
}: {
  establishmentId: string;
  hashedPassword: string;
}) {
  const employees: Awaited<ReturnType<typeof prisma.employee.create>>[] = [];

  for (const employeeData of EMPLOYEE_SEED_DATA) {
    const user = await prisma.user.create({
      data: {
        name: employeeData.name,
        email: employeeData.email,
        hashedPassword,
        role: UserRole.EMPLOYEE,
        phone: employeeData.phone,
        address: Prisma.JsonNull,
      },
    });

    const employee = await prisma.employee.create({
      data: {
        establishmentId,
        userId: user.id,
        profileImageUrl: employeeData.profileImageUrl,
        name: employeeData.name,
        cpf: employeeData.cpf,
        birthDate: employeeData.birthDate,
        features: employeeData.features,
      },
    });

    employees.push(employee);
  }

  return employees;
}

async function seedServices(establishmentId: string) {
  const services: Awaited<ReturnType<typeof prisma.service.create>>[] = [];

  for (const serviceData of SERVICE_CATALOG) {
    const service = await prisma.service.create({
      data: {
        establishmentId,
        ...serviceData,
      },
    });

    services.push(service);
  }

  return services;
}

async function seedCustomers(establishmentId: string) {
  const customers: Awaited<ReturnType<typeof prisma.customer.create>>[] = [];

  for (const [index, identity] of CUSTOMER_IDENTITIES.entries()) {
    const customerData: CustomerSeedData = {
      profileImageUrl:
        index % 3 === 0
          ? `https://example.com/customers/customer-${index + 1}.png`
          : null,
      cpfCnpj: index % 4 === 0 ? null : buildCpf(index + 1),
      fullName: identity.fullName,
      phone: buildPhone(index + 1),
      email: buildCustomerEmail(identity.fullName, index),
      address:
        index % 5 === 0
          ? Prisma.JsonNull
          : {
              street: `Rua ${["das Flores", "dos Ipes", "Amapa", "Bahia", "Minas Gerais"][index % 5]}`,
              number: String(120 + index * 7),
              neighborhood: [
                "Centro",
                "Jardim America",
                "Vila Nova",
                "Parque das Aguas",
                "Residencial Serra",
              ][index % 5],
              city: ["Socorro", "Braganca Paulista", "Serra Negra"][index % 3],
              state: "SP",
              zipCode: `1396${String(index).padStart(4, "0")}`,
            },
      birthDate:
        index % 6 === 0
          ? null
          : new Date(
              Date.UTC(1982 + (index % 18), index % 12, 3 + (index % 24)),
            ),
      nickname: identity.nickname,
    };

    const customer = await prisma.customer.create({
      data: {
        establishmentId,
        ...customerData,
      },
    });

    customers.push(customer);
  }

  return customers;
}

async function seedVehicles(
  establishmentId: string,
  customers: Awaited<ReturnType<typeof prisma.customer.create>>[],
) {
  const vehicles: Awaited<ReturnType<typeof prisma.customerVehicle.create>>[] =
    [];

  for (const [index, customer] of customers.entries()) {
    const baseVehicle = VEHICLE_FLEET[index % VEHICLE_FLEET.length]!;
    const vehicleData: CustomerVehicleSeedData = {
      imageUrl:
        index % 4 === 0
          ? `https://example.com/vehicles/vehicle-${index + 1}.png`
          : null,
      plate: index % 7 === 0 ? null : buildPlate(index),
      brand: baseVehicle.brand,
      model: baseVehicle.model,
      color: index % 6 === 0 ? null : baseVehicle.color,
      year: index % 5 === 0 ? null : 2014 + (index % 11),
      notes:
        index % 3 === 0
          ? "Cliente costuma pedir atencao extra nos detalhes internos."
          : index % 4 === 0
            ? "Verificar rodas, retrovisores e acabamento final."
            : null,
    };

    const vehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId,
        customerId: customer.id,
        ...vehicleData,
      },
    });

    vehicles.push(vehicle);
  }

  return vehicles;
}

async function seedAppointments({
  establishmentId,
  customers,
  vehicles,
  services,
}: {
  establishmentId: string;
  customers: Awaited<ReturnType<typeof prisma.customer.create>>[];
  vehicles: Awaited<ReturnType<typeof prisma.customerVehicle.create>>[];
  services: Awaited<ReturnType<typeof prisma.service.create>>[];
}) {
  let createdAppointments = 0;
  let appointmentIndex = 0;

  for (let dayOffset = -210; dayOffset <= 21; dayOffset += 1) {
    const appointmentsForDay = resolveAppointmentsForDay(dayOffset);

    for (let slotIndex = 0; slotIndex < appointmentsForDay; slotIndex += 1) {
      const customerIndex =
        (appointmentIndex * 7 + slotIndex * 3) % customers.length;
      const customer = customers[customerIndex]!;
      const vehicle = vehicles[customerIndex]!;
      const service =
        services[
          SERVICE_SELECTION_SEQUENCE[
            appointmentIndex % SERVICE_SELECTION_SEQUENCE.length
          ]!
        ]!;
      const timeSlot =
        TIME_SLOTS[(appointmentIndex + slotIndex) % TIME_SLOTS.length]!;
      const startsAt = setTime(addDays(REFERENCE_DATE, dayOffset), timeSlot);
      const durationInMinutes =
        service.estimatedDurationMaxInMinutes ??
        service.estimatedDurationMinInMinutes ??
        60;
      const endsAt = addMinutes(startsAt, durationInMinutes);
      const status = resolveAppointmentStatus(dayOffset, appointmentIndex);
      const discountInCents = resolveDiscountInCents(
        service.priceInCents,
        appointmentIndex,
      );

      await prisma.appointment.create({
        data: {
          establishmentId,
          customerId: customer.id,
          vehicleId: appointmentIndex % 6 === 0 ? null : vehicle.id,
          bookedServiceId: service.id,
          bookedServiceName: service.serviceName,
          bookedServiceCategory: service.category,
          bookedServiceDurationInMinutes: durationInMinutes,
          bookedServicePriceInCents: service.priceInCents,
          vehiclePlate: appointmentIndex % 6 === 0 ? null : vehicle.plate,
          vehicleBrand: appointmentIndex % 6 === 0 ? null : vehicle.brand,
          vehicleModel: appointmentIndex % 6 === 0 ? null : vehicle.model,
          vehicleColor: appointmentIndex % 6 === 0 ? null : vehicle.color,
          vehicleYear: appointmentIndex % 6 === 0 ? null : vehicle.year,
          startsAt,
          endsAt,
          description: resolveAppointmentDescription(
            appointmentIndex,
            service.serviceName,
          ),
          discountInCents,
          status,
          doneAt: status === AppointmentStatus.DONE ? endsAt : null,
          cancelledAt:
            status === AppointmentStatus.CANCELLED
              ? addHours(startsAt, -12 - (appointmentIndex % 10))
              : null,
        },
      });

      appointmentIndex += 1;
      createdAppointments += 1;
    }
  }

  return createdAppointments;
}

function resolveAppointmentsForDay(dayOffset: number) {
  if (dayOffset > 14) {
    return dayOffset % 4 === 0 ? 1 : 0;
  }

  if (dayOffset >= 0) {
    return 1 + (Math.abs(dayOffset) % 3);
  }

  const normalizedOffset = Math.abs(dayOffset);
  let appointmentsForDay = normalizedOffset % 6 === 0 ? 0 : 1;

  if (normalizedOffset % 4 === 0) {
    appointmentsForDay += 1;
  }

  if (normalizedOffset % 9 === 0) {
    appointmentsForDay += 1;
  }

  if (normalizedOffset % 17 === 0) {
    appointmentsForDay += 1;
  }

  return appointmentsForDay;
}

function resolveAppointmentStatus(
  dayOffset: number,
  appointmentIndex: number,
): AppointmentStatus {
  if (dayOffset >= 2) {
    return AppointmentStatus.SCHEDULED;
  }

  if (dayOffset >= 0) {
    return appointmentIndex % 8 === 0
      ? AppointmentStatus.CANCELLED
      : AppointmentStatus.SCHEDULED;
  }

  if (appointmentIndex % 7 === 0 || appointmentIndex % 19 === 0) {
    return AppointmentStatus.CANCELLED;
  }

  return AppointmentStatus.DONE;
}

function resolveDiscountInCents(
  priceInCents: number,
  appointmentIndex: number,
) {
  if (appointmentIndex % 5 !== 0) {
    return null;
  }

  const discountOptions = [500, 1000, 1500, 2000, 3500, 5000];
  const suggestedDiscount =
    discountOptions[appointmentIndex % discountOptions.length] ?? 500;

  return Math.min(suggestedDiscount, Math.floor(priceInCents * 0.25));
}

function resolveAppointmentDescription(
  appointmentIndex: number,
  serviceName: string,
) {
  if (appointmentIndex % 6 === 0) {
    return `Cliente solicitou prioridade para o servico ${serviceName}.`;
  }

  if (appointmentIndex % 10 === 0) {
    return "Registrar fotos de antes e depois para acompanhamento do cliente.";
  }

  if (appointmentIndex % 13 === 0) {
    return "Conferir manchas antigas no banco traseiro antes de iniciar.";
  }

  return null;
}

function buildCustomerEmail(fullName: string, index: number) {
  return `${slugify(fullName)}.${index + 1}@example.com`;
}

function buildPhone(sequence: number) {
  return `119${String(10000000 + sequence).slice(-8)}`;
}

function buildCpf(sequence: number) {
  return String(10000000000 + sequence).slice(-11);
}

function buildPlate(index: number) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const first = letters[index % letters.length]!;
  const second = letters[(index + 5) % letters.length]!;
  const third = letters[(index + 11) % letters.length]!;

  return `${first}${second}${third}${index % 10}${letters[(index + 3) % letters.length]}${(index + 1) % 10}${(index + 2) % 10}`;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date.getTime());
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function addHours(date: Date, hours: number) {
  const nextDate = new Date(date.getTime());
  nextDate.setHours(nextDate.getHours() + hours);
  return nextDate;
}

function addMinutes(date: Date, minutes: number) {
  const nextDate = new Date(date.getTime());
  nextDate.setMinutes(nextDate.getMinutes() + minutes);
  return nextDate;
}

function setTime(
  date: Date,
  timeSlot: {
    hour: number;
    minute: number;
  },
) {
  const nextDate = new Date(date.getTime());
  nextDate.setHours(timeSlot.hour, timeSlot.minute, 0, 0);
  return nextDate;
}

main()
  .catch((error) => {
    console.error("Database seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
