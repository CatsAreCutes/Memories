// Memories
// Browser-only version.
// No Express.
// No Node.
// No package.json.
// Uses IndexedDB for files.

const DB_NAME = "MemoriesBrowserDB";
const DB_VERSION = 1;

const MEMORY_STORE = "memories";
const FILE_STORE = "files";

let db = null;
let currentMemoryId = null;

const objectURLs = new Set();


// --------------------------------------------------
// DATABASE
// --------------------------------------------------

function openDatabase() {
  return new Promise((resolve, reject) => {

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {

      const database = event.target.result;

      if (!database.objectStoreNames.contains(MEMORY_STORE)) {
        const memories = database.createObjectStore(
          MEMORY_STORE,
          { keyPath: "id" }
        );

        memories.createIndex(
          "createdAt",
          "createdAt"
        );
      }

      if (!database.objectStoreNames.contains(FILE_STORE)) {
        const files = database.createObjectStore(
          FILE_STORE,
          { keyPath: "id" }
        );

        files.createIndex(
          "memoryId",
          "memoryId"
        );
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}


// --------------------------------------------------
// DATABASE HELPERS
// --------------------------------------------------

function getAllMemories() {
  return new Promise((resolve, reject) => {

    const transaction =
      db.transaction(MEMORY_STORE, "readonly");

    const store =
      transaction.objectStore(MEMORY_STORE);

    const request =
      store.getAll();

    request.onsuccess = () => {
      const memories = request.result || [];

      memories.sort((a, b) =>
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
      db.transaction(MEMORY_STORE, "readonly");

    const store =
      transaction.objectStore(MEMORY_STORE);

    const request =
      store.get(id);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}


function saveMemory(memory) {
  return new Promise((resolve, reject) => {

    const transaction =
      db.transaction(MEMORY_STORE, "readwrite");

    const store =
      transaction.objectStore(MEMORY_STORE);

    const request =
      store.put(memory);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}


function deleteMemoryRecord(id) {
  return new Promise((resolve, reject) => {

    const transaction =
      db.transaction(
        [MEMORY_STORE, FILE_STORE],
        "readwrite"
      );

    transaction.objectStore(MEMORY_STORE).delete(id);

    const fileStore =
      transaction.objectStore(FILE_STORE);

    const index =
      fileStore.index("memoryId");

    const request =
      index.openCursor(
        IDBKeyRange.only(id)
      );

    request.onsuccess = event => {

      const cursor = event.target.result;

      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}


function getFilesForMemory(memoryId) {
  return new Promise((resolve, reject) => {

    const transaction =
      db.transaction(FILE_STORE, "readonly");

    const store =
      transaction.objectStore(FILE_STORE);

    const index =
      store.index("memoryId");

    const request =
      index.getAll(
        IDBKeyRange.only(memoryId)
      );

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}


function saveFile(fileRecord) {
  return new Promise((resolve, reject) => {

    const transaction =
      db.transaction(FILE_STORE, "readwrite");

    const store =
      transaction.objectStore(FILE_STORE);

    const request =
      store.put(fileRecord);

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
      db.transaction(FILE_STORE, "readwrite");

    const store =
      transaction.objectStore(FILE_STORE);

    const request =
      store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}


// --------------------------------------------------
// IDs
// --------------------------------------------------

function createId() {

  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2)
  );
}


// --------------------------------------------------
// MEMORY CREATION
// --------------------------------------------------

async function createMemory() {

  const input =
    document.getElementById("memoryName");

  const name =
    input.value.trim();

  if (!name) {
    alert("Give your memory a name first!");
    return;
  }

  if (name.length > 60) {
    alert("The memory name is too long.");
    return;
  }

  const memory = {
    id: createId(),
    name: name,
    background: null,
    createdAt: new Date().toISOString()
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


// --------------------------------------------------
// DISPLAY MEMORIES
// --------------------------------------------------

async function displayMemories() {

  const tabs =
    document.getElementById("tabs");

  tabs.innerHTML = "";

  let memories;

  try {
    memories = await getAllMemories();
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
      document.createElement("div");

    tab.className = "tab";

    if (memory.background) {

      tab.style.setProperty(
        "--background",
        `url("${memory.background}")`
      );

    } else {

      tab.style.setProperty(
        "--background",
        "none"
      );
    }

    const title =
      document.createElement("h2");

    title.textContent =
      memory.name;

    const info =
      document.createElement("div");

    info.className =
      "tab-info";

    const files =
      await getFilesForMemory(memory.id);

    info.textContent =
      `${files.length} file${files.length === 1 ? "" : "s"}`;

    tab.appendChild(title);
    tab.appendChild(info);

    tab.addEventListener(
      "click",
      () => openMemory(memory.id)
    );

    tabs.appendChild(tab);
  }
}


// --------------------------------------------------
// OPEN MEMORY
// --------------------------------------------------

async function openMemory(id) {

  const memory =
    await getMemory(id);

  if (!memory) {

    alert("Memory not found.");

    return;
  }

  currentMemoryId =
    memory.id;

  document
    .getElementById("viewerTitle")
    .textContent =
    memory.name;

  document
    .getElementById("viewer")
    .style.display =
    "block";

  await updateViewerBackground();

  await renderFiles();

  await updateStorageInfo();
}


// --------------------------------------------------
// CLOSE MEMORY
// --------------------------------------------------

function closeMemory() {

  document
    .getElementById("viewer")
    .style.display =
    "none";

  currentMemoryId =
    null;

  clearObjectURLs();
}


// --------------------------------------------------
// BACKGROUND
// --------------------------------------------------

async function updateViewerBackground() {

  const viewer =
    document.getElementById("viewer");

  if (!currentMemoryId) {
    return;
  }

  const memory =
    await getMemory(currentMemoryId);

  if (!memory || !memory.background) {

    viewer.style.background =
      "#08090d";

    return;
  }

  viewer.style.backgroundImage =
    `linear-gradient(
      rgba(8,9,13,.78),
      rgba(8,9,13,.92)
    ), url("${memory.background}")`;

  viewer.style.backgroundSize =
    "cover";

  viewer.style.backgroundPosition =
    "center";

  viewer.style.backgroundAttachment =
    "fixed";
}


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
      await getMemory(currentMemoryId);

    if (!memory) {
      return;
    }

    const dataURL =
      await fileToDataURL(file);

    memory.background =
      dataURL;

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


// --------------------------------------------------
// FILE UPLOAD
// --------------------------------------------------

async function uploadFiles(event) {

  if (!currentMemoryId) {
    return;
  }

  const selectedFiles =
    Array.from(event.target.files);

  event.target.value = "";

  if (selectedFiles.length === 0) {
    return;
  }

  for (const file of selectedFiles) {

    try {

      const fileRecord = {
        id: createId(),
        memoryId: currentMemoryId,
        name: file.name,
        type:
          file.type ||
          "application/octet-stream",
        size: file.size,
        createdAt:
          new Date().toISOString(),
        blob: file
      };

      await saveFile(fileRecord);

    } catch (error) {

      console.error(error);

      alert(
        `Couldn't save ${file.name}.`
      );
    }
  }

  await renderFiles();

  await displayMemories();

  await updateStorageInfo();
}


// --------------------------------------------------
// RENDER FILES
// --------------------------------------------------

async function renderFiles() {

  clearObjectURLs();

  const container =
    document.getElementById("files");

  container.innerHTML = "";

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
        This memory doesn't have any files yet.
      </div>
    `;

    return;
  }

  for (const file of files) {

    const element =
      document.createElement("div");

    element.className =
      "file";

    const name =
      document.createElement("div");

    name.className =
      "file-name";

    name.textContent =
      file.name;

    element.appendChild(name);

    const meta =
      document.createElement("div");

    meta.className =
      "file-meta";

    meta.textContent =
      `${file.type || "File"} • ${formatBytes(file.size)}`;

    element.appendChild(meta);

    const url =
      URL.createObjectURL(file.blob);

    objectURLs.add(url);

    if (file.type.startsWith("image/")) {

      const image =
        document.createElement("img");

      image.src =
        url;

      image.alt =
        file.name;

      image.loading =
        "lazy";

      element.appendChild(image);

    } else if (file.type.startsWith("video/")) {

      const video =
        document.createElement("video");

      video.src =
        url;

      video.controls =
        true;

      video.playsInline =
        true;

      video.preload =
        "metadata";

      element.appendChild(video);

    } else if (file.type.startsWith("audio/")) {

      const audio =
        document.createElement("audio");

      audio.src =
        url;

      audio.controls =
        true;

      element.appendChild(audio);

    } else {

      const link =
        document.createElement("a");

      link.href =
        url;

      link.download =
        file.name;

      link.target =
        "_blank";

      link.textContent =
        "Open / download file";

      element.appendChild(link);
    }

    const deleteButton =
      document.createElement("button");

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

          console.error(error);

          alert(
            "Couldn't delete the file."
          );
        }
      }
    );

    element.appendChild(deleteButton);

    container.appendChild(element);
  }
}


// --------------------------------------------------
// STORAGE INFORMATION
// --------------------------------------------------

async function updateStorageInfo() {

  const element =
    document.getElementById("storageInfo");

  if (!navigator.storage ||
      !navigator.storage.estimate) {

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
        ((used / quota) * 100)
          .toFixed(1);

      element.textContent =
        `Browser storage: ${formatBytes(used)} used `
        + `of approximately ${formatBytes(quota)} `
        + `(${percent}%).`;

    } else {

      element.textContent =
        `Browser storage used: ${formatBytes(used)}.`;
    }

  } catch (error) {

    console.error(error);

    element.textContent =
      "Couldn't calculate browser storage.";
  }
}


// --------------------------------------------------
// UTILITIES
// --------------------------------------------------

function formatBytes(bytes) {

  if (!Number.isFinite(bytes) ||
      bytes <= 0) {

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
    index < units.length - 1
  ) {

    value /= 1024;
    index++;
  }

  return (
    value.toFixed(
      value >= 100 ? 0 :
      value >= 10 ? 1 :
      2
    ) +
    " " +
    units[index]
  );
}


function fileToDataURL(file) {

  return new Promise(
    (resolve, reject) => {

      const reader =
        new FileReader();

      reader.onload =
        () => resolve(
          reader.result
        );

      reader.onerror =
        () => reject(
          reader.error
        );

      reader.readAsDataURL(file);
    }
  );
}


function clearObjectURLs() {

  for (const url of objectURLs) {
    URL.revokeObjectURL(url);
  }

  objectURLs.clear();
}


// --------------------------------------------------
// BUTTONS / EVENTS
// --------------------------------------------------

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    try {

      await openDatabase();

      document
        .getElementById("createButton")
        .addEventListener(
          "click",
          createMemory
        );

      document
        .getElementById("closeButton")
        .addEventListener(
          "click",
          closeMemory
        );

      document
        .getElementById("uploadButton")
        .addEventListener(
          "click",
          () => {
            document
              .getElementById("fileInput")
              .click();
          }
        );

      document
        .getElementById("backgroundButton")
        .addEventListener(
          "click",
          () => {
            document
              .getElementById("backgroundInput")
              .click();
          }
        );

      document
        .getElementById("fileInput")
        .addEventListener(
          "change",
          uploadFiles
        );

      document
        .getElementById("backgroundInput")
        .addEventListener(
          "change",
          uploadBackground
        );

      document
        .getElementById("memoryName")
        .addEventListener(
          "keydown",
          event => {

            if (event.key === "Enter") {
              createMemory();
            }
          }
        );

      await displayMemories();

      await updateStorageInfo();

    } catch (error) {

      console.error(error);

      document
        .getElementById("tabs")
        .innerHTML = `
          <div class="empty">
            Your browser could not start the
            Memories storage system.
          </div>
        `;
    }
  }
);


// Clean up temporary video/image URLs.
window.addEventListener(
  "beforeunload",
  clearObjectURLs
);
