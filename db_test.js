const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

// Since we're in the container, we don't have the client firebase keys directly,
// but wait, we have the firebase skill!
