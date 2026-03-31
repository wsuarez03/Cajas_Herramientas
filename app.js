const STORAGE_KEY = "herramienta-cajas-v1";
const SHARED_STORAGE_PREFIX = "herramienta-cajas-shared-v1";

const defaultTools = [
  "Martillo",
  "Destornillador plano",
  "Destornillador estrella",
  "Llave ajustable",
  "Alicate",
  "Cinta metrica"
];

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

const state = {
  activeBoxId: "",
  pageMode: "ver",   // "ver" | "editar"
  boxes: {},
  validationMode: false,
  sharedView: false,
  sharedStorageKey: ""
};

const ui = {
  pageTitle:       document.getElementById("pageTitle"),
  pageSubtitle:    document.getElementById("pageSubtitle"),
  toolList:        document.getElementById("toolList"),
  checkForm:       document.getElementById("checkForm"),
  historyList:     document.getElementById("historyList"),
  generalNotes:    document.getElementById("generalNotes"),
  notesLabel:      document.getElementById("notesLabel"),
  actionsBar:      document.getElementById("actionsBar"),
  btnValidate:     document.getElementById("btnValidate"),
  validateHint:    document.getElementById("validateHint"),
  btnAddTool:      document.getElementById("btnAddTool"),
  btnExport:       document.getElementById("btnExport"),
  btnReset:        document.getElementById("btnReset"),
  editWorkerCard:  document.getElementById("editWorkerCard"),
  workerName:      document.getElementById("workerName"),
  workerForm:      document.getElementById("workerForm"),
  toolDialog:      document.getElementById("toolDialog"),
  toolDialogForm:  document.getElementById("toolDialogForm"),
  newToolName:     document.getElementById("newToolName"),
  cancelToolDialog:document.getElementById("cancelToolDialog"),
  resultShareDialog: document.getElementById("resultShareDialog"),
  resultShareLinkField: document.getElementById("resultShareLinkField"),
  btnNativeShare: document.getElementById("btnNativeShare"),
  btnWhatsappShare: document.getElementById("btnWhatsappShare"),
  btnEmailShare: document.getElementById("btnEmailShare"),
  btnCopyResultShareLink: document.getElementById("btnCopyResultShareLink"),
  btnCloseResultShareDialog: document.getElementById("btnCloseResultShareDialog")
};

function encodeSharePayload(payload) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function decodeSharePayload(value) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(value))));
  } catch {
    return null;
  }
}

function buildShareLinkFromBox(boxId, box) {
  const payload = encodeSharePayload({
    boxId,
    workerName: box.workerName || "",
    generalNotes: box.generalNotes || "",
    tools: box.tools.map((tool) => ({
      name: tool.name || "",
      status: tool.status || "ok",
      observation: tool.observation || ""
    }))
  });

  const shareUrl = new URL("caja.html", window.location.href);
  shareUrl.searchParams.set("box", boxId);
  shareUrl.searchParams.set("mode", "ver");
  shareUrl.searchParams.set("share", payload);
  return shareUrl.toString();
}

function buildShareMessage(link) {
  const box = getActiveBox();
  const worker = box?.workerName ? ` de ${box.workerName}` : "";
  return `Checklist guardado para ${state.activeBoxId}${worker}. Revise el detalle aqui: ${link}`;
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

function updateShareDialogOptions(link) {
  const message = buildShareMessage(link);
  const whatsappUrl = new URL("https://wa.me/");
  whatsappUrl.searchParams.set("text", message);

  ui.resultShareLinkField.value = link;
  ui.resultShareDialog.dataset.link = link;
  ui.resultShareDialog.dataset.message = message;
  ui.btnWhatsappShare.href = whatsappUrl.toString();
  ui.btnEmailShare.href = `mailto:?subject=${encodeURIComponent(`Checklist ${state.activeBoxId}`)}&body=${encodeURIComponent(message)}`;
  ui.btnNativeShare.disabled = !(navigator.share && window.isSecureContext);
}

function openResultShareDialog() {
  const box = getActiveBox();
  if (!box) return;

  const link = buildShareLinkFromBox(state.activeBoxId, box);
  updateShareDialogOptions(link);
  ui.resultShareDialog.showModal();
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      state.boxes = parsed.boxes || {};
    }
  } catch {
    state.boxes = {};
  }
}

function saveState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  let stored = {};
  try { stored = JSON.parse(raw) || {}; } catch {}
  stored.boxes = state.boxes;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

function buildSharedStorageKey(boxId, shareParam) {
  return `${SHARED_STORAGE_PREFIX}:${boxId}:${shareParam}`;
}

function persistActiveBox() {
  const box = getActiveBox();
  if (!box) return;

  if (state.sharedView && state.sharedStorageKey) {
    localStorage.setItem(state.sharedStorageKey, JSON.stringify(box));
    return;
  }

  saveState();
}

function getActiveBox() {
  return state.boxes[state.activeBoxId];
}

function renderPageHeader() {
  const box = getActiveBox();
  const worker = box ? (box.workerName || "Sin propietario") : "—";
  let modeLabel = state.pageMode === "editar" ? " · Edicion" : " · Vista";
  if (state.sharedView) {
    modeLabel = state.validationMode ? " · Checklist compartido" : " · Enlace compartido";
  }

  ui.pageTitle.textContent = state.activeBoxId ? state.activeBoxId.toUpperCase() : "CAJA";
  ui.pageSubtitle.textContent = box
    ? "Propietario: " + worker + modeLabel
    : "Abra esta pagina con un enlace valido de caja.";
}

function renderTools() {
  const box = getActiveBox();
  ui.toolList.innerHTML = "";

  if (!box) {
    ui.toolList.innerHTML = '<p class="muted">No se encontro esta caja.</p>';
    return;
  }

  box.tools.forEach((tool, index) => {
    const wrap = document.createElement("article");
    wrap.className = `tool-row ${state.validationMode ? "is-check" : "is-list"}`;

    if (state.validationMode) {
      wrap.innerHTML = `
        <div class="tool-header">
          <div class="tool-name">${escapeHtml(tool.name)}</div>
        </div>
        <div class="status-group">
          <label class="status-option status-ok">
            <input type="radio" name="status-${index}" value="ok" ${tool.status === "ok" ? "checked" : ""} />
            OK
          </label>
          <label class="status-option status-bad">
            <input type="radio" name="status-${index}" value="no-ok" ${tool.status === "no-ok" ? "checked" : ""} />
            No OK
          </label>
        </div>
        <label>
          Observacion
          <input type="text" data-obs-index="${index}" placeholder="Opcional" value="${escapeHtml(tool.observation)}" />
        </label>
      `;
    } else if (state.pageMode === "editar") {
      wrap.innerHTML = `
        <div class="tool-header">
          <div class="tool-name">${index + 1}. ${escapeHtml(tool.name)}</div>
          <button type="button" class="danger btn-del-tool" data-index="${index}">Eliminar</button>
        </div>
      `;
    } else {
      wrap.innerHTML = `
        <div class="tool-header">
          <div class="tool-name">${index + 1}. ${escapeHtml(tool.name)}</div>
        </div>
      `;
    }

    ui.toolList.appendChild(wrap);
  });

  // Botones eliminar (modo editar, fuera de checklist)
  if (state.pageMode === "editar" && !state.validationMode) {
    ui.toolList.querySelectorAll(".btn-del-tool").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.index);
        const box = getActiveBox();
        if (!box) return;
        const toolName = box.tools[idx].name;
        if (confirm(`¿Eliminar "${toolName}" del listado?`)) {
          box.tools.splice(idx, 1);
          persistActiveBox();
          renderTools();
        }
      });
    });
  }

  ui.generalNotes.value = box.generalNotes || "";
}

function renderHistory() {
  const box = getActiveBox();
  ui.historyList.innerHTML = "";

  if (!box || box.history.length === 0) {
    ui.historyList.innerHTML = '<p class="muted">Sin registros aún.</p>';
    return;
  }

  const top = box.history.slice(-8).reverse();
  top.forEach((entry) => {
    const noOkCount = entry.items.filter((x) => x.status === "no-ok").length;
    const item = document.createElement("article");
    item.className = "history-item";

    item.innerHTML = `
      <strong>${new Date(entry.timestamp).toLocaleString()}</strong>
      <div class="history-meta">
        Total: ${entry.items.length} · No OK: ${noOkCount}
      </div>
      <div>${escapeHtml(entry.generalNotes || "Sin observaciones")}</div>
    `;

    ui.historyList.appendChild(item);
  });
}

function render() {
  renderPageHeader();

  const box = getActiveBox();
  const isEditar = state.pageMode === "editar";
  const isShared = state.sharedView;

  // Boton validar
  if (ui.btnValidate) {
    ui.btnValidate.textContent = state.validationMode ? "Ver listado" : "Validar";
    ui.btnValidate.classList.toggle("active", state.validationMode);
    ui.btnValidate.disabled = !box;
    ui.btnValidate.classList.remove("hidden");
  }

  if (ui.validateHint) {
    if (isShared) {
      ui.validateHint.textContent = state.validationMode
        ? "Complete el checklist y guarde el resultado en este dispositivo."
        : "Este enlace compartido permite validar las herramientas sin iniciar sesion.";
    } else {
      ui.validateHint.textContent = state.validationMode
        ? "Modo checklist activo: seleccione OK / No OK y agregue observaciones."
        : "Presione Validar para cambiar este listado a checklist.";
    }
  }

  // Agregar herramienta: siempre visible en editar; oculto en ver cuando hay checklist activo
  ui.btnAddTool.disabled = !box || isShared;
  ui.btnAddTool.classList.toggle("hidden", isShared || (!isEditar && state.validationMode));

  // Notas y acciones: solo en modo checklist
  ui.notesLabel.classList.toggle("hidden", !state.validationMode);
  ui.actionsBar.classList.toggle("hidden", !state.validationMode);

  // Tarjeta edicion propietario: solo en editar
  ui.editWorkerCard.classList.toggle("hidden", isShared || !isEditar);
  if (!isShared && isEditar && box) {
    ui.workerName.value = box.workerName || "";
  }

  renderTools();
  renderHistory();
}

function createOrLoadBox(boxId) {
  if (!state.boxes[boxId]) {
    const template = predefinedBoxes[boxId];
    if (template) {
      state.boxes[boxId] = {
        workerName: template.workerName || "",
        tools: template.tools.map((name) => ({ name, status: "ok", observation: "" })),
        generalNotes: "",
        history: []
      };
    } else {
      state.boxes[boxId] = {
        workerName: "",
        tools: defaultTools.map((name) => ({ name, status: "ok", observation: "" })),
        generalNotes: "",
        history: []
      };
    }
    saveState();
  }
  state.activeBoxId = boxId;
}

function loadSharedBoxFromUrl(boxId, shareParam) {
  const payload = decodeSharePayload(shareParam);
  if (!payload || !Array.isArray(payload.tools)) {
    return false;
  }

  state.sharedStorageKey = buildSharedStorageKey(boxId, shareParam);

  let sharedBox = null;
  const storedShared = localStorage.getItem(state.sharedStorageKey);
  if (storedShared) {
    try {
      sharedBox = JSON.parse(storedShared);
    } catch {
      sharedBox = null;
    }
  }

  state.boxes[boxId] = sharedBox || {
    workerName: payload.workerName || "",
    generalNotes: payload.generalNotes || "",
    tools: payload.tools.map((tool) => ({
      name: tool.name || "",
      status: tool.status || "ok",
      observation: tool.observation || ""
    })),
    history: Array.isArray(payload.history) ? payload.history : []
  };

  state.activeBoxId = boxId;
  state.sharedView = true;
  state.pageMode = "ver";
  state.validationMode = false;
  return true;
}

function collectChecklistFromUI() {
  const box = getActiveBox();
  if (!box) return;

  box.tools.forEach((tool, i) => {
    const selected = document.querySelector(`input[name="status-${i}"]:checked`);
    tool.status = selected ? selected.value : "ok";

    const obsInput = document.querySelector(`input[data-obs-index="${i}"]`);
    tool.observation = obsInput ? obsInput.value.trim() : "";
  });

  box.generalNotes = ui.generalNotes.value.trim();
}

function saveChecklist() {
  const box = getActiveBox();
  if (!box) return;

  collectChecklistFromUI();

  box.history.push({
    timestamp: new Date().toISOString(),
    generalNotes: box.generalNotes,
    items: box.tools.map((t) => ({
      name: t.name,
      status: t.status,
      observation: t.observation
    }))
  });

  persistActiveBox();
  renderHistory();
  openResultShareDialog();
}

function resetCurrentStatus() {
  const box = getActiveBox();
  if (!box) return;

  box.tools = box.tools.map((t) => ({
    ...t,
    status: "ok",
    observation: ""
  }));
  box.generalNotes = "";

  persistActiveBox();
  render();
}

function exportHistoryCsv() {
  const box = getActiveBox();
  if (!box || box.history.length === 0) {
    alert("No hay historial para exportar.");
    return;
  }

  const lines = [
    ["boxId", "worker", "timestamp", "tool", "status", "observation", "generalNotes"].join(",")
  ];

  box.history.forEach((entry) => {
    entry.items.forEach((item) => {
      lines.push([
        csvEscape(state.activeBoxId),
        csvEscape(box.workerName || ""),
        csvEscape(entry.timestamp),
        csvEscape(item.name),
        csvEscape(item.status),
        csvEscape(item.observation || ""),
        csvEscape(entry.generalNotes || "")
      ].join(","));
    });
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `historial-${state.activeBoxId}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const safe = String(value ?? "").replace(/"/g, '""');
  return `"${safe}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setupEvents() {
  ui.checkForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveChecklist();
  });

  ui.btnReset.addEventListener("click", () => {
    const ok = confirm("¿Desea reiniciar el estado actual del checklist?");
    if (ok) resetCurrentStatus();
  });

  ui.btnExport.addEventListener("click", exportHistoryCsv);

  ui.btnValidate.addEventListener("click", () => {
    state.validationMode = !state.validationMode;
    render();
  });

  ui.btnAddTool.addEventListener("click", () => {
    ui.newToolName.value = "";
    ui.toolDialog.showModal();
    ui.newToolName.focus();
  });

  ui.cancelToolDialog.addEventListener("click", () => {
    ui.toolDialog.close();
  });

  ui.toolDialogForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const box = getActiveBox();
    if (!box) return;

    const name = ui.newToolName.value.trim();
    if (!name) return;

    box.tools.push({ name, status: "ok", observation: "" });
    persistActiveBox();
    renderTools();
    ui.toolDialog.close();
  });

  ui.workerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const box = getActiveBox();
    if (!box) return;
    box.workerName = ui.workerName.value.trim();
    persistActiveBox();
    renderPageHeader();
    alert("Nombre guardado.");
  });

  ui.btnCloseResultShareDialog.addEventListener("click", () => {
    ui.resultShareDialog.close();
  });

  ui.btnCopyResultShareLink.addEventListener("click", async () => {
    const link = ui.resultShareDialog.dataset.link || ui.resultShareLinkField.value;
    if (!link) return;

    const copied = await copyText(link);
    if (copied) {
      alert("Enlace copiado al portapapeles.");
      return;
    }

    ui.resultShareLinkField.focus();
    ui.resultShareLinkField.select();
    window.prompt("Copie este enlace para compartir el checklist:", link);
  });

  ui.btnNativeShare.addEventListener("click", async () => {
    const link = ui.resultShareDialog.dataset.link;
    const message = ui.resultShareDialog.dataset.message;
    if (!link || !navigator.share) return;

    try {
      await navigator.share({
        title: `Checklist ${state.activeBoxId}`,
        text: message,
        url: link
      });
    } catch {}
  });
}

async function disableServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch {}
  }

  if ("caches" in window) {
    try {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    } catch {}
  }
}

async function init() {
  const params = new URL(window.location.href).searchParams;
  const rawBox = params.get("box") || "";
  const shareParam = params.get("share") || "";
  const boxId = rawBox.trim().toLowerCase().replace(/\s+/g, "-");
  state.pageMode = params.get("mode") === "editar" ? "editar" : "ver";
  state.sharedView = false;
  state.sharedStorageKey = "";

  await disableServiceWorker();

  if (!boxId) {
    state.activeBoxId = "";
    render();
    return;
  }

  loadState();
  if (!loadSharedBoxFromUrl(boxId, shareParam)) {
    createOrLoadBox(boxId);
  }
  setupEvents();
  render();
}

init();
