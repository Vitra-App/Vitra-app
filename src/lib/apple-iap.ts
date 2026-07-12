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

let verifier: SignedDataVerifier | null = null;

function getVerifier(): SignedDataVerifier {
  if (verifier) return verifier;
  const isProduction = process.env.APPLE_IAP_ENVIRONMENT !== 'sandbox';
  verifier = new SignedDataVerifier(
    [rootCert],
    // enableOnlineChecks=false: we don't call Apple's API to check revocation, keeping this
    // fully self-contained (no App Store Connect API key needed to get started). Can be
    // flipped on later once APPLE_APP_APPLE_ID + private key are configured.
    false,
    isProduction ? Environment.PRODUCTION : Environment.SANDBOX,
    BUNDLE_ID
  );
  return verifier;
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
 */
export async function verifySignedTransaction(jws: string): Promise<VerifiedTransaction> {
  const decoded = await getVerifier().verifyAndDecodeTransaction(jws);

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
  proYearly: 'com.vitra.pro.yearly',
} as const;

export function isProProductId(productId: string): boolean {
  return Object.values(IAP_PRODUCT_IDS).includes(productId as any);
}
