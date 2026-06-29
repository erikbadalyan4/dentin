export async function exportPdf({ canvas, result, filename, lang, tc, T }) {
    const { jsPDF } = await import("jspdf");

    const fontUrl     = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf";
    const fontBoldUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf";

    async function loadFontAsBase64(url) {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    const [fontB64, fontBoldB64] = await Promise.all([
        loadFontAsBase64(fontUrl),
        loadFontAsBase64(fontBoldUrl),
    ]);

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    doc.addFileToVFS("Roboto-Regular.ttf", fontB64);
    doc.addFileToVFS("Roboto-Medium.ttf", fontBoldB64);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFont("Roboto-Medium.ttf", "Roboto", "bold");
    doc.setFont("Roboto", "normal");

    const W = 210, margin = 14, contentW = W - margin * 2;
    const PALETTE = ["#0369a1","#0891b2","#0d9488","#059669","#16a34a","#ca8a04","#ea580c","#dc2626","#9333ea","#7c3aed"];
    // ── Нумерация: своя для каждого класса ───────────────────────────────────
    const byClass = {};
    result.items.forEach((item) => {
        if (!byClass[item.className]) byClass[item.className] = [];
        byClass[item.className].push(item);
    });
    const classIds = [...new Set(result.items.map(i => i.className))];
    const sorted = Object.entries(byClass)
        .sort((a, b) => Math.max(...b[1].map(i => i.confidence)) - Math.max(...a[1].map(i => i.confidence)));

    // Назначаем локальный номер внутри каждого класса
    sorted.forEach(([, items]) => {
        items.forEach((item, idx) => { item._localNum = idx + 1; });
    });

    // ── Рисуем снимок с номерами (только для PDF) ─────────────────────────────
    const offscreen = document.createElement("canvas");
    offscreen.width  = canvas.width;
    offscreen.height = canvas.height;
    const ctx = offscreen.getContext("2d");
    ctx.drawImage(canvas, 0, 0); // копируем оригинальный canvas (уже с рамками и подписями)

    // Размер кружка — маленький, аккуратный
    const R = Math.max(10, Math.min(18, canvas.width / 80));
    const fontSize = Math.round(R * 1.1);

    result.items.forEach((item) => {
        if (item._localNum === undefined) return;
        // Показываем номер только если объектов класса > 1
        if (byClass[item.className].length < 2) return;

        const color = PALETTE[item.classId % PALETTE.length];
        const [x1, , , y2] = item.bBox; // левый нижний угол bbox

        // Центр кружка — снаружи bbox, чуть ниже левого нижнего угла
        // Половина кружка выступает за bbox, половина снаружи
        const cx = x1 + R;
        const cy = y2 + R * 0.5; // центр на уровне нижней границы bbox → нижняя половина снаружи

        // Белая обводка для читаемости
        ctx.beginPath();
        ctx.arc(cx, cy, R + 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fill();

        // Цветной кружок
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Номер
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(item._localNum), cx, cy);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
    });

    const imgData = offscreen.toDataURL("image/jpeg", 0.88);

    // ── Шапка ─────────────────────────────────────────────────────────────────
    doc.setFillColor(3, 105, 161);
    doc.rect(0, 0, W, 12, "F");
    doc.setFont("Roboto", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("Dentin", margin, 8.5);
    doc.setFont("Roboto", "normal");
    doc.setFontSize(8);
    doc.text(T.appSub, margin + 22, 8.5);
    doc.text(new Date().toLocaleString(lang === "ru" ? "ru-RU" : "en-US"), W - margin, 8.5, { align: "right" });

    let y = 20;
    doc.setFont("Roboto", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(lang === "ru" ? "ФАЙЛ" : "FILE", margin, y);
    doc.setFont("Roboto", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(filename, margin + 18, y);
    y += 8;

    // ── Снимок ────────────────────────────────────────────────────────────────
    const ratio = canvas.height / canvas.width;
    const imgH  = Math.min(contentW * ratio, 110);
    doc.addImage(imgData, "JPEG", margin, y, contentW, imgH, "", "MEDIUM");
    y += imgH + 6;

    // ── Статистика ────────────────────────────────────────────────────────────
    const statW = contentW / 3 - 2;
    const stats = [
        { label: T.totalFindings, value: String(result.items.length) },
        { label: T.pathClasses,   value: String(sorted.length) },
        { label: T.imageSize,     value: `${result.imageWidth}×${result.imageHeight}` },
    ];
    stats.forEach((stat, i) => {
        const x = margin + i * (statW + 3);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, y, statW, 14, 2, 2, "F");
        doc.setFont("Roboto", "bold");
        doc.setFontSize(14);
        doc.setTextColor(3, 105, 161);
        doc.text(stat.value, x + statW / 2, y + 7, { align: "center" });
        doc.setFont("Roboto", "normal");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(stat.label, x + statW / 2, y + 12, { align: "center" });
    });
    y += 20;

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, W - margin, y);
    y += 6;

    // ── Заголовок таблицы ─────────────────────────────────────────────────────
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentW, 8, "F");
    const col1 = margin + 2;
    const col2 = margin + 85;
    const col3 = margin + 110;
    const col4 = margin + 138;
    doc.setFont("Roboto", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(lang === "ru" ? "ПАТОЛОГИЯ" : "FINDING",          col1 + 4, y + 5.5);
    doc.text("№",                                               col2,     y + 5.5);
    doc.text(lang === "ru" ? "УВЕРЕННОСТЬ" : "CONF.",           col3,     y + 5.5);
    doc.text("BBOX (x1, y1, x2, y2)",                          col4,     y + 5.5);
    y += 9;

    // ── Строки таблицы ────────────────────────────────────────────────────────
    let rowAlt = false;
    sorted.forEach(([cls, items]) => {
        if (y > 262) { doc.addPage(); y = 20; }

        const colorHex = PALETTE[items[0].classId % PALETTE.length];
        const r = parseInt(colorHex.slice(1,3), 16);
        const g = parseInt(colorHex.slice(3,5), 16);
        const b = parseInt(colorHex.slice(5,7), 16);

        const rowH = items.length * 7 + 5;

        if (rowAlt) {
            doc.setFillColor(249, 250, 251);
            doc.rect(margin, y, contentW, rowH, "F");
        }
        rowAlt = !rowAlt;

        // Цветная полоска
        doc.setFillColor(r, g, b);
        doc.rect(margin, y, 3, rowH, "F");

        // Название класса
        doc.setFont("Roboto", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(tc(cls), col1 + 4, y + 6);

        items.forEach((item, idx) => {
            const iy = y + 4 + idx * 7;

            // Номер — кружок (только если > 1 объекта класса)
            if (items.length > 1) {
                doc.setFillColor(r, g, b);
                doc.circle(col2 + 3, iy + 1, 3, "F");
                doc.setFont("Roboto", "bold");
                doc.setFontSize(6);
                doc.setTextColor(255, 255, 255);
                doc.text(String(item._localNum), col2 + 3, iy + 1.6, { align: "center" });
            } else {
                // Один объект — прочерк
                doc.setFont("Roboto", "normal");
                doc.setFontSize(8);
                doc.setTextColor(148, 163, 184);
                doc.text("—", col2 + 1, iy + 1.5);
            }

            // Уверенность
            const confPct = `${(item.confidence * 100).toFixed(0)}%`;
            doc.setFillColor(Math.min(255,r+185), Math.min(255,g+185), Math.min(255,b+185));
            doc.roundedRect(col3, iy - 2.5, 16, 6, 1, 1, "F");
            doc.setFont("Roboto", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(r, g, b);
            doc.text(confPct, col3 + 8, iy + 1, { align: "center" });

            // BBox
            doc.setFont("Roboto", "normal");
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.text(item.bBox.join(", "), col4, iy + 1);
        });

        y += rowH;
        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y, W - margin, y);
    });

    y += 8;

    // ── Дисклеймер ────────────────────────────────────────────────────────────
    if (y > 265) { doc.addPage(); y = 20; }
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentW, 14, 2, 2, "FD");
    doc.setFont("Roboto", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(doc.splitTextToSize(T.disclaimer, contentW - 6), margin + 3, y + 5);

    doc.save(`dentin_${Date.now()}.pdf`);
}