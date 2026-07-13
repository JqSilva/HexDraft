# Documentación de Arquitectura de HexDraft

Bienvenido a la documentación técnica interna de los motores de HexDraft. Aquí se detalla la lógica de recomendación, scoring, y las adaptaciones dinámicas de builds.

## Índice de Documentos

* **[Motor de Recomendación de Picks (Draft Engine)](file:///d:/Documentos/HexDraft/docs/draft-engine.md):** Detalla el algoritmo de puntuación multi-capa para picks y bans, la detección de arquetipos tácticos de composiciones y los pesos del motor.
* **[Motor de Builds, Items y Runas (Build Engine)](file:///d:/Documentos/HexDraft/docs/build-engine.md):** Explica la agrupación por clusters de ítems, el cálculo de viabilidad estadística de runas y botas, y los reemplazos dinámicos contra el enemigo.

---

## Interacción entre Motores

El **Draft Engine** y el **Build Engine** colaboran en tiempo real durante la fase de selección de campeón:
1. El **Draft Engine** evalúa el estado del draft y sugiere los mejores picks optimizando sinergias, counters y composición.
2. Al bloquearse un campeón, el **Build Engine** toma ese pick junto con la composición enemiga y aliada final y extrae los clusters del campeón.
3. Evalúa la efectividad de cada cluster frente al enemigo y selecciona la mejor build adaptando dinámicamente botas, runas primarias/secundarias y swaps en el core de ítems para neutralizar las amenazas enemigas detectadas.
