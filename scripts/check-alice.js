const hre = require("hardhat");

async function main() {
  const nfa = await hre.ethers.getContractAt("NFAv2", "0x2b703D4dC84ACB24a0A3F34CBF259D5Cb2B62b19");
  
  const total = await nfa.totalMinted();
  console.log("Total NFA minted:", total.toString());
  
  // Get Alice's token (latest minted)
  for (let i = Number(total) - 1; i >= Math.max(0, Number(total) - 3); i--) {
    const agent = await nfa.agents(i);
    console.log(`\nToken ID ${i}:`);
    console.log("  Name:", agent.name);
    console.log("  Logic:", agent.logic);
    console.log("  Level:", agent.level.toString());
    console.log("  Active:", agent.active);
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
