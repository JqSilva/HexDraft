// debug.ts
import { getProcessedRecommendations } from './src/lib/engine';

// 1. TU EQUIPO (Tus 4 aliados, sin contarte a ti)
const mockMyTeam = [
    { championId: 86 },  // Garen (AD)
    { championId: 222 }, // Jinx (AD)
    { championId: 12 },  // Alistar (Tank)
    { championId: 7 },   // LeBlanc (AP)
];

// 2. EQUIPO ENEMIGO
const mockEnemyTeam = [
    { championId: 517 }, // Sylas
    { championId: 64 },  // Lee Sin
    { championId: 81 },  // Ezreal
];

const roleALotear = "jungle"; 

console.log("🧪 Simulando Draft para JUNGLE...");


const picks = getProcessedRecommendations(mockMyTeam, mockEnemyTeam, roleALotear);

console.log(`\nResultados encontrados: ${picks.length}`);
console.log(`Top 10 Recomendaciones:`);

picks.slice(0, 10).forEach((p, i) => {
    console.log(`${i + 1}. ${p.name.padEnd(15)} | Score: ${p.score}`);
});