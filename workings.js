// Memories - browser-side JavaScript

let memories = [];
let currentMemoryId = null;

const STORAGE_KEY = "memories-data-v1";

function loadMemories() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      memories = JSON.parse(saved);
    } else {
      memories = [];
    }
  } catch (error) {
    console.error("Could not load memories:", error);
    memories = [];
  }

  displayMemories();
}

function saveMemories() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(memories)
    );
  } catch (error) {
    console.error("Could not save memories:", error);

    alert(
      "The browser could not save this memory. The files may be too large."
    );
  }
}

function createMemory() {
  const input = document.getElementById("memoryName");

  if (!input) return;

  const name = input.value.trim();

  if (!name) {
    alert("Give your memory a name first!");
    return;
  }

  if (name.length > 60) {
    alert("The memory name is too long.");
    return;
  }

  const memory = {
    id:
      Date.now().toString() +
      "-" +
      Math.random().toString(36).slice(2),

    name: name,

    background: null,

    files: [],

    createdAt: new Date().toISOString()
  };

  memories.push(memory);

  saveMemories();

  input.value = "";

  displayMemories();

  openMemory(memory.id);
}

function displayMemories() {
  const tabs = document.getElementById("tabs");

  if (!tabs) return;

  tabs.innerHTML = "";

  if (memories.length === 0) {
    tabs.innerHTML = `
      <div class="empty">
        No memories yet.<br>
        Create the first one!
      </div>
    `;

    return;
  }

  memories.forEach(memory => {
    const tab = document.createElement("div");

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

    const title = document.createElement("h2");

    title.textContent = memory.name;

    const info = document.createElement("div");

    info.className = "tab-info";

    info.textContent =
      `${memory.files.length} file` +
      (memory.files.length === 1 ? "" : "s");

    tab.appendChild(title);
    tab.appendChild(info);

    tab.addEventListener("click", () => {
      openMemory(memory.id);
    });

    tabs.appendChild(tab);
  });
}

function openMemory(id) {
  const memory = memories.find(
    item => item.id === id
  );

  if (!memory) {
    alert("Memory not found.");
    return;
  }

  currentMemoryId = id;

  const title =
    document.getElementById("viewerTitle");

  const viewer =
    document.getElementById("viewer");

  if (title) {
    title.textContent = memory.name;
  }

  if (viewer) {
    viewer.style.display = "block";
  }

  renderFiles();
}

function closeMemory() {
  const viewer =
    document.getElementById("viewer");

  if (viewer) {
    viewer.style.display = "none";
  }

  currentMemoryId = null;
}

function getCurrentMemory() {
  return memories.find(
    memory => memory.id === currentMemoryId
  );
}

function renderFiles() {
  const container =
    document.getElementById("files");

  if (!container) return;

  const memory = getCurrentMemory();

  if (!memory) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = "";

  if (memory.files.length === 0) {
    container.innerHTML = `
      <div class="empty">
        This memory doesn't have any files yet.
      </div>
    `;

    return;
  }

  memory.files.forEach(file => {
    const element =
      document.createElement("div");

    element.className = "file";

    const name =
      document.createElement("div");

    name.className = "file-name";

    name.textContent = file.name;

    element.appendChild(name);

    if (file.type.startsWith("image/")) {
      const image =
        document.createElement("img");

      image.src = file.data;

      image.alt = file.name;

      element.appendChild(image);

    } else if (file.type.startsWith("video/")) {
      const video =
        document.createElement("video");

      video.src = file.data;

      video.controls = true;

      video.playsInline = true;

      element.appendChild(video);

    } else if (file.type.startsWith("audio/")) {
      const audio =
        document.createElement("audio");

      audio.src = file.data;

      audio.controls = true;

      element.appendChild(audio);

    } else {
      const link =
        document.createElement("a");

      link.href = file.data;

      link.download = file.name;

      link.target = "_blank";

      link.textContent =
        "Open / download file";

      element.appendChild(link);
    }

    container.appendChild(element);
  });
}

function uploadFiles(event) {
  const memory = getCurrentMemory();

  if (!memory) return;

  const selectedFiles =
    Array.from(event.target.files);

  if (selectedFiles.length === 0) {
    return;
  }

  let finished = 0;

  selectedFiles.forEach(file => {
    const reader =
      new FileReader();

    reader.onload = () => {
      memory.files.push({
        id:
          Date.now().toString() +
          "-" +
          Math.random().toString(36).slice(2),

        name: file.name,

        type:
          file.type ||
          "application/octet-stream",

        data: reader.result
      });

      finished++;

      if (finished === selectedFiles.length) {
        saveMemories();

        renderFiles();

        displayMemories();
      }
    };

    reader.onerror = () => {
      finished++;

      alert(
        `Couldn't read ${file.name}.`
      );

      if (finished === selectedFiles.length) {
        saveMemories();

        renderFiles();

        displayMemories();
      }
    };

    reader.readAsDataURL(file);
  });

  event.target.value = "";
}

function uploadBackground(event) {
  const memory = getCurrentMemory();

  if (!memory) return;

  const file =
    event.target.files[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("The background must be an image.");

    event.target.value = "";

    return;
  }

  const reader =
    new FileReader();

  reader.onload = () => {
    memory.background = reader.result;

    saveMemories();

    displayMemories();

    const tab =
      Array.from(
        document.querySelectorAll(".tab")
      ).find(() => false);

    alert("Background saved!");
  };

  reader.onerror = () => {
    alert("Couldn't read the background image.");
  };

  reader.readAsDataURL(file);

  event.target.value = "";
}

document.addEventListener(
  "DOMContentLoaded",
  () => {
    const nameInput =
      document.getElementById("memoryName");

    if (nameInput) {
      nameInput.addEventListener(
        "keydown",
        event => {
          if (event.key === "Enter") {
            createMemory();
          }
        }
      );
    }

    loadMemories();
  }
);
