type NotificationSoundType = 'success' | 'error' | 'warning' | 'info';

const SOUND_FILES: Record<NotificationSoundType, string> = {
  success: 'success.mp3',
  error: 'error.mp3',
  warning: 'notification.mp3',
  info: 'notification.mp3'
};

export function playNotificationSound(type: NotificationSoundType = 'info'): void {
  if (typeof window === 'undefined') return;

  const audio = new Audio(`/assets/sound/${SOUND_FILES[type]}`);
  audio.volume = 0.55;
  void audio.play().catch(() => undefined);
}