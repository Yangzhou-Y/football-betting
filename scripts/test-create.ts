import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const record = JSON.parse(fs.readFileSync(path.join(__dirname,"..","deployments","localhost.json"),"utf-8"));
  const contractAddr = record.address;

  const [admin] = await ethers.getSigners();
  const contract = await ethers.getContractAt("FootballBetting", contractAddr);

  // Check owner
  const owner = await contract.owner();
  console.log("Owner:", owner);
  console.log("Admin:", admin.address);
  console.log("Is owner:", owner.toLowerCase() === admin.address.toLowerCase());

  // Check time
  const block = await ethers.provider.getBlock("latest");
  const sysTime = Math.floor(Date.now() / 1000);
  console.log("Block timestamp:", block!.timestamp, "=", new Date(block!.timestamp * 1000).toLocaleString());
  console.log("System time:", sysTime, "=", new Date(sysTime * 1000).toLocaleString());
  console.log("Offset:", Number(block!.timestamp) - sysTime, "seconds");

  // Try createMatch with future times that account for time offset
  const now = block!.timestamp; // Use BLOCK time, not system time
  const startTime = now + 3600;
  const deadline = now + 1800;
  const minBet = ethers.parseUnits("0.01", 6);

  const home = ethers.encodeBytes32String("法国");
  const away = ethers.encodeBytes32String("阿根廷");

  console.log(`\nCreating match: now=${now}, start=${startTime}, deadline=${deadline}`);
  try {
    const tx = await contract.createMatch(home, away, startTime, deadline, minBet, 0n);
    console.log("tx:", tx.hash);
    const receipt = await tx.wait();
    console.log("✓ SUCCESS! Block #" + receipt!.blockNumber);

    // Open match
    const tx2 = await contract.openMatch(2);
    await tx2.wait();
    console.log("✓ Opened match #2");
  } catch(e: any) {
    console.error("✗ FAILED:", e.message);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
