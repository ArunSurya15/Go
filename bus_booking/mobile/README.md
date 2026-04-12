# e-GO mobile (Expo)

Passenger app shell: **Expo SDK 54**, **expo-router**, **Plus Jakarta Sans**, JWT auth against the same Django API as the website.

## Run

```bash
cd mobile
npm install
npx expo start
```

Then open **Android emulator**, **iOS simulator**, or **Expo Go** on a device.

## API URL

- **Android emulator (dev):** defaults to `http://10.0.2.2:8000`
- **iOS simulator (dev):** defaults to `http://127.0.0.1:8000`
- **Physical device:** copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL=http://<your-pc-lan-ip>:8000`

Start Django with `python manage.py runserver 0.0.0.0:8000` so the phone can reach it.

## Next build steps

Wire **search → schedules → seat map → checkout** to existing `/api/*` routes; add Razorpay mobile flow; tickets offline; push notifications (EAS).
