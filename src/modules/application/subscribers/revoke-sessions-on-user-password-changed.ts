import { Injectable, OnModuleDestroy } from "@nestjs/common";

import { UserPasswordChangedEvent } from "../../accounts/domain/events/user-password-changed-event";
import { DomainEvents } from "../../../shared/events/domain-events";
import { SessionsRepository } from "../repositories/sessions-repository";

@Injectable()
export class RevokeSessionsOnUserPasswordChanged implements OnModuleDestroy {
  constructor(private sessionsRepository: SessionsRepository) {
    this.setupSubscriptions();
  }

  private setupSubscriptions() {
    DomainEvents.register(this.revokeSessions, UserPasswordChangedEvent.name);
  }

  onModuleDestroy() {
    DomainEvents.unregister(this.revokeSessions, UserPasswordChangedEvent.name);
  }

  private revokeSessions = async (event: UserPasswordChangedEvent) => {
    const sessions = await this.sessionsRepository.findManyByUserId(
      event.userId.toString(),
    );

    for (const session of sessions) {
      if (session.isRevoked()) {
        continue;
      }

      session.revoke();
      await this.sessionsRepository.save(session);
    }
  };
}
