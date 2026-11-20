import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const auth = vi.hoisted(() => ({ getUser: vi.fn(), create: vi.fn() }));
vi.mock("../../lib/supabase/server", () => ({ createServerAuthClient: auth.create }));
import * as portfolios from "../../app/api/portfolios/route";
import * as portfolio from "../../app/api/portfolios/[id]/route";
import * as education from "../../app/api/portfolios/[id]/education/route";
import * as educationEntry from "../../app/api/portfolios/[id]/education/[entryId]/route";
import * as experience from "../../app/api/portfolios/[id]/experience/route";
import * as experienceEntry from "../../app/api/portfolios/[id]/experience/[entryId]/route";

const id = "c90b01a8-5926-48af-bfb5-084954a5c101";
const context = { params: Promise.resolve({ id, entryId: id }) };
const routes = [
  [portfolios, "GET", undefined],
  [portfolios, "POST", { title: "Example" }],
  [portfolio, "GET", undefined],
  [portfolio, "PATCH", { title: "Example" }],
  [education, "GET", undefined],
  [education, "POST", { institution: "School" }],
  [educationEntry, "PATCH", { institution: "School" }],
  [experience, "GET", undefined],
  [experience, "POST", { organization: "Employer" }],
  [experienceEntry, "PATCH", { organization: "Employer" }],
] as const;
function request(method: string, body: unknown) {
  return new Request("http://localhost/api/portfolios", {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
describe("production route exports (mock Auth, no network)", () => {
  beforeEach(() => {
    auth.create.mockResolvedValue({ auth: { getUser: auth.getUser } });
  });
  it("exports exactly the intended methods", () => {
    for (const [module, methods] of [
      [portfolios, ["GET", "POST"]],
      [portfolio, ["GET", "PATCH"]],
      [education, ["GET", "POST"]],
      [educationEntry, ["PATCH"]],
      [experience, ["GET", "POST"]],
      [experienceEntry, ["PATCH"]],
    ] as const) {
      expect(
        Object.keys(module)
          .filter((key) => /^[A-Z]+$/.test(key))
          .sort(),
      ).toEqual([...methods].sort());
    }
  });
  for (const [module, method, body] of routes) {
    const run = module[method as keyof typeof module] as unknown as (
      request: Request,
      ctx: { params: Promise<{ id: string; entryId: string }> },
    ) => Promise<Response>;
    it(`${method} route requires a verified non-anonymous user`, async () => {
      for (const result of [
        { data: { user: null }, error: null },
        { data: { user: { id, is_anonymous: true } }, error: null },
        { data: { user: null }, error: { message: "auth error" } },
      ]) {
        auth.getUser.mockResolvedValue(result);
        const response = await run(request(method, body), context);
        expect(response.status).toBe(401);
        expect(response.headers.get("cache-control")).toContain("no-store");
      }
    });
    it(`${method} route returns unavailable for valid authenticated requests`, async () => {
      auth.getUser.mockResolvedValue({ data: { user: { id, is_anonymous: false } }, error: null });
      const response = await run(request(method, body), context);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: { code: "unavailable" } });
      expect(response.headers.get("cache-control")).toContain("no-store");
    });
  }
  it("fails closed when SSR configuration is unavailable", async () => {
    auth.create.mockResolvedValue(null);
    const response = await portfolios.GET(request("GET", undefined), context);
    expect(response.status).toBe(503);
  });
  it("sanitizes unexpected auth failures", async () => {
    auth.create.mockRejectedValue(new Error("private error"));
    const response = await portfolios.GET(request("GET", undefined), context);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private error");
  });
});
