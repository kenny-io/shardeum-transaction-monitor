import React, { useState, useEffect } from 'react';
import { XCircle, Bell, X } from 'lucide-react';
import { API_URL } from '../config/api';

interface ErrorNotification {
  id: string;
  message: string;
  timestamp: string;
}

export function NotificationsPanel() {
  const [notifications, setNotifications] = useState<ErrorNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchErrors = async () => {
      try {
        const response = await fetch(`${API_URL}/metrics/last-error`);
        const data = await response.json();
        if (data.error && data.error.timestamp) {
          // Add new error to notifications if it doesn't exist
          setNotifications(prev => {
            const exists = prev.some(n => n.timestamp === data.error.timestamp);
            if (!exists) {
              const newNotification = {
                id: Date.now().toString(),
                message: data.error.message,
                timestamp: data.error.timestamp
              };
              setUnreadCount(count => count + 1);
              return [...prev, newNotification].slice(-50); // Keep last 50 notifications
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('Failed to fetch error status:', err);
      }
    };

    fetchErrors();
    const interval = setInterval(fetchErrors, 10000);
    return () => clearInterval(interval);
  }, []);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const togglePanel = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setUnreadCount(0);
    }
  };

  return (
    <div className="fixed right-4 top-20 z-50">
      {/* Notification Bell */}
      <button
        onClick={togglePanel}
        className="relative p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Panel */}
      {isOpen && (
        <div className="mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h2>
            <button
              onClick={togglePanel}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                No notifications
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 relative"
                  >
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <XCircle className="h-5 w-5 text-red-400" />
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-sm text-gray-800 dark:text-gray-200">
                          {notification.message}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {new Date(notification.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => removeNotification(notification.id)}
                        className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 