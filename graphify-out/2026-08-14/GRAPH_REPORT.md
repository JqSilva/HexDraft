# Graph Report - HexDraft  (2026-08-12)

## Corpus Check
- 157 files · ~115,428 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 838 nodes · 1546 edges · 53 communities (47 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `02362791`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Layout.astro
- itemEngine.ts
- sync.service.ts
- sqlite.ts
- ChampionDetail.tsx
- getLockfileData
- DraftPage.tsx
- devDependencies
- opgg-scraper.ts
- README.md
- engine.ts
- sync-champions-cdrag.ts
- champions.repo.ts
- dependencies
- compilar-hexdraft.py
- riot-api.service.ts
- dataProvider.ts
- automatizador-hexdraft.py
- live-game.ts
- publish_installer.py
- DashboardHome.tsx
- app-hexdraft.py
- scripts
- tsconfig.json
- TacticalDirectives.tsx
- getNameFromId
- execute-action.ts
- riot-cache.service.ts
- manifest.json
- PlayerCardSandbox.tsx
- test-three-layers.ts
- TeamSidebar.tsx
- me.ts
- DraftGrid.tsx
- vite.config.ts
- dev-app.js
- load_env
- HistoryPage.tsx
- hexdraft
- Motor de Builds, Items y Runas (Build Engine)
- Motor de Recomendación de Picks (Draft Engine)
- Panel de Pantalla de Carga y Juego en Vivo (Live Game Panel)
- package.json
- Documentación de Arquitectura de HexDraft
- opgg-logs.ts
- @types/react
- @types/react-dom

## God Nodes (most connected - your core abstractions)
1. `getLockfileData()` - 46 edges
2. `getNameFromId()` - 20 edges
3. `hydrateAsset()` - 20 edges
4. `DraftPage()` - 17 edges
5. `scrapeSingleChampion()` - 16 edges
6. `analyzeComposition()` - 15 edges
7. `getAdaptedBuild()` - 15 edges
8. `getChampionCdnName()` - 14 edges
9. `syncChampionsSemanticData()` - 14 edges
10. `fetchProBuilds()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `AutoUpdateGuard()` --references--> `react`  [EXTRACTED]
  src/components/react/AutoUpdateGuard.tsx → package.json
- `checkLiveNames()` --calls--> `getLockfileData()`  [EXTRACTED]
  scripts/check-live-names.ts → src/lib/services/lcu.service.ts
- `debugInGame()` --calls--> `getLockfileData()`  [EXTRACTED]
  scripts/debug-lcu-ingame.ts → src/lib/services/lcu.service.ts
- `debugLiveGame()` --calls--> `getLockfileData()`  [EXTRACTED]
  scripts/debug-live-game-api.ts → src/lib/services/lcu.service.ts
- `findPlayers()` --calls--> `getLockfileData()`  [EXTRACTED]
  scripts/find-players-in-gameflow.ts → src/lib/services/lcu.service.ts

## Import Cycles
- None detected.

## Communities (53 total, 6 thin omitted)

### Community 0 - "Layout.astro"
Cohesion: 0.08
Nodes (22): AppUpdatePopup(), AppVersionResponse, AutoUpdateGuard(), SettingsPage(), SyncConsole(), SyncConsoleProps, SyncToast(), SyncToastProps (+14 more)

### Community 1 - "itemEngine.ts"
Cohesion: 0.07
Nodes (49): getSingleChampionBuild(), AD_ASSASSIN_FALLBACKS, AD_FIGHTER_FALLBACKS, ADAPTATION_THRESHOLDS, AP_FALLBACKS, BOOTS_BLACKLIST, BuildCluster, buildOutputForCluster() (+41 more)

### Community 2 - "sync.service.ts"
Cohesion: 0.08
Nodes (41): extractJsonFromHtml(), fetchWithFlareSolverr(), SyncEstructuraLanes(), syncItemsFromCommunityDragon(), CdragPerk, isShard(), isStyle(), normalizeIconPath() (+33 more)

### Community 3 - "sqlite.ts"
Cohesion: 0.07
Nodes (13): configRepo, isDev, closeDb(), defaultWeights, reopenDb(), AppConfig, configDir, configPath (+5 more)

### Community 4 - "ChampionDetail.tsx"
Cohesion: 0.07
Nodes (52): formatFreshness(), ProBuildPanel(), ProBuildPanelProps, ChampionDetail(), ChampionDetailProps, ChampionList(), ChampionListProps, RuneTree() (+44 more)

### Community 5 - "getLockfileData"
Cohesion: 0.09
Nodes (24): agent, debugInGame(), agent, debugLiveGame(), agent, findPlayers(), agent, testSummoners() (+16 more)

### Community 6 - "DraftPage.tsx"
Cohesion: 0.09
Nodes (25): ChampionPreviewModal, ChampionPreviewModalProps, ConnectionStatus, ConnectionStatusProps, DraftDamageBalance(), DraftDamageBalanceProps, executeLcuAction(), GAP_TRANSLATIONS (+17 more)

### Community 7 - "devDependencies"
Cohesion: 0.12
Nodes (17): eslint, @eslint/js, eslint-plugin-astro, eslint-plugin-react, eslint-plugin-react-hooks, devDependencies, eslint, @eslint/js (+9 more)

### Community 8 - "opgg-scraper.ts"
Cohesion: 0.06
Nodes (56): ProBuildData, ProBuildRunes, SituationalSwap, UseProBuildResult, cleanOldBuildCache(), DbProBuildRecord, getProBuildFromCache(), getTtlForSampleSize() (+48 more)

### Community 9 - "README.md"
Cohesion: 0.15
Nodes (12): 1. Instalación de Dependencias, 2. Modo Desarrollo, 3. Compilación de Producción, Arquitectura del Proyecto, Características Principales, Compilación y Distribución de Instaladores, Compilar Instaladores Locales, Guía de Instalación y Desarrollo (+4 more)

### Community 10 - "engine.ts"
Cohesion: 0.19
Nodes (21): BansRecommendation, championMatchesArchetype(), getBanRecommendations(), getProcessedBans(), isFlexChampion(), AllyArchetype, analyzeComposition(), ArchetypeReading (+13 more)

### Community 11 - "sync-champions-cdrag.ts"
Cohesion: 0.14
Nodes (23): API_NAME_MAP, normalizeKey(), populateDatabase(), resolveChampionId(), API_NAME_MAP, normalizeKey(), resolveChampionId(), roleToLaneMap (+15 more)

### Community 12 - "champions.repo.ts"
Cohesion: 0.12
Nodes (18): normalizeChampionName(), championsRepo, DbBuild, DbChampion, DbMatchup, DbSynergy, normalizeKey(), CACHE_PATH (+10 more)

### Community 13 - "dependencies"
Cohesion: 0.11
Nodes (19): astro, @astrojs/node, @astrojs/react, axios, cheerio, dependencies, astro, @astrojs/node (+11 more)

### Community 14 - "compilar-hexdraft.py"
Cohesion: 0.12
Nodes (21): actualizar_archivo_iss(), build_python(), buscar_iscc(), copiar_recursos_release(), descargar_python_embed(), ejecutar_iscc(), load_env(), obtener_configuracion_instaladores() (+13 more)

### Community 15 - "riot-api.service.ts"
Cohesion: 0.14
Nodes (18): computeTodayRecord(), TodayRecordResult, readLcuProfileCache(), AccountInfo, ChampionMastery, getActiveGame(), getMatchDetail(), getMatchIdsToday() (+10 more)

### Community 16 - "dataProvider.ts"
Cohesion: 0.14
Nodes (18): calculateScalingType(), CHAMPION_ALIAS, DATA_BY_LANE, defaultCounterSynergies, defaultMetaCache, ENRICHED_DB, EnrichedChampion, findInMetaCache() (+10 more)

### Community 17 - "automatizador-hexdraft.py"
Cohesion: 0.22
Nodes (17): acquire_mutex(), close_window_by_title_pattern(), get_browser_command(), get_lol_path(), is_lol_active(), is_window_active_by_title_pattern(), main(), Determina si el juego está activo mediante el archivo lockfile. (+9 more)

### Community 18 - "live-game.ts"
Cohesion: 0.27
Nodes (10): getIdFromName(), LiveMatchCache, loadLiveMatchCache(), MATCH_CACHE_FILE, resetLiveMatchFlag(), saveLiveMatchCache(), resetLastExecutedChampionId(), GET() (+2 more)

### Community 19 - "publish_installer.py"
Cohesion: 0.21
Nodes (15): delete_release(), detect_version(), get_outdated_local_installers(), get_releases(), list_local_installers(), load_env(), main(), parse_version() (+7 more)

### Community 20 - "DashboardHome.tsx"
Cohesion: 0.20
Nodes (11): getTierColorClass(), RankBadge(), RankBadgeProps, ChampionMastery, DashboardHome(), DEFAULT_SUMMONER, getChampionGradient(), getChampionRole() (+3 more)

### Community 21 - "app-hexdraft.py"
Cohesion: 0.32
Nodes (11): acquire_mutex(), get_browser_command(), is_window_active_by_title_pattern(), main(), Escribe un mensaje de log con marca de tiempo en la ruta segura de AppData., Garantiza que solo corra una instancia de esta versión directa a la vez., Encuentra un navegador compatible y devuelve el comando para iniciarlo en modo…, Busca ventanas cuyos títulos coinciden con el patrón regex indicado usando APIs… (+3 more)

### Community 22 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, astro, build, dev, dev:app, lint, lint:fix, pre-release (+3 more)

### Community 23 - "tsconfig.json"
Cohesion: 0.18
Nodes (10): **/*, astro/tsconfigs/strict, .astro/types.d.ts, dist, compilerOptions, jsx, jsxImportSource, exclude (+2 more)

### Community 24 - "TacticalDirectives.tsx"
Cohesion: 0.20
Nodes (8): CombatDirectivesPanel, CombatDirectivesPanelProps, COMP_STYLE_LABELS, ENEMY_WIN_COND_DETAILS, MatchupAnalysisPanel, MatchupAnalysisPanelProps, TacticalDirectives, TacticalDirectivesProps

### Community 25 - "getNameFromId"
Cohesion: 0.21
Nodes (14): agent, checkLiveNames(), getNameFromId(), CACHE_FILE_PATH, CacheSchema, checkIsStreamerMode(), loadCache(), OpggPlayerProfile (+6 more)

### Community 26 - "execute-action.ts"
Cohesion: 0.60
Nodes (3): GET(), getLastExecutedChampionId(), POST()

### Community 27 - "riot-cache.service.ts"
Cohesion: 0.44
Nodes (8): CACHE_FILE_PATH, CacheSchema, getCachedMatch(), getCachedPlayer(), loadCache(), saveCache(), setCachedMatch(), setCachedPlayer()

### Community 28 - "manifest.json"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 29 - "PlayerCardSandbox.tsx"
Cohesion: 0.19
Nodes (10): LiveGamePanel(), LiveGamePanelProps, ROLE_ORDER, sortPlayersByRole(), PlayerData, CHAMPIONS_LIST, DIVISIONS, PlayerCardSandbox() (+2 more)

### Community 30 - "test-three-layers.ts"
Cohesion: 0.48
Nodes (6): agent, executeSelection(), main(), runLayer1(), runLayer2(), runLayer3()

### Community 31 - "TeamSidebar.tsx"
Cohesion: 0.43
Nodes (5): LcuPlayer, PlayerProps, PlayerSlot, TeamSidebar, TeamSidebarProps

### Community 32 - "me.ts"
Cohesion: 0.73
Nodes (5): writeLcuProfileCache(), checkIfSyncRecommended(), fetchAllProfileData(), GET(), updateProfileCacheInBackground()

### Community 33 - "DraftGrid.tsx"
Cohesion: 0.40
Nodes (4): DraftGrid, DraftGridProps, Props, RecommendationCard

### Community 34 - "vite.config.ts"
Cohesion: 0.50
Nodes (3): __dirname, __filename, projectRoot

### Community 41 - "HistoryPage.tsx"
Cohesion: 0.25
Nodes (9): getAlliedLane(), getPerformanceScore(), getRankString(), HistoryPage(), Match, now, Participant, QUEUE_MAP (+1 more)

### Community 45 - "Motor de Builds, Items y Runas (Build Engine)"
Cohesion: 0.22
Nodes (8): 1. Swaps en el Core (getCoreItemSwaps), 2. Ramas de Compra Dinámicas (getDynamicPaths), Adaptaciones Dinámicas de Ítems (Swaps y Ramas), Constantes y Mapas de Calibración Clave, Cálculo del Score de Viabilidad (viabilityScore), Detección de Clusters de Builds, Motor de Builds, Items y Runas (Build Engine), Selección Coherente de Runas por Cluster

### Community 46 - "Motor de Recomendación de Picks (Draft Engine)"
Cohesion: 0.29
Nodes (6): Detalle de las Capas y su Ubicación, Detección de Arquetipos y Contramedidas (Capa 2.5), Flujo de Ejecución del Scoring (Capas), Motor de Recomendación de Picks (Draft Engine), Negación de Win Condition Enemiga (Capa 3.5), Tabla de Calibración Rápida

### Community 47 - "Panel de Pantalla de Carga y Juego en Vivo (Live Game Panel)"
Cohesion: 0.33
Nodes (5): 1. Propósito, 2. Fuentes de Datos y Estrategia de Fallback, 3. Flujo de Activación y Polling, 4. Estructura de Datos Retornada (`/api/live-game`), Panel de Pantalla de Carga y Juego en Vivo (Live Game Panel)

### Community 48 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, type, version

### Community 49 - "Documentación de Arquitectura de HexDraft"
Cohesion: 0.50
Nodes (3): Documentación de Arquitectura de HexDraft, Interacción entre Motores, Índice de Documentos

## Knowledge Gaps
- **233 isolated node(s):** `name`, `type`, `version`, `node`, `dev` (+228 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AutoUpdateGuard()` connect `Layout.astro` to `dependencies`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `react` connect `dependencies` to `Layout.astro`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`, `@types/react`, `@types/react-dom`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **What connects `name`, `type`, `version` to the rest of the system?**
  _233 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Layout.astro` be split into smaller, more focused modules?**
  _Cohesion score 0.080338266384778 - nodes in this community are weakly interconnected._
- **Should `itemEngine.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06980392156862746 - nodes in this community are weakly interconnected._
- **Should `sync.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08421985815602837 - nodes in this community are weakly interconnected._