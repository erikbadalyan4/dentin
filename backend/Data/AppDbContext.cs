using Microsoft.EntityFrameworkCore;
using Vzrad2Api.Models;

namespace Vzrad2Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User>     Users    { get; set; }
    public DbSet<Analysis> Analyses { get; set; }
    public DbSet<Finding>  Findings { get; set; }

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasKey(u => u.Id);
            e.Property(u => u.Id).HasColumnName("id");
            e.Property(u => u.Username).HasColumnName("username").HasMaxLength(50).IsRequired();
            e.Property(u => u.Email).HasColumnName("email").HasMaxLength(100).IsRequired();
            e.Property(u => u.PasswordHash).HasColumnName("password_hash").IsRequired();
            e.Property(u => u.CreatedAt).HasColumnName("created_at");
            e.Property(u => u.LastLogin).HasColumnName("last_login");
            e.HasIndex(u => u.Username).IsUnique();
            e.HasIndex(u => u.Email).IsUnique();
        });

        b.Entity<Analysis>(e =>
        {
            e.ToTable("analyses");
            e.HasKey(a => a.Id);
            e.Property(a => a.Id).HasColumnName("id");
            e.Property(a => a.UserId).HasColumnName("user_id");
            e.Property(a => a.Filename).HasColumnName("filename").HasMaxLength(255);
            e.Property(a => a.ImagePath).HasColumnName("image_path").HasMaxLength(500);  
            e.Property(a => a.ImageWidth).HasColumnName("image_width");
            e.Property(a => a.ImageHeight).HasColumnName("image_height");
            e.Property(a => a.CreatedAt).HasColumnName("created_at");
            e.HasOne(a => a.User).WithMany(u => u.Analyses).HasForeignKey(a => a.UserId);
        });

        b.Entity<Finding>(e =>
        {
            e.ToTable("findings");
            e.HasKey(f => f.Id);
            e.Property(f => f.Id).HasColumnName("id");
            e.Property(f => f.AnalysisId).HasColumnName("analysis_id");
            e.Property(f => f.ClassId).HasColumnName("class_id");
            e.Property(f => f.ClassName).HasColumnName("class_name").HasMaxLength(100);
            e.Property(f => f.Confidence).HasColumnName("confidence");
            e.Property(f => f.BboxX1).HasColumnName("bbox_x1");
            e.Property(f => f.BboxY1).HasColumnName("bbox_y1");
            e.Property(f => f.BboxX2).HasColumnName("bbox_x2");
            e.Property(f => f.BboxY2).HasColumnName("bbox_y2");
            e.HasOne(f => f.Analysis).WithMany(a => a.Findings).HasForeignKey(f => f.AnalysisId);
        });
    }
}
