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

  const token = jwt.sign(payload, serviceAccount.private_key, { algorithm: 'RS256' });

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to get access token');
  }

  const { access_token } = await tokenResponse.json() as { access_token: string };
  return access_token;
}

// Validar token FCM enviando mensaje dry-run
async function validateFCMToken(token: string): Promise<boolean> {
  try {
    const accessToken = await getAccessToken();
    const projectId = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!).project_id;

    const message = {
      message: {
        token: token,
        notification: {
          title: 'Validation Test',
          body: 'Token validation'
        },
        data: {
          test: 'true'
        }
      },
      validate_only: true  // dry-run mode
    };

    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    // Si es 200, el token es válido
    // Si es 400 con error específico, el token es inválido
    if (response.ok) {
      return true;
    }

    if (response.status === 400) {
      const errorData = await response.json() as {
        error?: {
          details?: Array<{ errorCode?: string }>
        }
      };
      const errorCode = errorData?.error?.details?.[0]?.errorCode;
      
      if (errorCode === 'UNREGISTERED' || errorCode === 'INVALID_ARGUMENT') {
        return false;  // Token inválido
      }
    }

    // Para otros errores, asumir válido para no eliminar tokens por errores temporales
    console.warn(`Unexpected validation response for token ${token.substring(0, 20)}...: ${response.status}`);
    return true;

  } catch (error) {
    console.error('Error validating token:', error);
    return true;  // En caso de error, asumir válido
  }
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

export { sendPushNotification, validateFCMToken };