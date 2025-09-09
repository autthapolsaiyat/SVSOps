import { listTeams, upsertProduct } from "./src/lib/apiStock";

async function main() {
  try {
    console.log("== List teams ==");
    console.log(await listTeams());

    console.log("== Upsert product ==");
    const p = await upsertProduct({
      code: "F-TEST-002",
      name: "Probe via Frontend Lib",
      unit: "EA",
      price: 99,
      team_id: "e29e7da3-ecae-4184-a1dd-82320c918692",
    });
    console.log(p);
  } catch (e) {
    console.error("ERR:", e);
  }
}

main();

