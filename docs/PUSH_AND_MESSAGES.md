# Push notifications and direct messages

The app side is built (v70). Two one-time steps on Ngaren's accounts switch
them on. Until then the app says "Messaging is not switched on yet" and push
notifications stay on the phone only.

## 1. Database: run migration 0010 (switches on messages)

1. Open the SQL editor for project `wywynljwiqowirhrqsfz`:
   https://supabase.com/dashboard/project/wywynljwiqowirhrqsfz/sql/new
2. Paste all of `docs/backend/0010_direct_messages_and_push.sql` and press **Run**.
3. Check it worked: run `select count(*) from public.direct_messages;` (returns 0).

This adds:
- `direct_messages`: only the sender and the recipient can read a message.
- A notification for the recipient of every message (bell and Notifications screen).
- `push_tokens` and a trigger that sends every new notification (messages,
  bookings, device orders, ...) to the user's phones through Expo's push service.
- `get_message_contacts()`: who can be messaged (name and role only).

After this, messages are delivered in the app straight away, even before step 2.

## 2. Firebase: switches on push to Android phones

Android push goes through Firebase Cloud Messaging. Using Ngaren's Google account:

1. https://console.firebase.google.com → **Add project** (e.g. "Ngaren Connect").
2. In the project, **Add app → Android**, package name `com.emaanidev.ngarenconnectmobile`.
3. Download **google-services.json** and put it in the repository root (next to
   `app.json`), then commit it. `app.config.js` picks it up automatically.
4. Project settings → **Service accounts** → **Generate new private key** (a JSON
   file). Do not commit this one.
5. Upload it to Expo so Expo's push service can deliver to Android:
   ```
   eas credentials -p android
   ```
   choose the `preview` profile → *Google Service Account* →
   *Manage your Google Service Account Key for Push Notifications (FCM V1)* →
   upload the JSON from step 4.
6. Build a new APK (`eas build -p android --profile preview`). Each tester
   opens the app once and allows notifications; their phone is then registered.

## Checking it works

- Messages: sign in as a farmer and a vet on two phones. Farmer → Notifications
  → Messages → New message → the vet → send. The vet sees it in Messages, with
  an unread count, and a "Message from …" notification. The farmer sees
  "Delivered", then "Read" once the vet opens it.
- Push: with the vet's app closed, send another message. The vet's phone shows
  the notification; tapping it opens the conversation.
