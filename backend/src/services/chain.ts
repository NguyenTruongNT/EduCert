import { Contract, FetchRequest, JsonRpcProvider, ZeroHash, id as hashId } from 'ethers';
import type { AppConfig } from '../config.js';
import { ApiError, invariant } from '../errors.js';

export interface ChainRoles { admin: boolean; issuer: boolean }
export interface ChainCertificate {
  fileHash: string; issuer: string; student: string; issuedAt: string | null; revokedAt: string | null;
  revokeReasonCode: number; exists: boolean; revoked: boolean;
}
export interface IssuanceExpectation { certificateId: string; fileHash: string; issuer: string; student: string }
export const unixToIso = (seconds: bigint | number): string | null => Number(seconds) === 0 ? null : new Date(Number(seconds) * 1000).toISOString();

export class ChainService {
  readonly provider: JsonRpcProvider;
  readonly contract: Contract;
  constructor(readonly config: AppConfig) {
    const request = new FetchRequest(config.rpcUrl);
    request.timeout = 5000;
    this.provider = new JsonRpcProvider(request, { chainId: config.chainId, name: 'educert' }, { staticNetwork: true, batchMaxCount: 1, cacheTimeout: -1 });
    this.contract = new Contract(config.contractAddress, config.abi, this.provider);
  }

  async rpc<T>(work: () => Promise<T>): Promise<T> {
    try {
      const chainId = Number(BigInt(await this.provider.send('eth_chainId', [])));
      invariant(chainId === this.config.chainId, 503, 'RPC_ERROR', 'RPC network does not match contract configuration');
      invariant(await this.provider.getCode(this.config.contractAddress) !== '0x', 503, 'RPC_ERROR', 'Configured contract is not deployed on this node');
      return await work();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, 'RPC_ERROR', 'Unable to read the configured blockchain');
    }
  }

  async roles(wallet: string): Promise<ChainRoles> {
    return this.rpc(async () => {
      const [admin, issuer] = await Promise.all([
        this.contract.getFunction('hasRole')(ZeroHash, wallet),
        this.contract.getFunction('hasRole')(hashId('ISSUER_ROLE'), wallet),
      ]);
      return { admin: Boolean(admin), issuer: Boolean(issuer) };
    });
  }

  async certificate(certificateId: string): Promise<ChainCertificate> {
    return this.rpc(async () => this.mapCertificate(await this.contract.getFunction('getCertificate')(certificateId)));
  }

  async issuance(txHash: string, expected: IssuanceExpectation): Promise<ChainCertificate | null> {
    return this.rpc(async () => {
      const [tx, receipt] = await Promise.all([this.provider.getTransaction(txHash), this.provider.getTransactionReceipt(txHash)]);
      invariant(tx, 400, 'TX_NOT_FOUND', 'Transaction is not known to the configured node');
      invariant(Number(tx.chainId) === this.config.chainId && tx.to === this.config.contractAddress && tx.from === expected.issuer, 409, 'TX_MISMATCH', 'Transaction network, target or sender does not match the draft');
      if (!receipt) return null;
      invariant(receipt.status === 1, 409, 'TX_FAILED', 'Transaction execution failed');
      const issued = receipt.logs.filter(log => log.address === this.config.contractAddress).map(log => {
        try { return this.contract.interface.parseLog({ topics: [...log.topics], data: log.data }); }
        catch { return null; }
      }).find(log => log?.name === 'CertificateIssued' && log.args.certificateId.toLowerCase() === expected.certificateId &&
        log.args.fileHash.toLowerCase() === expected.fileHash && log.args.issuer === expected.issuer && log.args.student === expected.student);
      invariant(issued, 409, 'EVENT_MISMATCH', 'Receipt does not contain CertificateIssued matching this draft');
      const cert = this.mapCertificate(await this.contract.getFunction('getCertificate')(expected.certificateId));
      invariant(cert.exists && cert.fileHash === expected.fileHash && cert.issuer === expected.issuer && cert.student === expected.student, 409, 'CHAIN_STATE_MISMATCH', 'Contract state does not match this draft');
      return cert;
    });
  }

  private mapCertificate(raw: any): ChainCertificate {
    return {
      fileHash: raw.fileHash.toLowerCase(), issuer: raw.issuer, student: raw.student,
      issuedAt: unixToIso(raw.issuedAt), revokedAt: unixToIso(raw.revokedAt),
      revokeReasonCode: Number(raw.revokeReasonCode), exists: Boolean(raw.exists), revoked: Boolean(raw.revoked),
    };
  }

  close() { this.provider.destroy(); }
}
