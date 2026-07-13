# Motor de Builds, Items y Runas (Build Engine)

Este documento explica en detalle el funcionamiento del motor de builds adaptativas de HexDraft. Describe la detección de clusters, el cálculo del score de viabilidad, la selección coherente de runas y las adaptaciones contextuales de ítems frente al draft de la partida.

---

## Detección de Clusters de Builds

HexDraft no recomienda una única build genérica para cada campeón; en su lugar, detecta múltiples estilos o "clusters" de builds que el campeón puede jugar (ej. Diana AP Assasin vs Diana AP Off-Tank).

Este proceso es realizado por la función [detectBuildClusters](file:///d:/Documentos/HexDraft/src/lib/engine/itemEngine.ts#L1061):

1. **Huella dactilar (`coreItem2`):** El motor lee los datos de DPM (datos agregados de partidas de rango alto) para el campeón y analiza la lista `coreItem2`. Esta lista contiene los pares de dos primeros ítems terminados más comunes.
2. **Pivote y Agrupación:** Los pares se agrupan por su primer ítem terminado (llamado `pivotItem`).
3. **Puntuación y Filtros:** Se calcula el pickrate total y el winrate ponderado por partidas para cada pivote. Se descartan aquellos clusters con pickrate menor al 3.0%.
4. **Núcleo Representativo (`representativeCore`):** Para cada cluster de pivote, se busca la combinación de 3 ítems (`coreItem3`) más común. Si no se encuentra, se hace fallback al par de ítems más popular de ese pivote.
5. **Clasificación de Daño:** El motor clasifica el tipo de daño del core mediante [classifyItemsDamageType](file:///d:/Documentos/HexDraft/src/lib/engine/itemEngine.ts#L1018), que analiza las categorías de los ítems en base a la base de datos de ítems (`ITEMS_DB`) para determinar si el cluster es **AD**, **AP** o **Hybrid**.

---

## Cálculo del Score de Viabilidad (viabilityScore)

La viabilidad de runas, botas, ítems iniciales y hechizos se calcula evaluando conjuntamente el winrate y el pickrate del elemento para evitar recomendar elementos atípicos con winrate inflado por pocas partidas (trolls).

La función matemática que rige esto es [viabilityScore](file:///d:/Documentos/HexDraft/src/lib/engine/itemEngine.ts#L1008):

$$\text{viabilityScore} = (\text{winrate} - 50) \times 2 \times \text{confidence}$$

Donde la confianza estadistica ($\text{confidence}$) se calcula según el pickrate:
* Si el $\text{pickrate} < 2.0\%$: 
  $$\text{confidence} = \frac{\text{pickrate}}{2}$$
* Si el $\text{pickrate} \ge 2.0\%$: 
  $$\text{confidence} = \min\left(\frac{\text{pickrate}}{10}, 1.0\right)$$

Esto garantiza que las opciones con pickrate superior al $10\%$ tengan confianza máxima ($1.0$), mientras que los pickrates muy bajos sean fuertemente penalizados en el score.

---

## Selección Coherente de Runas por Cluster

La función [selectRunesForCluster](file:///d:/Documentos/HexDraft/src/lib/engine/itemEngine.ts#L1716) orquesta la página de runas completa:

1. **Deducción del Playstyle:** Traduce el cluster de ítems y el tipo de daño a una etiqueta de estilo de juego (ej. *AD Lethality*, *AP Burn*, *AD Bruiser*) usando el helper `getClusterTitle`.
2. **Filtrado de Keystones:** Se eliminan runas clave incompatibles usando [filterKeystonesByCluster](file:///d:/Documentos/HexDraft/src/lib/engine/itemEngine.ts#L1446) (ej. no seleccionar Cometa Arcano en clusters AD).
3. **Selección del Árbol Primario:** Se escoge la mejor keystone usando `selectBestRune` aplicando bonificaciones de estilo de juego. El resto de runas del árbol primario se filtran usando [filterPrimaryTreeByKeystone](file:///d:/Documentos/HexDraft/src/lib/engine/itemEngine.ts#L1473) para forzar que pertenezcan al mismo estilo (estilo Precision, Sorcery, etc.).
4. **Selección de Secundarias:** Se determinan a través de [getBestSecondaryRunesForCluster](file:///d:/Documentos/HexDraft/src/lib/engine/itemEngine.ts#L1498):
   * Excluye árboles prohibidos por daño (ej. rama de Brujería para AD, Precisión para AP).
   * Suma el `viabilityScore` de las dos mejores runas de cada árbol secundario posible.
   * Elige el árbol con mayor puntaje combinado y selecciona esas dos runas óptimas.
5. **Selección de Shards (Rastros de estadísticas):** Evaluado en `selectShardsForCluster`, ajusta defensas según daño enemigo o velocidad de ataque según las necesidades de la clase de campeón.

---

## Adaptaciones Dinámicas de Ítems (Swaps y Ramas)

El motor de items adapta la build ganadora contextualizándola contra el draft del equipo enemigo mediante:

### 1. Swaps en el Core (getCoreItemSwaps)
Propone reemplazos uno a uno de los ítems del núcleo si el contexto enemigo lo amerita:
* **Grievous Wounds (Heridas Graves):** Si el enemigo tiene 2 o más campeones con curación, y el core no tiene anti-heal, reemplaza el último ítem del core por el anti-heal de la clase (ej. `3165 Morellonomicon` para AP, `3033 Mortal Reminder` o `3181 Chempunk Chainsword` para AD).
* **Penetración de Armadura / Mágica:** Si el enemigo tiene 2 o más tanques, y la build carece de penetración, introduce `3036 Lord Dominik's` o `3135 Void Staff`.
* **Remoción de Penetración Excesiva:** Si el core tiene penetración mágica porcentual (`3135 Void Staff`) pero no hay tanques en el enemigo, lo reemplaza por `4645 Shadowflame` para infligir daño verdadero a campeones frágiles.

### 2. Ramas de Compra Dinámicas (getDynamicPaths)
Genera rutas para el cuarto y quinto ítem adaptadas en tiempo real:
* **Snowball (Ventaja):** Recomienda ítems puramente ofensivos con alta calificación.
* **Neutral (Estándar):** Ítems balanceados (ofensivos/defensivos combinados).
* **Behind (Desventaja):** Ítems puramente defensivos orientados a resistir el tipo de daño predominante en el enemigo (AD/AP).

---

## Constantes y Mapas de Calibración Clave

Para cambiar las reglas de selección de ítems y runas del motor, edita las siguientes constantes en [itemEngine.ts](file:///d:/Documentos/HexDraft/src/lib/engine/itemEngine.ts):

* **Mapas de Coherencia de Daño de Runas:**
  * `KEYSTONE_DAMAGE_TYPE` ([Línea 146](file:///d:/Documentos/HexDraft/src/lib/engine/itemEngine.ts#L146)): Mapea cada Keystone (ID) a su tipo de daño (`AD`, `AP` o `Hybrid`).
  * `RUNE_TREE_DAMAGE_TYPE` ([Línea 171](file:///d:/Documentos/HexDraft/src/lib/engine/itemEngine.ts#L171)): Clasifica los árboles de runas principales.

* **Listas de Incompatibilidades y Filtros:**
  * `CLUSTER_ITEM_BLACKLIST` ([Línea 97](file:///d:/Documentos/HexDraft/src/lib/engine/itemEngine.ts#L97)): Bloquea la compra de ítems AD en clusters AP y viceversa.
  * `BOOTS_BLACKLIST` ([Línea 134](file:///d:/Documentos/HexDraft/src/lib/engine/itemEngine.ts#L134)): Bloquea botas específicas por clase (ej. prohibir botas de velocidad de ataque en asesinos AD).

* **Preferencia de Estilo de Juego (Playstyles):**
  * `PLAYSTYLE_KEYSTONES` ([Línea 179](file:///d:/Documentos/HexDraft/src/lib/engine/itemEngine.ts#L179)): Prioriza keystones según el título del cluster deducido.
  * `PLAYSTYLE_SECONDARY_STYLES` ([Línea 190](file:///d:/Documentos/HexDraft/src/lib/engine/itemEngine.ts#L190)): Árboles secundarios recomendados por estilo de juego.

* **Umbrales de Adaptación Contextual:**
  * `ADAPTATION_THRESHOLDS` ([Línea 761](file:///d:/Documentos/HexDraft/src/lib/engine/itemEngine.ts#L761)): Configura el número mínimo de curadores/tanques enemigos necesarios para disparar adaptaciones, y el número máximo de ítems del core a reemplazar (`maxCoreDisruption`).
