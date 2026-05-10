import { getProcessedRecommendations } from './src/lib/engine/engine';
import { NAME_TO_ID } from './src/lib/engine/constants';

// Helper para esperar entre picks
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runDraftSimulation() {
    console.log("🎮 --- INICIANDO SIMULACIÓN DE DRAFT --- 🎮\n");

    const myRole = "jungle"; // Tu posición en esta prueba
    let myTeam: number[] = [];
    let enemyTeam: number[] = [];

    // FASE 1: Picks iniciales (Lado Azul)
    console.log("🟦 FASE 1: Primeros picks del enemigo...");
    enemyTeam.push(NAME_TO_ID["Ezreal"]); // Top enemigo
    enemyTeam.push(NAME_TO_ID["Lux"]);   // Mid enemigo
    enemyTeam.push(NAME_TO_ID["Ziggs"]);   // Mid enemigo
    await showRecommendations(myTeam, enemyTeam, myRole);

    await wait(2000);

    // FASE 2: Tus primeros aliados (Lado Rojo)
    console.log("\n🟥 FASE 2: Tus aliados eligen...");
    myTeam.push(NAME_TO_ID["Malphite"]);    // ADC aliado
    myTeam.push(NAME_TO_ID["Kennen"]);    // Sup aliado
    await showRecommendations(myTeam, enemyTeam, myRole);

    console.log("\n🏁 --- FIN DE LA SIMULACIÓN ---");
}

async function showRecommendations(myTeam: number[], enemyTeam: number[], role: string) {
    const recs = getProcessedRecommendations(myTeam, enemyTeam, role);
    
    console.log(`📋 Recomendaciones Top 5 para ${role.toUpperCase()}:`);
    recs.slice(0, 5).forEach((r, i) => {
        console.log(`${i + 1}. ${r.name} | Score: ${r.score}`);
        console.log(`   💡 Razones: ${r.reasons.slice(0, 2).join(' | ')}`);
    });
}

runDraftSimulation().catch(console.error);