<p align="center">
  <img src="logo.png" alt="HexDraft Logo" width="120" />
</p>


# HexDraft

Análisis inteligente de draft en tiempo real para League of Legends.  
Diseñado para optimizar decisiones, automatizar flujos y entregar ventaja competitiva.

---

## Overview

HexDraft es una aplicación local que se integra con el cliente de League of Legends para:

- Analizar composiciones en tiempo real  
- Generar recomendaciones de picks y bans  
- Aplicar builds automáticamente  
- Sincronizar datos de meta y rendimiento  

Todo con una interfaz rápida, directa y sin distracciones.

---

## Stack

- Astro  
- React  
- TailwindCSS  
- Node.js  
- Python  

---

## Getting Started

Instalar dependencias:

```bash
npm install
```
Modo desarrollo:

```bash
npm run dev
```
Build de producción:

```bash
npm run build
```
Preview:

```bash
npm run preview
```
## Automation
HexDraft incluye un servicio opcional que:

- Detecta cuando se abre League of Legends
- Inicia automáticamente el servidor
- Abre la interfaz en modo app
- Cierra todo al salir del juego


Compilar ejecutable:

```bash
python compilar-hexdraft.py
```
## Architecture
HexDraft incluye un servicio opcional que:

- engine/ lógica de recomendaciones
- data/ base de datos y meta
- react/ interfaz interactiva
- scripts/ sincronización y procesamiento

#Status
Proyecto en desarrollo activo.

#License
Private
