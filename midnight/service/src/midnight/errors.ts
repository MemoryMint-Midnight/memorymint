export class TxTimeoutError extends Error {
  readonly txHash?: string;
  constructor(message: string, txHash?: string) {
    super(message);
    this.name = 'TxTimeoutError';
    this.txHash = txHash;
  }
}

export class ProofError extends Error {
  readonly circuit: string;
  constructor(circuit: string, detail: string) {
    super(`Proof assertion failed in "${circuit}": ${detail}`);
    this.name = 'ProofError';
    this.circuit = circuit;
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class WalletError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletError';
  }
}

export function classifyError(err: unknown, circuit = 'unknown'): Error {
  if (
    err instanceof TxTimeoutError ||
    err instanceof ProofError ||
    err instanceof NetworkError ||
    err instanceof WalletError
  ) return err;

  const msg = err instanceof Error ? err.message : String(err);
  const low = msg.toLowerCase();

  if (low.includes('assertion failed') || low.includes('assert') ||
      low.includes('proof failed') || low.includes('constraint')) {
    return new ProofError(circuit, msg);
  }
  if (low.includes('econnrefused') || low.includes('etimedout') ||
      low.includes('websocket') || low.includes('fetch failed') ||
      low.includes('enotfound')) {
    return new NetworkError(msg);
  }
  if (low.includes('dust') || low.includes('insufficient') ||
      low.includes('balance') || low.includes('wallet sync')) {
    return new WalletError(msg);
  }

  return err instanceof Error ? err : new Error(msg);
}
