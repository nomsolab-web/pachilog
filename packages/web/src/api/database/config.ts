export function requireDatabaseUrl(value?: string) {
  const url = arguments.length > 0 ? value : process.env.DATABASE_URL;
  if (!url) {
    if (arguments.length === 0 && process.env.NODE_ENV === "test") {
      return "file::memory:";
    }
    throw new Error("DATABASE_URL is required");
  }
  return url;
}
