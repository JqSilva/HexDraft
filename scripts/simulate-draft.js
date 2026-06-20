import https from 'node:https';
import http from 'node:http';
import fs from 'fs';
import path from 'path';
import { URL } from 'node:url';

// --- CERTIFICADOS SSL AUTO-FIRMADOS INTEGRADOS ---
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDyHuTiwgjWwFlL
sKHCO9a4zrUgBd02h6XkhhQ6DofS1Ys+81EyFAR661fwEEuM/5vzPdpFIQf+8X0f
gkd6Gs2Ti5poN58KO8NxlyEbbwhacHsAmiYZyZKl5DtdeIw67ehy3FaydTUqxvHL
KMyNMaLL7H8RGb/CVdITUEZ37HlHYWZXLz2iPFkiulNqCqUMKH8YagBuDunri/gt
Alc6uAj71yDTLG54uKRibF5aWQjl+QTQPje7ksyqkmxSFth+4q05UwLJ9wkiUVWM
9/bYjdbMZ9Y+Y5tbLAUMpI9slh6Gudr+wpDUCvD1qqYhIHuqT0ljSoBeAj919cRA
u3R+xIddAgMBAAECggEAKCYmV1HMrGvGAu6dzDsm/otMbqx6Q8YXpL71ELGDJVuC
1SP89VxrZ8Sp1uWk2ZMzVZEOpkL1c/mwgW6VkrJqH4rZRmnexhAl9yqT81wkmvam
9vEY21LZLggcLgJE4qq7znwqJjqYX+kQhFtWHB28fKtRYNEPwtZ/WPOJU+6TJ9o0
yqVwGKaUugAWTYlIHJJGNEcAVBh2oN+z22Gxq3qK9yJzEIsFvbW1V8FgbxQkSSBU
gIKijfhug/ZrSHLESxoEsmp7G+mX860w841i3hrOz0912GaIbcbzoXkaqsGMzK2+
jyqOzA6ftZJyqPPLyMvLA9ODOESIfsv1GQXyJ0r7YQKBgQD+uRHBxe3IJ0KilBP/
ucKlHwFwfcW8CUOdWV9tSmtNJv3UR4kiKqAtEeXuMhKQTU3HZo0d/pUXULozloMe
7LGpxMnUb2pCDkZpfCivhZTSTY35Zp0//7d9iGj3AEFeqCDKV6Af1ofXlPpEgQAA
kL5/xuWx2mUIexZyZNhVBICzrQKBgQDzVaZpcvhOL507jpXZR3VkahkIeY3paLky
V8l5fN41Qsn1hCgaUBBQdYDu52wqJaDNJX4ZZ+3O4HuyoPsJs5ZSp1TKdwllBKIj
0W9PuOK8Mqm7rbq5VxyhayzJb4qZKS06zCmdfFqTYkN5a32wMal6q5xRAqj2l6RN
LvVE4TEYcQKBgQDurbmOyYkqUGdm8bvflk9l66ysnJ2IuWGK8jCxttbef1e+7pz3
z9sxACFkVbUBU/46hsRaQ6+uHi2rozAP7Rf4jPXVweReKwQdWYLCHTg66wLKnDVi
v5lO3mAEek/Gg2HeV8cprhqxjd4IDJxU60wlbNjUE2EyVivNWuM+nq5+LQKBgQC/
Q653KkhkZGapXo0IaXOrhv3APJNASPFw0bHqjSy4HpRSKBvBevcn1wSORFcv1b3M
IlE4tQkmWCrCoGhSGtfoheBO+DvpLDgqAUAGIOQPW58whwDDF+bINk7Q0pzVgJkt
ozZ+tDUZrd4tfUEhEhgN9P/8aSPYGB+sD2H4Ty1g8QKBgQDw/GcEi4V6njQTJxsa
DNeVQXUV8X0sLQrJx8uYWSCLp2jYBWadtXRRHkdbPjtE2XGSiMegAsM4jGzA/o0n
r+Vo5RcdXbKDgJ5GZmCraKR/9OaRPceLQQxc+A4aDEXKM4vMVLoUnzqSwA3dVAQ+
oiKp9D98h+/eOuWzmeHlbbbHzg==
-----END PRIVATE KEY-----`;

const CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIURLCUesa2zKbxNQIEHnajfWgDRAgwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJMTI3LjAuMC4xMB4XDTI2MDYyMDA0MjMzNFoXDTM2MDYx
NzA0MjMzNFowFDESMBAGA1UEAwwJMTI3LjAuMC4xMIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEA8h7k4sII1sBZS7ChwjvWuM61IAXdNoel5IYUOg6H0tWL
PvNRMhQEeutX8BBLjP+b8z3aRSEH/vF9H4JHehrNk4uaaDefCjvDcZchG28IWnB7
AJomGcmSpeQ7XXiMOu3octxWsnU1KsbxyyjMjTGiy+x/ERm/wlXSE1BGd+x5R2Fm
Vy89ojxZIrpTagqlDCh/GGoAbg7p64v4LQJXOrgI+9cg0yxueLikYmxeWlkI5fkE
0D43u5LMqpJsUhbYfuKtOVMCyfcJIlFVjPf22I3WzGfWPmObWywFDKSPbJYehrna
/sKQ1Arw9aqmISB7qk9JY0qAXgI/dfXEQLt0fsSHXQIDAQABo1MwUTAdBgNVHQ4E
FgQUIjEBT8ptaUQy8v8PRo6TNt5AVrUwHwYDVR0jBBgwFoAUIjEBT8ptaUQy8v8P
Ro6TNt5AVrUwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAff4M
EgZCetGLCF92ajL3VDqJbGbpQ4avR4p4HD71AFBctoP72KUdKpGeWt0LAngJqu7R
B75TBpQ0IQSqE1Xnq8kCudou5RCh1OznzY/Iy92UkiSlOy2w1S8KwV2yIF1Wii9y
K4TvgCKoACNuFd4PVQjBaRkYpC3fCHP+whHCrpWHpZu30KDPLA8jXRpPHmNpjYy6
qFJfsdFe6yG88kSQQ+u7PG7yZVqkGQOym1q5sOZzZU0HkWhhBq8+UYK+rkBaa/Y3
/bE5JHxtXDsX81Ie8NLFBa0tePt3HTeyDYlFQD5Sfs4DvRZHUKVokN1AHaEc4Bcl
CAR+AfuBDh0hiwx28A==
-----END CERTIFICATE-----`;

// --- CONFIGURACIÓN ---
const LCU_PORT = 8321;
const CONTROL_PORT = 8322;
const TOKEN = 'mocktoken';

// Encontrar ruta del lockfile
let lolPath = 'C:\\Riot Games\\League of Legends\\lockfile';
try {
  const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'hexdraft-config.json'), 'utf8'));
  if (config.lolPath) lolPath = config.lolPath;
} catch (e) {}

const backupPath = `${lolPath}.bak`;
let lockfileWritten = false;

// Configuración de backup del lockfile
function setupLockfile() {
  try {
    if (fs.existsSync(lolPath)) {
      console.log(`\x1b[33m[SISTEMA] Se detectó un lockfile real. Respaldando en ${backupPath}...\x1b[0m`);
      fs.copyFileSync(lolPath, backupPath);
    } else {
      fs.mkdirSync(path.dirname(lolPath), { recursive: true });
    }
    
    fs.writeFileSync(lolPath, `LeagueClient:9999:${LCU_PORT}:${TOKEN}:https`);
    lockfileWritten = true;
    console.log(`\x1b[32m[SISTEMA] Lockfile simulado escrito en: ${lolPath}\x1b[0m`);
  } catch (err) {
    console.error(`\x1b[31m[ERROR] No se pudo escribir el lockfile en ${lolPath}:`, err.message, `\x1b[0m`);
  }
}

// Restauración de backup al salir
function restoreLockfile() {
  if (!lockfileWritten) return;
  try {
    if (fs.existsSync(lolPath)) {
      fs.unlinkSync(lolPath);
    }
    if (fs.existsSync(backupPath)) {
      console.log(`\x1b[33m\n[SISTEMA] Restaurando lockfile original...\x1b[0m`);
      fs.copyFileSync(backupPath, lolPath);
      fs.unlinkSync(backupPath);
    }
    console.log(`\x1b[32m[SISTEMA] Entorno de LCU original restaurado.\x1b[0m`);
  } catch (err) {
    console.error(`\x1b[31m[ERROR] Al restaurar el lockfile:`, err.message, `\x1b[0m`);
  }
}

// --- CATALOGO DE CAMPEONES POPULARES ---
const CHAMPIONS_CATALOG = [
  { id: 0, name: "Ninguno" },
  { id: 266, name: "Aatrox" },
  { id: 103, name: "Ahri" },
  { id: 84, name: "Akali" },
  { id: 12, name: "Alistar" },
  { id: 34, name: "Anivia" },
  { id: 22, name: "Ashe" },
  { id: 268, name: "Azir" },
  { id: 432, name: "Bardo" },
  { id: 53, name: "Blitzcrank" },
  { id: 51, name: "Caitlyn" },
  { id: 164, name: "Camille" },
  { id: 69, name: "Cassiopeia" },
  { id: 122, name: "Darius" },
  { id: 60, name: "Elise" },
  { id: 81, name: "Ezreal" },
  { id: 114, name: "Fiora" },
  { id: 86, name: "Garen" },
  { id: 120, name: "Hecarim" },
  { id: 59, name: "Jarvan IV" },
  { id: 126, name: "Jayce" },
  { id: 222, name: "Jinx" },
  { id: 43, name: "Karma" },
  { id: 55, name: "Katarina" },
  { id: 512, name: "K'Sante" },
  { id: 64, name: "Lee Sin" },
  { id: 89, name: "Leona" },
  { id: 117, name: "Lulu" },
  { id: 99, name: "Lux" },
  { id: 950, name: "Naafiri" },
  { id: 111, name: "Nautilus" },
  { id: 56, name: "Nocturne" },
  { id: 61, name: "Orianna" },
  { id: 13, name: "Ryze" },
  { id: 14, name: "Sion" },
  { id: 17, name: "Teemo" },
  { id: 48, name: "Trundle" },
  { id: 110, name: "Varus" },
  { id: 254, name: "Vi" },
  { id: 234, name: "Viego" },
  { id: 157, name: "Yasuo" },
  { id: 777, name: "Yone" },
  { id: 238, name: "Zed" },
  { id: 115, name: "Ziggs" }
];

// --- MOCK DATA ---
const currentSummoner = {
  accountId: 10001,
  displayName: "HexDraft Tester",
  gameName: "HexDraft Tester",
  tagLine: "SIM",
  internalName: "hexdrafttester",
  percentCompleteForNextLevel: 42,
  profileIconId: 501,
  puuid: "mock-puuid-12345",
  summonerId: 10003,
  summonerLevel: 125,
  xpSinceLastLevel: 1200,
  xpUntilNextLevel: 2800
};

const rankedStats = {
  queues: [
    {
      queueType: "RANKED_SOLO_5x5",
      tier: "DIAMOND",
      division: "II",
      leaguePoints: 75,
      wins: 142,
      losses: 120
    },
    {
      queueType: "RANKED_FLEX_SR",
      tier: "PLATINUM",
      division: "IV",
      leaguePoints: 15,
      wins: 34,
      losses: 28
    }
  ]
};

const mastery = [
  { championId: 157, championLevel: 7, championPoints: 250000 },
  { championId: 266, championLevel: 6, championPoints: 120000 },
  { championId: 234, championLevel: 5, championPoints: 85000 },
  { championId: 238, championLevel: 5, championPoints: 75000 }
];

const matches = {
  games: {
    games: [
      {
        gameId: 999901,
        gameCreation: Date.now() - 172800000,
        gameDuration: 1820,
        gameMode: "CLASSIC",
        participantIdentities: [{ participantId: 1, player: { puuid: "mock-puuid-12345" } }],
        participants: [
          {
            participantId: 1,
            championId: 157,
            spell1Id: 4,
            spell2Id: 12,
            stats: { kills: 8, deaths: 4, assists: 6, win: true, totalMinionsKilled: 220, neutralMinionsKilled: 12 },
            timeline: { lane: "MIDDLE", role: "SOLO" }
          }
        ]
      },
      {
        gameId: 999902,
        gameCreation: Date.now() - 259200000,
        gameDuration: 1560,
        gameMode: "CLASSIC",
        participantIdentities: [{ participantId: 1, player: { puuid: "mock-puuid-12345" } }],
        participants: [
          {
            participantId: 1,
            championId: 266,
            spell1Id: 4,
            spell2Id: 12,
            stats: { kills: 3, deaths: 6, assists: 2, win: false, totalMinionsKilled: 165, neutralMinionsKilled: 4 },
            timeline: { lane: "TOP", role: "SOLO" }
          }
        ]
      }
    ]
  }
};

let itemSets = {
  itemSets: [
    { title: "Standard Item Set", blocks: [] }
  ]
};

let perkPages = [
  { id: 54321, name: "Mock Page 1", isEditable: true, primaryStyleId: 0, subStyleId: 0, selectedPerkIds: [] },
  { id: 54322, name: "Predeterminada de Riot", isEditable: false, primaryStyleId: 8000, subStyleId: 8100, selectedPerkIds: [] }
];

// --- ESTADO GENERAL MUTABLE DEL SIMULADOR ---
let simulatorState = {
  phase: 'ChampSelect', // None -> ReadyCheck -> ChampSelect -> InProgress
  autoProgress: false,  // Control automático activado/desactivado
  timer: 30,
  localPlayerCellId: 2, // Por defecto el tercer slot de nuestro equipo
  myTeam: [
    { cellId: 0, summonerId: 10001, championId: 0, championPickIntent: 0, assignedPosition: "top" },
    { cellId: 1, summonerId: 10002, championId: 0, championPickIntent: 0, assignedPosition: "jungle" },
    { cellId: 2, summonerId: 10003, championId: 0, championPickIntent: 0, assignedPosition: "mid" }, // Local Player
    { cellId: 3, summonerId: 10004, championId: 0, championPickIntent: 0, assignedPosition: "bottom" },
    { cellId: 4, summonerId: 10005, championId: 0, championPickIntent: 0, assignedPosition: "support" }
  ],
  theirTeam: [
    { cellId: 5, summonerId: 20001, championId: 0, championPickIntent: 0, assignedPosition: "top" },
    { cellId: 6, summonerId: 20002, championId: 0, championPickIntent: 0, assignedPosition: "jungle" },
    { cellId: 7, summonerId: 20003, championId: 0, championPickIntent: 0, assignedPosition: "mid" },
    { cellId: 8, summonerId: 20004, championId: 0, championPickIntent: 0, assignedPosition: "bottom" },
    { cellId: 9, summonerId: 20005, championId: 0, championPickIntent: 0, assignedPosition: "support" }
  ],
  bans: {
    myTeam: [53, 238, 0, 0, 0], // Iniciales
    theirTeam: [89, 17, 0, 0, 0]
  },
  activeAction: {
    type: 'pick', // 'ban' | 'pick' | 'none'
    cellId: 2      // Quién es el que está actuando en este instante
  },
  // Auto-simulation steps
  banStep: 0,
  pickStep: 0
};

// Reiniciar simulación automática
function resetAutoDraft() {
  simulatorState.banStep = 0;
  simulatorState.pickStep = 0;
  simulatorState.timer = 30;
  
  simulatorState.myTeam.forEach((p) => { p.championId = 0; p.championPickIntent = 0; });
  simulatorState.theirTeam.forEach((p) => { p.championId = 0; p.championPickIntent = 0; });
  simulatorState.bans.myTeam = [0, 0, 0, 0, 0];
  simulatorState.bans.theirTeam = [0, 0, 0, 0, 0];
  simulatorState.activeAction.type = 'ban';
  simulatorState.activeAction.cellId = 0;
}

// Tick de simulación automática (sólo corre si autoProgress es true)
const AUTO_BANS = [53, 89, 238, 17, 122, 64, 84, 512, 114, 55];
const AUTO_PICKS_BLUE = [266, 234, 777, 222, 117];
const AUTO_PICKS_RED = [122, 60, 103, 81, 111];

function tickSimulation() {
  if (!simulatorState.autoProgress) return;

  if (simulatorState.phase === 'None') {
    if (Math.random() < 0.2) {
      simulatorState.phase = 'ReadyCheck';
      simulatorState.timer = 10;
      console.log(`\x1b[35m[AUTO-DRAFT] -> ¡Partida Encontrada! ReadyCheck...\x1b[0m`);
    }
  } else if (simulatorState.phase === 'ReadyCheck') {
    simulatorState.timer--;
    if (simulatorState.timer <= 0) {
      simulatorState.phase = 'ChampSelect';
      resetAutoDraft();
      console.log(`\x1b[35m[AUTO-DRAFT] -> Entrando a Selección (Fase de Bans)\x1b[0m`);
    }
  } else if (simulatorState.phase === 'ChampSelect') {
    simulatorState.timer--;
    
    // Simular bans
    if (simulatorState.banStep < 10) {
      simulatorState.activeAction.type = 'ban';
      simulatorState.activeAction.cellId = simulatorState.banStep;

      if (simulatorState.timer % 2 === 0) {
        const activeCellId = simulatorState.banStep;
        const banChamp = AUTO_BANS[simulatorState.banStep];
        
        if (activeCellId < 5) {
          simulatorState.bans.myTeam[activeCellId] = banChamp;
        } else {
          simulatorState.bans.theirTeam[activeCellId - 5] = banChamp;
        }
        
        simulatorState.banStep++;
        console.log(`\x1b[31m[AUTO-DRAFT] Ban: Celda ${activeCellId} bloqueó a ${banChamp}\x1b[0m`);
        
        if (simulatorState.banStep === 10) {
          simulatorState.timer = 30;
          simulatorState.activeAction.type = 'pick';
          simulatorState.activeAction.cellId = 0; // Blue 1
          console.log(`\x1b[36m[AUTO-DRAFT] -> Bans listos. Iniciando picks...\x1b[0m`);
        }
      }
    } 
    // Simular picks
    else if (simulatorState.pickStep < 10) {
      // Orden de selección estándar de LoL:
      // Paso 0: Blue 1 (cellId 0)
      // Paso 1-2: Red 1, Red 2 (cellId 5, 6)
      // Paso 3-4: Blue 2, Blue 3 (cellId 1, 2 - ¡cellId 2 es el usuario local!)
      // Paso 5-6: Red 3, Red 4 (cellId 7, 8)
      // Paso 7-8: Blue 4, Blue 5 (cellId 3, 4)
      // Paso 9: Red 5 (cellId 9)
      const PICK_ORDER = [0, 5, 6, 1, 2, 7, 8, 3, 4, 9];
      const activeCellId = PICK_ORDER[simulatorState.pickStep];
      simulatorState.activeAction.type = 'pick';
      simulatorState.activeAction.cellId = activeCellId;

      // Mostrar intención de preselección
      if (activeCellId < 5) {
        const idx = simulatorState.myTeam.findIndex(p => p.cellId === activeCellId);
        if (simulatorState.myTeam[idx].championId === 0) {
          simulatorState.myTeam[idx].championPickIntent = AUTO_PICKS_BLUE[idx];
        }
      } else {
        const idx = simulatorState.theirTeam.findIndex(p => p.cellId === activeCellId);
        if (simulatorState.theirTeam[idx].championId === 0) {
          simulatorState.theirTeam[idx].championPickIntent = AUTO_PICKS_RED[idx - 5];
        }
      }

      if (simulatorState.timer <= 20) {
        if (activeCellId < 5) {
          const idx = simulatorState.myTeam.findIndex(p => p.cellId === activeCellId);
          simulatorState.myTeam[idx].championId = AUTO_PICKS_BLUE[idx];
          simulatorState.myTeam[idx].championPickIntent = 0;
          console.log(`\x1b[32m[AUTO-DRAFT] Pick: Celda ${activeCellId} eligió a ${AUTO_PICKS_BLUE[idx]}\x1b[0m`);
        } else {
          const idx = simulatorState.theirTeam.findIndex(p => p.cellId === activeCellId);
          simulatorState.theirTeam[idx].championId = AUTO_PICKS_RED[idx - 5];
          simulatorState.theirTeam[idx].championPickIntent = 0;
          console.log(`\x1b[32m[AUTO-DRAFT] Pick: Celda ${activeCellId} eligió a ${AUTO_PICKS_RED[idx - 5]}\x1b[0m`);
        }
        
        simulatorState.pickStep++;
        simulatorState.timer = 30;
        
        if (simulatorState.pickStep === 10) {
          simulatorState.timer = 10; // finalización
          simulatorState.activeAction.type = 'none';
          console.log(`\x1b[33m[AUTO-DRAFT] -> Picks completos. Esperando inicio de partida...\x1b[0m`);
        }
      }
    } else {
      if (simulatorState.timer <= 0) {
        simulatorState.phase = 'InProgress';
        simulatorState.timer = 20;
        console.log(`\x1b[32m[AUTO-DRAFT] -> ¡Partida Iniciada!\x1b[0m`);
      }
    }
  } else if (simulatorState.phase === 'InProgress') {
    simulatorState.timer--;
    if (simulatorState.timer <= 0) {
      simulatorState.phase = 'None';
      console.log(`\x1b[35m[AUTO-DRAFT] -> Partida terminada. Regresando a lobby.\x1b[0m`);
    }
  }
}

setInterval(tickSimulation, 1000);

// --- CONSTRUIR SESIÓN DE SELECCIÓN DE CAMPEONES DE LCU MOCK ---
function getChampSelectSession() {
  // 1. Mapear bans
  const banActions = [];
  for (let i = 0; i < 10; i++) {
    const isMyTeam = i < 5;
    const banChamp = isMyTeam ? simulatorState.bans.myTeam[i] : simulatorState.bans.theirTeam[i - 5];
    const completed = banChamp > 0;
    const isInProgress = !completed && simulatorState.activeAction.type === 'ban' && simulatorState.activeAction.cellId === i;
    
    banActions.push({
      id: i + 1,
      actorCellId: i,
      championId: banChamp,
      completed,
      isInProgress,
      type: "ban"
    });
  }

  // 2. Mapear picks
  const pickActions = [
    // B1 (0)
    [{ id: 11, actorCellId: 0, championId: simulatorState.myTeam[0].championId, completed: simulatorState.myTeam[0].championId > 0, isInProgress: simulatorState.myTeam[0].championId === 0 && simulatorState.activeAction.type === 'pick' && simulatorState.activeAction.cellId === 0, type: "pick" }],
    // R1, R2 (5, 6)
    [
      { id: 12, actorCellId: 5, championId: simulatorState.theirTeam[0].championId, completed: simulatorState.theirTeam[0].championId > 0, isInProgress: simulatorState.theirTeam[0].championId === 0 && simulatorState.activeAction.type === 'pick' && simulatorState.activeAction.cellId === 5, type: "pick" },
      { id: 13, actorCellId: 6, championId: simulatorState.theirTeam[1].championId, completed: simulatorState.theirTeam[1].championId > 0, isInProgress: simulatorState.theirTeam[1].championId === 0 && simulatorState.activeAction.type === 'pick' && simulatorState.activeAction.cellId === 6, type: "pick" }
    ],
    // B2, B3 (1, 2)
    [
      { id: 14, actorCellId: 1, championId: simulatorState.myTeam[1].championId, completed: simulatorState.myTeam[1].championId > 0, isInProgress: simulatorState.myTeam[1].championId === 0 && simulatorState.activeAction.type === 'pick' && simulatorState.activeAction.cellId === 1, type: "pick" },
      { id: 15, actorCellId: 2, championId: simulatorState.myTeam[2].championId, completed: simulatorState.myTeam[2].championId > 0, isInProgress: simulatorState.myTeam[2].championId === 0 && simulatorState.activeAction.type === 'pick' && simulatorState.activeAction.cellId === 2, type: "pick" }
    ],
    // R3, R4 (7, 8)
    [
      { id: 16, actorCellId: 7, championId: simulatorState.theirTeam[2].championId, completed: simulatorState.theirTeam[2].championId > 0, isInProgress: simulatorState.theirTeam[2].championId === 0 && simulatorState.activeAction.type === 'pick' && simulatorState.activeAction.cellId === 7, type: "pick" },
      { id: 17, actorCellId: 8, championId: simulatorState.theirTeam[3].championId, completed: simulatorState.theirTeam[3].championId > 0, isInProgress: simulatorState.theirTeam[3].championId === 0 && simulatorState.activeAction.type === 'pick' && simulatorState.activeAction.cellId === 8, type: "pick" }
    ],
    // B4, B5 (3, 4)
    [
      { id: 18, actorCellId: 3, championId: simulatorState.myTeam[3].championId, completed: simulatorState.myTeam[3].championId > 0, isInProgress: simulatorState.myTeam[3].championId === 0 && simulatorState.activeAction.type === 'pick' && simulatorState.activeAction.cellId === 3, type: "pick" },
      { id: 19, actorCellId: 4, championId: simulatorState.myTeam[4].championId, completed: simulatorState.myTeam[4].championId > 0, isInProgress: simulatorState.myTeam[4].championId === 0 && simulatorState.activeAction.type === 'pick' && simulatorState.activeAction.cellId === 4, type: "pick" }
    ],
    // R5 (9)
    [{ id: 20, actorCellId: 9, championId: simulatorState.theirTeam[4].championId, completed: simulatorState.theirTeam[4].championId > 0, isInProgress: simulatorState.theirTeam[4].championId === 0 && simulatorState.activeAction.type === 'pick' && simulatorState.activeAction.cellId === 9, type: "pick" }]
  ];

  return {
    localPlayerCellId: simulatorState.localPlayerCellId,
    timer: {
      phaseDeadline: Date.now() + (simulatorState.timer * 1000),
      internalNow: Date.now(),
      adjustedTimeLeftInPhase: simulatorState.timer * 1000,
      totalTimeInPhase: 30000,
      phase: simulatorState.banStep < 10 ? 'BAN' : (simulatorState.pickStep < 10 ? 'PICK' : 'FINALIZATION')
    },
    myTeam: simulatorState.myTeam,
    theirTeam: simulatorState.theirTeam,
    actions: [banActions, ...pickActions]
  };
}

// --- SERVIDOR LCU (HTTPS) EN PUERTO 8321 ---
const lcuServer = https.createServer({ key: PRIVATE_KEY, cert: CERTIFICATE }, (req, res) => {
  const parsedUrl = new URL(req.url, `https://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET' && pathname === '/lol-gameflow/v1/session') {
    res.statusCode = 200;
    res.end(JSON.stringify({ phase: simulatorState.phase }));
    return;
  }

  if (req.method === 'GET' && pathname === '/lol-champ-select/v1/session') {
    if (simulatorState.phase !== 'ChampSelect') {
      res.statusCode = 404;
      res.end(JSON.stringify({ errorCode: "RPC_METHOD_NOT_FOUND", message: "Not in champ select" }));
    } else {
      res.statusCode = 200;
      res.end(JSON.stringify(getChampSelectSession()));
    }
    return;
  }

  if (req.method === 'GET' && pathname === '/lol-summoner/v1/current-summoner') {
    res.statusCode = 200;
    res.end(JSON.stringify(currentSummoner));
    return;
  }

  if (req.method === 'GET' && pathname === '/lol-ranked/v1/current-ranked-stats') {
    res.statusCode = 200;
    res.end(JSON.stringify(rankedStats));
    return;
  }

  if (req.method === 'GET' && pathname === '/lol-champion-mastery/v1/local-player/champion-mastery') {
    res.statusCode = 200;
    res.end(JSON.stringify(mastery));
    return;
  }

  if (req.method === 'GET' && pathname === '/lol-match-history/v1/products/lol/current-summoner/matches') {
    res.statusCode = 200;
    res.end(JSON.stringify(matches));
    return;
  }

  if (req.method === 'GET' && pathname === '/lol-patch/v1/game-version') {
    res.statusCode = 200;
    res.end(JSON.stringify("16.12.999.999"));
    return;
  }

  if (req.method === 'GET' && pathname === '/lol-perks/v1/pages') {
    res.statusCode = 200;
    res.end(JSON.stringify(perkPages));
    return;
  }

  if (req.method === 'PUT' && pathname.startsWith('/lol-perks/v1/pages/')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const updated = JSON.parse(body);
        const index = perkPages.findIndex(p => p.id === updated.id);
        if (index !== -1) perkPages[index] = updated;
        console.log(`\x1b[32m[SIM LCU] -> Runas importadas: \x1b[1m${updated.name}\x1b[0m`);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "JSON inválido" }));
      }
    });
    return;
  }

  if (req.method === 'PATCH' && pathname === '/lol-champ-select/v1/session/my-selection') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const updated = JSON.parse(body);
        console.log(`\x1b[32m[SIM LCU] -> Hechizos importados: Spell1: ${updated.spell1Id}, Spell2: ${updated.spell2Id}\x1b[0m`);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "JSON inválido" }));
      }
    });
    return;
  }

  if (req.method === 'GET' && pathname.startsWith('/lol-item-sets/v1/item-sets/')) {
    res.statusCode = 200;
    res.end(JSON.stringify(itemSets));
    return;
  }

  if (req.method === 'PUT' && pathname.startsWith('/lol-item-sets/v1/item-sets/')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        itemSets = payload;
        const hSet = payload.itemSets?.find(s => s.title.startsWith("HexDraft:"));
        console.log(`\x1b[32m[SIM LCU] -> Objetos importados: ${hSet ? hSet.title : 'Desconocido'}\x1b[0m`);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "JSON inválido" }));
      }
    });
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Ruta no simulada" }));
});

// --- SERVIDOR CONTROL PANEL (HTTP) EN PUERTO 8322 ---
const controlServer = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // Endpoint API para obtener/actualizar estado
  if (pathname === '/api/state') {
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'GET') {
      res.statusCode = 200;
      res.end(JSON.stringify(simulatorState));
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const update = JSON.parse(body);
          
          // Actualización profunda controlada
          if (update.phase !== undefined) simulatorState.phase = update.phase;
          if (update.autoProgress !== undefined) simulatorState.autoProgress = update.autoProgress;
          if (update.timer !== undefined) simulatorState.timer = Number(update.timer);
          if (update.localPlayerPosition !== undefined) {
            simulatorState.localPlayerPosition = update.localPlayerPosition;
            // Actualizar assignedPosition en myTeam para el localPlayer
            const idx = simulatorState.myTeam.findIndex(p => p.cellId === simulatorState.localPlayerCellId);
            if (idx !== -1) simulatorState.myTeam[idx].assignedPosition = update.localPlayerPosition;
          }
          if (update.myTeam !== undefined && Array.isArray(update.myTeam)) {
            update.myTeam.forEach(champ => {
              const idx = simulatorState.myTeam.findIndex(p => p.cellId === champ.cellId);
              if (idx !== -1) {
                simulatorState.myTeam[idx].championId = Number(champ.championId);
                simulatorState.myTeam[idx].championPickIntent = Number(champ.championPickIntent || 0);
              }
            });
          }
          if (update.theirTeam !== undefined && Array.isArray(update.theirTeam)) {
            update.theirTeam.forEach(champ => {
              const idx = simulatorState.theirTeam.findIndex(p => p.cellId === champ.cellId);
              if (idx !== -1) {
                simulatorState.theirTeam[idx].championId = Number(champ.championId);
                simulatorState.theirTeam[idx].championPickIntent = Number(champ.championPickIntent || 0);
              }
            });
          }
          if (update.bans !== undefined) {
            if (update.bans.myTeam) simulatorState.bans.myTeam = update.bans.myTeam.map(Number);
            if (update.bans.theirTeam) simulatorState.bans.theirTeam = update.bans.theirTeam.map(Number);
          }
          if (update.activeAction !== undefined) {
            if (update.activeAction.type) simulatorState.activeAction.type = update.activeAction.type;
            if (update.activeAction.cellId !== undefined) simulatorState.activeAction.cellId = Number(update.activeAction.cellId);
          }

          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, state: simulatorState }));
        } catch (e) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "JSON Inválido", details: e.message }));
        }
      });
    }
    return;
  }

  // Acción de reinicio rápido
  if (pathname === '/api/reset' && req.method === 'POST') {
    resetAutoDraft();
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true, state: simulatorState }));
    return;
  }

  // Servir Página Web HTML del Control Panel
  if (pathname === '/' && req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.statusCode = 200;
    
    // Construir los selectores del catálogo para inyectar dinámicamente
    const optionsHtml = CHAMPIONS_CATALOG.map(c => `<option value="${c.id}">${c.name} (${c.id})</option>`).join('');

    res.end(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Control Panel // HexDraft LCU Simulator</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&family=Geist+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; background-color: #08080a; }
    .font-mono { font-family: 'Geist Mono', monospace; }
    .purple-glow { box-shadow: 0 0 20px rgba(144, 85, 255, 0.15); }
    .cyber-card { background: #0f0f12; border: 1px solid #1b1b1f; }
  </style>
</head>
<body class="text-slate-200 min-h-screen p-6">
  <div class="max-w-6xl mx-auto space-y-6">
    
    <!-- CABECERA -->
    <header class="flex justify-between items-center pb-4 border-b border-[#1b1b1f]">
      <div>
        <span class="text-[9px] font-mono uppercase tracking-[0.3em] text-purple-400 block mb-1">MOCK ENVIROMENT // DEVELOPER CONTROL PANEL</span>
        <h1 class="text-lg font-black uppercase tracking-wider text-white">HexDraft LCU Simulator</h1>
      </div>
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 bg-[#121216] px-3 py-1.5 border border-[#1b1b1f] rounded-sm text-xs font-mono">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>HTTPS LCU: 127.0.0.1:${LCU_PORT}</span>
        </div>
      </div>
    </header>

    <!-- GRID DE PANELES -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- COL 1: CONTROL DE FASE Y CONFIG -->
      <div class="cyber-card p-6 rounded-sm purple-glow flex flex-col justify-between space-y-6">
        <div>
          <h2 class="text-xs font-black text-purple-400 uppercase tracking-widest mb-4">// Parámetros de Estado</h2>
          
          <div class="space-y-4">
            <div>
              <label class="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 font-bold">Fase de Juego (Gameflow)</label>
              <select id="select-phase" class="w-full bg-[#060608] border border-[#1b1b1f] px-3 py-2 rounded-sm text-xs text-white font-mono focus:border-purple-500 outline-none">
                <option value="None">None (Menú / Lobby)</option>
                <option value="ReadyCheck">ReadyCheck (Buscando Partida)</option>
                <option value="ChampSelect">ChampSelect (Selección de Campeones)</option>
                <option value="InProgress">InProgress (En Partida / Grieta)</option>
              </select>
            </div>

            <div class="flex items-center justify-between p-3 bg-[#060608] border border-[#1b1b1f] rounded-sm">
              <span class="text-xs font-bold text-slate-300">Simulación Automática</span>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="check-auto" class="sr-only peer">
                <div class="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
              </label>
            </div>

            <div>
              <label class="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 font-bold">Tiempo Restante (Segundos)</label>
              <input type="number" id="input-timer" min="0" max="99" class="w-full bg-[#060608] border border-[#1b1b1f] px-3 py-2 rounded-sm text-xs text-white font-mono focus:border-purple-500 outline-none">
            </div>
          </div>
        </div>

        <div class="space-y-3 pt-4 border-t border-[#1b1b1f]">
          <button id="btn-reset" class="w-full py-2.5 bg-transparent hover:bg-slate-900 border border-[#1b1b1f] text-xs font-black uppercase tracking-wider rounded-sm transition-colors duration-200">
            Reiniciar Selección (Picks/Bans a 0)
          </button>
          <p class="text-[9.5px] text-slate-500 uppercase leading-relaxed font-mono">
            * Desactiva el autoprogreso si deseas congelar y editar manualmente la selección de campeones.
          </p>
        </div>
      </div>

      <!-- COL 2: COMPOSICIÓN DE PICKS (EQUIPOS) -->
      <div class="cyber-card p-6 rounded-sm purple-glow lg:col-span-2 space-y-6">
        <div>
          <h2 class="text-xs font-black text-purple-400 uppercase tracking-widest mb-4">// Selección de Campeones (Picks)</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <!-- MI EQUIPO -->
            <div class="space-y-4">
              <h3 class="text-[10px] text-sky-400 uppercase tracking-widest font-black flex items-center gap-2">
                <span class="w-1.5 h-1.5 bg-sky-500 rounded-full"></span>Mi Equipo (Aliados)
              </h3>
              
              <div class="space-y-3">
                <!-- Slot 0: Top -->
                <div class="flex items-center gap-3 bg-[#060608] p-2 border border-[#1b1b1f] rounded-sm">
                  <span class="text-[9px] font-mono uppercase text-slate-500 w-12 text-center shrink-0">TOP</span>
                  <select id="pick-my-0" class="flex-1 bg-[#121216] border border-[#1b1b1f] px-2 py-1 rounded-sm text-xs outline-none">${optionsHtml}</select>
                </div>
                <!-- Slot 1: Jungle -->
                <div class="flex items-center gap-3 bg-[#060608] p-2 border border-[#1b1b1f] rounded-sm">
                  <span class="text-[9px] font-mono uppercase text-slate-500 w-12 text-center shrink-0">JNG</span>
                  <select id="pick-my-1" class="flex-1 bg-[#121216] border border-[#1b1b1f] px-2 py-1 rounded-sm text-xs outline-none">${optionsHtml}</select>
                </div>
                <!-- Slot 2: Mid (LOCAL PLAYER) -->
                <div class="flex items-center gap-3 bg-purple-950/20 p-2 border border-purple-500/30 rounded-sm relative overflow-hidden">
                  <div class="absolute top-0 right-0 bg-purple-500 text-[7.5px] font-mono font-black uppercase text-white px-1.5 rounded-bl-sm">TÚ (Local)</div>
                  <select id="select-my-pos" class="text-[9px] font-mono uppercase text-purple-400 w-12 text-center bg-[#060608] border border-purple-500/20 rounded-sm py-0.5 outline-none shrink-0">
                    <option value="top">TOP</option>
                    <option value="jungle">JNG</option>
                    <option value="mid" selected>MID</option>
                    <option value="bottom">ADC</option>
                    <option value="support">SUP</option>
                  </select>
                  <select id="pick-my-2" class="flex-1 bg-[#121216] border border-purple-500/30 px-2 py-1 rounded-sm text-xs outline-none">${optionsHtml}</select>
                </div>
                <!-- Slot 3: Adc -->
                <div class="flex items-center gap-3 bg-[#060608] p-2 border border-[#1b1b1f] rounded-sm">
                  <span class="text-[9px] font-mono uppercase text-slate-500 w-12 text-center shrink-0">ADC</span>
                  <select id="pick-my-3" class="flex-1 bg-[#121216] border border-[#1b1b1f] px-2 py-1 rounded-sm text-xs outline-none">${optionsHtml}</select>
                </div>
                <!-- Slot 4: Support -->
                <div class="flex items-center gap-3 bg-[#060608] p-2 border border-[#1b1b1f] rounded-sm">
                  <span class="text-[9px] font-mono uppercase text-slate-500 w-12 text-center shrink-0">SUP</span>
                  <select id="pick-my-4" class="flex-1 bg-[#121216] border border-[#1b1b1f] px-2 py-1 rounded-sm text-xs outline-none">${optionsHtml}</select>
                </div>
              </div>
            </div>

            <!-- EQUIPO ENEMIGO -->
            <div class="space-y-4">
              <h3 class="text-[10px] text-rose-500 uppercase tracking-widest font-black flex items-center gap-2">
                <span class="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>Equipo Enemigo
              </h3>
              
              <div class="space-y-3">
                <!-- Slot 0: Top -->
                <div class="flex items-center gap-3 bg-[#060608] p-2 border border-[#1b1b1f] rounded-sm">
                  <span class="text-[9px] font-mono uppercase text-slate-500 w-12 text-center shrink-0">TOP</span>
                  <select id="pick-their-0" class="flex-1 bg-[#121216] border border-[#1b1b1f] px-2 py-1 rounded-sm text-xs outline-none">${optionsHtml}</select>
                </div>
                <!-- Slot 1: Jungle -->
                <div class="flex items-center gap-3 bg-[#060608] p-2 border border-[#1b1b1f] rounded-sm">
                  <span class="text-[9px] font-mono uppercase text-slate-500 w-12 text-center shrink-0">JNG</span>
                  <select id="pick-their-1" class="flex-1 bg-[#121216] border border-[#1b1b1f] px-2 py-1 rounded-sm text-xs outline-none">${optionsHtml}</select>
                </div>
                <!-- Slot 2: Mid -->
                <div class="flex items-center gap-3 bg-[#060608] p-2 border border-[#1b1b1f] rounded-sm">
                  <span class="text-[9px] font-mono uppercase text-slate-500 w-12 text-center shrink-0">MID</span>
                  <select id="pick-their-2" class="flex-1 bg-[#121216] border border-[#1b1b1f] px-2 py-1 rounded-sm text-xs outline-none">${optionsHtml}</select>
                </div>
                <!-- Slot 3: Adc -->
                <div class="flex items-center gap-3 bg-[#060608] p-2 border border-[#1b1b1f] rounded-sm">
                  <span class="text-[9px] font-mono uppercase text-slate-500 w-12 text-center shrink-0">ADC</span>
                  <select id="pick-their-3" class="flex-1 bg-[#121216] border border-[#1b1b1f] px-2 py-1 rounded-sm text-xs outline-none">${optionsHtml}</select>
                </div>
                <!-- Slot 4: Support -->
                <div class="flex items-center gap-3 bg-[#060608] p-2 border border-[#1b1b1f] rounded-sm">
                  <span class="text-[9px] font-mono uppercase text-slate-500 w-12 text-center shrink-0">SUP</span>
                  <select id="pick-their-4" class="flex-1 bg-[#121216] border border-[#1b1b1f] px-2 py-1 rounded-sm text-xs outline-none">${optionsHtml}</select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- PANELES DE BANS -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      <!-- BANS ALIADOS -->
      <div class="cyber-card p-6 rounded-sm purple-glow space-y-4">
        <h3 class="text-xs font-black text-sky-400 uppercase tracking-widest">// Bloqueos Aliados (Bans Blue)</h3>
        <div class="grid grid-cols-5 gap-2">
          <select id="ban-my-0" class="bg-[#060608] border border-[#1b1b1f] px-2 py-1.5 rounded-sm text-xs outline-none">${optionsHtml}</select>
          <select id="ban-my-1" class="bg-[#060608] border border-[#1b1b1f] px-2 py-1.5 rounded-sm text-xs outline-none">${optionsHtml}</select>
          <select id="ban-my-2" class="bg-[#060608] border border-[#1b1b1f] px-2 py-1.5 rounded-sm text-xs outline-none">${optionsHtml}</select>
          <select id="ban-my-3" class="bg-[#060608] border border-[#1b1b1f] px-2 py-1.5 rounded-sm text-xs outline-none">${optionsHtml}</select>
          <select id="ban-my-4" class="bg-[#060608] border border-[#1b1b1f] px-2 py-1.5 rounded-sm text-xs outline-none">${optionsHtml}</select>
        </div>
      </div>

      <!-- BANS ENEMIGOS -->
      <div class="cyber-card p-6 rounded-sm purple-glow space-y-4">
        <h3 class="text-xs font-black text-rose-500 uppercase tracking-widest">// Bloqueos Enemigos (Bans Red)</h3>
        <div class="grid grid-cols-5 gap-2">
          <select id="ban-their-0" class="bg-[#060608] border border-[#1b1b1f] px-2 py-1.5 rounded-sm text-xs outline-none">${optionsHtml}</select>
          <select id="ban-their-1" class="bg-[#060608] border border-[#1b1b1f] px-2 py-1.5 rounded-sm text-xs outline-none">${optionsHtml}</select>
          <select id="ban-their-2" class="bg-[#060608] border border-[#1b1b1f] px-2 py-1.5 rounded-sm text-xs outline-none">${optionsHtml}</select>
          <select id="ban-their-3" class="bg-[#060608] border border-[#1b1b1f] px-2 py-1.5 rounded-sm text-xs outline-none">${optionsHtml}</select>
          <select id="ban-their-4" class="bg-[#060608] border border-[#1b1b1f] px-2 py-1.5 rounded-sm text-xs outline-none">${optionsHtml}</select>
        </div>
      </div>

    </div>

  </div>

  <!-- CONTROL CLIENT-SIDE SCRIPTS -->
  <script>
    let isUserEditing = false;

    // Obtener referencias de elementos
    const selectPhase = document.getElementById('select-phase');
    const checkAuto = document.getElementById('check-auto');
    const inputTimer = document.getElementById('input-timer');
    const btnReset = document.getElementById('btn-reset');
    const selectMyPos = document.getElementById('select-my-pos');

    // Mapear arrays de inputs
    const myPicks = Array.from({length: 5}, (_, i) => document.getElementById('pick-my-' + i));
    const theirPicks = Array.from({length: 5}, (_, i) => document.getElementById('pick-their-' + i));
    const myBans = Array.from({length: 5}, (_, i) => document.getElementById('ban-my-' + i));
    const theirBans = Array.from({length: 5}, (_, i) => document.getElementById('ban-their-' + i));

    // Cargar estado inicial
    async function loadState() {
      if (isUserEditing) return;
      try {
        const res = await fetch('/api/state');
        const state = await res.json();
        
        selectPhase.value = state.phase;
        checkAuto.checked = state.autoProgress;
        inputTimer.value = state.timer;
        selectMyPos.value = state.localPlayerPosition;

        state.myTeam.forEach((p, idx) => {
          if (myPicks[idx]) myPicks[idx].value = p.championId;
        });

        state.theirTeam.forEach((p, idx) => {
          if (theirPicks[idx]) theirPicks[idx].value = p.championId;
        });

        state.bans.myTeam.forEach((id, idx) => {
          if (myBans[idx]) myBans[idx].value = id;
        });

        state.bans.theirTeam.forEach((id, idx) => {
          if (theirBans[idx]) theirBans[idx].value = id;
        });
      } catch (err) {}
    }

    // Guardar estado actual
    async function saveState() {
      const payload = {
        phase: selectPhase.value,
        autoProgress: checkAuto.checked,
        timer: parseInt(inputTimer.value) || 0,
        localPlayerPosition: selectMyPos.value,
        myTeam: myPicks.map((el, i) => ({ cellId: i, championId: el.value })),
        theirTeam: theirPicks.map((el, i) => ({ cellId: i + 5, championId: el.value })),
        bans: {
          myTeam: myBans.map(el => el.value),
          theirTeam: theirBans.map(el => el.value)
        }
      };

      try {
        await fetch('/api/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (err) {}
    }

    // Agregar listeners
    const allInputs = [
      selectPhase, checkAuto, inputTimer, selectMyPos,
      ...myPicks, ...theirPicks, ...myBans, ...theirBans
    ];

    allInputs.forEach(el => {
      el.addEventListener('change', () => {
        isUserEditing = true;
        saveState().then(() => { isUserEditing = false; });
      });
      el.addEventListener('focus', () => { isUserEditing = true; });
      el.addEventListener('blur', () => { isUserEditing = false; });
    });

    btnReset.addEventListener('click', async () => {
      await fetch('/api/reset', { method: 'POST' });
      loadState();
    });

    // Iniciar polleos de sincronización
    setInterval(loadState, 1000);
    loadState();
  </script>
</body>
</html>`);
  }
});

// Arrancar servidores
lcuServer.listen(LCU_PORT, '127.0.0.1', () => {
  console.clear();
  console.log(`\x1b[35m============================================================\x1b[0m`);
  console.log(`\x1b[35m            MOCK LCU DRAFT SIMULATOR & CONTROL PANEL        \x1b[0m`);
  console.log(`\x1b[35m============================================================\x1b[0m`);
  console.log(`[LCU MOCK] Servidor HTTPS corriendo en: https://127.0.0.1:${LCU_PORT}`);
  console.log(`\x1b[32m[CONTROL UI] ¡Panel de control abierto en! -> http://localhost:${CONTROL_PORT}\x1b[0m`);
  console.log(`[STATUS] Simulación de fases lista.`);
  console.log(`[INFO] Detén el simulador presionando Ctrl+C`);
  console.log(`\x1b[35m------------------------------------------------------------\x1b[0m`);

  setupLockfile();
});

controlServer.listen(CONTROL_PORT, '127.0.0.1');

// Manejo de salida limpia para restaurar el lockfile original
process.on('SIGINT', () => {
  restoreLockfile();
  process.exit();
});

process.on('SIGTERM', () => {
  restoreLockfile();
  process.exit();
});
