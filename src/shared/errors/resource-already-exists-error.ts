type ResourceAlreadyExistsErrorOptions = {
  message?: string;
  resource?: string;
};

export class ResourceAlreadyExistsError extends Error {
  constructor(message?: string);
  constructor(options?: ResourceAlreadyExistsErrorOptions);
  constructor(input?: string | ResourceAlreadyExistsErrorOptions) {
    const options = typeof input === "string" ? { message: input } : input;

    super(options?.message ?? "Resource already exists.");
    this.resource = options?.resource;
  }

  readonly resource: string | undefined;
}
