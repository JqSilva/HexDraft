// src/lib/scripts/test-single-flaresolverr.ts
import axios from 'axios';

const FLARESOLVERR_URL = 'http://localhost:8191/v1';
const url = "https://dpm.lol/v1/builds/RekSai?lane=jungle&tier=emerald_plus&timeframe=16.12&gameMode=ranked";

async function run() {
  console.log(`Sending request to FlareSolverr for Aatrox...`);
  try {
    const response = await axios.post(FLARESOLVERR_URL, {
      cmd: "request.get",
      url: url,
      maxTimeout: 60000
    });
    console.log("Status code from FlareSolverr:", response.status);
    console.log("Status inside response data:", response.data.status);
    if (response.data.solution) {
      console.log("Solution Status:", response.data.solution.status);
      console.log("Response text length:", response.data.solution.response.length);
      console.log("Preview of response text (first 1000 chars):");
      console.log(response.data.solution.response.substring(0, 1000));
    } else {
      console.log("No solution object found:", response.data);
    }
  } catch (err: any) {
    console.error("Error occurred:", err.message);
    if (err.response) {
      console.log("Error response data:", err.response.data);
    }
  }
}

run();
