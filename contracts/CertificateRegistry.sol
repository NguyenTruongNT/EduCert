// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CertificateRegistry
 * @dev EduCert - Hợp đồng lưu trữ chứng chỉ học tập (Kiến trúc kết hợp On-chain và Off-chain)
 * Tác giả: Nhóm 11 - Thành viên phụ trách: Lục Văn Thuận (2351170624)
 */
contract CertificateRegistry is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct Certificate {
        bytes32 fileHash;
        address issuer;
        address student;
        uint64 issuedAt;
        uint64 revokedAt;
        uint8 revokeReasonCode;
        bool exists;
        bool revoked;
    }

    // Mapping từ certificateId (bytes32) -> thông tin chứng chỉ
    mapping(bytes32 => Certificate) private certificates;

    // Mapping chống trùng mã băm PDF fileHash
    mapping(bytes32 => bool) private usedFileHashes;

    // Mapping danh sách certificateId theo địa chỉ ví sinh viên
    mapping(address => bytes32[]) private studentCertificateIds;

    // Bộ đếm thống kê
    uint256 public totalIssued;
    uint256 public totalRevoked;

    // Sự kiện nghiệp vụ
    event CertificateIssued(
        bytes32 indexed certificateId,
        address indexed issuer,
        address indexed student,
        bytes32 fileHash,
        uint64 issuedAt
    );

    event CertificateRevoked(
        bytes32 indexed certificateId,
        address indexed revokedBy,
        uint8 reasonCode,
        uint64 revokedAt
    );

    constructor() {
        // Gán vai trò quản trị tối cao cho người triển khai hợp đồng
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Đăng ký chứng chỉ mới lên blockchain
     * @param certificateId Định danh duy nhất (bytes32)
     * @param fileHash Mã băm SHA-256 của tệp PDF cuối cùng (bytes32)
     * @param student Địa chỉ ví người nhận chứng chỉ
     */
    function issueCertificate(
        bytes32 certificateId,
        bytes32 fileHash,
        address student
    ) external onlyRole(ISSUER_ROLE) {
        require(certificateId != bytes32(0), "Invalid certificate ID");
        require(fileHash != bytes32(0), "Invalid file hash");
        require(student != address(0), "Invalid student address");
        require(!certificates[certificateId].exists, "Certificate already exists");
        require(!usedFileHashes[fileHash], "File hash already registered");

        uint64 currentTime = uint64(block.timestamp);

        certificates[certificateId] = Certificate({
            fileHash: fileHash,
            issuer: msg.sender,
            student: student,
            issuedAt: currentTime,
            revokedAt: 0,
            revokeReasonCode: 0,
            exists: true,
            revoked: false
        });

        usedFileHashes[fileHash] = true;
        studentCertificateIds[student].push(certificateId);
        totalIssued++;

        emit CertificateIssued(certificateId, msg.sender, student, fileHash, currentTime);
    }

    /**
     * @notice Thu hồi chứng chỉ
     * @param certificateId Định danh chứng chỉ cần thu hồi
     * @param reasonCode Mã lý do: 1: Sai thông tin, 2: Gian lận, 3: Sai thẩm quyền, 4: Khác
     */
    function revokeCertificate(bytes32 certificateId, uint8 reasonCode) external {
        Certificate storage cert = certificates[certificateId];
        require(cert.exists, "Certificate does not exist");
        require(!cert.revoked, "Certificate already revoked");
        require(reasonCode >= 1 && reasonCode <= 4, "Invalid revoke reason code");

        // Kiểm tra thẩm quyền: Admin hoặc chính Issuer gốc (vẫn còn ISSUER_ROLE)
        bool isAdmin = hasRole(DEFAULT_ADMIN_ROLE, msg.sender);
        bool isOriginalIssuerWithRole = (msg.sender == cert.issuer && hasRole(ISSUER_ROLE, msg.sender));
        require(isAdmin || isOriginalIssuerWithRole, "Unauthorized to revoke certificate");

        uint64 currentTime = uint64(block.timestamp);
        cert.revoked = true;
        cert.revokedAt = currentTime;
        cert.revokeReasonCode = reasonCode;
        totalRevoked++;

        emit CertificateRevoked(certificateId, msg.sender, reasonCode, currentTime);
    }

    /**
     * @notice Lấy thông tin chứng chỉ theo certificateId
     * @param certificateId Định danh chứng chỉ
     */
    function getCertificate(bytes32 certificateId) external view returns (Certificate memory) {
        return certificates[certificateId];
    }

    /**
     * @notice Xác minh chứng chỉ với candidateHash
     * @param certificateId Định danh chứng chỉ
     * @param candidateHash Mã băm cần đối chiếu
     * @return 0: NOT_FOUND, 1: VALID, 2: REVOKED, 3: FILE_HASH_MISMATCH
     */
    function verifyCertificate(
        bytes32 certificateId,
        bytes32 candidateHash
    ) external view returns (uint8) {
        Certificate memory cert = certificates[certificateId];
        if (!cert.exists) {
            return 0; // NOT_FOUND
        }
        if (cert.revoked) {
            return 2; // REVOKED
        }
        if (cert.fileHash != candidateHash) {
            return 3; // FILE_HASH_MISMATCH
        }
        return 1; // VALID
    }

    /**
     * @notice Lấy danh sách ID chứng chỉ của một sinh viên (có phân trang)
     * @param student Địa chỉ ví sinh viên
     * @param offset Vị trí bắt đầu
     * @param limit Số lượng bản ghi tối đa
     */
    function getStudentCertificateIds(
        address student,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory) {
        bytes32[] storage allIds = studentCertificateIds[student];
        uint256 total = allIds.length;

        if (offset >= total || limit == 0) {
            return new bytes32[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 size = end - offset;
        bytes32[] memory result = new bytes32[](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = allIds[offset + i];
        }

        return result;
    }

    /**
     * @notice Lấy thống kê tổng số lượng chứng chỉ
     * @return totalIssuedCount Tổng số chứng chỉ đã cấp
     * @return totalRevokedCount Tổng số chứng chỉ đã thu hồi
     * @return totalActiveCount Tổng số chứng chỉ đang có hiệu lực
     */
    function getStats()
        external
        view
        returns (
            uint256 totalIssuedCount,
            uint256 totalRevokedCount,
            uint256 totalActiveCount
        )
    {
        return (totalIssued, totalRevoked, totalIssued - totalRevoked);
    }
}
