import { Module } from "@nestjs/common";

import { DatabaseModule } from "./database/database.module";
import { EnvModule } from "./env/env.module";
import { EventsModule } from "./events/events.module";
import { HttpModule } from "./http/http.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [EnvModule, DatabaseModule, EventsModule, HttpModule, AuthModule],
  providers: [],
})
export class AppModule {}
