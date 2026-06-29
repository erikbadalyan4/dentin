using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vzrad2Api.Data;
using Vzrad2Api.Models;
using Vzrad2Api.Services;

namespace Vzrad2Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SegmentController : ControllerBase
{
    private readonly YoloDetectionService _yolo;
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<SegmentController> _logger;
    private const long MaxFileSize = 20 * 1024 * 1024;

    public SegmentController(YoloDetectionService yolo,
                             AppDbContext db,
                             IWebHostEnvironment env,
                             ILogger<SegmentController> logger)
    {
        _yolo = yolo;
        _db = db;
        _env = env;
        _logger = logger;
    }

    // POST /api/segment
    [HttpPost]
    [RequestSizeLimit(MaxFileSize)]
    public async Task<IActionResult> Predict(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "Файл не загружен" });

        if (file.Length > MaxFileSize)
            return BadRequest(new { error = "Файл слишком большой (макс. 20 МБ)" });

        var ext = Path.GetExtension(file.FileName).ToLower();
        if (ext is not (".jpg" or ".jpeg" or ".png" or ".bmp" or ".webp"))
            return BadRequest(new { error = "Поддерживаются только jpg/png/bmp/webp" });

        try
        {
            // ── Сохраняем файл на диск ────────────────────────────────────────
            var uploadsDir = Path.Combine(_env.ContentRootPath, "uploads");
            Directory.CreateDirectory(uploadsDir);

            var savedName = $"{Guid.NewGuid()}{ext}";
            var savedPath = Path.Combine(uploadsDir, savedName);

            // Читаем стрим один раз в память — нужен и для инференса, и для сохранения
            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            var imageBytes = ms.ToArray();

            await System.IO.File.WriteAllBytesAsync(savedPath, imageBytes);

            // ── Инференс ──────────────────────────────────────────────────────
            using var inferStream = new MemoryStream(imageBytes);
            var result = await Task.Run(() => _yolo.Predict(inferStream));

            // ── Сохраняем в БД ────────────────────────────────────────────────
            var userId = JwtService.GetUserId(User);
            var analysis = new Analysis
            {
                UserId = userId,
                Filename = file.FileName,
                ImagePath = savedName,        // только имя файла, не полный путь
                ImageWidth = result.ImageWidth,
                ImageHeight = result.ImageHeight,
                Findings = result.Items.Select(item => new Finding
                {
                    ClassId = item.ClassId,
                    ClassName = item.ClassName,
                    Confidence = item.Confidence,
                    BboxX1 = item.BBox[0],
                    BboxY1 = item.BBox[1],
                    BboxX2 = item.BBox[2],
                    BboxY2 = item.BBox[3],
                }).ToList()
            };

            _db.Analyses.Add(analysis);
            await _db.SaveChangesAsync();

            _logger.LogInformation("User {UserId} — {Count} объектов в {File}",
                                   userId, result.Items.Count, file.FileName);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка инференса");
            return StatusCode(500, new { error = "Ошибка обработки изображения" });
        }
    }

    // GET /api/segment/history
    [HttpGet("history")]
    public async Task<IActionResult> History()
    {
        var userId = JwtService.GetUserId(User);

        var analyses = await _db.Analyses
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.CreatedAt)
            .Include(a => a.Findings)
            .Take(50)
            .Select(a => new AnalysisDto(
                a.Id,
                a.Filename,
                a.ImagePath,
                a.ImageWidth,
                a.ImageHeight,
                a.CreatedAt,
                a.Findings.Select(f => new FindingDto(
                    f.ClassId, f.ClassName, f.Confidence,
                    new[] { f.BboxX1, f.BboxY1, f.BboxX2, f.BboxY2 }
                )).ToList()
            ))
            .ToListAsync();

        return Ok(analyses);
    }

    [HttpGet("uploads/{filename}")]
    [AllowAnonymous]
    public IActionResult GetUpload(string filename)
    {
        // Защита от path traversal
        if (filename.Contains('/') || filename.Contains('\\') || filename.Contains(".."))
            return BadRequest();

        var path = Path.Combine(_env.ContentRootPath, "uploads", filename);
        if (!System.IO.File.Exists(path))
            return NotFound();

        var ext = Path.GetExtension(filename).ToLower();
        var mimeType = ext switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".bmp" => "image/bmp",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };

        return PhysicalFile(path, mimeType);
    }

    // DELETE /api/segment/history/{id}
    [HttpDelete("history/{id:int}")]
    public async Task<IActionResult> DeleteAnalysis(int id)
    {
        var userId = JwtService.GetUserId(User);
        var analysis = await _db.Analyses
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId);

        if (analysis is null)
            return NotFound(new { error = "Анализ не найден" });

        // Удаляем файл с диска если есть
        if (!string.IsNullOrEmpty(analysis.ImagePath))
        {
            var filePath = Path.Combine(_env.ContentRootPath, "uploads", analysis.ImagePath);
            if (System.IO.File.Exists(filePath))
                System.IO.File.Delete(filePath);
        }

        _db.Analyses.Remove(analysis);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // GET /api/segment/health
    [HttpGet("health")]
    [AllowAnonymous]
    public IActionResult Health() => Ok(new { status = "ok", time = DateTime.UtcNow });
}