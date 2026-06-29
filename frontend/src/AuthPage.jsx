import { useState } from "react";
import { useAuth } from "./AuthContext";

export default function AuthPage({ lang = "ru" }) {
    const [mode, setMode]         = useState("login");
    const [email, setEmail]       = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError]       = useState(null);
    const [loading, setLoading]   = useState(false);

    const { login, register } = useAuth();

    const T = {
        ru: {
            loginTitle: "Вход в систему", registerTitle: "Регистрация",
            email: "Email", username: "Имя пользователя", password: "Пароль",
            loginBtn: "Войти", registerBtn: "Зарегистрироваться",
            toRegister: "Нет аккаунта? Зарегистрироваться",
            toLogin: "Уже есть аккаунт? Войти",
        },
        en: {
            loginTitle: "Sign in", registerTitle: "Create account",
            email: "Email", username: "Username", password: "Password",
            loginBtn: "Sign in", registerBtn: "Register",
            toRegister: "No account? Register",
            toLogin: "Already have an account? Sign in",
        }
    }[lang];

    const handleSubmit = async () => {
        // Баг-фикс: сбрасываем ошибку перед каждой попыткой
        setError(null);
        setLoading(true);
        try {
            if (mode === "login") {
                await login(email, password);
            } else {
                await register(username, email, password);
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const switchMode = () => {
        setMode(m => m === "login" ? "register" : "login");
        // Сбрасываем ошибку и поля при переключении
        setError(null);
        setEmail(""); setPassword(""); setUsername("");
    };

    return (
        <div style={s.overlay}>
            <div style={s.card}>
                <div style={s.logo}>
                    <img src="/src/assets/Dentin.svg" alt="Dentin" style={{ height: 40 }} />
                </div>
                <h2 style={s.title}>{mode === "login" ? T.loginTitle : T.registerTitle}</h2>

                {mode === "register" && (
                    <div style={s.field}>
                        <label style={s.label}>{T.username}</label>
                        <input style={s.input} type="text" value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                            autoComplete="username" placeholder="dr.ivanov" />
                    </div>
                )}

                <div style={s.field}>
                    <label style={s.label}>{T.email}</label>
                    <input style={s.input} type="email" value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                        autoComplete="email" placeholder="doctor@clinic.ru" />
                </div>

                <div style={s.field}>
                    <label style={s.label}>{T.password}</label>
                    <input style={s.input} type="password" value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                        placeholder="••••••••" />
                </div>

                {error && <div style={s.error}>{error}</div>}

                <button style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }}
                    onClick={handleSubmit} disabled={loading}>
                    {loading ? "…" : mode === "login" ? T.loginBtn : T.registerBtn}
                </button>

                <button style={s.switchBtn} onClick={switchMode}>
                    {mode === "login" ? T.toRegister : T.toLogin}
                </button>
            </div>
        </div>
    );
}

const s = {
    overlay: { minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans','Helvetica Neue',sans-serif" },
    card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "40px 40px 32px", width: 380, display: "flex", flexDirection: "column", gap: 16 },
    logo: { display: "flex", justifyContent: "center", marginBottom: 4 },
    title: { margin: 0, fontSize: 20, fontWeight: 600, color: "#0f172a", textAlign: "center" },
    field: { display: "flex", flexDirection: "column", gap: 6 },
    label: { fontSize: 12, fontWeight: 500, color: "#64748b" },
    input: { border: "1px solid #e2e8f0", borderRadius: 7, padding: "9px 12px", fontSize: 14, color: "#0f172a", outline: "none", fontFamily: "inherit" },
    error: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "10px 12px", fontSize: 13, color: "#dc2626" },
    btn: { background: "#0369a1", color: "#fff", border: "none", borderRadius: 7, padding: "11px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 4 },
    btnDisabled: { opacity: 0.6, cursor: "not-allowed" },
    switchBtn: { background: "none", border: "none", color: "#0369a1", fontSize: 13, cursor: "pointer", fontFamily: "inherit", textAlign: "center", padding: 0 },
};