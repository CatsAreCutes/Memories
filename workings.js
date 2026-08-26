const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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

function readData() {
    try {
        return JSON.parse(
            fs.readFileSync(DATA_FILE, "utf8")
        );
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

function sendJSON(res, status, data) {
    const output = JSON.stringify(data);

    res.writeHead(status, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(output)
    });

    res.end(output);
}

function sendHTML(res) {
    const file = path.join(
        __dirname,
        "interface.html"
    );

    if (!fs.existsSync(file)) {
        sendJSON(res, 500, {
            error: "interface.html was not found."
        });
        return;
    }

    const html = fs.readFileSync(file);

    res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": html.length
    });

    res.end(html);
}

function sendFile(res, filePath) {
    if (!fs.existsSync(filePath)) {
        sendJSON(res, 404, {
            error: "File not found."
        });
        return;
    }

    const ext = path.extname(filePath).toLowerCase();

    const types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".pdf": "application/pdf",
        ".txt": "text/plain"
    };

    const contentType =
        types[ext] ||
        "application/octet-stream";

    const file = fs.readFileSync(filePath);

    res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": file.length
    });

    res.end(file);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk;

            if (body.length > 250 * 1024 * 1024) {
                reject(
                    new Error("Request is too large.")
                );

                req.destroy();
            }
        });

        req.on("end", () => {
            try {
                resolve(
                    body ? JSON.parse(body) : {}
                );
            } catch {
                reject(
                    new Error("Invalid JSON.")
                );
            }
        });

        req.on("error", reject);
    });
}

function findMemory(id) {
    const data = readData();

    return data.memories.find(
        memory => memory.id === id
    );
}

const server = http.createServer(
    async (req, res) => {

        try {

            const url = new URL(
                req.url,
                `http://${req.headers.host || "localhost"}`
            );

            const pathname = url.pathname;


            // -----------------------------
            // WEBSITE
            // -----------------------------

            if (
                pathname === "/" ||
                pathname === "/interface.html"
            ) {
                sendHTML(res);
                return;
            }


            // -----------------------------
            // UPLOADED FILES
            // -----------------------------

            if (
                pathname.startsWith("/uploads/")
            ) {
                const encodedName =
                    pathname.slice("/uploads/".length);

                const filename =
                    decodeURIComponent(encodedName);

                const safeName =
                    path.basename(filename);

                const filePath =
                    path.join(
                        UPLOAD_DIR,
                        safeName
                    );

                sendFile(res, filePath);
                return;
            }


            // -----------------------------
            // GET MEMORIES
            // -----------------------------

            if (
                pathname === "/api/memories" &&
                req.method === "GET"
            ) {

                const data = readData();

                const memories =
                    data.memories.map(memory => ({
                        id: memory.id,
                        name: memory.name,
                        background:
                            memory.background || null,
                        fileCount:
                            memory.files.length
                    }));

                sendJSON(res, 200, {
                    memories
                });

                return;
            }


            // -----------------------------
            // CREATE MEMORY
            // -----------------------------

            if (
                pathname === "/api/memories" &&
                req.method === "POST"
            ) {

                const body =
                    await readBody(req);

                const name =
                    typeof body.name === "string"
                        ? body.name.trim()
                        : "";

                if (!name) {
                    sendJSON(res, 400, {
                        error:
                            "Memory name is required."
                    });

                    return;
                }

                if (name.length > 60) {
                    sendJSON(res, 400, {
                        error:
                            "Memory name is too long."
                    });

                    return;
                }

                const data = readData();

                const memory = {
                    id: createId(),
                    name,
                    background: null,
                    files: [],
                    createdAt:
                        new Date().toISOString()
                };

                data.memories.push(memory);

                writeData(data);

                sendJSON(res, 201, {
                    memory: {
                        id: memory.id,
                        name: memory.name,
                        background: null,
                        fileCount: 0
                    }
                });

                return;
            }


            // -----------------------------
            // OPEN MEMORY
            // -----------------------------

            const memoryMatch =
                pathname.match(
                    /^\/api\/memories\/([^/]+)$/
                );

            if (
                memoryMatch &&
                req.method === "GET"
            ) {

                const id =
                    decodeURIComponent(
                        memoryMatch[1]
                    );

                const memory =
                    findMemory(id);

                if (!memory) {
                    sendJSON(res, 404, {
                        error:
                            "Memory not found."
                    });

                    return;
                }

                sendJSON(res, 200, {
                    memory
                });

                return;
            }


            // -----------------------------
            // UPLOAD FILE
            // -----------------------------

            const fileMatch =
                pathname.match(
                    /^\/api\/memories\/([^/]+)\/file$/
                );

            if (
                fileMatch &&
                req.method === "POST"
            ) {

                const id =
                    decodeURIComponent(
                        fileMatch[1]
                    );

                const body =
                    await readBody(req);

                const data = readData();

                const memory =
                    data.memories.find(
                        item => item.id === id
                    );

                if (!memory) {
                    sendJSON(res, 404, {
                        error:
                            "Memory not found."
                    });

                    return;
                }

                const filename =
                    typeof body.filename === "string"
                        ? path.basename(body.filename)
                        : "";

                const mimeType =
                    typeof body.mimeType === "string"
                        ? body.mimeType
                        : "application/octet-stream";

                const fileData =
                    typeof body.data === "string"
                        ? body.data
                        : "";

                if (!filename || !fileData) {
                    sendJSON(res, 400, {
                        error:
                            "File data is missing."
                    });

                    return;
                }

                const match =
                    fileData.match(
                        /^data:([^;]+);base64,(.+)$/
                    );

                if (!match) {
                    sendJSON(res, 400, {
                        error:
                            "Invalid file data."
                    });

                    return;
                }

                const buffer =
                    Buffer.from(
                        match[2],
                        "base64"
                    );

                const storedName =
                    `${createId()}-${filename}`;

                const filePath =
                    path.join(
                        UPLOAD_DIR,
                        storedName
                    );

                fs.writeFileSync(
                    filePath,
                    buffer
                );

                const file = {
                    id: createId(),
                    name: filename,
                    type: mimeType,
                    url:
                        `/uploads/${encodeURIComponent(
                            storedName
                        )}`
                };

                memory.files.push(file);

                writeData(data);

                sendJSON(res, 201, {
                    file
                });

                return;
            }


            // -----------------------------
            // SET BACKGROUND
            // -----------------------------

            const backgroundMatch =
                pathname.match(
                    /^\/api\/memories\/([^/]+)\/background$/
                );

            if (
                backgroundMatch &&
                req.method === "POST"
            ) {

                const id =
                    decodeURIComponent(
                        backgroundMatch[1]
                    );

                const body =
                    await readBody(req);

                const data = readData();

                const memory =
                    data.memories.find(
                        item => item.id === id
                    );

                if (!memory) {
                    sendJSON(res, 404, {
                        error:
                            "Memory not found."
                    });

                    return;
                }

                const filename =
                    typeof body.filename === "string"
                        ? path.basename(body.filename)
                        : "background";

                const mimeType =
                    typeof body.mimeType === "string"
                        ? body.mimeType
                        : "";

                const fileData =
                    typeof body.data === "string"
                        ? body.data
                        : "";

                if (
                    !mimeType.startsWith("image/")
                ) {
                    sendJSON(res, 400, {
                        error:
                            "Background must be an image."
                    });

                    return;
                }

                const match =
                    fileData.match(
                        /^data:([^;]+);base64,(.+)$/
                    );

                if (!match) {
                    sendJSON(res, 400, {
                        error:
                            "Invalid background data."
                    });

                    return;
                }

                const buffer =
                    Buffer.from(
                        match[2],
                        "base64"
                    );

                const storedName =
                    `${createId()}-${filename}`;

                const filePath =
                    path.join(
                        UPLOAD_DIR,
                        storedName
                    );

                fs.writeFileSync(
                    filePath,
                    buffer
                );

                memory.background =
                    `/uploads/${encodeURIComponent(
                        storedName
                    )}`;

                writeData(data);

                sendJSON(res, 201, {
                    background:
                        memory.background
                });

                return;
            }


            // -----------------------------
            // NOT FOUND
            // -----------------------------

            sendJSON(res, 404, {
                error: "Not found."
            });

        } catch (error) {

            console.error(error);

            if (!res.headersSent) {
                sendJSON(res, 500, {
                    error:
                        "Something went wrong on the server."
                });
            }
        }
    }
);


server.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `Memories is running on port ${PORT}`
        );
    }
);
