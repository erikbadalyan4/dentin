using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using System.Text.Json;
using Vzrad2Api.Models;

namespace Vzrad2Api.Services;

/// <summary>
/// Инференс YOLOv8m (Detection) через ONNX Runtime.
/// Формат выхода YOLOv8 Detection ONNX:
///   output0 — [1, 4+nc, 8400]  (cx, cy, w, h, scores...)
/// </summary>
public class YoloDetectionService : IDisposable
{
    private readonly InferenceSession _session;
    private readonly List<string> _classNames;
    private readonly string _inputName;

    private const int InputSize = 640;
    private const float ConfThreshold = 0.25f;
    private const float IouThreshold = 0.45f;

    public YoloDetectionService(IWebHostEnvironment env)
    {
        var modelPath = Path.Combine(env.ContentRootPath, "Models", "best.onnx");
        var namesPath = Path.Combine(env.ContentRootPath, "Models", "class_names.json");

        var opts = new Microsoft.ML.OnnxRuntime.SessionOptions();
        opts.GraphOptimizationLevel = GraphOptimizationLevel.ORT_ENABLE_ALL;
        _session = new InferenceSession(modelPath, opts);
        _inputName = _session.InputMetadata.Keys.First();

        var json = File.ReadAllText(namesPath);
        _classNames = JsonSerializer.Deserialize<List<string>>(json)!;
    }

    public DetectionResult Predict(Stream imageStream)
    {
        using var original = Image.Load<Rgb24>(imageStream);
        int origW = original.Width, origH = original.Height;

        // ── 1. Letterbox препроцессинг ────────────────────────────────────────
        float scale = Math.Min((float)InputSize / origW, (float)InputSize / origH);
        int newW = (int)(origW * scale), newH = (int)(origH * scale);
        int padX = (InputSize - newW) / 2, padY = (InputSize - newH) / 2;

        using var resized = original.Clone(ctx =>
        {
            ctx.Resize(newW, newH);
            ctx.Pad(InputSize, InputSize, Color.FromRgb(114, 114, 114));
        });

        var tensor = new DenseTensor<float>(new[] { 1, 3, InputSize, InputSize });
        resized.ProcessPixelRows(accessor =>
        {
            for (int y = 0; y < InputSize; y++)
            {
                var row = accessor.GetRowSpan(y);
                for (int x = 0; x < InputSize; x++)
                {
                    tensor[0, 0, y, x] = row[x].R / 255f;
                    tensor[0, 1, y, x] = row[x].G / 255f;
                    tensor[0, 2, y, x] = row[x].B / 255f;
                }
            }
        });

        // ── 2. Инференс ───────────────────────────────────────────────────────
        var inputs = new List<NamedOnnxValue>
        {
            NamedOnnxValue.CreateFromTensor(_inputName, tensor)
        };
        using var outputs = _session.Run(inputs);

        // output0: [1, 4+nc, 8400]
        var out0 = outputs[0].AsTensor<float>();
        int nc = _classNames.Count;
        int numPreds = out0.Dimensions[2]; // 8400

        // ── 3. Парсинг детекций ───────────────────────────────────────────────
        var detections = new List<Detection>();

        for (int i = 0; i < numPreds; i++)
        {
            float maxConf = 0f;
            int maxCls = 0;
            for (int c = 0; c < nc; c++)
            {
                float conf = out0[0, 4 + c, i];
                if (conf > maxConf) { maxConf = conf; maxCls = c; }
            }
            if (maxConf < ConfThreshold) continue;

            float cx = out0[0, 0, i];
            float cy = out0[0, 1, i];
            float bw = out0[0, 2, i];
            float bh = out0[0, 3, i];

            detections.Add(new Detection
            {
                X1 = cx - bw / 2f,
                Y1 = cy - bh / 2f,
                X2 = cx + bw / 2f,
                Y2 = cy + bh / 2f,
                Confidence = maxConf,
                ClassId = maxCls,
            });
        }

        // ── 4. NMS ────────────────────────────────────────────────────────────
        var kept = NMS(detections, IouThreshold);

        // ── 5. Конвертация в координаты оригинала ─────────────────────────────
        float toOrigX(float v) => Math.Clamp((v - padX) / scale, 0, origW);
        float toOrigY(float v) => Math.Clamp((v - padY) / scale, 0, origH);

        var resultItems = kept.Select(det => new DetectionItem
        {
            ClassId = det.ClassId,
            ClassName = _classNames[det.ClassId],
            Confidence = det.Confidence,
            BBox = [
                (int)toOrigX(det.X1), (int)toOrigY(det.Y1),
                (int)toOrigX(det.X2), (int)toOrigY(det.Y2)
            ],
            MaskPixels = [] // Detection не имеет масок
        }).ToList();

        return new DetectionResult
        {
            ImageWidth = origW,
            ImageHeight = origH,
            Items = resultItems
        };
    }

    // ── NMS ───────────────────────────────────────────────────────────────────
    private static List<Detection> NMS(List<Detection> dets, float iouThresh)
    {
        var sorted = dets.OrderByDescending(d => d.Confidence).ToList();
        var result = new List<Detection>();

        while (sorted.Count > 0)
        {
            var best = sorted[0];
            result.Add(best);
            sorted.RemoveAt(0);
            sorted.RemoveAll(d => d.ClassId == best.ClassId && IoU(best, d) > iouThresh);
        }
        return result;
    }

    private static float IoU(Detection a, Detection b)
    {
        float ix1 = Math.Max(a.X1, b.X1), iy1 = Math.Max(a.Y1, b.Y1);
        float ix2 = Math.Min(a.X2, b.X2), iy2 = Math.Min(a.Y2, b.Y2);
        float inter = Math.Max(0, ix2 - ix1) * Math.Max(0, iy2 - iy1);
        float areaA = (a.X2 - a.X1) * (a.Y2 - a.Y1);
        float areaB = (b.X2 - b.X1) * (b.Y2 - b.Y1);
        return inter / (areaA + areaB - inter + 1e-6f);
    }

    public void Dispose() => _session.Dispose();

    private sealed class Detection
    {
        public float X1, Y1, X2, Y2, Confidence;
        public int ClassId;
    }
}