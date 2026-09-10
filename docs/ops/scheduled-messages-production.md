# Scheduled Messages production trigger

ABEmail stores scheduled messages in Supabase, while the Next.js endpoint at
`GET /api/cron/scheduled` claims and sends messages that are due. Vercel Hobby
cron jobs run at most once per day, so they cannot provide the minute-level
trigger required by this feature.

Use Supabase Cron to invoke the production endpoint once per minute. Supabase
Cron uses `pg_cron`, and HTTP jobs use `pg_net`. Keep the application URL and
`CRON_SECRET` in Supabase Vault so neither value is embedded in `cron.job`.

## 1. Confirm the Vercel secret

Production must contain a strong `CRON_SECRET`. The endpoint accepts only:

```text
Authorization: Bearer <CRON_SECRET>
```

Use the same value in Vercel and Supabase Vault. Never commit the value.

## 2. Enable the required Supabase extensions

In the ABEmail Supabase project, enable **Cron** and **pg_net** from Database →
Extensions, or use the Cron integration in the dashboard.

## 3. Store deployment values in Vault

Run these separately in the Supabase SQL editor, replacing the placeholders:

```sql
select vault.create_secret(
  'https://mail.waste2light.com',
  'abemail_app_url',
  'ABEmail production application URL'
);

select vault.create_secret(
  '<same value as Vercel CRON_SECRET>',
  'abemail_cron_secret',
  'ABEmail scheduled-message trigger secret'
);
```

If either named secret already exists, update it in Vault instead of creating a
duplicate.

## 4. Create the one-minute job

```sql
select cron.schedule(
  'abemail-scheduled-messages-every-minute',
  '* * * * *',
  $job$
  select net.http_get(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'abemail_app_url'
    ) || '/api/cron/scheduled',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'abemail_cron_secret'
      ),
      'User-Agent', 'Supabase-Cron/ABEmail'
    ),
    timeout_milliseconds := 55000
  ) as request_id;
  $job$
);
```

The job name is stable. Running `cron.schedule` again with the same name updates
the existing job instead of creating another active trigger.

## 5. Verify end to end

1. Confirm the job is active:

   ```sql
   select jobid, jobname, schedule, active
   from cron.job
   where jobname = 'abemail-scheduled-messages-every-minute';
   ```

2. Schedule a message for two or three minutes in the future.
3. Inspect Cron job history in the Supabase dashboard.
4. Confirm the message transitions through `pending`, `processing`, and `sent`.
5. Confirm `provider_message_id` and `sent_at` are populated.
6. Confirm Resend accepted the message and the recipient received it.
7. Trigger the endpoint again and confirm the message is not sent twice.

The issue is complete only after this production path succeeds. A local request
or a manually invoked endpoint does not prove the production trigger works.

## Troubleshooting

- `401 Unauthorized`: the Vault secret does not match Vercel `CRON_SECRET`.
- `200` with `processed: 0`: no pending message is due.
- `207 Multi-Status`: at least one due message failed; inspect `last_error` and
  the ABEmail operational event.
- Row remains `processing`: wait 15 minutes. A later invocation returns an
  abandoned claim to `pending` and retries it with the same Resend idempotency
  key.
- No job history: confirm both `pg_cron` and `pg_net` are enabled and the job is
  active.

To pause sending without deleting queued messages:

```sql
update cron.job
set active = false
where jobname = 'abemail-scheduled-messages-every-minute';
```
