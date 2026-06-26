import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcrypt";

import {
  AppointmentStatus,
  Prisma,
  PrismaClient,
  QuoteDiscountType,
  QuotePaymentMethod,
  UserRole,
} from "../../generated/prisma/client";
import { DEFAULT_SERVICE_CATEGORY_NAMES } from "../../modules/catalog/domain/constants/default-service-categories";
import { EmployeeFeaturesPolicy } from "../../modules/employees/domain/policies/employee-features-policy";

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
  "id" | "establishmentId" | "createdAt" | "updatedAt" | "categoryId"
> & {
  categoryName: string | null;
};

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

type SeededService = Awaited<ReturnType<typeof prisma.service.create>>;

const DEFAULT_PASSWORD = "123456";
const REFERENCE_DATE = new Date();
const ESTABLISHMENT_SLUG = "clean-move";
const OWNER_EMAIL = "felipe@cleanmove.com.br";
const MULTI_VEHICLE_MIN_COUNT = 5;
const MULTI_VEHICLE_MAX_COUNT = 10;
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
    categoryName: "Lavagem",
    estimatedDurationMinInMinutes: 25,
    estimatedDurationMaxInMinutes: 35,
    priceInCents: 4500,
    isActive: true,
  },
  {
    serviceName: "Lavagem Completa",
    description: "Lavagem externa e interna com aspiração e acabamento.",
    categoryName: "Lavagem",
    estimatedDurationMinInMinutes: 60,
    estimatedDurationMaxInMinutes: 90,
    priceInCents: 9500,
    isActive: true,
  },
  {
    serviceName: "Lavagem Premium com Cera",
    description: "Lavagem detalhada com aplicação de cera líquida.",
    categoryName: "Lavagem",
    estimatedDurationMinInMinutes: 90,
    estimatedDurationMaxInMinutes: 120,
    priceInCents: 16000,
    isActive: true,
  },
  {
    serviceName: "Lavagem de Motor",
    description: "Limpeza técnica do cofre do motor com proteção básica.",
    categoryName: "Lavagem",
    estimatedDurationMinInMinutes: 45,
    estimatedDurationMaxInMinutes: 60,
    priceInCents: 14000,
    isActive: true,
  },
  {
    serviceName: "Higienização Interna",
    description: "Limpeza profunda de bancos, carpetes e painel.",
    categoryName: "Higienização",
    estimatedDurationMinInMinutes: 180,
    estimatedDurationMaxInMinutes: 240,
    priceInCents: 28000,
    isActive: true,
  },
  {
    serviceName: "Higienização de Ar-Condicionado",
    description: "Sanitização do sistema de ar-condicionado automotivo.",
    categoryName: "Higienização",
    estimatedDurationMinInMinutes: 45,
    estimatedDurationMaxInMinutes: 60,
    priceInCents: 12000,
    isActive: true,
  },
  {
    serviceName: "Remoção de Odores",
    description: "Tratamento interno para redução de odores persistentes.",
    categoryName: "Higienização",
    estimatedDurationMinInMinutes: 60,
    estimatedDurationMaxInMinutes: 90,
    priceInCents: 15000,
    isActive: true,
  },
  {
    serviceName: "Polimento Técnico",
    description: "Correção de pintura com foco em brilho e remoção de marcas.",
    categoryName: "Detailing Automotivo",
    estimatedDurationMinInMinutes: 240,
    estimatedDurationMaxInMinutes: 360,
    priceInCents: 45000,
    isActive: true,
  },
  {
    serviceName: "Polimento Comercial",
    description: "Polimento de uma etapa para renovação visual da pintura.",
    categoryName: "Detailing Automotivo",
    estimatedDurationMinInMinutes: 180,
    estimatedDurationMaxInMinutes: 240,
    priceInCents: 32000,
    isActive: true,
  },
  {
    serviceName: "Revitalização de Faróis",
    description: "Restauração estética de faróis opacos ou amarelados.",
    categoryName: "Detailing Automotivo",
    estimatedDurationMinInMinutes: 60,
    estimatedDurationMaxInMinutes: 90,
    priceInCents: 18000,
    isActive: true,
  },
  {
    serviceName: "Detailing de Motor",
    description: null,
    categoryName: "Detailing Automotivo",
    estimatedDurationMinInMinutes: 90,
    estimatedDurationMaxInMinutes: 120,
    priceInCents: 22000,
    isActive: true,
  },
  {
    serviceName: "Vitrificação de Pintura",
    description: "Aplicação de coating cerâmico com alta durabilidade.",
    categoryName: "Proteção",
    estimatedDurationMinInMinutes: 360,
    estimatedDurationMaxInMinutes: 480,
    priceInCents: 92000,
    isActive: true,
  },
  {
    serviceName: "Cristalização de Vidros",
    description: "Aplicação de repelente de água nos vidros.",
    categoryName: "Proteção",
    estimatedDurationMinInMinutes: 45,
    estimatedDurationMaxInMinutes: 60,
    priceInCents: 12000,
    isActive: true,
  },
  {
    serviceName: "Proteção de Plásticos",
    description: "Revitalização e proteção de plásticos externos.",
    categoryName: "Proteção",
    estimatedDurationMinInMinutes: 60,
    estimatedDurationMaxInMinutes: 90,
    priceInCents: 17000,
    isActive: true,
  },
  {
    serviceName: "PPF Parcial",
    description: "Proteção parcial de áreas críticas com película.",
    categoryName: "Proteção",
    estimatedDurationMinInMinutes: 300,
    estimatedDurationMaxInMinutes: 420,
    priceInCents: 125000,
    isActive: false,
  },
  {
    serviceName: "Impermeabilização de Bancos",
    description: "Proteção têxtil para bancos e áreas internas.",
    categoryName: "Estofamento",
    estimatedDurationMinInMinutes: 120,
    estimatedDurationMaxInMinutes: 180,
    priceInCents: 22000,
    isActive: true,
  },
  {
    serviceName: "Hidratação de Couro",
    description: "Tratamento e hidratação de bancos e detalhes em couro.",
    categoryName: "Estofamento",
    estimatedDurationMinInMinutes: 90,
    estimatedDurationMaxInMinutes: 120,
    priceInCents: 21000,
    isActive: true,
  },
  {
    serviceName: "Limpeza de Teto",
    description: "Limpeza e recuperação de teto automotivo.",
    categoryName: "Estofamento",
    estimatedDurationMinInMinutes: 90,
    estimatedDurationMaxInMinutes: 120,
    priceInCents: 19000,
    isActive: true,
  },
  {
    serviceName: "Consultoria de Detailing",
    description: "Serviço interno para análise de estado e orçamento.",
    categoryName: null,
    estimatedDurationMinInMinutes: 30,
    estimatedDurationMaxInMinutes: 45,
    priceInCents: 5000,
    isActive: true,
  },
  {
    serviceName: "Lavagem Premium Legado",
    description: "Serviço antigo mantido apenas para histórico.",
    categoryName: "Lavagem",
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
      "create:quotes",
    ],
  },
  {
    name: "Bruno Tavares",
    email: "bruno.tavares@cleanmove.com.br",
    phone: "11910000002",
    cpf: "10000000002",
    birthDate: new Date("1989-08-09T00:00:00.000Z"),
    profileImageUrl: null,
    features: [
      "create:customers",
      "update:customers",
      "create:appointments",
      "create:quotes",
    ],
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
      "create:quotes",
      "approve:quotes",
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
  await prisma.quotePaymentOption.deleteMany();
  await prisma.quoteService.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.customerVehicle.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.service.deleteMany();
  await prisma.serviceCategory.deleteMany();
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

  await prisma.user.update({
    where: { id: owner.id },
    data: {
      profileImageUrl: "https://example.com/images/clean-move-profile.png",
    },
  });

  const establishment = await prisma.establishment.create({
    data: {
      ownerId: owner.id,
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
  const categoryNameById = await seedServiceCategories(establishment.id);
  const services = await seedServices(establishment.id, categoryNameById);
  const customers = await seedCustomers(establishment.id);
  const { vehicles, vehiclesByCustomerId } = await seedVehicles(
    establishment.id,
    customers,
  );
  const { appointments, count: appointmentsCreated } = await seedAppointments({
    establishmentId: establishment.id,
    customers,
    vehiclesByCustomerId,
    services,
    categoryNameById,
  });
  const quotesCreated = await seedQuotes({
    establishment,
    customers,
    vehiclesByCustomerId,
    services,
    categoryNameById,
    appointments,
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
      `quotes=${quotesCreated}`,
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
        profileImageUrl: employeeData.profileImageUrl,
      },
    });

    const employee = await prisma.employee.create({
      data: {
        establishmentId,
        userId: user.id,
        name: employeeData.name,
        cpf: employeeData.cpf,
        birthDate: employeeData.birthDate,
        features: EmployeeFeaturesPolicy.build(employeeData.features),
      },
    });

    employees.push(employee);
  }

  return employees;
}

async function seedServiceCategories(establishmentId: string) {
  const categoryNameById = new Map<string, string>();

  for (const name of DEFAULT_SERVICE_CATEGORY_NAMES) {
    const category = await prisma.serviceCategory.create({
      data: {
        establishmentId,
        name,
      },
    });

    categoryNameById.set(category.id, category.name);
  }

  return categoryNameById;
}

async function seedServices(
  establishmentId: string,
  categoryNameById: Map<string, string>,
) {
  const categoryIdByName = new Map(
    [...categoryNameById.entries()].map(([id, name]) => [name, id]),
  );
  const services: SeededService[] = [];

  for (const { categoryName, ...serviceData } of SERVICE_CATALOG) {
    const service = await prisma.service.create({
      data: {
        establishmentId,
        ...serviceData,
        categoryId: categoryName
          ? (categoryIdByName.get(categoryName) ?? null)
          : null,
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
              country: "Brasil",
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

type SeededCustomerVehicle = Awaited<
  ReturnType<typeof prisma.customerVehicle.create>
>;
type SeededAppointment = Awaited<ReturnType<typeof prisma.appointment.create>>;

function resolveVehicleCountForCustomer(
  customerIndex: number,
  totalCustomers: number,
) {
  const multiVehicleCustomerCount = Math.floor(totalCustomers / 2) + 1;

  if (customerIndex < multiVehicleCustomerCount) {
    const vehicleRange = MULTI_VEHICLE_MAX_COUNT - MULTI_VEHICLE_MIN_COUNT + 1;

    return MULTI_VEHICLE_MIN_COUNT + (customerIndex % vehicleRange);
  }

  return 1 + (customerIndex % 3);
}

function buildVehicleSeedData(
  customerIndex: number,
  vehicleIndex: number,
  plateSequence: number,
): CustomerVehicleSeedData {
  const fleetIndex = (customerIndex * 3 + vehicleIndex) % VEHICLE_FLEET.length;
  const baseVehicle = VEHICLE_FLEET[fleetIndex]!;
  const globalVehicleIndex = plateSequence;

  return {
    imageUrl:
      globalVehicleIndex % 4 === 0
        ? `https://example.com/vehicles/vehicle-${globalVehicleIndex + 1}.png`
        : null,
    plate:
      globalVehicleIndex % 11 === 0 ? null : buildPlate(globalVehicleIndex),
    brand: baseVehicle.brand,
    model:
      vehicleIndex === 0
        ? baseVehicle.model
        : `${baseVehicle.model} ${vehicleIndex + 1}`,
    color: globalVehicleIndex % 6 === 0 ? null : baseVehicle.color,
    year:
      globalVehicleIndex % 5 === 0 ? null : 2014 + (globalVehicleIndex % 11),
    notes:
      vehicleIndex % 3 === 0
        ? "Cliente costuma pedir atencao extra nos detalhes internos."
        : vehicleIndex % 4 === 0
          ? "Verificar rodas, retrovisores e acabamento final."
          : null,
  };
}

async function seedVehicles(
  establishmentId: string,
  customers: Awaited<ReturnType<typeof prisma.customer.create>>[],
) {
  const vehicles: SeededCustomerVehicle[] = [];
  const vehiclesByCustomerId = new Map<string, SeededCustomerVehicle[]>();
  let plateSequence = 0;

  for (const [customerIndex, customer] of customers.entries()) {
    const vehicleCount = resolveVehicleCountForCustomer(
      customerIndex,
      customers.length,
    );
    const customerVehicles: SeededCustomerVehicle[] = [];

    for (let vehicleIndex = 0; vehicleIndex < vehicleCount; vehicleIndex += 1) {
      const vehicle = await prisma.customerVehicle.create({
        data: {
          establishmentId,
          customerId: customer.id,
          ...buildVehicleSeedData(customerIndex, vehicleIndex, plateSequence),
        },
      });

      plateSequence += 1;

      customerVehicles.push(vehicle);
      vehicles.push(vehicle);
    }

    vehiclesByCustomerId.set(customer.id, customerVehicles);
  }

  return { vehicles, vehiclesByCustomerId };
}

async function seedAppointments({
  establishmentId,
  customers,
  vehiclesByCustomerId,
  services,
  categoryNameById,
}: {
  establishmentId: string;
  customers: Awaited<ReturnType<typeof prisma.customer.create>>[];
  vehiclesByCustomerId: Map<string, SeededCustomerVehicle[]>;
  services: SeededService[];
  categoryNameById: Map<string, string>;
}) {
  let createdAppointments = 0;
  let appointmentIndex = 0;
  const appointments: SeededAppointment[] = [];

  for (let dayOffset = -210; dayOffset <= 21; dayOffset += 1) {
    const appointmentsForDay = resolveAppointmentsForDay(dayOffset);

    for (let slotIndex = 0; slotIndex < appointmentsForDay; slotIndex += 1) {
      const customerIndex =
        (appointmentIndex * 7 + slotIndex * 3) % customers.length;
      const customer = customers[customerIndex]!;
      const customerVehicles = vehiclesByCustomerId.get(customer.id);

      if (!customerVehicles?.length) {
        throw new Error(
          `Customer ${customer.id} has no seeded vehicles for appointments.`,
        );
      }

      const vehicle =
        customerVehicles[
          (appointmentIndex + slotIndex) % customerVehicles.length
        ]!;
      const bookedServices = selectAppointmentServices(
        services,
        appointmentIndex,
      );
      const timeSlot =
        TIME_SLOTS[(appointmentIndex + slotIndex) % TIME_SLOTS.length]!;
      const startsAt = setTime(addDays(REFERENCE_DATE, dayOffset), timeSlot);
      const durationInMinutes = bookedServices.reduce(
        (total, service) => total + resolveServiceDurationForSchedule(service),
        0,
      );
      const totalPriceInCents = bookedServices.reduce(
        (total, service) => total + service.priceInCents,
        0,
      );
      const endsAt = addMinutes(startsAt, durationInMinutes);
      const status = resolveAppointmentStatus(dayOffset, appointmentIndex);
      const discountInCents = resolveDiscountInCents(
        totalPriceInCents,
        appointmentIndex,
      );

      const appointment = await prisma.appointment.create({
        data: {
          establishmentId,
          customerId: customer.id,
          customerFullName: customer.fullName,
          vehicleId: appointmentIndex % 6 === 0 ? null : vehicle.id,
          bookedServices: {
            create: bookedServices.map((service, position) => ({
              serviceId: service.id,
              serviceName: service.serviceName,
              serviceCategoryId: service.categoryId,
              serviceCategoryName: service.categoryId
                ? (categoryNameById.get(service.categoryId) ?? null)
                : null,
              serviceDurationInMinutes:
                resolveBookedServiceDurationInMinutes(service),
              servicePriceInCents: service.priceInCents,
              servicePriceDefaultInCents: service.priceInCents,
              servicePriceSpecificationType: service.priceSpecificationType,
              servicePriceRangeMaxInCents: service.priceRangeMaxInCents,
              serviceIsActive: service.isActive,
              position,
            })),
          },
          vehiclePlate: appointmentIndex % 6 === 0 ? null : vehicle.plate,
          vehicleBrand: appointmentIndex % 6 === 0 ? null : vehicle.brand,
          vehicleModel: appointmentIndex % 6 === 0 ? null : vehicle.model,
          vehicleColor: appointmentIndex % 6 === 0 ? null : vehicle.color,
          vehicleYear: appointmentIndex % 6 === 0 ? null : vehicle.year,
          startsAt,
          endsAt,
          description: resolveAppointmentDescription(
            appointmentIndex,
            formatAppointmentServiceNames(bookedServices),
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

      appointments.push(appointment);
      appointmentIndex += 1;
      createdAppointments += 1;
    }
  }

  return {
    appointments,
    count: createdAppointments,
  };
}

async function seedQuotes({
  establishment,
  customers,
  vehiclesByCustomerId,
  services,
  categoryNameById,
  appointments,
}: {
  establishment: Awaited<ReturnType<typeof prisma.establishment.create>>;
  customers: Awaited<ReturnType<typeof prisma.customer.create>>[];
  vehiclesByCustomerId: Map<string, SeededCustomerVehicle[]>;
  services: SeededService[];
  categoryNameById: Map<string, string>;
  appointments: SeededAppointment[];
}) {
  const approvedAppointments = appointments
    .filter((appointment) => appointment.vehicleId)
    .slice(0, 4);
  const approvedQuoteIndexes = new Set([3, 9, 14, 17]);
  let approvedQuoteIndex = 0;
  let createdQuotes = 0;

  for (let quoteIndex = 0; quoteIndex < 18; quoteIndex += 1) {
    const isApproved = approvedQuoteIndexes.has(quoteIndex);
    let approvedAppointment: SeededAppointment | null = null;

    if (isApproved) {
      approvedAppointment = approvedAppointments[approvedQuoteIndex] ?? null;

      if (!approvedAppointment) {
        throw new Error("Not enough appointments to seed approved quotes.");
      }

      approvedQuoteIndex += 1;
    }

    const customer =
      approvedAppointment !== null
        ? findSeedCustomerById(customers, approvedAppointment.customerId)
        : customers[(quoteIndex * 5) % customers.length]!;
    const customerVehicles = vehiclesByCustomerId.get(customer.id) ?? [];
    const fallbackVehicle =
      customerVehicles[(quoteIndex + 1) % Math.max(customerVehicles.length, 1)];
    const isProspect = !isApproved && quoteIndex % 4 === 1;
    const vehicle =
      approvedAppointment !== null
        ? buildQuoteVehicleFromAppointment(approvedAppointment)
        : quoteIndex % 5 === 0
          ? null
          : buildQuoteVehicleFromCustomerVehicle(fallbackVehicle);
    const vehicleId = isProspect
      ? null
      : (approvedAppointment?.vehicleId ??
        (vehicle !== null ? (fallbackVehicle?.id ?? null) : null));
    const selectedServices = selectQuoteServices(services, quoteIndex);
    const subtotalInCents = selectedServices.reduce((total, item) => {
      return total + (item.isCourtesy ? 0 : item.service.priceInCents);
    }, 0);
    const createdAt = setTime(
      addDays(REFERENCE_DATE, -24 + quoteIndex),
      TIME_SLOTS[quoteIndex % TIME_SLOTS.length]!,
    );
    const convertedAt =
      approvedAppointment !== null ? addHours(createdAt, 3) : null;

    await prisma.quote.create({
      data: {
        establishmentId: establishment.id,
        customerId: isProspect ? null : customer.id,
        vehicleId,
        convertedAppointmentId: approvedAppointment?.id ?? null,
        convertedAt,
        establishmentName:
          establishment.tradeName ?? "Clean Move Estetica Automotiva",
        establishmentLegalBusinessName:
          establishment.legalBusinessName ??
          "Clean Move Servicos Automotivos LTDA",
        establishmentCnpj: establishment.cnpj ?? "61911322000187",
        establishmentAddress: buildQuoteEstablishmentAddress(),
        establishmentBannerImageUrl: establishment.bannerImageUrl,
        customerName: isProspect
          ? buildProspectName(quoteIndex)
          : customer.fullName,
        customerPhone: isProspect
          ? buildPhone(400 + quoteIndex)
          : customer.phone,
        customerCpfCnpj: isProspect ? null : customer.cpfCnpj,
        customerAddress: Prisma.JsonNull,
        vehiclePlate: vehicle?.plate ?? null,
        vehicleBrand: vehicle?.brand ?? null,
        vehicleModel: vehicle?.model ?? null,
        vehicleColor: vehicle?.color ?? null,
        vehicleYear: vehicle?.year ?? null,
        description: resolveQuoteDescription(quoteIndex),
        termsAndConditions: "Orcamento valido conforme data de expiracao.",
        expiresAt: resolveQuoteExpiresAt(quoteIndex, isApproved),
        createdAt,
        updatedAt: convertedAt ?? createdAt,
        services: {
          create: selectedServices.map(({ service, isCourtesy }, position) => ({
            serviceId: service.id,
            serviceName: service.serviceName,
            serviceCategoryId: service.categoryId,
            serviceCategoryName: service.categoryId
              ? (categoryNameById.get(service.categoryId) ?? null)
              : null,
            serviceDurationInMinutes:
              resolveBookedServiceDurationInMinutes(service),
            servicePriceInCents: service.priceInCents,
            isCourtesy,
            position,
          })),
        },
        paymentOptions: {
          create: buildQuotePaymentOptions(subtotalInCents, quoteIndex),
        },
      },
    });

    createdQuotes += 1;
  }

  return createdQuotes;
}

function findSeedCustomerById(
  customers: Awaited<ReturnType<typeof prisma.customer.create>>[],
  customerId: string,
) {
  const customer = customers.find((item) => item.id === customerId);

  if (!customer) {
    throw new Error(`Customer ${customerId} not found for quote seed.`);
  }

  return customer;
}

function buildQuoteEstablishmentAddress() {
  return {
    street: "Estrada Farmaceutico Oswaldo Paiva",
    country: "Brasil",
    state: "SP",
    zipCode: "13963060",
    city: "Socorro",
    complement: null,
  };
}

function buildQuoteVehicleFromCustomerVehicle(
  vehicle: SeededCustomerVehicle | undefined,
) {
  if (!vehicle) {
    return null;
  }

  return {
    plate: vehicle.plate,
    brand: vehicle.brand,
    model: vehicle.model,
    color: vehicle.color,
    year: vehicle.year,
  };
}

function buildQuoteVehicleFromAppointment(appointment: SeededAppointment) {
  return {
    plate: appointment.vehiclePlate,
    brand: appointment.vehicleBrand,
    model: appointment.vehicleModel,
    color: appointment.vehicleColor,
    year: appointment.vehicleYear,
  };
}

function selectQuoteServices(services: SeededService[], quoteIndex: number) {
  const selectedServiceIds = new Set<string>();
  const preferredServiceIndex =
    SERVICE_SELECTION_SEQUENCE[
      (quoteIndex * 3) % SERVICE_SELECTION_SEQUENCE.length
    ]!;
  const serviceCount = quoteIndex % 6 === 0 ? 3 : quoteIndex % 3 === 0 ? 2 : 1;

  return Array.from({ length: serviceCount }, (_, index) => {
    const service = findActiveService(
      services,
      preferredServiceIndex + index * 4,
      selectedServiceIds,
    );

    selectedServiceIds.add(service.id);

    return {
      service,
      isCourtesy:
        serviceCount > 1 && index === serviceCount - 1 && quoteIndex % 4 === 0,
    };
  });
}

function buildQuotePaymentOptions(subtotalInCents: number, quoteIndex: number) {
  const pixDiscountType =
    quoteIndex % 3 === 0 ? QuoteDiscountType.PERCENTAGE : null;
  const pixDiscountValue = pixDiscountType ? 5 : null;
  const cardInstallments = quoteIndex % 2 === 0 ? 3 : 6;

  return [
    {
      method: QuotePaymentMethod.PIX,
      label: pixDiscountType ? "Pix com 5% de desconto" : "Pix a vista",
      installments: 1,
      interestFree: true,
      discountType: pixDiscountType,
      discountValue: pixDiscountValue,
      totalInCents: calculateQuotePaymentTotal(
        subtotalInCents,
        pixDiscountType,
        pixDiscountValue,
      ),
      position: 0,
    },
    {
      method: QuotePaymentMethod.CARD,
      label: `Cartao em ate ${cardInstallments}x sem juros`,
      installments: cardInstallments,
      interestFree: true,
      discountType: null,
      discountValue: null,
      totalInCents: subtotalInCents,
      position: 1,
    },
  ];
}

function calculateQuotePaymentTotal(
  subtotalInCents: number,
  discountType: QuoteDiscountType | null,
  discountValue: number | null,
) {
  if (!discountType || !discountValue) {
    return subtotalInCents;
  }

  if (discountType === QuoteDiscountType.PERCENTAGE) {
    return Math.max(
      0,
      subtotalInCents - Math.floor((subtotalInCents * discountValue) / 100),
    );
  }

  return Math.max(0, subtotalInCents - discountValue);
}

function resolveQuoteExpiresAt(quoteIndex: number, isApproved: boolean) {
  if (isApproved) {
    return addDays(REFERENCE_DATE, -2);
  }

  switch (quoteIndex % 4) {
    case 0:
      return addDays(REFERENCE_DATE, 8);
    case 1:
      return setTime(REFERENCE_DATE, { hour: 23, minute: 59 });
    case 2:
      return addDays(REFERENCE_DATE, -3);
    default:
      return null;
  }
}

function resolveQuoteDescription(quoteIndex: number) {
  if (quoteIndex % 5 === 0) {
    return "Cliente pediu avaliacao detalhada antes da execucao.";
  }

  if (quoteIndex % 7 === 0) {
    return "Verificar disponibilidade de agenda antes de confirmar.";
  }

  return null;
}

function buildProspectName(quoteIndex: number) {
  const prospectNames = [
    "Marcos Almeida Prospect",
    "Camila Rocha Prospect",
    "Rodrigo Nunes Prospect",
    "Fernanda Lopes Prospect",
    "Lucas Vieira Prospect",
  ];

  return prospectNames[quoteIndex % prospectNames.length]!;
}

function selectAppointmentServices(
  services: SeededService[],
  appointmentIndex: number,
) {
  const selectedServiceIds = new Set<string>();
  const preferredServiceIndex =
    SERVICE_SELECTION_SEQUENCE[
      appointmentIndex % SERVICE_SELECTION_SEQUENCE.length
    ]!;
  const serviceCount =
    appointmentIndex % 9 === 0 ? 3 : appointmentIndex % 4 === 0 ? 2 : 1;

  return Array.from({ length: serviceCount }, (_, index) => {
    const service = findActiveService(
      services,
      preferredServiceIndex + index * 5,
      selectedServiceIds,
    );

    selectedServiceIds.add(service.id);

    return service;
  });
}

function findActiveService(
  services: SeededService[],
  preferredServiceIndex: number,
  selectedServiceIds: Set<string>,
) {
  for (let offset = 0; offset < services.length; offset += 1) {
    const service =
      services[(preferredServiceIndex + offset) % services.length]!;

    if (service.isActive && !selectedServiceIds.has(service.id)) {
      return service;
    }
  }

  throw new Error(
    "At least one active service is required to seed appointments.",
  );
}

function resolveBookedServiceDurationInMinutes(service: SeededService) {
  return (
    service.estimatedDurationMaxInMinutes ??
    service.estimatedDurationMinInMinutes ??
    null
  );
}

function resolveServiceDurationForSchedule(service: SeededService) {
  return resolveBookedServiceDurationInMinutes(service) ?? 60;
}

function formatAppointmentServiceNames(services: SeededService[]) {
  return services.map((service) => service.serviceName).join(", ");
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
  const baseDigits = String(100000000 + sequence).slice(-9);
  const firstCheckDigit = calculateCpfCheckDigit(
    baseDigits,
    [10, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  const secondCheckDigit = calculateCpfCheckDigit(
    `${baseDigits}${firstCheckDigit}`,
    [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
  );

  return `${baseDigits}${firstCheckDigit}${secondCheckDigit}`;
}

function calculateCpfCheckDigit(value: string, weights: number[]) {
  const total = value.split("").reduce((sum, digit, index) => {
    const weight = weights[index];

    if (weight === undefined) {
      throw new Error(`Missing CPF weight for index ${index}`);
    }

    return sum + Number(digit) * weight;
  }, 0);
  const remainder = total % 11;

  return remainder < 2 ? 0 : 11 - remainder;
}

function buildPlate(sequence: number) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let remaining = sequence;

  const digit1 = remaining % 10;
  remaining = Math.floor(remaining / 10);
  const letter4 = letters[remaining % 26]!;
  remaining = Math.floor(remaining / 26);
  const digit2 = remaining % 10;
  remaining = Math.floor(remaining / 10);
  const digit3 = remaining % 10;
  remaining = Math.floor(remaining / 10);
  const letter3 = letters[remaining % 26]!;
  remaining = Math.floor(remaining / 26);
  const letter2 = letters[remaining % 26]!;
  remaining = Math.floor(remaining / 26);
  const letter1 = letters[remaining % 26]!;

  return `${letter1}${letter2}${letter3}${digit1}${letter4}${digit2}${digit3}`;
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
