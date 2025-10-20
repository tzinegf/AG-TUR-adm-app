import { useEffect } from 'react';
import { router } from 'expo-router';

export default function AdminIndex() {
  useEffect(() => {
    // Redirecionar diretamente para o dashboard
    router.replace('/admin/dashboard');
  }, []);

  return null;
}