// Tells savage's payment pool that an invoice was paid, so the person who
// sent it earns a nineum (savage/CLAUDE.md, "The payment pool").
//
// Only called once a payout has actually been sent, which payOutCreator only
// does after Stripe confirms the charge succeeded: /complete on its own just
// trusts the payer's browser, and a nineum must not be mintable by
// "completing" your own invoice.
//
// Signed with a reporter key of its own (POOL_REPORTER_PRIVATE_KEY and
// _PUBLIC_KEY), not eumachia's payment identity, which can be reset and
// re-minted; savage lists the public key in POOL_REPORTERS. POOL_URL is
// savage's base, e.g. http://127.0.0.1:3012/. Unset, nothing is reported.

import sessionless from 'sessionless-node';
import identity from '../identity/identity.js';

const isPubKey = (v) => typeof v === 'string' && /^0[23][0-9a-f]{64}$/i.test(v);

export async function reportPurchase(invoiceUuid, invoice) {
  const poolUrl = process.env.POOL_URL;
  const privateKey = process.env.POOL_REPORTER_PRIVATE_KEY;
  const pubKey = process.env.POOL_REPORTER_PUBLIC_KEY;
  const member = invoice?.creatorFountPubKey;
  if (!poolUrl || !privateKey || !pubKey || !isPubKey(member)) return;

  const timestamp = `${Date.now()}`;
  sessionless.getKeys = () => ({ privateKey, pubKey });
  let signature;
  try {
    signature = await sessionless.sign(timestamp + invoiceUuid + member);
  } finally {
    // sessionless has one shared key slot; give it back (see identity.js).
    identity.claimIdentity();
  }
  const res = await fetch(new URL('pool/purchase', poolUrl.endsWith('/') ? poolUrl : `${poolUrl}/`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoice: invoiceUuid, member, reporter: pubKey, timestamp, signature }),
  });
  if (!res.ok) throw new Error(`pool answered ${res.status}`);
}
