# Frontend DEV Tests — Student Dashboard & Notifications

Use these manual steps to validate the student-facing real-time experience before shipping.

## Prerequisites

1. `cd frontend && npm install`
2. `npm run dev`
3. Ensure the backend is running locally (Socket.IO + REST) and seeded with at least one student (e.g., `22ME1A0501`) who is assigned to a route, bus, and stop.
4. Open the Vite dev server URL (default `http://localhost:5173`).

## Student Dashboard Streaming

1. Log in as the student (`22ME1A0501` / password from seed).
2. Confirm `sessionStorage.tm_token` is set and you are redirected to `/student`.
3. The summary card should list the assigned bus name, stop name, connection status, and `ETA: —`.
4. Map should render both the bus marker (if last location exists) and the student stop marker. Zoom/pan should include both points.
5. Start the driver simulator or real driver streaming to emit `trip:location_update` events.
6. Observe the status chip flip to "Live GPS update received" within a couple of seconds of the first event and the bus marker move accordingly.
7. If no ETA events are sent, verify the fallback ETA displays using the distance calculation (value should roughly shrink as the bus approaches).

## Notifications & Toasts

1. Click **Enable notifications**. The browser permission prompt should appear. Allow access.
2. `Application > Service Workers` in DevTools should show `/sw.js` registered and controlled.
3. With notifications enabled, trigger `trip:eta_update` with ETA < 5 minutes for the student's stop. Expect:
   - In-page toast “Bus is approaching …”
   - System notification showing stop name and ETA (tab can be in foreground/background).
4. Trigger `trip:stop_arrived` and `trip:stop_left` events (use driver app or Socket.IO client). Expect:
   - History list prepends new entries (max 5 retained).
   - Toast plus system notification for each event containing the stop name.
5. Background the tab (switch browser tabs or minimize) and repeat step 4. Confirm notifications appear via the Service Worker and clicking them focuses the app.
6. Click **Disable notifications**. The button text should switch back to “Enable notifications”, and no further system notifications should fire even though toasts still appear.

## Failure/Edge Cases

1. Toggle Airplane Mode (or disable internet) on the test device. Socket status should flip to “Disconnected”; map remains but no new updates appear.
2. Re-enable network. Within seconds, status should return to “Live GPS update received” once events stream again.
3. Revoke notification permission in the browser settings, reload `/student`, and try enabling notifications again. UI should prompt that permission is needed and remain disabled.
4. Clear `sessionStorage` and reload; app should redirect to `/login` before mounting the dashboard.

## Console Expectations

- `ServiceWorker registration failed` should not appear after grant.
- Socket reconnection logs may appear once when toggling offline/online; no uncaught exceptions should show when notifications are denied or when the SW is missing.
