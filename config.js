// Datos del proyecto Supabase "pendientes-casa".
// La clave "anon" es pública por diseño: los permisos (RLS) exigen iniciar sesión.
window.APP_CONFIG = {
  SUPABASE_URL: "https://gucgyinlzainhronymgo.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1Y2d5aW5semFpbmhyb255bWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwMjQ4ODAsImV4cCI6MjExMDYwMDg4MH0.yH1kl-pUJt0eofrSOxJHFDvLaqWtp3mU-8F6vKgVkL0",
  // Dominio interno para convertir "usuario" en correo de Supabase (no se envían correos).
  EMAIL_DOMAIN: "pendientes-casa.app",
  // Supabase exige contraseñas de 6+ caracteres: la app agrega este sufijo al PIN de 4 dígitos.
  PIN_SUFFIX: "-casa",
  // Nombre que se muestra la primera vez que entra cada usuario (se puede cambiar en la app).
  DEFAULT_NAMES: { edgar: "Edgar", araceli: "Sweetgirl" }
};
