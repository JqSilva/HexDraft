# Auditoría de recomendaciones — 8 de septiembre de 2026

## Veredicto estricto

**Sistema recibido: 4/10. Picks: 4,5/10; builds: 3,5/10; runas: 4/10.** Es una valoración técnica y de criterio de juego, no una medición de winrate. Hay una base útil de datos, composición y páginas completas, pero demasiadas decisiones incorrectas o sin información suficiente para considerarlo un coach fiable.

**Después de las correcciones: alrededor de 6/10, provisional.** Se han eliminado errores reproducibles y se ha limitado la heurística cuando falta evidencia; todavía no se ha demostrado una mejora de winrate ni calibrado el ranking con drafts reales.

## Evidencia y alcance

Se inspeccionaron los motores de picks, composición, estadística, builds y runas, su hidratación desde SQLite, la API de recomendaciones y el fallback. Se ejecutaron las pruebas existentes y se añadieron 19 regresiones. Las primeras 11 fallaban antes de los cambios.

Inventario previo a la reparación de `hexdraft.db`: 173 campeones, 1394 registros de builds. Distribución: 4 del parche 16.11, 18 del 16.13, 171 del 16.15 y 1201 del 16.17. Solo cuatro registros contenían `special_notes.statsData`, así que únicamente 2 campeones podían usar la ruta adaptativa y el resto usaba fallback. Tras la reparación lane/parche 16.17: 173 campeones, 1245 builds totales, 1052 del parche 16.17 y 255 builds con `statsData` y `roleEvidenceVersion=2`. Las 254 tareas de reparación terminaron correctamente; Wukong TOP/JUNGLE necesitó un alias de slug específico. Esto describe esta copia local, no todas las instalaciones del producto.

Reproducción del inventario: `node scripts/audit-recommendation-data.mjs`. El script abre SQLite en modo solo lectura y no importa servicios de la aplicación.

No se realizó una evaluación dentro de una partida ni un benchmark humano de cientos de drafts. La nota se apoya en comportamiento reproducido, código y cobertura local.

## Errores corregidos

| Área | Antes | Ahora |
| --- | --- | --- |
| Estadística | Pickrates de 0–1 se multiplicaban por 100; 1% podía superar a 2% con igual WR/muestra | Pickrate conserva las unidades porcentuales del adaptador |
| Picks | Ruido aleatorio de hasta 0,3 por recomendación | Ranking determinista; desempate por ID |
| Picks | El campeón que se quería reemplazar seguía contando como aliado | Se excluye de la composición evaluada |
| Composición | Dos campeones de poke se clasificaban como siege por señales y prioridad duplicadas | Poke y siege tienen señales diferenciadas |
| Composición | Cualquier hard CC se interpretaba como iniciación | Se requiere señal de engage |
| Composición | Necesitar peel individualmente equivalía a que todo el equipo carecía de peel | Se comprueba si otro rival cubre esa necesidad; también para engage |
| Respuesta al draft | Poke recibía un bono automático contra engage pesado | Se priorizan peel y disengage en esa regla |
| Evidencia de picks | No se leía `special_notes.statsData` ni el campo `header.pr` | Se reconocen esas rutas de la fuente |
| Builds | Bonificación a cualquier core AP contra curación | La bonificación requiere antiheal en el core |
| Builds | Cuchilla Negra, Sterak y varios defensivos estaban prohibidos para todo AD | Se eliminan esas prohibiciones generales |
| Botas | Punteras de Acero estaban prohibidas para AP | Pueden competir por evidencia y contexto |
| Items | `Armor`, `SpellBlock` y `Health` no coincidían con las categorías esperadas | Se normalizan los alias al cargar el catálogo |
| Roles | Una build con estadísticas de otro rol podía desplazar a la build estática del rol solicitado | Se prioriza el rol pedido y se normalizan sus alias |
| Builds | El jugador podía contarse a sí mismo al evaluar sobrecarga AD/AP | Se excluye de la lista de aliados |
| Builds | Swaps basados en el tipo de daño general del campeón | Se pasa el tipo de daño del cluster seleccionado |
| Builds | El test de viabilidad no encontraba items guardados en `special_notes.statsData` | Se consulta también esa ruta |
| Inventario | Las botas de una tripleta podían quedar dentro del core y en el slot de botas | Se separan del core; las alternativas usan el mismo resultado ensamblado |
| Runas | Cometa y otras keystones se descartaban por ser una build AD | Se elimina la exclusión por daño de esas runas adaptativas/utilitarias |
| Runas | Validador aceptaba keystones secundarias y filas desconocidas | Se verifican filas primarias y secundarias estrictamente |
| Runas | Faltaban slots y se devolvían ceros | Se completa una página legal de respaldo; sigue siendo heurística |
| Fragmentos | Armadura/MR retiradas o fragmentos en ranuras incorrectas | Se normalizan conforme a slots del catálogo 16.17 |
| Fallback | Cambiaba runas secundarias y fragmentos de ataque por ser AP/asesino | Conserva páginas y fragmentos observados legales |
| Fallback | Support podía recibir un objeto de misión retirado | Atlas Mundial y dos pociones |
| Invocadores | Jungla sin estadísticas recibía Flash/Teleport | Se exige Smite al seleccionar el par de jungla |
| Escala | Score de página podía superar 100 | Se limita a 100 |

| Confianza | Una opción con poca evidencia podía ganar por bonos de composición | Los bonos contextuales se reducen según la confianza estadística del rol |
| Runas contextuales | Cualquier probabilidad mínima de poke/burst podía activar una runa defensiva | Se exige al menos 45% de probabilidad de enfrentamiento |
| Objetos | Hullbreaker y Abyssal Mask podían tratarse como anti-curación | Chempunk, Morellonomicon, Mortal Reminder, Thornmail y componentes correctos |

## Lo que aún impide una recomendación profesional

### Picks

1. **Roles rivales inciertos.** El motor recibe nombres/IDs y utiliza el carril habitual del campeón. Un flex rival puede generar una lectura equivocada de counter de línea. Debe recibir posiciones confirmadas o probabilidades por rol, separando matchup de línea y amenaza global.
2. **Evidencia mezclada.** Se suman señales estadísticas, de tier y de contexto en varias capas; aunque las muestras ahora se suavizan, todavía falta calibrar un único contrato de evidencia contra drafts reales.
3. **Sinergias y counters.** Ya se ponderan por muestra y rol, pero falta calibrar cuánto debe pesar cada pareja frente al meta y limitar mejor interacciones muy raras.
4. **Balance de daño demasiado simple.** Un support de daño mágico puede ocultar una composición de carries físicos. Ponderar aportación esperada de daño, recursos y capacidad real de amenazar objetivos; no contar campeones como votos iguales.
5. **Escalado mal conectado.** El repositorio genera una curva sintética de seis valores, pero el scorer busca el índice 7 para late o puntos con `time`. Ese late cae a 50; los porcentajes sintéticos no son evidencia observada. Usar curvas reales, muestra por tramo y etiqueta cualitativa cuando falten datos.
6. **Planes de equipo penalizados mecánicamente.** Tres campeones de poke no son automáticamente un exceso: pueden ser un plan válido si hay waveclear, disengage y acceso a objetivos. Las penalizaciones deben detectar carencias del plan, no castigar la repetición de una etiqueta.
7. **Flex y blind pick.** Tener varios roles o un tier alto no demuestra seguridad a ciegas. Valorar matchups castigables, pool del jugador, posiciones abiertas y alternativas realmente disponibles para los aliados.

### Builds y runas

1. **Frescura y cobertura por rol.** La cobertura de builds principales del parche actual ya es alta; falta automatizar su frescura y detectar rápidamente una fuente incompleta.
2. **Las runas no reciben el matchup.** `selectRunesForCluster` no toma enemigos, rival de línea ni plan de trade. Hoy puede elegir una página legal con evidencia, pero no justificar una adaptación real al enfrentamiento. Preferir páginas conjuntas observadas condicionadas al rol, keystone y core; no sumar popularidades marginales como si se hubieran jugado juntas.
3. **Amenazas por exposición.** Contar tanques, curadores o campeones AP no estima quién te alcanza ni quién inflige el daño. No toda curación justifica comprar un antiheal completo; importan aplicación, timing y quién lo compra. No todo CC se reduce con tenacidad.
4. **Compra secuencial y restricciones.** Los finales de build y las ramas se rellenan con listas genéricas. Falta modelar componentes, presupuesto, estados del juego, exclusiones entre objetos y campeones que no compran botas. Las botas de ataque siguen sujetas a filtros generales demasiado amplios.
5. **Tanks y daño híbrido.** Clasificar una build sin objetos ofensivos como AP es un supuesto débil. Separar estilo defensivo, on-hit, crítico, letalidad, burn y utilidad de la distribución de daño del campeón.
6. **Scores y explicaciones divergentes.** El score contextual del cluster se calcula distinto del resumen expuesto, y algunas explicaciones de botas son incondicionales. Publicar un mismo desglose trazable y distinguir 'observado' de 'inferido'.

## Prioridad de implementación

- **P0:** cobertura/frescura por rol; contrato porcentual y conteos ausentes; identificar fallback y validar toda salida final.
- **P1 picks:** posiciones rivales probabilísticas, matchup ajustado por muestra, balance de daño por carries y evaluación del plan de composición.
- **P1 builds/runas:** páginas conjuntas por variante, decisiones de supervivencia según amenaza y timing de compra; nada de presentar una página genérica como respuesta específica al rival.
- **P2:** benchmark de al menos 100 drafts revisados manualmente, con elección aceptable dentro del top 3, justificaciones verificables, estabilidad y cero páginas/inventarios ilegales. Separar el benchmark de legalidad de la calidad estratégica. Medir por rol y por cantidad de información disponible.

## Verificación y limitaciones operativas

Comandos de regresión: `node --import tsx tests/engineAudit.test.ts`, `node --import tsx tests/buildQuality.test.ts`, `node --import tsx tests/recommendationScoring.test.ts`. TypeScript: `npx tsc --noEmit`. ESLint dirigido al motor modificado: sin errores; el lint global conserva errores heredados en componentes fuera de este trabajo. Compilación completa con `HEXDRAFT_DISABLE_SCHEDULER=1 npm run build`: correcta. Astro/Vite mantienen advertencias de atributos JSON inconsistentes y módulos Node externalizados para navegador; no equivalen a validación de la UI en ejecución. No se ha publicado una release.

Una primera prueba de hidratación de assets cargó indirectamente LCU y el scheduler, que refrescó tiers/winrates de SQLite. Se detuvo el proceso y se restauró el archivo generado `meta-cache.json`; el refresco de SQLite sí se ejecutó y no se revirtió. Las pruebas nuevas aíslan `window`/`fetch` para no iniciar esos servicios. Las compilaciones posteriores desactivan el scheduler mediante `HEXDRAFT_DISABLE_SCHEDULER=1`.

## Referencias de juego

- Riot documentó la retirada de fragmentos de armadura/MR en [14.2](https://www.leagueoflegends.com/en-us/news/game-updates/patch-14-2-notes/).
- Los slots de fragmentos se contrastaron con [perkstyles del catálogo 16.17](https://raw.communitydragon.org/16.17/plugins/rcp-be-lol-game-data/global/default/v1/perkstyles.json).
- Riot advierte del sesgo de selección en WR de runas atípicas en [14.13](https://www.leagueoflegends.com/en-gb/news/game-updates/lol-patch-14-13-notes/): WR alto no demuestra superioridad causal.

Los juicios estratégicos del informe son criterios de diseño del recomendador, no afirmaciones de que un campeón específico sea óptimo en el meta actual.
