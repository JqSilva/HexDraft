import assets from '../src/lib/data/assets-map.json' with { type: 'json' };

const runes = assets.runes;
for (const [id, data] of Object.entries(runes)) {
  if (data.name.includes("Toque") || data.name.includes("muerte") || data.name.includes("Deathfire")) {
    console.log(`Rune ID: ${id}, Name: ${data.name}`);
  }
}
