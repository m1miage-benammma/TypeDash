import { inject, Injectable } from '@angular/core';
import { PreferencesService } from './preferences.service';

const en = {
  practice: 'Typing test', progress: 'My progress',
  themeDark: 'Switch to dark mode', themeLight: 'Switch to light mode', language: 'Language',
  headline: 'Find your typing', flow: 'flow.', personalBest: 'YOUR PERSONAL BEST', noBest: 'Your story starts here',
  punctuation: 'Punctuation', numbers: 'Numbers', textOptions: 'Add to the text',
  duration: 'Test duration', difficulty: 'Difficulty', easy: 'Easy', medium: 'Medium', hard: 'Difficult',
  custom: 'Custom', customDuration: 'Custom duration', customSeconds: 'Enter seconds (1–300)',
  customPlaceholder: 'e.g. 45', set: 'Set', durationHint: 'Maximum: 300 seconds',
  durationMax: 'The maximum duration is 300 seconds.', durationInvalid: 'Enter a whole number from 1 to 300.',
  layout: 'Text layout', multipleLines: 'Multiple lines', wordByWord: 'Word by word',
  readyHint: 'The timer starts on your first character.',
  runningHint: 'The timer pauses after 1.2 seconds without typing.',
  pausedHint: 'Type to resume. Your remaining time is saved.',
  loading: 'Finding your next challenge…', loadFailed: 'We couldn’t reach the practice server.',
  retry: 'Try again', again: 'Try again', restart: 'Restart test', newText: 'New text',
  inputLabel: 'Typing text',
  timer: 'Time left', wpm: 'Words / min', accuracy: 'Accuracy', medianSpeed: 'Median speed', medianAccuracy: 'Median accuracy',
  local: 'Your progress stays in this browser', footer: 'Built for your next personal best.',
  resultsEyebrow: 'ANOTHER STEP FORWARD', resultsTitle: 'That’s a wrap.', resultsHint: 'Every session counts. Here’s how this one went.',
  completeWords: 'Completed words', characters: 'Correct characters', mistakes: 'Mistakes', elapsed: 'Active time',
  progressTitle: 'A little better, every day.',
  progressHint: 'Your last 30 sessions. Medians use the middle result, or the mean of the two middle results.',
  noHistory: 'Your first finish line is waiting.', noHistoryHint: 'Complete a test to save your speed, accuracy and word count.',
  sessions: 'Sessions', best: 'Best speed', recent: 'Recent sessions', date: 'Date', test: 'Test',
  clear: 'Clear history', clearConfirm: 'Clear all typing results saved in this browser?', back: 'Back to practice',
  saving: 'Calculating your results…', saveFailed: 'The result could not be retrieved. Retry without losing your input.',
  retryResult: 'Get my results', connection: 'Connection interrupted. Your input is still here; we’ll retry.',
  paste: 'Type each character yourself — pasting is disabled during a test.',
  chart: 'Speed across your recent sessions', resultChart: 'Speed during this session',
  restartConfirm: 'Restart this test? Your current attempt will be discarded.',
  cancel: 'Cancel', confirm: 'Confirm',
} as const;

type Key = keyof typeof en;

const fr: Record<Key, string> = {
  practice: 'Test de frappe', progress: 'Mes progrès',
  themeDark: 'Activer le thème sombre', themeLight: 'Activer le thème clair', language: 'Langue',
  headline: 'Trouvez votre', flow: 'rythme.', personalBest: 'VOTRE RECORD PERSONNEL', noBest: 'Tout commence ici',
  punctuation: 'Ponctuation', numbers: 'Nombres', textOptions: 'Ajouter au texte',
  duration: 'Durée du test', difficulty: 'Difficulté', easy: 'Facile', medium: 'Moyen', hard: 'Difficile',
  custom: 'Personnalisé', customDuration: 'Durée personnalisée', customSeconds: 'Saisissez les secondes (1–300)',
  customPlaceholder: 'ex. 45', set: 'Appliquer', durationHint: 'Maximum : 300 secondes',
  durationMax: 'La durée maximale est de 300 secondes.', durationInvalid: 'Saisissez un nombre entier de 1 à 300.',
  layout: 'Disposition du texte', multipleLines: 'Plusieurs lignes', wordByWord: 'Mot par mot',
  readyHint: 'Le chrono démarre au premier caractère.',
  runningHint: 'Le chrono se met en pause après 1,2 seconde sans frappe.',
  pausedHint: 'Saisissez pour reprendre. Le temps restant est conservé.',
  loading: 'Préparation du prochain défi…', loadFailed: 'Le serveur d’entraînement est injoignable.',
  retry: 'Réessayer', again: 'Recommencer', restart: 'Recommencer le test', newText: 'Nouveau texte',
  inputLabel: 'Texte à saisir',
  timer: 'Temps restant', wpm: 'Mots / min', accuracy: 'Précision', medianSpeed: 'Vitesse médiane', medianAccuracy: 'Précision médiane',
  local: 'Vos progrès restent dans ce navigateur', footer: 'En route vers votre prochain record.',
  resultsEyebrow: 'UN PAS DE PLUS', resultsTitle: 'À vous de jouer, encore.', resultsHint: 'Chaque séance compte. Voici votre résultat.',
  completeWords: 'Mots terminés', characters: 'Caractères corrects', mistakes: 'Erreurs', elapsed: 'Temps actif',
  progressTitle: 'Un peu mieux, chaque jour.',
  progressHint: 'Vos 30 dernières séances. La médiane est le résultat central, ou la moyenne des deux résultats centraux.',
  noHistory: 'Votre première arrivée vous attend.', noHistoryHint: 'Terminez un test pour enregistrer vitesse, précision et nombre de mots.',
  sessions: 'Séances', best: 'Meilleure vitesse', recent: 'Dernières séances', date: 'Date', test: 'Test',
  clear: 'Effacer l’historique', clearConfirm: 'Effacer tous les résultats enregistrés dans ce navigateur ?', back: 'Retour au test',
  saving: 'Calcul de vos résultats…', saveFailed: 'Le résultat est indisponible. Réessayez sans perdre votre saisie.',
  retryResult: 'Obtenir mon résultat', connection: 'Connexion interrompue. Votre saisie est conservée ; nous réessayons.',
  paste: 'Saisissez chaque caractère : le collage est désactivé pendant le test.',
  chart: 'Vitesse des dernières séances', resultChart: 'Vitesse pendant cette séance',
  restartConfirm: 'Recommencer ce test ? La tentative actuelle sera abandonnée.',
  cancel: 'Annuler', confirm: 'Confirmer',
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly preferences = inject(PreferencesService);
  t(key: Key): string {
    return this.preferences.language() === 'fr' ? fr[key] : en[key];
  }
}
