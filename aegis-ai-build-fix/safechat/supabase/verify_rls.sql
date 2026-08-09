-- RLS VERIFICATION SCRIPT
-- Run this in Supabase SQL Editor to independently confirm that RLS
-- actually blocks cross-user access — don't just trust that it does.

-- Step 1: find two real user IDs from your Users table (Authentication > Users)
-- Replace these with two actual user UUIDs from your project:
-- select id, email from auth.users limit 5;

-- Step 2: simulate being "User A" and try to read ALL messages in the table
-- (not filtered to a conversation) — this should return ONLY messages from
-- conversations User A is actually part of, never anyone else's.

select set_config('request.jwt.claims', json_build_object('sub', 'PASTE_USER_A_ID_HERE')::text, true);
set local role authenticated;

select id, conversation_id, sender_id, content, encrypted
from messages;
-- ✅ PASS if every row's conversation involves User A
-- ❌ FAIL if you see any message from a conversation User A isn't part of

-- Step 3: try reading another user's evidence reports directly
select * from evidence_reports;
-- ✅ PASS if this returns ONLY rows where user_id = User A's id (or nothing)

-- Step 4: try reading another user's private profile fields
select * from profiles where id != 'PASTE_USER_A_ID_HERE';
-- ✅ PASS if this returns NO rows at all (profiles are select-own-only)

-- Reset back to normal (service role) before running anything else
reset role;
