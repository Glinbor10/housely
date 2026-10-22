// English is the source of truth: Spanish must have exactly the same keys (checked by a test) and the
// same {placeholders}.
export const en = {
  // Shared
  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.loading': 'Loading',
  'common.remove': 'Remove',
  'common.save': 'Save',
  'common.saving': 'Saving...',
  'common.you': '{name} (you)',
  'common.somethingWentWrong': 'Something went wrong. Try again.',
  'common.language': 'Language',

  // Sections
  'tab.sections': 'Sections',
  'tab.week': 'Week',
  'tab.history': 'History',
  'tab.people': 'People',
  'tab.flat': 'My flat',
  'tab.settings': 'Settings',

  // Settings
  'settings.appearance': 'Appearance',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.theme.system': 'Auto',
  'settings.account': 'Account',
  'settings.linked': 'Signed in with Google.',
  'settings.linkedAs': 'Signed in with Google as {email}.',
  'settings.notLinked':
    'Not linked to Google. If you lose this phone you will need the invite code to get back in.',
  'settings.version': 'Housely v{version}',

  // History
  'history.empty': 'Nothing to show yet.',
  'history.byPerson': 'By person',
  'history.byZone': 'By zone',
  'history.weeks': 'Week by week',
  'history.weekOf': 'Week {n} · from {date}',
  'history.progress': '{done} of {assigned} done',
  'history.missedCount': '{n} missed',
  'history.missed': 'Missed',
  'history.resting': 'Resting: {names}',
  'history.showOlder': 'Show older weeks',

  // Welcome
  'welcome.tagline':
    'Share the chores of your flat: every week each person gets a zone and the rotation does the rest.',
  'welcome.create': 'Create a flat',
  'welcome.join': 'Join a flat',
  'welcome.signIn': 'I already have a flat',

  // Google
  'google.title': 'Create your flat with Google',
  'google.why':
    'Your flat stays yours: with your Google account you can find it again from any phone, even if you lose this one.',
  'google.flatmates':
    'Flatmates do not need Google: they join with the invite code and can link their account later if they want.',
  'google.continue': 'Continue with Google',
  'google.opening': 'Opening Google...',
  'google.cancelled': 'Sign-in cancelled.',
  'google.error.popup-blocked':
    'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
  'google.error.not-enabled': 'Signing in with Google is not enabled for this app yet.',
  'google.error.unauthorized-domain': 'This address is not authorized for Google sign-in.',
  'google.error.account-in-use':
    'That Google account already belongs to another profile. Use a different Google account, or sign in with this one from the start screen.',
  'google.error.network': 'No connection. Check your network and try again.',
  'google.error.unknown': 'Could not sign in with Google. Try again.',

  // Save access banner
  'saveAccess.text':
    'Save your access: link your Google account (optional) so you can get back to this flat from another phone.',
  'saveAccess.notNow': 'Not now',
  'saveAccess.link': 'Link Google',
  'saveAccess.linking': 'Linking...',

  // My flats
  'myFlats.title': 'Your flats',
  'myFlats.looking': 'Looking for your flats...',
  'myFlats.none':
    'We did not find any flat for this Google account. If you were invited to one, go back and join with the invite code.',

  // Join
  'join.title': 'Join a flat',
  'join.ask': 'Ask a flatmate for the invite code of your flat.',
  'join.code': 'Invite code',
  'join.continue': 'Continue',
  'join.searching': 'Searching...',
  'join.joining': 'Joining {name}',
  'join.who': 'Who are you?',
  'join.allTaken': 'Every person of this flat is already taken. Ask the creator to add you.',
  'join.unknownCode': 'That invite code does not exist. Check it and try again.',

  // Create flat
  'create.title': 'Create a flat',
  'create.step': 'Step {n} of {total}',
  'create.next': 'Next',
  'create.stepTitle.flat': 'About the flat',
  'create.flatName': 'Flat name',
  'create.people': 'People (in rotation order)',
  'create.personIsMe': 'Person {n} is me',
  'create.person': 'Person {n}',
  'create.removePerson': 'Remove person {n}',
  'create.addPerson': 'Add person',
  'create.selectMe': 'Select the circle next to the person you are.',
  'create.zones': 'Zones to clean',
  'create.zone': 'Zone {n}',
  'create.removeZone': 'Remove zone {n}',
  'create.addZone': 'Add zone',
  'create.start': 'Start of the rotation',
  'create.submit': 'Create flat',
  'create.creating': 'Creating...',
  'create.suggestedZones': 'Living room|Kitchen|Bathroom',
  'create.error.flat-name-required': 'Give the flat a name.',
  'create.error.flat-name-too-long': 'The flat name is too long (60 characters at most).',
  'create.error.members-required': 'Add at least one person.',
  'create.error.members-too-many': 'There are too many people (20 at most).',
  'create.error.member-name-too-long': 'A person name is too long (40 characters at most).',
  'create.error.members-duplicated': 'Two people have the same name.',
  'create.error.zones-required': 'Add at least one zone.',
  'create.error.zones-too-many': 'There are too many zones (20 at most).',
  'create.error.zone-name-too-long': 'A zone name is too long (60 characters at most).',
  'create.error.zone-name-invalid': 'Zone names cannot contain a slash.',
  'create.error.zones-duplicated': 'Two zones have the same name.',
  'create.error.start-date-invalid': 'Choose a valid start date for the rotation.',
  'create.error.owner-required': 'Choose which person you are.',
  'create.error.generic': 'Check the data and try again.',
  'create.flatLimit':
    'You can create up to {max} flats from this device. Join an existing flat with its invite code instead.',

  // Install hint
  'install.text':
    'Install Housely: tap Share, then Add to Home Screen. Otherwise Safari may delete your data after a week without opening it and you could lose your access to the flat.',
  'install.gotIt': 'Got it',

  // Invite code
  'invite.label': 'Invite code',
  'invite.shareAria': 'Share the code',
  'invite.share': 'Share',
  'invite.message': 'Join our flat on Housely with the code {code}: {url}',
  'invite.copied': 'Copied: paste it in your chat.',
  'invite.manual': 'Could not share from here: send it by hand. {message}',

  // This week
  'week.title': 'Week {n}',
  'week.zonesDone': '{done} of {total} zones done this week',
  'week.progress': 'Progress of the week',
  'week.allClean': 'Everything is clean this week. Well done!',
  'week.done': 'Done {date}',
  'week.pending': 'Pending',
  'week.markDone': 'Mark as done',
  'week.doneDate': 'Date done: {zone}',
  'week.updateDate': 'Update date',
  'week.resting': 'Free this week: {names}',

  // People
  'people.title': 'People',
  'people.release': 'Release',
  'people.releaseAria': 'Release {name}',
  'people.waiting': 'Waiting for {name} to join',
  'people.confirm':
    '{name} will lose access on their current phone and can rejoin with the invite code. What they already cleaned is kept.',
  'people.confirmYes': 'Yes, release',

  // Editing the rotation
  'rotation.edit': 'Edit people and zones',
  'rotation.title': 'Edit people and zones',
  'rotation.appliesFrom':
    'The change applies from {date}, next week. This week stays as it is, and so does every week already lived.',
  'rotation.limitReached':
    'This flat has reached the limit of 20 people ever added, so nobody else can be added.',

  // Tricount
  'tricount.open': 'Open Tricount',
  'tricount.openHint': 'The shared expenses of the flat',
  'tricount.addHint': 'Tap to add the link of your Tricount',
  'tricount.notYet': 'The owner has not added the Tricount link yet.',
  'tricount.edit': 'Edit Tricount link',
  'tricount.add': 'Add Tricount link',
  'tricount.label': 'Tricount link',
  'tricount.help': 'Leave it empty to remove the link.',
  'tricount.not-https': 'The link must start with https://',
  'tricount.not-tricount': 'Only links on tricount.com are allowed.',
  'tricount.too-long': 'The link is too long (300 characters at most).',

  // Flat screen
  'flat.leave': 'Leave this flat on this device',
  'flat.unavailable': 'This flat is not available. You may have lost access to it.',

  // Sign-in gate
  'auth.failed': 'Could not sign in. Check your connection and reload the page.',
} as const
