const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 10000;

const DATA_DIR = path.join(__dirname, "memory-data");
const DATA_FILE = path.join(DATA_DIR, "memories.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ memories: [] }, null, 2)
  );
}

app.use(express.json({ limit: "200mb" }));

app.use(express.static(__dirname));

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { memories: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2)
  );
}

function createId() {
  return crypto.randomUUID();
}

function cleanMemory(memory) {
  return {
    id: memory.id,
    name: memory.name,
    background: memory.background || null,
    fileCount: memory.files.length
  };
}

/*
  Get all memories
*/
app.get("/api/memories", (req, res) => {
  const data = readData();

  res.json({
    memories: data.memories.map(cleanMemory)
  });
});

/*
  Create a new memory
*/
app.post("/api/memories", (req, res) => {
  const name =
    typeof req.body.name === "string"
      ? req.body.name.trim()
      : "";

  if (!name) {
    return res.status(400).json({
      error: "Memory name is required."
    });
  }

  if (name.length > 60) {
    return res.status(400).json({
      error: "Memory name is too long."
    });
  }

  const data = readData();

  const memory = {
    id: createId(),
    name,
    background: null,
    files: []
  };

  data.memories.push(memory);

  writeData(data);

  res.status(201).json({
    memory: cleanMemory(memory)
  });
});

/*
  Open one memory
*/
app.get("/api/memories/:id", (req, res) => {
  const data = readData();

  const memory = data.memories.find(
    item => item.id === req.params.id
  );

  if (!memory) {
    return res.status(404).json({
      error: "Memory not found."
    });
  }

  res.json({
    memory
  });
});

/*
  Upload a file into a memory
*/
app.post("/api/memories/:id/file", (req, res) => {
  const data = readData();

  const memory = data.memories.find(
    item => item.id === req.params.id
  );

  if (!memory) {
    return res.status(404).json({
      error: "Memory not found."
    });
  }

  const filename =
    typeof req.body.filename === "string"
      ? path.basename(req.body.filename)
      : "";

  const mimeType =
    typeof req.body.mimeType === "string"
      ? req.body.mimeType
      : "application/octet-stream";

  const fileData =
    typeof req.body.data === "string"
      ? req.body.data
      : "";

  if (!filename || !fileData) {
    return res.status(400).json({
      error: "File data is missing."
    });
  }

  const match = fileData.match(
    /^data:([^;]+);base64,(.+)$/
  );

  if (!match) {
    return res.status(400).json({
      error: "Invalid file data."
    });
  }

  const base64Data = match[2];

  let buffer;

  try {
    buffer = Buffer.from(base64Data, "base64");
  } catch {
    return res.status(400).json({
      error: "Could not read the uploaded file."
    });
  }

  const storedName =
    `${createId()}-${filename}`;

  const filePath =
    path.join(UPLOAD_DIR, storedName);

  fs.writeFileSync(filePath, buffer);

  const file = {
    id: createId(),
    name: filename,
    type: mimeType,
    url: `/uploads/${encodeURIComponent(storedName)}`
  };

  memory.files.push(file);

  writeData(data);

  res.status(201).json({
    file
  });
});

/*
  Set a memory background
*/
app.post("/api/memories/:id/background", (req, res) => {
  const data = readData();

  const memory = data.memories.find(
    item => item.id === req.params.id
  );

  if (!memory) {
    return res.status(404).json({
      error: "Memory not found."
    });
  }

  const filename =
    typeof req.body.filename === "string"
      ? path.basename(req.body.filename)
      : "background";

  const mimeType =
    typeof req.body.mimeType === "string"
      ? req.body.mimeType
      : "";

  const fileData =
    typeof req.body.data === "string"
      ? req.body.data
      : "";

  if (!mimeType.startsWith("image/")) {
    return res.status(400).json({
      error: "Background must be an image."
    });
  }

  const match = fileData.match(
    /^data:([^;]+);base64,(.+)$/
  );

  if (!match) {
    return res.status(400).json({
      error: "Invalid background data."
    });
  }

  const buffer = Buffer.from(
    match[2],
    "base64"
  );

  const storedName =
    `${createId()}-${filename}`;

  const filePath =
    path.join(UPLOAD_DIR, storedName);

  fs.writeFileSync(filePath, buffer);

  memory.background =
    `/uploads/${encodeURIComponent(storedName)}`;

  writeData(data);

  res.status(201).json({
    background: memory.background
  });
});

/*
  Serve uploaded files
*/
app.use(
  "/uploads",
  express.static(UPLOAD_DIR)
);

/*
  Send interface.html when the website is opened
*/
app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "interface.html")
  );
});

/*
  Start server
*/
app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Memories server running on port ${PORT}`
  );
});
