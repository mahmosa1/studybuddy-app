// app/index.tsx
import { Redirect } from 'expo-router';

export default function Index() {
  // כל פעם שהאפליקציה נפתחת על הנתיב הראשי "/", נעשה הפניה ל-login
  return <Redirect href="/(auth)/login" />;
}
