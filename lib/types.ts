export type DataMode = "LIVE" | "CACHED" | "DEMO" | "UNAVAILABLE";

export type Evidence = {
  id: string;
  label: string;
  value: string | number | boolean;
  source: "rpc" | "jupiter" | "derived";
  method: string;
  observedAt: string;
  explorerUrl?: string;
};

export type RiskFactor = {
  name: string;
  weight: number;
  severity: number;
  contribution: number;
  value: string;
  evidenceIds: string[];
  source: DataMode;
};

export type Verdict = {
  score: number;
  band: "Low signals" | "Moderate" | "Elevated" | "High" | "Insufficient data";
  confidence: number;
  coverage: number;
  factors: RiskFactor[];
  criticalFlags: string[];
  unknowns: string[];
  methodVersion: "pulse-risk/1";
};

export type Investigation = {
  mint: string;
  name: string;
  symbol: string;
  mode: DataMode;
  observedAt: string;
  evidenceHash: string;
  evidence: Evidence[];
  verdict: Verdict;
  ai: {
    label: string;
    summary: string;
    findings: { severity: "high" | "medium" | "low"; headline: string; explanation: string; evidenceIds: string[] }[];
    unknowns: string[];
  };
  exitLadder: {
    size: string;
    output: string;
    impact: string;
    status: "quoted" | "no route" | "demo";
  }[];
};
