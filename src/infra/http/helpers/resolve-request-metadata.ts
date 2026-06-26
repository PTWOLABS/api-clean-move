type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket: {
    remoteAddress?: string | null;
  };
};

export function resolveUserAgent(req: RequestLike): string | null {
  const userAgent = req.headers["user-agent"];

  if (typeof userAgent !== "string") {
    return null;
  }

  return userAgent.trim() || null;
}

export function resolveIpAddress(req: RequestLike): string | null {
  const forwardedForHeader = req.headers["x-forwarded-for"];
  const forwardedFor = Array.isArray(forwardedForHeader)
    ? forwardedForHeader[0]
    : forwardedForHeader;

  if (typeof forwardedFor === "string") {
    const firstForwardedIp = forwardedFor.split(",")[0]?.trim();

    if (firstForwardedIp) {
      return firstForwardedIp;
    }
  }

  if (req.ip?.trim()) {
    return req.ip.trim();
  }

  return req.socket.remoteAddress?.trim() || null;
}
