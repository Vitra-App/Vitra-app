import { SignedDataVerifier, Environment } from '@apple/app-store-server-library';
import fs from 'node:fs';
import path from 'node:path';

// Your app's bundle identifier — must match `PRODUCT_BUNDLE_IDENTIFIER` in the iOS project.
const BUNDLE_ID = process.env.APPLE_BUNDLE_ID || 'com.michaelalexandrou.vitra';

// Apple's App-Specific Shared Secret is NOT required for StoreKit2 JWS verification —
// transactions are signed by Apple and verified offline against Apple's root CA chain.
const rootCert = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/apple-root-certs/AppleRootCA-G3.cer')
);

let productionVerifier: SignedDataVerifier | null = null;
let sandboxVerifier: SignedDataVerifier | null = null;

function getVerifier(environment: Environment): SignedDataVerifier {
  if (environment === Environment.PRODUCTION) {
    if (!productionVerifier) {
      productionVerifier = new SignedDataVerifier(
        [rootCert], false, Environment.PRODUCTION, BUNDLE_ID
      );
    }
    return productionVerifier;
  }
  if (!sandboxVerifier) {
    sandboxVerifier = new SignedDataVerifier(
      [rootCert], false, Environment.SANDBOX, BUNDLE_ID
    );
  }
  return sandboxVerifier;
}

export interface VerifiedTransaction {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  purchaseDate: Date;
  expiresDate: Date | null;
  isTrialPeriod: boolean;
  environment: 'Sandbox' | 'Production';
  revocationDate: Date | null;
}

/**
 * Verifies a StoreKit2 signed transaction (the base64 JWS string returned by
 * `Transaction.jwsRepresentation` on-device) and returns its decoded, trusted payload.
 * Throws if the signature/chain is invalid or the transaction doesn't belong to this app.
 *
 * Tries Production first, then falls back to Sandbox. This is required once the app is live:
 * real App Store customers' transactions are signed for Production, but TestFlight testers'
 * transactions (and Apple's own App Review testing) are ALWAYS signed for Sandbox — both flows
 * hit this exact same backend endpoint, so a verifier pinned to a single environment via a
 * static env var would permanently break one or the other. Apple's own App Store Server Library
 * docs recommend exactly this "try Production, fall back to Sandbox" pattern for a single
 * shared verification endpoint.
 */
export async function verifySignedTransaction(jws: string): Promise<VerifiedTransaction> {
  let decoded;
  try {
    decoded = await getVerifier(Environment.PRODUCTION).verifyAndDecodeTransaction(jws);
  } catch (productionError) {
    try {
      decoded = await getVerifier(Environment.SANDBOX).verifyAndDecodeTransaction(jws);
    } catch (sandboxError) {
      throw new Error(
        `Transaction failed verification in both Production and Sandbox. ` +
        `Production error: ${(productionError as Error).message}. ` +
        `Sandbox error: ${(sandboxError as Error).message}.`
      );
    }
  }

  if (decoded.bundleId !== BUNDLE_ID) {
    throw new Error(`Transaction bundleId mismatch: ${decoded.bundleId}`);
  }
  if (!decoded.transactionId || !decoded.productId) {
    throw new Error('Malformed transaction payload');
  }

  return {
    transactionId: decoded.transactionId,
    originalTransactionId: decoded.originalTransactionId ?? decoded.transactionId,
    productId: decoded.productId,
    purchaseDate: decoded.purchaseDate ? new Date(Number(decoded.purchaseDate)) : new Date(),
    expiresDate: decoded.expiresDate ? new Date(Number(decoded.expiresDate)) : null,
    isTrialPeriod: decoded.offerType === 1, // 1 = introductory offer
    environment: decoded.environment === Environment.PRODUCTION ? 'Production' : 'Sandbox',
    revocationDate: decoded.revocationDate ? new Date(Number(decoded.revocationDate)) : null,
  };
}

/** Product IDs configured in App Store Connect — must match `StoreKitService.swift`. */
export const IAP_PRODUCT_IDS = {
  proMonthly: 'com.vitra.pro.monthly',
  proYearly: 'com.vitra.pro.annual',
} as const;

export function isProProductId(productId: string): boolean {
  return Object.values(IAP_PRODUCT_IDS).includes(productId as any);
}
