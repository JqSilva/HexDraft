<p align="center">
  <img src="public/app-icon.png" alt="HexDraft Logo" width="128" />
</p>

<h1 align="center">HexDraft</h1>

<p align="center">
  <b>Asistente Táctico Inteligente y Motor de Análisis en Tiempo Real para League of Legends</b>
</p>

<p align="center">
  HexDraft es una plataforma de escritorio diseñada para integrarse directamente con el cliente oficial de League of Legends (LCU). Permite optimizar la fase de draft, sugerir selecciones y bloqueos basados en sinergias y matchups, aplicar builds y runas de forma automática, y gestionar flujos de juego con precisión.
</p>

---

## Características Principales

- **Análisis de Draft en Tiempo Real**: Evaluación en vivo de composiciones aliadas y enemigas durante la fase de selección de campeón.
- **Recomendaciones de Pick y Ban**: Algoritmo de puntuación dinámico considerando meta, sinergia de equipo, respuestas tácticas (counter) y maestría personal.
- **Auto-Aceptar y Auto-Acción**: Aceptación programada de partidas con temporizador configurable y respuesta automática de selecciones/baneos.
- **Configuración Automática en LCU**: Aplicación de páginas de runas, hechizos de invocador y bloques de ítems en el cliente de League con un solo clic.
- **Sincronización de Base de Datos y Meta**: Actualizaciones periódicas de builds, tasas de victoria y estadísticas de carriles vía SQLite local.
- **Notificaciones por Telegram**: Notificaciones opcionales de estado de partida y selecciones directo a dispositivos móviles.
- **Detección y Selección de Carril**: Interfaz interactiva de asignación manual de posición para partidas personalizadas o de cola rápida.

---

## Arquitectura del Proyecto

```
HexDraft/
├── data/                    Base de datos SQLite local (hexdraft.db) y configuraciones
├── launcher/                Scripts de automatización en Python e instaladores Inno Setup
│   ├── app-hexdraft.py      Controlador de ejecutable principal
│   ├── automatizador-hexdraft.py  Gestor en segundo plano para el proceso de League
│   ├── compilar-hexdraft.py Script de compilación e integración
│   └── publish_installer.py Publicador de instaladores a GitHub Releases
├── public/                  Recursos gráficos de la aplicación e iconos de interfaz
├── src/
│   ├── components/react/    Componentes interactivos (Settings, DraftPage, AppUpdatePopup)
│   ├── config/              Parámetros globales y versión de la aplicación
│   ├── layouts/             Plantillas base Astro
│   ├── lib/engine/          Motor táctico de recomendación, análisis e ítemes
│   └── pages/api/           Endpoints API de integración LCU, DB y GitHub Releases
└── package.json             Configuración de dependencias y scripts Node
```

---

## Tecnologías Utilizadas

- **Core**: Astro + Node.js (Servidor SSR local en 127.0.0.1:4321)
- **Interfaz**: React + TailwindCSS (Modo oscuro militar/táctico)
- **Base de Datos**: SQLite nativo de Node.js + motor de caché JSON
- **Integración LCU**: API REST interna sobre HTTPS con WebSocket/Polling de estado de partida
- **Automatizador Desktop**: Python 3.12 (Embebido) + PyInstaller + Inno Setup

---

## Guía de Instalación y Desarrollo

### Requisitos Previos

- Node.js v22.12.0 o superior
- Python 3.10+ (opcional, para compilar instaladores Windows)

### 1. Instalación de Dependencias

```bash
npm install
```

### 2. Modo Desarrollo

Ejecuta el servidor de desarrollo local en http://127.0.0.1:4321:

```bash
npm run dev
```

### 3. Compilación de Producción

Para compilar el cliente web e interfaz Astro:

```bash
npm run build
```

---

## Compilación y Distribución de Instaladores

El repositorio incluye herramientas automatizadas en la carpeta launcher/ para empaquetar el proyecto completo en ejecutables portables de Windows:

### Compilar Instaladores Locales

Genera los binarios .exe y los setup de Inno Setup (Normal y Administrador):

```bash
python launcher/compilar-hexdraft.py
```

### Publicar Instalador en GitHub

Sube automáticamente la release del instalador al repositorio HexDraft-Launcher:

```bash
python launcher/publish_installer.py
```

---

## Licencia

Propiedad privada. Todos los derechos reservados.
