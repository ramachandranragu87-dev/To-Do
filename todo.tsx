import React, { useEffect, useMemo, useState } from "react";
import "./todo.css";

type Tier = "now" | "next" | "later";

interface Task {
  id: string;
  text: string;
  tier: Tier;
  done: boolean;
  createdAt: number;
  scheduledDate: string;
  scheduledTime: string;
}

const TIER_LABELS: Record<Tier, string> = {
  now: "Now",
  next: "Next",
  later: "Later",
};

const TIER_ORDER: Tier[] = ["now", "next", "later"];

const STORAGE_KEY = "ledger-tasks-v2";

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks: Task[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // Ignore storage errors
  }
}

function getTodayString(): string {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatToday(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatTaskDate(date: string): string {
  if (!date) return "No date";

  return new Date(`${date}T00:00:00`).toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
    }
  );
}

function formatTaskTime(time: string): string {
  if (!time) return "";

  const [hours, minutes] = time.split(":").map(Number);

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getScheduleTimestamp(task: Task): number {
  if (!task.scheduledDate) return Infinity;

  const dateTime = task.scheduledTime
    ? `${task.scheduledDate}T${task.scheduledTime}`
    : `${task.scheduledDate}T23:59`;

  return new Date(dateTime).getTime();
}

function isOverdue(task: Task): boolean {
  if (task.done || !task.scheduledDate) return false;

  return getScheduleTimestamp(task) < Date.now();
}

/**
 * On a real phone (not the desktop phone-preview), make sure the
 * document itself is configured like a native app: no pinch/double
 * tap zoom, a themed status bar, and standalone-app hints for when
 * the page is added to the home screen. This only touches the
 * document <head>, so it has zero effect on desktop.
 */
function useMobileAppShell() {
  useEffect(() => {
    const isTouchMobile =
      typeof window !== "undefined" &&
      window.matchMedia?.("(hover: none) and (pointer: coarse)").matches;

    if (!isTouchMobile) return;

    const ensureMeta = (
      attr: "name" | "property",
      key: string,
      content: string
    ) => {
      let tag = document.head.querySelector<HTMLMetaElement>(
        `meta[${attr}="${key}"]`
      );

      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(attr, key);
        document.head.appendChild(tag);
      }

      tag.setAttribute("content", content);
    };

    ensureMeta(
      "name",
      "viewport",
      "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
    );
    ensureMeta("name", "theme-color", "#f4f6fa");
    ensureMeta("name", "apple-mobile-web-app-capable", "yes");
    ensureMeta(
      "name",
      "apple-mobile-web-app-status-bar-style",
      "default"
    );
    ensureMeta("name", "mobile-web-app-capable", "yes");
  }, []);
}

export default function TodoLedger() {
  useMobileAppShell();

  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());

  const [draft, setDraft] = useState("");
  const [draftTier, setDraftTier] = useState<Tier>("now");
  const [draftDate, setDraftDate] =
    useState(getTodayString());
  const [draftTime, setDraftTime] = useState("");

  const [filter, setFilter] = useState<Tier | "all">("all");

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [editingText, setEditingText] = useState("");
  const [editingDate, setEditingDate] = useState("");
  const [editingTime, setEditingTime] = useState("");

  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((task) => task.done).length;

    return {
      total,
      done,
      remaining: total - done,
      progress:
        total === 0 ? 0 : Math.round((done / total) * 100),
    };
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    let result =
      filter === "all"
        ? [...tasks]
        : tasks.filter((task) => task.tier === filter);

    result.sort((a, b) => {
      if (a.done !== b.done) {
        return Number(a.done) - Number(b.done);
      }

      return (
        getScheduleTimestamp(a) -
        getScheduleTimestamp(b)
      );
    });

    return result;
  }, [tasks, filter]);

  function addTask(e: React.FormEvent) {
    e.preventDefault();

    const text = draft.trim();

    if (!text) return;

    const newTask: Task = {
      id:
        typeof crypto !== "undefined" &&
        crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,

      text,
      tier: draftTier,
      done: false,
      createdAt: Date.now(),
      scheduledDate: draftDate,
      scheduledTime: draftTime,
    };

    setTasks((prev) => [...prev, newTask]);

    setDraft("");
    setDraftTime("");
    setShowAdd(false);
  }

  function toggleDone(id: string) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? {
              ...task,
              done: !task.done,
            }
          : task
      )
    );
  }

  function removeTask(id: string) {
    setTasks((prev) =>
      prev.filter((task) => task.id !== id)
    );
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditingText(task.text);
    setEditingDate(task.scheduledDate);
    setEditingTime(task.scheduledTime);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText("");
    setEditingDate("");
    setEditingTime("");
  }

  function commitEdit(id: string) {
    const text = editingText.trim();

    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? {
              ...task,
              text: text || task.text,
              scheduledDate: editingDate,
              scheduledTime: editingTime,
            }
          : task
      )
    );

    cancelEdit();
  }

  function changeTier(id: string, tier: Tier) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? {
              ...task,
              tier,
            }
          : task
      )
    );
  }

  function clearCompleted() {
    setTasks((prev) =>
      prev.filter((task) => !task.done)
    );
  }

  function getTierIcon(tier: Tier) {
    if (tier === "now") return "🔥";
    if (tier === "next") return "⏳";
    return "🌱";
  }

  return (
    <div className="app">

      {/* HEADER */}
      <header className="app-header">

        <div className="app-header-left">
          <div className="app-logo">
            <span />
            <span />
            <span />
          </div>

          <div>
            <h1>The Docket</h1>
            <p>{formatToday()}</p>
          </div>
        </div>

        <button
          className="profile-button"
          aria-label="Profile"
        >
          R
        </button>

      </header>

      {/* CONTENT */}
      <main className="app-content">

        {/* GREETING */}
        <section className="welcome">

          <div>
            <p className="welcome-small">
              GOOD MORNING 👋
            </p>

            <h2>
              Let's get things
              <br />
              <span>done.</span>
            </h2>
          </div>

        </section>

        {/* PROGRESS CARD */}
        <section className="progress-card">

          <div className="progress-top">

            <div>
              <span className="progress-label">
                TODAY'S PROGRESS
              </span>

              <strong>
                {stats.done} of {stats.total} completed
              </strong>
            </div>

            <div className="progress-percent">
              {stats.progress}%
            </div>

          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${stats.progress}%`,
              }}
            />
          </div>

          <div className="progress-bottom">
            <span>
              {stats.remaining} tasks remaining
            </span>

            {stats.remaining === 0 &&
              stats.total > 0 && (
                <span className="complete-message">
                  All done 🎉
                </span>
              )}
          </div>

        </section>

        {/* FILTER */}
        <section className="filter-section">

          <div className="filter-scroll">

            <button
              className={
                filter === "all"
                  ? "filter-button active"
                  : "filter-button"
              }
              onClick={() => setFilter("all")}
            >
              All
              <span>{tasks.length}</span>
            </button>

            {TIER_ORDER.map((tier) => {

              const count = tasks.filter(
                (task) => task.tier === tier
              ).length;

              return (
                <button
                  key={tier}
                  className={
                    filter === tier
                      ? `filter-button ${tier} active`
                      : `filter-button ${tier}`
                  }
                  onClick={() => setFilter(tier)}
                >
                  {getTierIcon(tier)}
                  {TIER_LABELS[tier]}
                  <span>{count}</span>
                </button>
              );
            })}

          </div>

        </section>

        {/* TASK LIST */}
        <section className="tasks-section">

          <div className="section-heading">

            <h3>
              {filter === "all"
                ? "Your tasks"
                : `${TIER_LABELS[filter]} tasks`}
            </h3>

            <span>
              {visibleTasks.length} total
            </span>

          </div>

          {visibleTasks.length === 0 ? (

            <div className="empty-state">

              <div className="empty-icon">
                ✓
              </div>

              <h3>
                No tasks here
              </h3>

              <p>
                Tap the + button to add your first task.
              </p>

            </div>

          ) : (

            <div className="task-list">

              {visibleTasks.map((task) => {

                const overdue = isOverdue(task);

                return (
                  <article
                    key={task.id}
                    className={`task-card ${
                      task.done ? "completed" : ""
                    } ${
                      overdue ? "overdue" : ""
                    }`}
                  >

                    {editingId === task.id ? (

                      <div className="edit-container">

                        <input
                          className="edit-title"
                          value={editingText}
                          autoFocus
                          onChange={(e) =>
                            setEditingText(
                              e.target.value
                            )
                          }
                        />

                        <div className="edit-fields">

                          <input
                            type="date"
                            value={editingDate}
                            onChange={(e) =>
                              setEditingDate(
                                e.target.value
                              )
                            }
                          />

                          <input
                            type="time"
                            value={editingTime}
                            onChange={(e) =>
                              setEditingTime(
                                e.target.value
                              )
                            }
                          />

                        </div>

                        <div className="edit-buttons">

                          <button
                            onClick={() =>
                              commitEdit(task.id)
                            }
                          >
                            Save
                          </button>

                          <button
                            onClick={cancelEdit}
                            className="cancel"
                          >
                            Cancel
                          </button>

                        </div>

                      </div>

                    ) : (

                      <>

                        <button
                          className={`task-check ${
                            task.done ? "checked" : ""
                          }`}
                          onClick={() =>
                            toggleDone(task.id)
                          }
                          aria-label="Complete task"
                        >
                          {task.done && "✓"}
                        </button>

                        <div className="task-info">

                          <h4>
                            {task.text}
                          </h4>

                          <div className="task-meta">

                            {task.scheduledDate && (
                              <span>
                                📅{" "}
                                {formatTaskDate(
                                  task.scheduledDate
                                )}
                              </span>
                            )}

                            {task.scheduledTime && (
                              <span>
                                •{" "}
                                {formatTaskTime(
                                  task.scheduledTime
                                )}
                              </span>
                            )}

                            {overdue && (
                              <span className="overdue-text">
                                OVERDUE
                              </span>
                            )}

                          </div>

                        </div>

                        <div className="task-actions">

                          <button
                            onClick={() =>
                              startEdit(task)
                            }
                            aria-label="Edit"
                          >
                            ✎
                          </button>

                          <button
                            onClick={() =>
                              removeTask(task.id)
                            }
                            aria-label="Delete"
                          >
                            ×
                          </button>

                        </div>

                        <select
                          className={`task-priority ${task.tier}`}
                          value={task.tier}
                          onChange={(e) =>
                            changeTier(
                              task.id,
                              e.target.value as Tier
                            )
                          }
                          aria-label="Priority"
                        >
                          {TIER_ORDER.map((tier) => (
                            <option
                              key={tier}
                              value={tier}
                            >
                              {TIER_LABELS[tier]}
                            </option>
                          ))}
                        </select>

                      </>

                    )}

                  </article>
                );
              })}

            </div>

          )}

        </section>

        {/* CLEAR COMPLETED */}
        {stats.done > 0 && (
          <button
            className="clear-button"
            onClick={clearCompleted}
          >
            Clear completed tasks
          </button>
        )}

      </main>

      {/* ADD TASK MODAL */}
      {showAdd && (
        <div
          className="modal-overlay"
          onClick={() => setShowAdd(false)}
        >

          <div
            className="add-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>
                <span>CREATE TASK</span>
                <h3>Add new task</h3>
              </div>

              <button
                onClick={() => setShowAdd(false)}
                className="close-modal"
              >
                ×
              </button>

            </div>

            <form onSubmit={addTask}>

              <label>
                Task
              </label>

              <input
                className="new-task-input"
                value={draft}
                onChange={(e) =>
                  setDraft(e.target.value)
                }
                placeholder="What needs to be done?"
                autoFocus
              />

              <label>
                Date
              </label>

              <input
                type="date"
                value={draftDate}
                onChange={(e) =>
                  setDraftDate(e.target.value)
                }
              />

              <label>
                Time
              </label>

              <input
                type="time"
                value={draftTime}
                onChange={(e) =>
                  setDraftTime(e.target.value)
                }
              />

              <label>
                Priority
              </label>

              <div className="priority-picker">

                {TIER_ORDER.map((tier) => (
                  <button
                    type="button"
                    key={tier}
                    className={
                      draftTier === tier
                        ? `priority-option ${tier} selected`
                        : `priority-option ${tier}`
                    }
                    onClick={() =>
                      setDraftTier(tier)
                    }
                  >
                    <span>
                      {getTierIcon(tier)}
                    </span>

                    {TIER_LABELS[tier]}
                  </button>
                ))}

              </div>

              <button
                type="submit"
                className="create-button"
              >
                Create Task
              </button>

            </form>

          </div>

        </div>
      )}

      {/* FLOATING ADD BUTTON */}
      <button
        className="floating-add"
        onClick={() => setShowAdd(true)}
        aria-label="Add task"
      >
        <span>+</span>
      </button>

      {/* BOTTOM NAV */}
      <nav className="bottom-nav">

        <button
          className={
            filter === "all" ? "nav-item active" : "nav-item"
          }
          onClick={() => setFilter("all")}
        >
          <span>⌂</span>
          <small>Home</small>
        </button>

        <button
          className={
            filter === "now" ? "nav-item active" : "nav-item"
          }
          onClick={() => setFilter("now")}
        >
          <span>🔥</span>
          <small>Now</small>
        </button>

        <div className="nav-add-space" />

        <button
          className={
            filter === "next" ? "nav-item active" : "nav-item"
          }
          onClick={() => setFilter("next")}
        >
          <span>⏳</span>
          <small>Next</small>
        </button>

        <button
          className={
            filter === "later"
              ? "nav-item active"
              : "nav-item"
          }
          onClick={() => setFilter("later")}
        >
          <span>🌱</span>
          <small>Later</small>
        </button>

      </nav>

    </div>
  );
}