import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("EduCert - CertificateRegistry Smart Contract (Lục Văn Thuận - 2351170624)", function () {
  let certificateRegistry;
  let admin, issuer1, issuer2, student1, student2, stranger;
  let ISSUER_ROLE, DEFAULT_ADMIN_ROLE;

  const sampleId1 = ethers.keccak256(ethers.toUtf8Bytes("CERT_ID_001"));
  const sampleId2 = ethers.keccak256(ethers.toUtf8Bytes("CERT_ID_002"));
  const sampleId3 = ethers.keccak256(ethers.toUtf8Bytes("CERT_ID_003"));
  const sampleHash1 = ethers.keccak256(ethers.toUtf8Bytes("SHA256_PDF_CONTENT_001"));
  const sampleHash2 = ethers.keccak256(ethers.toUtf8Bytes("SHA256_PDF_CONTENT_002"));
  const sampleHash3 = ethers.keccak256(ethers.toUtf8Bytes("SHA256_PDF_CONTENT_003"));

  beforeEach(async function () {
    [admin, issuer1, issuer2, student1, student2, stranger] = await ethers.getSigners();

    const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
    certificateRegistry = await CertificateRegistry.deploy();
    await certificateRegistry.waitForDeployment();

    DEFAULT_ADMIN_ROLE = await certificateRegistry.DEFAULT_ADMIN_ROLE();
    ISSUER_ROLE = await certificateRegistry.ISSUER_ROLE();

    // Admin cấp quyền ISSUER_ROLE cho issuer1
    await certificateRegistry.connect(admin).grantRole(ISSUER_ROLE, issuer1.address);
  });

  // ==========================================
  // CT-01: Deployer tạo contract -> Admin role tồn tại đúng cấu hình
  // ==========================================
  it("CT-01: Deployer tạo contract - Admin role tồn tại đúng cấu hình", async function () {
    const hasAdminRole = await certificateRegistry.hasRole(DEFAULT_ADMIN_ROLE, admin.address);
    expect(hasAdminRole).to.be.true;
  });

  // ==========================================
  // CT-02: Admin cấp Issuer role -> Cấp thành công, có RoleGranted
  // ==========================================
  it("CT-02: Admin cấp Issuer role - Cấp thành công, phát ra RoleGranted", async function () {
    await expect(certificateRegistry.connect(admin).grantRole(ISSUER_ROLE, issuer2.address))
      .to.emit(certificateRegistry, "RoleGranted")
      .withArgs(ISSUER_ROLE, issuer2.address, admin.address);

    const hasIssuerRole = await certificateRegistry.hasRole(ISSUER_ROLE, issuer2.address);
    expect(hasIssuerRole).to.be.true;
  });

  // ==========================================
  // CT-03: Người lạ cấp role -> Revert
  // ==========================================
  it("CT-03: Người lạ cấp role - Bị Revert", async function () {
    await expect(
      certificateRegistry.connect(stranger).grantRole(ISSUER_ROLE, stranger.address)
    ).to.be.reverted;
  });

  // ==========================================
  // CT-04: Issuer đăng ký hợp lệ -> Bản ghi tồn tại, thông tin đúng
  // ==========================================
  it("CT-04: Issuer đăng ký hợp lệ - Bản ghi tồn tại, thông tin đúng", async function () {
    await certificateRegistry.connect(issuer1).issueCertificate(sampleId1, sampleHash1, student1.address);

    const cert = await certificateRegistry.getCertificate(sampleId1);
    expect(cert.exists).to.be.true;
    expect(cert.revoked).to.be.false;
    expect(cert.fileHash).to.equal(sampleHash1);
    expect(cert.issuer).to.equal(issuer1.address);
    expect(cert.student).to.equal(student1.address);
    expect(cert.issuedAt).to.be.gt(0);
    expect(cert.revokedAt).to.equal(0);
    expect(cert.revokeReasonCode).to.equal(0);
  });

  // ==========================================
  // CT-05: Người không có role issue -> Revert, không ghi dữ liệu
  // ==========================================
  it("CT-05: Người không có role issue - Revert, không ghi dữ liệu", async function () {
    await expect(
      certificateRegistry.connect(stranger).issueCertificate(sampleId1, sampleHash1, student1.address)
    ).to.be.reverted;

    const cert = await certificateRegistry.getCertificate(sampleId1);
    expect(cert.exists).to.be.false;
  });

  // ==========================================
  // CT-06: Trùng certificateId -> Revert
  // ==========================================
  it("CT-06: Trùng certificateId - Revert", async function () {
    await certificateRegistry.connect(issuer1).issueCertificate(sampleId1, sampleHash1, student1.address);

    await expect(
      certificateRegistry.connect(issuer1).issueCertificate(sampleId1, sampleHash2, student2.address)
    ).to.be.revertedWith("Certificate already exists");
  });

  // ==========================================
  // CT-07: Trùng fileHash khác ID -> Revert
  // ==========================================
  it("CT-07: Trùng fileHash khác ID - Revert", async function () {
    await certificateRegistry.connect(issuer1).issueCertificate(sampleId1, sampleHash1, student1.address);

    await expect(
      certificateRegistry.connect(issuer1).issueCertificate(sampleId2, sampleHash1, student2.address)
    ).to.be.revertedWith("File hash already registered");
  });

  // ==========================================
  // CT-08: ID/hash/student rỗng -> Revert theo từng điều kiện
  // ==========================================
  it("CT-08: ID/hash/student rỗng - Revert theo từng điều kiện", async function () {
    const zeroBytes32 = ethers.ZeroHash;
    const zeroAddress = ethers.ZeroAddress;

    // Rỗng ID
    await expect(
      certificateRegistry.connect(issuer1).issueCertificate(zeroBytes32, sampleHash1, student1.address)
    ).to.be.revertedWith("Invalid certificate ID");

    // Rỗng hash
    await expect(
      certificateRegistry.connect(issuer1).issueCertificate(sampleId1, zeroBytes32, student1.address)
    ).to.be.revertedWith("Invalid file hash");

    // Rỗng student address
    await expect(
      certificateRegistry.connect(issuer1).issueCertificate(sampleId1, sampleHash1, zeroAddress)
    ).to.be.revertedWith("Invalid student address");
  });

  // ==========================================
  // CT-09: Tra cứu ID không có -> exists=false, không báo hợp lệ
  // ==========================================
  it("CT-09: Tra cứu ID không có - exists=false, verify trả về 0 (NOT_FOUND)", async function () {
    const cert = await certificateRegistry.getCertificate(sampleId1);
    expect(cert.exists).to.be.false;

    const status = await certificateRegistry.verifyCertificate(sampleId1, sampleHash1);
    expect(status).to.equal(0); // 0 = NOT_FOUND
  });

  // ==========================================
  // CT-10: Candidate hash đúng -> Kết quả VALID (1)
  // ==========================================
  it("CT-10: Candidate hash đúng - verify trả về 1 (VALID)", async function () {
    await certificateRegistry.connect(issuer1).issueCertificate(sampleId1, sampleHash1, student1.address);

    const status = await certificateRegistry.verifyCertificate(sampleId1, sampleHash1);
    expect(status).to.equal(1); // 1 = VALID
  });

  // ==========================================
  // CT-11: Candidate hash sai -> FILE_HASH_MISMATCH (3)
  // ==========================================
  it("CT-11: Candidate hash sai - verify trả về 3 (FILE_HASH_MISMATCH)", async function () {
    await certificateRegistry.connect(issuer1).issueCertificate(sampleId1, sampleHash1, student1.address);

    const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("MODIFIED_PDF"));
    const status = await certificateRegistry.verifyCertificate(sampleId1, wrongHash);
    expect(status).to.equal(3); // 3 = FILE_HASH_MISMATCH
  });

  // ==========================================
  // CT-12: Issuer gốc thu hồi -> revoked=true, event, timestamp
  // ==========================================
  it("CT-12: Issuer gốc thu hồi - revoked=true, phát event CertificateRevoked và lưu timestamp", async function () {
    await certificateRegistry.connect(issuer1).issueCertificate(sampleId1, sampleHash1, student1.address);

    const tx = await certificateRegistry.connect(issuer1).revokeCertificate(sampleId1, 1);
    await expect(tx).to.emit(certificateRegistry, "CertificateRevoked");

    const cert = await certificateRegistry.getCertificate(sampleId1);
    expect(cert.revoked).to.be.true;
    expect(cert.revokedAt).to.be.gt(0);
    expect(cert.revokeReasonCode).to.equal(1);

    const status = await certificateRegistry.verifyCertificate(sampleId1, sampleHash1);
    expect(status).to.equal(2); // 2 = REVOKED
  });

  // ==========================================
  // CT-13: Issuer khác thu hồi -> Revert
  // ==========================================
  it("CT-13: Issuer khác thu hồi - Bị Revert Unauthorized", async function () {
    await certificateRegistry.connect(admin).grantRole(ISSUER_ROLE, issuer2.address);
    await certificateRegistry.connect(issuer1).issueCertificate(sampleId1, sampleHash1, student1.address);

    await expect(
      certificateRegistry.connect(issuer2).revokeCertificate(sampleId1, 1)
    ).to.be.revertedWith("Unauthorized to revoke certificate");
  });

  // ==========================================
  // CT-14: Thu hồi lần hai -> Revert
  // ==========================================
  it("CT-14: Thu hồi lần hai - Bị Revert", async function () {
    await certificateRegistry.connect(issuer1).issueCertificate(sampleId1, sampleHash1, student1.address);
    await certificateRegistry.connect(issuer1).revokeCertificate(sampleId1, 1);

    await expect(
      certificateRegistry.connect(issuer1).revokeCertificate(sampleId1, 1)
    ).to.be.revertedWith("Certificate already revoked");
  });

  // ==========================================
  // CT-15: Admin thu hồi -> Thành công
  // ==========================================
  it("CT-15: Admin thu hồi - Thành công", async function () {
    await certificateRegistry.connect(issuer1).issueCertificate(sampleId1, sampleHash1, student1.address);

    await expect(
      certificateRegistry.connect(admin).revokeCertificate(sampleId1, 2)
    ).to.emit(certificateRegistry, "CertificateRevoked");

    const cert = await certificateRegistry.getCertificate(sampleId1);
    expect(cert.revoked).to.be.true;
    expect(cert.revokeReasonCode).to.equal(2);
  });

  // ==========================================
  // CT-16: Tước role của Issuer -> Không cấp mới; bản cũ không tự thu hồi
  // ==========================================
  it("CT-16: Tước role của Issuer - Không cấp mới; bản cũ không tự thu hồi", async function () {
    await certificateRegistry.connect(issuer1).issueCertificate(sampleId1, sampleHash1, student1.address);

    // Tước quyền Issuer của issuer1
    await certificateRegistry.connect(admin).revokeRole(ISSUER_ROLE, issuer1.address);

    // Thử cấp mới -> Revert
    await expect(
      certificateRegistry.connect(issuer1).issueCertificate(sampleId2, sampleHash2, student2.address)
    ).to.be.reverted;

    // Bản cũ vẫn tồn tại và có hiệu lực (không tự thu hồi)
    const cert = await certificateRegistry.getCertificate(sampleId1);
    expect(cert.exists).to.be.true;
    expect(cert.revoked).to.be.false;

    // Issuer cũ đã bị tước role cũng không thể thu hồi bản cũ
    await expect(
      certificateRegistry.connect(issuer1).revokeCertificate(sampleId1, 1)
    ).to.be.revertedWith("Unauthorized to revoke certificate");
  });

  // ==========================================
  // CT-17: Danh sách Student phân trang -> Đúng limit/offset
  // ==========================================
  it("CT-17: Danh sách Student phân trang - Đúng limit/offset", async function () {
    await certificateRegistry.connect(issuer1).issueCertificate(sampleId1, sampleHash1, student1.address);
    await certificateRegistry.connect(issuer1).issueCertificate(sampleId2, sampleHash2, student1.address);
    await certificateRegistry.connect(issuer1).issueCertificate(sampleId3, sampleHash3, student1.address);

    // Trang 1: offset 0, limit 2
    const page1 = await certificateRegistry.getStudentCertificateIds(student1.address, 0, 2);
    expect(page1.length).to.equal(2);
    expect(page1[0]).to.equal(sampleId1);
    expect(page1[1]).to.equal(sampleId2);

    // Trang 2: offset 2, limit 2
    const page2 = await certificateRegistry.getStudentCertificateIds(student1.address, 2, 2);
    expect(page2.length).to.equal(1);
    expect(page2[0]).to.equal(sampleId3);

    // Vượt mảng: offset 5, limit 2
    const emptyPage = await certificateRegistry.getStudentCertificateIds(student1.address, 5, 2);
    expect(emptyPage.length).to.equal(0);
  });

  // ==========================================
  // CT-18: Thống kê sau cấp và thu hồi -> issued = active + revoked
  // ==========================================
  it("CT-18: Thống kê sau cấp và thu hồi - issued = active + revoked", async function () {
    await certificateRegistry.connect(issuer1).issueCertificate(sampleId1, sampleHash1, student1.address);
    await certificateRegistry.connect(issuer1).issueCertificate(sampleId2, sampleHash2, student2.address);
    await certificateRegistry.connect(issuer1).revokeCertificate(sampleId1, 1);

    const stats = await certificateRegistry.getStats();
    expect(stats.totalIssuedCount).to.equal(2);
    expect(stats.totalRevokedCount).to.equal(1);
    expect(stats.totalActiveCount).to.equal(1);
    expect(stats.totalIssuedCount).to.equal(stats.totalActiveCount + stats.totalRevokedCount);
  });

  // ==========================================
  // CT-19: Reason code không hợp lệ -> Revert
  // ==========================================
  it("CT-19: Reason code không hợp lệ (0 hoặc 5) - Bị Revert", async function () {
    await certificateRegistry.connect(issuer1).issueCertificate(sampleId1, sampleHash1, student1.address);

    // reasonCode = 0
    await expect(
      certificateRegistry.connect(issuer1).revokeCertificate(sampleId1, 0)
    ).to.be.revertedWith("Invalid revoke reason code");

    // reasonCode = 5
    await expect(
      certificateRegistry.connect(issuer1).revokeCertificate(sampleId1, 5)
    ).to.be.revertedWith("Invalid revoke reason code");
  });

  // ==========================================
  // CT-20: Event fields -> Đúng ID, issuer, student, tx
  // ==========================================
  it("CT-20: Event fields - Đúng ID, issuer, student, fileHash, timestamp", async function () {
    const tx = await certificateRegistry
      .connect(issuer1)
      .issueCertificate(sampleId1, sampleHash1, student1.address);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt.blockNumber);

    await expect(tx)
      .to.emit(certificateRegistry, "CertificateIssued")
      .withArgs(sampleId1, issuer1.address, student1.address, sampleHash1, block.timestamp);
  });
});
