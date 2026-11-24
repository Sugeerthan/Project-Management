import { describe, expect, it, vi } from "vitest";
import { makeHandler, RepositoryError, type Repository, type Resource } from "./core";
const id = "c90b01a8-5926-48af-bfb5-084954a5c101";
const other = "c90b01a8-5926-48af-bfb5-084954a5c102";
const context = (entryId = id) => ({ params: Promise.resolve({ id, entryId }) });
const cases: [Resource, string, unknown][] = [
  ["portfolios", "title", "Portfolio"],
  ["education", "institution", "School"],
  ["experience", "organization", "Employer"],
];
function repository(): Repository {
  return {
    list: vi.fn(async () => [{ id }]),
    create: vi.fn(async () => ({ id })),
    read: vi.fn(async (key) => (key === id ? { id } : null)),
    update: vi.fn(async (_r, key, _i, parent) =>
      key === id && (!parent || parent === id) ? { id } : null,
    ),
  };
}
function req(method: string, body?: unknown) {
  return new Request("http://localhost", {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
describe("private API contracts (mock repositories, no Supabase)", () => {
  for (const [resource, field, value] of cases) {
    for (const action of ["list", "create", "update"] as const) {
      const method = action === "list" ? "GET" : action === "create" ? "POST" : "PATCH";
      it(`${resource} ${action} requires authentication`, async () => {
        const response = await makeHandler(resource, action, { authenticate: async () => null })(
          req(method),
          context(),
        );
        expect(response.status).toBe(401);
        expect(response.headers.get("cache-control")).toContain("no-store");
      });
    }
    it(`${resource} validates writes and returns expected statuses`, async () => {
      const repo = repository();
      const create = makeHandler(resource, "create", { authenticate: async () => repo });
      const update = makeHandler(resource, "update", { authenticate: async () => repo });
      expect((await create(req("POST", { [field]: value }), context())).status).toBe(201);
      expect((await update(req("PATCH", { [field]: value }), context())).status).toBe(200);
      for (const body of [
        {},
        { [field]: 42 },
        { [field]: "x".repeat(201) },
        { [field]: value, owner_id: id },
      ])
        expect((await create(req("POST", body), context())).status).toBe(400);
      expect((await update(req("PATCH", {}), context())).status).toBe(400);
      expect((await create(req("POST", { [field]: "x".repeat(17000) }), context())).status).toBe(
        400,
      );
      expect(
        (await create(new Request("http://localhost", { method: "POST", body: "{" }), context()))
          .status,
      ).toBe(400);
    });
    it(`${resource} lists and rejects invalid identifiers`, async () => {
      const run = makeHandler(resource, "list", { authenticate: async () => repository() });
      expect((await run(req("GET"), context())).status).toBe(200);
      if (resource !== "portfolios")
        expect((await run(req("GET"), { params: Promise.resolve({ id: "bad" }) })).status).toBe(
          400,
        );
      if (resource !== "portfolios")
        expect(
          (
            await makeHandler(resource, "update", { authenticate: async () => repository() })(
              req("PATCH", { [field]: value }),
              context("bad"),
            )
          ).status,
        ).toBe(400);
    });
  }
  it("reads only records visible to the scoped repository", async () => {
    const run = makeHandler("portfolios", "read", { authenticate: async () => repository() });
    expect((await run(req("GET"), context())).status).toBe(200);
    expect((await run(req("GET"), { params: Promise.resolve({ id: other }) })).status).toBe(404);
    expect((await run(req("GET"), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
    expect(
      (
        await makeHandler("portfolios", "read", { authenticate: async () => null })(
          req("GET"),
          context(),
        )
      ).status,
    ).toBe(401);
  });
  it("maps repository failures without exposing details", async () => {
    for (const [kind, status] of [
      ["forbidden", 403],
      ["conflict", 409],
      ["unavailable", 503],
    ] as const) {
      const repo = repository();
      repo.list = async () => {
        throw new RepositoryError(kind);
      };
      expect(
        (
          await makeHandler("portfolios", "list", { authenticate: async () => repo })(
            req("GET"),
            context(),
          )
        ).status,
      ).toBe(status);
    }
    const repo = repository();
    repo.list = async () => {
      throw new Error("secret");
    };
    const response = await makeHandler("portfolios", "list", { authenticate: async () => repo })(
      req("GET"),
      context(),
    );
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret");
  });
});

describe("two-user isolation through scoped repository doubles", () => {
  const userA = "owner-a";
  const userB = "owner-b";
  const rows = [
    { id, owner: userA },
    { id: other, owner: userB },
  ];
  function scoped(owner: string): Repository {
    const visible = (key: string) => rows.some((row) => row.id === key && row.owner === owner);
    return {
      list: async (_resource, parent) =>
        parent && !visible(parent)
          ? null
          : rows.filter((row) => row.owner === owner).map(({ id }) => ({ id })),
      create: async (_resource, _input, parent) => (parent && !visible(parent) ? null : { id }),
      read: async (key) => (visible(key) ? { id: key } : null),
      update: async (_resource, key, _input, parent) =>
        visible(parent ?? key) ? { id: key } : null,
    };
  }
  for (const [owner, own, foreign] of [
    [userA, id, other],
    [userB, other, id],
  ] as const) {
    it(`${owner} cannot read or update another owner's portfolio or child`, async () => {
      const deps = { authenticate: async () => scoped(owner) };
      const parent = (key: string) => ({ params: Promise.resolve({ id: key, entryId: id }) });
      const read = makeHandler("portfolios", "read", deps);
      expect((await read(req("GET"), parent(own))).status).toBe(200);
      expect((await read(req("GET"), parent(foreign))).status).toBe(404);
      const update = makeHandler("portfolios", "update", deps);
      expect((await update(req("PATCH", { title: "Changed" }), parent(foreign))).status).toBe(404);
      for (const [resource, field] of [
        ["education", "institution"],
        ["experience", "organization"],
      ] as const) {
        expect(
          (await makeHandler(resource, "list", deps)(req("GET"), parent(foreign))).status,
        ).toBe(404);
        expect(
          (
            await makeHandler(
              resource,
              "create",
              deps,
            )(req("POST", { [field]: "Example" }), parent(foreign))
          ).status,
        ).toBe(404);
        expect(
          (
            await makeHandler(
              resource,
              "update",
              deps,
            )(req("PATCH", { [field]: "Example" }), parent(foreign))
          ).status,
        ).toBe(404);
      }
      const list = await makeHandler("portfolios", "list", deps)(req("GET"), parent(own));
      expect(await list.json()).toEqual({ data: [{ id: own }] });
    });
  }
});
