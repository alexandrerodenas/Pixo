import React, { useEffect, useState } from 'react';
import { Users, X, ArrowLeft, Images, ShieldCheck } from 'lucide-react';
import type { PeopleState, VisiblePerson } from '../hooks/usePeople.ts';
import { displayName } from '../services/faceIndex.ts';
import { t } from '../services/i18n.ts';

interface PeopleModalProps {
  isOpen: boolean;
  onClose: () => void;
  people: PeopleState;
  onToggleEnabled: (enabled: boolean) => void;
  onShowPerson: (personId: string) => void;
}

const nameOf = (person: VisiblePerson) => displayName(person, t('people.default'));

const Avatar: React.FC<{ url?: string; className?: string }> = ({ url, className = 'w-20 h-20' }) => (
  url
    ? <img src={url} alt="" className={`${className} rounded-full object-cover bg-gray-200 dark:bg-gray-700`} />
    : <div className={`${className} rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center`}><Users className="w-1/2 h-1/2 text-gray-400" /></div>
);

const PeopleModal: React.FC<PeopleModalProps> = ({ isOpen, onClose, people, onToggleEnabled, onShowPerson }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [pickedFaces, setPickedFaces] = useState<Set<string>>(new Set());
  const open = people.people.find(p => p.id === openId) ?? null;

  useEffect(() => {
    if (open) setDraftName(open.name ?? '');
    setPickedFaces(new Set());
  }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps

  // A merged or emptied person disappears: go back to the list
  useEffect(() => {
    if (openId && !open) setOpenId(null);
  }, [openId, open]);

  if (!isOpen) return null;

  const commitName = () => {
    if (open && draftName.trim() !== (open.name ?? '')) people.rename(open.id, draftName);
  };

  const handleDisable = async () => {
    if (!window.confirm(t('people.confirmDisable'))) return;
    await people.clearAll();
    onToggleEnabled(false);
    setOpenId(null);
  };

  const { done, total } = people.progress;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-stretch sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 sm:rounded-lg shadow-2xl w-full sm:max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col text-gray-900 dark:text-gray-100" onClick={e => e.stopPropagation()}>
        <div className="px-4 sm:px-6 py-3 sm:py-5 pt-[max(0.75rem,env(safe-area-inset-top))] border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 flex-shrink-0">
          {open && (
            <button onClick={() => { commitName(); setOpenId(null); }} aria-label={t('people.back')} className="p-2 -ml-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><ArrowLeft className="w-5 h-5" /></button>
          )}
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 flex-1 min-w-0 truncate">
            <Users className="text-primary shrink-0" /> {open ? nameOf(open) : t('people.title')}
          </h2>
          <button onClick={() => { commitName(); onClose(); }} aria-label={t('people.close')} className="p-2 -mr-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-4">
          {!people.enabled && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">{t('people.intro')}</p>
              <p className="text-sm flex gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200">
                <ShieldCheck className="w-5 h-5 shrink-0" /> {t('people.privacy')}
              </p>
              <button onClick={() => onToggleEnabled(true)} className="w-full sm:w-auto px-4 py-2.5 bg-primary text-white font-semibold rounded-md hover:bg-primary-dark transition">
                {t('people.enable')}
              </button>
            </div>
          )}

          {people.enabled && !open && (
            <>
              {total > done && <p className="text-sm text-gray-500 dark:text-gray-400">{t('people.progress', { done, total })}</p>}
              {people.error && <p className="text-sm text-red-600 dark:text-red-400">{t('people.error', { error: people.error })}</p>}
              {people.people.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">{t('people.empty')}</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                  {people.people.map(person => (
                    <button key={person.id} onClick={() => setOpenId(person.id)} className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-center min-w-0">
                      <Avatar url={people.faceUrl(person.faces[0])} />
                      <span className={`text-sm font-semibold truncate max-w-full ${person.name ? '' : 'text-gray-500 dark:text-gray-400'}`}>{nameOf(person)}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{t('people.photos', { count: new Set(person.faces.map(f => f.photoId)).size })}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs flex gap-2 text-gray-500 dark:text-gray-400"><ShieldCheck className="w-4 h-4 shrink-0" /> {t('people.privacy')}</p>
              <button onClick={handleDisable} className="text-sm text-red-600 dark:text-red-400 hover:underline">{t('people.disable')}</button>
            </>
          )}

          {people.enabled && open && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <Avatar url={people.faceUrl(open.faces[0])} className="w-20 h-20 shrink-0" />
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-medium mb-1">{t('people.name')}</label>
                  <input
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    placeholder={t('people.namePlaceholder')}
                    className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                  />
                </div>
              </div>

              <button onClick={() => { commitName(); onShowPerson(open.id); }} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white font-semibold rounded-md hover:bg-primary-dark transition">
                <Images className="w-5 h-5" /> {t('people.show')}
              </button>

              {people.people.length > 1 && (
                <div>
                  <label className="block text-sm font-medium mb-1">{t('people.mergeInto')}</label>
                  <select
                    value=""
                    onChange={e => { if (e.target.value) { commitName(); people.merge(open.id, e.target.value); setOpenId(e.target.value); } }}
                    className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                  >
                    <option value="">{t('people.mergeChoose')}</option>
                    {people.people.filter(p => p.id !== open.id).map(p => <option key={p.id} value={p.id}>{nameOf(p)}</option>)}
                  </select>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{t('people.faces', { count: open.faces.length })}</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {open.faces.map(face => {
                    const picked = pickedFaces.has(face.id);
                    return (
                      <button
                        key={face.id}
                        onClick={() => setPickedFaces(prev => { const next = new Set(prev); if (picked) next.delete(face.id); else next.add(face.id); return next; })}
                        aria-pressed={picked}
                        className={`relative rounded-full ${picked ? 'ring-4 ring-red-500' : ''}`}
                      >
                        <Avatar url={people.faceUrl(face)} className="w-full aspect-square" />
                        {picked && <span className="absolute inset-0 rounded-full bg-black/40 text-white flex items-center justify-center"><X className="w-6 h-6" /></span>}
                      </button>
                    );
                  })}
                </div>
                {pickedFaces.size > 0 && (
                  <button
                    onClick={() => { pickedFaces.forEach(id => people.detachFace(id)); setPickedFaces(new Set()); }}
                    className="mt-3 w-full sm:w-auto px-4 py-2 rounded-md bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
                  >
                    {t('people.notThem')} ({pickedFaces.size})
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PeopleModal;
