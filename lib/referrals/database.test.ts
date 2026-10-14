import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;
let legacySnapshot: Record<string, unknown>;
const actor = "00000000-0000-4000-8000-000000000099";
const wave = "00000000-0000-4000-8000-000000000010";
const referral = "00000000-0000-4000-8000-000000000020";
const claim = "00000000-0000-4000-8000-000000000030";
const issue = "00000000-0000-4000-8000-000000000040";
const payment = "00000000-0000-4000-8000-000000000050";
async function scalar(sql: string, params: unknown[] = []) { return (await db.query<Record<string, unknown>>(sql, params)).rows[0]; }
async function qualify(status = "qualified") {
  return db.query("select public.review_referral($1,$2,$3,$4,$5,$6)", [actor, referral, status, "Verified accepted contribution by the assigned Scouter", 123, { contributionVerified: true }]);
}
async function pay(balance = "600000000", percent = "60", requestId = payment) {
  return db.query("select public.record_earning_payment($1,$2,$3)", [actor, claim, { action: "payout", requestId, rateMicros: "1330390000", rateSource: "test", rateUpdatedAt: null, rateIsFallback: false, expectedBalance: balance, expectedPercent: percent }]);
}
async function balance() { return scalar("select share_percent,entitlement_stroops,paid_total_stroops,balance_stroops,paid_total_kobo from public.scouter_earning_balances where id=$1", [claim]); }

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,created_at timestamptz default now());
    create table auth.identities(user_id uuid,provider text,identity_data jsonb,created_at timestamptz default now());
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  const files = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort();
  for (const file of files) {
    if (file.includes('referrals_and_waves')) {
      // Hosted Supabase grants new tables/views to API roles by default.
      await db.exec('alter default privileges in schema public grant all on tables to anon, authenticated, service_role');
      await db.exec(`insert into public.scouter_profiles(account_id,account_login) values(77,'legacy');
        insert into public.scouter_withdrawal_proofs(account_id,storage_path,filename,status,amount_stroops,payout_status,paid_at,paid_by,payout_scouter_share_stroops,payout_exchange_rate_micros,payout_amount_kobo,payout_rate_source,payout_rate_is_fallback)
        values(77,'legacy-proof','proof.png','confirmed',1000000000,'paid',now(),'${actor}',600000000,1200000000,7200000,'historical',false);`);
    }
    const sql = readFileSync(`supabase/migrations/${file}`, "utf8").replace("create extension if not exists pgcrypto;", "");
    await db.exec(sql);
  }
  legacySnapshot = await scalar("select wave_id,share_percent,paid_total_stroops,paid_total_kobo,balance_stroops from public.scouter_earning_balances where account_id=77");
});
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec(`truncate public.earning_payments,public.referral_audit,public.referrals,public.referral_intents,public.referral_codes,public.scouter_members,public.scouter_withdrawal_proofs,public.scouter_profiles,public.waves,public.issues,public.issue_assignments,public.github_installations cascade;
    insert into public.waves(id,name,status,starts_at,ends_at,qualification_deadline) values('${wave}','Wave 10','active',now()-interval '2 days',now()+interval '1 day',now()+interval '2 days');
    insert into public.scouter_members(account_id,account_login) values(1,'referrer'),(2,'contributor');
    insert into public.scouter_profiles(account_id,account_login) values(1,'referrer'),(2,'contributor');
    insert into public.referrals(id,referrer_account_id,referred_account_id,wave_id,joined_at) values('${referral}',1,2,'${wave}',now()-interval '1 day');
    insert into public.github_installations(installation_id,account_id,account_login,account_type) values(2,2,'contributor','User');
    insert into public.issues(id,github_issue_id,github_issue_number,title,state,closed_at) values('${issue}',123,1,'Completed task','closed',now()-interval '1 hour');
    insert into public.issue_assignments(issue_id,assignee_account_id,assignee_login) values('${issue}',2,'contributor');
    insert into public.scouter_withdrawal_proofs(id,account_id,storage_path,filename,status,amount_stroops,wave_id) values('${claim}',1,'proof1','proof.png','confirmed',1000000000,'${wave}');`);
});

describe("wave and referral database invariants", () => {
  it("imports historical paid amounts without assigning them to Wave 10", () => {
    expect(legacySnapshot).toEqual({ wave_id: null, share_percent: 60, paid_total_stroops: "600000000", paid_total_kobo: "7200000", balance_stroops: "0" });
  });
  it("qualifies completed assigned work and changes only the referrer's wave", async () => {
    await qualify();
    expect(await balance()).toMatchObject({ share_percent: 70, entitlement_stroops: "700000000", balance_stroops: "700000000" });
    await db.exec(`insert into public.scouter_withdrawal_proofs(account_id,storage_path,filename,status,amount_stroops,wave_id) values(2,'proof2','proof.png','confirmed',1000000000,'${wave}')`);
    expect(await scalar("select share_percent from public.scouter_earning_balances where account_id=2")).toEqual({ share_percent: 60 });
    await db.exec(`update public.waves set status='settling' where id='${wave}'; insert into public.waves(name,status,starts_at,ends_at,qualification_deadline) values('Wave 11','active',now()-interval '1 hour',now()+interval '1 day',now()+interval '2 days');
      insert into public.scouter_withdrawal_proofs(account_id,storage_path,filename,status,amount_stroops,wave_id) select 1,'proof3','proof.png','confirmed',1000000000,id from public.waves where name='Wave 11'`);
    expect(await scalar("select share_percent from public.scouter_earning_balances where storage_path='proof3'")).toEqual({ share_percent: 60 });
  });
  it("rejects signup-only activity, unassigned work and false contribution confirmation", async () => {
    await expect(db.query("select public.review_referral($1,$2,'qualified',$3,123,'{}')", [actor, referral, "Completed work needs verification"])).rejects.toThrow("Verify the Scouter");
    await db.exec("update public.issues set state='open'");
    await expect(qualify()).rejects.toThrow("assigned issue completed");
    await db.exec("update public.issues set state='closed'; delete from public.issue_assignments");
    await expect(qualify()).rejects.toThrow("assigned issue completed");
  });
  it("keeps a wave benefit if another valid referral remains", async () => {
    await qualify();
    await db.exec(`insert into public.scouter_members(account_id,account_login) values(3,'another');
      insert into public.referrals(referrer_account_id,referred_account_id,wave_id,status,reviewed_by,reviewed_at,reason)
      values(1,3,'${wave}','qualified','${actor}',now(),'Verified another completed contribution');`);
    expect((await balance()).share_percent).toBe(70);
    await qualify("revoked");
    expect((await balance()).share_percent).toBe(70);
  });
  it("rejects expired intents, changed waves, and old Auth accounts", async () => {
    const code = '00000000-0000-4000-8000-000000000060';
    const intent = '00000000-0000-4000-8000-000000000061';
    await db.exec(`insert into public.referral_codes(account_id,code) values(1,'${code}');
      insert into public.referral_intents(id,code,wave_id,expires_at) values('${intent}','${code}','${wave}',now()-interval '1 minute')`);
    const call = (created: string) => scalar("select public.complete_referral_signup(3,'newcomer',$1,$2,$3) as result", [actor, created, intent]);
    expect(await call(new Date().toISOString())).toEqual({ result: 'expired' });
    await db.exec(`update public.referral_intents set expires_at=now()+interval '1 hour'; update public.waves set status='settling'`);
    expect(await call(new Date().toISOString())).toEqual({ result: 'wave_changed' });
    await db.exec(`update public.waves set status='active'`);
    expect(await call('2020-01-01T00:00:00Z')).toEqual({ result: 'existing' });
    expect(await scalar("select count(*)::int as count from public.scouter_members where account_id=3")).toEqual({ count: 0 });
  });
  it("requires resolving pending referrals before closing and freezes closed-wave qualification", async () => {
    await db.query("select public.manage_wave($1,$2)", [actor, { id: wave, status: 'settling' }]);
    await expect(db.query("select public.manage_wave($1,$2)", [actor, { id: wave, status: 'closed' }])).rejects.toThrow('pending referrals');
    await qualify();
    await db.query("select public.manage_wave($1,$2)", [actor, { id: wave, status: 'closed' }]);
    await expect(qualify('revoked')).rejects.toThrow('wave is closed');
  });
  it("rate limits referral signup attempts and denies mutation of payment history", async () => {
    await db.exec("insert into public.referral_codes(account_id,code) values(1,'00000000-0000-4000-8000-000000000060')");
    for (let i=0;i<20;i++) await db.query("select public.create_referral_intent($1,'visitor')", ['00000000-0000-4000-8000-000000000060']);
    await expect(db.query("select public.create_referral_intent($1,'visitor')", ['00000000-0000-4000-8000-000000000060'])).rejects.toThrow('Too many signup attempts');
    await pay(); await db.exec('set role service_role');
    try {
      await expect(db.exec('update public.earning_payments set amount_stroops=1')).rejects.toThrow('permission denied');
      await expect(db.exec('delete from public.earning_payments')).rejects.toThrow('permission denied');
      await expect(db.exec('truncate public.referral_audit')).rejects.toThrow('permission denied');
      await expect(db.exec('delete from public.earning_payment_history')).rejects.toThrow('permission denied');
    }
    finally { await db.exec('reset role'); }
  });
  it("allows audited extensions but rejects shortening or overlapping another wave", async () => {
    const end = new Date(Date.now() + 3*86400000).toISOString();
    const deadline = new Date(Date.now() + 4*86400000).toISOString();
    await db.query("select public.manage_wave($1,$2)", [actor, { id: wave, operation: 'extend', ends_at: end, qualification_deadline: deadline }]);
    expect(await scalar("select count(*)::int as count from public.referral_audit where action='wave.updated'")).toEqual({ count: 1 });
    await expect(db.query("select public.manage_wave($1,$2)", [actor, { id: wave, operation: 'extend', ends_at: new Date().toISOString(), qualification_deadline: deadline }])).rejects.toThrow('only be extended');
    await db.exec("insert into public.waves(name,status,starts_at,ends_at,qualification_deadline) values('Wave 11','settling',now()+interval '5 days',now()+interval '7 days',now()+interval '8 days')");
    await expect(db.query("select public.manage_wave($1,$2)", [actor, { id: wave, operation: 'extend', ends_at: new Date(Date.now()+6*86400000).toISOString(), qualification_deadline: new Date(Date.now()+9*86400000).toISOString() }])).rejects.toThrow('overlap');
  });
  it("permits audited correction only before earning approval or payment", async () => {
    await expect(db.query("select public.correct_earning_wave($1,$2,$3,$4)", [actor,claim,wave,'Proof shows a different earning wave'])).rejects.toThrow('Only unapproved');
    await db.exec(`update public.scouter_withdrawal_proofs set status='pending' where id='${claim}'`);
    await db.query("select public.correct_earning_wave($1,$2,$3,$4)", [actor,claim,wave,'Proof verified before approval']);
    expect(await scalar("select count(*)::int as count from public.referral_audit where action='earning.wave_corrected'")).toEqual({ count: 1 });
    await db.query("select public.review_earning($1,$2,'confirmed')", [actor,claim]);
    await pay();
    await expect(db.exec(`update public.scouter_withdrawal_proofs set payout_status='paid',paid_at=now(),paid_by='${actor}' where id='${claim}'`)).rejects.toThrow('payment ledger');
  });
  it("rejects duplicate and self attribution and multiple active waves", async () => {
    await expect(db.exec(`insert into public.referrals(referrer_account_id,referred_account_id,wave_id) values(1,2,'${wave}')`)).rejects.toThrow();
    await expect(db.exec(`insert into public.referrals(referrer_account_id,referred_account_id,wave_id) values(1,1,'${wave}')`)).rejects.toThrow();
    await expect(db.exec("insert into public.waves(name,status,starts_at,ends_at,qualification_deadline) values('Other','active',now(),now()+interval '1 day',now()+interval '2 days')")).rejects.toThrow();
  });
  it("records a late benefit as a top-up without rewriting the original payment", async () => {
    await pay();
    await qualify();
    expect(await balance()).toMatchObject({ paid_total_stroops: "600000000", balance_stroops: "100000000" });
    await pay("100000000", "70", "00000000-0000-4000-8000-000000000051");
    expect(await balance()).toMatchObject({ paid_total_stroops: "700000000", balance_stroops: "0", paid_total_kobo: "9312730" });
    expect(await scalar("select count(*)::int as count from public.earning_payments")).toEqual({ count: 2 });
    expect(await scalar("select share_percent,amount_stroops::text from public.earning_payments where id=$1", [payment])).toEqual({ share_percent: 60, amount_stroops: "600000000" });
  });
  it("rejects stale payment amounts and makes retries idempotent", async () => {
    await qualify();
    await expect(pay()).rejects.toThrow("earning changed");
    await Promise.all([pay("700000000", "70"), pay("700000000", "70")]);
    expect(await scalar("select count(*)::int as count from public.earning_payments")).toEqual({ count: 1 });
    await expect(pay("700000000", "70", "00000000-0000-4000-8000-000000000052")).rejects.toThrow("No confirmed balance");
  });
  it("preserves paid history on revocation and records a reversal only once", async () => {
    await qualify(); await pay("700000000", "70"); await qualify("revoked");
    expect(await balance()).toMatchObject({ balance_stroops: "-100000000", paid_total_stroops: "700000000" });
    const correction = { action: "reverse", requestId: "00000000-0000-4000-8000-000000000053", paymentId: payment, reason: "Wrong payment was recorded; correcting the ledger" };
    await db.query("select public.record_earning_payment($1,$2,$3)", [actor, claim, correction]);
    expect(await balance()).toMatchObject({ balance_stroops: "600000000", paid_total_stroops: "0" });
    await expect(db.query("select public.record_earning_payment($1,$2,$3)", [actor, claim, { ...correction, requestId: "00000000-0000-4000-8000-000000000054" }])).rejects.toThrow("already reversed");
  });
  it("locks paid claim review, prevents wave reassignment and enforces deadlines", async () => {
    await pay();
    await expect(db.query("select public.review_earning($1,$2,'rejected')", [actor, claim])).rejects.toThrow("payment history");
    await expect(db.exec(`update public.scouter_withdrawal_proofs set wave_id=null where id='${claim}'`)).rejects.toThrow("cannot be changed");
    await db.exec(`update public.waves set ends_at=now()-interval '1 hour',qualification_deadline=now()-interval '1 minute' where id='${wave}'`);
    await expect(qualify()).rejects.toThrow("deadline");
  });
  it("attribution is retry safe and excludes existing members", async () => {
    await db.exec(`insert into public.referral_codes(account_id,code) values(1,'00000000-0000-4000-8000-000000000060');
      insert into public.referral_intents(id,code,wave_id) values('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000060','${wave}')`);
    const args = [3, "newcomer", actor, new Date().toISOString(), "00000000-0000-4000-8000-000000000061"];
    expect(await scalar("select public.complete_referral_signup($1,$2,$3,$4,$5) as result", args)).toEqual({ result: "complete" });
    expect(await scalar("select public.complete_referral_signup($1,$2,$3,$4,$5) as result", args)).toEqual({ result: "complete" });
    expect(await scalar("select public.complete_referral_signup($1,$2,$3,$4,$5) as result", [2, "contributor", actor, new Date().toISOString(), args[4]])).toEqual({ result: "existing" });
  });
  it("denies direct data and RPC access to browser roles", async () => {
    await db.exec("set role authenticated");
    try {
      await expect(db.exec("select * from public.referrals")).rejects.toThrow("permission denied");
      await expect(db.query("select public.review_referral($1,$2,'qualified','fake activity',123,'{}')", [actor, referral])).rejects.toThrow("permission denied");
    } finally { await db.exec("reset role"); }
    await db.exec("set role service_role");
    try { await pay(); } finally { await db.exec("reset role"); }
  });
});
