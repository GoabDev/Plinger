-- Cover referral_intents.code's foreign key for referral-code lookups and checks.
create index referral_intents_code on public.referral_intents(code);
