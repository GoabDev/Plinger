import { afterEach, describe, expect, it, vi } from "vitest";
import { selectAllSupabaseRows } from "./server";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("complete Supabase reads", () => {
  it("continues until an empty page when a count is unavailable", async () => {
    vi.stubEnv("SUPABASE_URL", "https://database.example");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('[{"id":1}]'))
      .mockResolvedValueOnce(new Response('[{"id":2}]'))
      .mockResolvedValueOnce(new Response("[]"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await selectAllSupabaseRows({ table: "issues", query: { order: "id.asc" } }))
      .toEqual({ data: [{ id: 1 }, { id: 2 }], count: 2 });
    expect(fetchMock.mock.calls.map(([url]) => url.searchParams.get("offset"))).toEqual(["0", "1", "2"]);
  });

  it("rejects an empty page before the reported total is reached", async () => {
    vi.stubEnv("SUPABASE_URL", "https://database.example");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]", {
      headers: { "content-range": "*/2" },
    })));
    expect(await selectAllSupabaseRows({ table: "issues", query: { order: "id.asc" } }))
      .toEqual({ data: [], error: "Incomplete paginated read of issues" });
  });

  it("preserves the unconfigured state without attempting a request", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await selectAllSupabaseRows({ table: "issues", query: { order: "id.asc" } }))
      .toEqual({ data: [], skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
