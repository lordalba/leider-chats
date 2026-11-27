// Minimal Chrome DevTools Protocol driver with no npm dependencies (Node 22+:
// global fetch and WebSocket). Drives Chromium or Edge in headless mode.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch({ chrome, outDir, port = 9333 + Math.floor(Math.random() * 500) }) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ui-shots-"));
  const proc = spawn(
    chrome,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let target;
  for (let i = 0; i < 75 && !target; i++) {
    await sleep(200);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === "page");
    } catch {
      // not up yet
    }
  }
  if (!target) {
    proc.kill();
    throw new Error(`browser did not start: ${chrome}`);
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let nextId = 0;
  const pending = new Map();
  const errors = [];
  const listeners = {}; // CDP event method -> [fn]
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (listeners[msg.method]) {
      listeners[msg.method].forEach((fn) => fn(msg.params));
    } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      errors.push(msg.params.args.map((a) => a.value || a.description).join(" ").split("\n")[0]);
    } else if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      errors.push("EXCEPTION " + ((d.exception && d.exception.description) || d.text).split("\n")[0]);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  await send("Page.enable");
  await send("Runtime.enable");
  fs.mkdirSync(outDir, { recursive: true });

  const b = {
    send,
    sleep,
    // Subscribe to a CDP event, e.g. on("Fetch.requestPaused", fn).
    on(method, fn) {
      (listeners[method] = listeners[method] || []).push(fn);
    },
    // Hold matching requests for `ms` before letting them through.
    async slowRequests(urlPattern, ms) {
      b.on("Fetch.requestPaused", ({ requestId }) =>
        setTimeout(() => send("Fetch.continueRequest", { requestId }).catch(() => {}), ms)
      );
      await send("Fetch.enable", { patterns: [{ urlPattern }] });
    },
    errors,
    width: 1440,
    async size(width, height) {
      b.width = width;
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 768,
      });
    },
    async nav(url, wait = 2000) {
      await send("Page.navigate", { url });
      await sleep(wait);
    },
    async eval(expression) {
      const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) {
        const e = r.exceptionDetails;
        throw new Error("eval: " + ((e.exception && e.exception.description) || e.text));
      }
      return r.result.value;
    },
    // Wait until a selector matches (optionally containing text).
    async waitFor(sel, text, timeout = 8000) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const found = await b.eval(`[...document.querySelectorAll(${JSON.stringify(sel)})]
          .some(e => ${text ? `e.textContent.includes(${JSON.stringify(text)})` : "true"})`);
        if (found) return true;
        await sleep(150);
      }
      return false;
    },
    // Click the first element matching `sel` (and containing `text`, if given).
    async click(sel, text, wait = 600) {
      const ok = await b.eval(`(() => {
        const els = [...document.querySelectorAll(${JSON.stringify(sel)})];
        const el = ${text ? `els.find(e => e.textContent.trim().includes(${JSON.stringify(text)}))` : "els[0]"};
        if (!el) return false;
        el.scrollIntoView({ block: "center" });
        el.click();
        return true;
      })()`);
      if (!ok) console.log(`  ! no element: ${sel}${text ? ` "${text}"` : ""}`);
      await sleep(wait);
      return ok;
    },
    async type(sel, value) {
      await b.eval(`(() => {
        const el = document.querySelector(${JSON.stringify(sel)});
        el.focus();
        el.value = ${JSON.stringify(value)};
        el.dispatchEvent(new Event("input", { bubbles: true }));
      })()`);
    },
    // Real key press through the input pipeline (Tab, Enter, Escape, ArrowRight…).
    async key(key, modifiers = 0) {
      const codes = { Tab: 9, Enter: 13, Escape: 27, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
      const base = { key, code: key, windowsVirtualKeyCode: codes[key] || key.toUpperCase().charCodeAt(0), modifiers };
      await send("Input.dispatchKeyEvent", { type: "keyDown", ...base, ...(key === "Enter" && { text: "\r" }) });
      await send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
      await sleep(150);
    },
    // { page: the page itself scrolls?, wide: horizontal overflow? }
    // The app shell scrolls inside `.main-content` (#app is overflow:hidden),
    // so a scrollable `.main-content` counts as page scroll.
    async overflow() {
      return b.eval(`(() => {
        const scrollers = [document.scrollingElement, document.querySelector(".main-content")].filter(Boolean);
        return {
          page: scrollers.some(el => el.scrollHeight > el.clientHeight + 1),
          wide: scrollers.some(el => el.scrollWidth > el.clientWidth + 1),
        };
      })()`);
    },
    async shot(name) {
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      const file = path.join(outDir, name + ".png");
      fs.writeFileSync(file, Buffer.from(data, "base64"));
      const o = await b.overflow();
      console.log(`${file}  PAGE SCROLL: ${o.page ? "yes" : "no"}  H-OVERFLOW: ${o.wide ? "yes" : "no"}`);
      return file;
    },
    async close() {
      ws.close();
      proc.kill();
      await sleep(300);
      try {
        // The browser can hold files a moment after exit on Windows.
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
      } catch {
        // a leftover temp profile is harmless
      }
    },
  };
  return b;
}

module.exports = { launch, sleep };
