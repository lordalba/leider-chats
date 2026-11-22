import { Socket as ClientSocket } from "socket.io-client";
import { startTestServer, connectAs } from "../helpers/socketHarness";
import { withAck } from "../../src/socketHandlers/workspaces/withAck";
import { WorkspaceError } from "../../src/services/workspaces/WorkspaceAccess";

let server: Awaited<ReturnType<typeof startTestServer>>;
const clients: ClientSocket[] = [];

beforeAll(async () => {
  server = await startTestServer((_io, socket) => {
    socket.on("whoami", withAck(socket, async (userId: string) => userId));
    socket.on(
      "forbid",
      withAck(socket, async () => {
        throw new WorkspaceError("forbidden");
      })
    );
    socket.on(
      "boom",
      withAck(socket, async () => {
        (null as any).x.y;
      })
    );
    socket.on("noack", withAck(socket, async () => "x"));
  });
});

afterEach(() => {
  clients.splice(0).forEach((c) => c.close());
});

afterAll(async () => {
  await server.close();
});

async function connect(id: string | null) {
  const c = await connectAs(server.url, id);
  clients.push(c);
  return c;
}

test("valid token sets socket.data.userId", async () => {
  const c = await connect("user123");
  const res = await c.emitWithAck("whoami");
  expect(res).toEqual({ ok: true, data: "user123" });
});

test("no token -> unauthenticated", async () => {
  const c = await connect(null);
  const res = await c.emitWithAck("whoami");
  expect(res).toEqual({ ok: false, error: "unauthenticated" });
});

test("WorkspaceError forbidden -> forbidden", async () => {
  const c = await connect("u1");
  expect(await c.emitWithAck("forbid")).toEqual({ ok: false, error: "forbidden" });
});

test("thrown TypeError -> server_error", async () => {
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  const c = await connect("u1");
  expect(await c.emitWithAck("boom")).toEqual({ ok: false, error: "server_error" });
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});

test("missing ack callback does not throw", async () => {
  const c = await connect("u1");
  c.emit("noack");
  const res = await c.emitWithAck("whoami");
  expect(res.ok).toBe(true);
});
