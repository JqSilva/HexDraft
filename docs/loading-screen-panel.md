# Panel de Pantalla de Carga y Juego en Vivo (Live Game Panel)

Este documento describe la arquitectura, flujo de datos y estrategia de fallback del panel de pantalla de carga y partida en vivo de HexDraft.

---

## 1. Propósito

El **Live Game Panel** proporciona inteligencia táctica en tiempo real durante la pantalla de carga (Loading Screen) y el transcurso de la partida (InProgress). Muestra los campeones, nombres de invocador, rangos, estadísticas de maestría y alineación de equipos (ORDER / HARMONY) para anticipar dinámicamente las amenazas enemigas.

---

## 2. Fuentes de Datos y Estrategia de Fallback

El endpoint `/api/live-game` implementa una estrategia de consulta de tres capas en cascada para garantizar la máxima disponibilidad:

1. **Capa 1: Live Client Data API (Puerto 2999)**
   - Consulta el endpoint local `https://127.0.0.1:2999/liveclientdata/playerlist`.
   - Utilizado cuando el cliente del juego está ejecutando el proceso `League of Legends.exe`.
   - Proporciona nombres de invocador, campeones seleccionados, equipo asignado y posición.

2. **Capa 2: LCU Lockfile (Gameflow & ChampSelect)**
   - Si la API del puerto 2999 no responde (ej. antes de renderizar el motor 3D), se consulta el cliente LCU local mediante las credenciales extraídas del `lockfile`.
   - Lee el estado de `/lol-gameflow/v1/session` y `/lol-champ-select/v1/session`.

3. **Capa 3: Riot Spectator API / Fallback DB Local**
   - Para cuentas sincronizadas con Riot API key o almacenamiento de maestría en la base de datos SQLite local (`hexdraft.db`), se hidratan las maestrías y rangos actualizados.

---

## 3. Flujo de Activación y Polling

```
[DraftPage / AutoUpdateGuard]
          |
  Polling /api/game-status (cada 1.5s - 5s)
          |
  ¿Fase InProgress / isLoadingScreen?
     /        \
   Sí          No
  /              \
Renderizar      Ocultar Panel
LiveGamePanel
```

- **Manejo de Re-renders**: Las peticiones de estado se ejecutan usando flags de cancelación (`ignore`) para prevenir re-renders en cascada o actualizaciones de estado impuras en React.

---

## 4. Estructura de Datos Retornada (`/api/live-game`)

```typescript
interface LiveGameResponse {
  gameMode: string;
  gameTime: number;
  myTeam: LivePlayer[];
  theirTeam: LivePlayer[];
  blueTeam?: LivePlayer[];
  redTeam?: LivePlayer[];
}
```
