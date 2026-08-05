// scripts/test-live-game-endpoint.ts
import axios from 'axios';

async function testEndpoint() {
  try {
    const res = await axios.get('http://localhost:4321/api/live-game');
    console.log("Status:", res.status);
    console.log("Data active:", res.data?.active);
    console.log("Blue team count:", res.data?.blueTeam?.length);
    console.log("Red team count:", res.data?.redTeam?.length);
    console.log("Game mode:", res.data?.gameMode);
    if (res.data?.blueTeam?.length > 0) {
      console.log("Blue Team Player 1:", res.data.blueTeam[0].summonerName, res.data.blueTeam[0].championName, res.data.blueTeam[0].role);
    }
  } catch (e: any) {
    console.error("Error fetching /api/live-game:", e.message);
  }
}

testEndpoint();
