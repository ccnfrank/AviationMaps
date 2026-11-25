// Limites de zoom e brilho da janela de visualização. Valem para o teclado e para a roda do mouse.
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 6;
// Brilho em porcentagem: 100% é a imagem como está; 0% é tela preta.
export const BRIGHTNESS_MIN = 0;
export const BRIGHTNESS_MAX = 150;
export const BRIGHTNESS_DEFAULT = 100;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
