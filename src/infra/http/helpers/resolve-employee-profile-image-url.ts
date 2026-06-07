import { User } from "../../../modules/accounts/domain/entities/user";
import { Employee } from "../../../modules/employees/domain/entities/employee";

export function buildUserProfileImageUrlMap(
  users: User[],
): Map<string, string | null> {
  return new Map(
    users.map((user) => [user.id.toString(), user.profileImageUrl]),
  );
}

export function resolveEmployeeProfileImageUrl(
  employee: Employee,
  profileImageUrlsByUserId: Map<string, string | null>,
): string | null {
  return profileImageUrlsByUserId.get(employee.userId.toString()) ?? null;
}
