# Quote Error Codes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return stable error codes, plus normalized field errors for request validation, from quote API endpoints without changing other domains' error contracts.

**Architecture:** Quote-only validation is isolated in a dedicated pipe that transforms Zod issues into `{ field, code }`. Quote domain errors carry a stable code and shared resource errors retain resource identity; a single quote HTTP mapper creates every handled error payload and is used by all quote controllers.

**Tech Stack:** NestJS 11 exceptions/pipes, Zod 4, TypeScript, Vitest, Supertest, Swagger decorators.

---

## File Structure

- Create: `src/infra/http/controllers/quote/quote-error-response.ts` — quote error and field-error types plus object-payload factory.
- Create: `src/infra/http/controllers/quote/quote-zod-validation.pipe.ts` — opt-in quote validation pipe and Zod-to-field-code conversion.
- Create: `src/infra/http/controllers/quote/quote-zod-validation.pipe.spec.ts` — isolated validation contract tests.
- Modify: `src/infra/http/controllers/quote/quote-http-errors.ts` — central exception/status/code translation.
- Create: `src/infra/http/controllers/quote/quote-http-errors.spec.ts` — mapper tests for all mapped status classes.
- Modify: `src/modules/quotes/domain/errors/invalid-quote-input-error.ts` — typed quote business code carried with the existing error.
- Modify: `src/shared/errors/resource-not-found-error.ts` — preserve resource identity as an immutable property.
- Modify: `src/shared/errors/resource-already-exists-error.ts` — allow optional immutable resource identity without breaking existing call sites.
- Modify: `src/modules/quotes/domain/entities/quote.ts`, `src/modules/application/use-cases/quote/create-quote.ts`, and `src/modules/application/use-cases/quote/register-quote-prospect-as-customer.ts` — attach specific codes to quote business rules.
- Modify: all six quote controllers under `src/infra/http/controllers/quote/` — use the quote validation pipe and central HTTP mapper.
- Modify: `src/infra/http/docs/domain-swagger.dto.ts` — expose quote error and validation-error DTOs for the affected endpoints.
- Modify: `src/infra/http/controllers/quote/quote-controllers.e2e-spec.ts` — assert the public quote error contract.

### Task 1: Define and test the quote validation contract

**Files:**

- Create: `src/infra/http/controllers/quote/quote-error-response.ts`
- Create: `src/infra/http/controllers/quote/quote-zod-validation.pipe.ts`
- Create: `src/infra/http/controllers/quote/quote-zod-validation.pipe.spec.ts`

- [ ] **Step 1: Write failing pipe tests for normalized validation errors.**

```ts
expect(formatQuoteValidationIssues(result.error)).toEqual([
  { field: "customer.email", code: "INVALID_FORMAT" },
  { field: "serviceItems", code: "MIN_ITEMS" },
]);

expect(() => pipe.transform({}, metadata)).toThrowError(BadRequestException);
expect((error as BadRequestException).getResponse()).toEqual({
  statusCode: 400,
  code: "VALIDATION_ERROR",
  message: "Validation failed",
  errors: [{ field: "customer.name", code: "REQUIRED" }],
});
```

- [ ] **Step 2: Run the focused test and verify it fails because the pipe does not exist.**

Run: `npm run test -- src/infra/http/controllers/quote/quote-zod-validation.pipe.spec.ts`

Expected: FAIL with module-not-found or missing export errors.

- [ ] **Step 3: Add quote response types and the opt-in pipe.**

```ts
export type QuoteFieldError = { field: string; code: QuoteValidationFieldCode };

export type QuoteErrorResponse = {
  statusCode: number;
  code: string;
  message: string;
  errors?: QuoteFieldError[];
};

export class QuoteZodValidationPipe<
  TSchema extends z.ZodTypeAny,
> implements PipeTransform<unknown, z.output<TSchema>> {
  transform(value: unknown): z.output<TSchema> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    throw new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      errors: formatQuoteValidationIssues(result.error),
    } satisfies QuoteErrorResponse);
  }
}
```

Map `invalid_type` with an `undefined` input to `REQUIRED`; map other type failures to `INVALID_TYPE`; map `invalid_format` and `invalid_value` to `INVALID_FORMAT`; use the issue `origin` to distinguish `MIN_ITEMS`/`MAX_ITEMS` for string/array limits from `OUT_OF_RANGE` for number/date limits; map `custom` to `INVALID_VALUE`. Build `field` with `issue.path.join(".")`.

- [ ] **Step 4: Run focused tests and the existing global pipe tests.**

Run: `npm run test -- src/infra/http/controllers/quote/quote-zod-validation.pipe.spec.ts src/infra/http/pipes/zod-validation.pipe.spec.ts`

Expected: PASS, demonstrating quote validation is normalized while the shared pipe contract remains unchanged.

- [ ] **Step 5: Commit the validation contract.**

```bash
git add src/infra/http/controllers/quote/quote-error-response.ts src/infra/http/controllers/quote/quote-zod-validation.pipe.ts src/infra/http/controllers/quote/quote-zod-validation.pipe.spec.ts
git commit -m "feat: add quote validation error contract"
```

### Task 2: Carry stable identifiers on quote domain errors

**Files:**

- Modify: `src/modules/quotes/domain/errors/invalid-quote-input-error.ts`
- Modify: `src/shared/errors/resource-not-found-error.ts`
- Modify: `src/shared/errors/resource-already-exists-error.ts`
- Modify: `src/modules/quotes/domain/entities/quote.ts`
- Modify: `src/modules/application/use-cases/quote/create-quote.ts`
- Modify: `src/modules/application/use-cases/quote/register-quote-prospect-as-customer.ts`
- Test: `src/modules/quotes/domain/entities/quote.spec.ts`
- Test: `src/modules/application/use-cases/quote/create-quote.spec.ts`
- Test: `src/modules/application/use-cases/quote/register-quote-prospect-as-customer.spec.ts`

- [ ] **Step 1: Add failing expectations for domain error codes.**

```ts
expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
expect((result.value as InvalidQuoteInputError).code).toBe(
  "QUOTE_ALREADY_CONVERTED",
);

expect((result.value as ResourceNotFoundError).resource).toBe("customer");
```

Cover approval without customer (`QUOTE_CANNOT_BE_APPROVED_FOR_PROSPECT`), duplicate conversion (`QUOTE_ALREADY_CONVERTED`), prospect registration with an existing customer (`QUOTE_ALREADY_HAS_CUSTOMER`), missing/incomplete vehicle snapshot, incomplete address, and duplicate customer document (`CUSTOMER_ALREADY_EXISTS`).

- [ ] **Step 2: Run the three focused suites and verify new code assertions fail.**

Run: `npm run test -- src/modules/quotes/domain/entities/quote.spec.ts src/modules/application/use-cases/quote/create-quote.spec.ts src/modules/application/use-cases/quote/register-quote-prospect-as-customer.spec.ts`

Expected: FAIL because errors currently expose only `message`.

- [ ] **Step 3: Add typed structured metadata and assign codes at rule sources.**

```ts
export type QuoteErrorCode =
  | "INVALID_QUOTE_INPUT"
  | "QUOTE_ALREADY_CONVERTED"
  | "QUOTE_ALREADY_HAS_CUSTOMER"
  | "QUOTE_CANNOT_BE_APPROVED_FOR_PROSPECT"
  | "QUOTE_INVALID_SCHEDULE_INTERVAL"
  | "QUOTE_VEHICLE_SNAPSHOT_MISSING"
  | "QUOTE_VEHICLE_SNAPSHOT_INCOMPLETE"
  | "QUOTE_CUSTOMER_ADDRESS_INCOMPLETE";

export class InvalidQuoteInputError extends Error {
  constructor(
    message = "Invalid quote input.",
    public readonly code: QuoteErrorCode = "INVALID_QUOTE_INPUT",
  ) {
    super(message);
    this.name = "InvalidQuoteInputError";
  }
}
```

Assign the specific codes at the explicit rules in `Quote.approve`, `Quote.markAsConverted`, `Quote.linkCustomer`, and prospect registration. Leave low-level value-object and general input failures on `INVALID_QUOTE_INPUT`. Add `public readonly resource?: string` to `ResourceNotFoundError`; add the same optional property to `ResourceAlreadyExistsError`, and construct the registration conflict with `{ message: "Customer already registered.", resource: "customer" }`. Update every existing non-quote caller of `ResourceAlreadyExistsError` to use a backward-compatible overload or preserve the current string constructor.

- [ ] **Step 4: Run focused suites and full unit tests.**

Run: `npm run test -- src/modules/quotes/domain/entities/quote.spec.ts src/modules/application/use-cases/quote/create-quote.spec.ts src/modules/application/use-cases/quote/register-quote-prospect-as-customer.spec.ts`

Run: `npm run test`

Expected: PASS; existing callers preserve their messages and quote rules expose stable codes.

- [ ] **Step 5: Commit the domain error metadata.**

```bash
git add src/modules/quotes/domain/errors/invalid-quote-input-error.ts src/shared/errors/resource-not-found-error.ts src/shared/errors/resource-already-exists-error.ts src/modules/quotes/domain/entities/quote.ts src/modules/application/use-cases/quote/create-quote.ts src/modules/application/use-cases/quote/register-quote-prospect-as-customer.ts src/modules/quotes/domain/entities/quote.spec.ts src/modules/application/use-cases/quote/create-quote.spec.ts src/modules/application/use-cases/quote/register-quote-prospect-as-customer.spec.ts
git commit -m "feat: add stable codes to quote domain errors"
```

### Task 3: Centralize HTTP error mapping and adopt it in every quote controller

**Files:**

- Modify: `src/infra/http/controllers/quote/quote-http-errors.ts`
- Create: `src/infra/http/controllers/quote/quote-http-errors.spec.ts`
- Modify: `src/infra/http/controllers/quote/create-quote.controller.ts`
- Modify: `src/infra/http/controllers/quote/list-quotes.controller.ts`
- Modify: `src/infra/http/controllers/quote/get-quote.controller.ts`
- Modify: `src/infra/http/controllers/quote/generate-quote-pdf.controller.ts`
- Modify: `src/infra/http/controllers/quote/approve-quote.controller.ts`
- Modify: `src/infra/http/controllers/quote/register-quote-prospect-as-customer.controller.ts`

- [ ] **Step 1: Write mapper tests before replacing controller logic.**

```ts
expect(() =>
  throwQuoteHttpError(new ResourceNotFoundError({ resource: "quote" })),
).toThrowError(NotFoundException);

expect(getResponse(error)).toEqual({
  statusCode: 404,
  code: "QUOTE_NOT_FOUND",
  message: "Resource not found: quote.",
});

expect(getResponse(new InactiveServiceError("Polimento"))).toMatchObject({
  statusCode: 400,
  code: "QUOTE_SERVICE_INACTIVE",
});
```

Test mappings for `NotAllowedError` (`FORBIDDEN`/403), resources `quote`, `customer`, `vehicle`, `service`, `establishment`, `owner` (resource-specific where listed in the spec, otherwise `RESOURCE_NOT_FOUND`), `ResourceAlreadyExistsError` customer conflict, `InvalidQuoteInputError.code`, `InactiveServiceError`, and fallback/`UnexpectedDomainError` (`INTERNAL_ERROR`/500).

- [ ] **Step 2: Run the mapper test and verify it fails.**

Run: `npm run test -- src/infra/http/controllers/quote/quote-http-errors.spec.ts`

Expected: FAIL because the mapper currently throws raw string messages.

- [ ] **Step 3: Implement a single object-payload exception factory and use it everywhere.**

```ts
function quoteHttpException(
  Exception: typeof BadRequestException,
  statusCode: number,
  code: string,
  message: string,
): never {
  throw new Exception({ statusCode, code, message });
}

export function throwQuoteHttpError(error: Error): never {
  if (error instanceof InvalidQuoteInputError) {
    return quoteHttpException(
      BadRequestException,
      400,
      error.code,
      error.message,
    );
  }
  // map resource metadata, inactive service, authorization and unexpected errors
}
```

Replace the inline `switch` blocks in `get-quote.controller.ts` and `list-quotes.controller.ts` with `throwQuoteHttpError(result.value)`. Replace `ZodValidationPipe` with `QuoteZodValidationPipe` in every `@Body`, `@Param`, and `@Query` decorator in the six controllers. Do not change authorization guards or non-quote controllers.

- [ ] **Step 4: Run mapper and typecheck tests.**

Run: `npm run test -- src/infra/http/controllers/quote/quote-http-errors.spec.ts`

Run: `npm run typecheck`

Expected: PASS with all six controllers sharing one quote error boundary.

- [ ] **Step 5: Commit the quote controller integration.**

```bash
git add src/infra/http/controllers/quote
git commit -m "feat: return coded errors from quote endpoints"
```

### Task 4: Publish and verify the external contract

**Files:**

- Modify: `src/infra/http/docs/domain-swagger.dto.ts`
- Modify: `src/infra/http/controllers/quote/create-quote.controller.ts`
- Modify: `src/infra/http/controllers/quote/list-quotes.controller.ts`
- Modify: `src/infra/http/controllers/quote/get-quote.controller.ts`
- Modify: `src/infra/http/controllers/quote/generate-quote-pdf.controller.ts`
- Modify: `src/infra/http/controllers/quote/approve-quote.controller.ts`
- Modify: `src/infra/http/controllers/quote/register-quote-prospect-as-customer.controller.ts`
- Modify: `src/infra/http/controllers/quote/quote-controllers.e2e-spec.ts`

- [ ] **Step 1: Add failing public-contract assertions to quote e2e tests.**

```ts
const quoteErrorResponseSchema = z.object({
  statusCode: z.number().int(),
  code: z.string().min(1),
  message: z.string(),
  errors: z.array(z.object({ field: z.string(), code: z.string() })).optional(),
});

expect(quoteErrorResponseSchema.parse(response.body)).toMatchObject({
  statusCode: 400,
  code: "VALIDATION_ERROR",
  errors: [{ field: "vehicle.brand", code: "REQUIRED" }],
});
```

Assert `QUOTE_CANNOT_BE_APPROVED_FOR_PROSPECT`, `QUOTE_ALREADY_CONVERTED`, `QUOTE_VEHICLE_SNAPSHOT_MISSING`, `CUSTOMER_ALREADY_EXISTS`, `QUOTE_NOT_FOUND` for cross-establishment access, and `QUOTE_SERVICE_INACTIVE` by posting an inactive catalog service. Retain message assertions only as a secondary diagnostic check.

- [ ] **Step 2: Run the quote e2e file and verify the new public assertions fail.**

Run: `npm run test:e2e -- src/infra/http/controllers/quote/quote-controllers.e2e-spec.ts`

Expected: FAIL until the implementation emits the new response shape.

- [ ] **Step 3: Document Swagger response schemas and wire them to quote endpoints.**

```ts
export class QuoteFieldErrorDto {
  @ApiProperty({ example: "customer.email" })
  field!: string;

  @ApiProperty({ example: "INVALID_FORMAT" })
  code!: string;
}

export class QuoteValidationErrorResponseDto {
  @ApiProperty({ example: 400 }) statusCode!: number;
  @ApiProperty({ example: "VALIDATION_ERROR" }) code!: string;
  @ApiProperty({ example: "Validation failed" }) message!: string;
  @ApiProperty({ type: QuoteFieldErrorDto, isArray: true })
  errors!: QuoteFieldErrorDto[];
}
```

Add a non-validation quote error DTO with `statusCode`, `code`, and `message`; pass the appropriate DTO in each controller's existing `@ApiBadRequestResponse`, `@ApiNotFoundResponse`, `@ApiConflictResponse`, `@ApiForbiddenResponse`, and `@ApiInternalServerErrorResponse` decorators. Keep endpoint success DTOs and HTTP statuses unchanged.

- [ ] **Step 4: Run e2e, static checks, and formatting verification.**

Run: `npm run test:e2e -- src/infra/http/controllers/quote/quote-controllers.e2e-spec.ts`

Run: `npm run typecheck && npm run lint && npm run format:check`

Expected: PASS with quote-only coded errors and a documented Swagger contract.

- [ ] **Step 5: Commit the published contract and verification.**

```bash
git add src/infra/http/docs/domain-swagger.dto.ts src/infra/http/controllers/quote src/infra/http/controllers/quote/quote-controllers.e2e-spec.ts
git commit -m "docs: document quote error responses"
```

## Final Verification

- [ ] Run `npm run test`.
- [ ] Run `npm run test:e2e -- src/infra/http/controllers/quote/quote-controllers.e2e-spec.ts`.
- [ ] Run `npm run typecheck && npm run lint && npm run format:check`.
- [ ] Inspect `git diff staging...HEAD` (or the repository default base branch if different) to confirm only quote error behavior and required shared error metadata changed.
