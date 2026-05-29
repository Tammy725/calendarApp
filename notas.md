# Notas

hola

---

## Frontend (app/)

### `app/_layout.tsx`
- Pantalla principal que envuelve todo el app
- Aquí se cargan las demas páginas

### `app/index.tsx`
- Página de inicio del app
- Tiene varias pantallas adentro: inicio, crear plan, invitar, conectar calendario, heatmap de disponibilidad, mejores horarios, y confirmación
- Aquí se escribe el nombre del plan, se eligen fechas, y se confirma el horario

### `app/join.tsx`
- Página para unirse a un plan con un código
- Escribís el código y te une al plan

### `app/(auth)/login.tsx`
- Página para iniciar sesión con Google
- Conecta tu cuenta de Google

### `app/plan/[code].tsx`
- Página de un plan ya creado
- Ves los participantes, elegís día y hora, y ves si todos están libres

---

## Backend (server/)

### `server/src/index.ts`
- Prende el servidor
- Conecta Express con Socket.io

### `server/src/routes/auth.ts`
- Crea usuarios y los loguea con Google
- Da un token JWT para identificarse

### `server/src/routes/rooms.ts`
- Crea, lista, edita y borra planes (rooms)
- Invita gente y permite unirse

### `server/src/routes/availability.ts`
- Revisa disponibilidad de todos
- Sugiere los mejores horarios según los calendarios

### `server/src/routes/calendar.ts`
- Sincroniza Google Calendar
- Trae los eventos y los guarda en la base de datos

### `server/src/routes/user.ts`
- Muestra y edita los datos del usuario

---

## Librería (lib/)

### `lib/api/client.ts`
- Llama al servidor (fetch)
- Le pone el token automáticamente

### `lib/api/auth.ts`
- Función para loguearse con Google
- Guarda el usuario en el store

### `lib/api/rooms.ts`
- Funciones para hablar con el servidor sobre planes

### `lib/api/calendar.ts`
- Funciones para sincronizar y leer el calendario

### `lib/stores/auth-store.ts`
- Guarda el usuario y el token (aunque cierres el app)

### `lib/stores/room-store.ts`
- Guarda el plan actual en memoria

### `lib/types/index.ts`
- Define cómo se ven los datos (usuario, plan, evento, etc.)

---

## Componentes

### `components/themed-view.tsx`
- Un View que cambia de color según el tema (claro/oscuro)

### `components/themed-text.tsx`
- Un Text con estilos listos (título, subtítulo, link)

### `components/haptic-tab.tsx`
- Botón que vibra suave al tocarlo (iOS)

### `components/external-link.tsx`
- Link que abre el navegador

### `components/hello-wave.tsx`
- Una manito 👋 que se mueve

### `components/parallax-scroll-view.tsx`
- Scroll con efecto de profundidad en la imagen de arriba

### `components/ui/collapsible.tsx`
- Sección que se abre y cierra (como un acordeón)

### `components/ui/icon-symbol.tsx`
- Muestra iconos (SF Symbols en iPhone, Material en Android/web)

