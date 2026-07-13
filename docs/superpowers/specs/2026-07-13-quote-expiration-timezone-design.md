# Quote expiration timezone

## Goal

Classify quote expiration dates by the calendar day in `America/Sao_Paulo`.
For example, `2026-07-14T02:59:59.999Z` is 23:59:59.999 on 13 July in
Sao Paulo and must be classified as `EXPIRES_TODAY` when the reference date
is 13 July there.

## Design

Create a shared day-boundary helper that accepts a reference instant and
returns the UTC instants corresponding to the start of the current and next
calendar day in the fixed `America/Sao_Paulo` timezone. Keep the timezone as a
named constant so a future establishment-specific timezone can be supplied at
one boundary.

Use this helper for all quote-list status calculations:

- `QuotePresenter` determines each list item's `VALID`, `EXPIRES_TODAY`, or
  `EXPIRED` status from these boundaries; approved quotes continue to take
  precedence.
- Prisma repository summary counts use the same boundaries in database
  predicates.
- In-memory repository summary counts use the same boundaries, keeping unit
  and integration behavior aligned.

No persisted dates are transformed and no API field changes are needed. Dates
remain UTC instants; only their day-based interpretation changes.

## Validation

Add coverage for the local end-of-day instant (`2026-07-14T02:59:59.999Z`) with
a 13 July reference date. The list item status and summary must both classify
it as expiring today. Preserve existing cases for expired, valid, and approved
quotes.

## Future extension

When establishments expose a timezone, pass that value into the helper instead
of the fixed constant. The caller contracts and stored `expiresAt` values stay
unchanged.
