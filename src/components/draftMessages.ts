const MESSAGES: Record<string, string> = {
  'flat-name-required': 'Give the flat a name.',
  'flat-name-too-long': 'The flat name is too long (60 characters at most).',
  'members-required': 'Add at least one person.',
  'members-too-many': 'There are too many people (20 at most).',
  'member-name-too-long': 'A person name is too long (40 characters at most).',
  'members-duplicated': 'Two people have the same name.',
  'zones-required': 'Add at least one zone.',
  'zones-too-many': 'There are too many zones (20 at most).',
  'zone-name-too-long': 'A zone name is too long (60 characters at most).',
  'zone-name-invalid': 'Zone names cannot contain a slash.',
  'zones-duplicated': 'Two zones have the same name.',
  'start-date-invalid': 'Choose a valid start date for the rotation.',
  'owner-required': 'Choose which person you are.',
}

// Turns the error codes of the domain into text for the user.
export const describeDraftError = (code: string): string =>
  MESSAGES[code] ?? 'Check the data and try again.'
