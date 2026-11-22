import { describe, it, expect } from "vitest";
import {
  STATUSES,
  STATUS_LABELS,
  groupTasks,
  orderBetween,
  applyItemEvent,
  dropOrder,
  taskErrorMessage,
  dueDateToInput,
  inputToDueDate,
  isOverdue,
} from "../src/workspaces/taskBoard.js";

const t = (id, status, order, extra = {}) => ({
  _id: id,
  status,
  order,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...extra,
});

describe("STATUSES", () => {
  it("lists the four statuses with labels", () => {
    expect(STATUSES).toEqual(["todo", "inProgress", "verify", "done"]);
    expect(STATUSES.map((s) => STATUS_LABELS[s])).toEqual([
      "To do",
      "In progress",
      "Verify",
      "Done",
    ]);
  });
});

describe("groupTasks", () => {
  it("sorts by order within each status and returns all 4 keys even when empty", () => {
    const grouped = groupTasks([
      t("a", "todo", 2),
      t("b", "todo", 1),
      t("c", "done", 0),
    ]);
    expect(Object.keys(grouped).sort()).toEqual([...STATUSES].sort());
    expect(grouped.todo.map((x) => x._id)).toEqual(["b", "a"]);
    expect(grouped.done.map((x) => x._id)).toEqual(["c"]);
    expect(grouped.inProgress).toEqual([]);
    expect(grouped.verify).toEqual([]);
    expect(groupTasks([])).toEqual({ todo: [], inProgress: [], verify: [], done: [] });
  });

  it("breaks order ties by createdAt", () => {
    const grouped = groupTasks([
      t("late", "todo", 1, { createdAt: "2026-02-01T00:00:00.000Z" }),
      t("early", "todo", 1, { createdAt: "2026-01-01T00:00:00.000Z" }),
    ]);
    expect(grouped.todo.map((x) => x._id)).toEqual(["early", "late"]);
  });
});

describe("orderBetween", () => {
  it("orderBetween(1,2)=1.5; (5,undefined)=1005; (undefined,5)=-995; ()=0", () => {
    expect(orderBetween(1, 2)).toBe(1.5);
    expect(orderBetween(5, undefined)).toBe(1005);
    expect(orderBetween(undefined, 5)).toBe(-995);
    expect(orderBetween()).toBe(0);
  });
});

describe("applyItemEvent", () => {
  it("applyItemEvent ignores an update older than the stored updatedAt", () => {
    const items = [t("a", "todo", 1, { title: "new", updatedAt: "2026-03-02T00:00:00.000Z" })];
    const next = applyItemEvent(items, {
      action: "updated",
      item: t("a", "todo", 1, { title: "old", updatedAt: "2026-03-01T00:00:00.000Z" }),
    });
    expect(next).toEqual(items);
  });

  it("applies an update with a newer updatedAt and returns a new array", () => {
    const items = [t("a", "todo", 1, { title: "old" })];
    const next = applyItemEvent(items, {
      action: "updated",
      item: t("a", "done", 3, { title: "new", updatedAt: "2026-05-01T00:00:00.000Z" }),
    });
    expect(next).not.toBe(items);
    expect(next).toHaveLength(1);
    expect(next[0].title).toBe("new");
    expect(items[0].title).toBe("old");
  });

  it("applyItemEvent created for an existing _id does not duplicate", () => {
    const items = [t("a", "todo", 1)];
    const next = applyItemEvent(items, { action: "created", item: t("a", "todo", 1) });
    expect(next).toHaveLength(1);
    const added = applyItemEvent(next, { action: "created", item: t("b", "todo", 2) });
    expect(added.map((x) => x._id)).toEqual(["a", "b"]);
  });

  it("deleted removes the item", () => {
    const items = [t("a", "todo", 1), t("b", "todo", 2)];
    const next = applyItemEvent(items, { action: "deleted", item: { _id: "a" } });
    expect(next.map((x) => x._id)).toEqual(["b"]);
  });
});

describe("dropOrder", () => {
  const column = [t("a", "todo", 0), t("b", "todo", 1000), t("c", "todo", 2000)];

  it("computes the order between the drop neighbours excluding the dragged card", () => {
    // Drag c to the top: neighbours (none, a).
    expect(dropOrder(column, "c", 0)).toBe(-1000);
    // Drag a between b and c (index 1 among [b, c]).
    expect(dropOrder(column, "a", 1)).toBe(1500);
    // Drop a card from another column at the end.
    expect(dropOrder(column, "x", 3)).toBe(3000);
    expect(dropOrder([], "x", 0)).toBe(0);
  });
});

describe("taskErrorMessage", () => {
  it("maps error codes to toast copy", () => {
    expect(taskErrorMessage("invalid")).toBe("Please check the task details");
    expect(taskErrorMessage("forbidden")).toBe("You no longer have access to this workspace");
    expect(taskErrorMessage("not_found")).toBe("This task was deleted");
    expect(taskErrorMessage("timeout")).toBe("Connection problem — try again");
    expect(taskErrorMessage("board_full")).toBe("Something went wrong");
    expect(taskErrorMessage(undefined)).toBe("Something went wrong");
  });
});

describe("due dates", () => {
  it("round-trips a date input value through ISO", () => {
    expect(inputToDueDate("2026-11-30")).toBe("2026-11-30T00:00:00.000Z");
    expect(inputToDueDate("")).toBeNull();
    expect(dueDateToInput("2026-11-30T00:00:00.000Z")).toBe("2026-11-30");
    expect(dueDateToInput(null)).toBe("");
  });

  it("marks a task overdue only after its due day and when not done", () => {
    const now = new Date(2026, 10, 22, 12); // local 2026-11-22
    expect(isOverdue({ status: "todo", dueDate: "2026-11-21T00:00:00.000Z" }, now)).toBe(true);
    expect(isOverdue({ status: "todo", dueDate: "2026-11-22T00:00:00.000Z" }, now)).toBe(false);
    expect(isOverdue({ status: "done", dueDate: "2026-11-01T00:00:00.000Z" }, now)).toBe(false);
    expect(isOverdue({ status: "todo", dueDate: null }, now)).toBe(false);
  });
});
