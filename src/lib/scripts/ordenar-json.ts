import fs from 'fs';

const filePath = './src/lib/data/counter-synergies.json';

function formatDatabase() {
    if (!fs.existsSync(filePath)) {
        console.error("❌ Archivo no encontrado.");
        return;
    }

    const db = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const sortedKeys = Object.keys(db).sort();
    const formattedDb: any = {};

    sortedKeys.forEach(key => {
        const champ = db[key];

        // 1. Re-estructuramos el objeto para que siempre tenga el mismo orden de llaves
        formattedDb[key] = {
            lane: champ.lane,
            tags: champ.tags || [],
            scalingType: champ.scalingType || "Mid", // Por si alguno quedó vacío
            
            // Redondeamos los valores de combate para que no ocupen tanto espacio
            combat: {
                damageComposition: {
                    physical: Math.round(champ.combat?.damageComposition?.physical || 0),
                    magic: Math.round(champ.combat?.damageComposition?.magic || 0),
                    true: Math.round(champ.combat?.damageComposition?.true || 0)
                },
                winrateCurve: champ.combat?.winrateCurve || []
            },

            // Listas de datos
            counters: champ.counters || [],
            godMatchups: champ.godMatchups || [],
            synergies: champ.synergies || {}
        };
    });

    // Guardamos con indentación de 2 espacios
    fs.writeFileSync(filePath, JSON.stringify(formattedDb, null, 2));
    console.log("✅ Base de datos ordenada, sanitizada y guardada.");
}

formatDatabase();