import jwt from 'jsonwebtoken';

// Generar access token usando Service Account
async function getAccessToken() {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not found');
  }

  const serviceAccount = JSON.parse(serviceAccountKey);
  const now = Math.floor(Date.now() / 1000);
  
  // JWT payload para OAuth2
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  // Crear JWT firmado
  const jwtToken = jwt.sign(payload, serviceAccount.private_key, { algorithm: 'RS256' });

  // Intercambiar JWT por access token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwtToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`OAuth2 error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function sendPushNotification(token: string, title: string, body: string) {
  try {
    const PROJECT_ID = 'fcm-test-e7456';
    const accessToken = await getAccessToken();
    
    // Usar la API v1 de FCM
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: token,
          notification: {
            title,
            body,
          },
          data: {
            timestamp: new Date().toISOString(),
          },
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('FCM API error response:', errorBody);
      throw new Error(`FCM API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('FCM response:', result);
    return result;

  } catch (error: any) {
    console.error('Error sending push notification:', error);
    throw error;
  }
}

export { sendPushNotification };