import { writeFile } from "node:fs/promises";
import {
  DEFAULT_CHANNEL_DISCOVERY_QUERIES,
  discoverChannelCandidates,
  getRegisteredChannelIdsFromSeedAndDb,
  YoutubeChannelDiscoveryClient,
} from "../lib/channel-discovery";

type CliOptions = {
  days: number;
  limit: number;
  minVideos: number;
  output: string;
};

const DEFAULT_OPTIONS: CliOptions = {
  days: 60,
  limit: 100,
  minVideos: 2,
  output: "channel-candidates.json",
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const registeredChannelIds = await getRegisteredChannelIdsFromSeedAndDb();
  const result = await discoverChannelCandidates(
    {
      days: options.days,
      limit: options.limit,
      minVideos: options.minVideos,
      queries: DEFAULT_CHANNEL_DISCOVERY_QUERIES,
    },
    new YoutubeChannelDiscoveryClient(),
    registeredChannelIds,
  );

  await writeFile(options.output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify({
      output: options.output,
      candidates: result.candidates.length,
      days: options.days,
      limit: options.limit,
      minVideos: options.minVideos,
      queries: result.searchConditions.queries.length,
    }),
  );
}

function parseArgs(args: string[]): CliOptions {
  const options = { ...DEFAULT_OPTIONS };
  for (const arg of args) {
    const [name, value] = arg.split("=", 2);
    if (!name.startsWith("--") || value === undefined) throw new Error(`Invalid option: ${arg}`);
    switch (name) {
      case "--days":
        options.days = parsePositiveInteger(name, value);
        break;
      case "--limit":
        options.limit = parsePositiveInteger(name, value);
        break;
      case "--min-videos":
        options.minVideos = parsePositiveInteger(name, value);
        break;
      case "--output":
        options.output = value;
        break;
      default:
        throw new Error(`Unknown option: ${name}`);
    }
  }
  return options;
}

function parsePositiveInteger(name: string, value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
