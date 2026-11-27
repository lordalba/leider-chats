/*
 * Screenshots of the workspace UI against the seeded demo data.
 *
 *   node server/scripts/seed-demo.js        (once; writes demo.json)
 *   node client/scripts/ui-shots/shots.js [--only <prefix>]
 *
 * Flags: --only <prefix>, --as bob
 * Env: CHROME (browser binary; default Edge), APP (default http://localhost:8080/#).
 * Output: client/ui-shots-out/*.png — each line prints PAGE SCROLL / H-OVERFLOW.
 */
const fs = require("fs");
const path = require("path");
const { launch } = require("./cdp");

const CHROME =
  process.env.CHROME || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const APP = process.env.APP || "http://localhost:8080/#";
const OUT = path.join(__dirname, "..", "..", "ui-shots-out");
const demoFile = path.join(__dirname, "demo.json");
if (!fs.existsSync(demoFile)) {
  console.error("demo.json missing: run `node server/scripts/seed-demo.js` first");
  process.exit(1);
}
const demo = JSON.parse(fs.readFileSync(demoFile, "utf8"));

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : "";
// --as bob: log in as the seeded second user instead of alice.
const asBob = args.includes("--as") && args[args.indexOf("--as") + 1] === "bob";

const ws = (rest = "") => `${APP}/workspaces/${demo.workspaceId}${rest}`;

// Each scene ends on the screen to capture. Names get a "-mobile" suffix at 390px.
const scenes = [
  ["01-list", async (b) => b.nav(`${APP}/workspaces`, 2500)],
  ["02-tasks", async (b) => {
    await b.nav(ws(), 3000);
    await b.waitFor(".task-card");
  }],
  ["03-task-modal", async (b) => {
    await b.nav(ws(), 3000);
    await b.waitFor(".task-card");
    await b.click(".task-card", "Make a packing list", 1200);
  }],
  ["04-documents", async (b) => {
    await b.nav(ws(), 3000);
    await b.click("[role=tab], .tabs button", "Documents", 1200);
  }],
  ["05-document", async (b) => {
    await b.nav(ws(), 3000);
    await b.click("[role=tab], .tabs button", "Documents", 1000);
    await b.click(".item-row", "Itinerary", 2500);
  }],
  ["06-whiteboard", async (b) => {
    await b.nav(ws(), 3000);
    await b.click("[role=tab], .tabs button", "Whiteboards", 1000);
    await b.click(".item-row", "Route sketch", 2500);
  }],
  ["08-confirm-delete", async (b) => {
    await b.nav(ws(), 3000);
    await b.click("[role=tab], .tabs button", "Documents", 1000);
    await b.click(".item-row [title=Delete], .item-row [aria-label^=Delete]", null, 1000);
  }],
  ["07-chat-details", async (b) => {
    await b.nav(`${APP}/chatrooms`, 3000);
    await b.click(".friend-item", "Road trip crew", 2500);
    await b.click(".chatroom-top-bar", null, 2000);
  }],
];

async function login(b) {
  await b.nav(`${APP}/login`, 3000);
  await b.waitFor('input[type="password"]');
  await b.type('input[type="text"]', asBob ? demo.bobEmail : demo.email);
  await b.type('input[type="password"]', demo.password);
  await b.click('button[type="submit"]', null, 2500);
  await b.click(".swal2-confirm", null, 500); // pre-Task-2 login alert, if any
}

async function main() {
  const b = await launch({ chrome: CHROME, outDir: OUT });
  try {
    await b.size(1440, 900);
    await login(b);
    for (const [width, height, suffix] of [[1440, 900, ""], [390, 844, "-mobile"]]) {
      await b.size(width, height);
      for (const [name, run] of scenes) {
        const full = name + suffix;
        if (only && !full.startsWith(only)) continue;
        await run(b);
        await b.shot(full);
      }
    }
  } finally {
    if (b.errors.length) {
      console.log("console errors:\n  " + [...new Set(b.errors)].slice(0, 15).join("\n  "));
    }
    await b.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
