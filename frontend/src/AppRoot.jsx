import { useState } from "react";
import { useAuth } from "./AuthContext";
import AuthPage from "./AuthPage";
import App from "./App";   // твой существующий App.jsx

export default function AppRoot() {
  const { user, logout } = useAuth();
  const [lang, setLang]  = useState("ru");

  // Не авторизован — показываем страницу входа
  if (!user) {
    return <AuthPage lang={lang} />;
  }

  // Авторизован — показываем основное приложение
  // Передаём lang и user в App через props (нужно добавить поддержку в App.jsx)
  return <App lang={lang} setLang={setLang} user={user} onLogout={logout} />;
}
