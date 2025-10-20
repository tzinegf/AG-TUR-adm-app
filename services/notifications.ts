import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }
    
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    })).data;
  } else {
    alert('Must use physical device for Push Notifications');
  }

  return token;
}

export async function scheduleTripNotification(tripData: {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
}) {
  const tripDate = new Date(`${tripData.date}T${tripData.time}`);
  
  // Notification 24 hours before
  const oneDayBefore = new Date(tripDate.getTime() - 24 * 60 * 60 * 1000);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Viagem amanhã! 🚌',
      body: `Sua viagem ${tripData.from} → ${tripData.to} é amanhã às ${tripData.time}`,
      data: { tripId: tripData.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: oneDayBefore },
  });

  // Notification 1 hour before
  const oneHourBefore = new Date(tripDate.getTime() - 60 * 60 * 1000);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Sua viagem é em 1 hora! ⏰',
      body: `Prepare-se para embarcar. ${tripData.from} → ${tripData.to}`,
      data: { tripId: tripData.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: oneHourBefore },
  });
}
