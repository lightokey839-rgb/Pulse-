export type DataMode = "LIVE" | "CACHED" | "UNAVAILABLE";
export type Source = "rpc" | "jupiter" | "derived";

export type Evidence = {
  id: string;
  label: string;
  value: string | number | boolean | null;
  source: Source;
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
  source: Source;
};

export type Band = "Low signals" | "Moderate" | "Elevated" | "High" | "Insufficient data";

export type Verdict = {
  score: number;
  band: Band;
  limitedData: boolean;
  confidence: number;
  coverage: number;
  factors: RiskFactor[];
  criticalFlags: string[];
  unknowns: string[];
  disagreements: string[];
  methodVersion: "pulse-risk/2";
};

export type Finding = {
  severity: "high" | "medium" | "low";
  headline: string;
  explanation: string;
  evidenceIds: string[];
};

export type AiBrief = {
  label: "AI analyst (verified)" | "Rule-based explanation";
  model?: string;
  summary: string;
  findings: Finding[];
  unknowns: string[];
  beginnerNote: string;
  removedClaims: number;
  note?: string;
};

export type LadderRung = {
  sizeUsd: number;
  status: "quoted" | "no route" | "curve only" | "unavailable";
  outputUsd?: number;
  impactPct?: number;
  feeBps?: number;
  router?: string;
  route?: string;
  evidenceId: string;
};

export type RadarToken = {
  mint: string;
  name: string;
  symbol: string;
  icon?: string;
  launchpad?: string;
  ageMinutes: number | null;
  mcap?: number;
  liquidity?: number;
  holderCount?: number;
  priceChange1h?: number;
  organicScoreLabel?: string;
  creatorLaunches?: number;
  authoritiesOff?: boolean;
  quick:{ label: string; tone: "ok" | "warn" | "bad" }[];
};

export type Dossier = {
  mint: string;
  name: string;
  symbol: string;
  icon?: string;
  launchpad?: string;
  tokenProgram?: string;
  mode: DataMode;
  observedAt: string;
  evidenceHash: string;
  evidence: Evidence[];
  verdict: Verdict;
  ladder: LadderRung[];
  trace: { step: string; source: string; ms: number; status: "ok" | "unavailable" }[];
  jupiterUrl: string;
  seal?: { value: string; issuedAt: number };
};
