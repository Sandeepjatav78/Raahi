const webPush = require('web-push');
const StudentAssignment = require('../models/StudentAssignment');
const logger = require('./logger');

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = require('../config/constants');

// VAPID details are configured once in notificationController.js
// This module reuses the same web-push instance (singleton in Node.js require cache)

/**
 * Send a web push notification to a subscription
 * @param {Object} subscription - Web push subscription object
 * @param {Object} payload - Notification payload
 * @returns {Promise<boolean>} Success status
 */
const sendPush = async (subscription, payload) => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return false;
  }
  try {
    await webPush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err) {
    logger.error('Push Send Error:', err.message);
    return false;
  }
};

/**
 * Send push notification to all students assigned to a bus
 * @param {Object} params - Notification parameters
 * @param {string} params.busId - Bus ID
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification body
 * @returns {Promise<number>} Number of notifications sent
 */
const sendPushNotification = async ({ busId, title, body }) => {
  const assignments = await StudentAssignment.find({ bus: busId }).populate('student', 'username pushSubscription');
  let sentCount = 0;

  for (const assignment of assignments) {
    const student = assignment.student;
    if (student?.pushSubscription) {
      const payload = { title, body, url: '/student', icon: '/favicons/android-chrome-192x192.png', badge: '/favicons/favicon-32x32.png' };
      const success = await sendPush(student.pushSubscription, payload);
      if (success) {
        sentCount++;
        logger.debug(`Push sent to ${student.username}`);
      }
    }
  }
  return sentCount;
};

/**
 * Send SOS emergency notification to all students on a trip's bus
 * @param {Object} params - SOS parameters
 * @param {string} params.tripId - Trip ID
 * @param {string} params.message - Emergency message
 * @param {Object} params.location - Current location
 * @returns {Promise<boolean>} Success status
 */
const sendSOSNotification = async ({ tripId, message, location }) => {
  try {
    const Trip = require('../models/Trip');

    logger.info(`SOS BROADCAST | Trip: ${tripId} | Msg: ${message}`);

    const trip = await Trip.findById(tripId);
    if (!trip || !trip.bus) {
      logger.error('SOS Error: Trip or Bus not found');
      return false;
    }

    const assignments = await StudentAssignment.find({ bus: trip.bus })
      .populate('student', 'username name pushSubscription');

    const studentsWithPush = assignments
      .map(a => a.student)
      .filter(s => s && s.pushSubscription);

    logger.info(`[SOS] Found ${studentsWithPush.length} students with push subscriptions`);

    let sentCount = 0;
    for (const student of studentsWithPush) {
      const payload = {
        title: '🚨 EMERGENCY ALERT',
        body: `Driver SOS: ${message}`,
        icon: '/favicons/android-chrome-192x192.png',
        badge: '/favicons/favicon-32x32.png',
        data: { url: '/student' },
        tag: 'sos-alert',
        renotify: true,
        requireInteraction: true
      };

      const success = await sendPush(student.pushSubscription, payload);
      if (success) sentCount++;
    }

    logger.info(`[SOS] Sent push to ${sentCount}/${studentsWithPush.length} students`);
    return true;
  } catch (err) {
    logger.error('SOS Push Error:', err.message);
    return false;
  }
};

module.exports = { sendPushNotification, sendSOSNotification };
