# Push reminders

Daily expense reminders use Web Push and the server scheduler. Configure these
environment variables on the server before users enable reminders:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (a `mailto:` address or an HTTPS URL)

Generate a key pair from the `server` directory with:

```sh
npx web-push generate-vapid-keys
```

Keep the private key secret. The scheduler checks enabled reminders every
minute using each user's saved time zone and sends each configured reminder
once per device per day. It skips reminders after the user records an expense
that day. Run a single backend instance for the scheduler. The backend must
remain running for scheduled checks; a sleeping or stopped server cannot send
notifications until it is running again.

The web app must be served over HTTPS (localhost is also supported). On iOS,
users need iOS 16.4 or newer and must install the app to the Home Screen before
enabling web push notifications.
