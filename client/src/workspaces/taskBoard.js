export const STATUSES = ["todo", "inProgress", "verify", "done"];

export const STATUS_LABELS = {
  todo: "To do",
  inProgress: "In progress",
  verify: "Verify",
  done: "Done",
};

const ORDER_STEP = 1000;

function time(value) {
  const ms = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(ms) ? 0 : ms;
}

/** Group tasks by status; each column sorted by `order`, then `createdAt`. */
export function groupTasks(tasks) {
  const grouped = {};
  STATUSES.forEach((status) => {
    grouped[status] = [];
  });
  (tasks || []).forEach((task) => {
    if (grouped[task.status]) grouped[task.status].push(task);
  });
  STATUSES.forEach((status) => {
    grouped[status].sort(
      (a, b) => a.order - b.order || time(a.createdAt) - time(b.createdAt)
    );
  });
  return grouped;
}

/** An order value between two neighbours (either may be missing). */
export function orderBetween(prev, next) {
  const hasPrev = typeof prev === "number";
  const hasNext = typeof next === "number";
  if (hasPrev && hasNext) return (prev + next) / 2;
  if (hasPrev) return prev + ORDER_STEP;
  if (hasNext) return next - ORDER_STEP;
  return 0;
}

/**
 * The order for a card dropped at `index` of a sorted column, where `index`
 * counts the column's cards excluding the dragged one.
 */
export function dropOrder(column, draggedId, index) {
  const others = column.filter((task) => task._id !== draggedId);
  const prev = others[index - 1];
  const next = others[index];
  return orderBetween(prev && prev.order, next && next.order);
}

/**
 * Apply a `workspace:item` event `{action, item}` to a list, returning a new
 * array. created/updated upsert by `_id` (an item older than the stored one,
 * by `updatedAt`, is ignored); deleted removes it.
 */
export function applyItemEvent(items, event) {
  const list = items || [];
  if (!event || !event.item || !event.item._id) return list.slice();
  const id = String(event.item._id);
  const index = list.findIndex((existing) => String(existing._id) === id);

  if (event.action === "deleted") {
    return list.filter((existing) => String(existing._id) !== id);
  }
  if (index === -1) return [...list, event.item];

  const stored = list[index];
  if (
    stored.updatedAt &&
    event.item.updatedAt &&
    time(event.item.updatedAt) < time(stored.updatedAt)
  ) {
    return list.slice();
  }
  const next = list.slice();
  next[index] = event.item;
  return next;
}

const ERROR_MESSAGES = {
  invalid: "Please check the task details",
  forbidden: "You no longer have access to this workspace",
  not_found: "This task was deleted",
  timeout: "Connection problem — try again",
};

/** Toast copy for a task socket error code. */
export function taskErrorMessage(code) {
  return ERROR_MESSAGES[code] || "Something went wrong";
}

/** ISO due date -> `<input type="date">` value (the UTC calendar day). */
export function dueDateToInput(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** `<input type="date">` value -> ISO (UTC midnight) or null. */
export function inputToDueDate(value) {
  return value ? `${value}T00:00:00.000Z` : null;
}

function localDay(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Overdue: not done and its due day is before today (local). */
export function isOverdue(task, now = new Date()) {
  if (!task || task.status === "done" || !task.dueDate) return false;
  const due = dueDateToInput(task.dueDate);
  return Boolean(due) && due < localDay(now);
}
