export const STATUSES = ["todo", "inProgress", "verify", "done"];

export const STATUS_LABELS = {
  todo: "To do",
  inProgress: "In progress",
  verify: "Verify",
  done: "Done",
};

const time = (value) => (value ? new Date(value).getTime() : 0);

/** Groups tasks by status. Every status key is present; each column is sorted by order, then createdAt. */
export function groupTasks(tasks) {
  const groups = {};
  STATUSES.forEach((status) => (groups[status] = []));
  (tasks || []).forEach((task) => {
    const key = groups[task.status] ? task.status : "todo";
    groups[key].push(task);
  });
  STATUSES.forEach((status) => {
    groups[status].sort((a, b) => a.order - b.order || time(a.createdAt) - time(b.createdAt));
  });
  return groups;
}

/** An order value that sorts between `prev` and `next` (either may be missing). */
export function orderBetween(prev, next) {
  const hasPrev = typeof prev === "number";
  const hasNext = typeof next === "number";
  if (hasPrev && hasNext) return (prev + next) / 2;
  if (hasPrev) return prev + 1000;
  if (hasNext) return next - 1000;
  return 0;
}

/**
 * Applies a `workspace:item` event to a list and returns a new list.
 * created/updated upsert by _id (ignoring updates older than what we have); deleted removes.
 */
export function applyItemEvent(items, event) {
  const list = items || [];
  const item = event && event.item;
  if (!item || !item._id) return list.slice();
  const id = String(item._id);
  const index = list.findIndex((existing) => String(existing._id) === id);

  if (event.action === "deleted") {
    return list.filter((existing) => String(existing._id) !== id);
  }

  if (index === -1) return [...list, item];
  const stored = list[index];
  if (stored.updatedAt && item.updatedAt && time(item.updatedAt) < time(stored.updatedAt)) {
    return list.slice();
  }
  const next = list.slice();
  next[index] = { ...stored, ...item };
  return next;
}
