import { WorkspaceError } from "../../src/services/workspaces/WorkspaceAccess";
import { withAck } from "../../src/socketHandlers/workspaces/withAck";
import { connectAs, emitAck, startTestServer, delay } from "../helpers/socketHarness";

describe("socket auth and withAck", () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  beforeAll(async () => {
    server = await startTestServer((_io, socket) => {
      socket.on("echo", withAck(socket, async (userId) => userId));
      socket.on("forbidden", withAck(socket, async () => {
        throw new WorkspaceError("forbidden");
      }));
      socket.on("boom", withAck(socket, async () => {
        throw new TypeError("unexpected");
      }));
    });
  });
  afterAll(() => server.close());

  it("valid token sets socket.data.userId", async () => {
    const client = await connectAs(server.url, "user-1");
    expect(await emitAck(client, "echo")).toEqual({ ok: true, data: "user-1" });
  });

  it("no token → unauthenticated", async () => {
    const client = await connectAs(server.url, null);
    expect(await emitAck(client, "echo")).toEqual({ ok: false, error: "unauthenticated" });
  });

  it('WorkspaceError("forbidden") → forbidden', async () => {
    const client = await connectAs(server.url, "user-1");
    expect(await emitAck(client, "forbidden")).toEqual({ ok: false, error: "forbidden" });
  });

  it("thrown TypeError → server_error", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const client = await connectAs(server.url, "user-1");
    expect(await emitAck(client, "boom")).toEqual({ ok: false, error: "server_error" });
    spy.mockRestore();
  });

  it("missing ack callback does not throw", async () => {
    const client = await connectAs(server.url, "user-1");
    client.emit("forbidden");
    await delay(100);
    // Still connected and responsive.
    expect(await emitAck(client, "echo")).toEqual({ ok: true, data: "user-1" });
  });
});
