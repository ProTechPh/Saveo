// Minimal DOM shim: proves untrusted media text is escaped before innerHTML.
const fs = require("fs");
const vm = require("vm");

const code = fs.readFileSync(process.argv[2], "utf8");
const makeCard = () => ({
  className: "",
  id: "",
  _html: "",
  set innerHTML(value) { this._html = value; },
  get innerHTML() { return this._html; },
  querySelector: () => null,
  appendChild: () => {},
});

const context = {
  document: { createElement: () => makeCard() },
  console,
  setTimeout: () => {},
};
vm.createContext(context);
vm.runInContext(`${code}\nglobalThis.__Components = Components;`, context);
const Components = context.__Components;

const evil = '<img src=x onerror="window.__pwned=1">';
const task = {
  id: "task-1",
  title: evil,
  platform: evil,
  thumbnail: 'https://example.com/t.jpg" onerror="window.__pwned=1',
  status: "downloading",
  percent: 12.5,
  format_label: evil,
  error_friendly: evil,
  speed_str: evil,
  downloaded_str: "1 MB",
  total_str: "2 MB",
  eta_str: "00:01",
};

const failures = [];
const html = Components.renderQueueItem(task).innerHTML;
if (!html.includes("&lt;img src=x")) failures.push("queue title was not escaped");
if (html.includes('onerror="window.__pwned')) failures.push("inline handler injected in queue card");
if (html.includes("<img src=x")) failures.push("raw tag from title rendered in queue card");

// showToast must treat the message as text, never as markup.
const appended = [];
const toastEl = { innerHTML: "", appendChild: (el) => appended.push(el) };
const toastText = { textContent: "" };
context.document.getElementById = () => ({ appendChild: (el) => appended.push(el) });
context.document.createElement = (tag) => (tag === "span" ? toastText : toastEl);
Components.showToast(evil, "info", 0);
if (toastEl.innerHTML.includes("onerror")) failures.push("toast rendered markup");
if (toastText.textContent !== evil) failures.push("toast message was not assigned as text");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("XSS escaping checks passed");
