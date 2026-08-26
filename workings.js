// ==================================================
// MEMORIES
// Browser-only version
// No Express
// No Node
// No package.json
//
// Files are stored as Blobs in IndexedDB.
// Videos can be up to 5 GB EACH.
// ==================================================


// --------------------------------------------------
// SETTINGS
// --------------------------------------------------

const DB_NAME = "MemoriesBrowserDB";
const DB_VERSION = 2;

const MEMORY_STORE = "memories";
const FILE_STORE = "files";

// Maximum size of ONE video.
// 5 GB = 5 * 1024 * 1024 * 1024 bytes.
const MAX_VIDEO_SIZE =
  5 * 1024 * 1024 * 1024;

// Maximum size of ONE non-video file.
// Set to 1 GB.
const MAX_OTHER_FILE_SIZE =
  1 * 1024 * 1024 * 1024;


// --------------------------------------------------
// STATE
// --------------------------------------------------

let db = null;
let currentMemoryId = null;

const objectURLs = new Set();


// --------------------------------------------------
// DATABASE
// --------------------------------------------------

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

      // ------------------------------
      // Memories store
      // ------------------------------

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


      // ------------------------------
      // Files store
      // ------------------------------

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

        files.createIndex(
          "kind",
          "kind"
        );
      }
    };


    request.onsuccess = () => {

      db =
        request.result;

      // If the database is closed unexpectedly,
      // don't leave the app silently broken.
      db.onversionchange = () => {
        db.close();
      };

      resolve(db);
    };


    request.onerror = () => {

      reject(
        request.error
      );
    };
  });
}


// --------------------------------------------------
// MEMORY DATABASE HELPERS
// --------------------------------------------------

function getAllMemories() {

  return new Promise(
    (resolve, reject) => {

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

        reject(
          request.error
        );
      };
    }
  );
}


function getMemory(id) {

  return new Promise(
    (resolve, reject) => {

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
        store.get(id);


      request.onsuccess = () => {

        resolve(
          request.result || null
        );
      };


      request.onerror = () => {

        reject(
          request.error
        );
      };
    }
  );
}


function saveMemory(memory) {

  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          MEMORY_STORE,
          "readwrite"
        );

      const store =
        transaction.objectStore(
          MEMORY_STORE
        );

      const request =
        store.put(memory);


      request.onsuccess = () => {

        resolve();
      };


      request.onerror = () => {

        reject(
          request.error
        );
      };
    }
  );
}


// --------------------------------------------------
// FILE DATABASE HELPERS
// --------------------------------------------------

function getFilesForMemory(memoryId) {

  return new Promise(
    (resolve, reject) => {

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
        store.index(
          "memoryId"
        );

      const request =
        index.getAll(
          IDBKeyRange.only(
            memoryId
          )
        );


      request.onsuccess = () => {

        resolve(
          request.result || []
        );
      };


      request.onerror = () => {

        reject(
          request.error
        );
      };
    }
  );
}


function getFile(id) {

  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          FILE_STORE,
          "readonly"
        );

      const store =
        transaction.objectStore(
          FILE_STORE
        );

      const request =
        store.get(id);


      request.onsuccess = () => {

        resolve(
          request.result || null
        );
      };


      request.onerror = () => {

        reject(
          request.error
        );
      };
    }
  );
}


function saveFile(fileRecord) {

  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          FILE_STORE,
          "readwrite"
        );

      const store =
        transaction.objectStore(
          FILE_STORE
        );

      const request =
        store.put(fileRecord);


      request.onsuccess = () => {

        resolve();
      };


      request.onerror = () => {

        reject(
          request.error
        );
      };
    }
  );
}


function deleteFileRecord(id) {

  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          FILE_STORE,
          "readwrite"
        );

      const store =
        transaction.objectStore(
          FILE_STORE
        );

      const request =
        store.delete(id);


      request.onsuccess = () => {

        resolve();
      };


      request.onerror = () => {

        reject(
          request.error
        );
      };
    }
  );
}


function deleteMemoryRecord(id) {

  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          [
            MEMORY_STORE,
            FILE_STORE
          ],
          "readwrite"
        );


      const memoryStore =
        transaction.objectStore(
          MEMORY_STORE
        );

      const fileStore =
        transaction.objectStore(
          FILE_STORE
        );


      memoryStore.delete(id);


      const index =
        fileStore.index(
          "memoryId"
        );


      const request =
        index.openCursor(
          IDBKeyRange.only(id)
        );


      request.onsuccess =
        event => {

          const cursor =
            event.target.result;


          if (cursor) {

            cursor.delete();

            cursor.continue();
          }
        };


      transaction.oncomplete =
        () => {

          resolve();
        };


      transaction.onerror =
        () => {

          reject(
            transaction.error
          );
        };
    }
  );
}


// --------------------------------------------------
// ID
// --------------------------------------------------

function createId() {

  if (
    typeof crypto !== "undefined" &&
    crypto.randomUUID
  ) {

    return crypto.randomUUID();
  }


  return (
    Date.now().toString(36) +
    "-" +
    Math.random()
      .toString(36)
      .slice(2)
  );
}


// --------------------------------------------------
// CREATE MEMORY
// --------------------------------------------------

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

    id:
      createId(),

    name:
      name,

    createdAt:
      new Date().toISOString()
  };


  try {

    await saveMemory(
      memory
    );


    input.value =
      "";


    await displayMemories();

    await openMemory(
      memory.id
    );

  } catch (error) {

    console.error(
      error
    );


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
    document.getElementById(
      "tabs"
    );


  if (!tabs) {
    return;
  }


  tabs.innerHTML =
    "";


  let memories;


  try {

    memories =
      await getAllMemories();

  } catch (error) {

    console.error(
      error
    );


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


  for (
    const memory of memories
  ) {

    const tab =
      document.createElement(
        "div"
      );


    tab.className =
      "tab";


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


    const normalFiles =
      files.filter(
        file =>
          file.kind !==
          "background"
      );


    info.textContent =
      `${normalFiles.length} file` +
      `${
        normalFiles.length === 1
          ? ""
          : "s"
      }`;


    tab.appendChild(
      title
    );

    tab.appendChild(
      info
    );


    tab.addEventListener(
      "click",
      () =>
        openMemory(
          memory.id
        )
    );


    tabs.appendChild(
      tab
    );
  }
}


// --------------------------------------------------
// OPEN MEMORY
// --------------------------------------------------

async function openMemory(id) {

  const memory =
    await getMemory(
      id
    );


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


  const viewer =
    document.getElementById(
      "viewer"
    );


  if (title) {

    title.textContent =
      memory.name;
  }


  if (viewer) {

    viewer.style.display =
      "block";
  }


  await updateViewerBackground();

  await renderFiles();

  await updateStorageInfo();
}


// --------------------------------------------------
// CLOSE MEMORY
// --------------------------------------------------

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


// --------------------------------------------------
// BACKGROUND
// --------------------------------------------------

async function getBackgroundForMemory(
  memoryId
) {

  const files =
    await getFilesForMemory(
      memoryId
    );


  return (
    files.find(
      file =>
        file.kind ===
        "background"
    ) || null
  );
}


async function updateViewerBackground() {

  const viewer =
    document.getElementById(
      "viewer"
    );


  if (
    !viewer ||
    !currentMemoryId
  ) {

    return;
  }


  const background =
    await getBackgroundForMemory(
      currentMemoryId
    );


  viewer.style.backgroundImage =
    "none";


  viewer.style.backgroundColor =
    "#08090d";


  if (
    !background ||
    !background.blob
  ) {

    return;
  }


  const url =
    URL.createObjectURL(
      background.blob
    );


  objectURLs.add(
    url
  );


  viewer.style.backgroundImage =
    `linear-gradient(
      rgba(8,9,13,.78),
      rgba(8,9,13,.92)
    ), url("${url}")`;


  viewer.style.backgroundSize =
    "cover";


  viewer.style.backgroundPosition =
    "center";


  viewer.style.backgroundAttachment =
    "fixed";
}


async function uploadBackground(
  event
) {

  if (!currentMemoryId) {
    return;
  }


  const file =
    event.target.files[0];


  event.target.value =
    "";


  if (!file) {
    return;
  }


  if (
    !file.type.startsWith(
      "image/"
    )
  ) {

    alert(
      "The viewer background must be an image."
    );

    return;
  }


  try {

    const oldBackground =
      await getBackgroundForMemory(
        currentMemoryId
      );


    if (oldBackground) {

      await deleteFileRecord(
        oldBackground.id
      );
    }


    const backgroundRecord = {

      id:
        createId(),

      memoryId:
        currentMemoryId,

      kind:
        "background",

      name:
        file.name,

      type:
        file.type,

      size:
        file.size,

      createdAt:
        new Date().toISOString(),

      blob:
        file
    };


    await saveFile(
      backgroundRecord
    );


    await updateViewerBackground();

    await displayMemories();

    await updateStorageInfo();

  } catch (error) {

    console.error(
      error
    );


    alert(
      "Couldn't save the viewer background."
    );
  }
}


// --------------------------------------------------
// FILE UPLOAD
// --------------------------------------------------

async function uploadFiles(
  event
) {

  if (!currentMemoryId) {
    return;
  }


  const selectedFiles =
    Array.from(
      event.target.files
    );


  event.target.value =
    "";


  if (
    selectedFiles.length === 0
  ) {

    return;
  }


  for (
    const file of selectedFiles
  ) {

    // --------------------------------
    // VIDEO SIZE LIMIT
    // --------------------------------

    if (
      file.type.startsWith(
        "video/"
      )
    ) {

      if (
        file.size >
        MAX_VIDEO_SIZE
      ) {

        alert(
          `"${file.name}" is too large.\n\n` +
          `Maximum video size: 5 GB\n` +
          `This video: ${formatBytes(file.size)}`
        );

        continue;
      }
    }


    // --------------------------------
    // OTHER FILE SIZE LIMIT
    // --------------------------------

    else if (
      file.size >
      MAX_OTHER_FILE_SIZE
    ) {

      alert(
        `"${file.name}" is too large.\n\n` +
        `Maximum non-video file size: 1 GB\n` +
        `This file: ${formatBytes(file.size)}`
      );

      continue;
    }


    try {

      const fileRecord = {

        id:
          createId(),

        memoryId:
          currentMemoryId,

        kind:
          "file",

        name:
          file.name,

        type:
          file.type ||
          "application/octet-stream",

        size:
          file.size,

        createdAt:
          new Date().toISOString(),

        // IMPORTANT:
        // Store the actual File/Blob.
        // Do NOT convert large videos
        // to Base64.
        blob:
          file
      };


      await saveFile(
        fileRecord
      );


    } catch (error) {

      console.error(
        error
      );


      // IndexedDB quota errors commonly
      // happen when the browser refuses
      // to store more data.

      if (
        error.name ===
        "QuotaExceededError"
      ) {

        alert(
          `The browser ran out of storage while saving "${file.name}".\n\n` +
          `The 5 GB limit is only the app's maximum.` +
          ` Your browser still controls the actual storage available to this website.`
        );

      } else {

        alert(
          `Couldn't save ${file.name}.`
        );
      }
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


  const allFiles =
    await getFilesForMemory(
      currentMemoryId
    );


  const files =
    allFiles.filter(
      file =>
        file.kind !==
        "background"
    );


  if (files.length === 0) {

    container.innerHTML = `
      <div class="empty">
        This memory doesn't have any files yet.
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
      `${file.type || "File"} • ` +
      `${formatBytes(file.size)}`;


    element.appendChild(
      meta
    );


    if (!file.blob) {

      const error =
        document.createElement(
          "div"
        );


      error.textContent =
        "This file has no stored data.";


      element.appendChild(
        error
      );


      container.appendChild(
        element
      );


      continue;
    }


    const url =
      URL.createObjectURL(
        file.blob
      );


    objectURLs.add(
      url
    );


    // --------------------------------
    // IMAGE
    // --------------------------------

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
    }


    // --------------------------------
    // VIDEO
    // --------------------------------

    else if (
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


      // Don't immediately load the
      // entire giant video.
      video.preload =
        "metadata";


      // Useful for VR/headset browsers.
      video.setAttribute(
        "playsinline",
        ""
      );


      element.appendChild(
        video
      );
    }


    // --------------------------------
    // AUDIO
    // --------------------------------

    else if (
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
    }


    // --------------------------------
    // OTHER FILE
    // --------------------------------

    else {

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


    // --------------------------------
    // DELETE BUTTON
    // --------------------------------

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


// --------------------------------------------------
// STORAGE INFORMATION
// --------------------------------------------------

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
        `Browser storage: ` +
        `${formatBytes(used)} used ` +
        `of approximately ` +
        `${formatBytes(quota)} ` +
        `(${percent}%).`;

    } else {

      element.textContent =
        `Browser storage used: ` +
        `${formatBytes(used)}.`;
    }


  } catch (error) {

    console.error(
      error
    );


    element.textContent =
      "Couldn't calculate browser storage.";
  }
}


// --------------------------------------------------
// UTILITIES
// --------------------------------------------------

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


// --------------------------------------------------
// BUTTONS / EVENTS
// --------------------------------------------------

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    try {

      await openDatabase();


      const createButton =
        document.getElementById(
          "createButton"
        );


      const closeButton =
        document.getElementById(
          "closeButton"
        );


      const uploadButton =
        document.getElementById(
          "uploadButton"
        );


      const backgroundButton =
        document.getElementById(
          "backgroundButton"
        );


      const fileInput =
        document.getElementById(
          "fileInput"
        );


      const backgroundInput =
        document.getElementById(
          "backgroundInput"
        );


      const memoryName =
        document.getElementById(
          "memoryName"
        );


      if (createButton) {

        createButton.addEventListener(
          "click",
          createMemory
        );
      }


      if (closeButton) {

        closeButton.addEventListener(
          "click",
          closeMemory
        );
      }


      if (
        uploadButton &&
        fileInput
      ) {

        uploadButton.addEventListener(
          "click",
          () =>
            fileInput.click()
        );
      }


      if (
        backgroundButton &&
        backgroundInput
      ) {

        backgroundButton.addEventListener(
          "click",
          () =>
            backgroundInput.click()
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


      if (memoryName) {

        memoryName.addEventListener(
          "keydown",
          event => {

            if (
              event.key ===
              "Enter"
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
        error
      );


      const tabs =
        document.getElementById(
          "tabs"
        );


      if (tabs) {

        tabs.innerHTML = `
          <div class="empty">
            Your browser could not start the
            Memories storage system.
          </div>
        `;
      }
    }
  }
);


// --------------------------------------------------
// CLEANUP
// --------------------------------------------------

window.addEventListener(
  "beforeunload",
  clearObjectURLs
);
