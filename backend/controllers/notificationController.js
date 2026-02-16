const webpush = require('web-push');
const User = require('../models/User');
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = require('../config/constants');

// Configure Web Push only if VAPID keys are provided
let pushEnabled = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    try {
        webpush.setVapidDetails(
            process.env.VAPID_EMAIL || 'mailto:admin@trackmate.com',
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
        );
        pushEnabled = true;
        console.log('✅ Push notifications enabled');
    } catch (error) {
        console.warn('[WARN] Failed to configure VAPID:', error.message);
    }
} else {
    console.warn('[WARN] VAPID keys not configured. Push notifications will be disabled.');
}

const subscribe = async (req, res) => {
    try {
        if (!pushEnabled) {
            return res.status(503).json({ message: 'Push notifications are not configured on the server' });
        }
        
        const subscription = req.body;
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ message: 'Invalid subscription object' });
        }

        // Reject subscriptions with invalid/placeholder endpoints (non-secure context)
        if (subscription.endpoint.includes('permanently-removed.invalid') || 
            !subscription.endpoint.startsWith('https://')) {
            return res.status(400).json({ 
                message: 'Invalid push endpoint. Push notifications require a secure (HTTPS) context. If testing on LAN, add your LAN URL to chrome://flags/#unsafely-treat-insecure-origin-as-secure' 
            });
        }

        // Save to user
        // req.user is set by authMiddleware
        await User.findByIdAndUpdate(req.user.id, { pushSubscription: subscription });

        res.status(201).json({ message: 'Subscription saved' });
    } catch (error) {
        console.error('Sub Error:', error);
        res.status(500).json({ message: 'Failed to save subscription' });
    }
};

const sendPush = async (user, payload) => {
    if (!pushEnabled || !user.pushSubscription) return;
    try {
        await webpush.sendNotification(user.pushSubscription, JSON.stringify(payload));
    } catch (error) {
        console.error(`Push failed for user ${user.username}:`, error.message);
        // If subscription is invalid (404/410) or keys mismatch (401/400), clear it
        if ([404, 410, 400, 401].includes(error.statusCode)) {
            console.log(`Clearing invalid subscription for ${user.username}`);
            await User.findByIdAndUpdate(user._id, { pushSubscription: null });
        }
    }
};

const fs = require('fs');

const testPush = async (req, res) => {
    try {
        if (!pushEnabled) {
            return res.status(503).json({ message: 'Push notifications are not configured on the server. Please set VAPID keys.' });
        }
        
        // user is attached by authMiddleware
        const user = await User.findById(req.user.id);
        if (!user || !user.pushSubscription) {
            return res.status(400).json({ message: 'No push subscription found. Please enable notifications first.' });
        }

        // Check for invalid subscription endpoint
        if (user.pushSubscription.endpoint?.includes('permanently-removed.invalid') ||
            !user.pushSubscription.endpoint?.startsWith('https://')) {
            // Clear the invalid subscription
            await User.findByIdAndUpdate(user._id, { pushSubscription: null });
            return res.status(400).json({ 
                message: 'Your push subscription is invalid (created from non-secure context). Please disable and re-enable notifications from a secure context (HTTPS or add LAN URL to chrome://flags).' 
            });
        }

        console.log('Sending Test Push to:', user.name);
        try {
            await webpush.sendNotification(user.pushSubscription, JSON.stringify({
                title: '🔔 TrackMate',
                body: 'Push notifications are working! You\'ll get alerts when your bus is nearby.',
                url: '/student',
                tag: 'test-push',
                icon: '/favicons/android-chrome-192x192.png',
                badge: '/favicons/favicon-32x32.png'
            }));
            res.json({ message: 'Test notification sent.' });
        } catch (pushErr) {
            // Write to file so we can read it via tool
            const logMsg = `[PUSH ERROR] ${new Date().toISOString()} - ${pushErr.message} - Code: ${pushErr.statusCode}\nStack: ${pushErr.stack}\n`;
            fs.appendFileSync('debug.log', logMsg);

            console.error('Test Push Failed:', pushErr);
            // If failed, assume invalid subscription and clear it so frontend knows to re-subscribe
            if ([404, 410, 400, 401].includes(pushErr.statusCode)) {
                await User.findByIdAndUpdate(user._id, { pushSubscription: null });
                return res.status(400).json({ message: 'Subscription invalid or expired. Please toggle notifications OFF then ON.' });
            }
            throw pushErr;
        }
    } catch (error) {
        console.error('Test Push Error:', error);
        res.status(500).json({
            message: error.message || 'Internal Server Error',
            code: error.statusCode || 'UNKNOWN',
            details: error.body || error.stack
        });
    }
};

module.exports = { subscribe, sendPush, testPush };
