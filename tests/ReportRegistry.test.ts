import { describe, it, expect, beforeEach } from "vitest";
import { ClarityValue, bufferCV, stringUtf8CV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_HASH = 101;
const ERR_INVALID_TITLE = 102;
const ERR_INVALID_DESC = 103;
const ERR_REPORT_ALREADY_EXISTS = 104;
const ERR_REPORT_NOT_FOUND = 105;
const ERR_INVALID_TIMESTAMP = 106;
const ERR_AUTHORITY_NOT_VERIFIED = 107;
const ERR_INVALID_STAKE = 108;
const ERR_MAX_REPORTS_EXCEEDED = 109;
const ERR_INVALID_STATUS = 110;

interface Report {
  reportHash: Buffer;
  title: string;
  description: string;
  timestamp: number;
  submitter: string;
  status: string;
  stakeAmount: number;
}

interface ReportUpdate {
  updateTitle: string;
  updateDescription: string;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class ReportRegistryMock {
  state: {
    reportCounter: number;
    maxReports: number;
    submissionFee: number;
    authorityContract: string | null;
    reports: Map<number, Report>;
    reportsByHash: Map<string, number>;
    reportUpdates: Map<number, ReportUpdate>;
  } = {
    reportCounter: 0,
    maxReports: 10000,
    submissionFee: 500,
    authorityContract: null,
    reports: new Map(),
    reportsByHash: new Map(),
    reportUpdates: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  reset() {
    this.state = {
      reportCounter: 0,
      maxReports: 10000,
      submissionFee: 500,
      authorityContract: null,
      reports: new Map(),
      reportsByHash: new Map(),
      reportUpdates: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.authorityContract !== null) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setSubmissionFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    if (newFee < 0) return { ok: false, value: ERR_INVALID_STAKE };
    this.state.submissionFee = newFee;
    return { ok: true, value: true };
  }

  setMaxReports(newMax: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    if (newMax <= 0) return { ok: false, value: ERR_MAX_REPORTS_EXCEEDED };
    this.state.maxReports = newMax;
    return { ok: true, value: true };
  }

  submitReport(reportHash: Buffer, title: string, description: string, stakeAmount: number): Result<number> {
    if (this.state.reportCounter >= this.state.maxReports) return { ok: false, value: ERR_MAX_REPORTS_EXCEEDED };
    if (reportHash.length === 0) return { ok: false, value: ERR_INVALID_HASH };
    if (!title || title.length > 100) return { ok: false, value: ERR_INVALID_TITLE };
    if (!description || description.length > 500) return { ok: false, value: ERR_INVALID_DESC };
    if (stakeAmount < 0) return { ok: false, value: ERR_INVALID_STAKE };
    if (this.state.reportsByHash.has(reportHash.toString("hex"))) return { ok: false, value: ERR_REPORT_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.submissionFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.reportCounter;
    const report: Report = { reportHash, title, description, timestamp: this.blockHeight, submitter: this.caller, status: "pending", stakeAmount };
    this.state.reports.set(id, report);
    this.state.reportsByHash.set(reportHash.toString("hex"), id);
    this.state.reportCounter++;
    return { ok: true, value: id };
  }

  updateReport(id: number, updateTitle: string, updateDescription: string): Result<boolean> {
    const report = this.state.reports.get(id);
    if (!report) return { ok: false, value: ERR_REPORT_NOT_FOUND };
    if (report.submitter !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!updateTitle || updateTitle.length > 100) return { ok: false, value: ERR_INVALID_TITLE };
    if (!updateDescription || updateDescription.length > 500) return { ok: false, value: ERR_INVALID_DESC };

    const updated: Report = { ...report, title: updateTitle, description: updateDescription, timestamp: this.blockHeight };
    this.state.reports.set(id, updated);
    this.state.reportUpdates.set(id, { updateTitle, updateDescription, updateTimestamp: this.blockHeight, updater: this.caller });
    return { ok: true, value: true };
  }

  updateReportStatus(id: number, newStatus: string): Result<boolean> {
    const report = this.state.reports.get(id);
    if (!report) return { ok: false, value: ERR_REPORT_NOT_FOUND };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    if (!["pending", "verified", "rejected"].includes(newStatus)) return { ok: false, value: ERR_INVALID_STATUS };

    const updated: Report = { ...report, status: newStatus, timestamp: this.blockHeight };
    this.state.reports.set(id, updated);
    return { ok: true, value: true };
  }

  getReport(id: number): Report | null {
    return this.state.reports.get(id) || null;
  }

  getReportCount(): Result<number> {
    return { ok: true, value: this.state.reportCounter };
  }
}

describe("ReportRegistry", () => {
  let contract: ReportRegistryMock;

  beforeEach(() => {
    contract = new ReportRegistryMock();
    contract.reset();
  });

  it("submits a report successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = Buffer.from("a".repeat(32));
    const result = contract.submitReport(hash, "Report1", "Description1", 100);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const report = contract.getReport(0);
    expect(report?.reportHash).toEqual(hash);
    expect(report?.title).toBe("Report1");
    expect(report?.description).toBe("Description1");
    expect(report?.status).toBe("pending");
    expect(report?.stakeAmount).toBe(100);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate report hash", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = Buffer.from("a".repeat(32));
    contract.submitReport(hash, "Report1", "Description1", 100);
    const result = contract.submitReport(hash, "Report2", "Description2", 200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_REPORT_ALREADY_EXISTS);
  });

  it("rejects non-authorized update", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitReport(Buffer.from("a".repeat(32)), "Report1", "Description1", 100);
    contract.caller = "ST3FAKE";
    const result = contract.updateReport(0, "NewTitle", "NewDescription");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("updates report successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitReport(Buffer.from("a".repeat(32)), "Report1", "Description1", 100);
    const result = contract.updateReport(0, "NewTitle", "NewDescription");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const report = contract.getReport(0);
    expect(report?.title).toBe("NewTitle");
    expect(report?.description).toBe("NewDescription");
  });

  it("updates report status successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitReport(Buffer.from("a".repeat(32)), "Report1", "Description1", 100);
    const result = contract.updateReportStatus(0, "verified");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const report = contract.getReport(0);
    expect(report?.status).toBe("verified");
  });

  it("rejects invalid hash", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.submitReport(Buffer.from(""), "Report1", "Description1", 100);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_HASH);
  });

  it("rejects invalid title", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.submitReport(Buffer.from("a".repeat(32)), "", "Description1", 100);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TITLE);
  });

  it("rejects invalid status", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitReport(Buffer.from("a".repeat(32)), "Report1", "Description1", 100);
    const result = contract.updateReportStatus(0, "invalid");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_STATUS);
  });

  it("sets submission fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setSubmissionFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.submissionFee).toBe(1000);
  });

  it("rejects submission without authority contract", () => {
    const result = contract.submitReport(Buffer.from("a".repeat(32)), "Report1", "Description1", 100);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });
});