import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const artifactPath = path.resolve(__dirname, "../artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json");

  if (!fs.existsSync(artifactPath)) {
    console.error("Artifacts not found! Please run `npx hardhat compile` first.");
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));

  const config = {
    contractName: "CertificateRegistry",
    chainId: 31337,
    networkName: "hardhat_local",
    contractAddress: process.env.CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3", // Default local deploy address
    abi: artifact.abi,
    deployedAt: new Date().toISOString(),
    author: "Lục Văn Thuận - 2351170624"
  };

  const outputDir = path.resolve(__dirname, "../config");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, "contract-config.json");
  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), "utf-8");

  console.log(`[OK] Exported contract config & ABI to: ${outputPath}`);
}

main().catch(console.error);
