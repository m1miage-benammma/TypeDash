import { Language } from '../../../core/models/language';
import { ContentPage, ContentPageId } from '../models/content-page';

export const CONTENT_PAGES: Record<Language, Record<ContentPageId, ContentPage>> = {
  en: {
    typingSpeedGuide: {
      eyebrow: 'TYPING FUNDAMENTALS',
      title: 'How to type faster without losing control',
      summary: 'Sustainable speed comes from efficient movement, reliable accuracy and short, focused practice—not from forcing your fingers to move faster.',
      sections: [
        {
          title: 'Build a repeatable technique',
          paragraphs: [
            'Place your fingers lightly on the home row and keep your wrists neutral. Each finger should cover a predictable group of keys, while your hands make only the movements that are necessary. Looking at the screen instead of the keyboard gives your brain a consistent feedback loop.',
            'Do not chase a high WPM score during every session. Begin at a pace where you can type whole words smoothly. Speed grows when common letter combinations become automatic and hesitation disappears.',
          ],
        },
        {
          title: 'Use deliberate practice',
          paragraphs: ['A useful session has a clear purpose. Alternate normal text with drills that expose a weakness, such as capital letters, punctuation or a difficult key pair. Stop when tension or repeated mistakes appear; tired practice often reinforces the wrong movement.'],
          bullets: [
            'Warm up for two minutes at a comfortable pace.',
            'Complete three to five focused tests.',
            'Review accuracy and recurring mistakes, not only your best speed.',
            'Repeat the same focus on several days before changing it.',
          ],
        },
        {
          title: 'Measure progress over time',
          paragraphs: [
            'Compare averages across several sessions rather than reacting to one unusually fast or slow result. A stable average reflects your everyday ability more accurately than a personal best.',
            'Increase your target gradually. When accuracy remains above your chosen threshold and the movement feels relaxed, add a small amount of speed. If accuracy falls sharply, slow down until rhythm returns.',
          ],
        },
      ],
      ctaTitle: 'Turn the guide into practice',
      ctaText: 'Run a focused TypeDash test and use the saved averages to track progress across sessions.',
      ctaLabel: 'Start a typing test',
    },
    accuracyGuide: {
      eyebrow: 'ACCURACY FIRST',
      title: 'How to improve typing accuracy',
      summary: 'Accuracy is the foundation of useful typing speed. Fewer corrections preserve rhythm, reduce fatigue and make every WPM result more meaningful.',
      sections: [
        {
          title: 'Understand why errors happen',
          paragraphs: [
            'Errors usually come from rushing, inconsistent finger choice, looking away from the text or carrying too much tension in the hands. Notice whether mistakes cluster around particular keys, transitions or punctuation marks. A pattern gives you something specific to practise.',
            'Backspace can hide the cost of an error. During practice, pay attention to the first incorrect character and the movement that produced it. Correct technique before increasing pace.',
          ],
        },
        {
          title: 'Train at an accuracy-controlled pace',
          paragraphs: ['Choose a speed that lets you read slightly ahead of your fingers. Keep a steady rhythm and treat each word as a sequence instead of a collection of isolated letters. Consistent spacing is part of accuracy too.'],
          bullets: [
            'Aim for clean, relaxed keystrokes instead of hitting keys harder.',
            'Slow down before difficult words rather than correcting them afterward.',
            'Practise problem combinations in short bursts, then return to normal text.',
            'Use punctuation and number options only after basic text feels stable.',
          ],
        },
        {
          title: 'Use the right metric',
          paragraphs: [
            'Accuracy is the percentage of entered characters that match the target. Review it together with corrected speed: a fast result with many errors is not equivalent to fluent typing.',
            'Track your average accuracy over several sessions. Once it is consistently high, increase speed in small steps while keeping the same calm technique.',
          ],
        },
      ],
      ctaTitle: 'Practise with immediate feedback',
      ctaText: 'TypeDash marks correct characters clearly and mistakes in red so you can adjust without losing your place.',
      ctaLabel: 'Practise accuracy',
    },
    wpmCalculator: {
      eyebrow: 'TYPING METRICS',
      title: 'Words-per-minute calculator',
      summary: 'Estimate gross WPM, adjusted WPM and accuracy from the number of characters typed, elapsed time and mistakes.',
      sections: [
        {
          title: 'How WPM is calculated',
          paragraphs: [
            'Typing tests normally treat five characters—including spaces and punctuation—as one standard word. Gross WPM divides the total standard words by elapsed minutes. This makes results comparable even when the actual words have different lengths.',
            'Adjusted WPM subtracts the error rate from gross speed. Different platforms can use slightly different penalty rules, so compare results produced with the same method.',
          ],
        },
        {
          title: 'How to interpret the result',
          paragraphs: ['A single score is a snapshot. Text difficulty, duration, familiarity and fatigue all affect it. Longer tests usually provide a more stable estimate, while short tests are useful for warm-ups and technique drills.'],
          bullets: [
            'Gross WPM shows raw output.',
            'Adjusted WPM accounts for mistakes.',
            'Accuracy shows how much of the entered text was correct.',
            'Session averages reveal progress more reliably than one personal best.',
          ],
        },
      ],
      ctaTitle: 'Measure it automatically',
      ctaText: 'Take a TypeDash test to calculate speed and accuracy directly from your keystrokes.',
      ctaLabel: 'Take the test',
    },
    programmerTest: {
      eyebrow: 'DEVELOPER PRACTICE',
      title: 'Typing practice for programmers',
      summary: 'Programming combines natural language with symbols, indentation, identifiers and repeated key combinations. Training should reflect that variety.',
      sections: [
        {
          title: 'Why code feels different',
          paragraphs: [
            'Code contains braces, brackets, operators, underscores, digits and mixed-case identifiers more often than ordinary prose. These characters require frequent use of Shift and movement away from the home row. A high prose WPM therefore does not automatically translate into comfortable coding.',
            'Programming speed also depends on thinking, navigation and editing. Typing drills should improve mechanical fluency without encouraging rushed or careless code.',
          ],
        },
        {
          title: 'Practise the patterns you use',
          paragraphs: ['Use short samples from the languages and tools you work with, but remove secrets and proprietary code. Focus on recurring syntax and identifiers instead of memorising one long snippet.'],
          bullets: [
            'Alternate letters with brackets, parentheses and common operators.',
            'Practise snake_case, camelCase and file paths.',
            'Include numbers and punctuation in normal word-based sessions.',
            'Keep accuracy high so symbol mistakes do not become habits.',
          ],
        },
        {
          title: 'Protect ergonomics',
          paragraphs: ['Developer sessions can last for hours, so comfort matters more than a peak score. Use light keystrokes, keep frequently used shortcuts comfortable and take brief breaks. Remap a painful combination instead of repeatedly forcing an awkward movement.'],
        },
      ],
      ctaTitle: 'Add technical variety',
      ctaText: 'Enable punctuation and numbers in TypeDash to mix code-relevant characters into a normal typing flow.',
      ctaLabel: 'Start programmer practice',
    },
  },
  fr: {
    typingSpeedGuide: {
      eyebrow: 'BASES DE LA FRAPPE',
      title: 'Taper plus vite sans perdre le contrôle',
      summary: 'Une vitesse durable vient de gestes efficaces, d’une précision régulière et de séances courtes et ciblées, pas de mouvements forcés.',
      sections: [
        {
          title: 'Construire une technique reproductible',
          paragraphs: [
            'Posez légèrement les doigts sur la rangée de repos et gardez les poignets dans une position neutre. Chaque doigt couvre un groupe de touches prévisible, tandis que les mains évitent les déplacements inutiles. Regarder l’écran plutôt que le clavier crée une boucle de retour cohérente.',
            'Ne cherchez pas un record à chaque séance. Commencez à une allure qui permet d’écrire des mots entiers avec fluidité. La vitesse augmente lorsque les combinaisons courantes deviennent automatiques et que les hésitations disparaissent.',
          ],
        },
        {
          title: 'Pratiquer avec une intention précise',
          paragraphs: ['Une bonne séance poursuit un objectif clair. Alternez le texte courant avec des exercices qui révèlent une faiblesse : majuscules, ponctuation ou paire de touches difficile. Arrêtez-vous lorsque la tension ou les erreurs répétées apparaissent.'],
          bullets: [
            'Échauffez-vous deux minutes à une allure confortable.',
            'Effectuez trois à cinq tests ciblés.',
            'Analysez la précision et les erreurs récurrentes, pas seulement le record.',
            'Gardez le même objectif plusieurs jours avant d’en changer.',
          ],
        },
        {
          title: 'Mesurer les progrès dans le temps',
          paragraphs: [
            'Comparez les moyennes de plusieurs séances plutôt qu’un résultat exceptionnellement rapide ou lent. Une moyenne stable représente mieux votre niveau habituel qu’un record isolé.',
            'Augmentez progressivement l’objectif. Lorsque la précision reste élevée et que les gestes sont détendus, accélérez légèrement. Si la précision chute, ralentissez jusqu’au retour du rythme.',
          ],
        },
      ],
      ctaTitle: 'Passer du guide à la pratique',
      ctaText: 'Lancez un test TypeDash ciblé et utilisez les moyennes enregistrées pour suivre vos progrès.',
      ctaLabel: 'Commencer un test',
    },
    accuracyGuide: {
      eyebrow: 'LA PRÉCISION D’ABORD',
      title: 'Améliorer sa précision de frappe',
      summary: 'La précision est la base d’une vitesse réellement utile. Moins de corrections préserve le rythme, réduit la fatigue et rend les résultats plus pertinents.',
      sections: [
        {
          title: 'Comprendre l’origine des erreurs',
          paragraphs: [
            'Les erreurs viennent souvent d’une vitesse excessive, d’un doigté irrégulier, d’un regard détourné du texte ou d’une tension dans les mains. Observez si elles se concentrent sur certaines touches, transitions ou signes de ponctuation.',
            'La touche Retour arrière peut masquer le coût d’une faute. Pendant l’entraînement, identifiez le premier caractère incorrect et le mouvement qui l’a produit. Corrigez la technique avant d’accélérer.',
          ],
        },
        {
          title: 'S’entraîner à une allure maîtrisée',
          paragraphs: ['Choisissez une vitesse qui permet de lire légèrement en avance sur les doigts. Gardez un rythme stable et considérez chaque mot comme une séquence plutôt qu’une série de lettres isolées.'],
          bullets: [
            'Privilégiez des frappes légères et détendues.',
            'Ralentissez avant un mot difficile plutôt que de le corriger ensuite.',
            'Travaillez les combinaisons problématiques brièvement, puis revenez au texte normal.',
            'Ajoutez ponctuation et nombres lorsque le texte simple est stable.',
          ],
        },
        {
          title: 'Suivre la bonne mesure',
          paragraphs: [
            'La précision représente la part des caractères saisis qui correspondent au texte attendu. Consultez-la avec la vitesse corrigée : un résultat rapide comportant de nombreuses erreurs n’est pas une frappe fluide.',
            'Suivez votre précision moyenne sur plusieurs séances. Lorsqu’elle reste régulièrement élevée, augmentez la vitesse par petites étapes.',
          ],
        },
      ],
      ctaTitle: 'S’entraîner avec un retour immédiat',
      ctaText: 'TypeDash affiche clairement les caractères corrects et les erreurs en rouge afin de vous corriger sans perdre votre position.',
      ctaLabel: 'Travailler la précision',
    },
    wpmCalculator: {
      eyebrow: 'MESURES DE FRAPPE',
      title: 'Calculateur de mots par minute',
      summary: 'Estimez vos MPM bruts, vos MPM corrigés et votre précision à partir des caractères saisis, du temps écoulé et des erreurs.',
      sections: [
        {
          title: 'Comment calculer les MPM',
          paragraphs: [
            'Les tests considèrent généralement cinq caractères, espaces et ponctuation compris, comme un mot standard. Les MPM bruts divisent le nombre de mots standards par le temps en minutes. Les résultats restent ainsi comparables malgré des mots de longueurs différentes.',
            'Les MPM corrigés retirent le taux d’erreur à la vitesse brute. Les plateformes peuvent appliquer des pénalités légèrement différentes : comparez donc des résultats calculés avec la même méthode.',
          ],
        },
        {
          title: 'Interpréter le résultat',
          paragraphs: ['Un score unique est une photographie. Difficulté du texte, durée, familiarité et fatigue le font varier. Un test long donne une estimation plus stable ; un test court convient à l’échauffement.'],
          bullets: [
            'Les MPM bruts mesurent la production totale.',
            'Les MPM corrigés tiennent compte des erreurs.',
            'La précision indique la part correcte de la saisie.',
            'Les moyennes de plusieurs séances révèlent mieux les progrès.',
          ],
        },
      ],
      ctaTitle: 'Mesurer automatiquement',
      ctaText: 'Passez un test TypeDash pour calculer directement vitesse et précision à partir de votre frappe.',
      ctaLabel: 'Passer le test',
    },
    programmerTest: {
      eyebrow: 'ENTRAÎNEMENT DÉVELOPPEUR',
      title: 'Pratique de frappe pour programmeurs',
      summary: 'Le code mélange langage naturel, symboles, indentation, identifiants et combinaisons répétées. L’entraînement doit refléter cette diversité.',
      sections: [
        {
          title: 'Pourquoi le code est différent',
          paragraphs: [
            'Le code contient plus souvent accolades, crochets, opérateurs, tirets bas, chiffres et identifiants mixtes que le texte courant. Ces caractères utilisent fréquemment Maj et éloignent les doigts de la rangée de repos.',
            'La vitesse de programmation dépend aussi de la réflexion, de la navigation et de l’édition. Les exercices doivent améliorer l’aisance mécanique sans encourager un code précipité.',
          ],
        },
        {
          title: 'Travailler les motifs utiles',
          paragraphs: ['Utilisez de courts exemples issus de vos langages et outils, après avoir retiré secrets et code confidentiel. Concentrez-vous sur les syntaxes récurrentes plutôt que de mémoriser un long extrait.'],
          bullets: [
            'Alternez lettres, crochets, parenthèses et opérateurs courants.',
            'Entraînez-vous à snake_case, camelCase et aux chemins de fichiers.',
            'Mélangez nombres et ponctuation aux séances basées sur des mots.',
            'Conservez une grande précision pour ne pas automatiser les erreurs.',
          ],
        },
        {
          title: 'Préserver l’ergonomie',
          paragraphs: ['Les sessions de développement peuvent durer plusieurs heures : le confort compte davantage qu’un pic de vitesse. Frappez légèrement, gardez les raccourcis fréquents confortables et faites de courtes pauses.'],
        },
      ],
      ctaTitle: 'Ajouter de la variété technique',
      ctaText: 'Activez ponctuation et nombres dans TypeDash pour intégrer des caractères utiles au code dans un flux de mots normal.',
      ctaLabel: 'Commencer l’entraînement',
    },
  },
};
