import hre from "hardhat";

const { ethers } = hre;

async function main() {
  console.log("===============================================================");
  console.log(" EduCert - ĐO ĐẠC GAS THỰC TẾ (Lục Văn Thuận - 2351170624)");
  console.log("===============================================================");

  const [admin, issuer, student] = await ethers.getSigners();

  const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
  const contract = await CertificateRegistry.deploy();
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log(`[1] Triển khai CertificateRegistry tại: ${contractAddress}`);

  const ISSUER_ROLE = await contract.ISSUER_ROLE();

  // 1. Đo gas grantRole
  const grantTx = await contract.connect(admin).grantRole(ISSUER_ROLE, issuer.address);
  const grantReceipt = await grantTx.wait();
  const gasGrantRole = grantReceipt.gasUsed;
  console.log(`[2] grantRole(ISSUER_ROLE) Gas Used: ${gasGrantRole.toString()}`);

  // 2. Đo gas issueCertificate
  const certId = ethers.keccak256(ethers.toUtf8Bytes("BENCHMARK_CERT_001"));
  const fileHash = ethers.keccak256(ethers.toUtf8Bytes("BENCHMARK_PDF_CONTENT_HASH"));
  const issueTx = await contract.connect(issuer).issueCertificate(certId, fileHash, student.address);
  const issueReceipt = await issueTx.wait();
  const gasIssue = issueReceipt.gasUsed;
  console.log(`[3] issueCertificate Gas Used: ${gasIssue.toString()}`);

  // 3. Đo gas revokeCertificate
  const revokeTx = await contract.connect(issuer).revokeCertificate(certId, 1);
  const revokeReceipt = await revokeTx.wait();
  const gasRevoke = revokeReceipt.gasUsed;
  console.log(`[4] revokeCertificate Gas Used: ${gasRevoke.toString()}`);

  console.log("\n=================== BẢNG SỐ LIỆU GAS THỰC ĐO ===================");
  console.table([
    {
      "Hành động": "grantRole (Cấp quyền Issuer)",
      "Gas Used (units)": gasGrantRole.toString(),
      "Effective Gas Price (Gwei)": ethers.formatUnits(grantReceipt.gasPrice || 0, "gwei"),
    },
    {
      "Hành động": "issueCertificate (Cấp chứng chỉ)",
      "Gas Used (units)": gasIssue.toString(),
      "Effective Gas Price (Gwei)": ethers.formatUnits(issueReceipt.gasPrice || 0, "gwei"),
    },
    {
      "Hành động": "revokeCertificate (Thu hồi chứng chỉ)",
      "Gas Used (units)": gasRevoke.toString(),
      "Effective Gas Price (Gwei)": ethers.formatUnits(revokeReceipt.gasPrice || 0, "gwei"),
    },
  ]);
  console.log("===============================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
