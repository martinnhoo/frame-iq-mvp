import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface FeedbackToastProps {
  isVisible: boolean;
  type: 'success' | 'error';
  message: string;
  impact?: string;
  onUndo?: () => void;
  onDismiss: () => void;
}

const FeedbackToast: React.FC<FeedbackToastProps> = ({
  isVisible,
  type,
  message,
  impact,
  onUndo,
  onDismiss,
}) => {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setAnimate(true);
      const timer = setTimeout(() => {
        setAnimate(false);
        setTimeout(onDismiss, 300);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setAnimate(false);
    }
  }, [isVisible, onDismiss]);

  if (!isVisible && !animate) return null;

  const borderColor = type === 'success' ? 'border-green-500' : 'border-red-500';
  const bgColor =
    type === 'success' ? 'bg-green-950/30' : 'bg-red-950/30';

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 transform ${
        animate ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div
        className={`bg-[#111827] border-l-4 ${borderColor} rounded-xl shadow-2xl p-4 min-w-80 ${bgColor} backdrop-blur-sm border border-gray-800`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-white mb-1">{message}</p>
            {impact && (
              <p className="text-xs text-gray-400 mb-3">{impact}</p>
            )}
            {onUndo && (
              <button
                onClick={onUndo}
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
              >
                Desfazer
              </button>
            )}
          </div>
          <button
            onClick={() => {
              setAnimate(false);
              setTimeout(onDismiss, 300);
            }}
            className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackToast;
