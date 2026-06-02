import { useState, useRef, useCallback, useEffect } from "react";

const PALETTE = [
    "#0369a1", "#0891b2", "#0d9488", "#059669", "#16a34a",
    "#ca8a04", "#ea580c", "#dc2626", "#9333ea", "#7c3aed",
    "#2563eb", "#0284c7", "#0e7490", "#047857", "#15803d",
];
const classColor = (id) => PALETTE[id % PALETTE.length];
const API = "http://localhost:54794/api/segment";

const TRANSLATIONS = {
    en: {
        appSub: "Dental Radiograph Analysis",
        newStudy: "New study",
        loadTitle: "Load radiograph",
        loadMeta1: "JPEG · PNG · BMP · up to 20 MB",
        loadMeta2: "Drag and drop or click to browse",
        supportedTitle: "Supported findings",
        boxes: "Boxes",
        findings: "Findings",
        findingsDetected: (n) => `${n} finding${n !== 1 ? "s" : ""} detected`,
        processing: "Processing…",
        instance: (n) => `${n} instance${n > 1 ? "s" : ""}`,
        conf: "conf.",
        totalFindings: "Total findings",
        pathClasses: "Pathology classes",
        imageSize: "Image size",
        noFindings: "No pathologies detected",
        analysing: "Analysing radiograph",
        download: "Download",
        disclaimer: "For clinical decision support only. Results must be reviewed by a qualified dental professional.",
        classes: {
            "Caries": "Caries",
            "Crown": "Crown",
            "Filling": "Filling",
            "Impacted tooth": "Impacted tooth",
            "Implant": "Implant",
            "Missing teeth": "Missing teeth",
            "Periapical lesion": "Periapical lesion",
            "Root Canal Treatment": "Root Canal Treatment",
            "Root Piece": "Root Piece",
        }
    },
    ru: {
        appSub: "Анализ дентальных рентгенограмм",
        newStudy: "Новый снимок",
        loadTitle: "Загрузить рентгенограмму",
        loadMeta1: "JPEG · PNG · BMP · до 20 МБ",
        loadMeta2: "Перетащите файл или нажмите для выбора",
        supportedTitle: "Определяемые патологии",
        boxes: "Рамки",
        findings: "Находки",
        findingsDetected: (n) => `Обнаружено ${n} ${n === 1 ? "объект" : n < 5 ? "объекта" : "объектов"}`,
        processing: "Обработка…",
        instance: (n) => `${n} ${n === 1 ? "объект" : n < 5 ? "объекта" : "объектов"}`,
        conf: "увер.",
        totalFindings: "Всего объектов",
        pathClasses: "Классов патологий",
        imageSize: "Размер снимка",
        noFindings: "Патологий не обнаружено",
        analysing: "Анализ рентгенограммы",
        download: "Скачать",
        disclaimer: "Только для поддержки клинических решений. Результаты должны быть проверены квалифицированным стоматологом.",
        classes: {
            "Caries": "Кариес",
            "Crown": "Коронка",
            "Filling": "Пломба",
            "Impacted tooth": "Ретинированный зуб",
            "Implant": "Имплант",
            "Missing teeth": "Отсутствующий зуб",
            "Periapical lesion": "Периапикальный очаг",
            "Root Canal Treatment": "Лечение корневого канала",
            "Root Piece": "Фрагмент корня",
        }
    }
};

const CLASS_LIST = [
    "Caries",
    "Crown",
    "Filling",
    "Impacted tooth",
    "Implant",
    "Missing teeth",
    "Periapical lesion",
    "Root Canal Treatment",
    "Root Piece",
];

function hexToRgb(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export default function App() {
    const [image, setImage] = useState(null);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [selectedClass, setSelectedClass] = useState(null);
    const [showBoxes, setShowBoxes] = useState(true);
    const [lang, setLang] = useState("ru");

    const canvasRef = useRef(null);
    const fileRef = useRef(null);
    const T = TRANSLATIONS[lang];
    const tc = (name) => T.classes[name] ?? name;

    // ── Рендер canvas ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!image || !result || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        canvas.width = image.w;
        canvas.height = image.h;

        const img = new Image();
        img.src = image.url;
        img.onload = () => {
            ctx.drawImage(img, 0, 0);
            if (!showBoxes) return;

            result.items.forEach((item) => {
                const isActive = selectedClass === null || item.className === selectedClass;
                if (!isActive) return;

                const color = classColor(item.classId);
                const [x1, y1, x2, y2] = item.bBox;

                if (selectedClass === item.className) {
                    const [r, g, b] = hexToRgb(color);
                    ctx.fillStyle = `rgba(${r},${g},${b},0.15)`;
                    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
                }

                ctx.strokeStyle = color;
                ctx.lineWidth = selectedClass === item.className ? 2.5 : 1.5;
                ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

                const label = `${tc(item.className)}  ${(item.confidence * 100).toFixed(0)}%`;
                ctx.font = "500 11px monospace";
                const tw = ctx.measureText(label).width + 10;
                ctx.fillStyle = color;
                ctx.fillRect(x1, y1 - 18, tw, 18);
                ctx.fillStyle = "#fff";
                ctx.fillText(label, x1 + 5, y1 - 5);
            });
        };
    }, [image, result, selectedClass, showBoxes, lang]);

    // ── Upload ────────────────────────────────────────────────────────────────
    const resetState = () => {
        setImage(null); setResult(null); setSelectedClass(null); setError(null);
    };

    const processFile = useCallback(async (file) => {
        if (!file || !file.type.startsWith("image/")) return;
        setError(null); setResult(null); setSelectedClass(null);
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.src = url;
        img.onload = () => setImage({ url, w: img.naturalWidth, h: img.naturalHeight });
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch(API, { method: "POST", body: fd });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? `HTTP ${res.status}`); }
            setResult(await res.json());
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const onDrop = (e) => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]); };
    const onDragOver = (e) => { e.preventDefault(); setDragging(true); };

    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement("a");
        link.download = `dentin_${Date.now()}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    };

    // ── Группировка по классу ─────────────────────────────────────────────────
    const byClass = result
        ? Object.values(result.items.reduce((acc, item) => {
            if (!acc[item.className]) acc[item.className] = { name: item.className, classId: item.classId, count: 0, maxConf: 0 };
            acc[item.className].count++;
            acc[item.className].maxConf = Math.max(acc[item.className].maxConf, item.confidence);
            return acc;
        }, {})).sort((a, b) => b.maxConf - a.maxConf)
        : [];

    return (
        <div style={s.root}>
            {/* ── Topbar ── */}
            <header style={s.topbar}>
                <div style={s.brand} onClick={resetState} title="На главную">
                    <div style={s.brandMark}>
                        <img
                            src="/src/assets/Dentin.svg"
                            alt="Dentin"
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        />
                    </div>
                </div>

                <div style={s.topRight}>
                    <div style={s.langSwitch}>
                        <button style={{ ...s.langBtn, ...(lang === "ru" ? s.langBtnOn : {}) }} onClick={() => setLang("ru")}>RU</button>
                        <button style={{ ...s.langBtn, ...(lang === "en" ? s.langBtnOn : {}) }} onClick={() => setLang("en")}>EN</button>
                    </div>
                    <span style={s.version}>v1.0</span>
                    {image && (
                        <button style={s.btnOutline} onClick={resetState}>
                            {T.newStudy}
                        </button>
                    )}
                </div>
            </header>

            <div style={s.body}>
                {/* ── Upload ── */}
                {!image && (
                    <div style={s.uploadWrap}>
                        <div
                            style={{ ...s.dropzone, ...(dragging ? s.dropzoneDrag : {}) }}
                            onDrop={onDrop}
                            onDragOver={onDragOver}
                            onDragLeave={() => setDragging(false)}
                            onClick={() => fileRef.current?.click()}
                        >
                            <input ref={fileRef} type="file" accept="image/*"
                                onChange={(e) => processFile(e.target.files[0])}
                                style={{ display: "none" }} />
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                                stroke="#94a3b8" strokeWidth="1.5" style={{ marginBottom: 20 }}>
                                <path d="M4 16l4-4 4 4 4-8 4 8" />
                                <rect x="2" y="3" width="20" height="18" rx="2" />
                            </svg>
                            <div style={s.dropTitle}>{T.loadTitle}</div>
                            <div style={s.dropMeta}>{T.loadMeta1}</div>
                            <div style={s.dropMeta}>{T.loadMeta2}</div>
                        </div>

                        <div style={s.infoPanel}>
                            <div style={s.infoPanelTitle}>{T.supportedTitle}</div>
                            {CLASS_LIST.map((c, i) => (
                                <div key={c} style={s.infoItem}>
                                    <span style={{ ...s.infoDot, background: classColor(i) }} />
                                    {tc(c)}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Analysis ── */}
                {image && (
                    <div style={s.analysisLayout}>
                        <div style={s.canvasPanel}>
                            <div style={s.canvasToolbar}>
                                <span style={s.canvasLabel}>
                                    {result ? T.findingsDetected(result.items.length) : T.processing}
                                </span>
                                <div style={s.toggleGroup}>
                                    <button
                                        style={{ ...s.toggle, ...(showBoxes ? s.toggleOn : {}) }}
                                        onClick={() => setShowBoxes(v => !v)}
                                    >{T.boxes}</button>
                                    {result && (
                                        <button style={s.toggle} onClick={handleDownload}>
                                            {T.download}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div style={s.canvasWrap}>
                                {loading && (
                                    <div style={s.loadingOverlay}>
                                        <div style={s.spinner} />
                                        <span style={s.loadingLabel}>{T.analysing}</span>
                                    </div>
                                )}
                                <canvas ref={canvasRef} style={s.canvas} />
                            </div>

                            {error && <div style={s.errorBar}><strong>Error:</strong> {error}</div>}
                        </div>

                        <aside style={s.sidebar}>
                            <div style={s.sidebarHeader}>{T.findings}</div>

                            {result && byClass.length === 0 && (
                                <div style={s.noFindings}>{T.noFindings}</div>
                            )}

                            <div style={s.findingsList}>
                                {byClass.map((cls) => (
                                    <div
                                        key={cls.name}
                                        style={{
                                            ...s.findingRow,
                                            ...(selectedClass !== null && selectedClass !== cls.name ? s.findingDim : {}),
                                            ...(selectedClass === cls.name ? s.findingActive : {}),
                                        }}
                                        onMouseEnter={() => setSelectedClass(cls.name)}
                                        onMouseLeave={() => setSelectedClass(null)}
                                    >
                                        <div style={{ ...s.findingColor, background: classColor(cls.classId) }} />
                                        <div style={s.findingBody}>
                                            <div style={s.findingName}>{tc(cls.name)}</div>
                                            <div style={s.findingMeta}>
                                                {T.instance(cls.count)}
                                                <span style={s.sep}>·</span>
                                                {T.conf} {(cls.maxConf * 100).toFixed(0)}%
                                            </div>
                                        </div>
                                        <div style={{
                                            ...s.confBadge,
                                            background: classColor(cls.classId) + "18",
                                            color: classColor(cls.classId)
                                        }}>
                                            {(cls.maxConf * 100).toFixed(0)}%
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {result && (
                                <div style={s.summaryBox}>
                                    <div style={s.summaryRow}>
                                        <span style={s.summaryLabel}>{T.totalFindings}</span>
                                        <span style={s.summaryVal}>{result.items.length}</span>
                                    </div>
                                    <div style={s.summaryRow}>
                                        <span style={s.summaryLabel}>{T.pathClasses}</span>
                                        <span style={s.summaryVal}>{byClass.length}</span>
                                    </div>
                                    <div style={s.summaryRow}>
                                        <span style={s.summaryLabel}>{T.imageSize}</span>
                                        <span style={s.summaryVal}>{result.imageWidth} × {result.imageHeight}</span>
                                    </div>
                                </div>
                            )}

                            <div style={s.disclaimer}>{T.disclaimer}</div>
                        </aside>
                    </div>
                )}
            </div>
        </div>
    );
}

const s = {
    root: {
        width: "100%",
        minHeight: "100vh",
        background: "#f1f5f9",
        fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
        color: "#0f172a",
        display: "flex",
        margin: 0,
        flexDirection: "column",
    },
    topbar: {
        height: 60,
        borderBottom: "1px solid #e2e8f0",
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        flexShrink: 0,
    },
    brand: {
        display: "flex", alignItems: "center", gap: 12,
        cursor: "pointer",
    },
    brandMark: {
        width: 136, height: 56,
        display: "flex", alignItems: "center", justifyContent: "center",
    },
    topRight: { display: "flex", alignItems: "center", gap: 14 },
    langSwitch: {
        display: "flex",
        border: "1px solid #e2e8f0",
        borderRadius: 6,
        overflow: "hidden",
    },
    langBtn: {
        background: "none",
        border: "none",
        borderRight: "1px solid #e2e8f0",
        color: "#94a3b8",
        padding: "5px 12px",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
        letterSpacing: 0.5,
    },
    langBtnOn: { background: "#0369a1", color: "#fff" },
    version: { fontSize: 11, color: "#cbd5e1", fontFamily: "monospace" },
    btnOutline: {
        background: "none",
        border: "1px solid #e2e8f0",
        color: "#475569",
        padding: "7px 16px",
        borderRadius: 6,
        fontSize: 13,
        cursor: "pointer",
        fontFamily: "inherit",
    },
    body: {
        flex: 1,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 28,
    },
    uploadWrap: { display: "flex", gap: 24, alignItems: "flex-start", width: "100%", maxWidth: "100%" },
    dropzone: {
        flex: 1,
        border: "1.5px dashed #cbd5e1",
        borderRadius: 12,
        padding: "80px 60px",
        textAlign: "center",
        cursor: "pointer",
        background: "#fff",
        transition: "border-color 0.15s, background 0.15s",
    },
    dropzoneDrag: { borderColor: "#0369a1", background: "#f0f9ff" },
    dropTitle: { fontSize: 17, fontWeight: 500, color: "#1e293b", marginBottom: 10 },
    dropMeta: { fontSize: 13, color: "#94a3b8", lineHeight: 2 },
    infoPanel: {
        width: 260,
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: "20px 20px",
        flexShrink: 0,
    },
    infoPanelTitle: {
        fontSize: 11, fontWeight: 600, color: "#94a3b8",
        letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 14,
    },
    infoItem: { display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#475569", padding: "5px 0" },
    infoDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
    analysisLayout: { display: "flex", gap: 24, width: "100%", maxWidth: "100%", alignItems: "flex-start" },
    canvasPanel: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 },
    canvasToolbar: { display: "flex", alignItems: "center", justifyContent: "space-between" },
    canvasLabel: { fontSize: 13, color: "#64748b" },
    toggleGroup: { display: "flex", gap: 4 },
    toggle: {
        background: "none",
        border: "1px solid #e2e8f0",
        color: "#94a3b8",
        padding: "5px 14px",
        borderRadius: 5,
        fontSize: 12,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.1s",
    },
    toggleOn: { background: "#0369a1", borderColor: "#0369a1", color: "#fff" },
    canvasWrap: {
        position: "relative",
        background: "#0f172a",
        borderRadius: 10,
        overflow: "hidden",
        lineHeight: 0,
        width: "100%",
    },
    loadingOverlay: {
        position: "absolute", inset: 0,
        background: "rgba(15,23,42,0.75)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 14, zIndex: 10,
    },
    spinner: {
        width: 38, height: 38,
        borderRadius: "50%",
        border: "2.5px solid rgba(255,255,255,0.12)",
        borderTop: "2.5px solid #0ea5e9",
        animation: "spin 0.7s linear infinite",
    },
    loadingLabel: { fontSize: 13, color: "#94a3b8" },
    canvas: { display: "block", maxWidth: "100%", width: "100%" },
    errorBar: {
        padding: "10px 14px",
        background: "#fef2f2",
        border: "1px solid #fecaca",
        borderRadius: 6,
        fontSize: 13,
        color: "#dc2626",
    },
    sidebar: {
        width: 300,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 0,
    },
    sidebarHeader: {
        fontSize: 11, fontWeight: 600, color: "#94a3b8",
        letterSpacing: 0.8, textTransform: "uppercase",
        paddingBottom: 12,
        borderBottom: "1px solid #e2e8f0",
        marginBottom: 6,
    },
    noFindings: { fontSize: 13, color: "#94a3b8", padding: "16px 0" },
    findingsList: { display: "flex", flexDirection: "column", gap: 2 },
    findingRow: {
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 10px",
        borderRadius: 7,
        cursor: "default",
        transition: "background 0.1s, opacity 0.15s",
        background: "#fff",
        border: "1px solid #f1f5f9",
        marginBottom: 2,
    },
    findingDim: { opacity: 0.25 },
    findingActive: { background: "#f0f9ff", borderColor: "#bae6fd" },
    findingColor: { width: 3, height: 32, borderRadius: 2, flexShrink: 0 },
    findingBody: { flex: 1, minWidth: 0 },
    findingName: { fontSize: 13, fontWeight: 500, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    findingMeta: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
    sep: { margin: "0 4px" },
    confBadge: {
        fontSize: 11, fontWeight: 600,
        padding: "3px 8px", borderRadius: 4,
        flexShrink: 0,
    },
    summaryBox: {
        marginTop: 16,
        padding: "14px 14px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
    },
    summaryRow: { display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 },
    summaryLabel: { color: "#94a3b8" },
    summaryVal: { color: "#1e293b", fontWeight: 500, fontFamily: "monospace", fontSize: 12 },
    disclaimer: {
        marginTop: 14,
        fontSize: 11,
        color: "#cbd5e1",
        lineHeight: 1.7,
        padding: "12px 12px",
        border: "1px solid #e2e8f0",
        borderRadius: 6,
        background: "#fafafa",
    },
};