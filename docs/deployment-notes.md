# Deployment Notes

No dummy data should be deployed.

## Required Environment

- Supabase project URL
- Supabase service role key
- Strong JWT secret
- Frontend origin
- Production HTTPS endpoint

## First Admin

The first System Admin account is not seeded in this repository. Create it through a controlled deployment process with a real email, bcrypt password hash, and `role = 'system_admin'`.
