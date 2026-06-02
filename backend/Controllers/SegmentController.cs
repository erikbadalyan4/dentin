using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vzrad2Api.Data;
using Vzrad2Api.Models;
using Vzrad2Api.Services;

namespace Vzrad2Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize] // все эндпоинты требуют JWT
public class SegmentController : ControllerBase
{
    private readonly YoloDetectionService _yolo;
    private readonly AppDbContext            _db;
    private readonly ILogger<SegmentController> _logger;

    private const long MaxFileSize = 20 * 1024 * 1024;

    public SegmentController(YoloDetectionService yolo,
                             AppDbContext db,
                             ILogger<SegmentController> logger)
    {
        _yolo   = yolo;
        _db     = db;
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
            using var stream = file.OpenReadStream();
            var result = await Task.Run(() => _yolo.Predict(stream));

            // Сохраняем в БД
            var userId   = JwtService.GetUserId(User);
            var analysis = new Analysis
            {
                UserId      = userId,
                Filename    = file.FileName,
                ImageWidth  = result.ImageWidth,
                ImageHeight = result.ImageHeight,
                Findings    = result.Items.Select(item => new Finding
                {
                    ClassId    = item.ClassId,
                    ClassName  = item.ClassName,
                    Confidence = item.Confidence,
                    BboxX1     = item.BBox[0],
                    BboxY1     = item.BBox[1],
                    BboxX2     = item.BBox[2],
                    BboxY2     = item.BBox[3],
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

    // GET /api/segment/history  — история текущего пользователя
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
                a.ImageWidth,
                a.ImageHeight,
                a.CreatedAt,
                a.Findings.Select(f => new FindingDto(
                    f.ClassId, f.ClassName, f.Confidence,
                    new int[] { f.BboxX1, f.BboxY1, f.BboxX2, f.BboxY2 }
                )).ToList()
            ))
            .ToListAsync();

        return Ok(analyses);
    }

    // GET /api/segment/health
    [HttpGet("health")]
    [AllowAnonymous]
    public IActionResult Health() => Ok(new { status = "ok", time = DateTime.UtcNow });
}
