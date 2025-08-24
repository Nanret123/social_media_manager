// export interface GoogleProfile {
//   id: string;
//   email: string;
//   firstName: string;
//   lastName: string;
//   picture?: string;
// }

export interface GoogleProfile {
  id: string;
  emails: Array<{ value: string; verified: boolean }>;
  name: { givenName: string; familyName: string };
  photos: Array<{ value: string }>;
}