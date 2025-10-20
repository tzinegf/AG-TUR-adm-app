import { Redirect } from 'expo-router';

export default function Index() {
  // Redireciona para a aba de busca dentro do grupo de Tabs
  return <Redirect href="/admin/login" />;
}
