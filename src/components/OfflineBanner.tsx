import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Wifi, WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white py-2 px-4 flex items-center justify-center space-x-2 z-50 animate-pulse">
      <WifiOff size={18} />
      <span className="font-medium">Você está offline — Algumas funcionalidades podem estar indisponíveis</span>
    </div>
  );
}

export function OnlineIndicator() {
  const isOnline = useOnlineStatus();

  return (
    <div className={`flex items-center space-x-1 text-sm ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
      {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
      <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
    </div>
  );
}