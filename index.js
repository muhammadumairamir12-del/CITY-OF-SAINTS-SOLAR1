// Yahan maine /v1 ka izafa kiya hai taake naye version mein error na aaye
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
admin.initializeApp();

// 1. Jab NAYI BOOKING aaye -> ADMIN ko notification jaye
exports.notifyAdminOnBooking = functions.database.ref('/bookings/{bookingId}')
    .onCreate(async (snapshot, context) => {
        const booking = snapshot.val();
        const payload = { notification: { title: '📅 New Booking Received!', body: `${booking.name || 'A patient'} just booked an appointment.` }};

        const adminDocs = await admin.firestore().collection('users').where('role', '==', 'admin').get();
        const tokens = [];
        adminDocs.forEach(doc => { if (doc.data().token) tokens.push(doc.data().token); });

        if (tokens.length > 0) return admin.messaging().sendEachForMulticast({ tokens: tokens, notification: payload.notification });
        return null;
    });

// 2. Jab BOOKING CONFIRM ya CANCEL ho -> PATIENT ko notification jaye
exports.notifyUserOnBookingStatus = functions.database.ref('/bookings/{bookingId}')
    .onUpdate(async (change, context) => {
        const after = change.after.val();
        const before = change.before.val();
        
        if (after.status !== before.status && after.uid) {
            let msg = after.status === 'confirmed' ? 'Your booking is confirmed!' : 'Your booking has been cancelled.';
            const payload = { notification: { title: `📅 Booking ${after.status.toUpperCase()}`, body: msg }};
            
            const userDoc = await admin.firestore().collection('users').doc(after.uid).get();
            if (userDoc.exists && userDoc.data().token) {
                return admin.messaging().send({ token: userDoc.data().token, notification: payload.notification });
            }
        }
        return null;
    });

// 3. Jab CHAT MESSAGE aaye (Patient to Admin, ya Admin to Patient)
exports.notifyOnChatMessage = functions.database.ref('/chats/{userId}/{msgId}')
    .onCreate(async (snapshot, context) => {
        const msg = snapshot.val();
        const userId = context.params.userId;

        if (msg.sender === 'user') {
            const payload = { notification: { title: '💬 New Patient Message', body: msg.text }};
            const adminDocs = await admin.firestore().collection('users').where('role', '==', 'admin').get();
            const tokens = [];
            adminDocs.forEach(doc => { if (doc.data().token) tokens.push(doc.data().token); });
            if (tokens.length > 0) return admin.messaging().sendEachForMulticast({ tokens: tokens, notification: payload.notification });
        } else if (msg.sender === 'admin') {
            const payload = { notification: { title: '👨‍⚕️ Reply from Doctor', body: msg.text }};
            const userDoc = await admin.firestore().collection('users').doc(userId).get();
            if (userDoc.exists && userDoc.data().token) {
                return admin.messaging().send({ token: userDoc.data().token, notification: payload.notification });
            }
        }
        return null;
    });

// 4. Jab Admin BROADCAST kare -> SAB PATIENTS ko notification jaye
exports.notifyBroadcast = functions.database.ref('/broadcasts/{broadcastId}')
    .onCreate(async (snapshot) => {
        const data = snapshot.val();
        const payload = { notification: { title: data.title, body: data.body }};
        
        const userDocs = await admin.firestore().collection('users').get();
        const tokens = [];
        userDocs.forEach(doc => { 
            if (doc.data().token && doc.data().role !== 'admin') {
                tokens.push(doc.data().token); 
            }
        });

        if (tokens.length > 0) return admin.messaging().sendEachForMulticast({ tokens: tokens, notification: payload.notification });
        return null;
    });