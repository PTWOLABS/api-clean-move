import { Module } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";

import { DatabaseModule } from "./database/database.module";
import { EnvModule } from "./env/env.module";
import { EventsModule } from "./events/events.module";
import { HttpModule } from "./http/http.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [
    EnvModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    DatabaseModule,
    EventsModule,
    HttpModule,
    AuthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
