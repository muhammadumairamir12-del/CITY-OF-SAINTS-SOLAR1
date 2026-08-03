const { onValueCreated, onValueUpdated } = require("firebase-functions/v2/database");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.database();
const firestore = admin.firestore();

/**
 * 1. User to Admin Notification
 * Triggered when a new booking is created in Realtime Database.
 * Sends a push notification to all users with the 'admin' role.
 */
exports.notifyAdminOnBooking = onValueCreated("/bookings/{pushId}", async (event) => {
    const booking = event.data.val();
    
    // Notification Payload
    const payload = {
        notification: {
            title: "📅 New Booking Received!",
            body: `${booking.name || 'A patient'} just booked an appointment for ${booking.service}.`,
            icon: "logo.png",
            clickAction: "https://zigzoog-5708f.web.app/admin.html" // Update with your actual domain
        },
        data: {
            type: "booking_new",
            url: "/admin.html"
        }
    };

    try {
        // Fetch Admin Tokens from Firestore
        const adminDocs = await firestore.collection("users").where("role", "==", "admin").get();
        const tokens = [];
        adminDocs.forEach(doc => {
            const data = doc.data();
            if (data.fcmToken) tokens.push(data.fcmToken);
        });

        if (tokens.length > 0) {
            console.log(`Sending booking notification to ${tokens.length} admin(s).`);
            return admin.messaging().sendEachForMulticast({ tokens, notification: payload.notification, data: payload.data });
        } else {
            console.log("No admin tokens found.");
        }
    } catch (error) {
        console.error("Error sending admin notification:", error);
    }
});

/**
 * 2. Admin to User Notification
 * Triggered when a booking status is updated (e.g., confirmed or cancelled).
 */
exports.notifyUserOnBookingUpdate = onValueUpdated("/bookings/{pushId}", async (event) => {
    const before = event.data.before.val();
    const after = event.data.after.val();

    // Check if status has changed
    if (before.status !== after.status && after.uid) {
        let title = "📅 Booking Update";
        let body = `Your booking status has been updated to ${after.status}.`;
        
        if (after.status === 'confirmed') {
            title = "✅ Booking Confirmed!";
            body = "Great news! Your appointment at Al-Fazal Hospital is confirmed.";
        } else if (after.status === 'cancelled') {
            title = "❌ Booking Cancelled";
            body = "Your appointment has been cancelled. Please contact us for details.";
        }

        const payload = {
            notification: {
                title: title,
                body: body,
                icon: "logo.png",
                clickAction: "https://zigzoog-5708f.web.app/my-bookings"
            },
            data: {
                type: "booking_update",
                url: "/my-bookings"
            }
        };

        try {
            // Get user token from Firestore
            const userDoc = await firestore.collection("users").doc(after.uid).get();
            if (userDoc.exists && userDoc.data().fcmToken) {
                console.log(`Sending status update to user: ${after.uid}`);
                return admin.messaging().send({
                    token: userDoc.data().fcmToken,
                    notification: payload.notification,
                    data: payload.data
                });
            }
        } catch (error) {
            console.error("Error sending user notification:", error);
        }
    }
});

/**
 * 3. Two-Way Chat Notification
 * Triggered when a new message is added to a chat node.
 */
exports.notifyOnChatMessage = onValueCreated("/chats/{userId}/{msgId}", async (event) => {
    const msg = event.data.val();
    const userId = event.params.userId;

    // Avoid self-notification or duplicate logic if needed
    if (msg.sender === 'user') {
        // Patient sent a message -> Notify Admin
        const payload = {
            notification: {
                title: "💬 New Patient Message",
                body: msg.text || "Shared an image",
                icon: "logo.png"
            },
            data: { type: "chat", url: "/admin.html" }
        };

        const adminDocs = await firestore.collection("users").where("role", "==", "admin").get();
        const tokens = [];
        adminDocs.forEach(doc => { if (doc.data().fcmToken) tokens.push(doc.data().fcmToken); });
        
        if (tokens.length > 0) {
            return admin.messaging().sendEachForMulticast({ tokens, notification: payload.notification, data: payload.data });
        }
    } else if (msg.sender === 'admin') {
        // Admin sent a message -> Notify Patient
        const payload = {
            notification: {
                title: "👨‍⚕️ Reply from Doctor",
                body: msg.text || "Shared an image",
                icon: "logo.png"
            },
            data: { type: "chat", url: "/consultation" }
        };

        const userDoc = await firestore.collection("users").doc(userId).get();
        if (userDoc.exists && userDoc.data().fcmToken) {
            return admin.messaging().send({
                token: userDoc.data().fcmToken,
                notification: payload.notification,
                data: payload.data
            });
        }
    }
});