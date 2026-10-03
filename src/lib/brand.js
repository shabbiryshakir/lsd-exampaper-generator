// The app's name and words in one place, so a rename never means hunting through the code.
export const BRAND = {
  name: 'LSD Paper Maker',
  short: 'LSD Paper Maker',
  tagline: 'Exam papers for LSD teachers',
  description: 'A free community tool for teachers: make exam papers and answer keys in Lisan ud Dawat and English, work on them with colleagues, and print clean A4 PDFs.',
};

// Shown in the app so anyone can see exactly which version they have.
/* global __BUILD_TIME__ */
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';
