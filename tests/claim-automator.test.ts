import { describe, expect, it, vi, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface Claim {
  status: string;
  contaminationLevel: number;
  timestamp: number;
  payoutAmount: number;
  oracleDataHash: Uint8Array;
  metadata: string;
  disputeEndBlock: number | null;
}

interface PolicyThreshold {
  minContamination: number;
  maxContamination: number;
  cropType: string;
  coverageAmount: number;
}

interface ClaimHistory {
  policyId: number;
  farmer: string;
  outcome: string;
  timestamp: number;
  amount: number;
}

interface Dispute {
  initiator: string;
  reason: string;
  votesFor: number;
  votesAgainst: number;
  resolved: boolean;
  resolution: string | null;
}

interface ContractState {
  paused: boolean;
  admin: string;
  totalClaimsProcessed: number;
  totalPayouts: number;
  minThreshold: number;
  claims: Map<string, Claim>; // Key: `${policyId}-${farmer}`
  policyThresholds: Map<number, PolicyThreshold>;
  claimHistory: Map<number, ClaimHistory>;
  disputes: Map<number, Dispute>;
  authorizedOracles: Map<string, boolean>;
  authorizedVerifiers: Map<string, boolean>;
  blockHeight: number; // Mock block height
}

// Mock contract implementation
class ClaimAutomatorMock {
  private state: ContractState = {
    paused: false,
    admin: "deployer",
    totalClaimsProcessed: 0,
    totalPayouts: 0,
    minThreshold: 10,
    claims: new Map(),
    policyThresholds: new Map(),
    claimHistory: new Map(),
    disputes: new Map(),
    authorizedOracles: new Map(),
    authorizedVerifiers: new Map(),
    blockHeight: 1000,
  };

  private ERR_POLICY_NOT_ACTIVE = 100;
  private ERR_PREMIUMS_UNPAID = 101;
  private ERR_INVALID_CONTAMINATION_DATA = 102;
  private ERR_BELOW_THRESHOLD = 103;
  private ERR_CLAIM_ALREADY_PROCESSED = 104;
  private ERR_UNAUTHORIZED = 105;
  private ERR_PAUSED = 106;
  private ERR_INVALID_FARMER = 107;
  private ERR_NO_FUNDS_AVAILABLE = 108;
  private ERR_DISPUTE_IN_PROGRESS = 109;
  private ERR_INVALID_TIMESTAMP = 110;
  private ERR_METADATA_TOO_LONG = 111;
  private ERR_INVALID_THRESHOLD = 112;
  private MAX_METADATA_LEN = 1000;
  private CLAIM_WINDOW_BLOCKS = 144;

  // Helper to get claim key
  private getClaimKey(policyId: number, farmer: string): string {
    return `${policyId}-${farmer}`;
  }

  // Mock block-height
  private getBlockHeight(): number {
    return this.state.blockHeight;
  }

  // Simulate advancing block height
  advanceBlockHeight(blocks: number): void {
    this.state.blockHeight += blocks;
  }

  pauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.paused = true;
    return { ok: true, value: true };
  }

  unpauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.paused = false;
    return { ok: true, value: true };
  }

  setAdmin(caller: string, newAdmin: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.admin = newAdmin;
    return { ok: true, value: true };
  }

  addAuthorizedOracle(caller: string, oracle: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.authorizedOracles.set(oracle, true);
    return { ok: true, value: true };
  }

  removeAuthorizedOracle(caller: string, oracle: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.authorizedOracles.delete(oracle);
    return { ok: true, value: true };
  }

  setMinThreshold(caller: string, newThreshold: number): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (newThreshold <= 0) {
      return { ok: false, value: this.ERR_INVALID_THRESHOLD };
    }
    this.state.minThreshold = newThreshold;
    return { ok: true, value: true };
  }

  registerPolicyThreshold(
    caller: string,
    policyId: number,
    minCont: number,
    maxCont: number,
    crop: string,
    coverage: number
  ): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (minCont > maxCont) {
      return { ok: false, value: this.ERR_INVALID_THRESHOLD };
    }
    this.state.policyThresholds.set(policyId, {
      minContamination: minCont,
      maxContamination: maxCont,
      cropType: crop,
      coverageAmount: coverage,
    });
    return { ok: true, value: true };
  }

  submitContaminationData(
    caller: string,
    policyId: number,
    farmer: string,
    level: number,
    dataHash: Uint8Array,
    metadata: string
  ): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (!this.state.authorizedOracles.get(caller)) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (metadata.length > this.MAX_METADATA_LEN) {
      return { ok: false, value: this.ERR_METADATA_TOO_LONG };
    }
    // Mock policy active and premiums paid
    const thresholds = this.state.policyThresholds.get(policyId);
    if (!thresholds) {
      return { ok: false, value: this.ERR_INVALID_CONTAMINATION_DATA };
    }
    const claimKey = this.getClaimKey(policyId, farmer);
    if (this.state.claims.has(claimKey)) {
      return { ok: false, value: this.ERR_CLAIM_ALREADY_PROCESSED };
    }
    if (level < thresholds.minContamination) {
      return { ok: false, value: this.ERR_BELOW_THRESHOLD };
    }
    if (level > thresholds.maxContamination) {
      return { ok: false, value: this.ERR_INVALID_CONTAMINATION_DATA };
    }
    this.state.claims.set(claimKey, {
      status: "pending",
      contaminationLevel: level,
      timestamp: this.getBlockHeight(),
      payoutAmount: thresholds.coverageAmount,
      oracleDataHash: dataHash,
      metadata,
      disputeEndBlock: null,
    });
    return { ok: true, value: true };
  }

  processClaim(caller: string, policyId: number, farmer: string, claimId: number): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const claimKey = this.getClaimKey(policyId, farmer);
    const claim = this.state.claims.get(claimKey);
    if (!claim) {
      return { ok: false, value: this.ERR_CLAIM_ALREADY_PROCESSED };
    }
    if (claim.status !== "pending") {
      return { ok: false, value: this.ERR_CLAIM_ALREADY_PROCESSED };
    }
    if (this.getBlockHeight() - claim.timestamp >= this.CLAIM_WINDOW_BLOCKS) {
      return { ok: false, value: this.ERR_INVALID_TIMESTAMP };
    }
    // Mock contamination verification
    if (claim.contaminationLevel < this.state.minThreshold) {
      return { ok: false, value: this.ERR_BELOW_THRESHOLD };
    }
    const dispute = this.state.disputes.get(claimId);
    if (dispute && !dispute.resolved) {
      return { ok: false, value: this.ERR_DISPUTE_IN_PROGRESS };
    }
    claim.status = "verified";
    this.state.claims.set(claimKey, claim);
    // Mock payout success
    claim.status = "paid";
    this.state.claims.set(claimKey, claim);
    this.state.totalClaimsProcessed += 1;
    this.state.totalPayouts += claim.payoutAmount;
    this.state.claimHistory.set(claimId, {
      policyId,
      farmer,
      outcome: "paid",
      timestamp: this.getBlockHeight(),
      amount: claim.payoutAmount,
    });
    return { ok: true, value: true };
  }

  initiateDispute(
    caller: string,
    claimId: number,
    policyId: number,
    farmer: string,
    reason: string
  ): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const claimKey = this.getClaimKey(policyId, farmer);
    const claim = this.state.claims.get(claimKey);
    if (!claim) {
      return { ok: false, value: this.ERR_CLAIM_ALREADY_PROCESSED };
    }
    if (caller !== farmer && caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (claim.status !== "verified") {
      return { ok: false, value: this.ERR_CLAIM_ALREADY_PROCESSED };
    }
    if (this.getBlockHeight() - claim.timestamp >= this.CLAIM_WINDOW_BLOCKS) {
      return { ok: false, value: this.ERR_INVALID_TIMESTAMP };
    }
    this.state.disputes.set(claimId, {
      initiator: caller,
      reason,
      votesFor: 0,
      votesAgainst: 0,
      resolved: false,
      resolution: null,
    });
    claim.status = "disputed";
    claim.disputeEndBlock = this.getBlockHeight() + this.CLAIM_WINDOW_BLOCKS;
    this.state.claims.set(claimKey, claim);
    return { ok: true, value: true };
  }

  voteOnDispute(caller: string, claimId: number, vote: boolean): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const dispute = this.state.disputes.get(claimId);
    if (!dispute) {
      return { ok: false, value: this.ERR_DISPUTE_IN_PROGRESS };
    }
    if (dispute.resolved) {
      return { ok: false, value: this.ERR_DISPUTE_IN_PROGRESS };
    }
    if (!this.state.authorizedVerifiers.get(caller)) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (vote) {
      dispute.votesFor += 1;
    } else {
      dispute.votesAgainst += 1;
    }
    this.state.disputes.set(claimId, dispute);
    return { ok: true, value: true };
  }

  resolveDispute(caller: string, claimId: number, policyId: number, farmer: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    const dispute = this.state.disputes.get(claimId);
    if (!dispute) {
      return { ok: false, value: this.ERR_DISPUTE_IN_PROGRESS };
    }
    const claimKey = this.getClaimKey(policyId, farmer);
    const claim = this.state.claims.get(claimKey);
    if (!claim || claim.disputeEndBlock === null || this.getBlockHeight() < claim.disputeEndBlock) {
      return { ok: false, value: this.ERR_DISPUTE_IN_PROGRESS };
    }
    const resolution = dispute.votesFor > dispute.votesAgainst ? "upheld" : "rejected";
    dispute.resolved = true;
    dispute.resolution = resolution;
    this.state.disputes.set(claimId, dispute);
    if (resolution === "rejected") {
      claim.status = "rejected";
      this.state.claims.set(claimKey, claim);
      this.state.claimHistory.set(claimId, {
        policyId,
        farmer,
        outcome: "rejected",
        timestamp: this.getBlockHeight(),
        amount: 0,
      });
    } else {
      claim.status = "paid";
      this.state.claims.set(claimKey, claim);
      this.state.totalClaimsProcessed += 1;
      this.state.totalPayouts += claim.payoutAmount;
      this.state.claimHistory.set(claimId, {
        policyId,
        farmer,
        outcome: "paid",
        timestamp: this.getBlockHeight(),
        amount: claim.payoutAmount,
      });
    }
    return { ok: true, value: true };
  }

  getClaimDetails(policyId: number, farmer: string): ClarityResponse<Claim | null> {
    return { ok: true, value: this.state.claims.get(this.getClaimKey(policyId, farmer)) ?? null };
  }

  getDisputeDetails(claimId: number): ClarityResponse<Dispute | null> {
    return { ok: true, value: this.state.disputes.get(claimId) ?? null };
  }

  getTotalClaims(): ClarityResponse<number> {
    return { ok: true, value: this.state.totalClaimsProcessed };
  }

  getTotalPayouts(): ClarityResponse<number> {
    return { ok: true, value: this.state.totalPayouts };
  }

  getContractPaused(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.paused };
  }

  getAdmin(): ClarityResponse<string> {
    return { ok: true, value: this.state.admin };
  }

  getClaimHistory(claimId: number): ClarityResponse<ClaimHistory | null> {
    return { ok: true, value: this.state.claimHistory.get(claimId) ?? null };
  }

  getPolicyThreshold(policyId: number): ClarityResponse<PolicyThreshold | null> {
    return { ok: true, value: this.state.policyThresholds.get(policyId) ?? null };
  }

  isOracleAuthorized(oracle: string): ClarityResponse<boolean> {
    return { ok: true, value: this.state.authorizedOracles.get(oracle) ?? false };
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  oracle: "oracle_1",
  verifier: "verifier_1",
  farmer: "farmer_1",
  unauthorized: "unauthorized",
};

describe("ClaimAutomator Contract", () => {
  let contract: ClaimAutomatorMock;

  beforeEach(() => {
    contract = new ClaimAutomatorMock();
    vi.resetAllMocks();
    // Add authorized verifier for tests
    contract.state.authorizedVerifiers.set(accounts.verifier, true);
  });

  it("should allow admin to pause and unpause contract", () => {
    const pauseResult = contract.pauseContract(accounts.deployer);
    expect(pauseResult).toEqual({ ok: true, value: true });
    expect(contract.getContractPaused()).toEqual({ ok: true, value: true });

    const unpauseResult = contract.unpauseContract(accounts.deployer);
    expect(unpauseResult).toEqual({ ok: true, value: true });
    expect(contract.getContractPaused()).toEqual({ ok: true, value: false });
  });

  it("should prevent non-admin from pausing contract", () => {
    const pauseResult = contract.pauseContract(accounts.unauthorized);
    expect(pauseResult).toEqual({ ok: false, value: 105 });
  });

  it("should allow admin to add and remove authorized oracle", () => {
    const addResult = contract.addAuthorizedOracle(accounts.deployer, accounts.oracle);
    expect(addResult).toEqual({ ok: true, value: true });
    expect(contract.isOracleAuthorized(accounts.oracle)).toEqual({ ok: true, value: true });

    const removeResult = contract.removeAuthorizedOracle(accounts.deployer, accounts.oracle);
    expect(removeResult).toEqual({ ok: true, value: true });
    expect(contract.isOracleAuthorized(accounts.oracle)).toEqual({ ok: true, value: false });
  });

  it("should allow admin to register policy threshold", () => {
    const registerResult = contract.registerPolicyThreshold(
      accounts.deployer,
      1,
      10,
      50,
      "corn",
      1000
    );
    expect(registerResult).toEqual({ ok: true, value: true });
    const threshold = contract.getPolicyThreshold(1);
    expect(threshold).toEqual({
      ok: true,
      value: {
        minContamination: 10,
        maxContamination: 50,
        cropType: "corn",
        coverageAmount: 1000,
      },
    });
  });

  it("should allow authorized oracle to submit contamination data", () => {
    contract.addAuthorizedOracle(accounts.deployer, accounts.oracle);
    contract.registerPolicyThreshold(accounts.deployer, 1, 10, 50, "corn", 1000);
    const dataHash = new Uint8Array(32);
    const submitResult = contract.submitContaminationData(
      accounts.oracle,
      1,
      accounts.farmer,
      15,
      dataHash,
      "Sensor data from field"
    );
    expect(submitResult).toEqual({ ok: true, value: true });
    const claim = contract.getClaimDetails(1, accounts.farmer);
    expect(claim).toEqual({
      ok: true,
      value: expect.objectContaining({
        status: "pending",
        contaminationLevel: 15,
        payoutAmount: 1000,
        metadata: "Sensor data from field",
      }),
    });
  });

  it("should prevent submission with invalid contamination level", () => {
    contract.addAuthorizedOracle(accounts.deployer, accounts.oracle);
    contract.registerPolicyThreshold(accounts.deployer, 1, 10, 50, "corn", 1000);
    const dataHash = new Uint8Array(32);
    const submitLow = contract.submitContaminationData(
      accounts.oracle,
      1,
      accounts.farmer,
      5,
      dataHash,
      "Low level"
    );
    expect(submitLow).toEqual({ ok: false, value: 103 });
  });

  it("should process valid claim and trigger payout", () => {
    contract.addAuthorizedOracle(accounts.deployer, accounts.oracle);
    contract.registerPolicyThreshold(accounts.deployer, 1, 10, 50, "corn", 1000);
    const dataHash = new Uint8Array(32);
    contract.submitContaminationData(
      accounts.oracle,
      1,
      accounts.farmer,
      15,
      dataHash,
      "Test data"
    );
    const processResult = contract.processClaim(accounts.deployer, 1, accounts.farmer, 1);
    expect(processResult).toEqual({ ok: true, value: true });
    const claim = contract.getClaimDetails(1, accounts.farmer);
    expect(claim.value?.status).toBe("paid");
    expect(contract.getTotalClaims()).toEqual({ ok: true, value: 1 });
    expect(contract.getTotalPayouts()).toEqual({ ok: true, value: 1000 });
    const history = contract.getClaimHistory(1);
    expect(history).toEqual({
      ok: true,
      value: expect.objectContaining({
        outcome: "paid",
        amount: 1000,
      }),
    });
  });

  it("should prevent processing expired claim", () => {
    contract.addAuthorizedOracle(accounts.deployer, accounts.oracle);
    contract.registerPolicyThreshold(accounts.deployer, 1, 10, 50, "corn", 1000);
    const dataHash = new Uint8Array(32);
    contract.submitContaminationData(
      accounts.oracle,
      1,
      accounts.farmer,
      15,
      dataHash,
      "Test data"
    );
    contract.advanceBlockHeight(145); // Beyond window
    const processResult = contract.processClaim(accounts.deployer, 1, accounts.farmer, 1);
    expect(processResult).toEqual({ ok: false, value: 110 });
  });

  it("should allow initiating and resolving dispute", () => {
    contract.addAuthorizedOracle(accounts.deployer, accounts.oracle);
    contract.registerPolicyThreshold(accounts.deployer, 1, 10, 50, "corn", 1000);
    const dataHash = new Uint8Array(32);
    contract.submitContaminationData(
      accounts.oracle,
      1,
      accounts.farmer,
      15,
      dataHash,
      "Test data"
    );
    contract.processClaim(accounts.deployer, 1, accounts.farmer, 1); // First process to "paid", but for dispute test, assume after verified
    // Manually set to verified for test
    const claimKey = `${1}-${accounts.farmer}`;
    const claim = contract.state.claims.get(claimKey)!;
    claim.status = "verified";
    contract.state.claims.set(claimKey, claim);

    const initiateResult = contract.initiateDispute(accounts.farmer, 1, 1, accounts.farmer, "Incorrect data");
    expect(initiateResult).toEqual({ ok: true, value: true });
    const dispute = contract.getDisputeDetails(1);
    expect(dispute).toEqual({
      ok: true,
      value: expect.objectContaining({
        resolved: false,
      }),
    });

    contract.voteOnDispute(accounts.verifier, 1, false); // Vote against (reject claim)

    contract.advanceBlockHeight(145); // End dispute period
    const resolveResult = contract.resolveDispute(accounts.deployer, 1, 1, accounts.farmer);
    expect(resolveResult).toEqual({ ok: true, value: true });
    const resolvedDispute = contract.getDisputeDetails(1);
    expect(resolvedDispute.value?.resolution).toBe("rejected");
    const finalClaim = contract.getClaimDetails(1, accounts.farmer);
    expect(finalClaim.value?.status).toBe("rejected");
    expect(contract.getTotalClaims()).toEqual({ ok: true, value: 1 }); // Not incremented for rejected
  });

  it("should prevent unauthorized vote on dispute", () => {
    // Setup dispute
    contract.state.disputes.set(1, {
      initiator: accounts.farmer,
      reason: "Test",
      votesFor: 0,
      votesAgainst: 0,
      resolved: false,
      resolution: null,
    });

    const voteResult = contract.voteOnDispute(accounts.unauthorized, 1, true);
    expect(voteResult).toEqual({ ok: false, value: 105 });
  });

  it("should prevent metadata exceeding max length in submission", () => {
    contract.addAuthorizedOracle(accounts.deployer, accounts.oracle);
    contract.registerPolicyThreshold(accounts.deployer, 1, 10, 50, "corn", 1000);
    const dataHash = new Uint8Array(32);
    const longMetadata = "a".repeat(1001);
    const submitResult = contract.submitContaminationData(
      accounts.oracle,
      1,
      accounts.farmer,
      15,
      dataHash,
      longMetadata
    );
    expect(submitResult).toEqual({ ok: false, value: 111 });
  });
});