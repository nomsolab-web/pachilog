export type RequestTimeoutServer = {
  timeout(request: Request, timeoutSeconds: number): void;
};

export function disableCollectionRequestTimeout(pathname: string, request: Request, server: RequestTimeoutServer) {
  if (pathname === "/api/collect-machines/run" || pathname === "/api/collect-machines/track") {
    server.timeout(request, 0);
    return true;
  }
  return false;
}
