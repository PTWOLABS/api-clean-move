import { Reflector } from "@nestjs/core";
import { EmployeeFeature } from "../../modules/employees/domain/policies/employee-features-policy";

export const EmployeeFeatures = Reflector.createDecorator<EmployeeFeature[]>();
