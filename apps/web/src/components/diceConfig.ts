export type CubeFace = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom';

export const PIP_POSITIONS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

export const FACE_VALUE_MAP: Record<CubeFace, number> = {
  front: 1,
  back: 6,
  right: 3,
  left: 4,
  top: 5,
  bottom: 2
};

export const FACE_TRANSFORMS: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(90deg) rotateY(0deg)',
  3: 'rotateX(0deg) rotateY(-90deg)',
  4: 'rotateX(0deg) rotateY(90deg)',
  5: 'rotateX(-90deg) rotateY(0deg)',
  6: 'rotateX(180deg) rotateY(0deg)'
};

export const CUBE_FACES: CubeFace[] = ['front', 'back', 'right', 'left', 'top', 'bottom'];
