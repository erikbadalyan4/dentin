namespace Vzrad2Api.Models;

public class DetectionResult
{
    public int ImageWidth  { get; set; }
    public int ImageHeight { get; set; }
    public List<DetectionItem> Items { get; set; } = [];
}

public class DetectionItem
{
    public int    ClassId    { get; set; }
    public string ClassName  { get; set; } = "";
    public float  Confidence { get; set; }

    /// <summary>[x1, y1, x2, y2] в пикселях оригинала</summary>
    public int[]  BBox       { get; set; } = [];

    /// <summary>Список [x, y] пар — пиксели маски в координатах оригинала</summary>
    public List<int[]> MaskPixels { get; set; } = [];
}
