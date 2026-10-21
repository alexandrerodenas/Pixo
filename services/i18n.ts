// Interface strings. The app is in French for now, whatever the phone's language: the rest of the
// interface is French too (see the components). `{name}` in a value is replaced by the matching argument.
// The English dictionary is kept as the reference for the keys.

const en = {
  'scan.folder': 'Scanning directory...',
  'scan.phone': 'Scanning your phone...',
  'scan.none.phone': 'No photos found on this phone.',
  'scan.none.folder': 'No photos found in this directory. Try another one!',
  'scan.found': 'Found {count} photos. Restoring previous progress...',
  'scan.cancelled': 'Directory selection cancelled.',
  'scan.denied': 'Pixo needs access to your photos. Allow it in the phone settings, then try again.',
  'scan.failed': 'Could not load photos. Check console for details.',
  'delete.progress': 'Deleting {count} photo(s)...',
  'delete.partial': 'Deleted {done} of {count} photos. {failed} could not be deleted and are still shown.',
  'delete.done': 'Successfully deleted {done} photos. ✅',
  'move.done': 'Successfully moved {done} photos to "{folder}". ✅',
  'copy.done': 'Successfully copied {done} photos to "{folder}". ✅',
  'move.partial': 'Moved {done} photos. {failed} were not.',
  'copy.partial': 'Copied {done} photos. {failed} were not.',
  'analysis.done': 'Analysis complete! {count} photos ready. ✅',
  'analysis.progress': 'Analyzing... ({done}/{count})',
  'empty.title': 'Your workspace is empty',
  'empty.phone': 'Tap "Scan Phone" in the top bar to load every photo on your phone.',
  'empty.folder': "Click 'Open Folder' in the top bar to begin your photo organizing adventure!",
  'button.scanPhone': 'Scan Phone',
  'button.openFolder': 'Open Folder',
  'button.selectDirectory': 'Select Directory',
  'onboarding.name': 'Your first name',
} as const;

const fr: Record<keyof typeof en, string> = {
  'scan.folder': 'Analyse du dossier...',
  'scan.phone': 'Analyse de ton téléphone...',
  'scan.none.phone': 'Aucune photo trouvée sur ce téléphone.',
  'scan.none.folder': 'Aucune photo trouvée dans ce dossier. Essaie-en un autre !',
  'scan.found': '{count} photos trouvées. Restauration de ton avancement...',
  'scan.cancelled': 'Sélection du dossier annulée.',
  'scan.denied': "Pixo a besoin d'accéder à tes photos. Autorise-le dans les réglages du téléphone, puis réessaie.",
  'scan.failed': 'Impossible de charger les photos. Voir la console pour les détails.',
  'delete.progress': 'Suppression de {count} photo(s)...',
  'delete.partial': "{done} photos sur {count} supprimées. {failed} n'ont pas pu l'être et restent affichées.",
  'delete.done': '{done} photos supprimées. ✅',
  'move.done': '{done} photos déplacées dans "{folder}". ✅',
  'copy.done': '{done} photos copiées dans "{folder}". ✅',
  'move.partial': '{done} photos déplacées. {failed} ne l\'ont pas été.',
  'copy.partial': '{done} photos copiées. {failed} ne l\'ont pas été.',
  'analysis.done': 'Analyse terminée ! {count} photos prêtes. ✅',
  'analysis.progress': 'Analyse en cours... ({done}/{count})',
  'empty.title': 'Ton espace de travail est vide',
  'empty.phone': 'Touche « Scanner le téléphone » dans la barre du haut pour charger toutes les photos.',
  'empty.folder': "Clique sur « Ouvrir un dossier » dans la barre du haut pour commencer !",
  'button.scanPhone': 'Scanner le téléphone',
  'button.openFolder': 'Ouvrir un dossier',
  'button.selectDirectory': 'Choisir un dossier',
  'onboarding.name': 'Ton prénom',
};

const dictionary: Record<string, string> = fr;

export function t(key: keyof typeof en, args: Record<string, string | number> = {}): string {
  return dictionary[key].replace(/\{(\w+)\}/g, (_, name) => String(args[name] ?? `{${name}}`));
}
