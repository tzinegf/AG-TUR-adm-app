import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#DC2626',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="dashboard" options={{ title: 'Painel Administrativo' }} />
      <Stack.Screen name="routes" options={{ title: 'Gerenciar Rotas' }} />
      <Stack.Screen name="buses" options={{ title: 'Gerenciar Ônibus' }} />
      <Stack.Screen name="bookings" options={{ title: 'Gerenciar Reservas' }} />
      <Stack.Screen name="users" options={{ title: 'Gerenciar Usuários' }} />
      <Stack.Screen name="reports" options={{ title: 'Relatórios' }} />
    </Stack>
  );
}
