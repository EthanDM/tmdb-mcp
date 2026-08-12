import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";

describe("MCP server protocol", () => {
  it("starts over stdio and lists the read-only discovery tools", async () => {
    // Listing tools is local, so this placeholder token cannot make a TMDB request.
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", "src/server.ts"],
      cwd: process.cwd(),
      env: { ...process.env, TMDB_READ_ACCESS_TOKEN: "test-token" },
      stderr: "pipe"
    });
    const client = new Client({ name: "tmdb-mcp-test", version: "0.1.0" });

    try {
      await client.connect(transport);
      const { tools } = await client.listTools();
      const names = tools.map((tool) => tool.name);

      expect(names).toEqual(
        expect.arrayContaining([
          "tmdb_search_movies",
          "tmdb_discover_movies",
          "tmdb_search_tv",
          "tmdb_discover_tv",
          "tmdb_search_people",
          "tmdb_get_credits"
        ])
      );
      expect(names).not.toEqual(
        expect.arrayContaining(["tmdb_add_favorite", "tmdb_add_to_watchlist"])
      );
    } finally {
      await client.close();
    }
  });
});
