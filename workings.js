const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "memories");
const MEMORY_FILE = path.join(DATA_DIR, "memories.json");

app.use(express.json({ limit: "500mb" }));

app.use(express.static(__dirname));

if (!fs.existsSync(DATA_DIR)) {
fs.mkdirSync(DATA_DIR, { recursive: true });
}

let memories = {};

function loadMemories() {
try {
if (fs.existsSync(MEMORY_FILE)) {
const data = fs.readFileSync(MEMORY_FILE, "utf8");
memories = JSON.parse(data) || {};
}
} catch (error) {
console.error("Could not load memories:", error);
memories = {};
}
}

function saveMemories() {
fs.writeFileSync(
MEMORY_FILE,
JSON.stringify(memories, null, 2),
"utf8"
);
}

function cleanName(name) {
return String(name || "")
.trim()
.replace(/[<>]/g, "")
.slice(0, 60);
}

function createId() {
return (
Date.now().toString(36) +
"-" +
Math.random().toString(36).slice(2, 10)
);
}

function getFileExtension(filename) {
return path.extname(filename || "").toLowerCase();
}

function allowedFileType(mimeType, filename) {
const mime = String(mimeType || "").toLowerCase();
const ext = getFileExtension(filename);

const allowedMimeTypes = [
"image/png",
"image/jpeg",
"image/gif",
"image/webp",
"image/svg+xml",
  "audio/mpeg",
"audio/mp3",
"audio/wav",
"audio/ogg",
"audio/webm",

"video/mp4",
"video/webm",
"video/ogg",

"text/plain",
"application/pdf",
"application/zip",
"application/json"
```

];

const allowedExtensions = [
".png",
".jpg",
".jpeg",
".gif",
".webp",
".svg",

```
".mp3",
".wav",
".ogg",
".m4a",

".mp4",
".webm",
".mov",
".avi",

".txt",
".pdf",
".zip",
".json",

".html",
".css",
".js"
```

];

return (
allowedMimeTypes.includes(mime) ||
allowedExtensions.includes(ext)
);
}

function dataUrlToBuffer(dataUrl) {
const match = String(dataUrl || "").match(
/^data:([^;]+);base64,(.+)$/
);

if (!match) {
return null;
}

return {
mimeType: match[1],
buffer: Buffer.from(match[2], "base64")
};
}

loadMemories();

app.get("/", (req, res) => {
res.sendFile(
path.join(__dirname, "interface.html")
);
});

app.get("/api/memories", (req, res) => {
const list = Object.values(memories).map(memory => ({
id: memory.id,
name: memory.name,
fileCount: memory.files.length,
background: memory.background || null,
createdAt: memory.createdAt
}));

list.sort(
(a, b) =>
new Date(a.createdAt) -
new Date(b.createdAt)
);

res.json({
memories: list
});
});

app.post("/api/memories", (req, res) => {
const name = cleanName(req.body?.name);

if (!name) {
return res.status(400).json({
error: "A memory name is required."
});
}

const id = createId();

const memory = {
id,
name,
createdAt: new Date().toISOString(),
background: null,
files: []
};

memories[id] = memory;

saveMemories();

res.json({
success: true,
memory
});
});

app.get("/api/memories/:id", (req, res) => {
const memory = memories[req.params.id];

if (!memory) {
return res.status(404).json({
error: "Memory not found."
});
}

res.json({
memory
});
});

app.post(
"/api/memories/:id/file",
(req, res) => {
const memory = memories[req.params.id];

```
if (!memory) {
  return res.status(404).json({
    error: "Memory not found."
  });
}

const filename = String(
  req.body?.filename || "file"
)
  .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
  .slice(0, 150);

const mimeType = String(
  req.body?.mimeType || "application/octet-stream"
);

const data = req.body?.data;

if (!data) {
  return res.status(400).json({
    error: "No file data was provided."
  });
}

if (!allowedFileType(mimeType, filename)) {
  return res.status(400).json({
    error: "That file type is not supported."
  });
}

const parsed = dataUrlToBuffer(data);

if (!parsed) {
  return res.status(400).json({
    error: "Invalid file data."
  });
}

const fileId = createId();

const extension =
  getFileExtension(filename) || ".bin";

const storedName =
  fileId + extension;

const filePath =
  path.join(DATA_DIR, storedName);

fs.writeFileSync(
  filePath,
  parsed.buffer
);

const file = {
  id: fileId,
  name: filename,
  type: mimeType,
  url: `/memory-files/${encodeURIComponent(storedName)}`,
  uploadedAt: new Date().toISOString()
};

memory.files.push(file);

saveMemories();

res.json({
  success: true,
  file
});
```

}
);

app.post(
"/api/memories/:id/background",
(req, res) => {
const memory = memories[req.params.id];

```
if (!memory) {
  return res.status(404).json({
    error: "Memory not found."
  });
}

const mimeType = String(
  req.body?.mimeType || ""
);

if (!mimeType.startsWith("image/")) {
  return res.status(400).json({
    error: "The background must be an image."
  });
}

const data = req.body?.data;

if (!data) {
  return res.status(400).json({
    error: "No background image was provided."
  });
}

const parsed = dataUrlToBuffer(data);

if (!parsed) {
  return res.status(400).json({
    error: "Invalid background image."
  });
}

const backgroundId = createId();

let extension = ".png";

if (mimeType === "image/jpeg") {
  extension = ".jpg";
} else if (mimeType === "image/gif") {
  extension = ".gif";
} else if (mimeType === "image/webp") {
  extension = ".webp";
}

const storedName =
  "background-" +
  backgroundId +
  extension;

const filePath =
  path.join(DATA_DIR, storedName);

fs.writeFileSync(
  filePath,
  parsed.buffer
);

memory.background =
  `/memory-files/${encodeURIComponent(storedName)}`;

saveMemories();

res.json({
  success: true,
  background: memory.background
});

}
);

app.use(
"/memory-files",
express.static(DATA_DIR)
);

app.use((error, req, res, next) => {
console.error(error);

if (error.type === "entity.too.large") {
return res.status(413).json({
error: "That file is too large."
});
}

res.status(500).json({
error: "Something went wrong."
});
});

app.listen(PORT, () => {
console.log("");
console.log("==============================");
console.log("        MEMORIES ONLINE");
console.log("==============================");
console.log("");
console.log(`Port: ${PORT}`);
console.log(`Memory storage: ${DATA_DIR}`);
console.log(`Database: ${MEMORY_FILE}`);
console.log("");
});
