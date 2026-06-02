# VZRAD2 — Dental X-Ray Segmentation Web App

## Структура проекта

```
vzrad2-app/
├── EXPORT_MODEL.ipynb      ← Шаг 1: экспорт модели из Colab
├── backend/                ← ASP.NET Core 8 API
│   ├── Controllers/
│   │   └── SegmentController.cs
│   ├── Services/
│   │   └── YoloSegmentationService.cs
│   ├── Models/
│   │   ├── SegmentationModels.cs
│   │   ├── best.onnx           ← сюда положить после экспорта
│   │   └── class_names.json    ← сюда положить после экспорта
│   ├── Program.cs
│   ├── appsettings.json
│   └── Vzrad2Api.csproj
└── frontend/               ← React (Vite)
    └── src/
        └── App.jsx
```

---

## Шаг 1 — Экспорт модели из Colab

1. Обучи YOLOv8-seg (ноутбук `vzrad2_segmentation.ipynb`)
2. Запусти `EXPORT_MODEL.ipynb` — скачает `best.onnx` и `class_names.json`
3. Положи оба файла в `backend/Models/`

---

## Шаг 2 — Запуск бэкенда

```bash
cd backend

# Требования: .NET 8 SDK
# https://dotnet.microsoft.com/download/dotnet/8.0

dotnet restore
dotnet run
# API поднимается на http://localhost:5000
```

Проверка:
```
GET http://localhost:5000/api/segment/health
→ { "status": "ok", "time": "..." }
```

---

## Шаг 3 — Запуск фронтенда

```bash
cd frontend

# Требования: Node.js 18+
npm create vite@latest . -- --template react   # если проект не создан
npm install
npm run dev
# Открыть http://localhost:5173
```

---

## API

### POST /api/segment

**Request:** `multipart/form-data`
| Поле | Тип    | Описание             |
|------|--------|----------------------|
| file | binary | Изображение (jpg/png)|

**Response:** `application/json`
```json
{
  "imageWidth": 1024,
  "imageHeight": 768,
  "items": [
    {
      "classId": 3,
      "className": "Caries",
      "confidence": 0.87,
      "bBox": [120, 200, 310, 380],
      "maskPixels": [[121, 201], [122, 201], ...]
    }
  ]
}
```

---

## Продакшен (деплой)

### Вариант A — Всё на одном сервере

```bash
# Сборка React
cd frontend && npm run build
# Скопировать dist/ → backend/wwwroot/

# Публикация .NET
cd backend && dotnet publish -c Release -o ./publish
```

### Вариант B — HuggingFace Spaces (бесплатно)

Используй Gradio или Docker Space с `dotnet` образом.

### Вариант C — Azure App Service

```bash
az webapp up --name vzrad2-api --runtime "DOTNET:8"
```

---

## Требования

| Компонент | Минимум              |
|-----------|----------------------|
| .NET SDK  | 8.0                  |
| Node.js   | 18+                  |
| RAM       | 2 ГБ (модель ~25 МБ) |
| GPU       | Не обязателен (CPU достаточно для инференса) |
