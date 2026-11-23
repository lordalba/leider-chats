import { validateStroke } from "../../../src/services/workspaces/strokeValidation";
import { WorkspaceError } from "../../../src/services/workspaces/WorkspaceAccess";

const valid = { id: "stroke-1", color: "#FF0000", width: 4, points: [0, 0, 0.5, 0.5, 1, 1] };

const codeOf = (input: unknown) => {
  try {
    validateStroke(input, "socket-user");
    return "ok";
  } catch (err) {
    return err instanceof WorkspaceError ? err.code : "other";
  }
};

describe("validateStroke", () => {
  it("accepts a valid stroke and normalizes colour", () => {
    const stroke = validateStroke(valid, "socket-user");
    expect(stroke.color).toBe("#ff0000");
    expect(stroke.createdAt).toBeInstanceOf(Date);
  });

  it("odd-length points → invalid", () => expect(codeOf({ ...valid, points: [0, 0, 1] })).toBe("invalid"));
  it("x = 1.2 → invalid", () => expect(codeOf({ ...valid, points: [1.2, 0] })).toBe("invalid"));
  it("4002 numbers → invalid", () =>
    expect(codeOf({ ...valid, points: new Array(4002).fill(0.5) })).toBe("invalid"));
  it("4000 numbers → ok", () => expect(codeOf({ ...valid, points: new Array(4000).fill(0.5) })).toBe("ok"));
  it('color "red" → invalid', () => expect(codeOf({ ...valid, color: "red" })).toBe("invalid"));
  it("width 0 → invalid", () => expect(codeOf({ ...valid, width: 0 })).toBe("invalid"));
  it("width 41 → invalid", () => expect(codeOf({ ...valid, width: 41 })).toBe("invalid"));
  it("bad id → invalid", () => expect(codeOf({ ...valid, id: "has space" })).toBe("invalid"));
  it("non-number point → invalid", () => expect(codeOf({ ...valid, points: ["0", 0] })).toBe("invalid"));
  it("null → invalid", () => expect(codeOf(null)).toBe("invalid"));

  it("input.userId is ignored in favour of the socket user", () => {
    expect(validateStroke({ ...valid, userId: "attacker" }, "socket-user").userId).toBe("socket-user");
  });
});
