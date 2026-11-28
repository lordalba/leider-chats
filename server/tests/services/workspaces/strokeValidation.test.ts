import { validateStroke } from "../../../src/services/workspaces/strokeValidation";

const U = "64b0000000000000000000aa";
const base = () => ({ id: "s-1", color: "#A1b2C3", width: 4, points: [0, 0, 0.5, 0.5, 1, 1] });
const invalid = (input: unknown) =>
  expect(() => validateStroke(input, U)).toThrow(expect.objectContaining({ code: "invalid" }));

describe("validateStroke", () => {
  test("accepts a valid stroke and stamps the socket user and createdAt", () => {
    const s = validateStroke(base(), U);
    expect(s).toMatchObject({ id: "s-1", userId: U, color: "#A1b2C3", width: 4, points: [0, 0, 0.5, 0.5, 1, 1] });
    expect(s.createdAt).toBeInstanceOf(Date);
  });
  test("odd-length points → invalid", () => invalid({ ...base(), points: [0, 0, 1] }));
  test("x = 1.2 → invalid", () => invalid({ ...base(), points: [1.2, 0, 0, 0] }));
  test("negative and non-finite coordinates → invalid", () => {
    invalid({ ...base(), points: [-0.1, 0, 0, 0] });
    invalid({ ...base(), points: [NaN, 0, 0, 0] });
    invalid({ ...base(), points: ["0", 0, 0, 0] });
  });
  test("4002 numbers → invalid; 4000 ok; fewer than 2 → invalid", () => {
    invalid({ ...base(), points: new Array(4002).fill(0.5) });
    expect(validateStroke({ ...base(), points: new Array(4000).fill(0.5) }, U).points).toHaveLength(4000);
    invalid({ ...base(), points: [] });
    invalid({ ...base(), points: "0,0" });
  });
  test('color "red" → invalid', () => {
    invalid({ ...base(), color: "red" });
    invalid({ ...base(), color: "#12345" });
  });
  test("width 0 → invalid; 41 → invalid; 1 and 40 ok", () => {
    invalid({ ...base(), width: 0 });
    invalid({ ...base(), width: 41 });
    invalid({ ...base(), width: "4" });
    expect(validateStroke({ ...base(), width: 1 }, U).width).toBe(1);
    expect(validateStroke({ ...base(), width: 40 }, U).width).toBe(40);
  });
  test("id must be 1–64 chars of [A-Za-z0-9-]", () => {
    invalid({ ...base(), id: "" });
    invalid({ ...base(), id: "a".repeat(65) });
    invalid({ ...base(), id: "a b" });
    invalid({ ...base(), id: { $ne: 1 } });
    expect(validateStroke({ ...base(), id: "a".repeat(64) }, U).id).toHaveLength(64);
  });
  test("input.userId is ignored in favour of the socket user", () => {
    expect(validateStroke({ ...base(), userId: "someone-else" }, U).userId).toBe(U);
  });
  test("non-object input → invalid", () => {
    invalid(null);
    invalid("stroke");
    invalid([1, 2]);
  });
});
