// scripts/inspect-gameflow-json.ts
import { getLockfileData } from '../src/lib/services/lcu.service.js';
import https from 'node:https';
import axios from 'axios';

const agent = new https.Agent({ rejectUnauthorized: false });

async function inspectGameflow() {
  const lcu = getLockfileData();
  if (!lcu) {
    console.log("LCU lockfile no detectado.");
    return;
  }

  const auth = btoa(`riot:${lcu.token}`);
  const headers = { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' };

  try {
    const res = await axios.get(`https://127.0.0.1:${lcu.port}/lol-gameflow/v1/session`, {
      headers,
      httpsAgent: agent,
      timeout: 3000
    });

    console.log("===================================================================");
    console.log("[INSPECCIÓN DE /lol-gameflow/v1/session]");
    console.log("===================================================================");
    console.log(JSON.stringify(res.data, null, 2));

  } catch (e: any) {
    console.error("Error consultando gameflow session:", e.message);
  }
}

inspectGameflow();
