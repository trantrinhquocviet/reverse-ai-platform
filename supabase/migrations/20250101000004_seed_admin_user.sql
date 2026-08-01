-- Seed admin user: viet.tran@onpoint.vn / 123456
-- Run once to create the initial admin account.

DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  -- Remove existing user if any
  DELETE FROM auth.identities WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'viet.tran@onpoint.vn'
  );
  DELETE FROM auth.users WHERE email = 'viet.tran@onpoint.vn';

  -- Insert user
  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at, confirmation_sent_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, last_sign_in_at
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'viet.tran@onpoint.vn',
    crypt('123456', gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Viet Tran","role":"admin"}',
    now(), now(), now()
  );

  -- Insert identity
  INSERT INTO auth.identities (
    id, user_id, provider_id, provider,
    identity_data, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    'viet.tran@onpoint.vn',
    'email',
    jsonb_build_object(
      'sub', new_user_id::text,
      'email', 'viet.tran@onpoint.vn',
      'email_verified', true
    ),
    now(), now(), now()
  );
END $$;
