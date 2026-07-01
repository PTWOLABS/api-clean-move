import { envSchema } from "../env/env";

const env = envSchema.parse(process.env);

export const authPasswordFlowThrottle = {
  request: {
    limit: env.AUTH_PASSWORD_FLOW_REQUEST_LIMIT,
    ttl: env.AUTH_PASSWORD_FLOW_REQUEST_TTL_IN_MS,
  },
  confirm: {
    limit: env.AUTH_PASSWORD_FLOW_CONFIRM_LIMIT,
    ttl: env.AUTH_PASSWORD_FLOW_CONFIRM_TTL_IN_MS,
  },
};
