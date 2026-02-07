const hre = require("hardhat");

async function main() {
  const treasury = "0x8028227C43947F41bB431571002D512815D77C4F";
  
  console.log("Deploying NFAv2 to", hre.network.name);
  console.log("Treasury:", treasury);

  const NFAv2 = await hre.ethers.getContractFactory("NFAv2");
  const nfa = await NFAv2.deploy(treasury);
  await nfa.waitForDeployment();

  const address = await nfa.getAddress();
  console.log("NFAv2 deployed to:", address);

  // Wait for confirmations
  console.log("Waiting for confirmations...");
  await nfa.deploymentTransaction().wait(5);

  // Verify on BscScan
  console.log("Verifying on BscScan...");
  try {
    await hre.run("verify:verify", {
      address: address,
      constructorArguments: [treasury],
    });
    console.log("Verified!");
  } catch (e) {
    console.log("Verification failed:", e.message);
  }

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("NFAv2:", address);
  console.log("Treasury:", treasury);
  console.log("\nUpdate these files with new address:");
  console.log("- src/hooks/useNFA.ts");
  console.log("- src/lib/nfa.ts");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
