import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Eye, CheckSquare, Square, Heart, Trash2 } from 'lucide-react';
import type { Photo } from '../services/types.ts';
import { t } from '../services/i18n.ts';

interface PhotoActionMenuProps {
  photo: Photo;
  onClose: () => void;
  onView: () => void;
  onSelect: () => void;
  onToggleSave: () => void;
  onDelete?: () => void;
}

// Bottom sheet opened by a long press on a thumbnail. Rendered in a portal because the grid
// positions its cards with transforms, which would trap a fixed element inside the card.
const PhotoActionMenu: React.FC<PhotoActionMenuProps> = ({ photo, onClose, onView, onSelect, onToggleSave, onDelete }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = (action: () => void) => () => { onClose(); action(); };

  const items: Array<{ key: string; icon: React.ReactNode; label: string; action: () => void; danger?: boolean }> = [
    { key: 'view', icon: <Eye className="w-5 h-5" />, label: t('menu.view'), action: onView },
    { key: 'select', icon: photo.selected ? <Square className="w-5 h-5" /> : <CheckSquare className="w-5 h-5" />, label: photo.selected ? t('menu.unselect') : t('menu.select'), action: onSelect },
    { key: 'keep', icon: <Heart className={`w-5 h-5 ${photo.isSaved ? 'fill-current' : ''}`} />, label: photo.isSaved ? t('menu.unkeep') : t('menu.keep'), action: onToggleSave },
  ];
  if (onDelete) items.push({ key: 'delete', icon: <Trash2 className="w-5 h-5" />, label: t('menu.delete'), action: onDelete, danger: true });

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/50" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="w-full sm:max-w-xs rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-800 shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
          <img src={photo.thumbnailURL ?? photo.objectURL} alt="" className="w-12 h-12 rounded-md object-cover shrink-0" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{photo.id.split('/').pop()}</p>
        </div>
        {items.map(item => (
          <button
            key={item.key}
            onClick={run(item.action)}
            className={`w-full flex items-center gap-3 px-5 py-3.5 text-left font-medium hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 ${item.danger ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
        <button onClick={onClose} className="w-full px-5 py-3.5 text-center text-sm font-semibold text-gray-500 border-t border-gray-200 dark:border-gray-700">
          {t('menu.cancel')}
        </button>
      </div>
    </div>,
    document.body
  );
};

export default PhotoActionMenu;
