namespace Vzrad2Api.Models;

public class User
{
    public int      Id           { get; set; }
    public string   Username     { get; set; } = "";
    public string   Email        { get; set; } = "";
    public string   PasswordHash { get; set; } = "";
    public DateTime CreatedAt    { get; set; } = DateTime.UtcNow;
    public DateTime? LastLogin   { get; set; }

    public ICollection<Analysis> Analyses { get; set; } = [];
}

public class Analysis
{
    public int      Id          { get; set; }
    public int      UserId      { get; set; }
    public string   Filename    { get; set; } = "";
    public int      ImageWidth  { get; set; }
    public int      ImageHeight { get; set; }
    public DateTime CreatedAt   { get; set; } = DateTime.UtcNow;

    public User     User     { get; set; } = null!;
    public ICollection<Finding> Findings { get; set; } = [];
}

public class Finding
{
    public int    Id         { get; set; }
    public int    AnalysisId { get; set; }
    public int    ClassId    { get; set; }
    public string ClassName  { get; set; } = "";
    public float  Confidence { get; set; }
    public int    BboxX1     { get; set; }
    public int    BboxY1     { get; set; }
    public int    BboxX2     { get; set; }
    public int    BboxY2     { get; set; }

    public Analysis Analysis { get; set; } = null!;
}

// ── DTO для запросов/ответов ──────────────────────────────────────────────────

public record RegisterRequest(string Username, string Email, string Password);
public record LoginRequest(string Email, string Password);

public record AuthResponse(string Token, string Username, string Email);

public record AnalysisDto(
    int      Id,
    string   Filename,
    int      ImageWidth,
    int      ImageHeight,
    DateTime CreatedAt,
    List<FindingDto> Findings
);

public record FindingDto(
    int    ClassId,
    string ClassName,
    float  Confidence,
    int[]  BBox
);
