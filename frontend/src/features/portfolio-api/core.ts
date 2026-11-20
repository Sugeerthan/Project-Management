import { z } from "zod";

// These are provisional API fields, not approved database columns.
const schemas = {
  portfolios: z.object({ title: z.string().trim().min(1).max(200) }).strict(),
  education: z.object({ institution: z.string().trim().min(1).max(200) }).strict(),
  experience: z.object({ organization: z.string().trim().min(1).max(200) }).strict(),
};
export type Resource = keyof typeof schemas;
export type Input = { title: string } | { institution: string } | { organization: string };
export type RecordData = { id: string } & Record<string, unknown>;
export interface Repository {
  list(resource: Resource, parentId?: string): Promise<RecordData[] | null>;
  create(resource: Resource, input: Input, parentId?: string): Promise<RecordData | null>;
  read(id: string): Promise<RecordData | null>;
  update(
    resource: Resource,
    id: string,
    input: Partial<Input>,
    parentId?: string,
  ): Promise<RecordData | null>;
}
export class RepositoryError extends Error {
  constructor(public kind: "forbidden" | "conflict" | "unavailable") {
    super(kind);
  }
}
type Context = { params: Promise<{ id?: string; entryId?: string }> };
type Dependencies = { authenticate: () => Promise<Repository | null> };
const uuid = z.string().uuid();
const MAX_BODY = 16384;
function response(status: number, body: unknown) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" },
  });
}
async function readBody(request: Request): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY)) throw new SyntaxError();
  if (!request.body) throw new SyntaxError();
  const reader = request.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel();
        throw new SyntaxError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
export function makeHandler(
  resource: Resource,
  action: "list" | "create" | "read" | "update",
  deps: Dependencies,
) {
  return async (request: Request, context: Context) => {
    try {
      const repo = await deps.authenticate();
      if (!repo) return response(401, { error: { code: "unauthenticated" } });
      const { id, entryId } = await context.params;
      if (
        (resource !== "portfolios" || action === "read" || action === "update") &&
        !uuid.safeParse(id).success
      )
        return response(400, { error: { code: "invalid_request" } });
      if (resource !== "portfolios" && action === "update" && !uuid.safeParse(entryId).success)
        return response(400, { error: { code: "invalid_request" } });
      let input: Input | undefined;
      if (action === "create" || action === "update") {
        let body: unknown;
        try {
          body = await readBody(request);
        } catch {
          return response(400, { error: { code: "invalid_request" } });
        }
        const schema = action === "update" ? schemas[resource].partial() : schemas[resource];
        const parsed = schema.safeParse(body);
        if (!parsed.success || (action === "update" && Object.keys(parsed.data).length === 0))
          return response(400, { error: { code: "invalid_request" } });
        input = parsed.data as Input;
      }
      let result: RecordData | RecordData[] | null;
      if (action === "list") result = await repo.list(resource, id);
      else if (action === "create") result = await repo.create(resource, input!, id);
      else if (action === "read") result = await repo.read(id!);
      else
        result = await repo.update(
          resource,
          resource === "portfolios" ? id! : entryId!,
          input!,
          resource === "portfolios" ? undefined : id,
        );
      if (result === null) return response(404, { error: { code: "not_found" } });
      return response(action === "create" ? 201 : 200, { data: result });
    } catch (error) {
      const kind = error instanceof RepositoryError ? error.kind : "internal_error";
      const status =
        kind === "forbidden" ? 403 : kind === "conflict" ? 409 : kind === "unavailable" ? 503 : 500;
      return response(status, { error: { code: kind } });
    }
  };
}
