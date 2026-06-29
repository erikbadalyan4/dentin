import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { exportPdf } from "./exportPdf";

const PALETTE = [
    "#0369a1", "#0891b2", "#0d9488", "#059669", "#16a34a",
    "#ca8a04", "#ea580c", "#dc2626", "#9333ea", "#7c3aed",
    "#2563eb", "#0284c7", "#0e7490", "#047857", "#15803d",
];
const classColor = (id) => PALETTE[id % PALETTE.length];
const API_BASE = "http://localhost:54794/api";

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
        exportPdf: "Export PDF",
        history: "History",
        historyTitle: "Analysis history",
        historyEmpty: "No analyses yet",
        deleteConfirm: "Delete this analysis?",
        logout: "Sign out",
        noImage: "Image not saved",
        disclaimer: "For clinical decision support only. Results must be reviewed by a qualified dental professional.",
        classes: {
            "Caries": "Caries", "Crown": "Crown", "Filling": "Filling",
            "Impacted tooth": "Impacted tooth", "Implant": "Implant",
            "Missing teeth": "Missing teeth", "Periapical lesion": "Periapical lesion",
            "Root Canal Treatment": "Root Canal Treatment", "Root Piece": "Root Piece",
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
        exportPdf: "Экспорт PDF",
        history: "История",
        historyTitle: "История анализов",
        historyEmpty: "Анализов пока нет",
        deleteConfirm: "Удалить этот анализ?",
        logout: "Выйти",
        noImage: "Снимок не сохранён",
        disclaimer: "Только для поддержки клинических решений. Результаты должны быть проверены квалифицированным стоматологом.",
        classes: {
            "Caries": "Кариес", "Crown": "Коронка", "Filling": "Пломба",
            "Impacted tooth": "Ретинированный зуб", "Implant": "Имплант",
            "Missing teeth": "Отсутствующий зуб", "Periapical lesion": "Периапикальный очаг",
            "Root Canal Treatment": "Лечение корневого канала", "Root Piece": "Фрагмент корня",
        }
    }
};

const CLASS_LIST = [
    "Caries", "Crown", "Filling", "Impacted tooth", "Implant",
    "Missing teeth", "Periapical lesion", "Root Canal Treatment", "Root Piece",
];

function hexToRgb(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function formatDate(iso, lang) {
    return new Date(iso).toLocaleString(lang === "ru" ? "ru-RU" : "en-US", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

/**
 * Отрисовка рамок на канвасе.
 * Приоритет подсветки:
 *  1. Если выбран конкретный instanceIndex — рисуем только эту находку активной.
 *  2. Иначе, если выбран selectedClass — рисуем все находки этого класса активными.
 *  3. Иначе все рамки в обычном (неактивном) виде.
 */
function drawBoxes(ctx, items, selectedClass, selectedInstanceIndex, showBoxes, tc, image) {
    if (!showBoxes) return;
    items.forEach((item, idx) => {
        let isActive;
        if (selectedInstanceIndex !== null) {
            isActive = idx === selectedInstanceIndex;
        } else if (selectedClass !== null) {
            isActive = item.className === selectedClass;
        } else {
            isActive = true;
        }
        if (!isActive) return;

        const isHighlighted = selectedInstanceIndex !== null
            ? idx === selectedInstanceIndex
            : selectedClass === item.className;

        const color = classColor(item.classId);
        const [x1, y1, x2, y2] = item.bBox;
        if (isHighlighted) {
            const [r, g, b] = hexToRgb(color);
            ctx.fillStyle = `rgba(${r},${g},${b},0.15)`;
            ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = isHighlighted ? 2.5 : 1.5;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        const label = `${tc(item.className)}  ${(item.confidence * 100).toFixed(0)}%`;
        const fontSize = Math.max(11, Math.min(18, image.w / 80));
        ctx.font = `500 ${fontSize}px monospace`;
        const tw = ctx.measureText(label).width + 10;
        ctx.fillStyle = color;
        ctx.fillRect(x1, y1 - fontSize * 1.6, tw, fontSize * 1.6);
        ctx.fillStyle = "#fff";
        ctx.fillText(label, x1 + 5, y1 - fontSize * 0.4);
    });
}

export default function App({ lang, setLang, user, onLogout }) {
    const { authFetch } = useAuth();

    const [image, setImage]               = useState(null);
    const [result, setResult]             = useState(null);
    const [loading, setLoading]           = useState(false);
    const [error, setError]               = useState(null);
    const [dragging, setDragging]         = useState(false);
    const [selectedClass, setSelectedClass] = useState(null);
    // Индекс конкретной находки (в result.items), на которую сейчас наведена мышь
    const [selectedInstanceIndex, setSelectedInstanceIndex] = useState(null);
    // Заголовок класса наведён явно (используется только для подсветки самого заголовка)
    const [hoveredHeaderClass, setHoveredHeaderClass] = useState(null);
    // Какой класс сейчас раскрыт в списке находок (аккордеон — раскрыт только один)
    const [expandedClass, setExpandedClass] = useState(null);
    const [showBoxes, setShowBoxes]       = useState(true);
    const [showHistory, setShowHistory]   = useState(false);
    const [history, setHistory]           = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [currentFilename, setCurrentFilename] = useState("");

    const canvasRef = useRef(null);
    const fileRef   = useRef(null);
    const T  = TRANSLATIONS[lang];
    const tc = (name) => T.classes[name] ?? name;

    // ── Canvas рендер ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!image || !result || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx    = canvas.getContext("2d");
        canvas.width  = image.w;
        canvas.height = image.h;

        if (!image.url) {
            // Снимок не сохранён — серый фон
            ctx.fillStyle = "#1e293b";
            ctx.fillRect(0, 0, image.w, image.h);
            ctx.fillStyle = "#475569";
            ctx.font = "16px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(T.noImage, image.w / 2, image.h / 2);
            ctx.textAlign = "left";
            drawBoxes(ctx, result.items, selectedClass, selectedInstanceIndex, showBoxes, tc, image);
            return;
        }

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = image.url;
        img.onload = () => {
            ctx.drawImage(img, 0, 0);
            drawBoxes(ctx, result.items, selectedClass, selectedInstanceIndex, showBoxes, tc, image);
        };
    }, [image, result, selectedClass, selectedInstanceIndex, showBoxes, lang]);

    // ── Сброс ─────────────────────────────────────────────────────────────────
    const resetState = () => {
        setImage(null); setResult(null); setSelectedClass(null);
        setSelectedInstanceIndex(null); setExpandedClass(null);
        setError(null); setShowHistory(false);
    };

    // ── Открыть анализ из истории ─────────────────────────────────────────────
    const openFromHistory = (analysis) => {
        setShowHistory(false);
        setSelectedClass(null);
        setSelectedInstanceIndex(null);
        setExpandedClass(null);
        setError(null);
        setCurrentFilename(analysis.filename);

        const items = analysis.findings.map(f => ({
            classId:    f.classId,
            className:  f.className,
            confidence: f.confidence,
            bBox:       f.bBox,
            maskPixels: [],
        }));

        setResult({
            imageWidth:  analysis.imageWidth,
            imageHeight: analysis.imageHeight,
            items,
        });

        if (analysis.imagePath) {
            const imgUrl = `${API_BASE}/segment/uploads/${analysis.imagePath}`;
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = imgUrl;
            img.onload = () => setImage({ url: imgUrl, w: img.naturalWidth, h: img.naturalHeight });
            img.onerror  = () => setImage({ url: null, w: analysis.imageWidth, h: analysis.imageHeight });
        } else {
            setImage({ url: null, w: analysis.imageWidth, h: analysis.imageHeight });
        }
    };

    // ── Upload & инференс ─────────────────────────────────────────────────────
    const processFile = useCallback(async (file) => {
        if (!file || !file.type.startsWith("image/")) return;
        setError(null); setResult(null); setSelectedClass(null);
        setSelectedInstanceIndex(null); setExpandedClass(null);
        setShowHistory(false);
        setCurrentFilename(file.name);
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.src = url;
        img.onload = () => setImage({ url, w: img.naturalWidth, h: img.naturalHeight });
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await authFetch(`${API_BASE}/segment`, { method: "POST", body: fd });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? `HTTP ${res.status}`); }
            setResult(await res.json());
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [authFetch]);

    const onDrop     = (e) => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]); };
    const onDragOver = (e) => { e.preventDefault(); setDragging(true); };

    // ── История ───────────────────────────────────────────────────────────────
    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/segment/history`);
            if (res.ok) setHistory(await res.json());
        } finally {
            setHistoryLoading(false);
        }
    };

    const openHistory = () => {
        setShowHistory(true);
        setImage(null); setResult(null);
        loadHistory();
    };

    const deleteAnalysis = async (id) => {
        if (!window.confirm(T.deleteConfirm)) return;
        await authFetch(`${API_BASE}/segment/history/${id}`, { method: "DELETE" });
        setHistory(h => h.filter(a => a.id !== id));
    };

    // ── Скачать PNG ───────────────────────────────────────────────────────────
    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement("a");
        link.download = `dentin_${Date.now()}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    };

    // ── Экспорт PDF ───────────────────────────────────────────────────────────
    const handleExportPdf = () => {
        if (!canvasRef.current || !result) return;
        exportPdf({ canvas: canvasRef.current, result, filename: currentFilename, lang, tc, T });
    };

    // ── Раскрытие/сворачивание класса (раскрыт только один за раз) ────────────
    const toggleExpanded = (className) => {
        setExpandedClass(prev => (prev === className ? null : className));
    };

    // ── Группировка (теперь храним индексы исходных items, чтобы можно было
    //     однозначно подсветить конкретную находку при наведении) ──────────────
    const byClass = result
        ? Object.values(
            result.items.reduce((acc, item, idx) => {
                if (!acc[item.className]) {
                    acc[item.className] = {
                        name: item.className,
                        classId: item.classId,
                        count: 0,
                        maxConf: 0,
                        instances: [],
                    };
                }
                const g = acc[item.className];
                g.count++;
                g.maxConf = Math.max(g.maxConf, item.confidence);
                g.instances.push({ ...item, index: idx });
                return acc;
            }, {})
          ).sort((a, b) => b.maxConf - a.maxConf)
        : [];

    return (
        <div style={s.root}>
            <style>{`
                .dentin-no-focus-outline {
                    -webkit-appearance: none;
                    appearance: none;
                    -webkit-tap-highlight-color: transparent;
                }
                .dentin-no-focus-outline,
                .dentin-no-focus-outline:hover,
                .dentin-no-focus-outline:focus,
                .dentin-no-focus-outline:focus-visible,
                .dentin-no-focus-outline:active {
                    outline: none !important;
                    box-shadow: none !important;
                }
            `}</style>
            {/* ── Topbar ── */}
            <header style={s.topbar}>
                <div style={s.brand} onClick={resetState} title="На главную">
                    <div style={s.brandMark}>
                        <img src="/src/assets/Dentin.svg" alt="Dentin"
                            style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    </div>
                </div>
                <div style={s.topRight}>
                    <button
                        style={{ ...s.btnOutline, ...(showHistory ? s.btnOutlineActive : {}) }}
                        onClick={showHistory ? resetState : openHistory}
                    >{T.history}</button>
                    <div style={s.langSwitch}>
                        <button style={{ ...s.langBtn, ...(lang === "ru" ? s.langBtnOn : {}) }} onClick={() => setLang("ru")}>RU</button>
                        <button style={{ ...s.langBtn, ...(lang === "en" ? s.langBtnOn : {}) }} onClick={() => setLang("en")}>EN</button>
                    </div>
                    <span style={s.version}>v1.0</span>
                    <div style={s.userBlock}>
                        <span style={s.userName}>{user.username}</span>
                        <button style={s.logoutBtn} onClick={onLogout} title={T.logout}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                                <polyline points="16 17 21 12 16 7"/>
                                <line x1="21" y1="12" x2="9" y2="12"/>
                            </svg>
                        </button>
                    </div>
                    {image && (
                        <button style={s.btnOutline} onClick={resetState}>{T.newStudy}</button>
                    )}
                </div>
            </header>

            <div style={s.body}>

                {/* ── История ── */}
                {showHistory && (
                    <div style={s.historyWrap}>
                        <div style={s.historyHeader}>{T.historyTitle}</div>
                        {historyLoading && <div style={s.historyEmpty}>…</div>}
                        {!historyLoading && history.length === 0 && (
                            <div style={s.historyEmpty}>{T.historyEmpty}</div>
                        )}
                        {history.map(a => (
                            <div key={a.id} style={s.historyRow} onClick={() => openFromHistory(a)}>
                                {/* Превью снимка */}
                                <div style={s.historyThumb}>
                                    {a.imagePath
                                        ? <img
                                            src={`${API_BASE}/segment/uploads/${a.imagePath}`}
                                            alt={a.filename}
                                            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 5 }}
                                          />
                                        : <div style={s.historyNoThumb}>🦷</div>
                                    }
                                </div>
                                <div style={s.historyBody}>
                                    <div style={s.historyFilename}>{a.filename}</div>
                                    <div style={s.historyMeta}>
                                        {formatDate(a.createdAt, lang)}
                                        <span style={s.sep}>·</span>
                                        {a.findings.length} {lang === "ru" ? "объектов" : "findings"}
                                        <span style={s.sep}>·</span>
                                        {a.imageWidth}×{a.imageHeight}
                                    </div>
                                    {/* Цветные точки классов */}
                                    <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                                        {[...new Set(a.findings.map(f => f.className))].map((cls, i) => (
                                            <span key={cls} style={{
                                                fontSize: 10, padding: "2px 7px", borderRadius: 10,
                                                background: classColor(a.findings.find(f => f.className === cls)?.classId ?? i) + "20",
                                                color: classColor(a.findings.find(f => f.className === cls)?.classId ?? i),
                                                fontWeight: 500,
                                            }}>{T.classes[cls] ?? cls}</span>
                                        ))}
                                    </div>
                                </div>
                                <button style={s.deleteBtn}
                                    onClick={(e) => { e.stopPropagation(); deleteAnalysis(a.id); }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="3 6 5 6 21 6"/>
                                        <path d="M19 6l-1 14H6L5 6"/>
                                        <path d="M10 11v6M14 11v6"/>
                                        <path d="M9 6V4h6v2"/>
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Upload ── */}
                {!image && !showHistory && (
                    <div style={s.uploadWrap}>
                        <div
                            style={{ ...s.dropzone, ...(dragging ? s.dropzoneDrag : {}) }}
                            onDrop={onDrop} onDragOver={onDragOver}
                            onDragLeave={() => setDragging(false)}
                            onClick={() => fileRef.current?.click()}
                        >
                            <input ref={fileRef} type="file" accept="image/*"
                                onChange={(e) => processFile(e.target.files[0])}
                                style={{ display: "none" }} />
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                                stroke="#94a3b8" strokeWidth="1.5" style={{ marginBottom: 20 }}>
                                <path d="M4 16l4-4 4 4 4-8 4 8"/>
                                <rect x="2" y="3" width="20" height="18" rx="2"/>
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
                                    {loading
                                        ? T.processing
                                        : result
                                            ? T.findingsDetected(result.items.length)
                                            : ""}
                                </span>
                                <div style={s.toggleGroup}>
                                    <button
                                        style={{ ...s.toggle, ...(showBoxes ? s.toggleOn : {}) }}
                                        onClick={() => setShowBoxes(v => !v)}
                                    >{T.boxes}</button>
                                    {result && <>
                                        <button style={s.toggleDownload} onClick={handleDownload}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                                                stroke="currentColor" strokeWidth="2" style={{ marginRight: 5 }}>
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                <polyline points="7 10 12 15 17 10"/>
                                                <line x1="12" y1="15" x2="12" y2="3"/>
                                            </svg>
                                            {T.download}
                                        </button>
                                        <button style={s.togglePdf} onClick={handleExportPdf}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                                                stroke="currentColor" strokeWidth="2" style={{ marginRight: 5 }}>
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                                <polyline points="14 2 14 8 20 8"/>
                                                <line x1="16" y1="13" x2="8" y2="13"/>
                                                <line x1="16" y1="17" x2="8" y2="17"/>
                                            </svg>
                                            {T.exportPdf}
                                        </button>
                                    </>}
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
                                {byClass.map((cls) => {
                                    const isExpanded = expandedClass === cls.name;
                                    return (
                                        <div key={cls.name} style={s.findingGroup}>
                                            <div
                                                tabIndex={-1}
                                                className="dentin-no-focus-outline"
                                                style={{
                                                    ...s.findingRow,
                                                    ...(selectedClass !== null && selectedClass !== cls.name ? s.findingDim : {}),
                                                    ...(hoveredHeaderClass === cls.name ? s.findingActive : {}),
                                                }}
                                                onMouseEnter={() => {
                                                    setSelectedClass(cls.name);
                                                    setSelectedInstanceIndex(null);
                                                    setHoveredHeaderClass(cls.name);
                                                }}
                                                onMouseLeave={() => {
                                                    setSelectedClass(null);
                                                    setHoveredHeaderClass(null);
                                                }}
                                                onClick={() => toggleExpanded(cls.name)}
                                            >
                                                <span style={{
                                                    ...s.expandArrow,
                                                    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                                                }}>▸</span>
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

                                            {isExpanded && (
                                                <div style={s.instanceList}>
                                                    {cls.instances.map((inst, i) => (
                                                        <div
                                                            key={inst.index}
                                                            tabIndex={-1}
                                                            className="dentin-no-focus-outline"
                                                            style={{
                                                                ...s.instanceRow,
                                                                ...(selectedInstanceIndex === inst.index ? s.instanceActive : {}),
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedClass(cls.name);
                                                                setSelectedInstanceIndex(inst.index);
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedClass(null);
                                                                setSelectedInstanceIndex(null);
                                                            }}
                                                        >
                                                            <div style={{ ...s.instanceDot, background: classColor(cls.classId) }} />
                                                            <span style={s.instanceLabel}>
                                                                {tc(cls.name)} #{i + 1}
                                                            </span>
                                                            <span style={s.instanceConf}>
                                                                {(inst.confidence * 100).toFixed(0)}%
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
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
    root: { width: "100%", minHeight: "100vh", background: "#f1f5f9", fontFamily: "'DM Sans','Helvetica Neue',sans-serif", color: "#0f172a", display: "flex", margin: 0, flexDirection: "column" },
    topbar: { height: 60, borderBottom: "1px solid #e2e8f0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", flexShrink: 0 },
    brand: { display: "flex", alignItems: "center", gap: 12, cursor: "pointer" },
    brandMark: { width: 136, height: 56, display: "flex", alignItems: "center", justifyContent: "center" },
    topRight: { display: "flex", alignItems: "center", gap: 14 },
    langSwitch: { display: "flex", border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" },
    langBtn: { background: "none", border: "none", borderRight: "1px solid #e2e8f0", color: "#94a3b8", padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", letterSpacing: 0.5 },
    langBtnOn: { background: "#0369a1", color: "#fff" },
    version: { fontSize: 11, color: "#cbd5e1", fontFamily: "monospace" },
    btnOutline: { background: "none", border: "1px solid #e2e8f0", color: "#475569", padding: "7px 16px", borderRadius: 6, fontSize: 13, cursor: "pointer", fontFamily: "inherit" },
    btnOutlineActive: { background: "#f0f9ff", borderColor: "#0369a1", color: "#0369a1" },
    userBlock: { display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 7 },
    userName: { fontSize: 13, color: "#475569", fontWeight: 500 },
    logoutBtn: { background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center", padding: 2 },
    body: { flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 28 },

    // История
    historyWrap: { width: "100%", maxWidth: 860 },
    historyHeader: { fontSize: 11, fontWeight: 600, color: "#94a3b8", letterSpacing: 0.8, textTransform: "uppercase", paddingBottom: 12, borderBottom: "1px solid #e2e8f0", marginBottom: 8 },
    historyEmpty: { fontSize: 13, color: "#94a3b8", padding: "24px 0", textAlign: "center" },
    historyRow: {
        display: "flex", alignItems: "flex-start", gap: 14,
        padding: "12px 14px", background: "#fff",
        border: "1px solid #f1f5f9", borderRadius: 10,
        marginBottom: 8, cursor: "pointer",
        transition: "box-shadow 0.15s, border-color 0.15s",
    },
    historyThumb: {
        width: 72, height: 52, borderRadius: 6,
        overflow: "hidden", flexShrink: 0,
        background: "#f1f5f9", border: "1px solid #e2e8f0",
        display: "flex", alignItems: "center", justifyContent: "center",
    },
    historyNoThumb: { fontSize: 22 },
    historyBody: { flex: 1, minWidth: 0 },
    historyFilename: { fontSize: 13, fontWeight: 500, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 },
    historyMeta: { fontSize: 11, color: "#94a3b8" },
    deleteBtn: { background: "none", border: "1px solid #fee2e2", borderRadius: 5, color: "#dc2626", cursor: "pointer", padding: "5px 7px", display: "flex", alignItems: "center", flexShrink: 0 },

    uploadWrap: { display: "flex", gap: 24, alignItems: "flex-start", width: "100%", maxWidth: "100%" },
    dropzone: { flex: 1, border: "1.5px dashed #cbd5e1", borderRadius: 12, padding: "80px 60px", textAlign: "center", cursor: "pointer", background: "#fff", transition: "border-color 0.15s, background 0.15s" },
    dropzoneDrag: { borderColor: "#0369a1", background: "#f0f9ff" },
    dropTitle: { fontSize: 17, fontWeight: 500, color: "#1e293b", marginBottom: 10 },
    dropMeta: { fontSize: 13, color: "#94a3b8", lineHeight: 2 },
    infoPanel: { width: 260, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px", flexShrink: 0 },
    infoPanelTitle: { fontSize: 11, fontWeight: 600, color: "#94a3b8", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 14 },
    infoItem: { display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#475569", padding: "5px 0" },
    infoDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },

    analysisLayout: { display: "flex", gap: 24, width: "100%", maxWidth: "100%", alignItems: "flex-start" },
    canvasPanel: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 },
    canvasToolbar: { display: "flex", alignItems: "center", justifyContent: "space-between" },
    canvasLabel: { fontSize: 13, color: "#64748b" },
    toggleGroup: { display: "flex", gap: 4 },
    toggle: { background: "none", border: "1px solid #e2e8f0", color: "#94a3b8", padding: "5px 14px", borderRadius: 5, fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: "all 0.1s" },
    toggleOn: { background: "#0369a1", borderColor: "#0369a1", color: "#fff" },
    toggleDownload: { display: "flex", alignItems: "center", background: "#059669", border: "none", color: "#fff", padding: "5px 14px", borderRadius: 5, fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
    togglePdf: { display: "flex", alignItems: "center", background: "#7c3aed", border: "none", color: "#fff", padding: "5px 14px", borderRadius: 5, fontSize: 12, cursor: "pointer", fontFamily: "inherit" },

    canvasWrap: { position: "relative", background: "#0f172a", borderRadius: 10, overflow: "hidden", lineHeight: 0, width: "100%" },
    loadingOverlay: { position: "absolute", inset: 0, background: "rgba(15,23,42,0.75)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, zIndex: 10 },
    spinner: { width: 38, height: 38, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.12)", borderTop: "2.5px solid #0ea5e9", animation: "spin 0.7s linear infinite" },
    loadingLabel: { fontSize: 13, color: "#94a3b8" },
    canvas: { display: "block", maxWidth: "100%", width: "100%" },
    errorBar: { padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 13, color: "#dc2626" },

    sidebar: { width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 0 },
    sidebarHeader: { fontSize: 11, fontWeight: 600, color: "#94a3b8", letterSpacing: 0.8, textTransform: "uppercase", paddingBottom: 12, borderBottom: "1px solid #e2e8f0", marginBottom: 6 },
    noFindings: { fontSize: 13, color: "#94a3b8", padding: "16px 0" },
    findingsList: { display: "flex", flexDirection: "column", gap: 2 },
    findingGroup: { display: "flex", flexDirection: "column" },
    findingRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px", borderRadius: 7, cursor: "pointer", transition: "background 0.1s, opacity 0.15s", background: "#fff", border: "1px solid #f1f5f9", marginBottom: 2, outline: "none", WebkitTapHighlightColor: "transparent" },
    findingDim: { opacity: 0.25 },
    findingActive: { background: "#f0f9ff", border: "1px solid #f1f5f9" },
    expandArrow: { fontSize: 11, color: "#94a3b8", width: 10, flexShrink: 0, display: "inline-block", transition: "transform 0.15s" },
    findingColor: { width: 3, height: 32, borderRadius: 2, flexShrink: 0 },
    findingBody: { flex: 1, minWidth: 0 },
    findingName: { fontSize: 13, fontWeight: 500, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    findingMeta: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
    sep: { margin: "0 4px" },
    confBadge: { fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4, flexShrink: 0 },

    instanceList: { display: "flex", flexDirection: "column", gap: 1, paddingLeft: 22, marginBottom: 4 },
    instanceRow: {
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 10px", borderRadius: 6, cursor: "default",
        fontSize: 12, color: "#64748b",
        background: "#fafafa", border: "1px solid #f1f5f9",
        transition: "background 0.1s, border-color 0.1s",
        outline: "none", WebkitTapHighlightColor: "transparent",
    },
    instanceActive: { background: "#f0f9ff", border: "1px solid #f1f5f9", color: "#0369a1" },
    instanceDot: { width: 6, height: 6, borderRadius: "50%", flexShrink: 0 },
    instanceLabel: { flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    instanceConf: { fontSize: 11, fontWeight: 600, flexShrink: 0 },

    summaryBox: { marginTop: 16, padding: "14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 },
    summaryRow: { display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 },
    summaryLabel: { color: "#94a3b8" },
    summaryVal: { color: "#1e293b", fontWeight: 500, fontFamily: "monospace", fontSize: 12 },
    disclaimer: { marginTop: 14, fontSize: 11, color: "#cbd5e1", lineHeight: 1.7, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 6, background: "#fafafa" },
};