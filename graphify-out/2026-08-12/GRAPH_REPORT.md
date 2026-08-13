# Graph Report - D:\Documentos\HexDraft  (2026-08-07)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 775 nodes · 1469 edges · 45 communities (42 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `24a2b476`
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
- scripts
- proBuildService.ts
- ProBuildPanel.tsx
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
- PlayerCard.tsx
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
- hexdraft

## God Nodes (most connected - your core abstractions)
1. `getLockfileData()` - 46 edges
2. `getNameFromId()` - 20 edges
3. `DraftPage()` - 18 edges
4. `hydrateAsset()` - 18 edges
5. `scrapeSingleChampion()` - 16 edges
6. `getAdaptedBuild()` - 15 edges
7. `getChampionCdnName()` - 14 edges
8. `analyzeComposition()` - 14 edges
9. `syncChampionsSemanticData()` - 14 edges
10. `scripts` - 11 edges

## Surprising Connections (you probably didn't know these)
- `AutoUpdateGuard()` --references--> `react`  [EXTRACTED]
  src/components/react/AutoUpdateGuard.tsx → package.json
- `checkLiveNames()` --calls--> `getLockfileData()`  [EXTRACTED]
  scripts/check-live-names.ts → src/lib/services/lcu.service.ts
- `checkLiveNames()` --calls--> `scrapeOpggProfile()`  [EXTRACTED]
  scripts/check-live-names.ts → src/lib/services/opgg.service.ts
- `debugInGame()` --calls--> `getLockfileData()`  [EXTRACTED]
  scripts/debug-lcu-ingame.ts → src/lib/services/lcu.service.ts
- `debugLiveGame()` --calls--> `getLockfileData()`  [EXTRACTED]
  scripts/debug-live-game-api.ts → src/lib/services/lcu.service.ts

## Import Cycles
- None detected.

## Communities (45 total, 3 thin omitted)

### Community 0 - "Layout.astro"
Cohesion: 0.06
Nodes (31): AppUpdatePopup(), AppVersionResponse, AutoUpdateGuard(), getAlliedLane(), getPerformanceScore(), getRankString(), HistoryPage(), Match (+23 more)

### Community 1 - "itemEngine.ts"
Cohesion: 0.07
Nodes (47): AD_ASSASSIN_FALLBACKS, AD_FIGHTER_FALLBACKS, ADAPTATION_THRESHOLDS, AP_FALLBACKS, BOOTS_BLACKLIST, BuildCluster, buildOutputForCluster(), calcBootContextBonus() (+39 more)

### Community 2 - "sync.service.ts"
Cohesion: 0.08
Nodes (42): getPathsForBuild(), extractJsonFromHtml(), fetchWithFlareSolverr(), SyncEstructuraLanes(), syncItemsFromCommunityDragon(), CdragPerk, isShard(), isStyle() (+34 more)

### Community 3 - "sqlite.ts"
Cohesion: 0.07
Nodes (13): configRepo, isDev, closeDb(), defaultWeights, reopenDb(), AppConfig, configDir, configPath (+5 more)

### Community 4 - "ChampionDetail.tsx"
Cohesion: 0.13
Nodes (32): ChampionDetail(), ChampionDetailProps, ChampionList(), ChampionListProps, RuneTree(), ShardsTree(), Build, BuildItems (+24 more)

### Community 5 - "getLockfileData"
Cohesion: 0.09
Nodes (25): agent, debugInGame(), agent, debugLiveGame(), agent, findPlayers(), agent, testSummoners() (+17 more)

### Community 6 - "DraftPage.tsx"
Cohesion: 0.09
Nodes (26): ChampionPreviewModal, ChampionPreviewModalProps, ConnectionStatus, ConnectionStatusProps, DraftDamageBalance(), DraftDamageBalanceProps, executeLcuAction(), GAP_TRANSLATIONS (+18 more)

### Community 7 - "scripts"
Cohesion: 0.06
Nodes (33): eslint, @eslint/js, eslint-plugin-astro, eslint-plugin-react, eslint-plugin-react-hooks, devDependencies, eslint, @eslint/js (+25 more)

### Community 8 - "proBuildService.ts"
Cohesion: 0.13
Nodes (28): cleanOldBuildCache(), DbProBuildRecord, getProBuildFromCache(), getTtlForSampleSize(), saveProBuildToCache(), ChampInfo, EXCLUSIVE_MID_CHAMPS, FLEX_CHAMPS (+20 more)

### Community 9 - "ProBuildPanel.tsx"
Cohesion: 0.12
Nodes (22): formatFreshness(), getItemIcon(), getRuneIcon(), getRuneStyleIcon(), getSpellIcon(), ProBuildPanel(), ProBuildPanelProps, ClusterTab() (+14 more)

### Community 10 - "engine.ts"
Cohesion: 0.19
Nodes (22): BansRecommendation, championMatchesArchetype(), getBanRecommendations(), getProcessedBans(), isFlexChampion(), AllyArchetype, analyzeComposition(), ArchetypeReading (+14 more)

### Community 11 - "sync-champions-cdrag.ts"
Cohesion: 0.14
Nodes (23): API_NAME_MAP, normalizeKey(), populateDatabase(), resolveChampionId(), API_NAME_MAP, normalizeKey(), resolveChampionId(), roleToLaneMap (+15 more)

### Community 12 - "champions.repo.ts"
Cohesion: 0.12
Nodes (18): normalizeChampionName(), championsRepo, DbBuild, DbChampion, DbMatchup, DbSynergy, normalizeKey(), CACHE_PATH (+10 more)

### Community 13 - "dependencies"
Cohesion: 0.09
Nodes (23): astro, @astrojs/node, @astrojs/react, axios, cheerio, dependencies, astro, @astrojs/node (+15 more)

### Community 14 - "compilar-hexdraft.py"
Cohesion: 0.12
Nodes (21): actualizar_archivo_iss(), build_python(), buscar_iscc(), copiar_recursos_release(), descargar_python_embed(), ejecutar_iscc(), load_env(), obtener_configuracion_instaladores() (+13 more)

### Community 15 - "riot-api.service.ts"
Cohesion: 0.15
Nodes (17): computeTodayRecord(), TodayRecordResult, AccountInfo, ChampionMastery, getActiveGame(), getMatchDetail(), getMatchIdsToday(), getMatchRegionFromPlatform() (+9 more)

### Community 16 - "dataProvider.ts"
Cohesion: 0.14
Nodes (18): calculateScalingType(), CHAMPION_ALIAS, DATA_BY_LANE, defaultCounterSynergies, defaultMetaCache, ENRICHED_DB, findInMetaCache(), initializeEngineData() (+10 more)

### Community 17 - "automatizador-hexdraft.py"
Cohesion: 0.24
Nodes (16): acquire_mutex(), close_window_by_title_pattern(), get_browser_command(), get_lol_path(), is_lol_active(), is_window_active_by_title_pattern(), main(), Determina si el juego está activo mediante el archivo lockfile. (+8 more)

### Community 18 - "live-game.ts"
Cohesion: 0.19
Nodes (14): getIdFromName(), LiveMatchCache, loadLiveMatchCache(), MATCH_CACHE_FILE, saveLiveMatchCache(), CACHE_FILE_PATH, CacheSchema, checkIsStreamerMode() (+6 more)

### Community 19 - "publish_installer.py"
Cohesion: 0.21
Nodes (15): delete_release(), detect_version(), get_outdated_local_installers(), get_releases(), list_local_installers(), load_env(), main(), parse_version() (+7 more)

### Community 20 - "DashboardHome.tsx"
Cohesion: 0.20
Nodes (11): getTierColorClass(), RankBadge(), RankBadgeProps, ChampionMastery, DashboardHome(), DEFAULT_SUMMONER, getChampionGradient(), getChampionRole() (+3 more)

### Community 21 - "app-hexdraft.py"
Cohesion: 0.32
Nodes (11): acquire_mutex(), get_browser_command(), is_window_active_by_title_pattern(), main(), Escribe un mensaje de log con marca de tiempo en la ruta segura de AppData., Garantiza que solo corra una instancia de esta versión directa a la vez., Encuentra un navegador compatible y devuelve el comando para iniciarlo en modo…, Busca ventanas cuyos títulos coinciden con el patrón regex indicado usando APIs… (+3 more)

### Community 22 - "PlayerCard.tsx"
Cohesion: 0.24
Nodes (10): LiveGamePanel(), LiveGamePanelProps, ROLE_ORDER, sortPlayersByRole(), getTagInfo(), PlayerCard(), PlayerCardProps, PlayerData (+2 more)

### Community 23 - "tsconfig.json"
Cohesion: 0.18
Nodes (10): **/*, astro/tsconfigs/strict, .astro/types.d.ts, dist, compilerOptions, jsx, jsxImportSource, exclude (+2 more)

### Community 24 - "TacticalDirectives.tsx"
Cohesion: 0.20
Nodes (8): CombatDirectivesPanel, CombatDirectivesPanelProps, COMP_STYLE_LABELS, ENEMY_WIN_COND_DETAILS, MatchupAnalysisPanel, MatchupAnalysisPanelProps, TacticalDirectives, TacticalDirectivesProps

### Community 25 - "getNameFromId"
Cohesion: 0.36
Nodes (7): agent, checkLiveNames(), getNameFromId(), assignLanesToTeam(), GET(), getFormattedMocks(), MOCK_HISTORY

### Community 26 - "execute-action.ts"
Cohesion: 0.36
Nodes (6): resetLiveMatchFlag(), GET(), getLastExecutedChampionId(), POST(), resetLastExecutedChampionId(), GET()

### Community 27 - "riot-cache.service.ts"
Cohesion: 0.44
Nodes (8): CACHE_FILE_PATH, CacheSchema, getCachedMatch(), getCachedPlayer(), loadCache(), saveCache(), setCachedMatch(), setCachedPlayer()

### Community 28 - "manifest.json"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 29 - "PlayerCardSandbox.tsx"
Cohesion: 0.38
Nodes (5): CHAMPIONS_LIST, DIVISIONS, PlayerCardSandbox(), PRESET_TAGS, TIERS

### Community 30 - "test-three-layers.ts"
Cohesion: 0.48
Nodes (6): agent, executeSelection(), main(), runLayer1(), runLayer2(), runLayer3()

### Community 31 - "TeamSidebar.tsx"
Cohesion: 0.43
Nodes (5): LcuPlayer, PlayerProps, PlayerSlot, TeamSidebar, TeamSidebarProps

### Community 32 - "me.ts"
Cohesion: 0.62
Nodes (6): readLcuProfileCache(), writeLcuProfileCache(), checkIfSyncRecommended(), fetchAllProfileData(), GET(), updateProfileCacheInBackground()

### Community 33 - "DraftGrid.tsx"
Cohesion: 0.40
Nodes (4): DraftGrid, DraftGridProps, Props, RecommendationCard

### Community 34 - "vite.config.ts"
Cohesion: 0.50
Nodes (3): __dirname, __filename, projectRoot

## Knowledge Gaps
- **191 isolated node(s):** `name`, `type`, `version`, `node`, `dev` (+186 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AutoUpdateGuard()` connect `Layout.astro` to `dependencies`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Why does `react` connect `dependencies` to `Layout.astro`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `scripts`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **What connects `name`, `type`, `version` to the rest of the system?**
  _191 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Layout.astro` be split into smaller, more focused modules?**
  _Cohesion score 0.06127946127946128 - nodes in this community are weakly interconnected._
- **Should `itemEngine.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07397959183673469 - nodes in this community are weakly interconnected._
- **Should `sync.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0824829931972789 - nodes in this community are weakly interconnected._