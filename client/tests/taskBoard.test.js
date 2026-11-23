import { describe, expect, it } from "vitest";
import { STATUSES, applyItemEvent, groupTasks, orderBetween } from "../src/workspaces/taskBoard.js";

describe("taskBoard", () => {
  it("groupTasks sorts by order within each status and returns all 4 keys even when empty", () => {
    const groups = groupTasks([
      { _id: "1", status: "todo", order: 2 },
      { _id: "2", status: "todo", order: 1 },
      { _id: "3", status: "done", order: 0 },
      { _id: "4", status: "todo", order: 1, createdAt: "2026-01-02" },
    ]);
    expect(Object.keys(groups)).toEqual(STATUSES);
    expect(groups.todo.map((t) => t._id)).toEqual(["2", "4", "1"]);
    expect(groups.inProgress).toEqual([]);
    expect(groups.verify).toEqual([]);
    expect(groups.done.map((t) => t._id)).toEqual(["3"]);
    expect(Object.keys(groupTasks([]))).toEqual(STATUSES);
  });

  it("orderBetween(1,2)=1.5; (5,undefined)=1005; (undefined,5)=-995; ()=0", () => {
    expect(orderBetween(1, 2)).toBe(1.5);
    expect(orderBetween(5, undefined)).toBe(1005);
    expect(orderBetween(undefined, 5)).toBe(-995);
    expect(orderBetween()).toBe(0);
  });

  it("applyItemEvent ignores an update older than the stored updatedAt", () => {
    const items = [{ _id: "1", title: "new", updatedAt: "2026-01-02T00:00:00Z" }];
    const result = applyItemEvent(items, {
      action: "updated",
      item: { _id: "1", title: "old", updatedAt: "2026-01-01T00:00:00Z" },
    });
    expect(result[0].title).toBe("new");
  });

  it("applyItemEvent applies a newer update", () => {
    const items = [{ _id: "1", title: "old", updatedAt: "2026-01-01T00:00:00Z" }];
    const result = applyItemEvent(items, {
      action: "updated",
      item: { _id: "1", title: "new", updatedAt: "2026-01-02T00:00:00Z" },
    });
    expect(result[0].title).toBe("new");
    expect(result).not.toBe(items);
  });

  it("applyItemEvent created for an existing _id does not duplicate", () => {
    const items = [{ _id: "1", title: "a" }];
    expect(applyItemEvent(items, { action: "created", item: { _id: "1", title: "a" } })).toHaveLength(1);
    expect(applyItemEvent(items, { action: "created", item: { _id: "2", title: "b" } })).toHaveLength(2);
  });

  it("deleted removes the item", () => {
    const items = [{ _id: "1" }, { _id: "2" }];
    expect(applyItemEvent(items, { action: "deleted", item: { _id: "1" } })).toEqual([{ _id: "2" }]);
  });
});
