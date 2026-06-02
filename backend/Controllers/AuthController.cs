using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vzrad2Api.Data;
using Vzrad2Api.Models;
using Vzrad2Api.Services;

namespace Vzrad2Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JwtService   _jwt;

    public AuthController(AppDbContext db, JwtService jwt)
    {
        _db  = db;
        _jwt = jwt;
    }

    // POST /api/auth/register
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Username) ||
            string.IsNullOrWhiteSpace(req.Email)    ||
            string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Все поля обязательны" });

        if (req.Password.Length < 6)
            return BadRequest(new { error = "Пароль минимум 6 символов" });

        if (await _db.Users.AnyAsync(u => u.Email == req.Email))
            return Conflict(new { error = "Email уже зарегистрирован" });

        if (await _db.Users.AnyAsync(u => u.Username == req.Username))
            return Conflict(new { error = "Имя пользователя занято" });

        var user = new User
        {
            Username     = req.Username.Trim(),
            Email        = req.Email.Trim().ToLower(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        var token = _jwt.GenerateToken(user);
        return Ok(new AuthResponse(token, user.Username, user.Email));
    }

    // POST /api/auth/login
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) ||
            string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Введите email и пароль" });

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Email == req.Email.Trim().ToLower());

        if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized(new { error = "Неверный email или пароль" });

        user.LastLogin = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var token = _jwt.GenerateToken(user);
        return Ok(new AuthResponse(token, user.Username, user.Email));
    }
}
