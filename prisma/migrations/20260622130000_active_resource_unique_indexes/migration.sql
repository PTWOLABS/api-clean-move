DROP INDEX IF EXISTS "service_categories_establishment_id_name_key";

CREATE UNIQUE INDEX "service_categories_active_establishment_name_unique"
  ON "service_categories" ("establishment_id", lower("name"))
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "services_active_establishment_name_unique"
  ON "services" ("establishment_id", lower("service_name"))
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "customers_active_establishment_cpf_cnpj_unique"
  ON "customers" ("establishment_id", "cpf_cnpj")
  WHERE "deleted_at" IS NULL AND "cpf_cnpj" IS NOT NULL;

CREATE UNIQUE INDEX "customer_vehicles_active_establishment_plate_unique"
  ON "customer_vehicles" ("establishment_id", "plate")
  WHERE "deleted_at" IS NULL AND "plate" IS NOT NULL;
