importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDulYuUV4Km2e67SSzveNl9poq90-EhkU8",
  authDomain: "zigzoog-5708f.firebaseapp.com",
  databaseURL: "https://zigzoog-5708f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "zigzoog-5708f",
  storageBucket: "zigzoog-5708f.firebasestorage.app",
  messagingSenderId: "1072366260486",
  appId: "1:1072366260486:web:fdd7a8c160ff8760ab8e87"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: 'https://scontent.flhe2-4.fna.fbcdn.net/v/t39.30808-6/668669594_122116458531233257_3345747139197208070_n.jpg'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});