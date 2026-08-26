/*
  MEMORIES
  ------------------------------------------------
  This file has TWO jobs:

  1. Render/Node:
     Starts a tiny web server using only built-in Node.js.
     No Express.
     No package.json required.

  2. Browser:
     Runs the Memories application using IndexedDB.
     Files are stored as Blobs instead of base64 strings.

  This lets Render run:
      node workings.js

  while the browser can still load:
      /workings.js
*/


// ============================================================
// NODE / RENDER SERVER
// ============================================================

if (typeof document === "undefined") {

  const http = require("http");
  const fs = require("fs");
  const path = require("path");

  const PORT = process.env.PORT || 10000;
  const ROOT = __dirname;

  const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8"
  };

  function safePath(urlPath) {
    let decoded;

    try {
      decoded = decodeURIComponent(urlPath);
    } catch {
      return null;
    }

    const clean = decoded.split("?")[0];

    const requested =
      clean === "/"
        ? "/interface.html"
        : clean;

    const fullPath =
      path.resolve(
        ROOT,
        "." + requested
      );

    if (
      fullPath !== ROOT &&
      !fullPath.startsWith(ROOT + path.sep)
    ) {
      return null;
    }

    return fullPath;
  }

  const server = http.createServer((req, res) => {

    const filePath = safePath(req.url || "/");

    if (!filePath) {
      res.writeHead(400, {
        "Content-Type": "text/plain; charset=utf-8"
      });

      res.end("Bad request.");
      return;
    }

    fs.stat(filePath, (error, stats) => {

      if (error || !stats.isFile()) {

        res.writeHead(404, {
          "Content-Type": "text/plain; charset=utf-8"
        });

        res.end("Not found.");
        return;
      }

      const extension =
        path.extname(filePath).toLowerCase();

      const contentType =
        MIME_TYPES[extension] ||
        "application/octet-stream";

      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "no-cache"
      });

      const stream =
        fs.createReadStream(filePath);

      stream.on("error", () => {

        if (!res.headersSent) {
          res.writeHead(500);
        }

        res.end("Server error.");
      });

      stream.pipe(res);
    });
  });

  server.listen(PORT, "0.0.0.0", () => {

    console.log(
      `Memories is running on port ${PORT}`
    );

  });

}


// ============================================================
// BROWSER APPLICATION
// ============================================================

else {

  // ----------------------------------------------------------
  // DATABASE SETTINGS
  // ----------------------------------------------------------

  const DB_NAME = "MemoriesBrowserDB";
  const DB_VERSION = 2;

  const MEMORY_STORE = "memories";
  const FILE_STORE = "files";

  let db = null;
  let currentMemoryId = null;

  const objectURLs = new Set();


  // ----------------------------------------------------------
  // OPEN DATABASE
  // ----------------------------------------------------------

  function openDatabase() {

    return new Promise((resolve, reject) => {

      const request =
        indexedDB.open(
          DB_NAME,
          DB_VERSION
        );

      request.onupgradeneeded = event => {

        const database =
          event.target.result;

        if (
          !database.objectStoreNames.contains(
            MEMORY_STORE
          )
        ) {

          const memories =
            database.createObjectStore(
              MEMORY_STORE,
              {
                keyPath: "id"
              }
            );

          memories.createIndex(
            "createdAt",
            "createdAt"
          );
        }


        if (
          !database.objectStoreNames.contains(
            FILE_STORE
          )
        ) {

          const files =
            database.createObjectStore(
              FILE_STORE,
              {
                keyPath: "id"
              }
            );

          files.createIndex(
            "memoryId",
            "memoryId"
          );
        }

      };


      request.onsuccess = () => {

        db = request.result;

        db.onversionchange = () => {
          db.close();
        };

        resolve(db);
      };


      request.onerror = () => {
        reject(request.error);
      };

    });

  }


  // ----------------------------------------------------------
  // MEMORY HELPERS
  // ----------------------------------------------------------

  function getAllMemories() {

    return new Promise((resolve, reject) => {

      const transaction =
        db.transaction(
          MEMORY_STORE,
          "readonly"
        );

      const store =
        transaction.objectStore(
          MEMORY_STORE
        );

      const request =
        store.getAll();

      request.onsuccess = () => {

        const memories =
          request.result || [];

        memories.sort(
          (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
        );

        resolve(memories);
      };

      request.onerror = () => {
        reject(request.error);
      };

    });

  }


  function getMemory(id) {

    return new Promise((resolve, reject) => {

      const transaction =
        db.transaction(
          MEMORY_STORE,
          "readonly"
        );

      const request =
        transaction
          .objectStore(MEMORY_STORE)
          .get(id);

      request.onsuccess = () => {
        resolve(
          request.result || null
        );
      };

      request.onerror = () => {
        reject(request.error);
      };

    });

  }


  function saveMemory(memory) {

    return new Promise((resolve, reject) => {

      const transaction =
        db.transaction(
          MEMORY_STORE,
          "readwrite"
        );

      const request =
        transaction
          .objectStore(MEMORY_STORE)
          .put(memory);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };

    });

  }


  function getFilesForMemory(memoryId) {

    return new Promise((resolve, reject) => {

      const transaction =
        db.transaction(
          FILE_STORE,
          "readonly"
        );

      const store =
        transaction.objectStore(
          FILE_STORE
        );

      const index =
        store.index("memoryId");

      const request =
        index.getAll(
          IDBKeyRange.only(memoryId)
        );

      request.onsuccess = () => {
        resolve(
          request.result || []
        );
      };

      request.onerror = () => {
        reject(request.error);
      };

    });

  }


  function saveFile(fileRecord) {

    return new Promise((resolve, reject) => {

      const transaction =
        db.transaction(
          FILE_STORE,
          "readwrite"
        );

      const request =
        transaction
          .objectStore(FILE_STORE)
          .put(fileRecord);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };

    });

  }


  function deleteFileRecord(id) {

    return new Promise((resolve, reject) => {

      const transaction =
        db.transaction(
          FILE_STORE,
          "readwrite"
        );

      const request =
        transaction
          .objectStore(FILE_STORE)
          .delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };

    });

  }


  // ----------------------------------------------------------
  // ID
  // ----------------------------------------------------------

  function createId() {

    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    return (
      Date.now().toString(36) +
      "-" +
      Math.random()
        .toString(36)
        .slice(2)
    );

  }


  // ----------------------------------------------------------
  // CREATE MEMORY
  // ----------------------------------------------------------

  async function createMemory() {

    const input =
      document.getElementById(
        "memoryName"
      );

    if (!input) {
      return;
    }

    const name =
      input.value.trim();

    if (!name) {

      alert(
        "Give your memory a name first!"
      );

      return;
    }

    if (name.length > 70) {

      alert(
        "The memory name is too long."
      );

      return;
    }

    const memory = {

      id: createId(),

      name: name,

      background: null,

      createdAt:
        new Date().toISOString()

    };


    try {

      await saveMemory(memory);

      input.value = "";

      await displayMemories();

      await openMemory(memory.id);

    } catch (error) {

      console.error(error);

      alert(
        "Couldn't create the memory."
      );

    }

  }


  // ----------------------------------------------------------
  // DISPLAY MEMORIES
  // ----------------------------------------------------------

  async function displayMemories() {

    const tabs =
      document.getElementById(
        "tabs"
      );

    if (!tabs) {
      return;
    }

    tabs.innerHTML = "";

    let memories;

    try {

      memories =
        await getAllMemories();

    } catch (error) {

      console.error(error);

      tabs.innerHTML = `
        <div class="empty">
          Couldn't load your memories.
        </div>
      `;

      return;
    }


    if (memories.length === 0) {

      tabs.innerHTML = `
        <div class="empty">
          No memories yet.<br>
          Create your first one!
        </div>
      `;

      return;
    }


    for (const memory of memories) {

      const tab =
        document.createElement(
          "div"
        );

      tab.className = "tab";


      if (memory.background) {

        const backgroundURL =
          URL.createObjectURL(
            memory.background
          );

        objectURLs.add(
          backgroundURL
        );

        tab.style.setProperty(
          "--background",
          `url("${backgroundURL}")`
        );

      } else {

        tab.style.setProperty(
          "--background",
          "none"
        );

      }


      const title =
        document.createElement(
          "h2"
        );

      title.textContent =
        memory.name;


      const info =
        document.createElement(
          "div"
        );

      info.className =
        "tab-info";


      const files =
        await getFilesForMemory(
          memory.id
        );


      info.textContent =
        `${files.length} file${
          files.length === 1
            ? ""
            : "s"
        }`;


      tab.appendChild(title);

      tab.appendChild(info);


      tab.addEventListener(
        "click",
        () => openMemory(memory.id)
      );


      tabs.appendChild(tab);

    }

  }


  // ----------------------------------------------------------
  // OPEN MEMORY
  // ----------------------------------------------------------

  async function openMemory(id) {

    const memory =
      await getMemory(id);

    if (!memory) {

      alert(
        "Memory not found."
      );

      return;
    }


    currentMemoryId =
      memory.id;


    const title =
      document.getElementById(
        "viewerTitle"
      );

    if (title) {
      title.textContent =
        memory.name;
    }


    const viewer =
      document.getElementById(
        "viewer"
      );

    if (viewer) {

      viewer.style.display =
        "block";

    }


    await updateViewerBackground();

    await renderFiles();

    await updateStorageInfo();

  }


  // ----------------------------------------------------------
  // CLOSE MEMORY
  // ----------------------------------------------------------

  function closeMemory() {

    const viewer =
      document.getElementById(
        "viewer"
      );

    if (viewer) {

      viewer.style.display =
        "none";

    }


    currentMemoryId =
      null;


    clearObjectURLs();

  }


  // ----------------------------------------------------------
  // VIEWER BACKGROUND
  // ----------------------------------------------------------

  async function updateViewerBackground() {

    const viewer =
      document.getElementById(
        "viewer"
      );

    if (!viewer || !currentMemoryId) {
      return;
    }


    const memory =
      await getMemory(
        currentMemoryId
      );


    if (
      !memory ||
      !memory.background
    ) {

      viewer.style.background =
        "#08090d";

      viewer.style.backgroundImage =
        "none";

      return;
    }


    const url =
      URL.createObjectURL(
        memory.background
      );

    objectURLs.add(url);


    viewer.style.backgroundImage =
      `
        linear-gradient(
          rgba(8, 9, 13, 0.78),
          rgba(8, 9, 13, 0.92)
        ),
        url("${url}")
      `;

    viewer.style.backgroundSize =
      "cover";

    viewer.style.backgroundPosition =
      "center";

    viewer.style.backgroundAttachment =
      "fixed";

  }


  // ----------------------------------------------------------
  // BACKGROUND UPLOAD
  // ----------------------------------------------------------

  async function uploadBackground(event) {

    if (!currentMemoryId) {
      return;
    }


    const file =
      event.target.files[0];

    event.target.value = "";


    if (!file) {
      return;
    }


    if (!file.type.startsWith("image/")) {

      alert(
        "The viewer background must be an image."
      );

      return;
    }


    try {

      const memory =
        await getMemory(
          currentMemoryId
        );

      if (!memory) {
        return;
      }


      /*
        IMPORTANT:

        Store the background as the
        original File/Blob.

        No base64 conversion.
      */

      memory.background =
        file;


      await saveMemory(memory);

      await updateViewerBackground();

      await displayMemories();

    } catch (error) {

      console.error(error);

      alert(
        "Couldn't save the viewer background."
      );

    }

  }


  // ----------------------------------------------------------
  // FILE UPLOAD
  // ----------------------------------------------------------

  async function uploadFiles(event) {

    if (!currentMemoryId) {
      return;
    }


    const selectedFiles =
      Array.from(
        event.target.files
      );


    event.target.value = "";


    if (selectedFiles.length === 0) {
      return;
    }


    for (
      const file of selectedFiles
    ) {

      try {

        /*
          Store the actual File/Blob.

          This is MUCH better for videos
          than converting them to base64.

          A 200 MB video remains roughly
          200 MB instead of becoming a
          much larger base64 string.
        */

        const fileRecord = {

          id: createId(),

          memoryId:
            currentMemoryId,

          name:
            file.name,

          type:
            file.type ||
            "application/octet-stream",

          size:
            file.size,

          createdAt:
            new Date().toISOString(),

          blob:
            file

        };


        await saveFile(
          fileRecord
        );


      } catch (error) {

        console.error(
          "Couldn't save file:",
          error
        );


        alert(
          `Couldn't save ${file.name}.`
        );

      }

    }


    await renderFiles();

    await displayMemories();

    await updateStorageInfo();

  }


  // ----------------------------------------------------------
  // RENDER FILES
  // ----------------------------------------------------------

  async function renderFiles() {

    clearObjectURLs();


    const container =
      document.getElementById(
        "files"
      );


    if (!container) {
      return;
    }


    container.innerHTML =
      "";


    if (!currentMemoryId) {
      return;
    }


    const files =
      await getFilesForMemory(
        currentMemoryId
      );


    if (files.length === 0) {

      container.innerHTML = `
        <div class="empty">
          This memory doesn't have
          any files yet.
        </div>
      `;

      return;
    }


    for (
      const file of files
    ) {

      const element =
        document.createElement(
          "div"
        );

      element.className =
        "file";


      const name =
        document.createElement(
          "div"
        );

      name.className =
        "file-name";

      name.textContent =
        file.name;

      element.appendChild(
        name
      );


      const meta =
        document.createElement(
          "div"
        );

      meta.className =
        "file-meta";

      meta.textContent =
        `${
          file.type ||
          "File"
        } • ${
          formatBytes(file.size)
        }`;

      element.appendChild(
        meta
      );


      const url =
        URL.createObjectURL(
          file.blob
        );

      objectURLs.add(url);


      if (
        file.type &&
        file.type.startsWith(
          "image/"
        )
      ) {

        const image =
          document.createElement(
            "img"
          );

        image.src =
          url;

        image.alt =
          file.name;

        image.loading =
          "lazy";

        element.appendChild(
          image
        );


      } else if (
        file.type &&
        file.type.startsWith(
          "video/"
        )
      ) {

        const video =
          document.createElement(
            "video"
          );

        video.src =
          url;

        video.controls =
          true;

        video.playsInline =
          true;

        video.preload =
          "metadata";

        /*
          Makes the video behave nicely
          on phones and VR browsers.
        */

        video.style.maxWidth =
          "100%";

        video.style.maxHeight =
          "70vh";

        element.appendChild(
          video
        );


      } else if (
        file.type &&
        file.type.startsWith(
          "audio/"
        )
      ) {

        const audio =
          document.createElement(
            "audio"
          );

        audio.src =
          url;

        audio.controls =
          true;

        element.appendChild(
          audio
        );


      } else {

        const link =
          document.createElement(
            "a"
          );

        link.href =
          url;

        link.download =
          file.name;

        link.target =
          "_blank";

        link.textContent =
          "Open / download file";

        element.appendChild(
          link
        );

      }


      const deleteButton =
        document.createElement(
          "button"
        );

      deleteButton.className =
        "delete-file";

      deleteButton.textContent =
        "Delete this file";


      deleteButton.addEventListener(
        "click",
        async () => {

          const confirmed =
            confirm(
              `Delete "${file.name}" from this memory?`
            );


          if (!confirmed) {
            return;
          }


          try {

            await deleteFileRecord(
              file.id
            );

            await renderFiles();

            await displayMemories();

            await updateStorageInfo();

          } catch (error) {

            console.error(
              error
            );

            alert(
              "Couldn't delete the file."
            );

          }

        }
      );


      element.appendChild(
        deleteButton
      );


      container.appendChild(
        element
      );

    }

  }


  // ----------------------------------------------------------
  // STORAGE INFORMATION
  // ----------------------------------------------------------

  async function updateStorageInfo() {

    const element =
      document.getElementById(
        "storageInfo"
      );


    if (!element) {
      return;
    }


    if (
      !navigator.storage ||
      !navigator.storage.estimate
    ) {

      element.textContent =
        "Browser storage information is unavailable.";

      return;
    }


    try {

      const estimate =
        await navigator.storage.estimate();


      const used =
        estimate.usage || 0;

      const quota =
        estimate.quota || 0;


      if (quota > 0) {

        const percent =
          (
            (used / quota) *
            100
          ).toFixed(1);


        element.textContent =
          `Browser storage: ${
            formatBytes(used)
          } used of approximately ${
            formatBytes(quota)
          } (${percent}%).`;

      } else {

        element.textContent =
          `Browser storage used: ${
            formatBytes(used)
          }.`;

      }

    } catch (error) {

      console.error(
        error
      );

      element.textContent =
        "Couldn't calculate browser storage.";

    }

  }


  // ----------------------------------------------------------
  // UTILITIES
  // ----------------------------------------------------------

  function formatBytes(bytes) {

    if (
      !Number.isFinite(bytes) ||
      bytes <= 0
    ) {

      return "0 B";

    }


    const units = [
      "B",
      "KB",
      "MB",
      "GB",
      "TB"
    ];


    let value =
      bytes;

    let index =
      0;


    while (
      value >= 1024 &&
      index <
        units.length - 1
    ) {

      value /=
        1024;

      index++;

    }


    return (
      value.toFixed(
        value >= 100
          ? 0
          : value >= 10
            ? 1
            : 2
      ) +
      " " +
      units[index]
    );

  }


  function clearObjectURLs() {

    for (
      const url of objectURLs
    ) {

      URL.revokeObjectURL(
        url
      );

    }

    objectURLs.clear();

  }


  // ----------------------------------------------------------
  // START APPLICATION
  // ----------------------------------------------------------

  document.addEventListener(
    "DOMContentLoaded",
    async () => {

      try {

        await openDatabase();


        const createButton =
          document.getElementById(
            "createButton"
          );

        if (createButton) {

          createButton.addEventListener(
            "click",
            createMemory
          );

        }


        const closeButton =
          document.getElementById(
            "closeButton"
          );

        if (closeButton) {

          closeButton.addEventListener(
            "click",
            closeMemory
          );

        }


        const uploadButton =
          document.getElementById(
            "uploadButton"
          );

        const fileInput =
          document.getElementById(
            "fileInput"
          );


        if (
          uploadButton &&
          fileInput
        ) {

          uploadButton.addEventListener(
            "click",
            () => fileInput.click()
          );

        }


        const backgroundButton =
          document.getElementById(
            "backgroundButton"
          );

        const backgroundInput =
          document.getElementById(
            "backgroundInput"
          );


        if (
          backgroundButton &&
          backgroundInput
        ) {

          backgroundButton.addEventListener(
            "click",
            () => backgroundInput.click()
          );

        }


        if (fileInput) {

          fileInput.addEventListener(
            "change",
            uploadFiles
          );

        }


        if (backgroundInput) {

          backgroundInput.addEventListener(
            "change",
            uploadBackground
          );

        }


        const memoryName =
          document.getElementById(
            "memoryName"
          );


        if (memoryName) {

          memoryName.addEventListener(
            "keydown",
            event => {

              if (
                event.key === "Enter"
              ) {

                createMemory();

              }

            }
          );

        }


        await displayMemories();

        await updateStorageInfo();


      } catch (error) {

        console.error(
          "Memories startup error:",
          error
        );


        const tabs =
          document.getElementById(
            "tabs"
          );


        if (tabs) {

          tabs.innerHTML = `
            <div class="empty">
              Your browser could not start
              the Memories storage system.
              <br><br>
              ${error.message || ""}
            </div>
          `;

        }

      }

    }
  );


  window.addEventListener(
    "beforeunload",
    clearObjectURLs
  );

}
