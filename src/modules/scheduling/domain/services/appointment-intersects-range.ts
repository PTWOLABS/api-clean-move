export function appointmentIntersectsRange(
  appointmentStartsAt: Date,
  appointmentEndsAt: Date | null,
  rangeStartsAt: Date,
  rangeEndsAt: Date,
): boolean {
  const effectiveEndsAt = appointmentEndsAt ?? appointmentStartsAt;

  return appointmentStartsAt < rangeEndsAt && effectiveEndsAt > rangeStartsAt;
}
