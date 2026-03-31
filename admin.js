const STORAGE_KEY = "herramienta-cajas-v1";
const SESSION_KEY = "hc-auth";
const ADMIN_USER = "admin";
const ADMIN_PASS = "Admin123*";
const QR_API_BASE = "https://api.qrserver.com/v1/create-qr-code/";

const predefinedBoxes = {
  "caja-5": {
    workerName: "Brayan Benjamin",
    tools: [
      "Esfero negro",
      "Marcador naranja Primavera",
      "Juego botadores 6 unidades cromado Sata",
      "Juego de llaves mixtas Stanley (8 unidades)",
      "Hombre solo mediano Irwin",
      "Llave de aviacion Stanley verde",
      "Hombre solo de cadena",
      "Martillo de bola Toolcraft",
      "Hombre solo de pinza Sata",
      "Llave expansiva Toolcraft 6\"",
      "Llave expansiva Sata 300 mm",
      "Alicates amarillos",
      "Pinza de punta o cortafrios de punta Sata",
      "Juego de llaves Bristol pulgadas 13 unidades verde",
      "Juego de llaves Bristol mm 9 unidades azul",
      "Destornillador azul estrella Diamond Tip",
      "Destornillador rojo pala Diamond Tip",
      "Pelacables Total calibre 2 cero",
      "Pinza para anillos seeger Utustools 7\" recta",
      "Pinza para anillos seeger Utustools 7\" 90 grados",
      "Cincel Urrea 7/8\" X 8\"",
      "Cincel Urrea Utustools 7\"",
      "Flexometro Rimek transparente",
      "Perillero pala Stanley rojo",
      "Perillero estrella Stanley azul",
      "Candado Fanal 3 llaves",
      "Caja herramientas Sata",
      "Esmalte",
      "Bisturi amarillo"
    ]
  }
};

const defaultTools = [
  "Martillo",
  "Destornillador plano",
  "Destornillador estrella",
  "Llave ajustable",
  "Alicate",
  "Cinta metrica"
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeBoxId(value) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, "-");
}

function encodeSharePayload(payload) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function getBoxForShare(id) {
  const stored = loadBoxesFromStorage();
  const storedBox = stored[id];
  if (storedBox) {
    return {
      workerName: storedBox.workerName || "",
      generalNotes: storedBox.generalNotes || "",
      tools: Array.isArray(storedBox.tools) ? storedBox.tools.map((tool) => ({
        name: tool.name || "",
        status: tool.status || "ok",
        observation: tool.observation || ""
      })) : [],
      history: Array.isArray(storedBox.history) ? storedBox.history : []
    };
  }

  const predefined = predefinedBoxes[id];
  if (predefined) {
    return {
      workerName: predefined.workerName || "",
      generalNotes: "",
      tools: predefined.tools.map((name) => ({ name, status: "ok", observation: "" })),
      history: []
    };
  }

  return null;
}

function buildShareLink(id) {
  const box = getBoxForShare(id);
  if (!box) return "";

  const payload = encodeSharePayload({
    boxId: id,
    workerName: box.workerName,
    generalNotes: box.generalNotes,
    tools: box.tools
  });

  const shareUrl = new URL("caja.html", window.location.href);
  shareUrl.searchParams.set("box", id);
  shareUrl.searchParams.set("mode", "ver");
  shareUrl.searchParams.set("share", payload);
  return shareUrl.toString();
}

function buildShareQrUrl(link) {
  const qrUrl = new URL(QR_API_BASE);
  qrUrl.searchParams.set("size", "280x280");
  qrUrl.searchParams.set("data", link);
  return qrUrl.toString();
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}

  return false;
}

async function shareBox(id) {
  const link = buildShareLink(id);
  if (!link) {
    alert("No fue posible generar el enlace para esta caja.");
    return;
  }

  const shareDialog = document.getElementById("shareDialog");
  const shareQrImage = document.getElementById("shareQrImage");
  const shareLinkField = document.getElementById("shareLinkField");
  const openLink = document.getElementById("btnOpenShareLink");

  shareLinkField.value = link;
  shareQrImage.src = buildShareQrUrl(link);
  openLink.href = link;
  shareDialog.dataset.link = link;
  shareDialog.showModal();

  const copied = await copyText(link);
  if (copied) {
    alert("Enlace copiado al portapapeles y QR generado.");
  }
}

function checkAuth() {
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────

function loadBoxesFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return (parsed && parsed.boxes) ? parsed.boxes : {};
  } catch {
    return {};
  }
}

function saveBoxesToStorage(boxes) {
  const raw = localStorage.getItem(STORAGE_KEY);
  let stored = {};
  try { stored = JSON.parse(raw) || {}; } catch {}
  stored.boxes = boxes;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

// ─── DASHBOARD DATA ───────────────────────────────────────────────────────────

function getAllBoxIds() {
  const stored = loadBoxesFromStorage();
  const ids = new Set([...Object.keys(predefinedBoxes), ...Object.keys(stored)]);
  return [...ids];
}

function getWorkerName(id) {
  const stored = loadBoxesFromStorage();
  if (stored[id] && stored[id].workerName) return stored[id].workerName;
  if (predefinedBoxes[id] && predefinedBoxes[id].workerName) return predefinedBoxes[id].workerName;
  return "—";
}

// ─── PANEL SWITCHING ─────────────────────────────────────────────────────────

function showLogin() {
  document.getElementById("loginPanel").classList.remove("hidden");
  document.getElementById("dashPanel").classList.add("hidden");
}

function showDashboard() {
  document.getElementById("loginPanel").classList.add("hidden");
  document.getElementById("dashPanel").classList.remove("hidden");
  renderBoxesTable();
}

function doLogout() {
  sessionStorage.removeItem(SESSION_KEY);
  showLogin();
}

// ─── TABLE RENDER ─────────────────────────────────────────────────────────────

function renderBoxesTable() {
  const ids = getAllBoxIds();
  const container = document.getElementById("boxesTable");

  if (ids.length === 0) {
    container.innerHTML = '<p class="muted">No hay cajas registradas. Crea una nueva con el botón de arriba.</p>';
    return;
  }

  const table = document.createElement("table");
  table.className = "boxes-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>ID Caja</th>
        <th>Propietario</th>
        <th>Acciones</th>
      </tr>
    </thead>
    <tbody id="boxesTbody"></tbody>
  `;

  const tbody = table.querySelector("tbody");

  ids.forEach((id) => {
    const worker = getWorkerName(id);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(id)}</strong></td>
      <td>${escapeHtml(worker)}</td>
      <td>
        <div class="table-actions">
          <a href="caja.html?box=${encodeURIComponent(id)}&mode=ver" class="btn-action btn-ver">Ver</a>
          <a href="caja.html?box=${encodeURIComponent(id)}&mode=editar" class="btn-action btn-editar">Editar</a>
          <button class="btn-action btn-share" data-share-id="${escapeHtml(id)}">Compartir</button>
          <button class="btn-action btn-del danger" data-id="${escapeHtml(id)}">Eliminar</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  container.innerHTML = "";
  container.appendChild(table);

  tbody.querySelectorAll(".btn-del").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (confirm(`¿Eliminar la caja "${id}"?\nSe perderá todo el historial guardado.`)) {
        const boxes = loadBoxesFromStorage();
        delete boxes[id];
        saveBoxesToStorage(boxes);
        renderBoxesTable();
      }
    });
  });

  tbody.querySelectorAll(".btn-share").forEach((btn) => {
    btn.addEventListener("click", () => {
      shareBox(btn.dataset.shareId);
    });
  });
}

// ─── NEW BOX ─────────────────────────────────────────────────────────────────

function createNewBox(rawId, worker) {
  const id = normalizeBoxId(rawId);
  if (!id) return false;

  const boxes = loadBoxesFromStorage();
  if (boxes[id]) {
    alert(`La caja "${id}" ya existe.`);
    return false;
  }

  const template = predefinedBoxes[id];
  if (template) {
    boxes[id] = {
      workerName: worker || template.workerName || "",
      tools: template.tools.map((name) => ({ name, status: "ok", observation: "" })),
      generalNotes: "",
      history: []
    };
  } else {
    boxes[id] = {
      workerName: worker || "",
      tools: defaultTools.map((name) => ({ name, status: "ok", observation: "" })),
      generalNotes: "",
      history: []
    };
  }

  saveBoxesToStorage(boxes);
  return true;
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

function init() {
  // QR backward-compat: if index.html is loaded with ?box=xxx, redirect to caja.html
  const params = new URL(window.location.href).searchParams;
  const bxParam = params.get("box");
  if (bxParam) {
    const dest = `caja.html?box=${encodeURIComponent(bxParam)}&mode=ver`;
    window.location.href = dest;
    return;
  }

  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const btnLogout = document.getElementById("btnLogout");
  const btnNewBox = document.getElementById("btnNewBox");
  const newBoxDialog = document.getElementById("newBoxDialog");
  const newBoxForm = document.getElementById("newBoxForm");
  const cancelNewBox = document.getElementById("cancelNewBox");
  const shareDialog = document.getElementById("shareDialog");
  const btnCopyShareLink = document.getElementById("btnCopyShareLink");
  const btnCloseShareDialog = document.getElementById("btnCloseShareDialog");
  const shareLinkField = document.getElementById("shareLinkField");

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const user = document.getElementById("loginUser").value.trim();
    const pass = document.getElementById("loginPass").value;

    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      sessionStorage.setItem(SESSION_KEY, "1");
      loginError.classList.add("hidden");
      document.getElementById("loginPass").value = "";

      const redirect = sessionStorage.getItem("hc-redirect");
      if (redirect) {
        sessionStorage.removeItem("hc-redirect");
        window.location.href = redirect;
        return;
      }
      showDashboard();
    } else {
      loginError.classList.remove("hidden");
      document.getElementById("loginPass").value = "";
      document.getElementById("loginPass").focus();
    }
  });

  btnLogout.addEventListener("click", doLogout);

  btnNewBox.addEventListener("click", () => {
    document.getElementById("newBoxId").value = "";
    document.getElementById("newBoxWorker").value = "";
    newBoxDialog.showModal();
    document.getElementById("newBoxId").focus();
  });

  cancelNewBox.addEventListener("click", () => newBoxDialog.close());

  btnCloseShareDialog.addEventListener("click", () => shareDialog.close());

  btnCopyShareLink.addEventListener("click", async () => {
    const link = shareDialog.dataset.link || shareLinkField.value;
    if (!link) return;

    const copied = await copyText(link);
    if (copied) {
      alert("Enlace copiado al portapapeles.");
      return;
    }

    shareLinkField.focus();
    shareLinkField.select();
    window.prompt("Copie este enlace para compartir la caja:", link);
  });

  newBoxForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const rawId = document.getElementById("newBoxId").value;
    const worker = document.getElementById("newBoxWorker").value.trim();
    if (createNewBox(rawId, worker)) {
      newBoxDialog.close();
      renderBoxesTable();
    }
  });

  if (checkAuth()) {
    showDashboard();
  } else {
    showLogin();
  }
}

init();
