const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand
} = require("@aws-sdk/client-s3");

const {
  getSignedUrl
} = require("@aws-sdk/s3-request-presigner");


const PORT =
  process.env.PORT || 10000;

const R2_ACCOUNT_ID =
  process.env.R2_ACCOUNT_ID;

const R2_ACCESS_KEY_ID =
  process.env.R2_ACCESS_KEY_ID;

const R2_SECRET_ACCESS_KEY =
  process.env.R2_SECRET_ACCESS_KEY;

const R2_BUCKET_NAME =
  process.env.R2_BUCKET_NAME;


if (
  !R2_ACCOUNT_ID ||
  !R2_ACCESS_KEY_ID ||
  !R2_SECRET_ACCESS_KEY ||
  !R2_BUCKET_NAME
) {
  console.error(
    "Missing R2 environment variables."
  );

  process.exit(1);
}


const s3 = new S3Client({
  region: "auto",

  endpoint:
    `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,

  credentials: {
    accessKeyId:
      R2_ACCESS_KEY_ID,

    secretAccessKey:
      R2_SECRET_ACCESS_KEY
  }
});


const BUCKET =
  R2_BUCKET_NAME;

const DATABASE_KEY =
  "memories/memories.json";


async function getDatabase() {

  try {

    const result =
      await s3.send(
        new GetObjectCommand({
          Bucket: BUCKET,
          Key: DATABASE_KEY
        })
      );

    const text =
      await result.Body.transformToString();

    return JSON.parse(text);

  } catch {

    return {
      memories: []
    };
  }
}


async function saveDatabase(data) {

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: DATABASE_KEY,
      Body:
        JSON.stringify(
          data,
          null,
          2
        ),
      ContentType:
        "application/json"
    })
  );
}


function createId() {
  return crypto.randomUUID();
}


function safeFilename(filename) {

  return path
    .basename(
      String(filename || "file")
    )
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    )
    .slice(0, 180);
}


function sendJSON(
  res,
  status,
  data
) {

  const output =
    JSON.stringify(data);

  res.writeHead(
    status,
    {
      "Content-Type":
        "application/json; charset=utf-8",

      "Content-Length":
        Buffer.byteLength(output)
    }
  );

  res.end(output);
}


async function readBody(req) {

  let body = "";

  return new Promise(
    (resolve, reject) => {

      req.on(
        "data",
        chunk => {
          body += chunk;

          if (
            body.length >
            1024 * 1024
          ) {
            reject(
              new Error(
                "Request is too large."
              )
            );

            req.destroy();
          }
        }
      );

      req.on(
        "end",
        () => {

          try {

            resolve(
              body
                ? JSON.parse(body)
                : {}
            );

          } catch {

            reject(
              new Error(
                "Invalid JSON."
              )
            );
          }
        }
      );

      req.on(
        "error",
        reject
      );
    }
  );
}


function findMemory(
  data,
  id
) {

  return data.memories.find(
    memory =>
      memory.id === id
  );
}


async function makeReadURL(key) {

  return getSignedUrl(
    s3,

    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key
    }),

    {
      expiresIn:
        60 * 60 * 6
    }
  );
}


async function makeUploadURL(
  key,
  mimeType
) {

  return getSignedUrl(
    s3,

    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: mimeType
    }),

    {
      expiresIn:
        60 * 60
    }
  );
}


async function serveInterface(
  res
) {

  const file =
    path.join(
      __dirname,
      "interface.html"
    );

  if (
    !fs.existsSync(file)
  ) {

    sendJSON(
      res,
      500,
      {
        error:
          "interface.html was not found."
      }
    );

    return;
  }

  const html =
    fs.readFileSync(
      file
    );

  res.writeHead(
    200,
    {
      "Content-Type":
        "text/html; charset=utf-8",

      "Content-Length":
        html.length
    }
  );

  res.end(html);
}


const server =
  http.createServer(
    async (req, res) => {

      try {

        const url =
          new URL(
            req.url,
            `http://${req.headers.host || "localhost"}`
          );

        const pathname =
          url.pathname;


        // Website

        if (
          pathname === "/" ||
          pathname === "/interface.html"
        ) {

          await serveInterface(
            res
          );

          return;
        }


        // Get memories

        if (
          pathname ===
            "/api/memories" &&
          req.method === "GET"
        ) {

          const data =
            await getDatabase();

          const memories =
            await Promise.all(
              data.memories.map(
                async memory => {

                  let background =
                    null;

                  if (
                    memory.background
                  ) {

                    background =
                      await makeReadURL(
                        memory.background
                      );
                  }

                  return {
                    id:
                      memory.id,

                    name:
                      memory.name,

                    background,

                    fileCount:
                      memory.files.length
                  };
                }
              )
            );

          sendJSON(
            res,
            200,
            { memories }
          );

          return;
        }


        // Create memory

        if (
          pathname ===
            "/api/memories" &&
          req.method === "POST"
        ) {

          const body =
            await readBody(req);

          const name =
            typeof body.name === "string"
              ? body.name.trim()
              : "";

          if (!name) {

            sendJSON(
              res,
              400,
              {
                error:
                  "Memory name is required."
              }
            );

            return;
          }

          if (
            name.length > 60
          ) {

            sendJSON(
              res,
              400,
              {
                error:
                  "Memory name is too long."
              }
            );

            return;
          }

          const data =
            await getDatabase();

          const memory = {
            id:
              createId(),

            name,

            background:
              null,

            files:
              [],

            createdAt:
              new Date().toISOString()
          };

          data.memories.push(
            memory
          );

          await saveDatabase(
            data
          );

          sendJSON(
            res,
            201,
            {
              memory: {
                id:
                  memory.id,

                name:
                  memory.name,

                background:
                  null,

                fileCount:
                  0
              }
            }
          );

          return;
        }


        // Open memory

        const openMatch =
          pathname.match(
            /^\/api\/memories\/([^/]+)$/
          );

        if (
          openMatch &&
          req.method === "GET"
        ) {

          const id =
            decodeURIComponent(
              openMatch[1]
            );

          const data =
            await getDatabase();

          const memory =
            findMemory(
              data,
              id
            );

          if (!memory) {

            sendJSON(
              res,
              404,
              {
                error:
                  "Memory not found."
              }
            );

            return;
          }

          const files =
            await Promise.all(
              memory.files.map(
                async file => ({
                  id:
                    file.id,

                  name:
                    file.name,

                  type:
                    file.type,

                  url:
                    await makeReadURL(
                      file.key
                    )
                })
              )
            );

          let background =
            null;

          if (
            memory.background
          ) {

            background =
              await makeReadURL(
                memory.background
              );
          }

          sendJSON(
            res,
            200,
            {
              memory: {
                id:
                  memory.id,

                name:
                  memory.name,

                background,

                files
              }
            }
          );

          return;
        }


        // Prepare normal file upload

        const uploadMatch =
          pathname.match(
            /^\/api\/memories\/([^/]+)\/upload-url$/
          );

        if (
          uploadMatch &&
          req.method === "POST"
        ) {

          const id =
            decodeURIComponent(
              uploadMatch[1]
            );

          const body =
            await readBody(req);

          const data =
            await getDatabase();

          const memory =
            findMemory(
              data,
              id
            );

          if (!memory) {

            sendJSON(
              res,
              404,
              {
                error:
                  "Memory not found."
              }
            );

            return;
          }

          const filename =
            safeFilename(
              body.filename
            );

          const mimeType =
            typeof body.mimeType === "string"
              ? body.mimeType
              : "application/octet-stream";

          const key =
            `memories/${id}/files/${createId()}-${filename}`;

          const uploadUrl =
            await makeUploadURL(
              key,
              mimeType
            );

          sendJSON(
            res,
            200,
            {
              uploadUrl,
              key
            }
          );

          return;
        }


        // Save uploaded file metadata

        const saveFileMatch =
          pathname.match(
            /^\/api\/memories\/([^/]+)\/file$/
          );

        if (
          saveFileMatch &&
          req.method === "POST"
        ) {

          const id =
            decodeURIComponent(
              saveFileMatch[1]
            );

          const body =
            await readBody(req);

          const data =
            await getDatabase();

          const memory =
            findMemory(
              data,
              id
            );

          if (!memory) {

            sendJSON(
              res,
              404,
              {
                error:
                  "Memory not found."
              }
            );

            return;
          }

          if (
            !body.key ||
            !body.name
          ) {

            sendJSON(
              res,
              400,
              {
                error:
                  "File information is missing."
              }
            );

            return;
          }

          try {

            await s3.send(
              new HeadObjectCommand({
                Bucket:
                  BUCKET,

                Key:
                  body.key
              })
            );

          } catch {

            sendJSON(
              res,
              400,
              {
                error:
                  "The file was not found in storage."
              }
            );

            return;
          }

          const file = {
            id:
              createId(),

            name:
              String(body.name)
                .slice(0, 200),

            type:
              typeof body.type === "string"
                ? body.type
                : "application/octet-stream",

            key:
              body.key
          };

          memory.files.push(
            file
          );

          await saveDatabase(
            data
          );

          sendJSON(
            res,
            201,
            {
              file: {
                id:
                  file.id,

                name:
                  file.name,

                type:
                  file.type,

                url:
                  await makeReadURL(
                    file.key
                  )
              }
            }
          );

          return;
        }


        // Prepare background upload

        const backgroundURLMatch =
          pathname.match(
            /^\/api\/memories\/([^/]+)\/background-url$/
          );

        if (
          backgroundURLMatch &&
          req.method === "POST"
        ) {

          const id =
            decodeURIComponent(
              backgroundURLMatch[1]
            );

          const body =
            await readBody(req);

          const data =
            await getDatabase();

          const memory =
            findMemory(
              data,
              id
            );

          if (!memory) {

            sendJSON(
              res,
              404,
              {
                error:
                  "Memory not found."
              }
            );

            return;
          }

          const mimeType =
            typeof body.mimeType === "string"
              ? body.mimeType
              : "";

          if (
            !mimeType.startsWith("image/")
          ) {

            sendJSON(
              res,
              400,
              {
                error:
                  "Background must be an image."
              }
            );

            return;
          }

          const filename =
            safeFilename(
              body.filename ||
              "background"
            );

          const key =
            `memories/${id}/background/${createId()}-${filename}`;

          const uploadUrl =
            await makeUploadURL(
              key,
              mimeType
            );

          sendJSON(
            res,
            200,
            {
              uploadUrl,
              key
            }
          );

          return;
        }


        // Save background metadata

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

          const data =
            await getDatabase();

          const memory =
            findMemory(
              data,
              id
            );

          if (!memory) {

            sendJSON(
              res,
              404,
              {
                error:
                  "Memory not found."
              }
            );

            return;
          }

          if (!body.key) {

            sendJSON(
              res,
              400,
              {
                error:
                  "Background key is missing."
              }
            );

            return;
          }

          try {

            await s3.send(
              new HeadObjectCommand({
                Bucket:
                  BUCKET,

                Key:
                  body.key
              })
            );

          } catch {

            sendJSON(
              res,
              400,
              {
                error:
                  "Background was not found in storage."
              }
            );

            return;
          }

          memory.background =
            body.key;

          await saveDatabase(
            data
          );

          sendJSON(
            res,
            201,
            {
              background:
                await makeReadURL(
                  memory.background
                )
            }
          );

          return;
        }


        sendJSON(
          res,
          404,
          {
            error:
              "Not found."
          }
        );

      } catch (error) {

        console.error(
          error
        );

        if (
          !res.headersSent
        ) {

          sendJSON(
            res,
            500,
            {
              error:
                "Server error."
            }
          );
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
