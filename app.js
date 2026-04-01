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

async function loadBoxesJson() {
  try {
    const res = await fetch("./boxes.json?v=" + Date.now());
    if (!res.ok) return;
    const data = await res.json();
    Object.assign(predefinedBoxes, data);
  } catch {}
}

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
  btnGenerateListado: document.getElementById("btnGenerateListado"),
  btnExport:       document.getElementById("btnExport"),
  btnReset:        document.getElementById("btnReset"),
  editWorkerCard:  document.getElementById("editWorkerCard"),
  workerName:      document.getElementById("workerName"),
  workerForm:      document.getElementById("workerForm"),
  toolDialog:      document.getElementById("toolDialog"),
  toolDialogForm:  document.getElementById("toolDialogForm"),
  newToolName:     document.getElementById("newToolName"),
  cancelToolDialog:document.getElementById("cancelToolDialog")
};

function decodeSharePayload(value) {
  try {
    // Intentar con LZString (nuevo formato)
    const lz = LZString.decompressFromEncodedURIComponent(value);
    if (lz) return JSON.parse(lz);
  } catch {}
  try {
    // Compatibilidad con links viejos (base64)
    return JSON.parse(decodeURIComponent(escape(atob(value))));
  } catch {}
  return null;
}

function buildPdfDoc() {
  const box = getActiveBox();
  if (!box) return null;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const date = new Date().toLocaleString("es-CO");
  const worker = box.workerName || "Sin propietario";
  const boxId = state.activeBoxId.toUpperCase();

  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text("CONTROL DE HERRAMIENTAS", 105, 20, { align: "center" });
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.text(`Caja: ${boxId}`, 14, 32);
  doc.text(`Propietario: ${worker}`, 14, 38);
  doc.text(`Fecha: ${date}`, 14, 44);

  const rows = box.tools.map((tool, i) => [
    i + 1,
    tool.name,
    tool.status === "ok" ? "OK" : "NO OK",
    tool.observation || ""
  ]);

  doc.autoTable({
    startY: 52,
    head: [["#", "Herramienta", "Estado", "Observación"]],
    body: rows,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [15, 76, 92], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 90 },
      2: { cellWidth: 25 },
      3: { cellWidth: 55 }
    }
  });

  let finalY = doc.lastAutoTable.finalY + 10;
  if (box.generalNotes) {
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("Observaciones generales:", 14, finalY);
    finalY += 6;
    doc.setFont(undefined, "normal");
    const lines = doc.splitTextToSize(box.generalNotes, 180);
    doc.text(lines, 14, finalY);
  }

  return doc;
}

function getPdfFileName() {
  return `${state.activeBoxId}-checklist-${new Date().toISOString().slice(0, 10)}.pdf`;
}

async function downloadPdf() {
  const doc = buildPdfDoc();
  if (!doc) return;
  doc.save(getPdfFileName());
}

const LISTADO_LOGO_CANDIDATES = [
  "./Logo Valser (2).png",
  "./logo.png",
  "./logo.jpg",
  "./logo.jpeg",
  "./logo.webp",
  "./Logo.png",
  "./Logo.jpg",
  "./img/logo.png",
  "./assets/logo.png"
];

const LISTADO_FORMAT_VERSION_DATE = "27/01/2023";

const listadoLogoState = {
  attempted: false,
  canvas: null
};

function tryLoadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = `${src}?v=${Date.now()}`;
  });
}

async function getListadoLogoCanvas() {
  if (listadoLogoState.attempted) return listadoLogoState.canvas;
  listadoLogoState.attempted = true;

  for (const path of LISTADO_LOGO_CANDIDATES) {
    const image = await tryLoadImage(path);
    if (!image) continue;

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    ctx.drawImage(image, 0, 0);
    listadoLogoState.canvas = canvas;
    return canvas;
  }

  return null;
}

function buildListadoPdfDoc(logoCanvas) {
  const box = getActiveBox();
  if (!box) return null;

  collectChecklistFromUI();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const date = new Date().toLocaleString("es-CO");
  const worker = box.workerName || "Sin propietario";
  const boxId = state.activeBoxId.toUpperCase();
  const rowsPerPage = 30;
  const rows = box.tools.map((tool, i) => ({
    index: i + 1,
    name: tool.name,
    quantity: "1",
    recibe: tool.status === "ok" ? "OK" : "NO OK",
    regresa: tool.observation || ""
  }));

  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));

  const fitText = (value, maxWidth) => {
    const raw = String(value ?? "");
    if (!raw) return "";
    if (doc.getTextWidth(raw) <= maxWidth) return raw;
    const ellipsis = "...";
    let text = raw;
    while (text.length > 0 && doc.getTextWidth(text + ellipsis) > maxWidth) {
      text = text.slice(0, -1);
    }
    return text ? text + ellipsis : ellipsis;
  };

  const drawHeader = (yTop) => {
    doc.setLineWidth(0.3);
    doc.rect(10, yTop, 277, 22);

    // Bloque logo (equivalente B2:C4) y bloque titulo (D2:R3).
    doc.rect(10, yTop, 30, 22);
    doc.rect(40, yTop, 247, 14);

    // Fila inferior de metadatos (equivalente fila 4 con celdas separadas).
    doc.rect(40, yTop + 14, 34, 8);
    doc.rect(74, yTop + 14, 44, 8);
    doc.rect(118, yTop + 14, 32, 8);
    doc.rect(150, yTop + 14, 24, 8);
    doc.rect(174, yTop + 14, 32, 8);
    doc.rect(206, yTop + 14, 81, 8);

    if (logoCanvas) {
      doc.addImage(logoCanvas, "PNG", 14, yTop + 3, 22, 16);
    } else {
      doc.setFontSize(7);
      doc.text("LOGO", 25, yTop + 11, { align: "center" });
    }

    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.text("INVENTARIO CAJAS DE HERRAMIENTAS MANUALES", 135, yTop + 9, { align: "center" });
    doc.setFontSize(8);
    doc.setFont(undefined, "normal");
    doc.text("CODIGO", 57, yTop + 19, { align: "center" });
    doc.text("OYS-FO-09", 96, yTop + 19, { align: "center" });
    doc.text("VERSION", 134, yTop + 19, { align: "center" });
    doc.text("01", 162, yTop + 19, { align: "center" });
    doc.text("FECHA", 190, yTop + 19, { align: "center" });
    doc.text(LISTADO_FORMAT_VERSION_DATE, 246.5, yTop + 19, { align: "center" });
  };

  const drawInfoBlocks = (yTop) => {
    doc.setLineWidth(0.25);
    doc.rect(10, yTop, 277, 14);
    doc.line(110, yTop, 110, yTop + 14);
    doc.line(195, yTop, 195, yTop + 14);

    doc.setFontSize(8);
    doc.setFont(undefined, "bold");
    doc.text("CAJA DE HERRAMIENTAS NUMERO", 12, yTop + 5.5);
    doc.text("FECHA RECIBE", 112, yTop + 5.5);
    doc.text("FECHA REGRESA", 197, yTop + 5.5);
    doc.setFont(undefined, "normal");
    doc.setFontSize(10);
    doc.text(boxId, 12, yTop + 11);
    doc.text(date, 112, yTop + 11);
    doc.text(date, 197, yTop + 11);

    doc.rect(10, yTop + 14, 277, 10);
    doc.line(170, yTop + 14, 170, yTop + 24);
    doc.setFontSize(8);
    doc.setFont(undefined, "bold");
    doc.text("NOMBRE DEL TECNICO", 12, yTop + 20);
    doc.text("IDENTIFICACION", 172, yTop + 20);
    doc.setFont(undefined, "normal");
    doc.text(fitText(worker, 112), 55, yTop + 20);
  };

  const drawFooter = (yTop) => {
    doc.setLineWidth(0.25);
    doc.rect(10, yTop, 277, 24);
    doc.line(148.5, yTop, 148.5, yTop + 24);
    doc.line(10, yTop + 5, 287, yTop + 5);
    doc.line(10, yTop + 11, 287, yTop + 11);
    doc.line(79, yTop + 5, 79, yTop + 24);
    doc.line(148.5 - 69, yTop + 5, 148.5 - 69, yTop + 24);
    doc.line(217.5, yTop + 5, 217.5, yTop + 24);

    doc.setFontSize(8);
    doc.setFont(undefined, "bold");
    doc.text("SALIDA", 79, yTop + 3.8, { align: "center" });
    doc.text("REGRESO", 218, yTop + 3.8, { align: "center" });
    doc.text("ENTREGA", 44.5, yTop + 9, { align: "center" });
    doc.text("RECIBE", 113.5, yTop + 9, { align: "center" });
    doc.text("ENTREGA", 183, yTop + 9, { align: "center" });
    doc.text("RECIBE", 252, yTop + 9, { align: "center" });

    doc.setFont(undefined, "normal");
    doc.text("NOMBRE", 44.5, yTop + 15, { align: "center" });
    doc.text("NOMBRE", 113.5, yTop + 15, { align: "center" });
    doc.text("NOMBRE", 183, yTop + 15, { align: "center" });
    doc.text("NOMBRE", 252, yTop + 15, { align: "center" });
    doc.text("FIRMA", 44.5, yTop + 21, { align: "center" });
    doc.text("FIRMA", 113.5, yTop + 21, { align: "center" });
    doc.text("FIRMA", 183, yTop + 21, { align: "center" });
    doc.text("FIRMA", 252, yTop + 21, { align: "center" });

    doc.rect(10, yTop + 24, 277, 8);
    doc.setFont(undefined, "bold");
    doc.text("OBSERVACIONES:", 12, yTop + 29);
    doc.setFont(undefined, "normal");
    if (box.generalNotes) {
      const notesLine = doc.splitTextToSize(box.generalNotes, 240).slice(0, 1);
      doc.text(notesLine, 45, yTop + 29);
    }
  };

  const drawTable = (pageRows, start) => {
    const x = 10;
    const y = 56;
    const tableWidth = 277;
    const headerHeight = 4;
    const rowHeight = 3.2;
    const totalRowsHeight = rowHeight * rowsPerPage;
    const tableHeight = headerHeight + totalRowsHeight;
    // Proporcion calculada de columnas B:R del formato Excel.
    const colWidths = [14.2, 173.9, 34.6, 20.6, 33.7];
    const colX = [x];

    for (let i = 0; i < colWidths.length; i++) {
      colX.push(colX[i] + colWidths[i]);
    }

    doc.setLineWidth(0.2);
    doc.rect(x, y, tableWidth, tableHeight);

    for (let i = 1; i < colX.length - 1; i++) {
      doc.line(colX[i], y, colX[i], y + tableHeight);
    }

    doc.line(x, y + headerHeight, x + tableWidth, y + headerHeight);
    for (let i = 1; i <= rowsPerPage; i++) {
      const yLine = y + headerHeight + (i * rowHeight);
      doc.line(x, yLine, x + tableWidth, yLine);
    }

    doc.setFontSize(7.2);
    doc.setFont(undefined, "bold");
    doc.text("ITEM", x + (colWidths[0] / 2), y + 2.9, { align: "center" });
    doc.text("DESCRIPCION", colX[1] + (colWidths[1] / 2), y + 2.9, { align: "center" });
    doc.text("CANTIDAD", colX[2] + (colWidths[2] / 2), y + 2.9, { align: "center" });
    doc.text("RECIBE", colX[3] + (colWidths[3] / 2), y + 2.9, { align: "center" });
    doc.text("REGRESA", colX[4] + (colWidths[4] / 2), y + 2.9, { align: "center" });

    doc.setFont(undefined, "normal");
    doc.setFontSize(6.6);
    for (let i = 0; i < rowsPerPage; i++) {
      const row = pageRows[i];
      const yText = y + headerHeight + (i * rowHeight) + 2.4;
      const itemNumber = row ? row.index : (start + i + 1);
      const description = row ? fitText(row.name, colWidths[1] - 2) : "";
      const qty = row ? row.quantity : "";
      const recibe = row ? fitText(row.recibe, colWidths[3] - 2) : "";
      const regresa = row ? fitText(row.regresa, colWidths[4] - 2) : "";

      doc.text(String(itemNumber), x + (colWidths[0] / 2), yText, { align: "center" });
      doc.text(description, colX[1] + 1, yText);
      doc.text(qty, colX[2] + (colWidths[2] / 2), yText, { align: "center" });
      doc.text(recibe, colX[3] + (colWidths[3] / 2), yText, { align: "center" });
      doc.text(regresa, colX[4] + 1, yText);
    }
  };

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) doc.addPage();

    const start = page * rowsPerPage;
    const pageRows = rows.slice(start, start + rowsPerPage);

    drawHeader(8);
    drawInfoBlocks(31);

    drawTable(pageRows, start);
    drawFooter(158);
  }

  return doc;
}

async function downloadListadoPdf() {
  const logoCanvas = await getListadoLogoCanvas();
  const doc = buildListadoPdfDoc(logoCanvas);
  if (!doc) return;
  const fileName = `${state.activeBoxId}-listado-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

async function sharePdf() {
  const doc = buildPdfDoc();
  if (!doc) return;
  const fileName = getPdfFileName();

  if (navigator.canShare) {
    const blob = doc.output("blob");
    const file = new File([blob], fileName, { type: "application/pdf" });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Checklist ${state.activeBoxId}` });
        return;
      } catch {}
    }
  }

  doc.save(fileName);
  alert("PDF descargado. Puede adjuntarlo y enviarlo por WhatsApp, correo u otra app.");
}

function openPdfDialog() {
  const dlg = document.getElementById("pdfDialog");
  if (dlg) dlg.showModal();
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
      const isOk = tool.status !== "no-ok";
      const showObservation = Boolean(tool.touched);
      wrap.innerHTML = `
        <div class="tool-header">
          <div class="tool-name">${escapeHtml(tool.name)}</div>
        </div>
        <div class="status-group">
          <label class="status-option status-ok">
            <input type="radio" name="status-${index}" value="ok" ${isOk ? "checked" : ""} />
            OK
          </label>
          <label class="status-option status-bad">
            <input type="radio" name="status-${index}" value="no-ok" ${tool.status === "no-ok" ? "checked" : ""} />
            No OK
          </label>
        </div>
        <label class="obs-label${showObservation ? "" : " hidden"}">
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

    if (state.validationMode) {
      // iOS Safari can ignore dynamic checked attributes from innerHTML.
      // Set the checked property explicitly for consistent rendering.
      const okRadio = wrap.querySelector(`input[name="status-${index}"][value="ok"]`);
      const noOkRadio = wrap.querySelector(`input[name="status-${index}"][value="no-ok"]`);
      const isNoOk = tool.status === "no-ok";
      if (okRadio) {
        okRadio.checked = !isNoOk;
      }
      if (noOkRadio) {
        noOkRadio.checked = isNoOk;
      }
    }
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
        tools: template.tools.map((name) => ({ name, status: "ok", observation: "", touched: false })),
        generalNotes: "",
        history: []
      };
    } else {
      state.boxes[boxId] = {
        workerName: "",
        tools: defaultTools.map((name) => ({ name, status: "ok", observation: "", touched: false })),
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
  const toolsList = payload && (Array.isArray(payload.tools) ? payload.tools : Array.isArray(payload.t) ? payload.t : null);
  if (!payload || !toolsList) {
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

  const workerName = payload.workerName || payload.w || "";
  state.boxes[boxId] = sharedBox || {
    workerName,
    generalNotes: "",
    tools: toolsList.map((tool) => ({
      name: typeof tool === "string" ? tool : (tool.name || ""),
      status: "ok",
      observation: "",
      touched: false
    })),
    history: []
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
    tool.touched = true;

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
  openPdfDialog();
}

function resetCurrentStatus() {
  const box = getActiveBox();
  if (!box) return;

  box.tools = box.tools.map((t) => ({
    ...t,
    status: "ok",
    observation: "",
    touched: false
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

  if (ui.btnGenerateListado) {
    ui.btnGenerateListado.addEventListener("click", downloadListadoPdf);
  }

  ui.btnValidate.addEventListener("click", () => {
    const entering = !state.validationMode;
    state.validationMode = entering;
    if (entering) {
      const box = getActiveBox();
      if (box) box.tools.forEach((t) => {
        t.status = "ok";
        t.observation = "";
        t.touched = false;
      });
    }
    render();
  });

  ui.toolList.addEventListener("change", (e) => {
    if (e.target.type === "radio" && state.validationMode) {
      const match = /^status-(\d+)$/.exec(e.target.name || "");
      const idx = match ? Number(match[1]) : NaN;
      const box = getActiveBox();
      if (box && Number.isFinite(idx) && box.tools[idx]) {
        box.tools[idx].status = e.target.value;
        box.tools[idx].touched = true;
      }
      const row = e.target.closest(".tool-row");
      const obsLabel = row ? row.querySelector(".obs-label") : null;
      if (obsLabel) obsLabel.classList.remove("hidden");
    }
  });

  ui.toolList.addEventListener("click", (e) => {
    if (e.target.type === "radio" && state.validationMode) {
      const match = /^status-(\d+)$/.exec(e.target.name || "");
      const idx = match ? Number(match[1]) : NaN;
      const box = getActiveBox();
      if (box && Number.isFinite(idx) && box.tools[idx]) {
        box.tools[idx].status = e.target.value;
        box.tools[idx].touched = true;
      }
      const row = e.target.closest(".tool-row");
      const obsLabel = row ? row.querySelector(".obs-label") : null;
      if (obsLabel) obsLabel.classList.remove("hidden");
    }
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

    box.tools.push({ name, status: "ok", observation: "", touched: false });
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

  document.getElementById("btnDownloadPdf").addEventListener("click", downloadPdf);
  document.getElementById("btnSharePdf").addEventListener("click", sharePdf);
  document.getElementById("btnClosePdfDialog").addEventListener("click", () => {
    document.getElementById("pdfDialog").close();
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
  await loadBoxesJson();

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
