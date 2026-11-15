// Who is on each photo, for the autopilot (services/autopilot.ts): filled by the face search
// (hooks/usePeople.ts) when people recognition is on. Only random person ids are used as
// features, never names or face data; names are looked up here only to describe a learned rule.

export interface PhotoPeople {
  people: string[]; // person ids
  faces: number; // faces found on the photo
}

let byPhoto = new Map<string, PhotoPeople>();
let names = new Map<string, string>();

/** Replaces what is known: called after every face search or correction. */
export function setPhotoPeople(next: Map<string, PhotoPeople>, displayNames: Map<string, string>) {
  byPhoto = next;
  names = displayNames;
}

/** Undefined while the faces of the photo have not been looked for (or the feature is off). */
export const peopleOfPhoto = (photoId: string): PhotoPeople | undefined => byPhoto.get(photoId);

export const personName = (personId: string): string | undefined => names.get(personId);
