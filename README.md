# Pendientes de Casa

App para ordenar los pendientes de la casa entre dos personas. Cada tema es un caso con foto y puntos por resolver. En cada punto se puede responder, adjuntar respaldos y marcarlo como resuelto, y el caso muestra su avance.

- Página: GitHub Pages (archivos `index.html`, `app.js`, `config.js`)
- Datos y fotos: Supabase (plan gratuito)
- Acceso: usuario + PIN de 4 dígitos (solo existen las cuentas que se crean en Supabase)

## Configuración (una sola vez)

1. Crear una cuenta en https://supabase.com y un proyecto nuevo (región: São Paulo).
2. **SQL Editor → New query**: pegar `supabase.sql` completo y presionar **Run**.
3. **Authentication → Sign In / Providers → Email**: desactivar **Confirm email**.
   **Authentication → Sign In / Providers**: desactivar **Allow new users to sign up**.
4. **Authentication → Users → Add user → Create new user**, dos veces:
   - `edgar@pendientes-casa.app` con contraseña = PIN + `-casa` (ej. `1234-casa`)
   - `araceli@pendientes-casa.app` con contraseña = su PIN + `-casa`
   (marcar *Auto Confirm User*). Para entrar a la app se escribe solo la parte antes de la @.
5. **Project Settings → API**: copiar *Project URL* y *anon public key* en `config.js`.

## Instalar en el teléfono

Abrir el enlace en Chrome (Android) o Safari (iPhone) y elegir **Agregar a pantalla de inicio**.
