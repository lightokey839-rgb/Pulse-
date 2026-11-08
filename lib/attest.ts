// Writes Pulse receipts to Solana as Memo transactions, signed by the server's attestor key.
// Server-only. The key comes from ATTESTOR_SECRET_KEY and is never logged.
import {
  appendTransactionMessageInstruction,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { getAddMemoInstruction } from "@solana-program/memo";
import { attestCluster, attestorSecret, attestRpcUrl, explorerTx } from "./attest-config";
import { formatReceipt, type Receipt } from "./receipt";

export type AttestResult = { signature: string; memo: string; explorerUrl: string; cluster: string; status: "confirmed" | "submitted" };

const MIN_LAMPORTS = 10_000; // a memo transaction costs about 5,000 lamports

export async function writeReceipt(r: Omit<Receipt, "cluster" | "time">): Promise<AttestResult> {
  const secret = attestorSecret();
  if (!secret) throw new AttestError("Receipt unavailable: no attestor key is configured.", 503);
  const signer = await createKeyPairSignerFromBytes(secret);
  const rpc = createSolanaRpc(attestRpcUrl());

  const { value: balance } = await rpc.getBalance(signer.address, { commitment: "confirmed" }).send();
  if (Number(balance) < MIN_LAMPORTS) throw new AttestError(`Receipt unavailable: the attestor wallet needs ${attestCluster()} SOL. Fund ${signer.address}.`, 503);

  const memo = formatReceipt({ ...r, cluster: attestCluster(), time: Math.floor(Date.now() / 1000) });
  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstruction(getAddMemoInstruction({ memo }), m),
  );
  const signed = await signTransactionMessageWithSigners(message);
  const signature = getSignatureFromTransaction(signed);
  await rpc.sendTransaction(getBase64EncodedWireTransaction(signed), { encoding: "base64", preflightCommitment: "confirmed" }).send();

  // Poll for confirmation for up to ~20 s; report "submitted" if it has not confirmed yet.
  for (let i = 0; i < 20; i++) {
    await new Promise((res) => setTimeout(res, 1000));
    const { value } = await rpc.getSignatureStatuses([signature]).send();
    const st = value[0];
    if (st?.err) throw new AttestError("The receipt transaction failed on chain.", 502);
    if (st && (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized")) {
      return { signature, memo, explorerUrl: explorerTx(signature), cluster: attestCluster(), status: "confirmed" };
    }
  }
  return { signature, memo, explorerUrl: explorerTx(signature), cluster: attestCluster(), status: "submitted" };
}

export class AttestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}
