// Isolated PostgreSQL integration tests: no connection to the hosted database.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const db = new PGlite();
const actor = '00000000-0000-4000-8000-000000000001';
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const rate = { rateMicros: '1500000000', sourceUrl: 'https://example.test/rates', updatedAt: null, isFallback: false };
async function scalar(sql, params=[]) { return (await db.query(sql,params)).rows[0]; }
async function rejects(sql, params=[]) { await assert.rejects(db.query(sql,params)); }
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create table public.scouter_withdrawal_proofs (
 id uuid primary key, account_id bigint not null, amount_stroops bigint,
 status text not null default 'confirmed', chain_verified_at timestamptz default now(),
 payout_status text not null default 'unpaid', paid_at timestamptz, paid_by uuid,
 payout_scouter_share_stroops bigint, payout_exchange_rate_micros bigint, payout_amount_kobo bigint,
 payout_rate_source text, payout_rate_updated_at timestamptz, payout_rate_is_fallback boolean
);
alter table public.scouter_withdrawal_proofs enable row level security;
grant select,insert,update,delete on public.scouter_withdrawal_proofs to service_role;
`);
await db.exec(readFileSync(new URL('../supabase/migrations/20261015194741_wave10_referrals_minimal.sql', import.meta.url), 'utf8'));
await db.exec('set role service_role');
await db.exec('insert into wave10_referral_codes(account_id) values(1),(2),(3),(4)');
const referral = (from,to,date='2026-10-15T10:00:00Z') => db.query('insert into wave10_referrals(referrer_id,referee_id,source,referred_at,recorded_by) values($1,$2,\'manual\',$3,$4)',[from,to,date,actor]);
await assert.rejects(referral(1,1));
await assert.rejects(referral(1,2,'2026-10-22T23:00:00Z'));
await referral(1,2);
await assert.rejects(referral(3,2));
for (const [n,account,status] of [[10,1,'confirmed'],[11,2,'confirmed'],[12,1,'confirmed'],[13,3,'pending'],[14,4,'confirmed'],[15,1,'confirmed']]) {
 await db.query('insert into scouter_withdrawal_proofs(id,account_id,amount_stroops,status) values($1,$2,1000000000,$3)',[id(n),account,status]);
}
const tag = (n) => db.query('select wave10_tag_proof($1,$2)',[id(n),actor]);
const pay = (n,amount) => db.query('select wave10_record_payout($1,$2,$3,$4)',[id(n),actor,amount,rate]);
await assert.rejects(tag(13));
await tag(10);
assert.equal((await scalar('select wave10_eligible(1) eligible')).eligible,false);
await pay(10,'600000000'); // Pay before referee qualifies.
const before = await scalar('select * from scouter_withdrawal_proofs where id=$1',[id(10)]);
await tag(11);
assert.equal((await scalar('select wave10_eligible(1) eligible')).eligible,true);
await assert.rejects(pay(10,'700000000')); // Stale full-payment dialog.
await pay(10,'100000000'); // Only late bonus.
assert.deepEqual(await scalar('select * from scouter_withdrawal_proofs where id=$1',[id(10)]),before);
await assert.rejects(pay(10,'100000000'));
await tag(12);
await referral(1,4); await tag(14); // Second referral does not stack.
await pay(12,'700000000');
const payment = await scalar('select amount_stroops,amount_kobo from wave10_bonus_payments where proof_id=$1',[id(12)]);
assert.equal(String(payment.amount_stroops),'100000000');
assert.equal(String(payment.amount_kobo),'1500000');
await assert.rejects(pay(15,'700000000')); // Untagged historical earnings.
await rejects("update scouter_withdrawal_proofs set status='rejected',payout_status='unpaid' where id=$1",[id(10)]);
await rejects("update scouter_withdrawal_proofs set status='rejected' where id=$1",[id(11)]);
await rejects('delete from wave10_referrals where referee_id=2');
await rejects('delete from wave10_proofs where proof_id=$1',[id(11)]);
await rejects('update wave10_bonus_payments set amount_stroops=1');
// Revoking an unpaid qualification immediately removes eligibility.
await referral(3,1);
assert.equal((await scalar('select wave10_eligible(3) eligible')).eligible,true);
await db.query('delete from wave10_referrals where referee_id=1');
assert.equal((await scalar('select wave10_eligible(3) eligible')).eligible,false);
for (const role of ['anon','authenticated']) {
 await db.exec(`reset role; set role ${role}`);
 for (const table of ['wave10_referral_codes','wave10_referrals','wave10_proofs','wave10_bonus_payments']) {
  await rejects(`select * from ${table}`);
  await rejects(`delete from ${table}`);
 }
 await rejects('select wave10_eligible(1)');
 await rejects('select wave10_tag_proof($1,$2)',[id(15),actor]);
 await assert.rejects(pay(15,'700000000'));
}
await db.close();
console.log('PASS: Wave 10 attribution, cutoff, qualification, no stacking, full/late payout, stale/duplicate payment, snapshot preservation and role isolation.');
