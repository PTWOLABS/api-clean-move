import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { EnvService } from "./env/env.service";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

const swaggerAuthAutomationScript = `
(() => {
  const refreshTokenSchemeName = "refresh-token";
  const refreshTokenHint =
    "O cookie HttpOnly refresh_token e enviado automaticamente pelo navegador nas requisicoes do Swagger UI.";

  const decorateRefreshTokenAuthorization = () => {
    const authorizationItems = document.querySelectorAll(".auth-container");

    authorizationItems.forEach((item) => {
      const title = item.querySelector("h4");

      if (!title?.textContent?.includes(refreshTokenSchemeName)) {
        return;
      }

      const valueLabel = Array.from(item.querySelectorAll("h4, label, p")).find(
        (element) => element.textContent?.trim() === "Value:",
      );
      const input = item.querySelector("input");
      const authorizeButton = Array.from(item.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Authorize",
      );

      if (input instanceof HTMLInputElement) {
        input.placeholder = "Automatico via cookie HttpOnly";
        input.disabled = true;
      }

      if (authorizeButton instanceof HTMLButtonElement) {
        authorizeButton.disabled = true;
        authorizeButton.title = refreshTokenHint;
      }

      if (valueLabel && !item.querySelector("[data-swagger-refresh-token-hint]")) {
        const hint = document.createElement("p");
        hint.dataset.swaggerRefreshTokenHint = "true";
        hint.style.marginTop = "8px";
        hint.style.fontSize = "12px";
        hint.style.opacity = "0.8";
        hint.textContent = refreshTokenHint;
        valueLabel.insertAdjacentElement("afterend", hint);
      }
    });
  };

  const observer = new MutationObserver(() => {
    decorateRefreshTokenAuthorization();
  });

  window.addEventListener("load", () => {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    decorateRefreshTokenAuthorization();
  });
})();
`;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const envService = app.get(EnvService);
  const port = envService.get("PORT");

  app.enableCors({
    origin: envService.get("FRONTEND_URL"),
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle("API Clean Move")
    .setDescription("API documentation")
    .setVersion("1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT access token used on protected routes.",
      },
      "access-token",
    )
    .addCookieAuth(
      "refresh_token",
      {
        type: "apiKey",
        in: "cookie",
        description: "HttpOnly refresh token used to renew the session.",
      },
      "refresh-token",
    )
    .addTag("auth", "Authentication and session management")
    .addTag("register", "Establishment registration")
    .addTag("customers", "Internal customer management")
    .addTag("customer vehicles", "Internal customer vehicle management")
    .addTag("appointments", "Establishment-operated appointment management")
    .addTag("dashboard metrics", "Authenticated dashboard metric read models")
    .addTag("service", "Service catalog management")
    .addTag("media", "Image uploads and media")
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, documentFactory, {
    customJsStr: swaggerAuthAutomationScript,
    swaggerOptions: {
      persistAuthorization: true,
      withCredentials: true,
      requestInterceptor: (request: {
        credentials?: string;
        method?: string;
        url?: string;
      }) => {
        const browserWindow = globalThis as unknown as {
          __swaggerLastRequestMethod: string | undefined;
          __swaggerLastRequestUrl: string | undefined;
        };

        request.credentials = "include";
        browserWindow.__swaggerLastRequestMethod = request.method;
        browserWindow.__swaggerLastRequestUrl = request.url;

        return request;
      },
      responseInterceptor: (response: {
        body?: string;
        data?: unknown;
        obj?: {
          url?: string;
        };
        ok?: boolean;
        status?: number;
        url?: string;
      }) => {
        const isSuccessStatus =
          response.ok === true ||
          (typeof response.status === "number" &&
            response.status >= 200 &&
            response.status < 300);
        const browserWindow = globalThis as unknown as {
          __swaggerLastRequestMethod: string | undefined;
          __swaggerLastRequestUrl: string | undefined;
          location?: {
            origin?: string;
          };
          ui?: {
            preauthorizeApiKey?: (schemeName: string, value: string) => void;
            authActions: {
              logout: (payload: string[]) => void;
            };
          };
        };

        if (!isSuccessStatus || !browserWindow.ui) {
          return response;
        }

        let parsedBody: { accessToken?: unknown } | undefined;

        const parseJson = (
          value: unknown,
        ): { accessToken?: unknown } | undefined => {
          if (typeof value === "string" && value.length > 0) {
            try {
              return JSON.parse(value) as {
                accessToken?: unknown;
              };
            } catch {
              return undefined;
            }
          }

          if (typeof value === "object" && value !== null) {
            return value as { accessToken?: unknown };
          }

          return undefined;
        };

        if (typeof response.body === "string" && response.body.length > 0) {
          try {
            parsedBody = JSON.parse(response.body) as {
              accessToken?: unknown;
            };
          } catch {
            parsedBody = undefined;
          }
        }
        parsedBody ??= parseJson(response.data);

        const requestUrl =
          response.url ||
          response.obj?.url ||
          browserWindow.__swaggerLastRequestUrl ||
          "";
        const pathname = requestUrl
          ? new URL(requestUrl, browserWindow.location?.origin).pathname
          : "";

        if (
          parsedBody &&
          typeof parsedBody.accessToken === "string" &&
          browserWindow.ui.preauthorizeApiKey
        ) {
          browserWindow.ui.preauthorizeApiKey(
            "access-token",
            parsedBody.accessToken,
          );
        }

        if (
          pathname.includes("/auth/sign-out") ||
          browserWindow.__swaggerLastRequestUrl?.includes("/auth/sign-out")
        ) {
          browserWindow.ui.authActions.logout(["access-token"]);
        }

        return response;
      },
    },
  });

  await app.listen(port, "0.0.0.0");

  if (envService.get("NODE_ENV") === "development") {
    console.log(`
    
Swagger: http://localhost:3000/api
    
    
    `);
  }
}

void bootstrap();
