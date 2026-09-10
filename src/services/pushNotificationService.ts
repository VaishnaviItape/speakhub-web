import { db } from '../config/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp, 
  writeBatch 
} from 'firebase/firestore';

export type NotificationType = 'FEE_DUE' | 'HOMEWORK' | 'EXAM' | 'BATCH' | 'ANNOUNCEMENT' | 'GENERAL';

export interface PushNotificationPayload {
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, any>;
  channelId?: 'fees' | 'exams' | 'study' | 'batches' | 'default';
  sound?: 'default';
  badge?: number;
}

export interface ExpoPushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  badge?: number;
}

/**
 * Low-level sender to Expo Push Notification API
 * Automatically handles batching (up to 100 messages per HTTP call)
 */
export async function sendExpoPushNotification(messages: ExpoPushMessage[]): Promise<{ success: boolean; error?: any }> {
  if (!messages || messages.length === 0) {
    return { success: true };
  }

  // Filter out invalid/empty tokens
  const validMessages = messages.filter(m => {
    if (Array.isArray(m.to)) {
      return m.to.length > 0;
    }
    return Boolean(m.to && m.to.startsWith('ExponentPushToken'));
  });

  if (validMessages.length === 0) {
    return { success: true };
  }

  try {
    // Expo accepts up to 100 messages per chunk
    const chunkSize = 100;
    for (let i = 0; i < validMessages.length; i += chunkSize) {
      const chunk = validMessages.slice(i, i + chunkSize);
      
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        console.warn(`Expo push notification error HTTP ${response.status}:`, await response.text());
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to send push notifications via Expo:', error);
    return { success: false, error };
  }
}

/**
 * Fetch all push tokens registered for a given list of userIds
 */
export async function getPushTokensForUsers(userIds: string[]): Promise<Map<string, string[]>> {
  const tokenMap = new Map<string, string[]>();
  if (!userIds || userIds.length === 0) return tokenMap;

  // Initialize map
  userIds.forEach(id => tokenMap.set(id, []));

  try {
    // 1. Fetch from users collection
    for (const uId of userIds) {
      try {
        const uSnap = await getDoc(doc(db, 'users', uId));
        if (uSnap.exists()) {
          const uData = uSnap.data();
          if (uData.pushToken && typeof uData.pushToken === 'string') {
            const list = tokenMap.get(uId) || [];
            if (!list.includes(uData.pushToken)) {
              list.push(uData.pushToken);
              tokenMap.set(uId, list);
            }
          }
        }
      } catch (err) {
        console.error(`Error fetching user token for ${uId}:`, err);
      }
    }

    // 2. Fetch multi-device tokens from notification_tokens collection
    try {
      const tokensSnap = await getDocs(collection(db, 'notification_tokens'));
      tokensSnap.forEach(d => {
        const data = d.data();
        if (data.userId && data.token && userIds.includes(data.userId)) {
          const list = tokenMap.get(data.userId) || [];
          if (!list.includes(data.token)) {
            list.push(data.token);
            tokenMap.set(data.userId, list);
          }
        }
      });
    } catch (e) {
      console.warn('Could not query notification_tokens collection:', e);
    }
  } catch (globalErr) {
    console.error('Error fetching push tokens:', globalErr);
  }

  return tokenMap;
}

/**
 * Send notification to a single user + create database record
 */
export async function sendNotificationToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<boolean> {
  if (!userId) return false;

  try {
    // 1. Create Notification Record in Firestore
    await addDoc(collection(db, 'notifications'), {
      userId,
      title: payload.title,
      body: payload.body,
      type: payload.type,
      data: payload.data || {},
      read: false,
      createdAt: serverTimestamp(),
    });

    // 2. Fetch Device Tokens
    const tokenMap = await getPushTokensForUsers([userId]);
    const tokens = tokenMap.get(userId) || [];

    if (tokens.length > 0) {
      const messages: ExpoPushMessage[] = tokens.map(token => ({
        to: token,
        title: payload.title,
        body: payload.body,
        data: {
          ...payload.data,
          type: payload.type,
        },
        sound: 'default',
        priority: 'high',
        channelId: payload.channelId || 'default',
        badge: 1,
      }));

      await sendExpoPushNotification(messages);
    }

    return true;
  } catch (error) {
    console.error(`Error sending notification to user ${userId}:`, error);
    return false;
  }
}

/**
 * Send notification to multiple users + create database records
 */
export async function sendNotificationToUsers(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<number> {
  if (!userIds || userIds.length === 0) return 0;

  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  let successCount = 0;

  try {
    // 1. Batch create Firestore notification records
    const batchSize = 400; // Firestore limit is 500
    for (let i = 0; i < uniqueUserIds.length; i += batchSize) {
      const batchIds = uniqueUserIds.slice(i, i + batchSize);
      const batch = writeBatch(db);

      batchIds.forEach(uId => {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          userId: uId,
          title: payload.title,
          body: payload.body,
          type: payload.type,
          data: payload.data || {},
          read: false,
          createdAt: serverTimestamp(),
        });
      });

      await batch.commit();
    }

    // 2. Fetch tokens and dispatch push notifications
    const tokenMap = await getPushTokensForUsers(uniqueUserIds);
    const messages: ExpoPushMessage[] = [];

    uniqueUserIds.forEach(uId => {
      const tokens = tokenMap.get(uId) || [];
      tokens.forEach(token => {
        messages.push({
          to: token,
          title: payload.title,
          body: payload.body,
          data: {
            ...payload.data,
            type: payload.type,
          },
          sound: 'default',
          priority: 'high',
          channelId: payload.channelId || 'default',
          badge: 1,
        });
      });
    });

    if (messages.length > 0) {
      await sendExpoPushNotification(messages);
    }

    successCount = uniqueUserIds.length;
  } catch (error) {
    console.error('Error sending notification to multiple users:', error);
  }

  return successCount;
}

/**
 * Send notification to all students enrolled in a specific batch
 */
export async function sendNotificationToBatch(
  batchId: string,
  payload: PushNotificationPayload
): Promise<number> {
  if (!batchId) return 0;

  try {
    const studentsSnap = await getDocs(
      query(collection(db, 'users'), where('role', '==', 'student'), where('status', '==', 'active'))
    );

    const targetUserIds: string[] = [];
    studentsSnap.forEach(d => {
      const data = d.data();
      const bIds: string[] = Array.isArray(data.batchIds) 
        ? data.batchIds 
        : Array.isArray(data.batches) 
        ? data.batches 
        : data.batchId 
        ? [data.batchId] 
        : [];

      if (batchId === 'all' || bIds.includes(batchId)) {
        targetUserIds.push(d.id);
      }
    });

    if (targetUserIds.length > 0) {
      return await sendNotificationToUsers(targetUserIds, payload);
    }
    return 0;
  } catch (error) {
    console.error(`Error notifying batch ${batchId}:`, error);
    return 0;
  }
}

/**
 * Send Fee Due notification to a student with duplicate prevention
 */
export async function sendFeeDueNotification({
  studentId,
  studentName,
  monthlyFee,
  dueDate,
  force = false,
}: {
  studentId: string;
  studentName: string;
  monthlyFee: number;
  dueDate: string;
  force?: boolean;
}): Promise<{ success: boolean; message: string }> {
  if (!studentId) return { success: false, message: 'Invalid student ID' };

  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Check if already notified today unless forced
    if (!force) {
      const uSnap = await getDoc(doc(db, 'users', studentId));
      if (uSnap.exists()) {
        const uData = uSnap.data();
        if (uData.lastFeeNotificationDate === todayStr) {
          return { success: false, message: 'Fee notification already sent to this student today.' };
        }
      }
    }

    const title = '💰 Fee Due Reminder';
    const body = `Dear ${studentName || 'Student'}, your monthly fee of ₹${monthlyFee || 800} is due on ${dueDate || 'upcoming date'}. Please make the payment.`;

    const sent = await sendNotificationToUser(studentId, {
      title,
      body,
      type: 'FEE_DUE',
      channelId: 'fees',
      data: {
        screen: '/(app)/fees',
        studentId,
        amount: monthlyFee,
        dueDate,
      },
    });

    if (sent) {
      // Mark last notified date on user
      await updateDoc(doc(db, 'users', studentId), {
        lastFeeNotificationDate: todayStr,
        lastFeeNotificationSentAt: serverTimestamp(),
      });
      return { success: true, message: `Fee due notification sent to ${studentName} successfully.` };
    }

    return { success: false, message: 'Failed to deliver notification.' };
  } catch (error: any) {
    console.error('Error sending fee due notification:', error);
    return { success: false, message: error?.message || 'Error occurred.' };
  }
}
